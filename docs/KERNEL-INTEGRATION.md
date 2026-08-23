# Orbit → Kernel (ChannelContext)

| Campo | Valor |
|-------|-------|
| Data | 2026-07-28 |
| Branch | `feature/orbit-kernel-provider` |

## Fluxo

```text
WhatsApp → Baileys → Orbit → KernelProvider → POST /v1/chat → Kernel → answer → formatter → WhatsApp
```

OpenRouter **não** participa do fluxo principal.

## Mapeamento Baileys → ChannelContext

| Cenário | `platform` | `user_id` | `channel_id` |
|---------|------------|-----------|--------------|
| 1:1 | `whatsapp` | JID completo do chat (`…@s.whatsapp.net`) | igual a `user_id` |
| Grupo | `whatsapp` | JID completo do **autor** (`participant` / bot em fromMe) | JID do **grupo** (`…@g.us`) |

**Não** normalizar para só dígitos — preservar JIDs Baileys.

## Reset

Após strip `@orbit`, `/reset` e `/nova` → `reset_context: true`.  
Só comando → `message: "olá"`; resposta do Kernel encaminhada.  
`/reset confirmar` (admin DB) permanece no commandBus.

## Config

| Env | Default | Notas |
|-----|---------|-------|
| `KERNEL_API_URL` | `http://127.0.0.1:8001` | base sem `/v1` |
| `KERNEL_API_TOKEN` | (vazio) | Bearer se definido; senão sem header |
| `KERNEL_API_TIMEOUT_MS` | `60000` | timeout HTTP |

## Grupos

O Orbit **bufferiza** mensagens localmente (observabilidade), mas `POST /v1/chat` recebe **apenas** a pergunta limpa (após strip `@orbit` / menção).

O Kernel é SSOT de transcript, pin e RAG. Quote/reply curto no body = etapa futura (fora desta entrega).

## Cache

Cache de respostas IA **desactivado** no caminho Kernel. Histórico SQLite local mantém-se para admin/backup; transcript conversacional = Kernel.
