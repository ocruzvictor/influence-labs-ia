# Story: “Pode cancelar esse que a gente acabou de marcar” → CANCEL, não FAQ

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 3  
**Pode executar agora:** ⛔ NÃO — depois de **#8 + #9** (P1 B4)  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md](../handoffs/2026-09-03-orion-smoke-0007-bugs.md) (Orion · B4)  
**Peers:** stories 8 (B1 snapshot) e 9 (B2 SKU) — B4 é secundário a elas

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

**As a** cliente que pede para cancelar o horário que “a gente acabou de marcar”,  
**I want** `classifyTessIntent` devolver CANCEL (não FAQ `abort_draft`),  
**so that** o profile CANCEL busca `future_bookings` e o path 4b roda — em vez de FAQ com grade 0 (P1, depois de B1+B2).

## Contexto

B4 / smoke `0007` 09:59 BRT. “Pode cancelar esse que a gente acabou de marcar” classificado **FAQ**. `future_bookings=0` (B1 create pulou). Tag cancel saiu mesmo assim (B2 SKU). Secundário a B1+B2: com snapshot honesto (#8) e id certo (#9), o intent ainda precisa ser CANCEL para o profile buscar futuros.

Hoje (`tess-context-intent.js` ~236–242):

```
hasCancelSignal → noFutureBookings → draftActive → FAQ abort_draft
```

`CANCEL_RE` **já** casa `cancelar`. O texto **não** tem `hasAbortDismissSignal` (`esquece` / `deixa pra lá`). Mesmo assim cai em abort porque há histórico de draft e lista vazia.

last4 evidência: `0007`. Sem PII. Live **não** é DoD. Se live: outro slot, não 03/09 10:30 André. Sem rsync. Sem Hostinger. Sem replay `0101`.

## IN / OUT

**IN**

- “Pode cancelar esse que a gente acabou de marcar” → intent **CANCEL**.
- `hasCancelSignal` + `noFutureBookings` + `draftActive` → `abort_draft` **somente** se também `hasAbortDismissSignal`.
- Sem dismiss: `CANCEL` + signal `cancel_no_bookings` (já existe para cancel fora de draft).
- Testes abort_draft com “deixa pra lá” **PASS**.
- Depende de #8+#9 para o path 4b ter snapshot e não PATCH-ar SKU. Esta story é o classificador.

**OUT**

- Executar antes de 8 e 9.
- Mudar `CANCEL_RE` de forma a perder `cancelar`.
- Tratar “deixa pra lá” + cancel como CANCEL (legado abort_draft deve permanecer).
- rsync / Hostinger / git push / PATCH Trinks real.
- Replay `0101`. Live 03/09 10:30 André.
- Colar prompt. Refazer C1/C2/C3. Retrabalhar B1/B2/B3.

## Acceptance Criteria

- [x] **AC1:** `classifyTessIntent('Pode cancelar esse que a gente acabou de marcar', historyDraft, [])` → `intent === CANCEL`. **Não** FAQ. Signal `cancel_no_bookings` **ou** `cancel` / `cancel_just_booked` — **não** `abort_draft` como decisão final. `historyDraft` = mesmo molde dos testes abort (user pediu horário + assistant perguntou).
- [x] **AC2:** No bloco `hasCancelSignal` (~236): se `noFutureBookings` **e** `draftActive`, retornar FAQ `abort_draft` **somente** quando `hasAbortDismissSignal(norm)` também for true. Caso contrário → CANCEL (`cancel_no_bookings` ou equivalente). `[AUTO-DECISION]` não exigir n-grama “acabou de marcar” se a regra dismiss-vs-cancel já separa o smoke.
- [x] **AC3:** Com `futureBookings` não vazio, “quero cancelar” / “Pode cancelar esse…” continua CANCEL `future_bookings` (teste legado ~108 **PASS**).
- [x] **AC4:** Abort_draft legado **PASS**: “vou precisar cancelar, deixa pra lá obrigado xau” e “deixa pra lá obrigado xau” em draft sem futuros continuam FAQ `abort_draft`.
- [x] **AC5:** Profile: intent CANCEL high-confidence → `PROFILES.CANCEL` (`fetchFutureBookings: true`, `fetchSlots: false`). Não FAQ. Esta story **não** reimplementa 4b (isso é #9) nem `createKeys` (#8).
- [x] **AC6:** last4 `0007` só rótulo. Sem PII. Unit da fatia intent (+ profile se assert). Sem rsync. Sem Hostinger. Sem replay `0101`. Live ≠ DoD (outro slot se live). C1/C2/C3 intactos. `npm test` da fatia passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2, AC4):** Ajustar o early-return cancel+draft+vazios para exigir abort dismiss. Fixture smoke 09:59. Preservar testes abort. `[Source: Orion B4 · tess-context-intent.js ~236]`
- [x] **T2 (AC3, AC5):** CANCEL com futuros intacto; profile CANCEL não FAQ. `[Source: tess-context-profiles.js INTENTS.CANCEL]`
- [x] **T3 (AC6):** Reexecutar `tess-context-intent.test.js`. CodeRabbit. Não tocar 4b/createKeys.

## Dev Notes

**Bloco a mudar**

```236:244:backend/lib/tess-context-intent.js
  if (hasCancelSignal(norm)) {
    if (!noFutureBookings) {
      return { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel', 'future_bookings'] };
    }
    if (draftActive) {
      return { intent: INTENTS.FAQ, confidence: 'high', signals: ['abort_draft'] };
    }
    return { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel_no_bookings'] };
  }
```

`hasCancelSignal` = `CANCEL_RE` = `\b(cancela|cancelar|…)\b` — já casa o smoke. Não alargar regex salvo teste falhar em “Pode cancelar”.

`isConfirmationUtterance` é match **exato** de `pode` — a frase longa **não** cai lá.

**Por que depois de 8+9**

- #8: `future_bookings` volta a ter o slot após re-CREATE (B1). Sem isso, mesmo CANCEL `cancel_no_bookings` não tem o que cancelar.
- #9: tag SKU não PATCH-a `14232906`. Sem isso, CANCEL + tag errada ainda é I1 fail no HTTP.
- B4 sozinho só corrige o **profile** (buscar futuros) e o rótulo do turno.

**Não confundir com B3:** B3 é `esquece` + pedido novo → SCHEDULING. B4 é `cancelar` o que já marcou → CANCEL. Textos distintos; ambas podem tocar `classifyTessIntent` — não fundir os early-returns.

**Constraints**

- last4: `0007`. Sem PII.
- Zero rsync. Zero Hostinger. Zero replay `0101`.
- Live seguinte ≠ 03/09 10:30 André.

**Fonte:** Orion B4 09:59 · “Secundário a B1+B2” · `tess-context-intent.js` ~236.

## File List

- `backend/lib/tess-context-intent.js` (modified — cancel+draft+vazios só abort_draft se `hasAbortDismissSignal`)
- `backend/test/tess-context-intent.test.js` (modified — classe `0007` B4 + profile CANCEL)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex via Orion)

