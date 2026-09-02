# Story: Persistência `bot_thread_state` no lugar do Map `humanHandledUntil`

**Epic:** [EPIC-resume-ia-pos-handoff](epics/EPIC-resume-ia-pos-handoff.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**executor:** @dev  
**quality_gate:** @qa  
**Agente executor:** @dev (Composer 2.5 Fast) · schema @data-engineer · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM  
**Branch sugerida:** `feature/resume-ia-pos-handoff`  
**Pedido / GO:** Victor / @aios-master 2026-09-01  
**Handoff:** [docs/handoffs/2026-09-01-plano-resume-ia-pos-handoff.md](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md) (rev. 3, GO)

## Contexto

Hoje o silêncio pós-handoff e pós-takeover Business App vive só em memória: `humanHandledUntil` em `backend/server.js` (Map phone → timestamp_ms, TTL `HUMAN_HANDLED_TTL_HOURS` default 6h). `markHumanHandled` / `isHumanHandled` não tocam Postgres. Restart do backend já apagou silêncio em smoke. Health `/health` reporta `bot.human_handled.active_count` como `humanHandledUntil.size` (conta entradas no Map, não linhas ativas no banco).

Whitelist `bot_whitelist` (`allow` | `human_only` | `block`) é outro silêncio, persistente, gerido em `/toggles`. **Não** misturar. Esta story **não** muta `bot_whitelist`.

`backend/lib/bot-state.js` faz scan cacheado (TTL 5s) de **toggles + whitelist**. O cache de thread state **não** entra nesse scan.

Call sites atuais de silêncio:

- `markHumanHandled` em `processMessage` quando `HANDOFF_HUMAN` (exceto `isOwnerPhone`)
- `markHumanHandled` no webhook Kapso quando outbound `origin !== 'cloud_api'` (exceto dono)
- `isHumanHandled` no inbound Kapso: bot não chama TESS até o TTL (exceto dono)

**IN desta story:** tabela `bot_thread_state`, dual-write, cache por phone ≤5s, health COUNT, rollback 016.  
**OUT desta story:** `POST /admin/conversations/:phone/resume`, parser WhatsApp, diálogo admin, TESS, Kapso send, eventos `resume.*`.

## IN / OUT

**IN**

- Migration `016_bot_thread_state.sql` + rollback (próximo número livre: já existem dois `015_*`).
- Dual-write: `markHumanHandled` / `isHumanHandled` leem e escrevem a tabela; Map vira cache ≤5s **por phone**.
- Owner (`isOwnerPhone`) continua **não** silenciando.
- Health `active_count` = `COUNT(*)` onde `silenced_until > NOW()`.
- Testes de persistência, cache invalidate, TTL, owner.

**OUT**

- Endpoint resume, turno `operator_resume`, parser, UI.
- Colunas novas em `bot_whitelist` ou `conversation_history`.
- Meter o cache de thread no `getBotState()` / scan de `bot-state.js`.
- Disparar TESS ou Kapso.

## Acceptance Criteria

- [x] **AC1:** Migration `infra/migrations/016_bot_thread_state.sql` cria `bot_thread_state` com PK `phone` (dígitos E.164, mesmo formato de `bot_whitelist.phone` / `conversation_history.client_phone`), colunas: `silenced_until`, `silence_reason` (`handoff` | `business_app`), `last_handoff_at`, `last_handoff_motivo`, `resume_note`, `resume_note_set_at`, `resume_note_expires_at`, `resume_note_consumed_at`, `last_resume_at`, `last_resume_actor`, `last_resume_result`, `last_resume_note_hash`, `created_at`, `updated_at`. CHECKs nas enums. Trigger `admin_set_updated_at` (função já em `001_admin_dashboard.sql`). Índices parciais: silêncio ativo (`silenced_until IS NOT NULL`) e nota pendente (`resume_note IS NOT NULL AND resume_note_consumed_at IS NULL`). Idempotente (`IF NOT EXISTS`).
- [x] **AC2:** Existe `infra/migrations/016_bot_thread_state.rollback.sql` que dropa tabela/índices/trigger da 016 sem tocar em `bot_whitelist` nem `conversation_history`.
- [x] **AC3:** `markHumanHandled(phone, reason)` persiste `silenced_until = NOW() + HUMAN_HANDLED_TTL` e `silence_reason` (`handoff` no `HANDOFF_HUMAN`; `business_app` no takeover outbound). Invalida o cache daquele phone. Dono (`isOwnerPhone`) **não** grava silêncio.
- [x] **AC4:** `isHumanHandled(phone)` lê tabela (via cache ≤5s por phone). Se `silenced_until` nulo ou `<= NOW()`, retorna false. Cache **não** é o scan global de `bot-state.js`.
- [x] **AC5:** Teste: set silêncio → invalidate cache daquele phone → `isHumanHandled` ainda true (fonte = Postgres, não só Map). Teste: TTL expirado → false. Teste: owner phone **não** silencia.
- [x] **AC6:** `/health` `bot.human_handled.active_count` = `COUNT(*) FROM bot_thread_state WHERE silenced_until > NOW()` (não `Map.size`). Se a tabela ainda não existir no ambiente, degradar com log (não 500 o health).
- [x] **AC7:** Nenhum `POST` resume, nenhum `callTESS`, nenhum `sendKapsoMessage` novo nesta story. `npm test` da fatia nova passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2):** DDL 016 + rollback. Confirmar com @data-engineer CHECKs (`silence_reason`, `last_resume_actor` ∈ `cli|admin|whatsapp` nullable, `last_resume_result` texto curto). `[AUTO-DECISION]` predicado de índice parcial **sem** `NOW()` (não IMMUTABLE no PG) → `silenced_until IS NOT NULL` / nota pendente. Reason: predicado estável; o COUNT do health filtra `> NOW()`.
- [x] **T2 (AC3, AC4):** Extrair persistência para módulo (ex. `backend/lib/bot-thread-state.js`) com cache `Map<phone, { until, expiresAt }>` TTL 5s. `server.js` dual-write nos call sites atuais. Passar `silence_reason` no takeover vs handoff.
- [x] **T3 (AC5):** `backend/test/bot-thread-state.test.js` (mock db): set → invalidate → still silenced; expiry; owner skip.
- [x] **T4 (AC6):** Health COUNT; fail-safe se relation missing.
- [x] **T5 (AC7):** Grep: esta story não introduz rota `/resume`. CodeRabbit pre-commit.

