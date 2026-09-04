# Story 2: Foto da agenda não oferece vaga que já foi embora

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Draft  
**Executor:** @architect → @dev · SLO @data-engineer  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** PV-P2-2 · OP012 · I3 · fatia `9cb5834` (refresh ≥45 min)

## Story

**As a** cliente que escolhe um horário que a Tess acabou de listar,  
**I want** essa vaga ainda existir na Trinks,  
**so that** ninguém “pegou no meio” e a confirmação não vira conflito.

## Contexto

`9cb5834` já relê hoje+data se a snapshot daquela data tem ≥45 min. O `0007` Fefe 12h30 falhou porque o aviso existia e o refresh **só** rodava com >24h. Isso foi cortado. O que resta: corrida **dentro** dos 45 min; worker de slots ainda pode ser 24h; não há SLO/CLI de idade (OP012).

Recheck no commit (story commit-7) já recusa ocupado. A dor é **oferecer** o morto.

## IN

- Aria: o que 45 min ainda deixa passar (corrida, worker, data pedida vs hoje).
- CLI/SLO de idade (OP012) ou evento quando oferta usa snapshot acima do limiar.
- Sem reler 10 dias. Sem mudar `TRINKS_RECONCILE_INTERVAL_MIN` sem ACK.
- Sem smoke `0007`.

## OUT

- Overlay appointments (já live). durationMin (story 1). CRM. POST Trinks de teste.

## Acceptance Criteria

- [x] **AC1:** Tetos Aria do residual pós-`9cb5834`. → `docs/analysis/2026-09-04-aria-chao-1-2-tetos.md`
- [x] **AC2:** Oferta não lista start que o refresh/recheck já sabe ocupado; idade visível no contexto ou evento.
- [x] **AC3:** Máx. 2 GET Trinks/turno no caminho velho (contrato da fatia) intacto.
- [x] **AC4:** Unit + Quinn. Sem WhatsApp, sem OPEN.

## Tasks

- [x] T1: tetos → `docs/analysis/2026-09-04-aria-chao-1-2-tetos.md`  
- [x] T2: Dex / Dara no corte acordado  
- [x] T3: Quinn

## File List

- `backend/lib/trinks-local-store.js` — `listActiveAppointmentWindowsForDate`
- `backend/server.js` — `fetchSlotsGrouped` subtract local appointments; `snapshot.offer` event; `ensureSlotSnapshot` returns refreshed flag
- `backend/lib/tess-context-slots.js` — `subtractOccupiedSlotStarts`, `buildSnapshotOfferEventPayload`
- `backend/test/trinks-local-store.test.js` — F1
- `backend/test/tess-context-slots.test.js` — F2, F3, E1, E2

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-7482d3d

### Code Quality Assessment

Dex implementou D4–D6: subtract local 0 GET, `snapshot.offer` sem apertar 45, CLI OP012 intocada. F1/F2/F3/E1 verdes; `isCompatible` 90d e snapshot≤2 intactos. Stories em Draft — sem transição Status.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gate.

### Compliance Check

- Coding Standards: ✓
- Project Structure: ✓
- Testing Strategy: ✓ F1–F3, E1/E2 + invariantes live
- All ACs Met: ✓ AC1–AC4

### Improvements Checklist

- [x] Hunts Aria 1–7 verdes (Quinn)
- [ ] TEST-01: E2 unit não prova emit conjunto stale+offer (low)
- [ ] MNT-01: padrões de duração duplicados (low)

### Security Review

`listActiveAppointmentWindowsForDate` sem coluna de telefone. Sem GET extra Trinks. Sem WhatsApp / OPEN.

### Performance Considerations

Subtract é Postgres local. Máx. 2 GET do caminho velho intacto.

### Files Modified During Review

Nenhum código de aplicação. Gate + handoff + ACs/T3 desta story.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-1-2-oferta-snapshot.yml

### Lifecycle Transition

Não aplicada. Status permanece Draft (esperado InReview). [AUTO-DECISION]
