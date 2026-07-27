# Plano — Migração OrbitBot WPPConnect → Baileys + Simplificação

| Campo | Valor |
|-------|-------|
| Repo | `/home/gaab/Documentos/GitHub/OrbitBot` |
| Branch | `refactor/wppconnect-to-baileys` (obrigatória — proibido tocar `main`) |
| Docs upstream | PRD, ADR-0001, ARCHITECTURE, DATA-MODEL, API_SPEC, CONTRIBUTING — status **aprovado** |
| Autor | Planner (MegaBrain Fase 1) |
| Data | 2026-07-26 |

---

## Objetivo

Substituir `@wppconnect-team/wppconnect` por `@whiskeysockets/baileys`, eliminar MessageQueue/pipeline/PluginSystem/Dashboard HTTP:3000/`treinamento.js`, unificar a persistência em SQLite com tabela `config`, mover `ADMIN_NUMBERS` para `.env`, introduzir mutex por JID e humanizer adaptado, unificar logs em `pino`, e preservar `/ai`, `/backup`, `/historico`, `/reset` (sem `/ai plugin*`) — mantendo o projeto 100% JavaScript (CommonJS).

**Critério de fecho global:** `npm start` sobe sessão Baileys (QR no terminal, sem porta HTTP), responde 1:1, ignora grupos/broadcasts na origem, `/ai modelo`/`/ai personalidade` persistem após `kill` + restart, `package.json` sem `@wppconnect-team/wppconnect` e sem Express/dashboard, e os ficheiros mortos do DoD (`treinamento.js`, `pluginSystem.js`, `plugins/`, `queue.js`, `dashboard.js`, `performance.js`, `core/pipeline.js`, `repositories/*`) estão ausentes do repositório.

---

## Verificação de existência

| Artefacto | Método | Estado |
|-----------|--------|--------|
| `app.js`, `src/**`, `database/**`, `plugins/**` | Read + `find` no repo | confirmado |
| `package.json` (deps: `axios`, `dotenv`, `sqlite3`, `@wppconnect-team/wppconnect`; sem `devDependencies`) | Read | confirmado |
| `database/db/index.js` (schema `clientes`/`historico`, funções `cadastrarCliente`/`buscarCliente`/`adicionarMensagem`/`buscarHistorico`/`buscarUltimasMensagens`) | Read | confirmado |
| `database/index.js` (fachada com aliases PT) | Read | confirmado |
| `src/repositories/{clients,history}Repo.js` | Read | confirmado |
| `src/bot.js` (WPPConnect, `ADMIN_NUMBERS` hardcoded, `MessageQueue`, `pipeline.run`) | Read | confirmado |
| `src/core/{pipeline,cache,retry}.js` | Read | confirmado |
| `src/openai.js` (hooks `pluginSystem.executeHook('beforeMessage'/'afterMessage'/'messageProcessed')`, `generateCacheKey` sem JID) | Read | confirmado — RF-013 é bug real, não suposição |
| `src/aiConfig.js` (`AIConfigManager` só em memória, sem persistência) | Read | confirmado |
| `src/pluginSystem.js` + `plugins/{fastAutoReply,weatherPlugin}.js` | Read | confirmado |
| `src/dashboard.js` (HTTP:3000 + SSE `/events`, sem auth) | Read | confirmado |
| `src/performance.js`, `src/queue.js` (buffer 15s), `src/logger.js` (EventEmitter + console) | Read | confirmado |
| `src/commands/commandBus.js` + `src/commands/admin/{ai,backup,db,history}.js` | Read | confirmado |
| `src/treinamento.js` (código morto, não importado) | Grep de `require` | confirmado — órfão |
| `.env.example` | Glob | **ausente** — precisa ser criado (RF-014) |
| `auth/` no `.gitignore` | Read `.gitignore` | **ausente** — só existe `tokens/`/`*.session`/`wppconnect-session/`; precisa adicionar `auth/` |
| Suite de testes automatizados (`test/`, `*.spec.*`) | Glob | **ausente** — CONTRIBUTING confirma "até existir suite" |
| Versão real do Node.js no ambiente de execução (dev/produção) | `node -v` | **ausente** — `node`/`npm` indisponíveis neste ambiente de planeamento (subagente sem shell Node) |
| `@whiskeysockets/baileys` — versões publicadas (`7.0.0-rc13` atual/ESM/Node≥20; `6.7.23` legado estável/CJS) | WebSearch (npm/GitHub, 2026-07-26) | confirmado |
| `pino` — versão publicada (`10.3.1` atual; linha `9.x` até `9.14.0`) | WebSearch (npm, 2026-07-26) | confirmado |
| `qrcode-terminal`, `@hapi/boom` — versões exatas publicadas | não consultado (sem `npm` neste shell) | suposição — resolver via `npm view <pkg>@latest version` no ID 1/4 |

**Suposições pendentes:**

