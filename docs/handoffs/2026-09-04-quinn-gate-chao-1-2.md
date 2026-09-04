# Gate Quinn — chão 1+2 (oferta cabe + snapshot fresca)

> 2026-09-04T14:01-03 · Quinn (@qa, Test Architect) · `*gate` sobre persist Dex. SOT Aria.
> Gate completo: [docs/qa/gates/2026-09-04-chao-1-2-oferta-snapshot.yml](../qa/gates/2026-09-04-chao-1-2-oferta-snapshot.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **PASS** (quality score **96**) |
| SOT | [Aria tetos](../analysis/2026-09-04-aria-chao-1-2-tetos.md) |
| Stories | [chão 1](../stories/salon-whatsapp-chao-1-oferta-cabe.md) · [chão 2](../stories/salon-whatsapp-chao-2-snapshot-fresca.md) · Draft |
| Branch / base | `feature/tess-commit-honesty` / `7482d3d` · chão 1+2 **uncommitted** |
| Testes | **69/69** (slots + assembler + local-store) · Quinn reexecutou · syntax 4/4 |
| `blocks_publish` | *(vazio)* |
| Publish | **no** — epic pode continuar; este gate não publica |
| Não executado | deploy, Hostinger, rsync, smoke 0007, BOT_ACCEPT_ALL, paste 46589, religar, POST Trinks |

Anti-self-review: Dex implementou. Quinn não escreveu este código.

## Veredito por hunt

| # | Verificação | Status |
|---|---|---|
| 1 | Não republicou filterCatalogForProfile / isCompatible / CATALOG_SYNONYMS / ensureSlotSnapshot 45min / worker 1440 / OP012 24h | **PASS** |
| 2 | resolveOfferDurationMin: sem 2º arg = cap 1–3 + família homogénea; 2h isolado=0; 2h de atendimento=120 | **PASS** |
| 3 | Occupancy com durationMin>0 usa fitting; zero fit → sem janela contínua; sem HH:MM inventado | **PASS** |
| 4 | subtract / listActive: 0 GET Trinks; SELECT sem telefone | **PASS** |
| 5 | snapshot.offer emitido; snapshot.stale ≥45 intacto | **PASS** |
| 6 | Invariantes live verdes (1 SKU 120, 4→1, as 16h, snapshot≤2, isCompatible 90d) | **PASS** |
| 7 | Focused tests 69/69 (Quinn) | **PASS** |

## O que está sólido

**Duração da fala, não do dump.** Sem opts, misto >3 continua 0 e 1 SKU 120 continua 120. Família maquiagem homogénea >3 passa a 120. Token `2h de atendimento` / `leva 2h` = 120; `2h` isolado e `as 16h` não são duração.

**Occupancy deixa de inventar manhã.** Com `durationMin>0` a linha usa starts que cabem. Zero fit = `sem janela contínua de Xmin` — sem `há vagas` e sem `12:30`. Clock path de 90 min intacto.

**Corrida 1–44 min com row local.** `listActiveAppointmentWindowsForDate` lê Postgres (scheduled/confirmed, sem telefone). `fetchSlotsGrouped` subtrai overlap `[T, T+dur)` — 0 GET extra. Confirm / recheck intocados.

**Frescura visível sem apertar 45.** `snapshot.offer` em compact BOOKING com grade (`age`, `stale_after_min=45`, `refreshed`, `subtracted_occupied`). Aviso + `snapshot.stale` só ≥45. Worker 24h e CLI OP012 fora.

## Findings que não bloqueiam

**TEST-01 (low)** — E2 unit não prova o emit conjunto `snapshot.stale` + `snapshot.offer` no server. O bloco stale (~1531) está lá. Sem patch.

**MNT-01 (low)** — padrões de duração copiados em `slots.js` em vez de um export. Stems iguais ao `isDurationHourToken`. Sem patch.

Residuais Aria §5 (corrida sem row, worker 24h nos outros dias, `durationMin=0` occupancy crua) continuam verdadeiros — não são defeito Dex.

## Publish

`blocks_publish` vazio. Orion **pode continuar o epic** sem publish. Este gate **não** autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, smoke `0007`, paste 46589, religar, POST Trinks.

Nenhum código de aplicação foi alterado nesta revisão — só gate, handoff e ACs/T3 + QA Results das stories.

— Quinn, guardião da qualidade 🛡️
