# Story: I3 contíguo / recheck oferta / `markSlotWindow` / fail-closed snapshot vazio

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 8  
**Pode executar agora:** ✅ SIM — paralelo a #1 · Dex no repo  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-02-aria-rca-correcao.md](../handoffs/2026-09-02-aria-rca-correcao.md) (P1.3 / 1.7 / 1.8 / 1.9)  
**Peers:** [Mira floor](../handoffs/2026-09-02-mira-floor-audit.md) · [Quinn](../handoffs/2026-09-02-quinn-invariants-verdict.md)

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

**As a** cliente que ouve um horário (ou “me passaram 14h”),  
**I want** a janela contínua, o recheck contra appointment e o snapshot vazio falharem fechado,  
**so that** o relógio falado é o início real da snapshot (I3) — sem gravar 14h `4749` sem recheck e sem oferecer 9h Fefe já ocupada (`9605`).

## Contexto

P1.3 / 1.7 / 1.8 / 1.9. **Paralelo a #1** (TipoId). Não depende de #2.

| last4 | ts | sintoma I3 |
|-------|-----|------------|
| `4749` | 21:19Z | “Me passaram as 14h” Tiago; guard `janela continua 30min < duracao 60min`; snapshot 17:00Z+17:30Z `available=true`, `ends_at` **null** |
| `9605` | 21:43Z | Oferta 9h Fefe já com manicure de **outro** cliente; 3× `guard.blocked` `inicio nao esta na grade livre` |
| (C2 ok) | `5668` | Overlay **não** é P0 — C2 já marca o próximo fio. I3 desta story = oferta sem recheck + cancel/PUT que só marca o start |

`contiguousMinutesFrom` (`slot-windows.js` ~44) só conta starts adjacentes no `startSet`. Se `ends_at` null faz o snapshot gravar **um** start de 30 e não o vizinho, 60min recusa. Mira: dois átomos 30 adjacentes **devem** somar 60.

`bookingFitsSlotWindow` (~105): snapshot vazio → `{ ok: true, reason: 'sem snapshot de slots — janela nao validada' }` — **fail-open**. P1.9 = fail-closed.

Cancel/PUT hoje chamam `markSlotAvailable` (um `starts_at`), não `markSlotWindowAvailable` (já usado no webhook C2). Aria P1.8: `server.js` cancel ~837 / PUT ~893.

**Não** gravar 14h `4749` sem recheck. **Não** POST 13:30 `2513`.

## IN / OUT

**IN**

- Contíguo `4749`: dois átomos 30min com `ends_at` null, adjacentes, somam 60 se a grade os lista.
- Recheck oferta vs appointment ativo (`9605` 9h Fefe ocupada): oferta ∩ appointment = 0.
- `markSlotWindowAvailable` em cancel **e** PUT (duração, não só o start).
- Fail-closed se snapshot vazio: `bookingFitsSlotWindow` **não** `ok: true` sem starts.
- Unit I3. C1/C2/C3 / `8397` intactos.

**OUT**

- Overlay appointments como P0 (C2 `5668` ok).
- P1.5 `8134` `dado_indisponivel` / P1.6 HABILITACAO `7163`.
- Gravar 14h `4749` sem recheck; POST 13:30 `2513`.
- Rollback FULL. rsync / git push / POST Trinks real.
- Prompt I.1.10 (story 5 OUT). TipoId (story 1, paralelo).

## Acceptance Criteria

