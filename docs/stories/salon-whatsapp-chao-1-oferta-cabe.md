# Story 1: A Tess só oferece horário que cabe na duração

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Draft  
**Executor:** @architect (tetos) → @dev  
**Quality gate:** @qa  
**Story points:** 8  
**Fonte:** PARK-SLOTS · fatia slots `0007` Fefe (`durationMin=0` com >3 SKUs) · Dex `resolveOfferDurationMin`

## Story

**As a** cliente que ouve um horário,  
**I want** a grade que a Tess vê já sem inícios que não cabem,  
**so that** eu não confirmo um furo e levo recusa de “janela 30 min”.

## Contexto

`durationMin` **já está live** (`a08f23b`). Mira `4749`/`2874` são anteriores. O buraco documentado depois: catálogo gordo → `resolveOfferDurationMin` devolve 0 → a Tess volta a ver 14:00 com 30 min contínuos. Sem SKU, o bloco compacto ainda fala ocupação manhã/tarde e o modelo inventa relógio.

## IN

- Medir `guard.blocked` reason `janela continua` / `inicio nao esta na grade` **depois** de `a08f23b` (não os fios de 01–03/09).
- Quando a última fala tem duração ou 1 SKU (ex. maquiagem 120), **não** zerar o filtro porque o histórico inchou o catálogo.
- Se ninguém couber: linha “sem janela contínua de X min” — sem relógio inventado.
- Unit no assembler / `startsFittingDuration`. Sem prompt paste. Sem smoke `0007`.

## OUT

- Republicar o wiring `durationMin` que já existe.
- Stale <45 min (story 2). Pairing `9800` (já live). Replay André 10:30 / CREATE 9800.
- Subir timeout Nginx.

## Acceptance Criteria

- [x] **AC1:** Aria tetos: o que ainda fura com durationMin live. Sem teto, sem código. → `docs/analysis/2026-09-04-aria-chao-1-2-tetos.md`
- [x] **AC2:** Fixture classe `0007` Fefe (histórico corte + fala maquiagem, >3 SKUs) → filtro usa duração da **fala atual**, não 0.
- [x] **AC3:** Sem start que caiba → texto sem relógio inventado.
- [x] **AC4:** `durationMin` 1–3 SKUs intacto. I1/I2 unit intactos.
- [x] **AC5:** Zero POST Trinks, zero WhatsApp, zero OPEN.

## Tasks

- [x] T1: tetos Aria → `docs/analysis/2026-09-04-aria-chao-1-2-tetos.md`  
- [x] T2: Dex no assembler / `resolveOfferDurationMin`  
- [x] T3: testes + Quinn

## File List

- `backend/lib/tess-context-slots.js` — `extractSpeechDurationMin`, `skuDurationFrom`, cascade `resolveOfferDurationMin`, occupancy com `startsFittingDuration`, `subtractOccupiedSlotStarts`, helpers `snapshot.offer`
- `backend/lib/tess-context-assembler.js` — `durationMin: resolveOfferDurationMin(svcPayload.data, { messageText })`
- `backend/test/tess-context-slots.test.js` — S1-1..S1-11, F2/F3, E1/E2
- `backend/test/tess-context-assembler.test.js` — A1, A2, A5

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-7482d3d

### Code Quality Assessment

Dex implementou o residual Aria D1–D3 sem republicar o wiring live. Cascade de duração (fala + família homogénea) e occupancy com `startsFittingDuration` batem o SOT. 69/69 focused tests. Stories em Draft — sem transição Status.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gate.

### Compliance Check

- Coding Standards: ✓
- Project Structure: ✓
- Testing Strategy: ✓ S1-1..S1-11, A1/A2/A5 + invariantes live
- All ACs Met: ✓ AC1–AC5

### Improvements Checklist

- [x] Hunts Aria 1–7 verdes (Quinn)
- [ ] TEST-01: E2 unit não prova emit conjunto `snapshot.stale` + `snapshot.offer` (low; código stale intacto)
- [ ] MNT-01: `DURATION_HOUR_PATTERNS` duplica `isDurationHourToken` (low; stems iguais)

### Security Review

SELECT novo sem telefone. Testes da fatia sem E.164 novo. Sem POST Trinks / WhatsApp / OPEN.

### Performance Considerations

Sem terceiro GET. Worker 1440 intocado.

### Files Modified During Review

Nenhum código de aplicação. Gate + handoff + ACs/T3 desta story.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-1-2-oferta-snapshot.yml

### Lifecycle Transition

Não aplicada. Status permanece Draft (esperado InReview). [AUTO-DECISION]
