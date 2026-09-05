# Story 10: Recorrência — o que a IA vê vs o painel

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Discovery + fatia se o SOT autorizar  
**Status:** Discovery-STOP  
**Executor:** @data-engineer + @architect → @dev **só** com contrato de cancel — **STOP, sem T3**  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** Victor — no painel Trinks série confirmada aparece e cancela diferente

## Story

**As a** operação,  
**I want** saber se uma ocorrência recorrente ocupa slot, se cancela uma ou a série, e o que a Tess já faz,  
**so that** não cancelamos o mês inteiro nem oferecemos hora de um recorrente.

## IN

- Investigação read-only: raw, `TipoDeEvento` 11/12, GET lista vs GET detalhe, campos de série se existirem.
- Relatório last4 / ids Trinks de agendamento — **sem** E.164, sem nome de cliente no doc.
- Dex **não** emite PATCH cancel de série neste turno a menos que Aria escreva o contrato (uma ocorrência vs série).
- Se a recorrência já ocupa como `confirmed` isolado, anotar: oferta OK; furo só no cancel.

## OUT

- Inventar `serieId`. Cancelar série no escuro. POST Trinks de teste.

## Acceptance Criteria

- [x] **AC1:** Dara: tabela ocorrência vs série (o que tem no raw / na API). → [2026-09-04-dara-chao-10-recorrencia.md](../analysis/2026-09-04-dara-chao-10-recorrencia.md)
- [x] **AC2:** Aria: a Tess hoje ocupa? **sim** (confirmed isolado; oferta já subtrai). Cancela o quê? **unknown** (PATCH no id; cascata não medida). → **STOP.** [2026-09-04-aria-chao-10-recorrencia-veredito.md](../analysis/2026-09-04-aria-chao-10-recorrencia-veredito.md)
- [x] **AC3:** **STOP** — story **não** implementa cancel. Sem contrato de uma ocorrência. Linha `OPERATIONAL_NOTES` / prompt «recorrente = HANDOFF» = **OUT**.
- [x] **AC4:** Quinn no que Dex tocar (pode ser só docs). → [2026-09-04-chao-10-recorrencia.yml](../qa/gates/2026-09-04-chao-10-recorrencia.yml)

## Tasks

- [x] T1: Dara dump read-only  
- [x] T2: Aria veredito GO/STOP → **STOP**  
- [ ] T3: Dex só se GO — **unchecked (STOP; sem fatia)**. Contrato 2026-09-05: `docs/analysis/2026-09-05-aria-chao-10-contrato-cancel.md` (série = HANDOFF; ocorrência = PATCH 1 id; sem `serieId`).

## File List

- `docs/analysis/2026-09-04-orion-adendo-pezinho-ausencia-recorrencia.md`
- `docs/analysis/2026-09-04-dara-chao-10-recorrencia.md`
- `docs/analysis/2026-09-04-aria-chao-10-recorrencia-veredito.md`
- `docs/qa/gates/2026-09-04-chao-10-recorrencia.yml`

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: docs-only-on-a9d5af8

### Code Quality Assessment

Docs-only Discovery-STOP. AC1–AC3 fechados. T3 unchecked. Sem JS de produção nesta story. Path `buildCancelPayload` / `cancelBookingInTrinks` intocado (hunk de `server.js` = pezinho chão 8). PII last4-only nos três docs. Sem `serieId` inventido. Sem língua que autorize Dex a PATCH cancel.

### Refactoring Performed

Nenhum. Anti-self-review: Quinn só gateou docs.

### Compliance Check

- Coding Standards: ✓ sem fatia Dex; STOP honesto
- Project Structure: ✓ Dara + Aria + adendo Orion; gate em `docs/qa/gates/`
- Testing Strategy: ✓ N/A docs-only (sem T3)
- All ACs Met: ✓ AC1–AC4; T3 permanece aberto-por-STOP (não GO)

### Improvements Checklist

- [x] Hunt PII / last4 / sem E.164 (Quinn)
- [x] Hunt sem `serieId` inventido
- [x] Hunt sem autorização Dex cancel
- [x] Hunt cancel path backend 0 hunk desta story
- [ ] T3: Dex só se GO — **não** nesta story

### Security Review

last4-class. Sem E.164. Sem nome de cliente. `authorizes_tess_patch: false`. `authorizes_dex_cancel: false`. Kill switch `global=false`.

### Files Modified During Review

Nenhum arquivo de aplicação. Artefacto QA: `docs/qa/gates/2026-09-04-chao-10-recorrencia.yml`. AC4 marcado. T3 unchecked.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-10-recorrencia.yml
`blocks_publish`: vazio. Publish execution: **false**. Dex cancel still forbidden.

### Lifecycle Transition

Não aplicada. Status permanece **Discovery-STOP** (não InReview). `[AUTO-DECISION]` qa-gate.md post-gate exige InReview; spawn: não reabrir STOP como GO.
