# Source tree — tess-floor-lexicon

```
squads/tess-floor-lexicon/
  squad.yaml
  README.md
  agents/
    corpus-miner.md          # Dex-Lex — extração
    floor-lexicographer.md   # Aria — catálogo
  tasks/
    extract-week-corpus.md
    catalog-client-terms.md
    score-keyword-coverage.md
    handoff-triage-wave.md
  workflows/
    wave-1-lexicon.yaml
  checklists/
    corpus-quality-gate.md
  templates/
    client-terms-catalog-tmpl.md
  config/
  data/                      # dumps locais opcionais (last4 only)

squads/tess-nightwatch/      # REUSE — não duplicar
  agents/floor-quality.md    # Mira — leitura qualitativa de fios
  agents/quality-sentinel.md # Quinn — gate
  tasks/audit-floor-quality.md

docs/analysis/               # saídas versionadas
  floor-corpus-{date}.md
  floor-lexicon-catalog-v*.md
  floor-keyword-coverage-*.md
  floor-lexicon-handoff-onda2-*.md
```

Código observado (read-only Onda 1): `backend/lib/booking-parser.js`, `backend/lib/tess-context-intent.js`.
