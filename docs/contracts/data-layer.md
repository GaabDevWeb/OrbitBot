# Contrato — Camada de Dados Unificada (v1)

| Campo | Valor |
|-------|-------|
| Data | 2026-07-26 |
| Consumidores | messageHandler, aiConfig, admin commands |

## Assinaturas

```js
getOrCreateClient(numero: string): Promise<{ id: number, numero: string }>
appendHistory(clienteId: number, role: 'user'|'assistant', mensagem: string): Promise<object>
getRecentHistory(identifier: number|string, limit?: number): Promise<{ messages: Array }>
getPagedHistory(identifier: number|string, page?: number): Promise<{ messages, pagination }>
getConfig(key: string): Promise<string|null>
setConfig(key: string, value: string): Promise<void>
resetAllData(): Promise<void>  // apaga clientes+historico; PRESERVA config
```

## Notas

- `identifier` aceita id numérico, dígitos, `…@c.us` ou `…@s.whatsapp.net`.
- Export público: `require('../database')` (fachada em `database/index.js`).
