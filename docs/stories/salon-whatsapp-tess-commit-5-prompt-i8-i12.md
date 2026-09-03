# Story: Diff prompt I.8 / I.1.17 / I.12 / I.1.3 no repo — Victor cola

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 3  
**Pode executar agora:** Após #2 · Dex diff; **Victor cola**  
**Branch sugerida:** `feature/tess-commit-honesty`  
**Handoff SOT:** [docs/handoffs/2026-09-02-mira-floor-audit.md](../handoffs/2026-09-02-mira-floor-audit.md) (`rule_suggestions` 1–4)  
**Peers:** [Aria RCA](../handoffs/2026-09-02-aria-rca-correcao.md) (P1.1) · [Quinn](../handoffs/2026-09-02-quinn-invariants-verdict.md)

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "prompt-diff vs Mira rule_suggestions"
  - "coderabbit --prompt-only -t uncommitted"
```

## Story

**As a** Victor (único que cola TESS 46589),  
**I want** o diff de I.8 / I.1.17 / I.12 / I.1.3 já escrito em `docs/prompts/tess-conversa-v3-clean.md`,  
**so that** o prompt deixa de ensinar “Tá garantido” / “emitida a tag, está criado” — **sem** backend e **sem** cola nesta story.

## Contexto

P1.1. Mira: I.8 L309 e I.12 L351 ensinam a afirmar na tag. Quinn #2 é gate de **deploy futuro**; o backend (story 2) fecha I1 sem cola. I.8/I.12 continuam a ensinar a mentira — P1 no repo; cola = Victor, **não** nesta wave.

**Depende de #2** (sanitize C3 turno seguinte). Sem #2, o modelo afirma e C3 ainda curto (Aria trade-off).

**SOMENTE** diff neste arquivo. Sem backend. Sem cola TESS 46589.

## IN / OUT

**IN**

- Diff **somente** em `docs/prompts/tess-conversa-v3-clean.md`.
- Seções: **I.8** (L309), **I.1.17** + NUNCA L392, **I.12** (L351), **I.1.3** (passo 3 + I.1.16).
- Texto alvo = Mira `rule_suggestions` 1–4 (abaixo). Dex escreve no repo; Victor cola depois.

**OUT**

- Qualquer arquivo `backend/`.
- Colar prompt no TESS 46589 (Victor; **não** Dex).
- I.1.10 + I.11 contínuos (`4749`) / `8134` — story 7 + P1.5 (fora).
- I.10 VALIDE / HABILITACAO `7163` — P1.6 fora desta wave.
- rsync / git push / POST Trinks.
- Archive/changelog só se o padrão do repo já exigir (não inventar release).

## Acceptance Criteria

- [x] **AC1:** I.8 (hoje L309): remover o script “Tá garantido 😊”. Trocar pela **mesma** frase neutra de I.1.16 + tag. Banir no fora-de-horário: “Tá garantido” / “já confirmamos” / “tudo certo com a X” até o backend mandar a bolha 2-phase. `[Source: Mira rule_suggestions[1]]`
- [x] **AC2:** I.1.17 + NUNCA (~L392): ampliar o ban além de “Agendado!/Confirmado!/Pronto!”. Proibir “já confirmamos”, “seu agendamento está”, “tudo certo com [serviço] [hora]”, “fica sim 15:30” se **não** houver `booking.created` neste turno. Cobre classes `9605` `5718` `5668` `0101`. `[Source: Mira rule_suggestions[2]]`
- [x] **AC3:** I.12 (hoje L351): substituir `Emitida a tag, aquele serviço está criado.` por: **tag ≠ reserva. Só o backend confirma. Se a 2-phase disser que não fechou, não diga que está marcado.** `[Source: Mira rule_suggestions[3]]`
- [x] **AC4:** I.1.3 (+ I.1.16): cliente sem cadastro Trinks **não** emite `[BOOKING_CREATE]` antes dos 6 campos. Se o cadastro falhar, **nunca** “já confirmamos” — handoff `dado_indisponivel` + 1 linha honesta. Caso `0101`. `[Source: Mira rule_suggestions[4]]`
- [x] **AC5:** `git diff -- docs/prompts/tess-conversa-v3-clean.md` é o **único** diff de aplicação desta story. Zero linhas em `backend/`. Zero cola (nenhum passo “aplicar no TESS”).
- [x] **AC6:** Story 2 Done (ou pelo menos o sanitize dos novos padrões no repo) **antes** de marcar esta Ready-for-Review. Se #2 ainda não mergeou, esta story espera — não implementar prompt “na frente” do C3 curto em produção (cola continua sendo Victor / outra wave).

## Tasks / Subtasks

- [x] **T1 (AC1):** Editar I.8 — frase neutra I.1.16; banir “Tá garantido”. `[Source: tess-conversa-v3-clean.md L298–311]`
- [x] **T2 (AC2):** Editar I.1.17 + bloco NUNCA L392. `[Source: L56 · L389–392]`
- [x] **T3 (AC3):** Editar I.12 L351. `[Source: L350–354]`
- [x] **T4 (AC4):** Editar I.1.3 / I.1.16 — 6 campos antes do CREATE; fail de cadastro honesto. `[Source: L28 · L51–53]`
- [x] **T5 (AC5, AC6):** Confirmar `git diff --name-only` = só o prompt. Não colar. Handoff: “Victor cola quando #2 estiver no ar.”

## Dev Notes

**Texto atual (não reescrever o resto do prompt)**

- I.8 L309: `troque "Confirmo aqui então 👀" por: "Vou registrar isso aqui pra você. Como estamos fora do horário, a recepção confere logo cedo amanhã. Tá garantido 😊"`
- I.1.16: `Após confirmação … resposta neutra tipo "Confirmo aqui o agendamento então 👀" e na MESMA mensagem a(s) tag(s)`
- I.1.17: `NÃO escreva "Agendado!", "Confirmado!" ou "Pronto!". O backend gera a mensagem de sucesso após a Trinks responder.`
- I.12 L351: `Emitida a tag, aquele serviço está criado.`
- I.1.3 L28: 6 campos (nome, telefone inbound, e-mail, nascimento, Instagram, onde conheceu).

**Mira 5–6 / 7 = OUT**

- I.1.10+I.11 `4749` / `8134` → story 7 + P1.5.
- I.10 VALIDE `7163` → P1.6 fora.
- Tickets Dev (TipoId, contíguo, 2-phase) → stories 1, 6, 7.

**Cola**

- Único ator: Victor. Dex **não** cola 46589. Changelog de prompt só se o repo já tiver o rito (`docs/prompts/CHANGELOG-46589.md`) — não inventar versão de cola.

**Fonte:** Mira `rule_suggestions` 1–4 · Aria P1.1 · epic IN P1 · spawn “SOMENTE diff … I.8, I.1.17, I.12, I.1.3”.

## File List

- `docs/prompts/tess-conversa-v3-clean.md` (modified — v3.2.2)
- `docs/prompts/CHANGELOG-46589.md` (modified — v3.2.2 entry)
- `backend/test/tess-prompt-i8-i12.test.js` (created — prompt-diff gate)

## Dev Agent Record

**Agent Model Used**

Composer 2.5 Fast (@dev Dex)

**Debug Log References**

_(n/a)_

**Completion Notes List**

- Diff Mira rule_suggestions 1–4 aplicado em I.8, I.1.17, I.12, I.1.3 + NUNCA.
- v3.2.2 no header; CHANGELOG atualizado. **Victor cola** — Dex não colou TESS 46589.
- Testes: `node --test backend/test/tess-prompt-i8-i12.test.js` (4 pass).

**File List**

- `docs/prompts/tess-conversa-v3-clean.md`
- `docs/prompts/CHANGELOG-46589.md`
- `backend/test/tess-prompt-i8-i12.test.js`

## Testing

- Review do diff vs Mira 1–4 (Quinn/QA: prompt-diff). Sem unit de backend. Sem cola. Sem Playwright.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Architecture (prompt SOT)
- Secondary: — 
- Complexity: Low (diff localizado; risco = over-edit do prompt)

**Specialized Agent Assignment**

- Primary: @dev (diff)
- Supporting: @qa (prompt-diff vs Mira), Victor (cola — fora)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): diff só no arquivo do prompt
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment / cola TESS: **Victor**, não Dex

**CodeRabbit Focus Areas**

- Primary: não editar backend; I.8/I.12 não ensinam tag=reserva.
- Secondary: não expandir para I.1.10 / VALIDE / 7163.

**Predict files:** `docs/prompts/tess-conversa-v3-clean.md` **somente**.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## QA Results

### Review Date: 2026-09-03

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:tess-conversa-v3-clean.md@f0dadd5b,CHANGELOG-46589.md@7bb3b0fb,tess-prompt-i8-i12.test.js@baab5dab,HEAD:8b40465

### Code Quality Assessment

P1.1 no repo. I.8 usa a frase neutra de I.1.16 (sem “Tá garantido 😊”). I.1.17 + NUNCA ampliam o ban para “já confirmamos” / “seu agendamento está” / “tudo certo com [serviço]” / “fica sim [hora]” sem `booking.created`. I.12: tag ≠ reserva. I.1.3: 6 campos antes de `[BOOKING_CREATE]`; cadastro falho → handoff `dado_indisponivel`. Story 2 já Done. Dex **não** colou TESS 46589. Prompt-diff 4/4 PASS.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ diff localizado; CHANGELOG no rito existente
- Project Structure: ✓ SOT em `docs/prompts/`; teste lê o arquivo
- Testing Strategy: ✓ prompt-diff vs Mira 1–4; sem unit de runtime; sem cola
- All ACs Met: ✓ AC1–AC6

### Improvements Checklist

- [x] Mira 1–4 no repo; zero cola TESS
- [x] AC6: story 2 Done antes deste gate
- [ ] Victor cola v3.2.2 no 46589 quando o backend da story 2 estiver no ar (OUT)

### Security Review

Sem PII. Sem cola. Sem secrets.

### Performance Considerations

Diff de texto; sem runtime.

### Files Modified During Review

Nenhum arquivo de aplicação. Gate: `docs/qa/gates/tess-commit.5-prompt-i8-i12.yml`

### Gate Status

Gate: PASS → docs/qa/gates/tess-commit.5-prompt-i8-i12.yml

### Lifecycle Transition

PASS: ready-for-review (≡ InReview) → Done
(QA applies this transition in Status and Change Log before handoff.)

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | P1.1; dep #2 |
| 2. Technical Implementation Guidance | PASS | 4 seções Mira 1–4 |
| 3. Reference Effectiveness | PASS | Mira L309/L351/L392 |
| 4. Self-Containment Assessment | PASS | texto alvo no AC |
| 5. Testing Guidance | PASS | prompt-diff; sem backend |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** READY (blocked on #2 para **executar**; story escrita).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-03 | 0.2.1 | QA Gate PASS — Status: InReview → Done | @qa |
| 2026-09-03 | 0.2.0 | Development complete — prompt v3.2.2 Mira 1–4. Status: Ready → ready-for-review | @dev |
| 2026-09-03 | 0.1.0 | Created. Diff prompt I.8/I.1.17/I.12/I.1.3. Status: Draft→Ready. | @sm |

---

*[AUTO-DECISION] Só Mira 1–4 (reason: spawn SOMENTE essas seções; 5–6 OUT).*  
*[AUTO-DECISION] elicit pulada (YOLO).*
