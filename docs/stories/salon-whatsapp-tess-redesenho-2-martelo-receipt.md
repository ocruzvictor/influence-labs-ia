# Story: Martelo — silêncio ≠ release; aceite nomeado

**Epic:** [EPIC-tess-redesenho-commit](epics/EPIC-tess-redesenho-commit.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev  
**Quality gate:** @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — @dev `*develop` (repo only; sem OPEN / POST / Hostinger)  
**Branch sugerida:** `feature/pilot-first-n-soft-open` (atual)  
**Spec SOT:** [onda-1-spec/spec.md](../research/2026-09-08-tess-redesenho/onda-1-spec/spec.md) §3.5  
**Schema SOT:** [03-schema-hold.md](../research/2026-09-08-tess-redesenho/onda-1-spec/03-schema-hold.md) receipts  
**UX SOT:** [04-ux-martelo.md](../research/2026-09-08-tess-redesenho/onda-1-spec/04-ux-martelo.md)  
**Critique:** [critique.md](../research/2026-09-08-tess-redesenho/onda-1-spec/critique.md) CRIT-2 T-SLA  
**Memória:** [MEMORY T1+T2](../ops/MEMORY-tess-t1-t2-fds-2026-09-08.md) (não reler corpus FDS)  
**Depende:** story 1 [hold+sanitize](salon-whatsapp-tess-redesenho-1-hold-sanitize-f5.md) **Done**

```yaml
clickup:
  task_id: ""
  epic_task_id: ""
  list: "Backlog"
  url: ""
  last_sync: ""
  note: "ClickUp MCP ausente nesta sessão — story só local"
```

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "T-1734 / T-Denise / T-SLA unit"
  - "silence ≠ release hold"
  - "assigned_to veto Pedro"
  - "coderabbit review --uncommitted"
```

## Story

**As a** recepção (e o cliente no WhatsApp),  
**I want** o staff entrar no fio **sem apagar o hold** e só gravar na Trinks depois de um aceite **nomeado** (ou negar com copy honesta),  
**so that** F3×F5 não mata o 2-phase e Denise não chega “confirmada” sem 2xx (`1734`).

## Contexto

Story 1 lockou o slot e matou HOLD_COPY. O buraco que resta: staff no fio → `silenced_until` / `last_staff_outbound_at` → Tess cala → **hold e 2-phase morrem** (F3×F5). Denise walk-in. `hasStaffOnConversation` já existe em `bot-thread-state.js` (24h). Martelo = receipt persistido + ação admin; **F3 permanece** (bot calado).

last4 rótulo (story 2): `1734` Denise. Sem PII. Sem inventar `booking.created`. TEST-001/002 da story 1 **não** entram neste IN.

## IN / OUT

**IN**

- Migration `infra/migrations/020_booking_handoff_receipts.sql` + rollback. Padrão 019 (sem `NOW()` em predicado de unique). **Não** usar `infra/schema.sql` legado.
- Tabela `booking_handoff_receipts` conforme spec § receipts (`hold_id`, `phone`, `assigned_to`, `sla_until`, `action`, `acted_at`, `note`). CHECK `assigned_to` bloqueia genéricos (`recepção`, `recepcao`, `a recepção`, `staff`).
- Worker `backend/lib/booking-handoff-receipts.js` — 0 LLM. Create pending · approve · reject · timeout lazy.
- Hook: `markHumanHandled` / `persistStaffOutbound` / `HANDOFF_HUMAN` **não** fazem release/expire/delete de `booking_holds`.
- COMMITTING (POST Trinks) **bloqueado** se `hasStaffOnConversation` **ou** tag `HANDOFF_HUMAN` e não houver receipt `approved` deste hold.
- Auto-commit da story 1 **permanece** quando **não** há staff no fio e **não** há `HANDOFF_HUMAN`.
- Superfície v1: evento `handoff.receipt` via `emitOperationalEvent` + alerta Nightwatch P0 (last4) + `POST /admin/handoff-receipts/:id` com `X-Admin-Token` (`action: approved|rejected`, `assigned_to` nomeado). **Sem frontend novo** (NFR-4).
- Timeout lazy (lookup/acquire de receipt): `sla_until` passou → `action=timeout` + evento; hold **permanece** `held` até `expires_at`. **Sem cron novo.**
- Copy reject (quando o bot puder falar de novo): *“Esse horário não ficou gravado. Quer outro?”* Sem endereço / confirmado.
- Units: T-1734, T-Denise, T-SLA. Estender holds (silence não muda status).

**OUT**

- Frontend / Mission Control / tela de dois botões (v1.1, UX § wireframe).
- Colar / editar prompt 46589.
- OPEN / `startPilot` / `BOT_ACCEPT_ALL` / Hostinger / rsync / POST Trinks live / replay cliente.
- Apply 019/020 em prod. Smoke 0007 live.
- TEST-001 hook CREATE unit · TEST-002 unique PG real (ficam no smoke/staging).
- Split de agente · DE Cowork · A/B modelo · Hermes · OpenClaw.
- Hold nativo Trinks. Afrouxar I1/I2/I3 / 2-phase / HOLD_COPY ban / unique hold.

## Acceptance Criteria

- [x] **AC1 (FR-6, T-1734):** Staff outbound / `silenced_until` ativo **não** altera `booking_holds` para `released`/`expired`/`failed`. Hold `held|committing` permanece. Bot **cala** (F3). Outbound **sem** HOLD_COPY e sem “Já estou confirmando”.
- [x] **AC2 (FR-7):** Se `hasStaffOnConversation(phone)` **ou** tag `HANDOFF_HUMAN` e existe hold ativo deste phone: criar receipt `pending` (idempotente) **antes** de qualquer POST. COMMITTING sem receipt `approved` → **0 POST**. `assigned_to` inicial = `queue:owner` (não genérico Pedro).
- [x] **AC3 (FR-7, UX):** `POST /admin/handoff-receipts/:id` com token admin: `approved` grava `acted_at` + `assigned_to` nomeado (body obrigatório; veto genéricos) e autoriza o POST existente (guards + 2xx → `confirmed`). `rejected` → hold `rejected` + unique livre + copy honesta de reject. Sem sucesso/endereço no pending.
- [x] **AC4 (FR-4, I1):** Cliente **nunca** lê confirmado/endereço/`te esperamos` entre pending e Trinks 2xx. `selectOutboundBlocks` intacto.
- [x] **AC5 (FR-8, T-SLA, CRIT-2):** Receipt `pending` com `sla_until` ≤ NOW() no lookup → `action=timeout` + `handoff.receipt` (motivo timeout). Hold **não** é liberado pelo timeout (só por `expires_at` do hold ou reject). Sem copy “recepção já foi avisada” sem receipt persistido.
- [x] **AC6 (T-Denise):** Walk-in / staff no fio após promessa, sem receipt `approved`: estado ≠ `confirmed`; receipt `pending` ou `timeout`; copy cliente não diz confirmado. last4 rótulo `1734`.
- [x] **AC7 (NFR-4):** Evento `handoff.receipt` payload last4 + receiptId + action. Sem PII. Sem tela nova. Reusa `ADMIN_TOKEN` / padrão `/admin/*`.
- [x] **AC8:** Sem cola prompt. Sem POST Trinks de teste. Sem OPEN. Migration 020 tem rollback. Fatia T-1734 / T-Denise / T-SLA PASS. Story 1 units holds+parser **não** regridem.

## Tasks / Subtasks

- [x] **T1 (AC2, AC5, AC7):** Migration `020_booking_handoff_receipts.sql` + rollback. CHECK assigned_to. Index pending `sla_until` sem `NOW()` no predicado. `[Source: onda-1-spec/03-schema-hold.md · 019_booking_holds.sql]`
- [x] **T2 (AC2, AC3, AC5):** `backend/lib/booking-handoff-receipts.js` create/approve/reject/timeout lazy. Idempotente pending por `hold_id`. 0 LLM. `[Source: spec.md#3.5]`
- [x] **T3 (AC1, AC2):** Hook `bot-thread-state` + `server.js`: silence/staff **não** release hold; staff/`HANDOFF_HUMAN` exige receipt `approved` antes de `createBookingInTrinks`. `[Source: backend/lib/bot-thread-state.js hasStaffOnConversation]`
- [x] **T4 (AC3, AC7):** `POST /admin/handoff-receipts/:id` + emit `handoff.receipt` + Nightwatch P0 last4. Sem frontend. `[Source: 04-ux-martelo.md · server.js /admin/*]`
- [x] **T5 (AC1, AC4, AC6, AC8):** Tests `backend/test/handoff-martelo.test.js` + regressão `booking-holds` / `booking-parser`. Sem Playwright. Sem live.

## Dev Notes

**Previous Story Insights**

- Story 1: hold + sanitize F5 Done (QA CONCERNS). TEST-001/002 **não** refazer aqui. HOLD_COPY continua banida. `[Source: docs/qa/gates/tess-redesenho.1-hold-sanitize-f5.yml]`
- `hasStaffOnConversation` = human-handled **ou** staff outbound 24h. Reusar; não reinventar F3. `[Source: backend/lib/bot-thread-state.js]`
- Auto-commit sem staff permanece (story 1). Martelo só quando staff/`HANDOFF_HUMAN`.

**Data Models**

- Spec SQL receipts em `03-schema-hold.md`. `assigned_to` NOT NULL; genéricos bloqueados no CHECK.
- `hold.status = rejected` já existe no CHECK da 019.

**API Specifications**

- `POST /admin/handoff-receipts/:id` body `{ action: "approved"|"rejected", assigned_to, note? }`. Header `X-Admin-Token`. Sem POST Trinks novo — approve só **autoriza** o ramo COMMITTING já existente no próximo turno ou no mesmo se a tag ainda estiver em voo (preferir: approve marca receipt; POST só no CREATE subsequente ou no mesmo request se tag+guards já avaliados). **AUTO-DECISION:** approve **não** dispara POST sozinho; libera o gate. Próximo CREATE (ou o CREATE bloqueado neste turno, se ainda no loop) segue guards+2xx.
- Events: `handoff.receipt` via `emitOperationalEvent`. last4 only.

**File Locations**

| Path | Ação |
|---|---|
| `infra/migrations/020_booking_handoff_receipts.sql` | add |
| `infra/migrations/020_booking_handoff_receipts.rollback.sql` | add |
| `backend/lib/booking-handoff-receipts.js` | add |
| `backend/lib/bot-thread-state.js` | modify (não release hold) |
| `backend/server.js` | modify (gate COMMITTING + admin POST) |
| `backend/lib/nightwatch-ops.js` | modify se allowlist de eventos |
| `backend/test/handoff-martelo.test.js` | add |
| `backend/test/booking-holds.test.js` | extend T-1734 silence |

**Testing Requirements**

- `node --test backend/test/handoff-martelo.test.js backend/test/booking-holds.test.js backend/test/booking-parser.test.js`
- GWT: T-1734, T-Denise, T-SLA.
- Sem smoke WhatsApp live.

**Technical Constraints**

- Timeout Tess 25s **não** aumenta. Receipt insert < 50ms alvo.
- Índices parciais sem `NOW()` no predicado.
- NFR-4: sem frontend. NFR-3: hold local ≠ lock Trinks.
- Copy reject literal UX: *“Esse horário não ficou gravado. Quer outro?”*

**Project Structure Notes**

- `infra/schema.sql` desatualizado. 020 é o canal certo.
- Não criar workers em `backend/scripts/salao/` (Forge OUT).

## File List

- `infra/migrations/020_booking_handoff_receipts.sql` — add
- `infra/migrations/020_booking_handoff_receipts.rollback.sql` — add
- `backend/lib/booking-handoff-receipts.js` — add
- `backend/lib/booking-holds.js` — modify (`markRejected`, `lookupActiveHoldForPhone`)
- `backend/lib/bot-thread-state.js` — modify (comentário: silence ≠ release)
- `backend/lib/nightwatch-ops.js` — modify (`handoff.receipt` na watch list)
- `backend/server.js` — modify (gate COMMITTING + admin POST + capture no staff)
- `backend/test/handoff-martelo.test.js` — add
- `backend/test/booking-holds.test.js` — extend T-1734
- `backend/test/bot-thread-state.test.js` — extend (SQL não toca holds)
- `docs/stories/salon-whatsapp-tess-redesenho-2-martelo-receipt.md` — checkboxes / File List / record
- `docs/qa/gates/tess-redesenho.2-martelo-receipt.yml` — QA gate CONCERNS

## Testing

- Unit receipts (pending idempotente, approve/reject, timeout lazy).
- Unit silence ≠ release.
- T-1734 / T-Denise / T-SLA. Sem Playwright. Sem VPS.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Database
- Secondary: API (admin + hot-path gate)
- Complexity: High (estado canal × hold × I1)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (T-1734/T-Denise), @data-engineer (schema 020)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit review --uncommitted`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** — sem Hostinger / OPEN

**CodeRabbit Focus Areas**

- Primary: silence ≠ DELETE hold; CHECK assigned_to; 0 POST sem approved.
- Secondary: 2-phase intacto; timeout não libera unique; last4 only.

**Predict files:** `020_booking_handoff_receipts.sql`, `booking-handoff-receipts.js`, `bot-thread-state.js`, `server.js`, `handoff-martelo.test.js`.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## Dev Agent Record

**Agent:** Dex (@dev)  
**Branch:** `feature/pilot-first-n-soft-open`  
**Notes:** Silence não solta hold. COMMITTING exige receipt `approved` se staff/`HANDOFF_HUMAN`. Approve não POST sozinho. SLA 15 min lazy. Sem OPEN / cola 46589 / POST live. Migration 020 **não** aplicada em prod.

**Gates:** `node --test backend/test/handoff-martelo.test.js backend/test/booking-holds.test.js backend/test/booking-parser.test.js backend/test/bot-thread-state.test.js backend/test/nightwatch-ops.test.js` → PASS. Root lint / typecheck / prompt tests PASS.

## QA Results

### Review Date: 2026-09-08

### Reviewed By: Quinn (Test Architect)

### Gate: CONCERNS · score 80 · [tess-redesenho.2-martelo-receipt.yml](../qa/gates/tess-redesenho.2-martelo-receipt.yml)

### Reviewed Revision: working-tree:booking-handoff-receipts.js@4e2fbd70,booking-holds.js@936800a1,bot-thread-state.js@2f286def,nightwatch-ops.js@b725f2c1,server.js@38bc252c,handoff-martelo.test.js@07a75c0f,020.sql@1ad642a0,020.rollback.sql@d21f301e,HEAD:d7f9cd0

### Code Quality Assessment

Martelo fecha F3×F5 na fatia unit. Silence/`markHumanHandled` não toca `booking_holds`. Staff ou `HANDOFF_HUMAN` cria receipt `pending` (`queue:owner`) e `canCommit` só é true com `approved`. Timeout lazy não libera o hold. Reject chama `markRejected` (unique 019 livre). Approve não POST Trinks. `HOLD_COPY` continua morta; `selectOutboundBlocks` intacto. 137/137 da fatia PASS.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ worker 0 LLM; events last4; CHECK assigned_to + veto JS
- Project Structure: ✓ `backend/lib` + `infra/migrations` + admin no padrão `/admin/*`
- Testing Strategy: ✓ GWT T-1734 / T-Denise / T-SLA; story 1 holds+parser não regridem
- All ACs Met: ✓ AC1–8 na fatia worker+holds+parser; hook `server.js` coberto por leitura, não por unit (TEST-003)

### Improvements Checklist

- [x] Silence ≠ release; T-1734 sem HOLD_COPY
- [x] T-Denise sem confirmed; T-SLA timeout + hold `held`
- [x] CHECK + `isNamedAssignee` vetam genéricos Pedro
- [ ] TEST-003 — unit do hook `server.js` (gate + admin POST)
- [ ] OPS-001 — `handoff.receipt` pending/timeout como sinal P0 do patrol
- [ ] UX-001 — `REJECT_COPY` só no JSON admin (v1 aceitável)

### Security Review

last4 só em payload de `handoff.receipt`. Admin `X-Admin-Token`. Sem PII. Sem cola 46589. Sem inventar `booking.created`.

### Performance Considerations

Timeout lazy no lookup; sem cron. SLA default 900s, clamp 300–3600.

### Files Modified During Review

- `docs/qa/gates/tess-redesenho.2-martelo-receipt.yml` — add
- `docs/stories/salon-whatsapp-tess-redesenho-2-martelo-receipt.md` — QA Results + Status Done

## PO Concern Review (2026-09-08)

**Verdict:** aceitar CONCERNS · story 2 permanece **Done** · sem reabrir AC

| ID | Decisão | Por quê |
|---|---|---|
| TEST-003 | **Aceito** — follow-up helper/smoke do hook `server.js` + admin POST. **Não** é AC de story nova. | Fatia worker cobre `gateCommit`/`actOnReceipt`; hook lido no gate. TEST-001/002 **continuam OUT**. |
| OPS-001 | **Aceito** — sinal P0 no `patrolLive` é follow-up ops/staging. **Não** reabre AC7. | Evento `handoff.receipt` last4 já existe; NFR-4 sem tela nova. Apply 020 + patrol depois, sem Hostinger/OPEN agora. |
| UX-001 | **Aceito** — `REJECT_COPY` na superfície admin v1. Inject no resume = v1.1 (wireframe). | AC3 pede copy honesta no reject; admin devolve a frase. Bot calado (F3) até o staff sair. |

Smoke 0007 / apply 019+020 continuam **depois** do gate, não DoD desta story.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | F3×F5; 1734/Denise; story 1 Done |
| 2. Technical Implementation Guidance | PASS | 020 + receipts.js + gate COMMITTING + admin POST |
| 3. Reference Effectiveness | PASS | spec §3.5 + schema receipts + UX 04 + bot-thread-state |
| 4. Self-Containment Assessment | PASS | AC1–8 com copy e last4 |
| 5. Testing Guidance | PASS | T-1734 T-Denise T-SLA; sem live |
| 6. CodeRabbit Integration | PASS | CLI nova no gate tool |

**Final Assessment:** Draft → Ready no validate @po.

## PO Validation (2026-09-08)

**Verdict:** GO · **8/10** · confiança High

Clarificações sem mudar escopo (auto-decisões):

1. Smoke 0007 / apply 019 **não** bloqueia Ready nem `*develop` repo-only (igual story 1). TEST-002 fica staging.
2. SLA default **15 min** (`BOOKING_HANDOFF_SLA_SEC`, clamp 300–3600). Expire/timeout **lazy** no lookup — sem cron.
3. `assigned_to` pending = `queue:owner`. Approve/reject **exigem** `assigned_to` nomeado no body (veto Pedro).
4. Approve **não** dispara POST sozinho — só libera o gate COMMITTING.
5. Trigger = `hasStaffOnConversation` **ou** `HANDOFF_HUMAN`.
6. `quality_gate: @qa` = convenção do repo (Bob lista @architect) — CONCERN não bloqueante.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-08 | 0.1.0 | Draft story 2 Martelo receipt. ClickUp skip. | @sm |
| 2026-09-08 | 0.1.1 | Validated GO (8/10) — Status: Draft → Ready. SLA lazy, queue:owner, approve sem POST solo. | @po |
| 2026-09-08 | 0.2.0 | Implement T1–T5. Status: InProgress → ready-for-review. | @dev |
| 2026-09-08 | 0.3.0 | QA gate CONCERNS (80). Status: InReview → Done. TEST-003/OPS-001/UX-001. | @qa |
| 2026-09-08 | 0.3.1 | PO review-concerns: TEST-003/OPS-001/UX-001 aceitos (não bloqueiam). | @po |

---

*[AUTO-DECISION] elicit pulada (ACK 2 depois 3 explícito).*  
*[AUTO-DECISION] ClickUp sync skipped — MCP ausente; story local válida.*  
*[AUTO-DECISION] smoke 0007 não é blocker de papel — user pediu story 2 agora.*