1. **Versão do Node.js no ambiente real** não confirmada (comando indisponível neste shell de planeamento). Assume-se piso mínimo seguro Node ≥ 18 LTS. **ID 1** (spike) confirma no ambiente real antes de fixar `engines` e versões de `baileys`/`pino`.
2. **Estrutura de ficheiros internos não listada explicitamente em `ARCHITECTURE.md`** (rotulada "simplificada"): a lógica de negócio hoje em `src/core/pipeline.js` precisa de um lar após a remoção do nome "pipeline". Decisão do Planner: renomear para `src/core/messageHandler.js`, mantendo `src/core/{cache,retry}.js` intactos (nenhum RF exige mover/flatten esses ficheiros; fazê-lo seria mudança desnecessária sem ganho funcional). Se o utilizador/orquestrador divergir, corrigir via `replanejar` sem custo — é reorganização de nome, não de contrato.
3. **Decisão de cache (RF-013):** a ADR e o PRD deixam a decisão em aberto ("incluir JID na chave OU remover"). O Planner decide **manter o cache, incluindo JID na chave** (não remover), porque (a) preserva o comportamento/latência originais — a regra de modificação exige preservar comportamento sempre que possível — e (b) a falha real é de correção (colisão entre utilizadores), não de necessidade da funcionalidade. Remover seria a opção mais simples, mas descartaria uma otimização existente sem necessidade técnica. Ver ID 8.

---

## Análise de contexto

### Legado e débito técnico

O sistema atual acumulou 4 camadas que o PRD manda eliminar (`MessageQueue` com buffer 15s, `pipeline.js`, `PluginSystem` + `plugins/`, `dashboard.js` HTTP/SSE sem auth) e 1 arquivo morto (`treinamento.js`, não importado por nada). A extinção de `PluginSystem` tem efeito cascata: `src/openai.js` chama `pluginSystem.executeHook` em 3 pontos (`beforeMessage`, `afterMessage`, `messageProcessed`) — usados por `autoResponse` (respostas automáticas de saudação) e `statistics`. Ao remover o motor de plugins, essas respostas automáticas deixam de existir (consequência já documentada na ADR-0001 como trade-off aceite: "respostas curtas passam a ir sempre à IA"). O Planner **não** reintroduz lógica substituta (fora de escopo explícito no PRD) — apenas garante que a remoção não deixa `require()` quebrado.

`src/repositories/{clients,history}Repo.js` são wrappers finos sobre `database/index.js` com nomenclatura inconsistente (`atualizarHistorico` como alias de `adicionarMensagem`, ordem de argumentos trocada). O DATA-MODEL já autoriza fundi-los/removê-los — decisão do plano: **remover**, consumidores usam a fachada `database/index.js` diretamente (menos uma camada de indireção sem valor agregado).

### Performance

- **Hot path preservado:** `getRecentHistory` (50 mensagens) + `appendHistory` assíncrono (`setImmediate`) — o padrão atual de não bloquear a resposta ao utilizador é mantido no novo `messageHandler.js`.
- **Footprint:** RNF-001 exige ausência de Chromium/Puppeteer na árvore de dependências — `@whiskeysockets/baileys` é WebSocket puro, sem browser embutido; ganho de memória/CPU é estrutural, não requer medição adicional para ser aceito.
- **Cache IA:** TTL 30 min / 1000 itens é adequado para tráfego 1:1 de baixo volume — nenhum limite precisa mudar, só a chave (ID 8).
- **Mutex por JID:** substitui o buffer de 15s da fila. Efeito colateral aceite pela ADR: mensagens consecutivas do mesmo utilizador deixam de ser agrupadas antes de ir à IA — cada uma dispara processamento sequencial (não paralelo) assim que a anterior terminar. Não é regressão de corretude, é mudança de UX documentada.

### Segurança e conformidade

- **Maior ganho de segurança do plano:** eliminação do dashboard HTTP:3000 sem autenticação (RNF-004) — reduz a superfície de ataque a zero endpoints HTTP expostos.
- **`ADMIN_NUMBERS` sai do código-fonte para `.env`** — elimina exposição de número pessoal em repositório público (RF-010).
- **Sessão Baileys (`auth/`) contém credenciais equivalentes a um token de sessão do WhatsApp** — deve ser gitignored com o mesmo rigor que `.env` (decisão SSOT já fechada). `.gitignore` atual não cobre `auth/` — corrigido no ID 4.
- **Cache sem JID na chave é vazamento real e comprovado** (não hipotético) — dois utilizadores com mensagem+histórico+personalidade+modelo idênticos recebem a resposta cacheada um do outro. Corrigido no ID 8 com prioridade Must (RF-013).
- **`/reset confirmar`** já tem dupla confirmação; decisão SSOT fechada de não apagar `config` é implementada na fachada de dados (ID 3), não no comando (ID 13) — o comando apenas invoca `resetAllData()`.

### Fora de escopo

Conforme PRD: reintrodução de PluginSystem/marketplace; Dashboard HTTP/SSE ou API REST pública; atendimento em grupos/broadcasts; TypeScript/Python; multimodal (imagem/áudio); CI/CD completo; troca do model ID OpenRouter efetivo (mantém DeepSeek free). Nenhum ID deste plano toca essas áreas.

---

## Análise de impacto (resumo executivo)

