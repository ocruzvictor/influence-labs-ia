# Story: Pin SCHEDULING pós-failed + 2-phase cita só start+SKU do POST 201

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** Após #2 · Dex no repo  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-02-aria-rca-correcao.md](../handoffs/2026-09-02-aria-rca-correcao.md) (P1.2 + P1.4)  
**Peers:** [Quinn](../handoffs/2026-09-02-quinn-invariants-verdict.md) · [Mira](../handoffs/2026-09-02-mira-floor-audit.md)

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

**As a** cliente que continua o fio depois de um CREATE falho ou parcial,  
**I want** o próximo turno ficar em SCHEDULING/BOOKING (não UNCERTAIN/FULL 29k) e a 2-phase citar só o `dataHoraInicio`+SKU do POST 201,  
**so that** “Outro dia” não explode o prompt e `5718` não fala 15:30 quando a Trinks gravou 15:00.

## Contexto

P1.2 + P1.4. **Depende de #2** (sanitize turno seguinte). Esta story não substitui C3 — pina intent e alinha o relógio da bolha 2-phase.

- `0101` 02:13:38Z “Outro dia” → UNCERTAIN + FULL `horarios=29054` / total=94531 (`prompt_drift`).
- `0160` / `5958` empty UNCERTAIN no meio do fio.
- `5718` 16:19Z: POST 201 só franja `525828063` **15:00**; falou **15:30** + “franja + Escova”. 15:00 **fora** da grade Gi (14:30/15:30/17:30). 2-phase no 1º break é honesto; o merge do turno seguinte é story 2; o relógio da bolha de sucesso tem que ser o do **201**.

`classifyTessIntent` + `buildContextProfile`: `UNCERTAIN` ou `confidence !== 'high'` ⇒ profile `FULL` (slots 10d). SCHEDULING high ⇒ `BOOKING` (até 3 dias).

`buildCreateSuccessMessage` hoje usa `bookingData.date`/`time` da **tag**, não o `dataHoraInicio` do body 201.

## IN / OUT

**IN**

- Pin SCHEDULING (intent high → profile BOOKING) na continuação pós-`booking.failed` (não UNCERTAIN/FULL 29k).
- 2-phase cita **somente** start + SKU do POST **201** (não a tag se divergir; não o 2º blocked).
- Classe `5718` 15:00 vs 15:30; `0101` “Outro dia”.
- `8397` / C1/C2/C3 / story 2 padrões **não** regridem.

**OUT**

- Falso SCHEDULING em FAQ (Aria risco P1.2).
- Cola prompt (story 5).
- Overlay appointments P0. Wave0. rsync / POST Trinks.
- P1.3 contínuos / P1.7 recheck / P1.8 markSlotWindow / P1.9 fail-closed (story 7).

## Acceptance Criteria