- [x] **AC1 (P1.3):** Fixture `4749`-class: starts `17:00Z` + `17:30Z` (`ends_at` null), grain 30, duração 60 → `contiguousMinutesFrom` / `bookingFitsSlotWindow` no 17:00Z = **60** (`ok: true`) **ou**, se 14:00 BRT **não** está na grade, recusa explícita por “inicio nao esta na grade” — **não** `30min < 60min` quando os dois átomos adjacentes existem. `[Source: Aria P1.3 · Mira 4749]`
- [x] **AC2 (P1.7):** Recheck: slot ofertado que já tem appointment ativo (outro cliente, mesmo prof+start) **não** passa no guard. Classe `9605` 9h Fefe ocupada → `ok: false` / `guard.blocked` **antes** de afirmar. Interseção oferta ∩ appointment ativo = 0 no unit. `[Source: Aria P1.7 · Decisão 6]`
- [x] **AC3 (P1.8):** Cancel 2xx e PUT 2xx passam a chamar `markSlotWindowAvailable(prof, start, durationMin, available)` (liberar janela antiga / ocupar nova), não só `markSlotAvailable` no start. Webhook C2 (`trinks-webhook-processor.js`) **não** desfazer. `[Source: Aria P1.8 · server.js ~837 · ~893 · trinks-local-store.js ~295]`
- [x] **AC4 (P1.9):** `bookingFitsSlotWindow` com `starts` vazio / `[]` → `{ ok: false, ... }` (fail-closed). Remover o `ok: true` de “sem snapshot de slots — janela nao validada”. CREATE sem grade = recusa honesta, não POST. `[Source: Aria P1.9 · slot-windows.js ~105]`
- [x] **AC5:** Teste legado que espera fail-open (`slot-windows.test.js` ~54 `contiguousMinutes === null`) **atualizado** para fail-closed. Documentar a inversão no Completion Notes.
- [x] **AC6:** Zero POST/PUT/PATCH Trinks de rede. Não gravar 14h `4749`. Não POST 13:30 `2513`. Sem migration.
- [x] **AC7:** C2 `markSlotWindow` do webhook + C1/C3 + `8397` PASS intactos. `npm test` fatias `slot-windows` + `booking-guards` + `trinks-local-store` (+ server cancel/PUT se tocado) passa.
- [x] **AC8:** Soma inventada 10h+11h=90 **não** é o bug (Aria descarte). Só átomos adjacentes no grain. Buraco real de 30 continua recusando 60.

## Tasks / Subtasks

- [x] **T1 (AC1, AC8):** Ajustar `contiguousMinutesFrom` / annotate se `ends_at` null impedir o 2º start. Teste `4749` 17:00Z+17:30Z → 60. `[Source: slot-windows.js · Mira 4749]`
- [x] **T2 (AC2):** Recheck oferta vs `trinks_appointments` (ou helper já usado no guard). `9605`-class: Fefe 09:00 ocupada → block. `[Source: Aria P1.7]`
- [x] **T3 (AC3):** Trocar `markSlotAvailable` por `markSlotWindowAvailable` em `cancelBookingInTrinks` e `rescheduleBookingInTrinks` (precisa duração do appointment atual / novo). `[Source: server.js ~832–906]`
- [x] **T4 (AC4, AC5):** Fail-closed em `bookingFitsSlotWindow`. Atualizar `slot-windows.test.js`.
- [x] **T5 (AC6, AC7):** Sem rede. Reexecutar fatias. CodeRabbit.

## Dev Notes

**Fail-open atual (inverter)**

```105:107:backend/lib/slot-windows.js
  if (!startsMs.length) {
    return { ok: true, reason: 'sem snapshot de slots — janela nao validada', contiguousMinutes: null };
  }
```

**Contíguo**

```44:54:backend/lib/slot-windows.js
function contiguousMinutesFrom(startMs, startSet, grainMin) {
  // conta starts adjacentes no set — se só um start de 30 existe no set, devolve 30
}
```

Se o store grava `ends_at` null e **omite** o start 17:30, o set não tem o vizinho. Dex: garantir que átomos adjacentes `available=true` entrem no set **ou** que `ends_at` null + duração implícita grain some o vizinho — **sem** inventar 90min de 10h+11h.

**markSlot**

- `markSlotAvailable` = um `starts_at` (`trinks-local-store.js` ~280).
- `markSlotWindowAvailable` = todos os starts em `[start, start+duration)` (~295). Já usado no webhook. Cancel/PUT ainda usam o primeiro.

**Recheck**

- Guard já tem `inicio nao esta na grade livre` (`9605` 3×). P1.7 = oferta verbal / “me passaram” não é hold: cruzar appointment ativo no **mesmo** prof+start antes de CREATE. Sem overlay P0.

**Constraints**

- last4: `4749` `9605`. Sem PII.
- Paralelo a #1. Não bloquear TipoId.

**Fonte:** Aria §4 P1.3/1.7/1.8/1.9 · Mira `4749` `9605` · Quinn I3 → Floor · epic IN P1 · Decisão 6.

## File List

- `backend/lib/slot-windows.js` (modified — fail-closed P1.9)
- `backend/lib/booking-guards.js` (modified — findActiveAppointmentConflict, pickCreateGuard ocupado)
- `backend/lib/trinks-local-store.js` (modified — listAppointmentsByProfessional)
- `backend/server.js` (modified — recheck 9605; markSlotWindow cancel/PUT)
- `backend/test/slot-windows.test.js` (modified — fail-closed + 4749)
- `backend/test/booking-guards.test.js` (modified — 9605 recheck)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex)

**Debug Log References**

_(n/a)_