| Área | Risco | Mitigação (ID) |
|------|-------|-----------------|
| Legado (remoção em cascata Plugin→openai.js→bot.js) | médio | Sequenciamento explícito: ID 8 → ID 16 → ID 5 → ID 18 (nunca deletar arquivo antes de remover suas referências) |
| Performance (perda do buffer 15s da fila) | baixo | Documentado como trade-off aceite na ADR-0001; validado no smoke E2E (ID 27) |
| Segurança (sessão Baileys em `auth/`) | alto | `.gitignore` atualizado antes de qualquer `npm start` real (ID 4, bloqueante) |
| Segurança (cache sem JID) | alto | Fix obrigatório Must, ID 8, testado unitariamente (ID 25) |
| Compatibilidade (Node.js vs Baileys 7.x/ESM vs pino 10.x) | alto | Spike bloqueante ID 1 antes de qualquer instalação de dependência |
| Dados (schema `config` inexistente) | baixo | `CREATE TABLE IF NOT EXISTS` idempotente, sem migração destrutiva (ID 3) |
| Operacional (nova sessão Baileys — QR obrigatório, sessão WPPConnect não portável) | médio | Comunicado na ADR; validado manualmente no E2E (ID 27), sem mitigação de código necessária |

---

## Grafo de execução

| ID | Descrição | Tipo | Complexidade | Depende de | CP | Lote | Critério de aceite técnico |
|----|-----------|------|---------------|------------|----|------|------------------------------|
| 1 | Confirmar Node.js do ambiente-alvo e fixar versões (`@whiskeysockets/baileys`, `pino`, `qrcode-terminal`, `@hapi/boom`) | pesquisa | S | — | sim | — | `node -v` documentado; decisão registrada: `@whiskeysockets/baileys` linha `6.7.x` (CJS, sem ESM) **a menos que** Node ≥20 confirmado e migração ESM seja explicitamente aceite pelo utilizador; `pino` linha compatível com o Node confirmado |
| 2 | Contrato da camada de dados unificada | contrato | M | 1 | sim | P1 | `docs/contracts/data-layer.md` publicado com assinaturas exatas: `getOrCreateClient(numero)`, `appendHistory(clienteId, role, mensagem)`, `getRecentHistory(identifier, limit)`, `getPagedHistory(identifier, page)`, `getConfig(key)`, `setConfig(key, value)`, `resetAllData()` |
| 3 | Implementar tabela `config` + fachada `database/index.js`/`database/db/index.js` | dados | M | 2 | sim | P2 | Script `node -e` cria/lê/atualiza `config`; `resetAllData()` apaga `historico`+`clientes`+sequences e **preserva** `config`; assinaturas idênticas ao contrato ID 2 |
| 4 | Atualizar `package.json`/`.gitignore`/`.env.example` | infra | S | 1 | não | P1 | `package.json` sem `@wppconnect-team/wppconnect`; com `baileys`/`pino`/`qrcode-terminal`/`@hapi/boom` nas versões do ID 1; `.gitignore` contém `auth/`; `.env.example` lista `OPENROUTER_API_KEY`, `ADMIN_NUMBERS` |
| 5 | Motor Baileys básico em `src/bot.js` (auth `auth/`, QR terminal, reconexão, filtro 1:1/grupo/broadcast) | backend | M | 1, 4 | não | P2 | `messages.upsert` só processa `@s.whatsapp.net`/`@c.us` 1:1 (`fromMe`/grupo/broadcast descartados antes da lógica); `connection.update` reconecta automaticamente exceto `loggedOut`; QR impresso via `qrcode-terminal` |
| 6 | `src/concurrency.js` — mutex por JID em memória | backend | S | 1 | não | P1 | `node --test` (ID 25): 2 chamadas concorrentes para o mesmo JID executam em série; JIDs diferentes executam em paralelo |
| 7 | Adaptar `src/humanizer.js` para API Baileys | backend | S | 1 | não | P1 | Assinatura `simularRespostaHumana(sock, jid, texto)` chama `sock.sendMessage(jid, { text })`; fragmentação/atrasos idênticos ao comportamento atual |
| 8 | `src/openai.js`: remover hooks `pluginSystem`; corrigir `generateCacheKey` para incluir JID | backend | S | — | não | P1 | `generateCacheKey` recebe `userId` e o inclui na string da chave; nenhuma chamada a `pluginSystem.executeHook` remanescente (`grep -r pluginSystem src/openai.js` vazio) |
| 9 | `src/aiConfig.js`: hidratar/persistir personalidade e modelo via `config` | backend | S | 3 | não | P3 | Boot chama `getConfig('personality')`/`getConfig('model')` para inicializar `AIConfigManager`; `setPersonality`/`setModel` chamam `setConfig` |
| 10 | Novo `src/core/messageHandler.js` (substitui `pipeline.js`) | backend | M | 3, 6, 8, 9 | sim | P4 | Fluxo: `mutex.acquire(jid)` → `getOrCreateClient` + `getRecentHistory` (paralelo) → `handleMessage` (openai) → `appendHistory` (user+assistant, `setImmediate`) → `mutex.release(jid)` → retorna resposta |
| 11 | Integrar `messageHandler` + `humanizer` no fluxo 1:1 de `src/bot.js`; remover uso de `MessageQueue` | backend | M | 5, 7, 10 | sim | P5 | Mensagem 1:1 não-admin chama `messageHandler` diretamente (sem fila); `require('./queue')` removido de `bot.js`; admin (`/`) continua via `commandBus` sem passar pelo mutex |
| 12 | Remover `src/queue.js` | infra | S | 11 | não | P6 | Ficheiro ausente; `require('./queue')` inexistente em todo o repo (`grep -r "require('./queue')" src/` vazio) |
| 13 | `/reset` (`src/commands/admin/db.js`) usa `resetAllData()` | backend | S | 3 | não | P3 | `/reset confirmar` chama a fachada nova; `config` sobrevive ao reset (teste manual: `setConfig` antes, `/reset confirmar`, `getConfig` depois retorna valor) |
| 14 | `/historico` (`src/commands/admin/history.js`) usa `getPagedHistory` | backend | S | 3 | não | P3 | Saída idêntica ao comportamento atual (paginação 50, mesmo formato de resposta) |
| 15 | `/backup` (`src/commands/admin/backup.js`): validar compatibilidade com fachada nova | backend | S | 3 | não | P3 | `backupManager.getDatabaseInfo` continua a ler `clientes`/`historico` sem alteração de schema; nenhuma mudança funcional necessária confirmada por leitura + execução manual |
| 16 | `/ai` (`src/commands/admin/ai.js`): remover subcomandos `/ai plugin*` | backend | S | 9 | não | P4 | `/ai` (help) e `/ai stats` não mencionam plugins; `register()` não recebe mais parâmetro `pluginSystem` |
| 17 | `src/bot.js`: `ADMIN_NUMBERS` via `.env` | backend | S | 5 | não | P3 | `process.env.ADMIN_NUMBERS.split(',').map(s => s.trim())`; nenhum array hardcoded de números no código |
| 18 | Remover `src/pluginSystem.js` e pasta `plugins/` | infra | S | 5, 8, 16 | não | P5 | Ficheiros/pasta ausentes; `grep -rn "pluginSystem\|require('../plugins')\|require('./plugins')" src/ app.js` vazio |
| 19 | Remover `src/dashboard.js`, `src/performance.js`; limpar referências em `src/bot.js` | infra | M | 11 | não | P6 | Ficheiros ausentes; `bot.js` sem `require('./performance')`/`performanceMonitor.start()` |
| 20 | Remover `src/treinamento.js` | infra | S | — | não | P1 | Ficheiro ausente; nenhum `require` referencia `treinamento` (já confirmado órfão) |
| 21 | Substituir `src/logger.js` por `pino`, preservando API (`info`/`error`/`debug`/`api`) | infra | S | 1 | não | P1 | Chamadas existentes (`logger.info(msg, data)`, etc.) continuam a funcionar sem alterar call-sites; `EventEmitter`/`emitLog`/`on`/`off` removidos (dashboard extinto) |
| 22 | Remover `src/repositories/{clients,history}Repo.js` | backend | S | 10, 13, 14 | não | P7 | Ficheiros ausentes; nenhum `require('.../repositories/...')` remanescente |
| 23 | Reescrever `app.js` (dotenv, init data layer, iniciar Baileys, sem dashboard/queue) | backend | S | 11, 17, 19, 21 | sim | P8 | `app.js` não requer `./src/dashboard`; `npm start` inicia sem erro de `require` |
| 24 | Atualizar `.env.example` e `README.md` | docs | S | 23 | não | P9 | README reflete stack Baileys/pino, comandos `/ai /backup /historico /reset` sem menção a dashboard/plugins/porta 3000 |
| 25 | Testes unitários `node:test`: mutex, cache com JID, persistência `aiConfig` | testes | M | 6, 8, 9, 10 | não | P5 | `node --test test/` sai com código 0; cobre concorrência do mutex, colisão de cache (mesma msg, JIDs diferentes → chaves diferentes), round-trip `setConfig`/`getConfig` mockado |
| 26 | Smoke estático: `node --check` em todos os ficheiros alterados/novos | testes | S | 23 | não | P9 | `node --check <arquivo>` retorna 0 para todos os `.js` tocados pelo plano |
| 27 | Validação E2E manual (QR, 1:1, grupo ignorado, admin, persistência `/ai`) | testes | M | 23, 17, 26 | sim | P10 | QR conecta; mensagem 1:1 responde; mensagem de grupo não gera resposta nem log de processamento; `/ai`, `/backup`, `/historico`, `/reset` respondem do número em `ADMIN_NUMBERS`; `/ai modelo x` + kill + restart + `/ai modelo info` retorna `x` |
| 28 | Atualizar `.agent_history.md` (fechar Fase 1/2, registrar resultado) | docs | S | 27 | não | P11 | Entrada nova em `.agent_history.md` com `[PLANO]`, `[DECISÕES]`, `[RESULTADO]`, `[ENCERRAMENTO]` |

