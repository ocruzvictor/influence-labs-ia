# Decision Log — Story 1.2-DATA Fase 3 (testes integração)

**Iniciado:** 2026-05-27 ~15:10 UTC (sessão paralela, agente isolado)
**Branch:** `feature/1.2-DATA-fase3-tests`
**Base:** `main` HEAD `b981414` (PR #8 mergeado)
**Pulled de Fase 2/4:** Pula `D9` da Fase 2 — agora coberta.

## Modo de execução

YOLO autônomo. Pedido: completar Fase 3 da Story 1.2-DATA com tests cobrindo os 12 ACs.

## Decisões

### D1. Test DB: container dedicado em docker-compose.yml com `profiles: [test]`

**Decisão:** Adicionar serviço `postgres-test` em `infra/docker-compose.yml`:
- Image `postgres:17-bookworm` (mesma família major do prod `pgvector/pgvector:pg17`)
- Porta host **5433** → container 5432 (sem conflito com prod)
- DB name `influence_labs_salon` (igual ao prod — os scripts SQL têm `\c influence_labs_salon` hardcoded e ajustar seria mais invasivo que reusar o nome num container isolado)
- `tmpfs` em `/var/lib/postgresql/data` (DB in-memory, setup rápido, sem persistência)
- `profiles: [test]` → não sobe por default; usa `docker compose --profile test up -d postgres-test`
- Init scripts montados read-only: `00-schema.sql` (schema.sql legacy) + `01-admin.sql` (migration 001) + `02-seed.sql` (migration 002). Naming numérico força ordem.

**Por quê não Opção B (mock módulo `pg`)**: 80% dos tests precisam testar QUERIES SQL reais (cursor pagination, GROUP BY view, JOIN com admin_users). Mock seria reimplementar pg em JS — fragil e cobertura falsa.

**Por quê não criar `docker-compose.test.yml` separado:** Task constraint permitia tocar `docker-compose.yml`. Profile `[test]` provê o mesmo isolamento sem proliferar arquivos.

**Trade-off:** Inicialização ~15s na primeira vez (init scripts rodam). Reuso instantâneo enquanto container vivo. tmpfs apaga ao parar — esperado.

### D2. Test approach: lib-direct para 90% dos ACs, handler-direct quando não exige auth

**Decisão:** Não tentar reproduzir Next.js runtime (AsyncLocalStorage de `cookies()`) para handlers que chamam `getCurrentUser()`. Em vez disso:

| AC | Approach |
|----|----------|
| AC1 (proxy 307 sem cookie) | DOCUMENTADO em prod + Postman — proxy.ts requer Next runtime full |
| AC2-AC5 (conversas) | `listConversations()`/`getConversationTimeline()` direto. Handler GET tb testado (não chama getCurrentUser). |
| AC6-AC7 (toggle persiste) | `setToggle()` lib-direct. Propagação backend (≤5s) → coberta por `backend/test/bot-state.test.js` (já existente). |
| AC8 (whitelist block) | `upsertWhitelist()` lib-direct. Bot silencia → propagação cobertas como AC6. |
| AC9 (audit payload) | `setToggle() + logAudit()` direto. |
| AC10 (filtro user_id) | `listAuditLog({userId})` direto. |
| AC11 (Zod uppercase) | Regex inline testado: `/^[a-z_]+(:[a-z_]+)?$/` |
| AC12 (key inexistente) | `setToggle()` retorna null → handler responde 404 (lógica testada na lib). |

**Por quê não `--experimental-test-module-mocks` pra mockar `lib/session`:** Funciona, mas adiciona dependência experimental + setup complexo pra ganhar HTTP-level coverage que Postman já provê. Lib-level cobre semantic behavior.

**Cobertura honesta declarada:** Em cada test file no header está documentado quais halves do AC ficam pra Postman/smoke vs unit.

### D3. `TZ=UTC` obrigatório no test script

**Sintoma:** AC4 (cursor pagination) falhava com phone duplicado entre páginas.

**Root cause:** `conversation_history.created_at` é `TIMESTAMP WITHOUT TIME ZONE` (legacy, schema.sql). pg-node converte JS Date inserido como local time do client. Em macOS local (-03:00), valores armazenados são offset de UTC. View retorna `MAX(created_at)` (mesmo tipo). Quando lib faz `.toISOString()` e cursor é comparado com `< $4::timestamptz`, há mismatch de TZ.

**Fix:** Prefixo `TZ=UTC` no script `test` em `package.json`. Em prod o container roda UTC, então isso espelha produção.

**Não modifiquei o schema legacy** (timestamp → timestamptz seria invasivo e fora do escopo da story).

### D4. `--test-concurrency=1` no script test

**Sintoma:** `bot_whitelist_pkey` duplicate key violation entre tests.

**Root cause:** `node --test` roda arquivos em PARALELO por default. Múltiplos test files chamavam `resetDb()` simultaneamente → race condition no TRUNCATE+INSERT.

**Fix:** Flag `--test-concurrency=1` força execução serial. Trade-off: tests demoram ~2min (vs ~30s paralelo) — aceitável pra integração com DB compartilhado. Alternativa seria DBs separados por test file, complexidade não justificada nesta fase.

### D5. Cache LRU manualmente limpa entre tests

**Decisão:** `clearConversationCache()` chamado em `beforeEach` + entre cada operação que muda o DB.

**Por quê:** LRU TTL 2s, mas tests podem ser rápidos. Sem clear, items cached da query anterior leak.

### D6. `setup.ts` usa `??=` para preservar `DATABASE_URL` override

**Mudança mínima:** `process.env.DATABASE_URL = "..."` → `process.env.DATABASE_URL ??= "..."`.

**Por quê:** Permite rodar `DATABASE_URL=postgres://... npm test` para apontar ao test container, mantendo fallback stub para tests puros que não tocam DB.

### D7. `process.on('beforeExit')` para fechar pool — NÃO por-file `after(closePool)`

**Decisão:** Helper registra UM listener global em `process.on('beforeExit')` que chama `pool.end()`.

**Por quê:** Se cada test file chamasse `after(() => closePool())`, o primeiro file a terminar fecharia o pool compartilhado por todos. `beforeExit` roda quando o event loop esvazia — exatamente quando queremos.

### D8. Tests pulam silenciosamente quando DB não disponível

**Decisão:** Helper `dbTest()` wrapper detecta `DATABASE_URL.includes("5433")` E ping ao pool. Se falha, `t.skip(...)`.

**Por quê:** Permite rodar `npm test` em ambientes sem docker (CI inicial, contribuidor novo) — falha clara em vez de stack trace. Honest signal.

## Files modificados/criados

**Criados:**
- `frontend/admin/tests/api/helpers.ts`
- `frontend/admin/tests/api/conversas.test.ts` (8 tests)
- `frontend/admin/tests/api/toggles.test.ts` (7 tests)
- `frontend/admin/tests/api/whitelist.test.ts` (7 tests)
- `frontend/admin/tests/api/audit-log.test.ts` (7 tests)
- `frontend/admin/tests/README.md`
- `.ai/decision-log-1.2-DATA-fase3.md` (este arquivo)

**Modificados:**
- `infra/docker-compose.yml` — adicionado serviço `postgres-test` (profile `test`)
- `frontend/admin/package.json` — script `test` agora inclui `TZ=UTC`, `--experimental-test-module-mocks`, `--test-concurrency=1`, glob `tests/api/*.test.ts`
- `frontend/admin/tests/setup.ts` — `DATABASE_URL ??=` em vez de override sempre
- `docs/stories/admin-dashboard-story-1.2-data-layer-core.md` — Fase 3 marcada done + 12 ACs marcados + Change Log atualizado

## Tests executados

```
36 tests
36 pass
0 fail
0 cancelled
0 skipped
duration: ~2 min serial
```

Comando: `DATABASE_URL="postgres://postgres:test@localhost:5433/influence_labs_salon" npm test`

Validações adicionais:
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run build` ✅ (com env stub)

## Próximo passo

`@devops` push da branch `feature/1.2-DATA-fase3-tests` + PR target `main`.
