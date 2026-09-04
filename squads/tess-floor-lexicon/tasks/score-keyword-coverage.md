# Task: score-keyword-coverage

task: score-keyword-coverage
responsavel: "@floor-lexicographer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - corpus_path (output de extract-week-corpus)
  - catalog_path (output de catalog-client-terms, opcional mas recomendado)
  - keywords_source (default: backend/lib/booking-parser.js FILTER_SERVICE_KEYWORDS)
Saida: |
  - coverage_report: docs/analysis/floor-keyword-coverage-{YYYYMMDD}.md
  - metrics: { total_utterances, hits, misses, hit_rate_pct, top_miss_terms[] }
Checklist:
  - "[ ] Lista keywords espelha FILTER_SERVICE_KEYWORDS do repo (commit ref)"
  - "[ ] Hit/miss por fala única (dedup last4+texto)"
  - "[ ] Top 20 misses com last4 + citação"
  - "[ ] Sinónimos candidatos para Onda 2 listados separadamente"
  - "[ ] Sem alterar booking-parser.js nesta task"

## Objetivo

Medir quanto da fala real desta semana a lista `FILTER_SERVICE_KEYWORDS` cobre — evidência para Onda 2, não patch imediato.

## Referência keywords (live)

```javascript
// backend/lib/booking-parser.js — FILTER_SERVICE_KEYWORDS
'cort', 'barba', 'mecha', 'escova', 'color', 'camuflag', 'progressiva', 'hidrat',
'manicure', 'pedicure', 'sobrancelha', 'cilio', 'cílio', 'depil', 'limpeza',
'maquiagem', 'make', 'penteado', 'laser', 'botox', 'cauteriz', 'tonaliz', 'retoque',
'avaliacao', 'avaliação', 'global', 'combo', 'cabelo'
```

Incluir regras auxiliares do mesmo arquivo: `pe/pes` → pedicure, `mao/maos` → manicure, coloquial penteado → corte.

## Workflow

1. Ler `corpus_path`. Filtrar falas `role=user` (cliente).
2. Normalizar texto (NFD, lower, strip marks) — mesma lógica que `normalizeCatalogText`.
3. Para cada fala única: aplicar `filterServicesByKeywords` logic → hit ou miss.
4. Agregar:
   - Total falas únicas
   - Hits / misses / hit_rate_pct
   - Top misses (termos reais que furam: tintura, gloss, pezinho, maquiadora…)
5. Cruzar misses com `catalog_path` gaps se disponível.
6. Listar **sinónimos candidatos Onda 2** (não implementar): termo_cliente → keyword_proposta → SKU alvo.
7. Escrever `coverage_report` com tabela hit/miss + amostra evidência last4.

## Veto conditions

- Alterar `booking-parser.js` nesta task → **VETO** (Onda 2 only)
- Hit rate calculado sobre linhas brutas sem dedup → **VETO**
- E.164 no report → **VETO**

## Handoff

→ input para `handoff-triage-wave` (sinónimos + misses)
→ @architect na Onda 2 (após ACK Victor)

DONE quando report existe, hit_rate documentado, top misses com evidência last4.