**Legenda:** **CP** = no caminho crítico. **Lote** = `P1`…`P11` para execução paralela por sub-agentes após dependências satisfeitas.

### Caminho crítico (cadeia bloqueante)

`ID 1 → ID 2 → ID 3 → ID 10 → ID 11 → ID 23 → ID 27`

(ID 5 corre em paralelo com ID 2/3 assim que ID 4 termina, mas ID 11 não pode fechar sem ID 10, que depende da cadeia de dados — por isso a cadeia de dados domina o prazo mínimo, não a cadeia do motor Baileys isoladamente.)

### Lotes paralelos

- **P1** (após ID 1): IDs 2, 4, 6, 7, 8, 20, 21 — ficheiros distintos, sem conflito.
- **P2** (após P1: ID 2→3 completo; ID 4 completo): IDs 3, 5.
- **P3** (após ID 3, e ID 5 para o 17): IDs 9, 13, 14, 15, 17 — ficheiros distintos (`aiConfig.js`, `db.js`, `history.js`, `backup.js`, `bot.js`); **nota:** ID 17 edita `bot.js` no mesmo lote em que nenhum outro ID desta leva toca `bot.js` — sem conflito.
- **P4** (após ID 9): IDs 10, 16.
- **P5** (após IDs 5, 7, 10 para o 11; após 5, 8, 16 para o 18; após 6, 8, 9, 10 para o 25): IDs 11, 18, 25.
- **P6** (após ID 11): IDs 12, 19.
- **P7** (após IDs 10, 13, 14): ID 22.
- **P8** (após IDs 11, 17, 19, 21): ID 23.
- **P9** (após ID 23): IDs 24, 26.
- **P10** (após IDs 23, 17, 26): ID 27.
- **P11** (após ID 27): ID 28.

