# Runtime manifest — OrbitBot (true-kernel)

Adapter WhatsApp. KernelBot em repo irmão.

## Entrypoints

| Componente | Comando |
|------------|---------|
| Orbit | `npm start` → `node app.js` |
| Health interno | `GET /internal/health` (porta `ORBIT_INTERNAL_PORT`, default 8010) |

## Diretórios essenciais

| Path | Papel |
|------|-------|
| `app.js` | Boot + graceful shutdown |
| `src/bot.js` | Baileys socket, QR, reconnect |
| `src/groups/` | Grupos, buffer, `@orbit`, contextual invocation |
| `src/providers/kernelProvider.js` | `POST /v1/chat`, retry, headers |
| `src/openai.js` | Orquestração resposta Kernel → WhatsApp |
| `src/outbound/` | Sessão WA + HTTP interno (comms Kernel) |
| `src/concurrency.js` | `userLock` por grupo |
| `database/` | SQLite admin/histórico local |
| `prompts/SYSTEM.md` | Persona admin (`aiConfig`) |
| `auth/` | Sessão Baileys (**runtime**, gitignored) |

## Integração Kernel

- Request: `POST {KERNEL_API_URL}/v1/chat` + `Authorization: Bearer`
- Headers: `X-Message-Id`, `X-Trace-Id`
- Body: `context` (ChannelContext), `message`, `metadata`, `reset_context`
- Ver `docs/KERNEL-INTEGRATION.md`

## Deliberadamente fora desta branch

- `test/` — suíte de desenvolvimento
- `memory/` — reports de refactor
- `tools/whatsapp-history/` — export dev (Playwright)
- Documentação histórica (PRDs, ADRs, relatórios)
- `database/data/*.db` — dados runtime (gitignored)
- `auth/` — credenciais WhatsApp

## Dependências

- `package.json` + `package-lock.json`
- Baileys 6.7.x, axios, sqlite3, pino, dotenv
