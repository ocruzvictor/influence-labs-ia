# Gate Quinn — chão 3 intent cauda

> 2026-09-04T17:08Z · Quinn (@qa, Test Architect) · `*gate` sobre persist Dex. SOT Aria.
> Gate completo: [docs/qa/gates/2026-09-04-chao-3-intent.yml](../qa/gates/2026-09-04-chao-3-intent.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **PASS** (quality score **96**) |
| SOT | [Aria tetos](../analysis/2026-09-04-aria-chao-3-intent-tetos.md) |
| Story | [salon-whatsapp-chao-3-intent-cauda](../stories/salon-whatsapp-chao-3-intent-cauda.md) · Draft |
| Branch / base | `feature/tess-commit-honesty` / `7482d3d` · digest `20557e2203b5` |
| Testes | **125/125** (intent + profiles + assembler + history + cli-ops) · Quinn reexecutou · syntax 6/6 |
| `blocks_publish` | *(vazio)* |
| Publish | **no** — epic pode continuar; este gate não publica |
| AC4 / T3 | **abertos** — Dara cola os inteiros; Quinn não inventa N |

Anti-self-review: Dex implementou. Quinn não escreveu este código.

## Veredito por hunt

| # | Verificação | Status |
|---|---|---|
| 1 | Passive Kapso classifica e persiste SCHEDULING/FAQ via `intentToPersist` | **PASS** |
| 2 | Denylist null: mídia, `[AUDIO TRANSCRITO]`, vazio, lero (oi, kkkk, dia a dia, duração sozinha) | **PASS** |
| 3 | Landing “vim pelo Studio Tirra. Quero agendar” → SCHEDULING + MIN, sem FULL | **PASS** |
| 4 | “sexta final do dia” + “com o André” persistem SCHEDULING | **PASS** |
| 5 | SCHEDULING scoped sem SKU → MIN, salvo `keepBookingWithoutSku` | **PASS** |
| 6 | Sem 9º intent. Sem FILTER/stem. Sem `sku_id` de sinónimos | **PASS** |
| 7 | `resolveOfferDurationMin` + telemetry `sent_chars`/`timed_out`/`salon_day` intactos | **PASS** |
| 8 | Replay write-free. `dump_corpus_semana` default `dedup=true` intocado | **PASS** |
| 9 | Sem WhatsApp, smoke `0007`, Hostinger, TESS PATCH, religar | **PASS** |

## O que está sólido

**Furo A.** Inbound Kapso deixa de gravar `agent:'passive'` sem intent. `classifyTessIntent` + `intentToPersist({ path: 'passive' })`. Só `{SCHEDULING, FAQ}` no passivo.

**Denylist.** Mídia, STT, vazio e lero ficam null na coluna. Skip TESS e `tess.turn` continuam a ver o intent classificado.

**Furo B.** Landing / sexta / André sem stem → MIN, zero catálogo. “10h” no meio do funil → BOOKING. FULL mode intocado.

**Freeze.** 8 intents. `DATE_RE` sem `final do dia`. `booking-parser.js` limpo vs HEAD. I5/I6/I7 + vinicius angeli + pé-mão verdes.

**Replay.** Helper miniatura: `would_fill=3`, denylist fora, last4 only, zero UPDATE. Default `dedup=true` do dump da semana não mudou.

## O que fica aberto

**AC4 / T3.** Replay local do dump 01–04/09 ainda sem inteiros publicados. Quinn não rodou o script contra o banco e **não** inventa `would_fill` / `replay_null`. Baseline Orion **383** permanece constante. Sem `~80%`. Sem fechar as 383.

T4 e AC5 marcados (`blocks_publish` vazio). Status da story permanece Draft.

## Publish

Este gate **não** autoriza deploy, religar, `BOT_ACCEPT_ALL`, smoke `0007`, Hostinger, rsync, TESS PATCH, paste 46589, POST Trinks.

— Quinn, guardião da qualidade 🛡️
