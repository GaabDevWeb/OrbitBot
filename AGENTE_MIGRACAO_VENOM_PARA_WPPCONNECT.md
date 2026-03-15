# Agente de Refatoração/Migração: Venom-Bot → WPPConnect

## Objetivo

Você é um agente responsável pela **refatoração e migração completa** do projeto OrbitBot da biblioteca **venom-bot** para **WPPConnect** (@wppconnect-team/wppconnect ou wppconnect-server). A migração deve preservar toda a funcionalidade existente: fila de mensagens, pipeline de IA, comandos admin, humanizador de resposta, backup, dashboard e integrações.

---

## Contexto do Projeto

- **Projeto:** OrbitBot — bot de WhatsApp com IA, histórico em SQLite, backup, comandos admin e painel.
- **Stack atual:** Node.js, venom-bot, SQLite, pipeline de mensagens (histórico → IA → persistência).
- **Arquivos que usam o cliente WhatsApp (venom):**
  - `src/bot.js` — ponto central: `venom.create()`, `client.onMessage()`, `client.sendText()`
  - `src/humanizer.js` — recebe `client` e usa apenas `client.sendText(chatId, texto)`
  - Nenhum outro arquivo recebe o `client` diretamente; pipeline, comandos e fila trabalham com `message.from`, `message.body`, etc.

---

## Mapeamento de API (Venom-Bot → WPPConnect)

Use este mapeamento como referência. Consulte a documentação oficial do WPPConnect para a versão instalada.

| Venom-Bot | WPPConnect (equivalente) |
|-----------|---------------------------|
| `venom.create({ session, multidevice, headless, logQR, ... })` | `wppconnect.create({ session, ... })` ou `create()` com opções equivalentes (session name, headless, catchQR, etc.) |
| Retorno: `client` (Promise) | Retorno: objeto cliente (Promise) — verificar nome exato do método de criação |
| `client.onMessage(callback)` | `client.on('message', callback)` ou método equivalente para escutar mensagens |
| `client.sendText(chatId, text)` | `client.sendText(chatId, text)` ou `client.sendText(contactId, text)` — conferir assinatura (id pode ser `@c.us` ou só número) |
| Objeto `message`: `from`, `body`, `isGroupMsg` | Adaptar para o formato do WPPConnect: verificar se usa `from`, `body`, `isGroup` ou nomes diferentes |
| Sessão/pasta de dados | WPPConnect pode usar pasta distinta (ex.: `tokens`, `wppconnect-session`); ajustar e documentar |

---

## Escopo da Migração

### 1. Dependências
- **Remover:** `venom-bot` do `package.json`.
- **Adicionar:** pacote WPPConnect (ex.: `@wppconnect-team/wppconnect` ou `wppconnect-server` — usar a API estável e documentada).
- Atualizar `package-lock.json` via `npm install`.

### 2. `src/bot.js`
- Substituir `require('venom-bot')` pelo require do WPPConnect.
- Substituir `venom.create({ ... })` pela função de criação do WPPConnect, mantendo equivalentes para:
  - Nome da sessão
  - Modo headless (ou equivalente)
  - Exibição do QR (logQR / catchQR)
  - Argumentos do browser (--no-sandbox etc.) se suportados
- Adaptar o callback de mensagens: de `client.onMessage(async (message) => { ... })` para o modelo de eventos do WPPConnect (ex.: `client.on('message', ...)`).
- Garantir que o objeto `message` usado na fila e no pipeline tenha os campos esperados: `from`, `body`, `isGroupMsg` (ou normalizar para esse formato se o WPPConnect usar outros nomes).
- Manter inalterados: lógica de admin (`isAdmin`, comandos `/`), `messageQueue`, `pipeline.run()`, `simularRespostaHumana(client, message.from, resposta)`, tratamento de erros e logs.

### 3. `src/humanizer.js`
- A função `simularRespostaHumana(client, chatId, texto)` deve continuar recebendo um **cliente** e usar apenas **envio de texto**.
- Trocar chamadas `client.sendText(chatId, ...)` pela API equivalente do WPPConnect (geralmente mesmo nome; verificar se `chatId` deve ser formatado diferente, ex.: com sufixo `@c.us`).

### 4. Formato de contato (ID)
- Venom usa IDs no formato `numero@c.us`. Se o WPPConnect usar formato diferente (ex.: só número, ou `numero@s.whatsapp.net`), criar um helper (ex.: `normalizeChatId(from)`) e usá-lo em `bot.js` e `humanizer.js` para manter compatibilidade com o resto do código (pipeline, histórico, comandos).

### 5. Sessão e arquivos locais
- Atualizar `.gitignore` se a pasta de sessão do WPPConnect for diferente (ex.: `wppconnect-session`, `tokens`).
- Documentar no README ou em comentário onde os dados de sessão são armazenados.

### 6. Outros arquivos
- **Não alterar** a lógica de: `pipeline.js`, `queue.js`, `commandBus`, comandos admin, `openai`, `backup`, `dashboard`, `logger`, `performance`, repositórios e plugins, exceto se for necessário receber um “cliente” com interface diferente (neste projeto apenas `bot.js` e `humanizer.js` usam o cliente).
- Se algum plugin ou módulo receber `client` no futuro, ele deve usar apenas `sendText(chatId, text)`; manter essa interface para compatibilidade.

---

## Regras de Implementação

1. **Não remover funcionalidades:** fila, buffer por cliente, comandos `/`, pipeline de IA, humanizador, backup, dashboard, logs e métricas devem continuar funcionando.
2. **Manter estrutura de pastas e nomes de arquivos** (exceto se renomear algo por convenção do WPPConnect).
3. **Tratamento de erros:** preservar `try/catch` e mensagens de fallback ao usuário (“Estou tendo dificuldades técnicas...”).
4. **Compatibilidade de formato de mensagem:** o objeto que segue para `messageQueue.addMessage(message)` e para `pipeline.run(message.from, message.body)` deve ter pelo menos `from`, `body` e `isGroupMsg` (ou equivalente mapeado).
5. **Testes manuais:** após a migração, o agente deve listar no próprio arquivo ou em MIGRATION_CHECKLIST.md os passos para testar: iniciar bot, escanear QR, enviar mensagem privada, comando admin, verificar resposta humanizada e histórico.

---

## Checklist de Entrega

- [ ] `package.json` sem `venom-bot`, com dependência WPPConnect instalada.
- [ ] `src/bot.js` usando apenas API WPPConnect; mensagens chegando ao mesmo fluxo (fila → pipeline → humanizer).
- [ ] `src/humanizer.js` usando apenas API WPPConnect para envio de texto.
- [ ] Formato de `from`/chatId normalizado se necessário; pipeline e comandos funcionando com o mesmo contrato.
- [ ] `.gitignore` atualizado para pastas de sessão do WPPConnect.
- [ ] README ou comentário com instruções de execução e local da sessão.
- [ ] Nenhuma referência residual a `venom` ou `venom-bot` no código (exceto em documentação de migração ou este prompt).

---

## Referências

- Documentação oficial do WPPConnect (GitHub/npm) para criação de cliente, eventos de mensagem e `sendText`.
- Código atual em `src/bot.js` e `src/humanizer.js` como referência do contrato (from, body, sendText).

Ao executar este prompt, o agente deve realizar todas as alterações necessárias nos arquivos listados, garantir que o projeto inicie sem erros de require e que o fluxo de mensagens permaneça compatível com o restante do sistema.
