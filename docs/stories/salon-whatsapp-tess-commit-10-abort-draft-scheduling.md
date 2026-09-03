# Story: “Esquece” + pedido novo na mesma frase → SCHEDULING, não `abort_draft` FAQ

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — Dex no repo (paralelo 8 ∥ 9 ∥ 10)  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md](../handoffs/2026-09-03-orion-smoke-0007-bugs.md) (Orion · B3)  
**Peers:** [EPIC tess-commit-honesty](epics/EPIC-tess-commit-honesty.md) · story 6 (pin SCHEDULING — não duplicar)

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

**As a** cliente que desiste do rascunho **e** pede um serviço novo na mesma mensagem,  
**I want** `classifyTessIntent` devolver SCHEDULING (não FAQ `abort_draft`),  
**so that** o profile BOOKING ainda busca grade e a Tess não handoffa `dado_indisponivel` só porque o FAQ zerou `horarios` (I2).

## Contexto

B3 / smoke `0007` 09:49 BRT. Texto: “Esquece isso então. Agora só um corte… André…”. `classifyTessIntent` → **FAQ** `abort_draft` (`tess-context-intent.js` ~246–247). `horarios=0`. Tess “deixa eu verificar” + `HANDOFF_HUMAN dado_indisponivel` + silêncio 6h. User “to esperando” = `human-handled`.

Causa: `hasAbortDismissSignal` (`esquece` ∈ `ABORT_DISMISS_RE`) **e** `draftActive` **e** `noFutureBookings` retornam FAQ **antes** de olhar o pedido novo na mesma frase (`corte` + André). Profile FAQ (`tess-context-profiles.js`) tem `fetchSlots: false` → grade vazia → Tess inventa verificação/handoff.

`isSimpleBookingBundle` pegaria serviço+profissional **se** o abort não short-circuitasse.

last4 evidência: `0007`. Sem PII. Live **não** é DoD. Se live: outro slot, não 03/09 10:30 André. Sem rsync. Sem Hostinger. Sem replay `0101`.

## IN / OUT

**IN**

- Se `hasAbortDismissSignal` **e** há sinal de booking novo na mesma mensagem → **SCHEDULING**, não abort FAQ.
- Não handoff `dado_indisponivel` só porque o profile FAQ zerou a grade.
- Unit: texto do smoke 09:48/09:49 → intent SCHEDULING.
- Testes abort_draft existentes (“deixa pra lá obrigado xau” **sem** pedido novo) **PASS**.

**OUT**

- Remover `abort_draft` para dismiss puro (sem booking novo).
- Colar prompt. rsync / Hostinger / git push.
- Replay `0101`. Live 03/09 10:30 André.
- Pin SCHEDULING pós-failed (já story 6 Done).
- B1/B2/B4 (stories 8, 9, 11).
- Refazer C1/C2/C3.

## Acceptance Criteria

- [x] **AC1:** `classifyTessIntent` no texto de evidência “Esquece isso então. Agora só um corte com o André” (ou o literal smoke 09:49 com serviço+André na mesma frase) → `intent === SCHEDULING`. **Não** FAQ. **Não** `signals` contendo só `abort_draft` como decisão final.
- [x] **AC2:** Se `hasAbortDismissSignal(norm)` **e** há sinal de booking novo na **mesma** mensagem (`hasServiceSignal` **ou** `hasDateSignal` **ou** `hasProfessionalSignal` **ou** `hasSchedulingAsk` **ou** `isSimpleBookingBundle`) → retornar SCHEDULING **antes**/em vez do early-return FAQ `abort_draft` em ~246. `[AUTO-DECISION]` um sinal basta (não exigir os três bits do bundle).
- [x] **AC3:** Abort puro **sem** booking novo continua FAQ `abort_draft`. Testes atuais em `tess-context-intent.test.js` (“deixa pra lá obrigado xau”, “vou precisar cancelar, deixa pra lá…”) **PASS intactos**.
- [x] **AC4:** `buildContextProfile` para esse turno **não** é FAQ (`fetchSlots: false`, `slotDays: 0`). Com SCHEDULING high-confidence → profile BOOKING (`fetchSlots: true`). Unit do profile **ou** assert de que FAQ não se aplica ao resultado de AC1.
- [x] **AC5:** Esta story **não** exige live nem cola de prompt. O handoff `HANDOFF_HUMAN dado_indisponivel` por `horarios=0` de profile FAQ **deixa de ser o caminho** deste utterance — a correção é o intent/profile, não um filtro novo de tag. Não adicionar handoff extra.
- [x] **AC6:** last4 `0007` só rótulo. Sem PII. `npm test` da fatia `tess-context-intent` (+ profile se tocado) passa. C1/C2/C3 / story 6 pin pós-failed **não** regridem. Sem rsync. Sem Hostinger. Sem replay `0101`. Live ≠ DoD.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2):** Em `classifyTessIntent` (~246), se abort dismiss **e** booking novo na mesma frase → SCHEDULING. `[Source: Orion B3 · tess-context-intent.js hasAbortDismissSignal · isSimpleBookingBundle]`
- [x] **T2 (AC3, AC4):** Preservar abort_draft puro. Garantir profile BOOKING (não FAQ) no caso smoke. `[Source: tess-context-profiles.js INTENTS.FAQ fetchSlots:false]`
- [x] **T3 (AC5, AC6):** Teste com o texto 09:49. Reexecutar `tess-context-intent.test.js`. CodeRabbit.

## Dev Notes

**Early-return que quebra o smoke**

