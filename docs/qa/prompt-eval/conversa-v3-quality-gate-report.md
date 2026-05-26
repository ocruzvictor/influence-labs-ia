# Quality Gate Report — tess-conversa-v3.md

**Evaluator:** @prompt-evaluator
**Prompt avaliado:** docs/prompts/tess-conversa-v3.md
**Histórico:**
- Iteração 1, v3.0 — 2026-05-26 — **FAIL** (1 blocking falhou: vocabulario-proibido-ausente em L201)
- Iteração 1, v3.0.1 — 2026-05-26 — **PASS** ✅ (fix do @prompt-writer + re-gate)

## Final status (v3.0.1)

**Verdict:** ✅ **PASS** (blocking_pct = 1.0 · recommended_pct = 1.0)

## Blocking (v3.0.1)

| id | status | nota |
|---|---|---|
| anatomia-catalogada | ✅ PASS | PACER v1.0 + FAFAC v1.0 (Biblioteca §1 e §2) |
| anatomia-secoes-completas | ✅ PASS | Crisp ↔ PACER via Biblioteca §3 |
| fewshot-minimo | ✅ PASS | 12 ≥ 5 |
| saida-estruturada-especificada | ✅ PASS | 4 tags + separador `<break>` |
| restricoes-escalonamento-presentes | ✅ PASS | P (NUNCA/SEMPRE) + I.6 + I.8 + I.10 |
| vocabulario-proibido-ausente | ✅ PASS | L201 corrigido; meta-doc fora do bloco PROMPT |
| motivo-declarado-presente | ✅ PASS | Changelog v3.0.1 com motivo declarado |

## Recommended (v3.0.1)

| id | status | nota |
|---|---|---|
| anatomia-tem-exemplos | ✅ PASS | 3 exemplos PACER catalogados |
| fewshot-cobre-edge-cases | ✅ PASS | Exemplos 2, 5, 6, 7, 8 |
| trip-wire-auto-validacao | ✅ PASS | REGRA ZERO + I.10 §"Regras inegociáveis" |

## Decisão

Avança para **Etapa 6 (*rodar-eval)**.

**Bloqueador upstream da Etapa 6:** harness conversa-scope não existe. `scripts/test-conversa-v2.mjs` + `test-conversa-v2-robust.mjs` cobrem v2 mas precisam ser estendidos para os critérios v3 (R1-R4 + NR1-NR4). Owner do harness: @dev (ou Victor estender manualmente). Esta dependência é declarada — sem harness rodável, não rodo eval.