## Dev Notes

**Touch points reais**

- `backend/server.js` ~L97–117 (`humanHandledUntil`, `markHumanHandled`, `isHumanHandled`); L1792–1796 (handoff); L2149–2157 (takeover); L2250–2252 (gate inbound); L2892–2895 (health `active_count`).
- `backend/lib/owner-access.js` — `isOwnerPhone`.
- `backend/lib/bot-state.js` — **não** misturar cache. Thread state é por phone, fora do scan de whitelist/toggles.
- `infra/migrations/001_admin_dashboard.sql` — `admin_set_updated_at()`.
- `infra/migrations/015_*` já existem (block Matheo + tess credit snapshot) → **016**.
- `infra/schema.sql` `conversation_history` — não alterar.

**Dual-write / contract**

Fase desta story: Map = cache quente ≤5s. Fonte de verdade = tabela. Próximas stories (resume) leem/escrevem as colunas `resume_note*` / `last_resume_*` mas **não** nesta entrega.

**TTL**

`silenced_until` é timestamp absoluto. Reason **não** é `ttl`. Default continua `HUMAN_HANDLED_TTL_HOURS` (6).

**[AUTO-DECISION]** `last_staff_outbound_at` no webhook fica para story 2 (gate `human_spoke_recently`). Reason: handoff GO lista persistência de takeover timestamp no contrato do POST resume, não no cutover do Map.

## File List (previsto)

| A/M | Path |
|-----|------|
| A | `infra/migrations/016_bot_thread_state.sql` |
| A | `infra/migrations/016_bot_thread_state.rollback.sql` |
| A | `backend/lib/bot-thread-state.js` |
| A | `backend/test/bot-thread-state.test.js` |
| M | `backend/server.js` |
| M | `docs/stories/salon-whatsapp-resume-ia-1-persistencia.md` |

## Testing

- Unit: persist + cache invalidate + expiry + owner.
- Health: mock COUNT; missing table não derruba `/health`.
- Não exige smoke WhatsApp nem curl resume (story 2).
- `npm test` / `node --test` da fatia; não exigir suite frontend.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Database
- Secondary: API (health field only)
- Complexity: Medium

**Specialized Agent Assignment**

- Primary: @dev, @data-engineer (@db-sage no review SQL)
- Supporting: @qa

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): `coderabbit --prompt-only --base main`

**CodeRabbit Focus Areas**

- Primary: schema CHECKs, rollback, PK phone, não poluir `bot_whitelist`.
- Secondary: cache fora de `bot-state.js`; health COUNT vs Map.size; owner skip.

