# Story 8: Pezinho é cortesia — Tess resolve sozinha

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Ready-for-Dex  
**Executor:** @architect → @dev · sync memories com ACK (este adendo)  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** smoke `0007` #2 · time salão 04/09 (não agenda; intervalo; gratuito)

## Story

**As a** cliente que pede pezinho do cabelo,  
**I want** a Tess dizer que posso passar sem marcar e que é de graça no intervalo,  
**so that** ela não me joga na recepção nem inventa um SKU.

## IN

- Regra de chão (salão): pezinho **não precisa agendar**; feito no intervalo; **gratuito**.
- Continua ≠ pedicure e ≠ Cabelo e Barba.
- Sem `[HANDOFF_HUMAN motivo=orcamento_referencia]` neste pedido.
- Sem `[BOOKING_CREATE]`. Sem inventar SKU Trinks.
- Prompt local + KB 4 arquivos + `PEZINHO_DISAMBIGUA`. Victor cola o prompt (Orion não cola 46589).
- PATCH 39496 dos 4 arquivos depois do gate, neste adendo.

## OUT

- SKU novo no Trinks. Handoff “porque não tem cadastro”. Oferecer slot de corte no lugar.

## Acceptance Criteria

- [x] **AC1:** Aria: copy + onde corta handoff/slots/FILTER `cort` no turno só-pezinho. Tetos: [2026-09-04-aria-chao-8-9-tetos.md](../analysis/2026-09-04-aria-chao-8-9-tetos.md). Ready-for-Dex **yes**.
- [x] **AC2:** Fixture “Posso passar aí pra arrumar o pezinho do cabelo?” → fala cortesia/intervalo/grátis; zero handoff; zero CREATE.
- [x] **AC3:** “pé e mão” continua unha. “fazer o pé” continua pedicure.
- [x] **AC4:** Quinn. Sem WhatsApp até story 11.

## Tasks

- [x] T1: tetos Aria — [2026-09-04-aria-chao-8-9-tetos.md](../analysis/2026-09-04-aria-chao-8-9-tetos.md)
- [x] T2: Dex (prompt file + KB + assembler/parser)  
- [x] T3: Quinn  
- [x] T4: Victor cola v3.2.4 · Orion sync 4 memories — `docs/intake/registro-chao8-kb-sync-2026-09-04.md`  

## File List

- `docs/analysis/2026-09-04-orion-adendo-pezinho-ausencia-recorrencia.md`
- `docs/analysis/2026-09-04-aria-chao-8-9-tetos.md`
- `backend/lib/booking-parser.js` — `isSoloPezinhoTurn`, `suppressSoloPezinhoTags`, FILTER só-pezinho → `[]`
- `backend/lib/tess-context-assembler.js` — `PEZINHO_DISAMBIGUA`, skip slots/catalog só-pezinho
- `backend/server.js` — `OPERATIONAL_NOTES`, `suppressSoloPezinhoTags` pós-strip
- `docs/prompts/tess-conversa-v3-clean.md` — v3.2.4
- `docs/prompts/archive/tess-conversa-46589-v3.2.3-2026-09-04.md`
- `docs/prompts/CHANGELOG-46589.md`, `docs/prompts/README-46589.md`
- `data/kb/conversa-v2/sinonimos-servicos.md`, `regras-comerciais.md`, `faq-servicos.md`, `fichas-tecnicas-servicos.md`
- `backend/test/booking-parser.test.js`, `backend/test/tess-context-assembler.test.js`

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-a9d5af8

### Code Quality Assessment

Só-pezinho corta FILTER `cort` (`[]`, nunca null), skip de snapshot/slots, e strip de CREATE + handoff `orcamento_referencia`. C5/C6 unha e I1 intactos. Prompt local v3.2.4 P1–P7; KB 4 ficheiros sem row de preço. Focused hunt 236/236 (Quinn rerun). T4 (cola + sync 39496) fica aberto.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gateou.

### Compliance Check

- Coding Standards: ✓ `isSoloPezinhoTurn` / `suppressSoloPezinhoTags` nomeados no SOT
- Project Structure: ✓ parser + assembler + OPERATIONAL_NOTES; padroes/info/laser fora
- Testing Strategy: ✓ P8-1..P8-7 / C3–C6 / A8-1 / I1
- All ACs Met: ✓ AC4 neste gate; T4 operacional fica aberto

### Improvements Checklist

- [x] Hunts 1–7 + 10 (Quinn)
- [x] Rerun focused 6 ficheiros — 236/236
- [x] T4: Victor cola v3.2.4 + sync 39496 (2026-09-04)
- [ ] Opcional: S9-3 injectar cancelled (TEST-01, story 9)

### Security Review

Sem SKU inventido. Sem E.164. Sem POST Trinks. `authorizes_tess_patch: false`. `authorizes_prompt_paste: false`.

### Files Modified During Review

Nenhum arquivo de aplicação. Artefatos QA: `docs/qa/gates/2026-09-04-chao-8-9-pezinho-ausencia.yml`, `docs/handoffs/2026-09-04-quinn-gate-chao-8-9.md`. T3 marcado. T4 aberto.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-8-9-pezinho-ausencia.yml
`blocks_publish`: vazio. Publish execution: **false**. Sem WhatsApp. Sem TESS PATCH.

### Lifecycle Transition

Não aplicada. Status permanece Ready-for-Dex (não InReview). T4 ainda aberto. `[AUTO-DECISION]` qa-gate.md post-gate exige InReview.