### Dependências (grafo em texto)

- ID 1 → bloqueia → ID 2, 4, 5, 6, 7, 20, 21 (todas as decisões de dependência/versão)
- ID 2 → bloqueia → ID 3 (contrato antes de implementação)
- ID 3 → bloqueia → ID 9, 10, 13, 14, 15
- ID 5 → bloqueia → ID 11, 17, 18
- ID 6, 8, 9 → bloqueiam → ID 10
- ID 7, 10 → bloqueiam (junto de 5) → ID 11
- ID 8, 16 → bloqueiam (junto de 5) → ID 18
- ID 9 → bloqueia → ID 16
- ID 10, 13, 14 → bloqueiam → ID 22
- ID 11 → bloqueia → ID 12, 19
- ID 11, 17, 19, 21 → bloqueiam → ID 23
- ID 23 → bloqueia → ID 24, 26
- ID 23, 17, 26 → bloqueiam → ID 27
- ID 27 → bloqueia → ID 28

---

## Definição de interfaces (contratos)

| Contrato | Consumidores (IDs) | Artefacto | Versionamento |
|----------|---------------------|-----------|----------------|
| Camada de dados unificada (data-layer v1) | 9, 10, 13, 14, 15, 22 | `docs/contracts/data-layer.md` | Breaking change (ex.: mudança de assinatura) → novo ID `contrato` obrigatório antes de qualquer alteração nos consumidores |

**Campos críticos (anti-desalinhamento):**

| Campo/Função | Assinatura | Produtor | Consumidores |
|--------------|-----------|----------|---------------|
| `getOrCreateClient` | `(numero: string) => Promise<{id:number, numero:string}>` | ID 3 | ID 10 |
| `appendHistory` | `(clienteId: number, role: 'user'\|'assistant', mensagem: string) => Promise<void>` | ID 3 | ID 10 |
| `getRecentHistory` | `(identifier: string\|number, limit: number) => Promise<{messages: Array<{role,mensagem,timestamp}>}>` | ID 3 | ID 10 |
| `getPagedHistory` | `(identifier: string\|number, page: number) => Promise<{messages, pagination}>` | ID 3 | ID 14 |
| `getConfig` / `setConfig` | `(key: string) => Promise<string\|null>` / `(key: string, value: string) => Promise<void>` | ID 3 | ID 9 |
| `resetAllData` | `() => Promise<void>` — apaga `historico`+`clientes`, preserva `config` | ID 3 | ID 13 |

---

## Estratégia de teste

| ID(s) | Tipo | Comando / ferramenta | Prova de conclusão |
|-------|------|------------------------|----------------------|
| 3 | Integração (manual, sem framework) | `node -e "..."` contra DB de teste (arquivo `.db` temporário) | CRUD completo + `resetAllData` preserva `config` |
| 6 | Unitário | `node --test test/concurrency.test.js` | Mesma JID serializa; JIDs distintas correm em paralelo |
| 8 | Unitário | `node --test test/cache.test.js` | Mesma mensagem/histórico, JIDs diferentes → chaves de cache diferentes |
| 9 | Unitário | `node --test test/aiConfig.test.js` (mock data layer) | `setPersonality`/`setModel` chamam `setConfig` com os argumentos esperados |
| 10 | Unitário + Integração | `node --test test/messageHandler.test.js` (mock openai + data layer real ou stub) | Mutex respeitado; histórico persistido; resposta retornada |
| 5, 11 | Manual (sem automação possível para protocolo WhatsApp real) | Scan de QR + envio de mensagem real | Ver ID 27 |
| 23, 26 | Estático | `node --check <arquivo>` em loop sobre ficheiros tocados | Saída 0 em todos |
| 27 | E2E manual | Checklist manual (WhatsApp real) | Todos os itens do checklist (ver critério de aceite ID 27) verdadeiros |

