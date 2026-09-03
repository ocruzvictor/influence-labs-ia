# Story: `createKeys` não trata cancelado como duplicata — skip sem “Confirmo aqui” sem 2xx

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — Dex no repo (paralelo 8 ∥ 9 ∥ 10)  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md](../handoffs/2026-09-03-orion-smoke-0007-bugs.md) (Orion · B1)  
**Peers:** [EPIC tess-commit-honesty](epics/EPIC-tess-commit-honesty.md) · stories 1–7 Done (unit)

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

**As a** cliente que cancela um horário e pede o mesmo slot de novo na mesma sessão WhatsApp,  
**I want** o backend não tratar `state.createKeys` como verdade se o snapshot ativo não tem o slot,  
**so that** o skip de idempotência nunca afirma “Confirmo aqui o agendamento então” sem POST 2xx / `booking.created` (I1).

## Contexto

B1 / smoke `0007` 09:58 BRT. Tag CREATE correta (`serviceId=14232906`, André `827200`, `2026-09-03` 10:30). Log: `[idempotency] create duplicado ignorado e799e336…`. **0** `booking.created`, **0** POST. Tess: “Confirmo aqui o agendamento então”. Snapshot: só `526039154` `cancelled`.

`findDuplicateAppointment` **já ignora** `cancelled` (`ACTIVE_STATUSES` só `scheduled`/`confirmed` em `booking-guards.js`). O skip veio do Set em memória `state.createKeys` (`server.js` ~1779–1783): o CREATE 08:15 gravou a mesma `idemKey`; o cancel ops 09:30 limpou a Trinks/local, **não** o Set da sessão. Mesmo slot de novo → `continue` com `createIdempotentSkip` **sem** `finalMessages` e **sem** barrar a copy 2-phase “Confirmo aqui”.

“Confirmo aqui” **não** casa `PREMATURE_CONFIRM_PATTERNS` (`confirmado` ≠ `Confirmo`). C3/story 2 não cobre este skip.

last4 evidência: `0007`. Sem PII. Live **não** é DoD. Se live: **outro slot**, não 03/09 10:30 André. Sem replay `0101`. Sem rsync. Sem Hostinger.

## IN / OUT

**IN**

- Ao cancelar (path WhatsApp 4b 2xx), dropar a `idemKey` correspondente de `state.createKeys`.
- `createKeys.has(idemKey)` **não** basta para skip: só skip se o snapshot ativo ainda tem o slot (`findDuplicateAppointment` encontra `scheduled`/`confirmed`).
- Se skip (duplicata ativa de verdade): nunca afirmar sucesso. Não deixar “Confirmo aqui o agendamento então” no outbound sem POST 2xx.
- Unit: CREATE → cancel → mesmo slot na mesma sessão → POST de novo (mock) **ou** recusa honesta; nunca “Confirmo aqui” sem 2xx.
- `findDuplicateAppointment` / `ACTIVE_STATUSES` intactos (já ignoram cancelled).

**OUT**

- Tratar o Set `createKeys` como fonte de verdade após cancel.
- Skip silencioso (`continue`) sem copy honesta e sem barrar 2-phase da Tess.
- rsync / Hostinger / git push / POST Trinks real.
- Replay CREATE `0101`. Live no slot 03/09 10:30 André.
- Refazer C1/C2/C3. Story 2 padrões pós-fail (não é o mesmo modo).
- Colar prompt TESS 46589. Migration nova.
- B2 cancel SKU (story 9) · B3 abort+booking (story 10) · B4 intent cancel (story 11).

## Acceptance Criteria

