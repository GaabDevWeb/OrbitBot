# Relatório — Orbit → KernelProvider

| Campo | Valor |
|-------|-------|
| Data | 2026-07-28 |
| Branch | `feature/orbit-kernel-provider` |
| Testes | `npm test` → **61 passed** |
| Kernel | `http://127.0.0.1:8001` (processo local activo) |

## Arquivos alterados / criados

| Ficheiro | Mudança |
|----------|---------|
| `src/providers/kernelProvider.js` | **Novo** — POST `/v1/chat`, timeout, HTTP, validação `answer` |
| `src/kernelContext.js` | **Novo** — parse `/reset`/`/nova`, ChannelContext, bypass admin |
| `src/openai.js` | Fluxo principal → Kernel; sem cache; logs mínimos |
| `src/core/messageHandler.js` | 1:1 `userId=channelId=jid` completo |
| `src/groups/groupHandler.js` | Grupo `userId=autor`, `channelId=grupo`; reset no `question` |
| `src/bot.js` | `/reset`/`/nova` não vão ao commandBus; boot log Kernel |
| `.env.example` | `KERNEL_API_URL` / `KERNEL_API_TOKEN` |
| `docs/KERNEL-INTEGRATION.md` | Mapeamento + fluxo |
| `test/kernel-context.test.js` | **Novo** |
| `test/kernel-provider.test.js` | **Novo** |
| `package.json` | `check` inclui ficheiros novos |

`src/providers/openrouterProvider.js` — **inalterado** (legado, fora do fluxo).

## Diff resumido

```text
handleMessage → kernelProvider.chat({ platform:whatsapp, userId, channelId, message, resetContext })
OpenRouter generateWithModelFallback — removido do caminho principal
Cache de respostas — não usado no Kernel path
```

## Fluxo final

```text
WhatsApp
  → Baileys (Orbit)
  → @orbit / admin / dedupe / mutex / formatter (preservados)
  → KernelProvider POST /v1/chat
  → Kernel (transcript + pin + RAG + LLM)
  → answer
  → markdownToWhatsapp
  → WhatsApp
```

## Evidências de teste

- `npm test` → 61 passed (incl. kernel-context + kernel-provider HTTP local)
- `npm run check` → OK
- `curl GET /v1/health` → `{"status":"ok"}`
- `curl POST /v1/chat` → 200 JSON (nessa execução o Kernel devolveu `provider_error` / mensagem técnica — API Orbit↔Kernel OK; LLM do Kernel depende de `CURSOR_API_KEY` / `OPENROUTER_API_KEY` no `.env` do Kernel)

## Problemas encontrados

1. **Reset em grupo** — o buffer envolvia `/reset`; corrigido parseando o `question` antes do buffer.
2. **Conflito `/reset` admin** — `/reset confirmar` mantém-se no commandBus; `/reset` e `/nova` vão ao Kernel.
3. **LLM Kernel** — `/v1/chat` responde, mas o provider LLM do Kernel pode falhar sem chave válida (independente do Orbit).

## Próximos passos

1. Garantir chaves LLM no Kernel (`.env`) para respostas úteis no WhatsApp.
2. `npm start` no Orbit (sessão `auth/` já existe).
3. Testar manualmente: `@orbit oi` → follow-up → `@orbit /nova`.
4. Em produção: definir `KERNEL_API_TOKEN` alinhado a `ACL_CHANNEL_API_KEYS=whatsapp:…`.
