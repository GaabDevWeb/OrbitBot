# PRD — Refatoração OrbitBot (WPPConnect → Baileys)

| Campo | Valor |
|-------|-------|
| Data | 2026-07-26 |
| Autor | MegaBrain / utilizador |
| Status | review |
| Versão | 1.0 |
| Branch | `refactor/wppconnect-to-baileys` |

## Contexto

**Proveniência:** pedido explícito do utilizador via `/MegaBrain` com TASK fechada (requisitos de migração e simplificação). Inventário factual do sistema actual em `docs/RELATORIO-GERAL.md`.

O OrbitBot é um assistente WhatsApp 1:1 em **Node.js (JavaScript)** que usa **WPPConnect** (Chrome/Puppeteer), **SQLite**, **OpenRouter** e camadas intermediárias (fila, pipeline, PluginSystem, dashboard HTTP:3000). Problemas observados:

- Consumo elevado de recursos (browser embutido do WPPConnect)
- Preferências `/ai` só em memória (perdem-se no restart)
- Cache de IA sem `userId` na chave (risco de vazamento entre utilizadores)
- `ADMIN_NUMBERS` hardcoded
- Complexidade desnecessária (Queue, PluginSystem, Dashboard) para o escopo real (atendimento 1:1 + admin via WhatsApp)

## Objectivos

Quando a feature estiver pronta:

1. Engine WhatsApp = **`@whiskeysockets/baileys`** (sem WPPConnect).
2. Arquitectura simplificada: mensagem 1:1 → trava por JID → lógica de negócio → humanizer → envio.
3. Persistência unificada em SQLite, com tabela **`config`** (personalidade/modelo sobrevivem ao restart).
4. Admin via env (`ADMIN_NUMBERS`); comandos `/ai`, `/backup`, `/historico`, `/reset` preservados.
5. Sem PluginSystem, sem Dashboard HTTP/SSE, sem MessageQueue/pipeline, sem `treinamento.js`.
6. Logs via **pino**; projecto 100% JavaScript.

**Métricas de sucesso:**

- `npm start` sobe sessão Baileys (QR no terminal) e responde 1:1.
- Grupos/broadcasts ignorados na origem.
- `/ai modelo` e `/ai personalidade` persistem após kill/restart.
- `package.json` sem `@wppconnect-team/wppconnect` e sem Express/dashboard.
- Ausência de ficheiros mortos listados no DoD.

## Personas / Utilizadores

| Persona | Necessidade |
|---------|-------------|
| Utilizador final (WhatsApp 1:1) | Respostas contextuais com histórico; latência humana (humanizer) |
| Administrador | Comandos `/ai`, `/backup`, `/historico`, `/reset` só do(s) número(s) em `ADMIN_NUMBERS` |
| Operador/dev | Bootstrap simples, `.env.example`, logs pino, branch isolada da `main` |

## Requisitos funcionais

| ID | Descrição | Prioridade | Critério de aceite |
|----|-----------|------------|-------------------|
| RF-001 | Substituir WPPConnect por `@whiskeysockets/baileys` | Must | Sessão autenticada via ficheiros locais; QR no terminal; reconexão automática |
| RF-002 | Processar apenas conversas privadas 1:1 | Must | Grupos e broadcasts ignorados antes da lógica de negócio |
| RF-003 | Encaminhar mensagens 1:1 ao handler principal (sem fila) | Must | Sem `MessageQueue` / `pipeline.js`; path directo |
| RF-004 | Trava de concorrência em memória por JID/número | Must | Mensagens consecutivas do mesmo user não disparam IA em paralelo |
| RF-005 | Manter humanizer (atrasos/fragmentação antes do envio) | Must | Comportamento equivalente a `src/humanizer.js` |
| RF-006 | Unificar acesso SQLite numa interface única de dados | Must | Repos fragmentados absorvidos; path `database/data/orbitbot.db` mantido |
| RF-007 | Tabela `config` para parâmetros do sistema | Must | Personalidade e modelo activos persistem após restart |
| RF-008 | Histórico continua a gravar `user` e `assistant` | Must | Inserts em `historico` com roles correctos |
| RF-009 | Preservar `/ai`, `/backup`, `/historico`, `/reset` | Must | Mesma semântica admin; subcomandos `/ai plugin*` removidos ou degradados com mensagem clara (plugins removidos) |
| RF-010 | Admin apenas via `ADMIN_NUMBERS` no `.env` | Must | Sem whitelist hardcoded no código |
| RF-011 | Remover PluginSystem, Dashboard :3000, `treinamento.js`, Queue, pipeline | Must | Ficheiros/deps ausentes; `npm start` sem HTTP 3000 |
| RF-012 | Logs unificados com pino | Must | Logger actual substituído; Baileys usa pino |
| RF-013 | Cache IA (se mantido) inclui JID na chave; senão remover cache | Must | Sem colisão entre utilizadores |
| RF-014 | Suporte completo a `.env` com `OPENROUTER_API_KEY` | Must | `dotenv` no entrypoint; `.env.example` completo |
| RF-015 | Projecto 100% JavaScript (Node.js) | Must | Sem TypeScript/Python de produção |

## Requisitos não-funcionais

| ID | Descrição | Critério |
|----|-----------|----------|
| RNF-001 | Menor footprint vs WPPConnect | Sem Chromium/Puppeteer na árvore de deps do bot |
| RNF-002 | Linguagem | Apenas `.js` Node.js |
| RNF-003 | Isolamento de trabalho | Toda a refatoração na branch `refactor/wppconnect-to-baileys` |
| RNF-004 | Segurança básica | Sem dashboard sem auth; admin por env; sem vazamento de cache entre users |
| RNF-005 | Observabilidade | Logs estruturados pino (info/error no fluxo crítico) |

## Fora de escopo

- Reintroduzir PluginSystem ou marketplace de plugins
- Dashboard HTTP/SSE ou API REST pública do bot
- Atendimento em grupos / broadcasts
- Migração para TypeScript ou Python
- Multimodal (imagem/áudio) na IA
- CI/CD completo (salvo se o DoD do planner o exigir depois)
- Alterar o model ID OpenRouter efectivo (pode manter DeepSeek free actual)

## Dependências e riscos

| Item | Tipo | Mitigação |
|------|------|-----------|
| API Baileys (auth state, eventos) | dependência | Usar `useMultiFileAuthState`; documentar pasta de sessão |
| Quebra de sessão ao trocar de lib | risco | Nova autenticação via QR; tokens WPPConnect não são portáveis |
| Remoção de `/ai plugin*` | risco | Documentar no help `/ai`; remover subcomandos |
| DB existente sem tabela `config` | dependência | `CREATE TABLE IF NOT EXISTS` no boot |
| Número admin no código actual | risco | Migrar para env; não commitir `.env` |

## Glossário

| Termo | Definição |
|-------|-----------|
| JID | Identificador WhatsApp (ex. `numero@s.whatsapp.net`) |
| Baileys | Biblioteca WhatsApp Web socket (`@whiskeysockets/baileys`) |
| Trava por JID | Mutex em memória que serializa o processamento IA por utilizador |
| Config | Pares chave/valor em SQLite para estado do sistema |

## Referências

- ADR: `docs/adr/0001-migracao-wppconnect-para-baileys.md`
- API: `docs/API_SPEC.md`
- Arquitectura: `docs/ARCHITECTURE.md`
- Dados: `docs/DATA-MODEL.md`
- Inventário actual: `docs/RELATORIO-GERAL.md`
