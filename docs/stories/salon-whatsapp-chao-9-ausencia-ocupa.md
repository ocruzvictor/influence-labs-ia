# Story 9: Ausência trava a oferta

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Ready-for-Dex  
**Executor:** @architect → @dev  
**Quality gate:** @qa  
**Story points:** 8  
**Fonte:** smoke `0007` #8 · profissionais usam Ausência para bloquear agenda

## Story

**As a** operação,  
**I want** um início que está Ausência no Trinks **fora** da lista que a Tess oferece,  
**so that** o barbeiro não aparece livre quando ele travou o horário.

## IN

- Enxergar Ausência (e equivalentes que ocupam a grade: almoço/bloqueio se forem o mesmo objeto).
- Subtrair da oferta **ou** reler `GET /agendamentos/profissionais/{data}` para **todos** os dias que entram no bloco HORARIOS (não só hoje).
- `subtractOccupied` deixa de ser só `scheduled`+`confirmed` se Ausência viver em `trinks_appointments`.
- Smoke #8: sáb 14h / ter 16h30 / sáb 17h Tiago não voltam se ainda forem Ausência.
- Sem POST/PATCH Trinks.

## OUT

- Subir worker para 1h no escuro. Inventar status id. Mexer Nginx.

## Acceptance Criteria

- [x] **AC1:** Aria: fonte da Ausência (lista / webhook / só slots) + inteiros de refresh. Tetos: [2026-09-04-aria-chao-8-9-tetos.md](../analysis/2026-09-04-aria-chao-8-9-tetos.md). SOT = `horariosVagos`. Ready-for-Dex **yes**.
- [x] **AC2:** Fixture: start dentro de janela Ausência some da oferta; `subtracted_occupied` ≥ 1 **ou** slot `available=false` após refresh.
- [x] **AC3:** Cancelado continua fora. Confirmado continua a ocupar.
- [x] **AC4:** Quinn. Sem WhatsApp.

## Tasks

- [x] T1: tetos Aria (pode pedir GET read-only a Dara) — [2026-09-04-aria-chao-8-9-tetos.md](../analysis/2026-09-04-aria-chao-8-9-tetos.md) §5
- [x] T2: Dex  
- [x] T3: Quinn  

## File List

- `docs/analysis/2026-09-04-orion-adendo-pezinho-ausencia-recorrencia.md`
- `docs/analysis/2026-09-04-aria-chao-8-9-tetos.md`
- `backend/lib/tess-context-assembler.js` — `refreshDates = unique(slotDates)` (D9.2)
- `backend/test/tess-context-assembler.test.js` — A9-1..A9-2, A5/A9-3 snapshot expects
- `backend/test/trinks-local-store.test.js` — S9-1
- `backend/test/tess-context-slots.test.js` — S9-2, S9-3
- `backend/test/trinks-sync.test.js` — S9-5

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-a9d5af8

### Code Quality Assessment

`refreshDates = unique(slotDates)`. A9-1 snapshot === |slotDates| (4), não 1–2. A9-2 explicitDateOnly = 1. `ensureSlotSnapshot` / 45 min / `STATUS_BY_ID` / subtract `scheduled`+`confirmed` / worker 1440 sem diff. S9-1 tira 14:00. S9-2 confirmed ocupa. Cancelled fora via SQL. Focused hunt 236/236.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gateou.

### Compliance Check

- Coding Standards: ✓ D9.2 no assembler; freeze D9.3
- Project Structure: ✓ um sítio (`refreshDates`); store/mapping/worker intocados
- Testing Strategy: ✓ A9-1/A9-2/A5 / S9-1/S9-2/S9-5
- All ACs Met: ✓ AC4 neste gate

### Improvements Checklist

- [x] Hunts 8–10 (Quinn)
- [x] Rerun focused 6 ficheiros — 236/236
- [ ] Opcional: S9-3 injectar cancelled (TEST-01)

### Security Review

Sem status.id inventido. Sem persistir Ausência. Sem POST Trinks. last4-class.

### Files Modified During Review

Nenhum arquivo de aplicação. Artefatos QA: `docs/qa/gates/2026-09-04-chao-8-9-pezinho-ausencia.yml`, `docs/handoffs/2026-09-04-quinn-gate-chao-8-9.md`. T3 marcado.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-8-9-pezinho-ausencia.yml
`blocks_publish`: vazio. Publish execution: **false**. Sem WhatsApp.

### Lifecycle Transition

Não aplicada. Status permanece Ready-for-Dex (não InReview). `[AUTO-DECISION]` qa-gate.md post-gate exige InReview.
