# Story: Sanitize C3 no turno seguinte — nunca afirmar o que failed/blocked recusou

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — Dex no repo (paralelo 1–4)  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-02-aria-rca-correcao.md](../handoffs/2026-09-02-aria-rca-correcao.md) (Aria rev. 3 · P0.5)  
**Peers:** [Quinn I1/I2/I3](../handoffs/2026-09-02-quinn-invariants-verdict.md) · [Mira floor](../handoffs/2026-09-02-mira-floor-audit.md)

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

**As a** cliente no WhatsApp depois de um `booking.failed` ou `guard.blocked`,  
**I want** o outbound do **turno seguinte** nunca dizer que o horário “já confirmamos” / “está tudo certo”,  
**so that** a boca da Tess e o commit Trinks são a mesma fonte (I1) sem colar prompt.

## Contexto

P0.5 / Quinn #2 + #4. C3 hoje stripa `Confirmado,` / `tá garantido` / `já marcado` no **mesmo** turno da tag (`sanitizePrematureConfirm` em `booking-parser.js`). Não cobre o **turno seguinte**.

Cadeia `0101`: 02:13:03Z 2-phase honesto (“problema técnico”) → 02:13:46Z “remarcar o corte que **já confirmamos**”. Mesmo molde: `9605` “Tudo certo com a manicure…”, `5668` “já confirmamos”, `5718` turno seguinte “Seu agendamento está … franja + Escova”.

C3 **não refazer**. Estender. Flag de thread no turno **seguinte** após `booking.failed` / `guard.blocked`. Sem cola prompt (isso é story 5).

last4 evidência: `0101` `9605` `5718` `5668`. `8397` PASS intacto. `8741` (bolha lista só o SKU gravado) **não piora**. Sem PII.

## IN / OUT

**IN**

- Estender `sanitizePrematureConfirm` em `backend/lib/booking-parser.js`.
- Flag de thread no **turno seguinte** após `booking.failed` / `guard.blocked` (`server.js` + estado de sessão; **zero** migration).
- Banir no outbound pós-fail/block: “já confirmamos”; “tudo certo com [serviço]” (e “[serviço] [hora]”); “seu agendamento está”; “Prontinho + os dois” se o 2º `guard.blocked`.
- Não stripar “Tá certo?” (pergunta ≠ afirmação — Quinn).
- `8397` PASS intacto (cancel honesto).
- Unit I1 classe `0101` no turno seguinte.

**OUT**

- Refazer C1/C2/C3.
- Colar / editar prompt TESS 46589 (story 5).
- Over-strip de pergunta de confirmação (“Tá certo?”).
- Piorar `8741` (copy do 201 lista só o SKU gravado — Mira win).
- rsync / git push / POST Trinks / resume `5668`.
- Pin SCHEDULING / 2-phase hora do POST 201 (story 6; **depois** desta).

## Acceptance Criteria

