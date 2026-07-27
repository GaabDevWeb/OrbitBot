# OrbitBot

Assistente pessoal via WhatsApp (1:1) com IA (OpenRouter/DeepSeek) e SQLite.

Stack actual: **Node.js (JavaScript)** · **@whiskeysockets/baileys** · **SQLite** · **pino** · **OpenRouter**

## Pré-requisitos

- Node.js ≥ 18
- Conta [OpenRouter](https://openrouter.ai)

## Instalação

```bash
git clone https://github.com/GaabDevWeb/OrbitBot.git
cd OrbitBot
git checkout refactor/wppconnect-to-baileys   # branch da migração Baileys
npm install
cp .env.example .env
```

Edite `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-sua-chave
ADMIN_NUMBERS=5554999999999
OPENROUTER_MODELS=["deepseek/deepseek-chat-v3-0324:free","google/gemini-2.0-flash-exp:free"]
```

`ADMIN_NUMBERS`: dígitos com DDI, separados por vírgula (sem `@c.us`).  
`OPENROUTER_MODELS`: array JSON (ou CSV) de slugs OpenRouter — ordem = prioridade; se um falhar, tenta o próximo.

### Persona (system prompt)

A personalidade do bot é um único ficheiro Markdown:

`prompts/SYSTEM.md`

Edita o ficheiro e, se o bot já estiver a correr, usa `/ai prompt reload` (admin).

## Execução

```bash
npm start
```

Na primeira execução, um QR Code aparece no terminal. Escaneie em WhatsApp → Dispositivos conectados.

Sessão Baileys: pasta `./auth/` (gitignored).

## Arquitectura (resumo)

```
WhatsApp → Baileys → filtro 1:1 → [/ admin] ou [mutex JID → IA → envio imediato]
                                      ↓
                                  SQLite (clientes, historico, config)
```

- Sem fila MessageQueue, sem PluginSystem, sem dashboard HTTP.
- **Grupos:** só responde com `@orbit` ou menção ao bot; contexto em memória (15 msgs), sem SQLite.
- Preferências `/ai` persistem na tabela `config`.
- Grupos e broadcasts são ignorados.

## Comandos admin (só `ADMIN_NUMBERS`)

| Comando | Função |
|---------|--------|
| `/ai` | Personalidade, modelo, stats, cache |
| `/backup` | Criar/listar/restaurar backups do SQLite |
| `/historico <id\|numero> [página]` | Consultar histórico |
| `/reset` / `/reset confirmar` | Apaga clientes+histórico (preserva `config`) |

## Scripts

```bash
npm start    # sobe o bot
npm test     # testes unitários (node:test)
npm run check
```

## Documentação

- `docs/RELATORIO-GERAL.md` — inventário do sistema legado (pré-migração)
- `docs/prd/2026-07-26-refactor-baileys.md` — PRD da refatoração
- `docs/ARCHITECTURE.md` · `docs/DATA-MODEL.md` · `docs/API_SPEC.md`