- [x] **AC1:** No path de cancel WhatsApp 4b, após `cancelBookingInTrinks` 2xx, o backend remove de `state.createKeys` a `idemKey` do slot cancelado (`createIdempotencyKey` com serviceId + professionalId + date + time do appointment). `[AUTO-DECISION]` drop no path 4b é cinto; o skip **não** pode depender só disso — cancel ops (`origin: agent_mutation_cancel`) não vê o Set da sessão.
- [x] **AC2:** Em `server.js` ~1779, `state.createKeys.has(idemKey)` **não** dispara skip sozinho. Skip só se `findDuplicateAppointment(existing, bookingData)` achar row **ativa** (`scheduled`/`confirmed`). Snapshot só `cancelled` / sem o slot → **não** `continue`; segue para `createBookingInTrinks` (mock 2xx no teste) ou recusa honesta de guarda já existente.
- [x] **AC3:** Se skip ainda ocorrer (duplicata ativa real): `createIdempotentSkip === true` **e** este turno **não** emitiu `booking.created` → outbound **não** contém “Confirmo aqui o agendamento então” / “Confirmo aqui”. Espelhar o bloco de cancel-fail (`server.js` ~2108–2112): 2-phase da Tess não afirma commit. Recusa ou silêncio honesto — nunca sucesso sem 2xx.
- [x] **AC4:** Unit classe `0007` 09:58: fixture CREATE mock 201 → marcar o row `cancelled` (simula ops 09:30) → mesmo `idemKey` ainda no Set → segundo CREATE do mesmo slot **chama** POST (spy) **ou** recusa honesta. **0** “Confirmo aqui” no outbound do segundo turno. **0** `booking.created` órfão (evento sem 2xx).
- [x] **AC5:** `findDuplicateAppointment` continua ignorando `cancelled`. Teste existente `booking-guards.test.js` (“ignora cancelado e slot diferente”) **PASS intacto**. Não alargar `ACTIVE_STATUSES`.
- [x] **AC6:** last4 `0007` só como rótulo/evidência. Sem PII. Sem POST/PATCH Trinks de rede. Live **não** fecha DoD. Se live depois do gate: **outro** slot, não `2026-09-03` 10:30 André. Sem replay `0101`. Sem rsync. Sem Hostinger.
- [x] **AC7:** C1/C2/C3 e `8397` PASS **não** regridem. `npm test` da fatia (guards + create skip/2-phase) passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2):** Condicionar o skip de `createKeys` ao snapshot ativo; dropar key no cancel 4b. `[Source: Orion B1 · server.js ~1779 · booking-guards.js findDuplicateAppointment]`
- [x] **T2 (AC3):** Quando `createIdempotentSkip` e sem `booking.created` neste turno, não anexar/deixar copy 2-phase de sucesso (“Confirmo aqui”). Espelho ~2108. `[Source: Orion B1 copy · server.js ~1887 · ~2108]`
- [x] **T3 (AC4, AC5, AC6, AC7):** Unit `0007`-class. Não tocá-lo `ACTIVE_STATUSES`. CodeRabbit pre-commit. Sem rede Trinks.

## Dev Notes

**Bug atual (skip só no Set)**

```1779:1784:backend/server.js
    const idemKey = createIdempotencyKey(bookingData);
    if (state.createKeys.has(idemKey)) {
      console.log(`[idempotency] create duplicado ignorado ${idemKey}`);
      createIdempotentSkip = true;
      continue;
    }
```

`continue` **sem** `finalMessages`. O bloco ~1887 só emite recusa se `!createIdempotentSkip`. Tess 2-phase (“Confirmo aqui”) permanece em `formatted.responses`.

**Snapshot já honesto**

```7:36:backend/lib/booking-guards.js
const ACTIVE_STATUSES = new Set(['scheduled', 'confirmed']);
function isDuplicateAppointment(row, booking) {
  if (!row || !ACTIVE_STATUSES.has(String(row.status || ''))) return false;
  // service_id + professional_id + scheduled_at ±60s
}
```

O `if (findDuplicateAppointment(...))` em ~1792 **já** não skiparia o `0007` 09:58. O Set em memória é que mente.

**Cancel ops não toca o Set**

- WhatsApp 4b: `cancelBookingInTrinks` (~830) PATCH + `markAppointmentStatus(..., 'cancelled')`. **Não** mexe `state.createKeys`.
- Ops 09:30: `origin: 'agent_mutation_cancel'` — fora da sessão WhatsApp. `[AUTO-DECISION]` não hookar Hostinger/ops; o skip consulta o snapshot.

**2-phase a espelhar (cancel fail)**

```2108:2112:backend/server.js
  let allBlocks = [...formatted.responses, ...finalMessages];
  if (cancelsToRun.length && cancelSuccessCount === 0) {
    allBlocks = finalMessages.length ? finalMessages : formatted.responses;
  }
```

Falta equivalente para `createIdempotentSkip && !bookingResult`.

**Sanitize**

- `PREMATURE_CONFIRM_PATTERNS` tem `confirmado`, não `Confirmo aqui`. Não refazer C3; ou estender sanitize **só** no modo skip-sem-2xx, ou trocar `allBlocks` como no cancel-fail.

**Constraints**

- last4: `0007`. Sem PII.
- Zero rsync. Zero Hostinger. Zero replay `0101`.
- Live seguinte ≠ 03/09 10:30 André.

**Fonte:** Orion B1 09:58 · `server.js` ~1779 · `booking-guards.js` ACTIVE_STATUSES · epic I1.

## File List