- [x] **AC1:** Em modo pós-falha/bloqueio, `sanitizePrematureConfirm` (ou helper contextual chamado por ele) cobre afirmações: `já confirmamos` / `ja confirmamos`; `tudo certo com` + serviço/hora; `seu agendamento está` / `seu agendamento esta`. Esses novos padrões **não** são aplicados globalmente fora desse modo. Os padrões atuais globais (`Confirmado,`, `tá garantido`, `já marcado`) permanecem.
- [x] **AC2:** Após emitir `booking.failed` ou `guard.blocked` neste turno, o backend marca flag de thread (ex. `sessionState.lastBookingOutcome = 'failed'|'blocked'`). **Zero** coluna/migration nova. `[AUTO-DECISION]` flag = estado de sessão in-memory (mesmo `sessionState` de `server.js`); se a sessão evictar, o sanitize dos novos padrões ainda vale no texto cru.
- [x] **AC3:** No **turno seguinte com a flag ativa**, o outbound passa pelo modo pós-falha/bloqueio e **não** contém “já confirmamos”, “tudo certo com [serviço]”, “seu agendamento está”. Sem flag, os novos padrões contextuais não removem afirmações legítimas. Classe unit: `0101` 02:13:46Z, `9605` 21:43Z, `5668` 21:22Z — last4 só como rótulo do teste, sem PII.
- [x] **AC4:** Combo 2º `guard.blocked` (classe `5718` / `8741`): o outbound **não** afirma “Prontinho” + os dois serviços. Pode afirmar só o SKU do POST 201 (Mira win `8741`). Se o 2º blocked, banir fusão “franja + Escova está”.
- [x] **AC5:** “Tá certo?” / “Tá certo?” como **pergunta** **não** é stripado. Teste explícito: input `Tá certo?` → output ainda contém a pergunta.
- [x] **AC6:** Fixture `8397`-class (cancel `successCount=0`, copy “Não consegui localizar/cancelar”) **não** muda. Testes C3 existentes em `booking-parser.test.js` (`Confirmado,`, `tá garantido`, cancel sanitizer) **PASS intactos**.
- [x] **AC7:** Sem cola/diff de `docs/prompts/tess-conversa-v3-clean.md` nesta story. Sem POST Trinks. `npm test` da fatia `booking-parser` (+ server se a flag viver lá) passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC5):** Estender padrões em `booking-parser.js`. Testes novos + teste negativo “Tá certo?”. `[Source: Aria P0.5 · Quinn #2]`
- [x] **T2 (AC2, AC3):** Setar flag em `server.js` nos emits `booking.failed` / `guard.blocked`. Aplicar sanitize no turno seguinte com a flag. Sem migration. `[Source: server.js ~1470 · ~1758 · ~1698]`
- [x] **T3 (AC4):** Quando `createsToRun.length >= 2` e o 2º `guard.blocked`, o texto sanitizado/2-phase **não** afirma os dois. Não reescrever `buildCreateSuccessMessage` além do necessário para não fundir o 2º. `[Source: Quinn #4 · Mira 5718]`
- [x] **T4 (AC6, AC7):** Reexecutar `backend/test/booking-parser.test.js`. Não tocar prompt. CodeRabbit pre-commit.

## Dev Notes

**C3 hoje (não refazer)**

```228:255:backend/lib/booking-parser.js
const PREMATURE_CONFIRM_PATTERNS = [
  /\b(agendado|confirmado|pronto)\s*[,!.]*/gi,
  // ...
  /\bta garantido\b[^\n]*/gi,
  /\btá garantido\b[^\n]*/gi,
  // ...
];
function sanitizePrematureConfirm(text) { ... }
```

Chamada atual: `server.js` ~1470 **antes** do bloco Trinks, no **mesmo** turno da tag. O turno seguinte (TESS sem tag) **não** passa por 2-phase — só pelo sanitize. Por isso a flag + padrões novos.

**Eventos que ligam a flag**

- `booking.failed` — `server.js` ~1758 / ~1795
- `guard.blocked` kind `janela` / `expediente` / `incompatible` / etc. — ~1548–1704

**Não stripar**

- Quinn: “Tá certo?” = pedido de confirmação, **não** entra na tabela I1.
- `8397` 19:52Z: “Não consegui localizar/cancelar” — PASS; não mexer no path de cancel.

**8741**

- Mira win: bolha de sucesso lista **só** o SKU gravado. AC4 não desfaz isso.

**Constraints**

- Sem cola prompt. Sem migration. Sem rsync.
- last4: `0101` `9605` `5718` `5668` `8397` `8741`. Sem PII.

**Fonte:** Aria §4 P0.5 · Quinn #2 #4 · Mira fails `9605` `0101` `5718` `5668` · epic IN P0.5.

## File List

- `backend/lib/booking-parser.js` (modified — POST_FAIL_CONFIRM_PATTERNS, COMBO_FUSION_PATTERNS, sanitize options)
- `backend/server.js` (modified — `lastBookingOutcome`, `markBookingOutcome`, combo re-sanitize)
- `backend/test/booking-parser.test.js` (modified — testes postFail 0101/9605/5668/5718/8397)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev / Dex-Night)

**Completion Notes List**

