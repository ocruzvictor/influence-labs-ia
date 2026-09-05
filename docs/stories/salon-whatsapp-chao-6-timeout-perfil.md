# Story 6: Timeout por perfil, não 25s para tudo

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Done · live `a9d5af8` · `duration_ms` **persistido** no payload de `tess.turn` (código; p95 AC3 depois de ≥1 dia info-open/`0007`). Sem novo PILOT. Sem apertar BOOKING abaixo do p95.  
**Executor:** @architect → @dev  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** PV-P1-5 · G-P10 · story commit-12 (CANCEL lean ~7s / FULL ~12s) · **despausa**  
**SOT tetos:** [2026-09-04-aria-chao-6-timeout-tetos.md](../analysis/2026-09-04-aria-chao-6-timeout-tetos.md)

## Story

**As a** cliente num FAQ ou cancel,  
**I want** a chamada morrer no tempo daquele perfil,  
**so that** um lean lento não espera 25s e um FULL não é “consertado” subindo o Nginx.

## Contexto

P-BUDGET já corta payload. O relógio da TESS continua único (25s). commit-12 já trata timeout com fallback honesto (não silêncio). Esta story **não** aumenta teto; aperta o lean e detecta degradação antes do abort genérico.

Depende da story 5 para não apertar no escuro. Story 5 persist existe **local** (Quinn CONCERNS, AC3 reconcile sem teste, **não publicado**). Não há um dia de `tess.turn` live nem `duration_ms` — logo **não há p95**. T1 usa o baseline já medido (CANCEL ~7,2s / FULL ~12,4s) com tetos conservadores; BOOKING/FULL não apertam abaixo de 12400 ms.

## IN

- Tetos Aria: ms por profile (MIN/FAQ/PRICE/CANCEL/BOOKING/FULL) abaixo de 25s. Nginx/Kapso **intocados**.
- Fallback + `tess.timeout` da commit-12 intactos.
- Sem smoke `0007`. Sem subir 25s.

## OUT

- Nginx timeout como fix. Caps de chars. Skip FAQ.

## Acceptance Criteria

- [x] **AC1:** Tetos Aria com os tempos já medidos (CANCEL ~7,2s, FULL ~12,4s).
- [x] **AC2:** CANCEL/FAQ abortam abaixo de 25s se passarem o teto do perfil; fallback honesto.
- [ ] **AC3:** BOOKING/FULL não ficam com teto *menor* que o p95 medido na story 5.
- [x] **AC4:** commit-12 unit PASS. Quinn. Sem WhatsApp.

## Tasks

- [x] T1: tetos (depois da 5 ter 1 dia de dimensão, ou baseline já medido)  
- [x] T2: Dex no `callTESS`  
- [x] T3: Quinn  

## File List

- `docs/analysis/2026-09-04-aria-chao-6-timeout-tetos.md` — SOT abort_ms (Aria)
- `docs/stories/salon-whatsapp-chao-6-timeout-perfil.md` — AC1/T1/T2
- `backend/lib/tess-timeout-budget.js` — DEFAULT_ABORT_MS, parseAbortCaps, resolveTessAbortMs (novo)
- `backend/server.js` — callTESS({ timeoutMs }), resolveTessAbortMs em processMessage + resume
- `backend/test/tess-timeout-budget.test.js` — contratos §6.1–6.2 (novo)
- `backend/test/server-tess-timeout.test.js` — CANCEL/FAQ/BOOKING/FULL/premium/resume §6.3–6.7
- `backend/test/tess-timeout.test.js` — fixture timeout_ms 13000
- `infra/.env.example` — TESS_ABORT_MS_* comentados

AC3 permanece aberto: **não há p95 live**. SOT declara a ausência e trava BOOKING/FULL em 22000 (≥ 12400 medido). Dex não inventa p95.

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-7482d3d

### Code Quality Assessment

Dex ligou abort por perfil: `resolveTessAbortMs` → `callTESS({ timeoutMs })`. AbortSignal nunca recebe 25000. Lean 13000 / heavy 22000. Omit/unknown = 22000. Env clamp 3000–24000. commit-12 intacto (CANCEL last4 `0007`, FAQ `DEFAULT_TIMEOUT_COPY`, skip FAQ off). Focused tests 23/23 (Quinn rerun). AC3 sem p95 live — teto heavy é âncora 12400 + fórmula, não distribuição.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gateou.

### Compliance Check

- Coding Standards: ✓ módulo puro; parede ≠ signal
- Project Structure: ✓ `tess-timeout-budget.js` novo; P-BUDGET / nginx webhook / 46589 fora
- Testing Strategy: ✓ §6.1–6.7 + commit-12; AC3 infalsificável sem `duration_ms`
- All ACs Met: ✗ AC3 aberto de propósito (honestidade)

### Improvements Checklist

- [x] Hunts 1–9 (Quinn)
- [x] Rerun `node --test` budget + server-timeout + tess-timeout — 23/23
- [ ] AC3: só com p95 live / `duration_ms` (não inventar)
- [ ] Opcional: clamp `timeoutMs` dentro de `callTESS` (MNT-01)

### Security Review

last4 `0007`. Payload sem telefone. Zero mutação Trinks no abort. Sem `TESS_ABORT=off`.

### Performance Considerations

Sem p95. 22000 é folga sobre 12,4s medido, 3s antes da parede. Não é medição live.

### Files Modified During Review

Nenhum arquivo de aplicação. Artefatos QA: `docs/qa/gates/2026-09-04-chao-6-timeout.yml`, `docs/handoffs/2026-09-04-quinn-gate-chao-6.md`. T3 marcado. AC3 permanece aberto. AC4 Quinn só após este gate.

### Gate Status

Gate: CONCERNS → docs/qa/gates/2026-09-04-chao-6-timeout.yml
`blocks_publish`: vazio. Publish execution: **false**. Sem WhatsApp.

### Lifecycle Transition

Não aplicada. Status permanece Draft (não InReview). `[AUTO-DECISION]` qa-gate.md post-gate exige InReview.
