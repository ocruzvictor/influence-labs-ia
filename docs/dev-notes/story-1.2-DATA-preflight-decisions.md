# Story 1.2-DATA — Pre-Flight Decisions

**Data:** 2026-05-27
**Agente:** @dev Dex (Pre-Flight mode)
**Story:** [admin-dashboard-story-1.2-data-layer-core.md](../stories/admin-dashboard-story-1.2-data-layer-core.md)

Decisões fechadas com Victor antes de codar. Registro aqui pra próxima sessão (ou outro dev) não precisar re-perguntar.

---

## Decisões críticas

### D1. Seed da `bot_whitelist` (migration 002)

3 phones do `BOT_ALLOWED_PHONES` atual:

| Phone (E.164 sem +) | Owner | Mode | Source |
|---|---|---|---|
| `5511964540007` | Victor Cruz (Pareto, conta pessoal smoke tests) | `allow` | memory |
| `5511964540330` | (a confirmar) | `allow` | memory |
| `5511964542495` | (a confirmar) | `allow` | memory |

**Reason** (campo da tabela): `"Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA, 2026-05-27)"`
**added_by:** `NULL` (não há admin user "system" — schema permite via ON DELETE SET NULL)

**Risco assumido:** se os 2 phones (`…0330`, `…2495`) estiverem diferentes no `.env` do VPS, Victor corrige manualmente após apply via `UPDATE bot_whitelist SET phone='...' WHERE phone='5511964540330'` — não bloqueia code.

---

### D2. Fail mode no `bot-state.js`

Estratégia: **fail-safe legacy** — se Postgres indisponível ou retorna erro, cai no `BOT_ALLOWED_PHONES` + `BOT_ACCEPT_ALL` env atual. Continuidade > consistência operacional.

Implementação:
- `backend/db.js` já retorna `null` em erro (não throw)
- `getBotState()` detecta `null` ou rows vazias e retorna `{ toggles: null, whitelist: null }`
- Caller em `server.js` interpreta `whitelist === null` como "use env legacy"

---

### D3. Cache strategy

Lazy refresh (TTL 5s). Primeira request após expirar dispara reload — sem timer/background job. Trade-off: ~50ms extra na primeira call pós-expiração; código drasticamente mais simples.

---

### D4. Migration 002 — simétrica ao padrão 001

Criar tanto `002_seed_whitelist_from_env.sql` quanto `002_seed_whitelist_from_env.rollback.sql`. Convenção do projeto.

---

### D5. Testes — node:test nativo

Mesmo padrão de `backend/test/message-splitter.test.js`: `const { test } = require('node:test')` + `node:assert/strict`. Zero deps adicionais. Roda via `npm test` no `backend/`.

---

### D6. pg pool no backend

Import via `require('../db')` — usa `query(sql, params)` exportado que retorna `null` em erro. Não usar `getPool()` diretamente.

---

### D7. Logs

Console.log estilo `[bot-state]` ou `[kapso][${sessionId}]` (mesmo padrão de `server.js`). Sem logger estruturado novo nesta story.

---

### D8. Bloco a substituir em `server.js`

**Linhas reais:** 1300-1310 (plan estimava 1290-1307; deslocamento pequeno).

**Conteúdo a substituir:**

```javascript
// 4. Whitelist de telefones (modo teste — bot silencioso por padrao)
if (!BOT_ACCEPT_ALL) {
  if (BOT_ALLOWED_PHONES.length === 0) {
    console.log(`[kapso][${sessionId}] WHITELIST VAZIA — bot silencioso (defina BOT_ALLOWED_PHONES ou BOT_ACCEPT_ALL=true)`);
    return res.json({ ok: true });
  }
  if (!BOT_ALLOWED_PHONES.includes(sessionPhone)) {
    console.log(`[kapso][${sessionId}] telefone fora do whitelist — bot inativo (logado passivamente)`);
    return res.json({ ok: true });
  }
}
```

**Preservar:** envs `BOT_ALLOWED_PHONES`, `BOT_ACCEPT_ALL` (linhas 42-47) — usados como fallback + ainda referenciados no `/health` (linhas 1584-1586).

---

### D9. Endpoint `/health` ajustado

Atualizar `/health` (linhas 1584-1586) pra refletir source real do whitelist (DB vs env). Adicionar `whitelist_source: 'db' | 'env-fallback' | 'env-accept-all'` ao payload.

---

### D10. Ordem de execução desta sessão (Fase 1 apenas)

1. ✅ Branch `feature/1.2-admin-data-layer-core` criada
2. Migration 002 + rollback
3. `backend/lib/bot-state.js`
4. `backend/test/bot-state.test.js` (4-6 testes cobrindo cache + fallback)
5. Modificar `backend/server.js:1300-1310` + ajustar `/health`
6. Rodar `cd backend && npm test`
7. Atualizar story (File List + checkboxes Fase 1)

Fase 2-4 (endpoints REST, testes integração, Postman) ficam pra próxima sessão.

---

## Risco operacional Victor

Antes de aplicar migration 002 no VPS:

```bash
ssh deploy@72.60.155.118 'docker exec postgres psql -U postgres -d influence_labs_salon -c "SELECT key, enabled FROM bot_toggles ORDER BY key;"'
```

Se erro `relation does not exist`, aplicar migration 001 primeiro.
Se 3 rows OK, pode aplicar 002 a seguir.

Ordem de deploy:
1. Apply migration 002 no VPS (`@devops` ou Victor manual)
2. Restart backend (`docker compose up -d --build backend`)
3. Smoke: enviar msg WhatsApp do …0007 → bot responde (whitelist DB tem allow)
4. Smoke negativo: enviar de número não-whitelisted → bot silencia (log mostra `mode=block` se inserido, ou silencia via env legacy se DB whitelist vazia)