**Completion Notes List**

- Fail-closed P1.9: snapshot vazio → `ok: false` (inversão do teste legado ~L51).
- Contíguo 4749: teste 17:00Z+17:30Z → 60min; átomo único → recusa 30<60.
- Recheck 9605: `findActiveAppointmentConflict` + guard `ocupado` antes do POST.
- Cancel/PUT: `markSlotWindowAvailable` com duração; webhook C2 intacto.

**File List**

- `backend/lib/slot-windows.js`
- `backend/lib/booking-guards.js`
- `backend/lib/trinks-local-store.js`
- `backend/server.js`
- `backend/test/slot-windows.test.js`
- `backend/test/booking-guards.test.js`

## Testing

- Unit: 17:00Z+17:30Z → 60; 30 sozinho → recusa 60; snapshot `[]` → `ok: false`; `9605` ocupado → block; cancel/PUT chamam `markSlotWindowAvailable`; C2 webhook intacto.
- Fatias: `backend/test/slot-windows.test.js`, `booking-guards.test.js`, `trinks-local-store.test.js`.
- Sem gravar 14h. Sem rede.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (janela / guard)
- Secondary: Database (slots snapshot, sem migration)
- Complexity: High (fail-closed pode bloquear CREATE se GET cair)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I3 unit), @architect (fail-closed trade-off)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic

**CodeRabbit Focus Areas**

- Primary: contíguo sem soma inventada; fail-closed; markSlotWindow em cancel/PUT.
- Secondary: não desfazer C2 webhook; sem overlay P0.

**Predict files:** `backend/lib/slot-windows.js`, `backend/lib/booking-guards.js`, `backend/server.js`, `backend/lib/trinks-local-store.js`, testes.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## QA Results

### Review Date: 2026-09-03

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:slot-windows.js@b1c364da,booking-guards.js@45dea11d,trinks-local-store.js@d8a6abe5,server.js@bd42a9b5,slot-windows.test.js@0e5eaa1c,booking-guards.test.js@65767144,HEAD:8b40465

### Code Quality Assessment

I3 em unit. Contíguo 4749: 17:00Z+17:30Z → 60min; átomo 30 sozinho recusa 60. Fail-closed P1.9: snapshot `[]` → `ok: false`. Recheck 9605: `findActiveAppointmentConflict` + `pickCreateGuard` `ocupado` bloqueia antes do POST. Cancel/PUT chamam `markSlotWindowAvailable`. Webhook C2 intacto. Fatia P1+store/webhook 98/98.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ fail-closed explícito; ocupado no pickCreateGuard
- Project Structure: ✓ slot-windows + guards + local-store + server
- Testing Strategy: ✓ 4749 / 9605 / [] / markSlotWindow; C2 webhook PASS
- All ACs Met: ✓ AC1–AC8

### Improvements Checklist

- [x] Contíguo 60; fail-closed; recheck ocupado; markSlotWindow cancel/PUT
- [x] C2 webhook + 8397 / C1/C3 não regressaram na fatia
- [ ] Opcional: unit de cancel/PUT mockando markSlotWindowAvailable

### Security Review

Zero POST/PUT/PATCH Trinks de rede. Sem migration. Sem PII.

### Performance Considerations

1 query de appointments no dia do CREATE; fail-closed evita POST cego.

### Files Modified During Review

Nenhum arquivo de aplicação. Gate: `docs/qa/gates/tess-commit.7-i3-contiguo-recheck.yml`

### Gate Status

Gate: PASS → docs/qa/gates/tess-commit.7-i3-contiguo-recheck.yml

### Lifecycle Transition

PASS: ready-for-review (≡ InReview) → Done
(QA applies this transition in Status and Change Log before handoff.)

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | I3; ∥ #1 |
| 2. Technical Implementation Guidance | PASS | 4 arquivos + fail-closed |
| 3. Reference Effectiveness | PASS | Aria P1.3–1.9 + Mira |
| 4. Self-Containment Assessment | PASS | 4749/9605 no AC |
| 5. Testing Guidance | PASS | inversão teste fail-open |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.2.1 | QA Gate PASS — Status: InReview → Done | @qa |
| 2026-09-03 | 0.2.0 | Development complete — I3 contíguo/recheck/fail-closed. Status: Ready → ready-for-review | @dev |
| 2026-09-03 | 0.1.0 | Created. I3 contíguo/recheck/fail-closed. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] Fail-closed inverte teste legado ~54 (reason: Aria P1.9 explícito).*  
*[AUTO-DECISION] elicit pulada (YOLO).*
