# Dex-Night live evidence — 2026-09-02

**Persona:** Dex-Night (evidence only, no patch)  
**Orquestração:** @aios-master (Orion)  
**Plano ref:** `docs/ops/plano-correcao-go-live-tess-2026-09-02.md`  
**Coletado:** 2026-09-03 ~02:50 UTC  

---

## live_version

| Campo | Valor |
|---|---|
| **StartedAt** | `2026-09-02T15:02:37Z` |
| **Image** | `infra-backend` (`6da561ff0caf…`) |
| **Health** | `https://api.studiotirra.com.br/health` → `status: ok`, agent `46589`, mode `OPEN`, accept_all `true` |
| **Uptime at collect** | ~42 445 s (~11.8 h) |

### Diff live vs repo local (`backend/`)

MD5 **idênticos** nos 7 arquivos do deploy:

| Arquivo | MD5 (live = local) |
|---|---|
| `server.js` | `259255b3…` (mtime host `2026-09-02 14:29Z`) |
| `tess-context-intent.js` | `1f433c37…` |
| `tess-context-slots.js` | `c6d46e61…` |
| `tess-context-assembler.js` | `d01d7c3b…` |
| `booking-parser.js` | `53fd506e…` |
| `slot-windows.js` | `62201085…` |
| `tess-premium-sanitize.js` | `af9acddc…` |

**Conclusão:** fatia A/B/C1–C3 do plano **está no ar** (byte-a-byte com o repo local). Não é drift de deploy.

### Marcadores A/B/C no LIVE

| ID | Marcador | Live |
|---|---|---|
| **C1** | `let profsPayload` + assign do assembler (`server.js` ~1298/1364) | ✅ presente |
| **C2** | `markSlotWindowAvailable` + `durationMin` (`trinks-webhook-processor.js`) | ✅ presente |
| **C3** | sanitize outbound `/(agendado\|confirmado\|pronto)\s*[,!.]*/` (`booking-parser.js`) | ✅ presente |
| **A1** | `agendar` / `vim pelo` → SCHEDULING (`tess-context-intent.js:101`) | ✅ presente |
| **A2** | `isSimpleBookingBundle` bypass `hasMultipleIntents` | ✅ presente |
| **A3** | `PROFESSIONAL_RE` jackie/kamila/dylan/eli/erik + `profNameMatchesToken` | ✅ presente |
| **A5** | `pickStartsForOffer` / `startsFittingDuration` / `durationMin` no assembler | ✅ presente |
| **B1** | `sanitizePrematureConfirm` + `sanitizePremiumResponse` no outbound | ✅ presente |
| **B2** | `booking.dropped` event (`server.js:1813`) | ✅ código; **0 eventos** na janela |
| **B3** | loop `bookingReschedules[]` | ✅ presente |
| **B4** | fallback `tess-fallback` + 2-phase | ✅ presente |

**Pós-StartedAt:** zero linhas `profsPayload is not defined` nos logs (C1 efetivo).

---

## event_counts

Janela primária: `received_at >= 2026-09-02T15:02:37Z` (StartedAt).  
Janela secundária (StartedAt > 2 h atrás): também desde `2026-09-02T13:54:00Z`.

### Desde StartedAt (15:02Z)

| event | count |
|---|---|
| `tags.parsed` | 139 |
| `guard.blocked` | 11 |
| `handoff.human` | 7 |
| `booking.created` | 2 |
| `booking.cancelled` | 1 |
| `booking.failed` | 1 |
| `tess.empty` | 1 |
| `tags.leaked` | 0 |
| `booking.dropped` | 0 |
| `resume.requested` / `resume.sent` | 1 / 1 |

### Desde 13:54Z (delta vs StartedAt)

+18 `tags.parsed`, +1 `tess.empty` (eventos entre 13:54–15:02, pré-restart final).

### Trinks (`trinks_api_requests`, http_status ≥ 400)

| method | status | origin | count |
|---|---|---|---|
| POST | 400 | `agent_mutation_create_client` | 1 |

Mutations 2xx: POST create ×2 (201), PUT reschedule ×1 (204).

### Perfil TESS (logs, pós-StartedAt)

| Métrica | count |
|---|---|
| turns `context_profile=BOOKING` | 225 |
| turns `context_profile=FULL` | 48 |
| turns `tess_credits=0` | 1 |
| `tess.context_bytes` horarios > 4k (DB) | 0 |

### handoff.human (motivo)

| last4 | motivo | ts |
|---|---|---|
| `5668` | encaixe | 21:22Z |
| `5704` | consulta_agendamentos_anteriores | 19:43Z |
| `3848` | cliente_pediu_humano / multi_servico | 17:17–17:38Z |
| `7163` | conflito_habilitacao_profissional | 16:45Z |
| `8995` | cliente_pediu_humano | 16:35Z |
| `8134` | dado_indisponivel | 15:23Z |