**Debug Log References**

_(n/a)_

**Completion Notes List**

- “Pode cancelar esse que a gente acabou de marcar” em draft sem futuros → CANCEL `cancel_no_bookings`, não FAQ.
- Abort_draft legado com “deixa pra lá” / “cancelar, deixa pra lá” intacto.
- Não mexe 4b (`createKeys` / SKU) — isso é #8+#9.

**File List**

- `backend/lib/tess-context-intent.js`
- `backend/test/tess-context-intent.test.js`

## Testing

- Unit: smoke 09:59 → CANCEL; cancel+deixa pra lá → abort_draft (legado); cancel com futuros → CANCEL; profile CANCEL.
- Fatia: `tess-context-intent.test.js`.
- Sem Playwright. Sem live VPS. Sem Hostinger. Sem PATCH Trinks.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (intent classifier)
- Secondary: — 
- Complexity: Low–Medium (depende 8+9; não quebrar abort_draft)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (intent unit `0007`-class)

**Quality Gate Tasks**

- [x] Pre-Commit (@dev): `coderabbit review --agent --type uncommitted --dir backend`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic (deploy não é DoD até unit)

**CodeRabbit Focus Areas**

- Primary: cancel sem dismiss ≠ abort_draft; abort com “deixa pra lá” intacto.
- Secondary: não alargar `CANCEL_RE` sem necessidade; não mexer 4b.

**Predict files:** `backend/lib/tess-context-intent.js`, `backend/test/tess-context-intent.test.js`.

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
- Repository prompt suite: **79/79**; abort-draft and cancellation regressions absent.
- B4 verified: cancellation without an abort-dismiss signal returns CANCEL and the CANCEL profile fetches future bookings; legacy abort-draft cases remain intact.
- No live Trinks calls, rsync, Hostinger, `0101` replay, or 03/09 10:30 André exercise.
- CodeRabbit CLI 0.6.1: `doctor` **9/9 PASS** and final review **0 findings**. The review used the free CLI allowance because the repo is not connected to a CodeRabbit organization.

**Gate decision:** Story 11 may be marked **Done**.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | B4 P1 intent cancel; depois 8+9 |
| 2. Technical Implementation Guidance | PASS | ~236 exigir abort dismiss |
| 3. Reference Effectiveness | PASS | Orion B4 + testes legado |
| 4. Self-Containment Assessment | PASS | B3 vs B4 separado; dependência explícita |
| 5. Testing Guidance | PASS | smoke 09:59 → CANCEL |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.4.0 | Re-gate 144/144 focused; 502/502 backend; CodeRabbit 0 findings. Prioridades HANDOFF/RESCHEDULE cobertas sem regressão de CANCEL. | @qa (Quinn) |
| 2026-09-03 | 0.3.0 | QA PASS (140/140 focused; 498/498 backend). Status: ready-for-review→Done. | @qa (Quinn) |
| 2026-09-03 | 0.2.0 | Implementado. Status: Ready→ready-for-review. Intent CANCEL. | @dev (Orion) |
| 2026-09-03 | 0.1.0 | Created. B4 cancel intent ≠ FAQ. Status: Draft→Ready. Depende 8+9. | @sm |

---

*[AUTO-DECISION] abort_draft no ramo cancel só se hasAbortDismissSignal (reason: smoke 09:59 não tem esquece/deixa pra lá; testes abort têm).*  
*[AUTO-DECISION] P1 depois de 8+9 (reason: spawn + Orion “secundário a B1+B2”).*  
*[AUTO-DECISION] Live ≠ DoD; outro slot se live (reason: spawn).*  
*[AUTO-DECISION] elicit pulada (YOLO + SOT).*  
*[AUTO-DECISION] ClickUp skip; code-intel skip; gotchas.json ausente.*
