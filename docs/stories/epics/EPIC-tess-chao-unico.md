# EPIC: Um chão — oferta, fala, memory e fatura no mesmo teste

**Status:** Draft · backlog criado por Orion 2026-09-04 · **ratificar @pm / @sm** antes de virar sprint  
**Criado em:** 2026-09-04  
**Owner:** @pm (estrutura) · stories @sm · orquestra @aios-master  
**Branch:** `feature/tess-commit-honesty`  
**SOT:** [programa](../../analysis/2026-09-04-orion-programa-chao-unico.md) · [estacionados](../../analysis/2026-09-03-orion-estacionados.md) · [ondas léxico](../../analysis/2026-09-04-orion-ondas-lexico-triagem.md) · [Pedro](../../analysis/2026-09-03-pedro-valerio-blueprint-tess.md) · [fatia slots](../../analysis/2026-09-04-orion-fatia-slots-contexto.md)

**Não** reabre [EPIC-tess-commit-honesty](EPIC-tess-commit-honesty.md) (Done 1–13).

## Objetivo

Fechar o leftover que ainda mistura vertical no WhatsApp: horário que não cabe, foto velha da agenda, cauda sem intent, memories TESS atrasadas em relação ao prompt, crédito sem dimensão, timeout único. **Um** smoke humano no `0007` no fim — não no meio.

## IN

- Buracos pós-`a08f23b` / `9cb5834` (não republicar o mesmo fio).
- Classificar a cauda (landing / tempo / prof / FAQ) — **não** “zerar 383”.
- PATCH collection 39496 alinhada ao v3.2.3 (pezinho + não falar `TA -`).
- PV-P1-2 e PV-P1-5 (despausa fatura/timeout).
- Story 7 = roteiro [congelado](../../ops/smoke-0007-roteiro-lexico-v323.md).

## OUT

- Partir 46589 · funil CRM · Thinking · Hostinger · rsync · `BOT_ACCEPT_ALL=true` · André 10:30 · CREATE `9800` · replay `0101`.
- Skip FAQ/preço no inbound (OP013/014) sem ACK novo depois da story 5.
- Visão do fio, stuck, trace_id, idempotência Postgres (estacionados 3–5, 11–16).
- Reescrever KB comercial (laser/visagismo/mechas) — só o conflito com as ondas.

## Stories

| # | Story | Fecha | Depende | Pts | Status |
|---|---|---|---|---|---|
| 1 | [Oferta só cabe](../salon-whatsapp-chao-1-oferta-cabe.md) | PARK-SLOTS resto | Aria SOT | 8 | Quinn PASS 96 · sem publish |
| 2 | [Snapshot fresca](../salon-whatsapp-chao-2-snapshot-fresca.md) | PV-P2-2 / OP012 resto | Aria SOT | 5 | Quinn PASS 96 · sem publish |
| 3 | [Intent da cauda](../salon-whatsapp-chao-3-intent-cauda.md) | 383 / null | Aria SOT | 8 | Quinn PASS · AC4 drop 626 · **383 aberta** · sem publish |
| 4 | [Memories TESS](../salon-whatsapp-chao-4-kb-memories-tess.md) | KB 39496 vs v3.2.3 | — | 5 | Quinn PASS 96 · local isolado · **sem PATCH** até ACK |
| 5 | [Crédito por turno](../salon-whatsapp-chao-5-credito-dimensao.md) | PV-P1-2 · G-P6 | Dara SOT | 5 | Quinn CONCERNS · sem publish |
| 6 | [Timeout por perfil](../salon-whatsapp-chao-6-timeout-perfil.md) | PV-P1-5 · G-P10 | 5 | 5 | Quinn CONCERNS · AC3 sem p95 · sem publish |
| 7 | [Smoke único `0007`](../salon-whatsapp-chao-7-smoke-unico-0007.md) | prova no chão | 1–6 | 3 | Relatório · #2/#8 FAIL classificados · `global=false` |
| 8 | [Pezinho cortesia](../salon-whatsapp-chao-8-pezinho-cortesia.md) | #2 smoke | time salão | 5 | Draft · Aria |
| 9 | [Ausência ocupa](../salon-whatsapp-chao-9-ausencia-ocupa.md) | #8 smoke | Aria | 8 | Draft · Aria |
| 10 | [Recorrência Trinks](../salon-whatsapp-chao-10-recorrencia-trinks.md) | painel vs IA | Dara+Aria | 5 | Discovery-STOP · Quinn PASS |
| 11 | [Oferta 60 min + pezinho curto](../salon-whatsapp-chao-11-oferta-60min-pezinho-curto.md) | smoke #8 residual + #2 tom | chão 8+9 live | 5 | **Draft** · Victor 04/09 |

**Adendo 04/09:** [pezinho / Ausência / recorrência](../../analysis/2026-09-04-orion-adendo-pezinho-ausencia-recorrencia.md). Sem religar até novo ACK.

## DoD do epic

- Stories 1–6 Done + gate @qa.  
- Story 7: roteiro inteiro no `0007`, um relatório last4, sem misturar “fail de outra vertical” como regressão da fatia.  
- Kill switch off até o start da 7. Sem OPEN.
