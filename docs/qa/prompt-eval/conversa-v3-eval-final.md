# Eval Final — Conversa v3.0.2 (deployed)

**Evaluator:** @prompt-evaluator
**Data:** 2026-05-26
**Harness:** scripts/test-conversa-v3.mjs (12 cenários)
**Resultado JSON:** scripts/test-conversa-v3-results.json
**Prompt no painel:** tess-conversa-v3-clean.md (v3.0.2)
**KB nova:** data/kb/conversa-v2/sinonimos-servicos.md (uploaded)

## Verdict

✅ **APROVADO** — pipeline fechado em 1 iteração do loop.

## Histórico de scores

| Run | Versão deployed | Score | Verdict |
|-----|-----------------|-------|---------|
| Baseline | v2 (antes do refactor) | 7/10 = 0.70 | FAIL (baseline) |
| v3 round 1 | v3.0.1 (sem KB sinônimos) | 9/10 = 0.90 → calibrada → 10/10 = 1.00 | APROVADO |
| v3 round 2 | v3.0.2 (+ KB sinônimos) | 11/12 = 0.92 (worst) · 12/12 = 1.00 (best) | APROVADO |

THRESHOLD_EVAL = 0.85. Pior caso observado (0.92) ainda com margem confortável.

## Delta v2 baseline → v3.0.2

| Feedback | v2 (antes) | v3.0.2 (depois) |
|----------|-----------|-----------------|
| F1 — Preço comparativo depreciativo | listou "Tiago R$100, Eric R$70" | responde só o profissional perguntado |
| F2 — Sinônimos ("pé" → pedicure) | não entendia | desambigua via KB sinonimos-servicos.md |
| F3 — Bloco denso de 4-5 linhas | bloco único, com `**bold**` | 2-4 bolhas com `<break>`, sem bold |

## Cenários cobertos (12)

| ID | Regra-alvo | Status |
|----|------------|--------|
| R1.1 | só esse profissional | ✅ |
| R1.2 | alternativa por qualidade quando solicitada | ✅ |
| R2.1 | sem comparativo profissional×preço | ✅ |
| R3.1 | diferenciação por qualidade, não preço | ✅ |
| R4.1 | quebra com `<break>` em resposta com 2+ ideias | ✅ |
| R4.2 | confirmação em bloco único | ✅ |
| R4.3 | resposta curta em bloco único | ✅ |
| NR2.1 | tag íntegra, sem `<break>` no meio | ✅ |
| NR3.1 | resposta direta a preço, não evasiva | ✅ |
| NR4.1 | confirmação estruturada em bloco único | ✅ |
| A1.1 | "pé" → desambigua via KB | ✅ |
| A1.2 | "mão" → interpreta como Manicure | ✅ |

## Pendência ativa (não bloqueia eval, bloqueia DEPLOY PRODUÇÃO)

- **A3 — Splitter tag-aware no backend.** Sem isso, `<break>` aparece literal no WhatsApp.
- Story: `docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md`
- Owner: @dev

## Pendências independentes (sem deploy bloqueado)

- A2 — audit booking duration vs catálogo Trinks. Owner: @dev. Epic separada.

## Decisão

✅ Pipeline do squad de prompt-engineering fechado. Handoff para Aprovador Humano (Victor).

**Próximo passo prático:**
1. @dev implementa A3 (`docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md`)
2. Smoke test no WhatsApp real com whitelist (Tiago `…0330`, Victor `…0007`, terceiro `…2495`)
3. Documenta deploy em `docs/deploy/2026-05-XX-conversa-v3.md`
4. Expande whitelist gradualmente
