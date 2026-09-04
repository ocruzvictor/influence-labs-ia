# Tess Floor Lexicon

Squad task-first para **Onda 1 — mapa do chão**: como clientes Studio Tirra falam no WhatsApp (IA + inbound; recepção outbound quando houver fonte).

Plano Orion: `docs/analysis/2026-09-04-orion-ondas-lexico-triagem.md` · Workflow: `docs/ops/2026-09-04-orion-workflow-ondas-lexico.md`

**Não faz:** otimização de crédito, paste do prompt 46589, deploy Hostinger, Trinks POST/PATCH/PUT, religar kill switch.

## Personas

| Persona | Arquivo | Motor | Função |
|---|---|---|---|
| Dex-Lex (Corpus Miner) | `agents/corpus-miner.md` | Composer 2.5 Fast | Dump SQL/CLI `conversation_history` last4-only |
| Aria (Floor Lexicographer) | `agents/floor-lexicographer.md` | Grok 4.6 High | Catálogo termo → intenção/SKU/dificuldade |
| Mira (Floor Quality) | `squads/tess-nightwatch/agents/floor-quality.md` | **Reutilizada** | Leitura qualitativa de fios — **não duplicar** |

## Pipeline Onda 1

```
extract-week-corpus  →  catalog-client-terms  →  score-keyword-coverage
         ↓                        ↓
    Mira (*audit-floor-quality)   corpus-quality-gate
         ↓
handoff-triage-wave  →  ACK Victor  →  Onda 2 (@architect)
```

## Tasks

| Task | Responsável | Entrega |
|---|---|---|
| `extract-week-corpus` | corpus-miner | Dump last4 + role + agent + intent + texto |
| `catalog-client-terms` | floor-lexicographer | Catálogo versionado markdown |
| `score-keyword-coverage` | floor-lexicographer | Hit/miss vs `FILTER_SERVICE_KEYWORDS` |
| `handoff-triage-wave` | floor-lexicographer | Contrato de entrada para Wave 2 |

## Ativar

```
@tess-floor-lexicon
# ou carregar agents/corpus-miner.md ou agents/floor-lexicographer.md

*extract-week-corpus --from 2026-09-01 --to 2026-09-04
*catalog-client-terms
*score-keyword-coverage
*handoff-triage-wave
```

Para leitura de fios (amostra Mira):

```
@squad-creator  # ou nightwatch
# carregar squads/tess-nightwatch/agents/floor-quality.md
*audit-floor-quality
```

Prefixo slash: `/lexicon-*` via `slashPrefix: lexicon`.

Validar: `@squad-creator *validate-squad tess-floor-lexicon`

## Travas (todas as personas)

- **last4 only** — E.164 só em query interna, nunca em artefato/chat/canvas
- **Sem paste 46589**
- **Sem Trinks POST/PATCH/PUT**
- **Kill switch permanece off** até Victor mandar religar
- **CLI first** — LibForge / `scripts/salao` para dumps
