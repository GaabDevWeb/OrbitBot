# WhatsApp History Exporter (OrbitBot)

Ferramenta CLI para exportar histórico de **grupos** WhatsApp em JSON, reutilizando a sessão Baileys em `auth/`.

**Não** envia mensagens. **Não** usa Kernel. **Não** implementa QR/login.

## Arquitectura

```text
auth/  →  session.js (Baileys connect)
              ↓
         resolver grupo por nome
              ↓
         scroll.js  (fetchMessageHistory + detecção de progresso)
              ↓
         extractor.js  (WAMessage → JSON)
              ↓
         serializers.js  →  exports/*.json
```

| Módulo | Papel |
|--------|--------|
| `session.js` | Liga com `useMultiFileAuthState(auth/)`; falha se pedir QR |
| `scroll.js` | Loop on-demand + stale cycles |
| `extractor.js` | Schema por mensagem + dedupe id |
| `serializers.js` | JSON final + métricas |
| `exporter.js` | CLI |

## Estratégia de “scroll”

Não há DOM. O equivalente robusto no protocolo é:

1. Ingerir mensagens de `messaging-history.set` e `messages.upsert`.
2. Obter a mensagem **mais antiga** na colecção.
3. Chamar `sock.fetchMessageHistory(batch, oldestKey, oldestTs)`.
4. Esperar novos eventos.
5. Se **0 mensagens novas** durante `--stale` ciclos → parar.
6. Parar também por `--messages`, `--days` ou `--until`.

## Deduplicação

Chave estável:

```text
remoteJid|participant|id|fromMe
```

Fallback: hash SHA1 do conteúdo se faltar `id`.

## Schema JSON

```json
{
  "group": "ADS 2026",
  "group_jid": "120363…@g.us",
  "exported_at": "2026-07-30T…",
  "message_count": 0,
  "period": { "from": "…", "to": "…" },
  "messages": [
    {
      "id": "…",
      "timestamp": "2026-07-01T12:00:00.000Z",
      "author": "Nome",
      "text": "…",
      "type": "text",
      "isGroup": true,
      "hasMention": false,
      "mentions": [],
      "quoted": null
    }
  ]
}
```

`type`: `text` | `image` | `video` | `audio` | `document` | `sticker` | `system` | `unknown` | …

## Uso

**Pare o Orbit** (`Ctrl+C` no `npm start`) — a mesma `auth/` não pode ter dois clientes Baileys.

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
cd /path/to/OrbitBot

node tools/whatsapp-history/exporter.js --group "ADS 2026"
node tools/whatsapp-history/exporter.js --group "ADS 2026" --messages 10000
node tools/whatsapp-history/exporter.js --group "ADS 2026" --days 30
node tools/whatsapp-history/exporter.js --group "ADS 2026" --until 2026-01-01
```

Atalho npm:

```bash
npm run export:history -- --group "ADS 2026" --days 30
```

Saída default: `exports/<slug>-YYYYMMDD.json`.

## Limitações conhecidas (WhatsApp / Baileys)

1. O histórico disponível é o que o **linked device** consegue pedir ao telefone — não é dump ilimitado do servidor.
2. Sem mensagem **seed**, `fetchMessageHistory` não arranca; abrir o grupo no telemóvel ajuda.
3. Mídia: exporta metadados/caption/`[image]`, não ficheiros binários.
4. Nomes de autores dependem de `pushName` / metadata do grupo.
5. Layout “Web” não é scrapado — mudanças de UI não afectam esta ferramenta; mudanças de protocolo Baileys sim.
6. Sessão `loggedOut` / conflito com Orbit a correr → erro claro, sem QR automático.

## Relatório

Ver `docs/WHATSAPP-HISTORY-EXPORTER.md`.
