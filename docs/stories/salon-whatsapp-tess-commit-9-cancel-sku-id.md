# Story: Cancel tag só com `trinks_id` de AGENDAMENTOS FUTUROS — 0 PATCH no SKU

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — Dex no repo (paralelo 8 ∥ 9 ∥ 10)  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md](../handoffs/2026-09-03-orion-smoke-0007-bugs.md) (Orion · B2)  
**Peers:** [EPIC tess-commit-honesty](epics/EPIC-tess-commit-honesty.md) · story 3 (PUT SKU Rosa — mesmo bind, path cancel)

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "code_review"
  - "I1/I2/I3 unit"
  - "contract Trinks"
  - "coderabbit --prompt-only -t uncommitted"
```

## Story

**As a** cliente que pede cancelamento no WhatsApp,  
**I want** o PATCH `/agendamentos/{id}/status/cancelado` só no `trinks_id` listado em `AGENDAMENTOS FUTUROS`,  
**so that** um SKU de serviço (`14232906` Corte) nunca é usado como `agendamento_id` (I1 cancel).

## Contexto

B2 / smoke `0007` 09:59 BRT. `cancel.not_owned` `requestedId=14232906` (SKU Corte, **não** booking). `booking.cancelled` `outcome=none`. Log: `Cancel not_owned: bookingId=14232906`. Tess: “Não consegui localizar/cancelar… recepção”. Intent do turno = FAQ (grade 0) — classificação é story 11; esta story é o **id**.

Parser/tag `cancels[]` preencheu `agendamento_id` a partir de `bookingId` da tag (`booking-parser.js` ~87). Tess colocou o SKU no campo do booking. `isBookingOwnedByClient` recusa (certo). `future_bookings` vazio no smoke (create pulou — B1). Mesmo com futuro presente, PATCH no número `14232906` é o bug a impedir.

Rosa (`renderFutureBookings`): `bookingId=trinks_id | service_name | …`. SKU ≠ `trinks_id`.

last4 evidência: `0007`. Sem PII. Live **não** é DoD. Se live: outro slot, não 03/09 10:30 André. Sem rsync. Sem Hostinger. Sem replay `0101`.

## IN / OUT

**IN**

- Cancel só com `trinks_id` de `AGENDAMENTOS FUTUROS` / snapshot ativo.
- SKU ≠ bookingId. **0 PATCH** no SKU (`/agendamentos/14232906/...`).
- Se não resolver: recusa honesta (copy já existe, classe `8397`).
- Unit: tag `{agendamento_id: 14232906}` + futuro `526039154`-class → 0 PATCH no SKU.
- `[AUTO-DECISION]` remap SKU→`trinks_id` **só** se exatamente um futuro tem aquele `service_id`; o PATCH vai no `trinks_id`, nunca no SKU.

**OUT**

- PATCH `/agendamentos/{SKU}/status/cancelado`.
- `findClientBooking` `list[0]` cego quando o id da tag é SKU.
- rsync / Hostinger / git push / PATCH Trinks real.
- Replay `0101`. Live 03/09 10:30 André.
- Refazer C1/C2/C3. Mexer path PUT reschedule (story 3 Done).
- Colar prompt. B1 createKeys (story 8) · B3 abort (story 10) · B4 intent (story 11) — paralelos / depois, não esta story.

## Acceptance Criteria

- [x] **AC1:** Antes do PATCH, o `agendamentoId` resolvido **deve** ser um `trinks_id` de `futureBookings` (`isBookingOwnedByClient`). Se o id da tag **não** está na lista de futuros → **não** chama `cancelBookingInTrinks` com esse id.
- [x] **AC2:** Fixture classe `0007` 09:59: tag `{ agendamento_id: 14232906 }` (SKU Corte) + futuro `{ trinks_id: 526039154, service_id: 14232906 }` (ids de evidência, mocks). Resultado: **0** `trinksApi.request` PATCH cujo path contém `14232906`. Recusa honesta **ou** PATCH só em `/agendamentos/526039154/...` se AC5 remap único aplicar.
- [x] **AC3:** SKU ≠ bookingId. Se `requestedId` é igual a um `service_id` conhecido **e** não é `trinks_id` de nenhum futuro → tratar como não resolvido. Nunca PATCH nesse número.
- [x] **AC4:** Se não resolver para um `trinks_id` owned: outbound de recusa honesta já existente (`Não consegui localizar/cancelar… recepção`, classe `8397`). `booking.cancelled` com `outcome=none` / `cancel.not_owned` é aceitável. **Não** inventar id.
- [x] **AC5:** `[AUTO-DECISION]` Se o id da tag casa com `service_id` de **exatamente um** futuro → Dex **pode** resolver para esse `trinks_id` e PATCH **esse** id. Zero ou 2+ futuros com o mesmo SKU → 0 PATCH + recusa (pergunte / recepção), não `list[0]`.
- [x] **AC6:** Path `8397` (cancel `successCount=0`, copy recusa) **não** regride. `isBookingOwnedByClient` e testes de ownership em `booking-parser.test.js` PASS. Story 3 reschedule SKU **não** é retrabalhada.
- [x] **AC7:** Unit cobre AC2–AC5. last4 `0007` só rótulo. Sem PII. Sem PATCH/POST Trinks de rede. Live **não** é DoD (outro slot se live). Sem rsync. Sem Hostinger. Sem replay `0101`. `npm test` da fatia passa. C1/C2/C3 intactos.

## Tasks / Subtasks

- [x] **T1 (AC1, AC3):** No loop 4b (`server.js` ~1911), recusar id que não é `trinks_id` de `futureBookings`. Detectar SKU vs booking. `[Source: Orion B2 · isBookingOwnedByClient ~1920 · booking-parser.js ~87]`
- [x] **T2 (AC2, AC4, AC5):** 0 PATCH no SKU. Recusa honesta se não resolver. Remap único SKU→`trinks_id` opcional e testado. `[Source: Orion B2 unit · story 3 bind Rosa]`
- [x] **T3 (AC6, AC7):** Testes unitários classe `0007` (ids de evidência, mocks). CodeRabbit. Não tocar reschedule.

## Dev Notes

**Tag hoje (Tess pode pôr SKU em `bookingId`)**

```81:91:backend/lib/booking-parser.js
  const cancelRe = /\[BOOKING_CANCEL\s+([^\]]+)\]/gi;
  // ...
        agendamento_id: parseInt(a.bookingId, 10),