```233:248:backend/lib/tess-context-intent.js
  const draftActive = isDraftSchedulingContext(history);
  const noFutureBookings = !Array.isArray(futureBookings) || futureBookings.length === 0;
  // hasCancelSignal ...
  if (hasAbortDismissSignal(norm) && draftActive && noFutureBookings) {
    return { intent: INTENTS.FAQ, confidence: 'high', signals: ['abort_draft'] };
  }
```

`ABORT_DISMISS_RE` inclui `esquece`. `SERVICE_KEYWORDS` inclui `cort`. `PROFESSIONAL_RE` inclui `andre|andré`.

**Por que `horarios=0`**

```56:68:backend/lib/tess-context-profiles.js
    case INTENTS.FAQ:
      return {
        profile: PROFILES.FAQ,
        fetchSlots: false,
        // slotDays: 0
      };
```

Não “consertar” o profile FAQ. Corrigir o intent para não cair nele quando há pedido novo.

**Sinal de booking novo (mesma mensagem)** — reusar helpers já exportados/locais: `hasServiceSignal`, `hasDateSignal`, `hasProfessionalSignal`, `hasSchedulingAsk`, `isSimpleBookingBundle`. Não criar LLM extra.

**Histórico do teste:** draft ativo = user anterior pedindo horário + assistant perguntando (mesmo molde dos testes abort atuais). O utterance de AC1 leva o pedido novo **no texto atual**.

**Constraints**

- last4: `0007`. Sem PII.
- Zero rsync. Zero Hostinger. Zero replay `0101`.
- Live seguinte ≠ 03/09 10:30 André.

**Fonte:** Orion B3 09:49 · `tess-context-intent.js` ~246 · `tess-context-profiles.js` FAQ · epic I2.

## File List

- `backend/lib/tess-context-intent.js` (modified — `hasFreshBookingSignal`; abort+booking → SCHEDULING)
- `backend/test/tess-context-intent.test.js` (modified — classe `0007` B3 + profile BOOKING)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex via Orion)

**Debug Log References**

_(n/a)_

**Completion Notes List**

- `hasAbortDismissSignal` + sinal de booking novo na mesma frase → SCHEDULING `abort_then_booking` (antes de long/multi-intent e do FAQ `abort_draft`).
- Abort puro (“deixa pra lá obrigado xau”) continua FAQ `abort_draft`.
- Profile FAQ não foi alterado; o intent deixa de cair nele. Profile BOOKING `fetchSlots: true` no caso smoke.

**File List**

- `backend/lib/tess-context-intent.js`
- `backend/test/tess-context-intent.test.js`

## Testing

- Unit: smoke 09:49 → SCHEDULING; abort puro → FAQ abort_draft (legado PASS); profile não FAQ no caso smoke.
- Fatia: `node --test backend/test/tess-context-intent.test.js` (+ profiles se assert separado).
- Sem Playwright. Sem live VPS. Sem Hostinger.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (intent classifier)
- Secondary: Architecture (profile FAQ vs BOOKING)
- Complexity: Medium (não quebrar abort_draft puro)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I2 unit intent)

**Quality Gate Tasks**

- [x] Pre-Commit (@dev): `coderabbit review --agent --type uncommitted --dir backend`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic (deploy não é DoD até unit)

**CodeRabbit Focus Areas**

- Primary: abort+booking novo → SCHEDULING; abort puro intacto.
- Secondary: não alterar profile FAQ em si; zero prompt.

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
- Repository prompt suite: **79/79**; abort-draft and scheduling regressions absent.
- B3 verified: abort dismiss plus a fresh booking signal returns high-confidence SCHEDULING/BOOKING; pure abort remains FAQ `abort_draft`.
- Explicit handoff and reschedule signals retain priority over the abort+booking shortcut.
- No live Trinks calls, rsync, Hostinger, `0101` replay, or 03/09 10:30 André exercise.
- CodeRabbit CLI 0.6.1: `doctor` **9/9 PASS** and final review **0 findings**. The review used the free CLI allowance because the repo is not connected to a CodeRabbit organization.

**Gate decision:** Story 10 may be marked **Done**.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | B3 I2 abort+booking; 0007 09:49 |
| 2. Technical Implementation Guidance | PASS | ~246 + profile FAQ fetchSlots |
| 3. Reference Effectiveness | PASS | Orion B3 + intent/profiles |
| 4. Self-Containment Assessment | PASS | um sinal basta; abort puro intacto |
| 5. Testing Guidance | PASS | smoke text → SCHEDULING |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.4.0 | Re-gate 144/144 focused; 502/502 backend; CodeRabbit 0 findings. Added handoff/reschedule priority regressions. | @qa (Quinn) |
| 2026-09-03 | 0.3.0 | QA PASS (140/140 focused; 498/498 backend). Status: ready-for-review→Done. | @qa (Quinn) |
| 2026-09-03 | 0.2.0 | Implementado. Status: Ready→ready-for-review. Intent SCHEDULING. | @dev (Orion) |
| 2026-09-03 | 0.1.0 | Created. B3 abort+booking → SCHEDULING. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] Sinal de booking novo = service OR date OR professional OR scheduling ask OR simple bundle (reason: “só um corte” já é pedido; não exigir 2 bits).*  
*[AUTO-DECISION] Não mudar o profile FAQ — mudar o intent (reason: FAQ sem grade é correto para FAQ real).*  
*[AUTO-DECISION] Live ≠ DoD; outro slot se live (reason: spawn).*  
*[AUTO-DECISION] elicit pulada (YOLO + SOT).*  
*[AUTO-DECISION] ClickUp skip; code-intel skip; gotchas.json ausente.*
