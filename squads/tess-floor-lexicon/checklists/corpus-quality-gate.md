# Corpus quality gate (Onda 1)

Gate Quinn antes de abrir Onda 2. Referência: `docs/analysis/2026-09-04-orion-ondas-lexico-triagem.md` DoD item 6.

## Cobertura

- [ ] Corpus extraído cobre janela declarada (seg → off bot ou `--to` explícito)
- [ ] ≥ 50 fios last4 distintos OU motivo documentado se menor (bot off, semana curta)
- [ ] Stats footer: fios, falas únicas, intent null count presentes
- [ ] Buraco recepção outbound inventariado (Kapso/sync = 0 se aplicável)

## Privacidade

- [ ] Zero E.164 em corpus, catálogo, coverage report, handoff pack
- [ ] Citações usam last4 + trecho literal apenas
- [ ] Nenhum export WhatsApp Business sem redaction

## Integridade analítica

- [ ] Catálogo versionado (semver no filename)
- [ ] Termos gap têm evidência last4 (não chute de SKU)
- [ ] Hit rate calculado sobre falas únicas dedupadas
- [ ] Hipóteses Orion marcadas confirmado/refutado com N

## Travas operacionais

- [ ] Nenhum paste do prompt 46589 nos artefatos
- [ ] Nenhum Trinks POST/PATCH/PUT executado durante Onda 1
- [ ] Kill switch permanece off (não sugerido religar neste gate)
- [ ] P-BUDGET / caps crédito não reabertos

## Amostra qualitativa (Mira)

- [ ] `@floor-quality` leu ≥ 4 fios (IA + inbound-only mix)
- [ ] Notas Mira referenciadas no handoff ou marcadas "pendente"

## Veredito

- [ ] **PASS** — todos os itens críticos (privacidade + cobertura + semver) OK
- [ ] **FAIL** — listar blockers; não executar `handoff-triage-wave`

Sign-off: Quinn-Watch / Quality Sentinel (tess-nightwatch) ou Victor.
