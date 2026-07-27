# API Specification

| Campo | Valor |
|-------|-------|
| Versão | v2 (alvo pós-refatoração) |
| Base URL | N/A — sem API HTTP pública do bot |
| Última actualização | 2026-07-26 |

## Autenticação

| Superfície | Mecanismo |
|------------|-----------|
| Comandos admin WhatsApp | Whitelist `ADMIN_NUMBERS` (lista separada por vírgula no `.env`, JIDs ou números normalizados para comparação) |
| OpenRouter | `Authorization: Bearer $OPENROUTER_API_KEY` |
| Dashboard HTTP | **Removido** — não há endpoints |

Não-admin que envia `/comando` → tratado como mensagem normal (IA), sem mensagem de “acesso negado” (comportamento actual preservado).

## Convenções

- Canal de comando: texto WhatsApp começando por `/`
- Respostas: texto plain enviado de uma vez (sem humanizer)
- Datas em backups/logs: conforme implementação actual
- Identificadores de utilizador: JID Baileys (`…@s.whatsapp.net`); normalização para storage a definir na implementação (manter consistência com `clientes.numero`)

## Superfície WhatsApp — Comandos admin

### `/ai`

**Descrição:** Gere personalidade, modelo e stats de IA.  
**Autenticação:** required (admin)

| Subcomando | Comportamento | Persistência |
|------------|---------------|--------------|
| `/ai` | Menu de ajuda | — |
| `/ai personalidade listar` | Lista personalidades | — |
| `/ai personalidade info` | Actual | — |
| `/ai personalidade <nome>` | Define personalidade (+ modelo associado) | `config.personality` (+ modelo se aplicável) |
| `/ai modelo listar` | Lista aliases | — |
| `/ai modelo info` | Modelo actual | — |
| `/ai modelo <alias>` | Define alias | `config.model` |
| `/ai stats` | Estatísticas (sem secção de plugins) | — |
| `/ai cache limpar` | Limpa cache se existir; senão mensagem informativa | — |

**Removido (RF plugins):** `/ai plugin *` — help não deve listar plugins.

**Erros:**

| Caso | Resposta |
|------|----------|
| Nome inválido | Mensagem de erro + sugestão `listar` |
| Não admin | Cai no fluxo IA (não é erro explícito) |

---

### `/backup`

**Descrição:** Gestão de backups do SQLite.  
**Autenticação:** required (admin)

| Subcomando | Comportamento |
|------------|---------------|
| `/backup` | Ajuda |
| `/backup criar [nome]` | Backup manual |
| `/backup listar` | Lista |
| `/backup restaurar <nome>` | Restore |
| `/backup info <nome>` | Stats |
| `/backup atual` | Stats do DB activo |
| `/backup excluir <nome>` | Remove pasta |
| `/backup logs` | Últimas operações |

---

### `/historico`

**Descrição:** Consulta paginada do histórico.  
**Autenticação:** required (admin)

| Sintaxe | Comportamento |
|---------|---------------|
| `/historico <id\|numero> [página]` | Página de 50 msgs; default página 1 |

---

### `/reset`

**Descrição:** Wipe de clientes + histórico.  
**Autenticação:** required (admin)

| Sintaxe | Comportamento |
|---------|---------------|
| `/reset` | Aviso (não executa) |
| `/reset confirmar` | Apaga `historico` + `clientes` (+ sequences); backups preservados |

**Decisão a confirmar na implementação:** `config` (personalidade/modelo) **não** é apagada por `/reset` (preferência de sistema ≠ dados de conversa). Documentar no help se adoptado.

## Integração externa — OpenRouter

### POST `https://openrouter.ai/api/v1/chat/completions`

**Autenticação:** required (`OPENROUTER_API_KEY`)

**Request (campos usados):**

```json
{
  "model": "deepseek/deepseek-chat-v3-0324:free",
  "messages": [
    { "role": "system", "content": "…" },
    { "role": "user", "content": "…" }
  ],
  "temperature": 0.7,
  "max_tokens": 800
}
```

**Response usada:** `choices[0].message.content`

**Erros:** retry com backoff para 5xx/timeouts (comportamento actual em `core/retry.js`); 429 tipicamente sem retry.

## Eventos Baileys (contrato interno)

| Evento | Acção |
|--------|-------|
| `connection.update` (QR) | Imprimir QR no terminal |
| `connection.update` (close) | Reconexão automática |
| `messages.upsert` | Filtrar 1:1 → handler |

Não há webhooks HTTP outbound.

## Versionamento e breaking changes

- Remoção do dashboard `:3000` e de `/ai plugin*` são breaking para operadores que dependiam disso.
- Troca WPPConnect → Baileys exige novo QR (breaking de sessão).
- Preferências `/ai` passam a persistir (melhoria; não breaking).
