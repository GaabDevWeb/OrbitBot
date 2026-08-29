# OrbitBot

Adapter WhatsApp (Baileys) para o KernelBot. Buffer local, dedupe, `@orbit` em grupos, outbound interno e traces.

Kernel (RAG + LLM): repositório irmão `../KernelBot` — branch `true-kernel`.

## Requisitos

- Node.js ≥ 18
- KernelBot a correr (`http://127.0.0.1:8001`)
- Sessão WhatsApp (QR na primeira execução)

## Configuração

```bash
npm ci
cp .env.example .env
```

Variáveis mínimas:

| Variável | Descrição |
|----------|-----------|
| `ADMIN_NUMBERS` | Admins (DDI + número, vírgula) |
| `KERNEL_API_URL` | Base do Kernel (sem `/v1`) |
| `KERNEL_API_TOKEN` | Bearer (`ACL_API_BEARER_TOKEN` no Kernel) |
| `ORBIT_INTERNAL_PORT` | HTTP interno outbound (default 8010) |

Ver `.env.example` e `docs/KERNEL-INTEGRATION.md`.

## Inicialização

```bash
# Terminal 1 — Kernel
cd ../KernelBot && PYTHONPATH=. .venv/bin/python main.py

# Terminal 2 — Orbit
npm start
```

Primeira execução: escanear QR no terminal. Sessão em `./auth/` (gitignored).

## Health

- Orbit: `GET http://127.0.0.1:8010/internal/health` (WhatsApp + probe Kernel)
- Kernel: `GET http://127.0.0.1:8001/health`

## Estrutura mínima

```
app.js              → entrypoint
src/bot.js          → Baileys + lifecycle
src/groups/         → buffer, @orbit, invocação contextual
src/providers/      → kernelProvider (POST /v1/chat)
src/outbound/       → HTTP interno + envio WhatsApp
database/           → SQLite local (admin/histórico legado)
prompts/SYSTEM.md   → persona admin local (Kernel usa prompts próprios)
auth/               → sessão Baileys (runtime, gitignored)
```

Detalhe: `docs/runtime-manifest.md`.

## Troubleshooting

| Problema | Acção |
|----------|-------|
| QR não aparece | Verificar Node ≥ 18; apagar `auth/` e reiniciar |
| Kernel 401 | Alinhar `KERNEL_API_TOKEN` com Kernel |
| Sem resposta em grupo | Mensagem com `@orbit` ou menção configurada |
| Outbound falha | `ORBIT_INTERNAL_PORT` livre; firewall localhost |

## Backup

Comandos admin via WhatsApp (`/backup`, `/db`). SQLite em `database/data/` (gitignored).