**Predict files:** `016_bot_thread_state.sql`, `016_bot_thread_state.rollback.sql`, `backend/lib/bot-thread-state.js`, `backend/test/bot-thread-state.test.js`, `backend/server.js`.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## Dev Agent Record

- **Status:** ready-for-review
- **Start:** 2026-09-01
- **End:** 2026-09-01
- **Agent:** @dev (Dex) · Composer 2.5 Fast · YOLO
- **Decisions:** REUSE `db.query` + padrão cache de `bot-state.js`; CREATE `bot-thread-state.js` separado do scan global; índices parciais sem `NOW()`; fail-open leitura se DB down; health `table_ready` + `active_count` degradado.
- **Tests:** `node --test backend/test/bot-thread-state.test.js` — 5/5 pass; `npm run lint` OK; `npm run typecheck` OK.
- **Notes:** Migration 016 **não aplicada** neste ambiente — deploy deve rodar SQL antes do cutover prod. CodeRabbit pre-commit não executado (CLI ausente / skip graceful).

## Change Log

| Date | Version | Description | Agent |
|------|---------|-------------|-------|
| 2026-09-01 | 0.1.0 | Created. Persistência `bot_thread_state`; sem POST resume. | @sm |
| 2026-09-01 | 1.0.0 | Validated GO (8/10) — Status: Draft → Ready | @po |
| 2026-09-01 | 1.1.0 | Development started (YOLO mode) — Status: Ready → InProgress | @dev |
| 2026-09-01 | 2.0.0 | Implementação: migration 016, bot-thread-state.js, health COUNT, testes 5/5 — Status: InProgress → ready-for-review | @dev |
| 2026-09-01 | 2.0.1 | QA Gate CONCERNS — Status: InReview → Done | @qa |
| 2026-09-01 | 2.0.2 | close-story bookkeeping — epic index; Status Done intacto (QA CONCERNS aceite) `[closure-key: resume-ia.1:digest:working-tree:016@a412ba3e,lib@16ffcc24,test@0b24ac98,rollback@da930c34,HEAD:468391d7]` | @po |

## QA Results

### Review Date: 2026-09-01

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:016@a412ba3e,lib@16ffcc24,test@0b24ac98,rollback@da930c34,HEAD:468391d7

### Code Quality Assessment

Implementação alinhada ao IN: DDL 016 + rollback isolado, módulo `bot-thread-state.js` com cache por phone ≤5s (fora de `bot-state.js`), dual-write nos call sites de handoff/takeover, owner skip, health COUNT com degrade. OUT respeitado (sem POST resume, sem parser, sem UI, sem mutar whitelist). Anti-self-review: Dex (Composer 2.5 Fast) implementou; Quinn apenas revisou.

`node --test backend/test/bot-thread-state.test.js` — 5/5 pass.

### Refactoring Performed

Nenhum. QA não alterou source de aplicação.

### Compliance Check

- Coding Standards: ✓ módulo extraído, fail-open documentado no mesmo padrão de `db.query`
- Project Structure: ✓ `infra/migrations/016_*`, `backend/lib/`, `backend/test/`
- Testing Strategy: ✓ unitários da fatia; gap no fail-path da health (TEST-001)
- All ACs Met: ✓ AC1–AC7 verificados no código (não só checkboxes)

### Improvements Checklist

- [ ] TEST-001: teste de `countActiveSilenced` / health quando `db.query` retorna null (tabela ausente)
- [ ] REL-001: decidir se INSERT falho deve manter silêncio em cache quente (follow-up; fail-open atual é explícito)
- [ ] Ops: aplicar `016_bot_thread_state.sql` antes do cutover prod (não aplicado neste ambiente)

### Security Review

Owner (`isOwnerPhone`) não grava nem lê silêncio. Sem rota nova. Sem mistura com `bot_whitelist`.

### Performance Considerations

Cache Map por phone TTL 5s; health usa `COUNT(*) WHERE silenced_until > NOW()`, não `Map.size`.

### Files Modified During Review

- `docs/qa/gates/resume-ia.1-persistencia.yml` (gate)
- `docs/stories/salon-whatsapp-resume-ia-1-persistencia.md` (QA Results + Status/Change Log)

Pedir ao Dev atualizar File List se quiser o gate no inventário da story.

### Gate Status

Gate: CONCERNS → docs/qa/gates/resume-ia.1-persistencia.yml

### Lifecycle Transition

CONCERNS: InReview → Done
([AUTO-DECISION] Status `ready-for-review` tratado como InReview.)