**Ordem de execução de testes:** unitário (6, 8, 9, 10 — assim que os respetivos módulos existirem, dentro do lote P5) → estático (26, após app.js fechado) → E2E manual (27, último gate antes do handoff).

---

## Estratégia de validação (por ID)

| ID | Como provar "concluído" | Evidência exigida no [RESULTADO] |
|----|--------------------------|-------------------------------------|
| 1 | Nota de decisão + `package.json.engines.node` definido | Versão de Node confirmada + versões de deps escolhidas com justificação |
| 2 | Ficheiro de contrato revisado, assinaturas usadas identicamente nos IDs consumidores | Caminho do ficheiro + diff |
| 3 | Script de integração manual verde | Output do script (create/read/update/reset) |
| 4 | `git diff package.json .gitignore .env.example` | Diff mostrando remoção wppconnect + adição baileys/pino/qrcode-terminal/@hapi/boom + `auth/` no gitignore |
| 5 | Log de conexão Baileys (QR impresso, `connection: open`) | Trecho de log/console |
| 6, 8, 9, 10 | `node --test` verde | Output do test runner |
| 11 | Mensagem 1:1 de teste respondida sem fila | Log demonstrando chamada direta ao `messageHandler` |
| 12, 18, 19, 20, 22 | Ausência confirmada via `find`/`grep` | Output do comando |
| 13, 14, 15, 16, 17 | Execução manual do comando admin correspondente | Print/transcript da resposta do bot |
| 21 | Logs estruturados pino no console; call-sites inalterados | Trecho de log + `git diff` mostrando só o arquivo `logger.js` alterado |
| 23 | `npm start` sem erro de `require` | Output do boot |
| 24 | Revisão de conteúdo README/.env.example | Diff |
| 26 | `node --check` em lote | Lista de arquivos + código de saída |
| 27 | Checklist E2E completo | Checklist preenchido |
| 28 | `.agent_history.md` atualizado | Diff do arquivo |

---

## Briefings PDA (tarefas delegáveis)

### Briefing — ID 2 (contrato data-layer)

**Estrutura do projeto:** `database/db/index.js` (schema/CRUD bruto), `database/index.js` (fachada atual com aliases PT), `src/repositories/{clients,history}Repo.js` (API pública atual, a ser absorvida). `docs/DATA-MODEL.md` já define a interface-alvo na seção "Interface de dados (alvo)".

**Objetivo imediato:** produzir `docs/contracts/data-layer.md` com as 6 assinaturas exatas (nome, parâmetros, tipo de retorno, comportamento de erro) que `database/index.js` deve expor após o ID 3. Critério de fecho: ficheiro publicado, sem ambiguidade de nomes entre PT/EN (decisão: nomes em inglês conforme `DATA-MODEL.md`, ex. `getOrCreateClient`, não `cadastrarCliente`).

**Impedimentos:** não alterar código nesta tarefa — é definição de contrato, a implementação é ID 3. Não renomear as tabelas SQL (`clientes`/`historico`/`config` continuam em português — só a fachada JS muda de nome).

---

### Briefing — ID 3 (fachada de dados + tabela config)

**Estrutura do projeto:** `database/db/index.js` usa `sqlite3` com callbacks/Promises manuais; caminho do DB é `database/data/orbitbot.db` (`path.join(__dirname, '..', 'data', 'orbitbot.db')`). Schema atual: `clientes(id, numero UNIQUE)`, `historico(id, cliente_id FK, role, mensagem, timestamp)`.

**Objetivo imediato:** implementar `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)` no boot do schema, e expor em `database/index.js` exatamente as funções definidas no contrato do ID 2. `resetAllData()` deve fazer `DELETE FROM historico`, `DELETE FROM clientes`, `DELETE FROM sqlite_sequence WHERE name IN ('historico','clientes')` — **sem tocar em `config`** (decisão SSOT fechada, não reabrir).

**Impedimentos:** decisão SSOT fechada — `/reset` não apaga `config`. Não introduzir motor de migrations versionado (fora de escopo — `DATA-MODEL.md` confirma `IF NOT EXISTS` no boot é o padrão aceite). Manter compatibilidade de tipos com o schema existente (`cliente_id INTEGER`, `timestamp INTEGER` epoch ms).

---

### Briefing — ID 5 (motor Baileys)

**Estrutura do projeto:** `src/bot.js` atual usa `wppconnect.create({session, headless, catchQR, ...})`, `client.onMessage`, `client.sendText`. Alvo: `makeWASocket({auth: state})` de `@whiskeysockets/baileys`, `useMultiFileAuthState('auth')`, evento `connection.update` para QR (`qr` field) e reconexão (checar `DisconnectReason.loggedOut` via `@hapi/boom`), evento `messages.upsert` para mensagens recebidas.

