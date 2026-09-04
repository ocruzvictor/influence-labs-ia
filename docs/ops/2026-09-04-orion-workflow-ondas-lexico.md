# Workflow — Onda 1 léxico / Onda 2 triagem

Orion orquestra. Crédito estacionado. Kill switch **permanece off** até Victor mandar religar.

```
W0 Craft squad tess-floor-lexicon
W1 Mary schema catálogo
W2 Dex CLI dump last4 (Onda 1)
W3 Mira amostra de fios
W4 Quinn gate corpus (Onda 1 ainda não PASS)
W5 ACK Victor → Onda 2 Architect (esta sessão, 12:16 BRT)
W6 Dex fase A (keywords + intent + sanitize) — bot permanece off
W7 Quinn anti-self-review
```

Motores: raciocínio Grok 4.6 xHigh (Mary, Aria, Quinn, Mira); execução Composer 2.5 Fast (Craft, Dex, Gage).

Travas: last4, sem Hostinger, sem rsync, sem paste 46589, sem Trinks POST, sem André 10:30, sem `git add .`.

## W0 fechado (Craft 2026-09-04)

Squad: `squads/tess-floor-lexicon/` (15 arquivos). Mira reusa Nightwatch. Ativar: `*extract-week-corpus`.

## W1 fechado (Mary 2026-09-04)

Schema `1.0.0`: `docs/analysis/2026-09-04-mary-catalogo-lexico-schema.md`. Ask-class `service|pro|time|faq|pay|noise` + `ChannelPattern`.

## W2 fechado (Dex 2026-09-04) — CLI, não live

`dumpFloorCorpus` + `backend/scripts/salao/contexto/dump_corpus_semana.js`. Testes **9/9**. Container live ainda `fa0ec92`. Stats: `docs/analysis/floor-corpus-20260904.md`.

## W3 parcial (2026-09-04)

Catálogo seed: `docs/analysis/floor-lexicon-catalog-v0.1.0.md` — **5 gaps**, cobertura 383 **não** 80%.  
Mira: `docs/handoffs/2026-09-04-mira-amostra-lexico.md` — 8 last4; piores: pezinho→pedicure (`1000`), pezinho timeout (`4501`), masculino→feminino (`4749`).  
Landing contada: **68 last4**. Quinn **não** PASS na fatia 383.

## W5 aberto (Victor 04/09 ~12:16 BRT)

ACK Onda 2 **fase A** (código). Kapso recepção da semana = vazio; cobertura máxima = junho. SOT: `docs/analysis/floor-corpus-reception-20260904.md`.

## W6 fechado (Dex 04/09) — Fase A local, **não** live

Código na branch: keywords + CATALOG_SYNONYMS + pezinho ≠ pedicure + ROLE_RE + relógio vs duração + gender sticky + strip HABILITACAO/ID.  
Container live continua `fa0ec92`. Kill switch off. Sem publish.

## W8 — Gage publish (Victor ACK ~12:50 BRT)

Commit/publish Fase A. Sem export `94831`. **Não religar.** Plano: `docs/ops/2026-09-04-gage-publish-plan-onda2-fase-a.md`.  
Fase B kickoff (briefing, sem cola): `docs/analysis/2026-09-04-orion-onda2-fase-b-kickoff.md`.
