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
WhatsApp → Baileys → grupos (@orbit/menção) | 1:1 (@orbit)
                         ↓                        ↓
                   buffer RAM 40            mutex → SQLite
                         ↓                        ↓
                    OpenRouter ←────────────── openai.js
                         ↓
              markdownToWhatsapp → sendMessage
```

- Sem fila MessageQueue, sem PluginSystem, sem dashboard HTTP.
- **1:1 (modo teste):** só mensagens com prefixo `@orbit` (inclui `fromMe` / `append`).
- **Grupos:** buffer em memória (40 msgs); IA com `@orbit` ou menção; sem SQLite.
- Persona: `prompts/SYSTEM.md`. Modelos: `OPENROUTER_MODELS` com fallback.
- Preferências `/ai` persistem na tabela `config` quando aplicável.

## Comandos admin (só `ADMIN_NUMBERS`)

| Comando | Função |
|---------|--------|
| `/ai` | Prompt, stats, cache |
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

- `docs/RELATORIO-GERAL.md` — inventário técnico actual (Baileys, grupos, formatter, IA)
- `docs/WHATSAPP-MARKDOWN-MAPPING.md` — matriz Markdown → WhatsApp
- `docs/prd/2026-07-26-refactor-baileys.md` — PRD da refatoração
- `docs/ARCHITECTURE.md` · `docs/DATA-MODEL.md` · `docs/API_SPEC.md`