**Objetivo imediato:** motor de conexão funcional com QR no terminal (via `qrcode-terminal`) e filtro 1:1 (descartar `key.remoteJid` de grupo `@g.us`, broadcast `status@broadcast`, e mensagens `fromMe`). Não integrar ainda `messageHandler`/`humanizer` (isso é ID 11) — pode deixar um placeholder de log para a branch "mensagem 1:1 válida".

**Impedimentos:** versão de `@whiskeysockets/baileys` fixada pelo ID 1 (não instalar `latest`/`7.x` sem confirmação explícita de Node ≥20 e aceite do trade-off ESM). Pasta de sessão é `auth/` (decisão SSOT fechada, gitignored — depende do ID 4 já ter atualizado `.gitignore`). Não remover ainda `ADMIN_NUMBERS` hardcoded se isso complicar o escopo — pode ser feito no ID 17 subsequente, mas se for trivial fazer junto, preferir (evita retrabalho no mesmo ficheiro).

---

### Briefing — ID 10 (message handler / substitui pipeline)

**Estrutura do projeto:** `src/core/pipeline.js` atual é a referência de comportamento (`Promise.all` para cliente+histórico, `handleMessage` de `openai.js`, persistência assíncrona via `setImmediate` + `Promise.allSettled`). Novo módulo: `src/core/messageHandler.js`.

**Objetivo imediato:** função `run(jid, texto)` (ou nome equivalente) que: adquire mutex do JID (ID 6) → busca cliente+histórico em paralelo via fachada do ID 3 → chama `handleMessage` de `openai.js` (já sem hooks de plugin, ID 8; já com cache corrigido) → persiste pergunta+resposta sem bloquear retorno → libera mutex → retorna a resposta.

**Impedimentos:** depende de IDs 3, 6, 8, 9 estarem concluídos (fachada de dados, mutex, openai sem plugins/cache corrigido, aiConfig persistente). Não reintroduzir filas/buffers — mutex substitui integralmente o agrupamento de 15s (trade-off aceite na ADR).

---

### Briefing — ID 11 (integração bot.js)

**Estrutura do projeto:** `src/bot.js` (pós-ID 5, motor Baileys já conectando). `src/core/messageHandler.js` (ID 10) e `src/humanizer.js` adaptado (ID 7) já existem.

**Objetivo imediato:** no handler de `messages.upsert`, para mensagens 1:1 não-admin, chamar `messageHandler.run(jid, texto)` e enviar a resposta via `humanizer` adaptado; para mensagens admin (`/`), continuar via `commandBus.execute`. Remover toda referência a `MessageQueue`/`require('./queue')`.

**Impedimentos:** admin bypassa mutex (comportamento atual preservado — comandos admin não passam pela fila/mutex, só mensagens de IA). Não introduzir nova lógica de negócio aqui — `bot.js` só orquestra I/O do canal, a lógica vive em `messageHandler.js`.

---

### Briefing — ID 19 (remover dashboard/performance)

**Estrutura do projeto:** `src/dashboard.js` (HTTP:3000 + SSE), `src/performance.js` (`PerformanceMonitor`, chamado em `bot.js` via `performanceMonitor.start()`/`addMessageResponseTime`/`addError`), `app.js` chama `startDashboardServer(3000)`.

**Objetivo imediato:** apagar `src/dashboard.js` e `src/performance.js`; remover de `src/bot.js` o `require('./performance')` e a chamada `performanceMonitor.start()` (as chamadas dentro do handler de fila já desaparecem no ID 11, pois esse bloco inteiro é substituído).

**Impedimentos:** depende do ID 11 já ter reescrito o handler de mensagens (para não haver conflito de edição na mesma região do ficheiro). `app.js` não precisa ser tocado aqui — é reescrito por completo no ID 23.

---

### Briefing — ID 25 (testes unitários node:test)

**Estrutura do projeto:** sem suite de testes existente; `node:test` é módulo nativo do Node.js (sem nova dependência de produção/dev). Módulos a testar: `src/concurrency.js` (ID 6), `src/openai.js::generateCacheKey` (ID 8 — pode exigir exportar a função ou testar via `handleMessage` com mocks), `src/aiConfig.js` (ID 9, com data layer mockada), `src/core/messageHandler.js` (ID 10, com `openai`/data layer mockados via `mock.fn`/injeção).

**Objetivo imediato:** criar pasta `test/` com specs cobrindo: (a) mutex serializa mesma JID e paraleliza JIDs diferentes; (b) `generateCacheKey` produz chaves diferentes para JIDs diferentes com mesma mensagem/histórico/config; (c) `aiConfigManager.setPersonality` invoca `setConfig` da fachada; (d) `messageHandler.run` respeita ordem mutex→dados→IA→persistência.

**Impedimentos:** não adicionar Jest/Mocha/Vitest — usar exclusivamente `node:test` + `node:assert` (zero dependência nova, alinhado a CONTRIBUTING.md que não exige suite formal ainda). Pode ser necessário exportar funções internas (`generateCacheKey`) de `openai.js` para tornar testável — mudança mínima e aceitável (exportar, não reescrever lógica).