- [x] **AC1:** Se o fio acabou de ter `booking.failed` (flag de story 2 / `sessionState` / history do 2-phase honesto), `classifyTessIntent` **não** devolve `UNCERTAIN` para continuação curta tipo “Outro dia” / “quinta” / “pode ser outro horário”. Intent = `SCHEDULING` confidence `high` (ou equivalente que `buildContextProfile` mapeie para `BOOKING`, **não** `FULL`).
- [x] **AC2:** Unit: após failed, mensagem “Outro dia” → profile ≠ `FULL` e `slotDays` **não** explode para 10d/29k. FAQ nítido (“qual o endereço?”) no mesmo fio **pode** continuar FAQ — não pin cego em qualquer utterance. `[Source: Aria risco P1.2]`
- [x] **AC3:** `buildCreateSuccessMessage` / 2-phase usa `dataHoraInicio` (e SKU/nome) do **response POST 201**, não o `date_time` da tag se divergirem. Classe `5718`: texto da bolha de sucesso = **15:00** + só franja — **não** 15:30, **não** “franja + Escova”.
- [x] **AC4:** Combo 1/2: 201 do 1º + `guard.blocked` no 2º → 2-phase lista **só** o SKU+start do 201 (alinhado a Mira win `8741` e ao ban “Prontinho + os dois” da story 2). Sem fundir o 2º no opener “Prontinho”.
- [x] **AC5:** 2-phase honesto no **primeiro** break (`0101` 02:13:03Z “problema técnico”; `8397` cancel) **permanece**. Esta story não troca a copy de fail.
- [x] **AC6:** Dep #2: executar depois do sanitize C3 no repo. Sem cola prompt. Zero POST Trinks real (mock 201 com `dataHoraInicio`).
- [x] **AC7:** `npm test` fatias `tess-context-intent` + `booking-guards` (+ server 2-phase se tocado) passa. C1/C2/C3 intactos.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2):** Pin em `tess-context-intent.js` (ex. `isSchedulingInProgress` / flag pós-failed). Testes em `tess-context-intent.test.js` + profile `BOOKING` vs `FULL`. `[Source: Aria P1.2 · tess-context-profiles.js L26–38 vs L85–101]`
- [x] **T2 (AC3, AC4):** 2-phase lê start+SKU do POST 201 (`createBookingInTrinks` result). Ajustar `buildCreateSuccessMessage` callers em `server.js` ~1740. Fixture `5718` 15:00 vs tag 15:30. `[Source: Aria P1.4 · Quinn 5718]`
- [x] **T3 (AC5–AC7):** Não mexer copy de fail. Reexecutar fatias. CodeRabbit.

## Dev Notes

**Por que FULL 29k**

```26:38:backend/lib/tess-context-profiles.js
  if (effectiveMode === 'full' || confidence !== 'high' || intent === INTENTS.UNCERTAIN) {
    return { profile: PROFILES.FULL, slotDays: slotContextDays, ... };
  }
```

“Outro dia” hoje cai em `unknown`/`ambiguous` → UNCERTAIN → FULL.

**2-phase hoje**

```1734:1746:backend/server.js
      const dataFmt = bookingData.date && bookingData.time
        ? `${bookingData.date.split('-').reverse().join('/')} às ${bookingData.time}`
        : 'no horario combinado';
      finalMessages.push(buildCreateSuccessMessage({ afterHours, dataFmt, servicoLinha, ... }));
```

`bookingData.time` vem da tag (`createTag.date_time`). Precisa preferir `bookingResult.dataHoraInicio` (ou campo equivalente do 201). Se o 201 não trouxer, `[AUTO-DECISION]` não inventar hora — usar tag só se 201 omitir start (e documentar no Completion Notes).

**Relação com #2**

- #2: turno seguinte não afirma o blocked.
- #6: intent não vai FULL; bolha 201 fala a hora real.

**Constraints**

- last4: `0101` `5718` `8741` `0160`. Sem PII.
- Não pin FAQ. Zero rede Trinks.

**Fonte:** Aria P1.2 P1.4 · Quinn 5718 I1+I3 · Mira 5718 · epic IN P1.

## File List

- `backend/lib/tess-context-intent.js` (modified — pin pós-failed)
- `backend/lib/booking-guards.js` (modified — formatDataFmtFrom201, resolveServicoNomeFrom201)
- `backend/server.js` (modified — lastBookingOutcome → intent; 2-phase 201)
- `backend/test/tess-context-intent.test.js` (modified)
- `backend/test/tess-context-profiles.test.js` (modified)
- `backend/test/booking-guards.test.js` (modified)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex)

**Debug Log References**

_(n/a)_

**Completion Notes List**

- `isPostBookingFailedContext` + `lastBookingOutcome` pin SCHEDULING/BOOKING; FAQ preservado.
- `formatDataFmtFrom201` / `resolveServicoNomeFrom201` — 5718: 15:00 do POST 201, não tag 15:30.
- Copy de fail intacta. 98 tests pass na fatia combinada.