```

**Rosa — o id correto é `trinks_id`**

```590:605:backend/lib/booking-parser.js
  return `- bookingId=${b.trinks_id} | ${svc}${prof} em ${when}`;
function isBookingOwnedByClient(bookingId, futureBookings) {
  return (...).some((b) => String(b.trinks_id) === id);
}
```

**Path 4b hoje**

```1911:1928:backend/server.js
      for (const cancelTag of cancelsToRun) {
        let agendamentoId = cancelTag.agendamento_id || null;
        if (!agendamentoId && cancelTag.date) {
          agendamentoId = (await findClientBooking(...))?.id || null;
        }
        if (!isBookingOwnedByClient(agendamentoId, futureBookings)) {
          // cancel.not_owned — skip
        }
```

`isBookingOwnedByClient(14232906, futuros)` já recusa. O gap: (1) `futureBookings` vazio no smoke (B1); (2) se alguém PATCH-ar o SKU antes do owned check, ou se `findClientBooking` devolver lixo. AC2 trava **0 PATCH no SKU** no spy, não só o log `not_owned`.

**PATCH helper**

```828:837:backend/server.js
async function cancelBookingInTrinks(agendamentoId, motivo, quemCancelou = QUEM_CANCELOU.CLIENTE) {
  // PATCH /agendamentos/${agendamentoId}/status/cancelado
  origin: 'agent_mutation_cancel',
}
```

**Recusa já existe** (~1967): `Não consegui localizar/cancelar seu horário automaticamente… recepção`. Não reescrever salvo o spy exigir.

**Constraints**

- last4: `0007`. SKU `14232906` e `trinks_id` `526039154` = ids de evidência/mock, não live.
- Zero rsync. Zero Hostinger. Zero replay `0101`.

**Fonte:** Orion B2 09:59 · epic I1 cancel · story 3 bind (espelho PUT, não copiar PUT).

## File List

- `backend/lib/booking-parser.js` (modified — `resolveCancelAgendamentoId`, `isKnownServiceSkuNotBookingId`)
- `backend/server.js` (modified — loop 4b resolve só `trinks_id` owned; 0 PATCH no SKU)
- `backend/test/cancel-sku.test.js` (created — classe `0007` B2 + `8397` copy)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex via Orion)

**Debug Log References**

_(n/a — unit, sem PATCH Trinks de rede)_

**Completion Notes List**

- Cancel só com `trinks_id` de `AGENDAMENTOS FUTUROS`.
- SKU `14232906` nunca é path de PATCH. Remap SKU→`trinks_id` só se exatamente 1 futuro tem aquele `service_id`.
- 0 ou 2+ futuros com o SKU → recusa (`sku_not_booking` / `sku_ambiguous`). Copy `8397` intacta.
- Path PUT reschedule (story 3) não retrabalhado.

**File List**

- `backend/lib/booking-parser.js`
- `backend/server.js`
- `backend/test/cancel-sku.test.js`

## Testing

- Unit: tag SKU + futuro trinks_id → 0 PATCH no SKU; 0 futuros → recusa; 1 futuro mesmo SKU → PATCH só no `trinks_id` (se remap); 2 futuros mesmo SKU → 0 PATCH; `8397` copy intacta.
- Sem rede Trinks. Sem live VPS. Sem Hostinger.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (path cancel)
- Secondary: Integration (Trinks PATCH + ownership)
- Complexity: Medium (SKU vs `trinks_id`; remap único)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I1 unit cancel SKU)

**Quality Gate Tasks**

- [x] Pre-Commit (@dev): `coderabbit review --agent --type uncommitted --dir backend`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic (deploy não é DoD até unit)

**CodeRabbit Focus Areas**

- Primary: 0 PATCH no SKU; cancel só `trinks_id` owned; recusa honesta se não resolver.
- Secondary: não regressar `8397`; não `list[0]` cego; não retrabalhar story 3.

**Predict files:** `backend/server.js`, `backend/lib/booking-parser.js` (se helper resolve cancel id), `backend/test/` cancel-sku.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## QA Results

### Review Date: 2026-09-03

**Reviewer:** Quinn (@qa)  
**Verdict:** **PASS**

- Stories 8–11 gate: **144/144** focused unit tests.
- Full backend suite: **502/502**.
- Repository prompt suite: **79/79**; no regression in C3/8397 or stories 1–7.
- B2 verified: cancellation resolves only to an owned future `trinks_id`; SKU `14232906` is never used as a PATCH id; ambiguous SKU matches refuse safely.
- No live Trinks calls, rsync, Hostinger, `0101` replay, or 03/09 10:30 André exercise.
- CodeRabbit CLI 0.6.1: `doctor` **9/9 PASS** and final review **0 findings**. The review used the free CLI allowance because the repo is not connected to a CodeRabbit organization.

**Gate decision:** Story 9 may be marked **Done**.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | B2 I1 cancel SKU; 0007 09:59 |
| 2. Technical Implementation Guidance | PASS | 4b ~1911 + owned + 0 PATCH SKU |
| 3. Reference Effectiveness | PASS | Orion B2 + story 3 espelho |
| 4. Self-Containment Assessment | PASS | SKU≠bookingId; remap único explícito |
| 5. Testing Guidance | PASS | tag 14232906 + futuro → 0 PATCH SKU |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.4.0 | Re-gate 144/144 focused; 502/502 backend; CodeRabbit 0 findings. Outbound parcial e prioridades de intenção regressivamente cobertos. | @qa (Quinn) |
| 2026-09-03 | 0.3.0 | QA PASS (140/140 focused; 498/498 backend). Status: ready-for-review→Done. | @qa (Quinn) |
| 2026-09-03 | 0.2.0 | Implementado. Status: Ready→ready-for-review. 0 PATCH no SKU. | @dev (Orion) |
| 2026-09-03 | 0.1.0 | Created. B2 cancel SKU≠trinks_id. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] Remap SKU→trinks_id só se exatamente 1 futuro com aquele service_id (reason: “cancel esse corte” após B1; 0 PATCH no SKU continua).*  
*[AUTO-DECISION] Não retrabalhar PUT reschedule story 3 (reason: spawn B2 = cancel).*  
*[AUTO-DECISION] Live ≠ DoD; outro slot se live (reason: spawn).*  
*[AUTO-DECISION] elicit pulada (YOLO + SOT).*  
*[AUTO-DECISION] ClickUp skip; code-intel skip; gotchas.json ausente.*
