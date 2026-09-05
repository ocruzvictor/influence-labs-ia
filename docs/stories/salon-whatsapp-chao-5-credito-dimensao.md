# Story 5: Crédito Tess por turno, não só no dia

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Done · live `a9d5af8` · AC3 reconcile **PASS** no salon_day 2026-09-05 (delta 0)  
**Executor:** @data-engineer (modelo) → @dev  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** PV-P1-2 · G-P6 · Pedro blueprint · **despausa** 2026-09-04  
**SOT modelo:** [2026-09-04-dara-chao-5-credito-schema.md](../analysis/2026-09-04-dara-chao-5-credito-schema.md)

## Story

**As a** quem paga a fatura Tess,  
**I want** cada turno com intent, perfil, chars e créditos,  
**so that** “cortamos token” vira número, não impressão do dia.

## Contexto

`extractTessCredits` já lê o turno e soma em `tess_credit_usage_daily`. Sem dimensão, G-P6 fica vermelho. `tess.context_bytes` já existe; não substitui crédito. Depende de PV-P0-1 (intent+bytes) que já persistimos em parte — o furo é **crédito × perfil × intent** no mesmo eixo.

Não promete 13,5 cr.

## IN

- Ledger/evento por turno: intent, profile, chars enviados, créditos, timeout sim/não. last4 only no artefato.
- Query do dia continua. Agregado diário não some.
- Sem ligar skip FAQ (OP013). Sem mudar caps `fa0ec92`. Sem smoke `0007`.

## OUT

- Comprar crédito. Subir budget. Partir 46589. Skip inbound.

## Acceptance Criteria

- [x] **AC1:** Modelo Dara: evento `tess.turn` (sem tabela nova), retenção 90d no papel, sem E.164 no export.
- [x] **AC2:** Um turno SCHEDULING BOOKING grava as quatro dimensões.
- [x] **AC3:** Relatório do dia reconcilia com o agregado atual (±1 turno). **Live 2026-09-05:** `tess_credit_usage_daily` 19 / 415.15524 = `tess.turn` 19 / 415.15524 (delta 0). Query Dara §4.1 no VPS; **não** usou novo PILOT. 01–03/09 sem `tess.turn` (persist ainda não live). 04/09 delta 94 (persist no meio do dia) — não é o dia canónico. Residual: sem teste automatizado da query (TEST-01).
- [x] **AC4:** Quinn. Sem WhatsApp.

## Tasks

- [x] T1: schema Dara (`docs/analysis/2026-09-04-dara-chao-5-credito-schema.md`)  
- [x] T2: Dex persist no caminho `callTESS`  
- [x] T3: Quinn  

## File List

- `backend/lib/tess-context-bytes.js` — `persistTessTurnEvent`: `sent_chars`, `timed_out`, `salon_day`; phone só na coluna
- `backend/lib/tess-context-assembler.js` — `logTessTurnTelemetry`: espelha dimensões no stdout
- `backend/server.js` — skip/sucesso/timeout passam `sentChars` + `salonDay`; timeout persiste `tess.turn` sem `recordTessCredits`
- `backend/test/tess-context-bytes-persist.test.js` — AC2 + timeout + skip fixtures
- `backend/test/server-tess-timeout.test.js` — assert `tess.turn` no abort 25s

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-7482d3d

### Code Quality Assessment

Dex ligou o contrato Dara no hot-path: `persistTessTurnEvent` grava intent × profile × `sent_chars` × `tess_credits` + `timed_out` + `salon_day`. Skip = 0 chars. Sucesso/timeout = `userMessageWithContext.length`, nunca `blocks.total`. Timeout persiste `tess.turn` com crédito null e **não** chama `recordTessCredits`. Focused tests 6/6 (Quinn rerun). AC3 reconcile ±1 turno está só no SQL do SOT — sem teste.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gateou.

### Compliance Check

- Coding Standards: ✓ persist fire-and-forget; telefone só na coluna
- Project Structure: ✓ sem tabela nova, sem migration
- Testing Strategy: ✗ AC2 unit verde; AC3 sem teste (TEST-01)
- All ACs Met: ✗ AC3 aberto de propósito

### Improvements Checklist

- [x] Hunt payload / chars / timeout / PII / freeze (Quinn)
- [x] Rerun `node --test` persist + timeout — 6/6
- [x] AC3: query Dara §4.1 no VPS · salon_day 2026-09-05 delta 0 (Orion 2026-09-05). Unit/CLI da query ainda opcional (TEST-01).
- [ ] Opcional: timeout test asserta zero `tess_credit_usage_daily` (TEST-02)
- [ ] Opcional: fixtures de persist com last4 `0007` na coluna (PII-01)

### Security Review

Payload/stdout/motivo sem E.164. Coluna `client_phone` intacta. last4 `0007` neste review.

### Performance Considerations

Um insert a mais no abort 25s. Sem índice novo (Dara: futuro, não agora).

### Files Modified During Review

Nenhum arquivo de aplicação. Artefatos QA: `docs/qa/gates/2026-09-04-chao-5-credito.yml`, `docs/handoffs/2026-09-04-quinn-gate-chao-5.md`. Pedir ao Dex/Orion incluir na File List se quiserem o pacote fechado.

### Gate Status

Gate: CONCERNS → docs/qa/gates/2026-09-04-chao-5-credito.yml
`blocks_publish`: vazio. Publish execution: **false**. Sem WhatsApp.

### Lifecycle Transition

Não aplicada. Status permanece Draft (não InReview). `[AUTO-DECISION]` qa-gate.md post-gate exige InReview.