### guard.blocked (amostra)

| last4 | reason | ts |
|---|---|---|
| `9605` | inicio nao esta na grade livre | 21:40–21:42Z (×3) |
| `4749` | janela continua 30min < duracao 60min | 21:19Z |
| `5668` | inicio nao esta na grade livre | 21:19Z |
| `8741` | inicio nao esta na grade livre | 19:33–19:42Z |
| `5718` | inicio nao esta na grade livre | 16:19Z |

---

## runtime_errors[]

| ts (UTC) | last4 | mensagem |
|---|---|---|
| 2026-09-03 02:13:03 | `0101` | `Booking creation FAILED: Trinks 400: /clientes — Telefones[0].TipoId: 'Tipo Id' must not be empty.` |
| 2026-09-03 02:15:14 | `0101` | `[TESS] Empty response` status=failed, input_chars=5970, tess_credits=0 |
| 2026-09-02 19:52:43 | `8397` | `Booking cancel FAILED: Nenhum cancelamento concluido` |

Sem `profsPayload is not defined`, `create_crash` explícito, ou `booking.dropped` nos logs pós-StartedAt.

---

## orphans[]

Definição Nightwatch: `tags.parsed` com `creates>0` ou `reschedules>0` sem `booking.*` / `guard.blocked` ±2 min.

| last4 | creates | reschedules | ts | nota |
|---|---|---|---|---|
| `2185` | 0 | 1 | 20:00:44Z | reschedule tag sem mutation visível ±2 min |
| `9605` | 1 | 0 | 21:38–21:44Z | vários FULL turns; creates posteriores têm `guard.blocked` |
| `5375` | — | — | 21:57–22:00Z | tags.parsed sem creates no payload (saudação/handoff?) |

**Com outcome dentro da janela:** `0101` creates=1 → `booking.failed` +1 s; `8741`/`5718` → `booking.created`; `9605` tardio → `guard.blocked`.

---

## gap_vs_plano

Plano marca A1–A5/B1–B4 como **feito no repo + deploy**. Evidência live:

| Plano diz | Vivo mostra |
|---|---|
| A1–A3 cortam FULL indevido | **Parcial:** 48 turns FULL vs 225 BOOKING; UNCERTAIN ainda dispara ~90k `user_payload` (ex. `8741`, `9605`, `0101` pós-falha) |
| A5/I3 relógios reais filtrados por duração | **Parcial:** guards disparam (`inicio nao esta na grade livre`, `janela continua 30min < duracao 60min`) — grade rejeita, mas Tess ainda propõe horários inválidos antes do guard |
| B1 sanitize sempre | Código ok; sem leak `tags.leaked`; validação de copy “Confirmado,” depende de Quinn/Mira |
| B2 `booking.dropped` se POST não roda | **0 eventos** — falhas viram `booking.failed` ou silêncio (`tess.empty`), não `dropped` |
| C1 profsPayload | **OK** pós-StartedAt (0 crashes) |
| C2 markSlot janela | Código ok; guards sugerem slot stale ainda ocorre em edge cases |
| Deploy 13:54Z smoke | Health ok; **novo P0** `0101`: POST cliente novo falha TipoId → booking.failed → FULL → tess.empty (créditos zerados) |

**Não é “código antigo no ar”.** Falhas são **runtime/comportamento** e **gap Trinks API** não coberto pelo plano.

---

## hipótese_codigo (sem implementar)

1. **`server.js` → `createClientInTrinks`** — payload `telefones: [{ ddd, numero }]` sem `tipoId`; Trinks 400 bloqueia CREATE para cliente novo (`0101`). Hipótese: incluir `tipoId` (celular) conforme contrato Trinks.
2. **`tess-context-intent.js` → classificação UNCERTAIN** — histórico longo ou turnos pós-falha ainda escalam FULL (48×); A2 bundle não cobre continuação após `booking.failed`. Hipótese: pin SCHEDULING quando thread já tem serviço+prof+data no histórico.
3. **`server.js` → path pós-`booking.failed`** — tag parseada gera failed event mas Tess re-entra FULL; B2 `booking.dropped` nunca persiste. Hipótese: após failed, forçar copy honesta + não re-expandir contexto FULL.
4. **`tess-credit-usage` / budget diário** — `0101` tess_credits=0 → empty; alerta carteira API indisponível nos logs. Hipótese: gate local antes de chamar TESS quando budget esgotado (C2 plano, não deployado).
5. **`booking-parser.js` / guards** — Tess propõe horário → guard bloqueia (I3 fail upstream do guard, não downstream). Hipótese: reforço no prompt ou compactação HORARIOS quando prof conhecido (A5 já no código; falha é modelo ignorando grade).

---

## Dex-Night status

**PATCH RECUSADO** — sem YAML Supervisor com last4+timestamp nesta chamada. Evidência entregue para Nox/Quinn/Mira.