---

### Briefing — ID 27 (validação E2E manual)

**Estrutura do projeto:** ambiente real com WhatsApp instalado no telemóvel do maintainer; `npm start` já funcional (pós-ID 23/26).

**Objetivo imediato:** executar o checklist de PR já definido em `docs/CONTRIBUTING.md` (`npm start` sobe com Baileys sem erro; grupos ignorados; 1:1 responde; comandos admin testados do número em `ADMIN_NUMBERS`) mais o teste específico de persistência: `/ai modelo <alias>` → matar processo (`Ctrl+C`) → `npm start` novamente → `/ai modelo info` deve retornar o alias definido antes do restart (prova RF-007).

**Impedimentos:** exige QR scan real — não automatizável neste ciclo (fora de escopo CI/CD completo). Se a sessão WPPConnect anterior (`./tokens`) existir, ignorá-la — é obsoleta e não portável (ADR-0001).

---

## Riscos, bloqueios e replaneamento

| Risco | Probabilidade | Impacto | Resposta (ID ou DECISÃO) |
|-------|-----------------|---------|------------------------------|
| Baileys 7.x (ESM, Node≥20) é instalado por engano via `npm install @whiskeysockets/baileys` sem pin, quebrando `require()` em projeto 100% CJS | média | alto | ID 1 fixa `^6.7.23` explicitamente no `package.json` antes de qualquer `npm install`; **replanejar** se o ambiente já usa Node <17 (nem a 6.x funciona) |
| `pino` 10.x exigir Node mais novo que o disponível no ambiente real | baixa-média | médio | ID 1 decide entre linha `9.x`/`10.x` conforme `node -v` real; fallback seguro é `9.14.0` |
| Remoção do PluginSystem quebra `require()` se a ordem ID 8→16→5→18 não for respeitada | baixa (mitigada pelo DAG) | médio | Sequenciamento explícito no grafo; `node --check` (ID 26) pega qualquer `require` órfão antes do E2E |
| Nova sessão Baileys exige novo QR (perda da sessão WPPConnect) | alta (certeza, não risco) | baixo (esperado) | Comunicado na ADR-0001; sem mitigação de código — é consequência aceite da migração |
| Cache fix (ID 8) sem cobertura de teste real ao vivo | baixa | médio | ID 25 cobre unitariamente a geração de chave; ID 27 não testa cache diretamente (fora do escopo prático de QA manual) — aceito como risco residual documentado |
| `sqlite3` (binário nativo) incompatível com a versão de Node decidida no ID 1 | baixa | alto | Validar `npm install` sem erro de build nativo como parte do ID 4/23; se falhar, **replanejar** avaliando `better-sqlite3` (fora do escopo atual, exigiria novo ADR) |

**Gatilhos de `replanejar` para o orquestrador:**

- ID 1 revelar Node <16 no ambiente real (nem Baileys 6.x nem pino atual seriam instaláveis com segurança).
- Contrato do ID 2 for invalidado por um spike de implementação (ex.: `sqlite3` não suportar `IF NOT EXISTS` para `config` do jeito assumido — improvável, mas o DAG exige declarar o gatilho).
- Utilizador rejeitar a suposição #3 (decisão de manter cache com JID em vez de remover) — nesse caso, ID 8 muda de "corrigir chave" para "remover `cache.js`" e ID 25 perde o teste de cache correspondente.

---

## Ordem de execução mandatória

1. **ID 1** (motivo: desbloqueia toda decisão de dependência — spike crítico, sem ele nada mais é seguro instalar)
2. **Lote P1:** IDs 2, 4, 6, 7, 8, 20, 21 em paralelo
3. **Lote P2:** IDs 3, 5 em paralelo
4. **Lote P3:** IDs 9, 13, 14, 15, 17 em paralelo
5. **Lote P4:** IDs 10, 16 em paralelo
6. **Lote P5:** IDs 11, 18, 25 em paralelo
7. **Lote P6:** IDs 12, 19 em paralelo
8. **Lote P7:** ID 22
9. **Lote P8:** ID 23
10. **Lote P9:** IDs 24, 26 em paralelo
11. **Lote P10:** ID 27
12. **Lote P11:** ID 28 — fecha o ciclo

---

## Handoff ao Orquestrador Raiz

- **Próximo comando lógico:** `/planejar` concluído → iniciar Fase 2 pelo **ID 1** (spike bloqueante).
- **Persistência:** registrar em `.agent_history.md` o delta deste plano (Fase 1 concluída, 28 IDs, caminho crítico `1→2→3→10→11→23→27`) e os IDs abertos (todo o grafo, nenhum executado ainda).
- **Não iniciar implementação** sem aceitar este documento como `[PLANO]` SSOT. Este ficheiro também está persistido em `memory/refactor-baileys/PLAN.md` e `memory/refactor-baileys/plan.ir.yaml`.
- **Suposições que exigem atenção do utilizador antes ou durante a execução do ID 1:** ver seção "Suposições pendentes" — nenhuma bloqueia o início do plano, mas a #1 (versão Node) deve ser confirmada no ambiente real antes de qualquer `npm install`.