- `backend/lib/booking-guards.js` (modified — `shouldSkipCreateIdempotent`, `forgetCreateKeyForAppointment`, `decideCreateIdempotency`)
- `backend/lib/booking-parser.js` (modified — `selectOutboundBlocks`, `HONEST_CREATE_SKIP_COPY`)
- `backend/server.js` (modified — skip CREATE consulta snapshot; drop key no cancel 4b; outbound via `selectOutboundBlocks`)
- `backend/test/booking-guards.test.js` (modified — classe `0007` B1)
- `backend/test/cancel-sku.test.js` (created — skip sem 2xx não deixa “Confirmo aqui”)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex via Orion)

**Debug Log References**

_(n/a — unit, sem VPS)_

**Completion Notes List**

- Skip CREATE só com duplicata **ativa**. `createKeys.has` sozinho não `continue`.
- Cancel 4b 2xx chama `forgetCreateKeyForAppointment` (cinto). Cancel ops continua sem o Set — o skip lê o snapshot.
- `selectOutboundBlocks` no skip-sem-2xx troca a 2-phase (“Confirmo aqui”) por copy honesta.
- `ACTIVE_STATUSES` intacto. Sem rsync. Sem replay `0101`. Sem slot 03/09 10:30 André.

**File List**

- `backend/lib/booking-guards.js`
- `backend/lib/booking-parser.js`
- `backend/server.js`
- `backend/test/booking-guards.test.js`
- `backend/test/cancel-sku.test.js`

## Testing

- Unit: CREATE mock 201 + key no Set + row cancelled → segundo CREATE POST de novo; skip ativo real → sem “Confirmo aqui”; `findDuplicateAppointment` ignora cancelled (legado PASS).
- Fatia: `booking-guards.test.js` + teste novo do skip/2-phase.
- Sem Playwright. Sem live VPS. Sem Hostinger.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (idempotency create)
- Secondary: Integration (snapshot Trinks local + 2-phase outbound)
- Complexity: Medium (Set vs snapshot; over-strip vs I1)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I1 unit `0007`-class)

**Quality Gate Tasks**

- [x] Pre-Commit (@dev): `coderabbit review --agent --type uncommitted --dir backend`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic (deploy não é DoD até unit)

**CodeRabbit Focus Areas**

- Primary: skip só com duplicata ativa; nunca “Confirmo aqui” sem 2xx; drop key no cancel 4b.
- Secondary: não alargar `ACTIVE_STATUSES`; C3 legado intacto.

**Predict files:** `backend/server.js`, `backend/lib/booking-guards.js` (se helper), `backend/test/` da fatia create/idempotency.

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
- B1 verified: cancelled snapshot does not suppress CREATE; active duplicate remains idempotent; skip without CREATE commit cannot emit “Confirmo aqui”.
- No live Trinks calls, rsync, Hostinger, `0101` replay, or 03/09 10:30 André exercise.
- CodeRabbit CLI 0.6.1: `doctor` **9/9 PASS** and final review **0 findings**. The review used the free CLI allowance because the repo is not connected to a CodeRabbit organization.

**Gate decision:** Story 8 may be marked **Done**.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | B1 I1 skip+boca; 0007 09:58 |
| 2. Technical Implementation Guidance | PASS | ~1779 Set vs snapshot; ~2108 espelho |
| 3. Reference Effectiveness | PASS | Orion B1 + guards ACTIVE_STATUSES |
| 4. Self-Containment Assessment | PASS | ops cancel não vê Set; “Confirmo aqui” ≠ C3 |
| 5. Testing Guidance | PASS | CREATE→cancel→mesmo slot; 0 copy sem 2xx |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.4.0 | Re-gate 144/144 focused; 502/502 backend; CodeRabbit 0 findings. Added honest partial-cancel fallback regression. | @qa (Quinn) |
| 2026-09-03 | 0.3.0 | QA PASS (140/140 focused; 498/498 backend). Status: ready-for-review→Done. | @qa (Quinn) |
| 2026-09-03 | 0.2.0 | Implementado. Status: Ready→ready-for-review. Unit classe `0007`. | @dev (Orion) |
| 2026-09-03 | 0.1.0 | Created. B1 createKeys vs cancel. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] Skip consulta snapshot ativo; drop no 4b é extra (reason: cancel ops 09:30 não toca sessionState).*  
*[AUTO-DECISION] Não hookar Hostinger/agent_mutation_cancel (reason: spawn NÃO Hostinger).*  
*[AUTO-DECISION] Live ≠ DoD; se live, outro slot ≠ 03/09 10:30 André (reason: spawn + Orion §pedido 3).*  
*[AUTO-DECISION] elicit pulada (YOLO + SOT explícito).*  
*[AUTO-DECISION] ClickUp skip; code-intel skip; gotchas.json ausente.*
