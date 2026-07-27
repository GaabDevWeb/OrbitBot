# Contributing Guide

## Style & Git Workflow

### Código

| Área | Convenção |
|------|-----------|
| Linguagem | JavaScript (Node.js) apenas — sem TypeScript/Python de produção |
| Formatação | Consistente com ficheiros existentes (CommonJS `require`) |
| Lint | Sem linter obrigatório no repo actual |
| Naming | camelCase funções; ficheiros descritivos em `src/` |
| Testes | Preferir smoke/manual WhatsApp + verificação `node -c` / `npm start` até existir suite |

### Git

**Branches:**

```
refactor/wppconnect-to-baileys   # branch activa desta migração
feature/<descricao-curta>
fix/<descricao>
docs/<descricao>
```

**Regra desta entrega:** todo o trabalho da TASK Baileys ocorre em `refactor/wppconnect-to-baileys` — não commitir a refatoração directamente em `main`.

**Commits (Conventional Commits):**

```
feat: descrição curta
fix: descrição
docs: descrição
refactor: descrição
test: descrição
chore: descrição
```

**Pull Requests:**

- [ ] `npm start` sobe com Baileys (QR) sem erros de require
- [ ] Grupos ignorados; 1:1 responde
- [ ] Comandos admin testados a partir de número em `ADMIN_NUMBERS`
- [ ] PRD/ADR/ARCHITECTURE/DATA-MODEL/API_SPEC alinhados se comportamento mudou
- [ ] Sem secrets (`.env`, pasta `auth/`) no commit

### Comandos locais

```bash
# Instalar
npm install

# Configurar
cp .env.example .env
# editar OPENROUTER_API_KEY e ADMIN_NUMBERS

# Executar
npm start

# Verificar sintaxe (exemplo)
node --check app.js
```

### Revisão de código

- Preferir PR da branch de refactor para `main`
- Sem merge de `.env` ou sessões WhatsApp

## Variáveis de ambiente (obrigatórias no exemplo)

| Variável | Descrição |
|----------|-----------|
| `OPENROUTER_API_KEY` | API key OpenRouter |
| `ADMIN_NUMBERS` | Lista de JIDs/números admin (separados por vírgula) |

Opcionais: timeouts/retries OpenRouter (ver `.env.example` após implementação).

## Documentação

- PRD: `docs/prd/`
- ADR: `docs/adr/`
- Specs: `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`
- Inventário legado: `docs/RELATORIO-GERAL.md`

## Contacto / dúvidas

Maintainer: gaab (repositório OrbitBot).
