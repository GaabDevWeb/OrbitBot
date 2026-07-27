# ADR-0001: Migração WPPConnect → Baileys e simplificação arquitectural

| Campo | Valor |
|-------|-------|
| Data | 2026-07-26 |
| Status | accepted |
| Deciders | Utilizador + MegaBrain |

## Contexto

O OrbitBot depende de `@wppconnect-team/wppconnect`, que controla WhatsApp via browser (alto consumo de CPU/RAM). Em paralelo, a arquitectura acumulou camadas (MessageQueue com buffer 15s, pipeline, PluginSystem, dashboard HTTP sem auth) que não são necessárias para o produto mínimo: atendimento 1:1 + comandos admin.

Preferências de IA (`/ai`) vivem só em memória; cache de respostas não inclui JID do utilizador; admins estão hardcoded.

É necessário escolher engine WhatsApp e definir o nível de simplificação.

## Decisão

1. **Migrar** a engine para `@whiskeysockets/baileys` com autenticação multi-ficheiro local no projecto e QR no terminal.
2. **Eliminar** MessageQueue, `pipeline.js`, PluginSystem (+ pasta `plugins/`), dashboard HTTP/SSE e `treinamento.js`.
3. **Ligar** eventos Baileys (mensagens 1:1) directamente ao handler de negócio, com **mutex por JID**.
4. **Unificar** acesso a dados SQLite e introduzir tabela `config` para personalidade/modelo.
5. **Mover** `ADMIN_NUMBERS` para `.env`; unificar logs em **pino**.
6. **Manter** JavaScript puro, humanizer, OpenRouter, backups e comandos admin core.

## Alternativas consideradas

### Alternativa A — Manter WPPConnect e só limpar módulos

- Prós: menos risco de regressão de sessão WhatsApp
- Contras: footprint de browser permanece; objectivo principal (Baileys) não cumprido

### Alternativa B — Baileys mantendo Queue + PluginSystem + Dashboard

- Prós: migração incremental da engine
- Contras: complexidades e superfície de ataque (dashboard sem auth) continuam; não cumpre TASK

### Alternativa C — Reescrever em TypeScript / outra stack

- Prós: tipagem
- Contras: viola restrição explícita (100% JavaScript)

## Consequências

### Positivas

- Menor consumo de recursos (sem Chromium)
- Código mais legível e caminho de mensagem curto
- Config IA persistente; admin configurável por env
- Sem endpoint HTTP exposto sem autenticação

### Negativas / trade-offs

- Sessão WPPConnect (`./tokens`) **não** é reutilizável — novo QR
- Perda de plugins (`fastAutoReply`, weather, hooks) — respostas curtas passam a ir sempre à IA (salvo lógica futura mínima)
- Buffer de 15s da fila desaparece — substituído por trava de concorrência (comportamento de agrupamento de mensagens consecutivas muda)
- Subcomandos `/ai plugin*` deixam de existir

## Referências

- PRD: `docs/prd/2026-07-26-refactor-baileys.md`
- Inventário: `docs/RELATORIO-GERAL.md`
