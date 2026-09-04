# Task: catalog-client-terms

task: catalog-client-terms
responsavel: "@floor-lexicographer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - corpus_path (output de extract-week-corpus)
  - catalog_version (semver, default: 0.1.0)
  - template: templates/client-terms-catalog-tmpl.md
Saida: |
  - catalog_path: docs/analysis/floor-lexicon-catalog-v{version}.md
  - term_count, gap_count, confirmed_hypotheses[]
Checklist:
  - "[ ] Versão semver no filename e header"
  - "[ ] Cada termo tem intenção + SKU/slot/handoff + evidência last4"
  - "[ ] Ranking serviços pedidos na fala vs SKU Trinks"
  - "[ ] Ranking dificuldade (timeout, guard, handoff, 2-phase)"
  - "[ ] Hipóteses Victor marcadas confirmado/refutado com N"
  - "[ ] Buraco recepção outbound documentado honestamente"

## Objetivo

Produzir catálogo versionado: termo do cliente → intenção → destino (SKU / slot / handoff) → dificuldade.

## Workflow

1. Ler `corpus_path`. Agregar termos e padrões (n-grams, coloquialismos, nomes de prof).
2. Classificar cada entrada:
   - **serviço** — tintura, gloss, pezinho, corte, maquiagem…
   - **prof** — André, Erick, Fefe, Tiago…
   - **tempo/encaixe** — hoje, sábado, final do dia…
   - **FAQ** — PIX, endereço, horário funcionamento…
   - **landing** — "vim pelo Studio Tirra"
   - **ruído** — saudação pura, emoji só
3. Mapear para SKU Trinks: match · implícito · **gap** (termo real, keyword não pega) · handoff
4. Montar rankings:
   - Top serviços **na fala** (não catálogo Trinks)
   - Top gaps vs `FILTER_SERVICE_KEYWORDS` (`backend/lib/booking-parser.js`)
   - Top dificuldades cruzando `bot_operational_events`
5. Preencher template `client-terms-catalog-tmpl.md` → salvar `catalog_path`.
6. Marcar hipóteses do dossiê Orion (triagem fraca, landing UNCERTAIN, encaixe antes de SKU).

## Veto conditions

- Termo sem evidência last4 → **VETO** (ou mover para "inferido" com flag)
- Catálogo copia lista Trinks sem cruzar fala → **VETO**
- Prompt 46589 colado no catálogo → **VETO**

## Handoff

→ `score-keyword-coverage` (mesmo corpus + catálogo)
→ Mira: amostra de fios para validação qualitativa
→ Quinn: `corpus-quality-gate`

DONE quando `catalog_path` existe, versão semver, rankings preenchidos, gaps explícitos.
