# Client terms catalog template

Use com `catalog-client-terms`. Substituir `{placeholders}`.

---

# Floor Lexicon Catalog v{version}

**Janela:** {window_from} → {window_to} (BRT)  
**Gerado:** {generated_at}  
**Corpus:** {corpus_path}  
**Autor:** Aria (@floor-lexicographer)

## Stats

| Métrica | Valor |
|---|---:|
| Fios (last4 distintos) | {threads} |
| Falas únicas cliente | {utterances} |
| Intent null | {intent_null} |
| Hit FILTER_SERVICE_KEYWORDS | {kw_hits} ({kw_hit_pct}%) |

## Ranking — serviços pedidos na fala

| # | Termo/padrão | Ocorrências | SKU Trinks | Status |
|---:|---|---:|---|---|
| 1 | {term} | {n} | {sku_or_gap} | match / gap / implicit |

## Ranking — dificuldade

| # | Padrão | Eventos | last4 amostra |
|---:|---|---:|---|
| 1 | timeout | {n} | {last4} |
| 2 | guard.blocked | {n} | {last4} |
| 3 | handoff.human | {n} | {last4} |

## Catálogo de termos

| Termo cliente | Intenção | Destino | Dificuldade | Evidência |
|---|---|---|---|---|
| {termo} | serviço / prof / tempo / FAQ / landing / ruído | SKU / slot / handoff | {tag} | last4 {xxxx}: "{citação}" |

## Gaps vs FILTER_SERVICE_KEYWORDS

| Termo | Por que fura | Sinónimo candidato Onda 2 |
|---|---|---|
| tintura | fora de color/tonaliz | color |
| gloss | ausente | hidrat? (validar SKU) |
| pezinho | coloquial cabelo | corte / retoque |
| maquiadora | cargo ≠ maquiagem | maquiagem + prof |

## Hipóteses Orion

| Hipótese | Veredito | Evidência |
|---|---|---|
| Triagem fraca no dado (intent null alto) | confirmado / refutado | {n} null / {total} |
| Landing "vim pelo Studio Tirra" → UNCERTAIN | confirmado / refutado | {n} fios |
| Encaixe + prof antes de SKU | confirmado / refutado | {n} falas |

## Buraco recepção outbound

{honest_inventory — last_staff_outbound_at, Kapso history_sync status}

---

*Sem E.164. Sem prompt 46589. Próximo: score-keyword-coverage → corpus-quality-gate → handoff-triage-wave.*
