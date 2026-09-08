# Portabilidade — Pedro Valério L4

Este squad é um **kit de revisão de processo**. Não é o Studio Tirra.

## Levar para outro projeto

1. Copiar a pasta `squads/pedro-valerio-squad/` inteira.
2. **Não carregar** `data/tess-domain-addendum.md` a menos que o destino seja Tess/Trinks.
3. Se o cliente tiver domínio próprio: criar `data/<slug>-domain-addendum.md` (lentes ON-DEMAND).
4. Preencher `data/l0-intake.md` (L0 do **destino**). Sem isso, `*eng-map` inventa tom → BLOCK.
5. Só então `@pedro-valerio` `*fingerprint-check` → `*eng-map` / `*structure-pipeline`.
6. Core mínimo do destino: AIOX ≥ 2.1 (`aiox.minVersion`).

## O que é universal vs o que é Tirra

| Universal (sempre) | Tirra (ON-DEMAND) |
|--------------------|-------------------|
| Syncra L0–L3, Migalhas, Martelo, Forja | `tess-domain-addendum.md` |
| 15 tasks ENG/ARQ/AUTO/TMPL | Blueprint Tess em `docs/analysis/` |
| `structure-pipeline` | I1 / 2-phase / Trinks SOT |

## Par com Lib Forge

Pedro fecha o **processo**. Lib Forge (profile `analysis-only`) extrai **oportunidades de script**. Não inverter: Forge não substitui veto; Pedro não gera `.py`.