- `POST_FAIL_CONFIRM_PATTERNS` só com `afterFailOrBlock: true` (flag `lastBookingOutcome`); combo fusion via `comboSecondBlocked`.
- Testes: `node --test backend/test/booking-parser.test.js` — 54/54 PASS (incl. C3 legado + 8397).

**File List**

- `backend/lib/booking-parser.js`
- `backend/server.js`
- `backend/test/booking-parser.test.js`

## Testing

- Unit: novos padrões; flag turno seguinte; “Tá certo?” intacto; C3 legado PASS; `8397` copy intacta.
- Fatia: `node --test backend/test/booking-parser.test.js` (+ testes de server/flag se criados).
- Sem Playwright. Sem live VPS.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: API (outbound sanitize)
- Secondary: Integration (eventos booking/guard)
- Complexity: Medium (over-strip vs I1)

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @qa (I1 unit turno seguinte)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** deste epic

**CodeRabbit Focus Areas**

- Primary: não stripar pergunta; C3 legado intacto; flag sem migration.
- Secondary: não piorar `8741`; zero prompt.

**Predict files:** `backend/lib/booking-parser.js`, `backend/test/booking-parser.test.js`, `backend/server.js`.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## QA Results

### Review Date: 2026-09-03

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:booking-parser.js@faf546b1,server.js@bd42a9b5,booking-parser.test.js@0cca317d,HEAD:8b40465

### Code Quality Assessment

I1 do turno seguinte fechado em unit. `POST_FAIL_CONFIRM_PATTERNS` só com `afterFailOrBlock`; `lastBookingOutcome` setado em `booking.failed` / `guard.blocked` e consumido no turno seguinte. Combo 2º blocked re-sanitiza `Prontinho` + fusão. C3 legado, “Tá certo?” e copy `8397` intactos. Fatia 54/54 PASS.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ C3 estendido, não refeito
- Project Structure: ✓ padrões no parser; flag no `sessionState` existente
- Testing Strategy: ✓ 0101/9605/5668/5718/8397 + semFlag + Tá certo?
- All ACs Met: ✓ AC1–AC7

### Improvements Checklist

- [x] I1 unit classe 0101 turno seguinte sem “já confirmamos”
- [x] Novos padrões não globais (teste semFlag)
- [ ] P1 story 5 — prompt ainda ensina a mentira (fora do IN)

### Security Review

last4 só como rótulo. Sem cola de prompt. Sem PII.

### Performance Considerations

Regex extras só no modo contextual.

### Files Modified During Review

Nenhum arquivo de aplicação. Gate: `docs/qa/gates/tess-commit.2-sanitize-pos-falha.yml`

### Gate Status

Gate: PASS → docs/qa/gates/tess-commit.2-sanitize-pos-falha.yml

### Lifecycle Transition

PASS: ready-for-review (≡ InReview) → Done
(QA applies this transition in Status and Change Log before handoff.)

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | I1 turno seguinte; dep nenhuma |
| 2. Technical Implementation Guidance | PASS | C3 extend + flag sessão |
| 3. Reference Effectiveness | PASS | Aria P0.5 + Quinn #2 #4 |
| 4. Self-Containment Assessment | PASS | frases banidas no AC |
| 5. Testing Guidance | PASS | 8397 + Tá certo? + C3 |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.1.0 | Created. Sanitize C3 turno seguinte. Status: Draft→Ready. | @sm |
| 2026-09-03 | 0.2.0 | Implemented post-fail sanitize + session flag. Status: Ready→ready-for-review. | @dev |
| 2026-09-03 | 0.1.1 | Validated PASS (9/10): AC1/AC3 restringem novos padrões ao contexto pós-falha/bloqueio. | @po |
| 2026-09-03 | 0.2.1 | QA Gate PASS — Status: InReview → Done | @qa |

---

*[AUTO-DECISION] Flag = sessionState in-memory, zero migration (reason: epic sem migration nova; bot_thread_state coluna nova = 018+).*  
*[AUTO-DECISION] elicit pulada (YOLO).*
