# Floor corpus — extract-week-corpus (stats)

Janela BRT: **2026-09-01** → **2026-09-04** (inclusive)  
Bounds UTC (stored): `2026-09-01 03:00:00` ≤ created_at < `2026-09-05 03:00:00`  
Dedup: sim (last4 + texto normalizado)  
CLI: `backend/scripts/salao/contexto/dump_corpus_semana.js` (Dex W2 — **ainda não live** no container `fa0ec92`)

Fonte desta rodada: SELECT no VPS (read-only) + dump last4 local. Zero E.164 neste arquivo.

## Stats

| Métrica | Valor |
|---|---:|
| threads_last4 | 97 |
| unique_utterances (user, dedup) | 629 |
| tess_replied | 90 |
| inbound_only | 7 |
| intent_null_count (user bot-processed, bruto) | 383 / 511 |
| staff_outbound_in_window | **0** |

## Reprodução (depois do próximo archive backend)

```bash
# no container backend, com o JS novo
node scripts/salao/contexto/dump_corpus_semana.js --from 2026-09-01 --to 2026-09-04
```

Stdout JSON = lista completa last4. Não versionar E.164. Tabela longa de falas fica fora deste md de propósito (PII residual em texto).

## Buraco recepção — tentado Kapso (04/09)

`bot_thread_state.last_staff_outbound_at` na janela = 0.  
Kapso Platform API: linha bot `0517` = 100% `cloud_api` nesta semana; linha recepção `9426` (`94831`, coexistência) **sem mensagens após 2026-06-20**. Detalhe: `docs/analysis/floor-corpus-reception-20260904.md`.  
Fala da recepção **desta semana** continua fora do Postgres e fora do Kapso. Máximo extraído = histórico junho (não misturar nas 629).

_Artefato sem E.164 — apenas last4._
