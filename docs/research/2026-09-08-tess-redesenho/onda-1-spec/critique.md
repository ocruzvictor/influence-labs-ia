# 1.5 QA — `*critique-spec` Onda 1

**Persona:** Quinn (@qa)  
**Alvo:** `onda-1-spec/spec.md` + `requirements.json`  
**Data:** 2026-09-08  

---

## Verdict

**APPROVED** — média 4.4 · 0 HIGH · todas as dimensões ≥ 4.

Pronto para **@sm `*draft`** da story `hold-sanitize-f5`. **Não** para @dev nesta sessão. **Não** OPEN.

JSON: `critique.json`.

---

## Scores

| Dimensão | Score | Nota |
|---|---|---|
| Accuracy (25%) | 5 | FR-1…10 e NFR-1…6 mapeados; fora de escopo explícito |
| Completeness (25%) | 4 | Seções completas; FR-8 sem GWT próprio (CRIT-2) |
| Consistency (20%) | 4 | Invariantes coerentes; copy HELD vs Δ-4 (CRIT-1) |
| Feasibility (15%) | 4 | Hold local + parser existentes; combo unique (CRIT-3) |
| Alignment (15%) | 5 | Express + pg + 2-phase; sem produto novo |
| **Média ponderada** | **4.4** | APPROVED |

---

## Issues

| ID | Sev | O quê | Na story |
|---|---|---|---|
| CRIT-1 | MEDIUM | “enquanto gravo” ainda é process-promise | Copy HELD sem gerúndio de gravar/confirmar |
| CRIT-2 | MEDIUM | FR-8 sem T-SLA | Incluir GWT timeout receipt |
| CRIT-3 | MEDIUM | Combo vs unique de slot | AC: story 1 = single-SKU; combo = guard atual |
| CRIT-4 | LOW | schema.sql legado | Migration pelo canal live |

---

## Traceabilidade P0

| FR | Spec | Teste |
|---|---|---|
| FR-1 estados | §3.1 | T-* via status |
| FR-2 hold antes de copy | §3.2 | T-6960, T-pg-down |
| FR-3 sanitize F5 | §3.3 | T-9343, T-6960 |
| FR-4 2-phase | §3.4 | T-2xx, T-9343 |
| FR-5 race 13h | §3.2 unique | T-13h |
| FR-6 silence ≠ release | §3.5 | T-1734, T-Denise |
| FR-7 receipt nomeado | §3.5 + 04-ux | T-Denise |

FR-6/7 = **story 2**. Draft @sm agora = story 1 (hold+sanitize). Story 2 só após smoke 0007.

---

## Gate

- Afrouxar I1/I2/I3 nesta story = FAIL futuro.  
- Colar 46589 / POST prod / OPEN = STOP.  
- Implementar Martelo na story 1 = scope FAIL.

**Next:** Orion devolve menu ao Victor — chamar @sm ou parar.

---

*Quinn · critique-spec · 2026-09-08*