**File List**

- `backend/lib/tess-context-intent.js`
- `backend/lib/booking-guards.js`
- `backend/server.js`
- `backend/test/tess-context-intent.test.js`
- `backend/test/tess-context-profiles.test.js`
- `backend/test/booking-guards.test.js`

## Testing

- Unit: “Outro dia” pós-failed → SCHEDULING/BOOKING; FAQ não pina; 2-phase 201 15:00 ≠ tag 15:30; combo 1/2 só SKU do 201; fail copy intacta.
- Fatias: `tess-context-intent.test.js`, `tess-context-profiles` se tocado, `booking-guards.test.js`.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (intent + 2-phase)
- Secondary: Integration
- Complexity: Medium

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I1+I3 unit `5718`)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic

**CodeRabbit Focus Areas**

- Primary: não FULL 29k pós-failed; 2-phase = 201; não pin FAQ.
- Secondary: não regressar #2 / `8397`.

**Predict files:** `backend/lib/tess-context-intent.js`, `backend/server.js`, `backend/lib/booking-guards.js`, testes.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## QA Results

### Review Date: 2026-09-03

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:tess-context-intent.js@b0ebfc07,booking-guards.js@45dea11d,server.js@bd42a9b5,tess-context-intent.test.js@c605618e,tess-context-profiles.test.js@966a8e4a,booking-guards.test.js@65767144,HEAD:8b40465

### Code Quality Assessment

P1.2 + P1.4 fechados em unit. `isPostBookingFailedContext` + `lastBookingOutcome` pinam “Outro dia” / “quinta” em SCHEDULING high → profile BOOKING (não FULL 29k). FAQ “qual o endereço?” não pina. `formatDataFmtFrom201` / `resolveServicoNomeFrom201` fazem a bolha 2-phase citar o POST 201 (5718: 15:00, só franja). Copy de fail intacta. Fatia P1 81/81.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ helpers isolados; classify recebe opts no hot-path e no resume
- Project Structure: ✓ intent + guards + server
- Testing Strategy: ✓ 0101/5718/FAQ/quinta + fallback tag se 201 omitir start
- All ACs Met: ✓ AC1–AC7

### Improvements Checklist

- [x] Pin pós-failed → BOOKING; FAQ preservado
- [x] 2-phase 201 15:00 ≠ tag 15:30; fail copy intacta
- [ ] Opcional: teste de montagem combo 1/2 no server (helpers já cobrem)

### Security Review

last4 só como rótulo. Zero POST Trinks real. Sem PII.

### Performance Considerations

Pin é regex + flag; BOOKING limita slotDays a 3.

### Files Modified During Review

Nenhum arquivo de aplicação. Gate: `docs/qa/gates/tess-commit.6-pin-scheduling-2phase.yml`

### Gate Status

Gate: PASS → docs/qa/gates/tess-commit.6-pin-scheduling-2phase.yml

### Lifecycle Transition

PASS: ready-for-review (≡ InReview) → Done
(QA applies this transition in Status and Change Log before handoff.)

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | P1.2+P1.4; dep #2 |
| 2. Technical Implementation Guidance | PASS | intent + 201 start |
| 3. Reference Effectiveness | PASS | Aria + Quinn 5718 |
| 4. Self-Containment Assessment | PASS | 15:00 vs 15:30 no AC |
| 5. Testing Guidance | PASS | BOOKING vs FULL |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY (executar após #2).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.2.1 | QA Gate PASS — Status: InReview → Done | @qa |
| 2026-09-03 | 0.2.0 | Development complete — pin SCHEDULING + 2-phase 201. Status: Ready → ready-for-review | @dev |
| 2026-09-03 | 0.1.0 | Created. Pin SCHEDULING + 2-phase 201. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] 201 sem dataHoraInicio → fallback tag + nota (reason: não inventar hora).*  
*[AUTO-DECISION] elicit pulada (YOLO).*
