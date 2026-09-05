# Story: PILOT_N — soft-open first-5 (claim atômico)

**Epic:** operação Tess / qualidade pós-publicação  
**Tipo:** Brownfield  
**Status:** ready-for-review  
**executor:** @dev  
**quality_gate:** @qa  
**Agente executor:** @dev · schema @data-engineer (018) · desenho @architect · orquestração @aios-master  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — ACs travados por Victor (2026-09-04)  
**Branch sugerida:** `feature/pilot-first-n-soft-open` (base limpa; **não** `feature/tess-commit-honesty`)  
**Pedido / GO:** Victor / @aios-master 2026-09-04  
**Arquitetura:** [docs/architecture/pilot-first-n-soft-open.md](../architecture/pilot-first-n-soft-open.md)

## User story

Como operação do salão, quero ligar a Tess depois de uma versão nova e deixar ela atender **só os 5 primeiros números que pedirem horário, serviço ou cancelamento**, para que a recepção julgue a qualidade sem abrir o salão inteiro. Esses 5 continuam na lista de permissão. Qualquer outro número que chegar depois fica em silêncio. A Tess **não** entra em conversa em que a recepção já falou.

## Contexto

Hoje o bot tem três modos reais: OPEN (`BOT_ACCEPT_ALL=true`), WHITELIST (`bot_whitelist.mode='allow'`) e kill switch (`bot_toggles.global=false`). Soft-open de qualidade é manual: abre OPEN, a recepção olha, alguém fecha e cola números na whitelist. No pico, o 6º entra antes do freeze.

Esta story productiza a regra. **Não** é OPEN-depois-congela. PILOT é modo de primeira classe: a Tess só fala com quem já é `allow` (dono / 0007 / cohort) **ou** com quem acaba de ganhar uma vaga por inbound não-trivial.

## Decisões travadas (não reabrir)

| Trava | Valor |
|---|---|
| N | **5** (CLI aceita `--n`, default 5) |
| O que consome vaga | Primeira mensagem **não-trivial**: `SCHEDULING`, `CANCEL`, `RESCHEDULE` via `classifyTessIntent` |
| O que **não** consome | `TRIVIAL`, `FAQ`, `PRICING`, `UNCERTAIN`, `HANDOFF_LIKELY`, mídia sem texto, “oi” / “obrigado” |
| Depois do teto | Cohort permanece `allow`; demais silent |
| Conversa em andamento | Sem claim se `human-handled` ativo **ou** `last_staff_outbound_at` < 10 min **ou** mode `human_only`/`block` |
| Dono / 0007 | Não ocupam vaga; dono (`isOwnerPhone`) sempre passa; `allow` pré-existente não entra em `bot_pilot_claims` |
| Kill switch | `global=false` silencia inclusive o cohort |
| OPEN / WHITELIST | Idênticos quando `pilot=false` |
| UI / prompt / Trinks | Fora |

## Acceptance Criteria

- [x] **AC1:** CLI `node backend/scripts/salao/bot/pilot_start.js --n 5` cria run `active` com `n=5`, liga `bot_toggles.pilot=true`, **não** seta `BOT_ACCEPT_ALL`. `pilot_status.js` mostra `mode=PILOT`, `n`, `claimed_count`, last4 only, `started_at`.
- [x] **AC2:** CLI `pilot_stop.js` congela o run (`frozen`), desliga `pilot`, deixa as rows `allow` do cohort. Próximos inbound de fora do cohort ficam silent (WHITELIST).
- [x] **AC3:** Com PILOT ativo e vagas, inbound `TRIVIAL`/`FAQ` de número novo **não** cria claim e Tess **não** responde.
- [x] **AC4:** Com PILOT ativo e vagas, inbound `SCHEDULING`/`CANCEL`/`RESCHEDULE` de número novo sem takeover → claim atômico + `bot_whitelist.mode='allow'` + Tess segue o fluxo normal.
- [x] **AC5:** Dois claims concorrentes com 1 vaga → exatamente um `allow` no cohort; o outro silent (`cap_reached`).
- [x] **AC6:** 6º número distinto não-trivial após o teto → silent, zero row de claim, whitelist inalterada.
- [x] **AC7:** Números já claimed continuam sendo atendidos depois do teto.
- [x] **AC8:** Recepção no fio (tag **ou** outbound do painel Kapso que a Tess não enviou, janela 24h), `human_only` ou `block` → sem claim, Tess silent.
- [x] **AC9:** `isOwnerPhone` e `allow` pré-existente (ex. last4 `0007`) não incrementam `claimed_count`.
- [x] **AC10:** `bot_toggles.global=false` silencia cohort e candidatos. Health degrada se 018 ainda não rodou (não 500).
- [x] **AC11:** `/health` e health lite: `mode=PILOT` quando toggle ligado; `claimed_count` + `n`; sem telefone completo.
- [x] **AC12:** Com `pilot=false`, testes existentes de OPEN (`accept_all`) e WHITELIST (`not_allowlisted` / `allow`) permanecem verdes. `npm test` da fatia nova passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2, schema):** Migration `018_bot_pilot_cohort.sql` + rollback. Lib `backend/lib/bot-pilot.js` (`startPilot`, `stopPilot`, `getPilotStatus`, `tryClaim`, `isClaimableIntent`). CLIs em `backend/scripts/salao/bot/`.
- [x] **T2 (AC3–AC9):** Gate no webhook Kapso **antes** do watchdog: candidato PILOT só segue se claim ou já `allow`. Áudio-only classifica depois da transcrição, ainda antes de `processMessage`.
- [x] **T3 (AC5, testes):** `backend/test/bot-pilot.test.js` — race (1 vaga, 2 phones), trivial, human/staff, cap, owner, stop→whitelist.
- [x] **T4 (AC10, AC11):** Health + lite. Fail-safe se relação 018 ausente.
- [x] **T5 (AC12):** Não alterar o contrato de `resolvePhoneAccess` para OPEN/WHITELIST. CodeRabbit / lint da fatia.

## File List (esperado)

- `infra/migrations/018_bot_pilot_cohort.sql`
- `infra/migrations/018_bot_pilot_cohort.rollback.sql`
- `backend/lib/bot-pilot.js`
- `backend/lib/bot-thread-state.js` (`isStaffSpokeRecently`)
- `backend/server.js` (gate PILOT + health)
- `backend/scripts/salao/bot/pilot_start.js`
- `backend/scripts/salao/bot/pilot_status.js`
- `backend/scripts/salao/bot/pilot_stop.js`
- `backend/test/bot-pilot.test.js`
- `docs/architecture/pilot-first-n-soft-open.md`
- `docs/stories/salon-whatsapp-pilot-first-n-soft-open.md`

## Fora de escopo

- UI admin / tela de toggles
- Mudança de prompt TESS ou booking Trinks
- `BOT_ACCEPT_ALL=true` como parte do start
- Liberar vaga se a recepção assumir um dos 5
- Auto-start no publish da versão

## Riscos

| Risco | Mitigação |
|---|---|
| Race no N-ésimo slot | `pg_advisory_xact_lock` + `COUNT` na mesma transação + PK `(run_id, phone)` |
| Classificar “oi quero cortar” como trivial | Reusa `classifyTessIntent` (já promove compound → SCHEDULING) |
| Entrar em fio da recepção | Gates human-handled + staff 10 min + denylist **antes** do claim |
| Abrir o salão por engano | Start **não** toca `BOT_ACCEPT_ALL`; PILOT ≠ OPEN |

## Dev Notes

- Claim **antes** de `startOutboundWatchdog` no caminho texto. Áudio-only: claim após transcrição, sem Tess se falhar.
- `tryClaim` **nunca** sobrescreve `block` / `human_only`.
- Eventos: `pilot.claimed`, `pilot.rejected` (payload last4 + reason; sem E.164 no log de health).
- Cache `getBotState` 5s: `invalidateCache()` após claim/start/stop.

## CodeRabbit / QA

- Specialized: concurrency (advisory lock), PII (last4 only), capability preservation OPEN/WHITELIST.
- Gate: unit da fatia + `node --test test/bot-state.test.js test/bot-pilot.test.js`.
- Live: só depois de 018 no VPS + CLI start. Kill switch continua o abort.

## Dev Agent Record

### Change Log

- 2026-09-04 — River/Orion: draft a partir das travas Victor (N=5, não-trivial, Story B). [River](c863b343-b2cd-4f2d-8c2d-b2a95bcb5889) falhou por limite de modelo; @aios-master executou o *draft.
- 2026-09-04 — Dex/Orion: implementação + 27 testes verdes (`bot-pilot`, `bot-state`, `bot-thread-state`). Aria desenho em `docs/architecture/pilot-first-n-soft-open.md` ([Aria](830ab4a6-549e-43a3-a988-ce9907e5dae4) também falhou no spawn; @aios-master executou o desenho). Status → ready-for-review. Live = Gage + 018 + CLI start.
- 2026-09-05 — Orion: lote pós-live P1 (Ana leftover + Rodolfo I1/zero_price + Ronaldo regressão). Fonte: handoffs A+B. P2 e chão 3/5/6/10 estacionados.
- 2026-09-05 — Dex: P1 implementado (T6–T8). Helpers `resolveCreateMoveLeftoverId` + `hydrateCatalogPrice`; create-as-move cancel leftover; confirmo-aqui global; zero_price blocked outcome. 119 testes fatia verdes.
- 2026-09-05 — Dex: F1–F5 info-open + confirm-hold. `isInfoOpenIntent`, `resolveKapsoAccess`, gate Kapso, `bookingMutationsAllowed`, áudio quieto info-open, `isConfirmAskOutbound` + hold. 170/170 gate verdes.
- 2026-09-05 — Orion: T11 live `c043a75`. Victor ACK próxima sessão: P2.2–P2.4 + 5 AC3 (05/09 PASS) + 6 `duration_ms` + léxico 383 + chão 10 no plano. Sem novo PILOT. Smoke #8 fechado.
- 2026-09-05 — Dex/Orion: P2.2 ALTERNATIVAS · P2.3 linger/Ok · P2.4 digest · `duration_ms` em `tess.turn`. Cola 46589 no prompt file. Chão 10 contrato STOP. Léxico 383: 56 null pós-persist = ack/mídia, sem 2ª onda larga.

### File List (Floor recepção 2026-09-05)

- `backend/lib/tess-context-intent.js` — `isInfoOpenIntent`
- `backend/lib/bot-pilot.js` — `resolveKapsoAccess`
- `backend/lib/booking-parser.js` — `isConfirmAskOutbound`, `selectConfirmHoldBlocks`, `INFO_OPEN_MUTATION_COPY`
- `backend/server.js` — gate Kapso F1–F4, `processMessage` opts, áudio quiet, confirm-hold
- `backend/test/tess-context-intent.test.js` — unit isInfoOpenIntent
- `backend/test/booking-parser.test.js` — confirm-hold
- `backend/test/bot-pilot.test.js` — resolveKapsoAccess + P2.1 regressão
- `docs/stories/salon-whatsapp-pilot-first-n-soft-open.md` — F1–F5 / T9–T10
- `backend/lib/tess-context-slots.js` — P2.2 footer + ALTERNATIVAS
- `backend/lib/handoff-sla.js` — P2.3 linger
- `backend/lib/tess-context-bytes.js` — `duration_ms`
- `backend/server.js` — linger ack, digest, elapsed Tess
- `docs/prompts/tess-46589-p2-alternativas-handoff-linger.md` — cola 46589

## Pós-live P1 — floor 2026-09-05 (addendum)

**Status:** ready-for-review  
**Fontes (não inventar fora):** `docs/handoffs/2026-09-05-orion-pilot-p1-p2-qa.md` (IDs live) · `docs/handoffs/2026-09-04-orion-handoff-chao-restante.md` (contrato intent / STOP)  
**Conflito:** dossiê ganha no desenho; Handoff A ganha nos last4/evidência. Sem terceiro requisito.  
**Branch:** `feature/pilot-first-n-soft-open` · allowlist só · dirty tree honesty **não** misturar.  
**Veto:** `BOT_ACCEPT_ALL`, OPEN, POST Trinks de teste, paste 46589, Hostinger, `startPilot` sem ACK.

### Acceptance Criteria (P1)

- [x] **P1.AC1 Ana leftover:** No mesmo turno que CREATE/PUT de reagendamento, CANCEL ou PUT no `agendamentoId` antigo. Sem leftover “hoje”. Sem `booking.rescheduled` / “reagendei” se o id antigo não saiu. `not_owned` continua recusado. Sem `serieId` (chão 10 STOP).
- [x] **P1.AC2 Rodolfo confirm:** `sanitizePrematureConfirm` cobre “Confirmo aqui o agendamento”. Endereço / “te esperamos” só após `booking.created`. `catalog.zero_price_blocked` **não** viaja com bolha de “agendado”.
- [x] **P1.AC3 Rodolfo hydrate:** Guard `zero_price` permanece (feature). Se `trinks_services.price_cents > 0` (ou snapshot local), **não** bloquear; hidratar `preco`/`valor` antes do POST. Bloqueio só se hidratado ainda for 0 e não allowlisted. `markBookingOutcome('blocked')` no block.
- [x] **P1.AC4 Ronaldo regressão:** CREATE explícito + SKU preço > 0 + slot livre → mock 201 → `booking.created` → sucesso **depois** do 201. Sanitize **não** apaga sucesso pós-commit.

### Tasks

- [x] **T6 (P1.AC1):** Leftover no create-as-move / reschedule+create no mesmo turno. Reusar `resolveRescheduleAgendamentoId` + `cancelBookingInTrinks`. Teste Q1.
- [x] **T7 (P1.AC2, P1.AC3):** Padrão “confirmo aqui” no sanitize global; hydrate `getService().price_cents` antes do guard; outcome blocked. Teste Q2.
- [x] **T8 (P1.AC4, Q4):** Regressão Ronaldo + `node --test` fatia + `node --check backend/server.js`.

### P2 local (antes do VPS)

- [x] **P2.AC1 claim 2185:** `tryClaim` SCHEDULING só com sinal de marcar (ask / bundle 2-de-3 data|serviço|pro). “Quais técnicas / qual produto” / serviço sozinho **não** claima. Sem 9º intent — reusa `tess-context-intent` (`hasSchedulingAsk`, `isSimpleBookingBundle`, `hasFaqSignal`). CANCEL/RESCHEDULE intactos.
- [x] **P2.AC2 Quinn residual:** após `blocked`/`failed`, sanitize cobre “endereço” / “te esperamos” como fechamento (não sucesso). Não stripar FAQ legítimo sem a flag.

### P2 conversão (ACK Victor 2026-09-05 — próxima sessão)

Plano: `docs/handoffs/2026-09-05-orion-proxima-sessao-p2-chao.md`. Sem novo PILOT. Q5 superseded. Smoke #8 fechado (ACK + log `0007`).

- [x] **P2.2** alternativas 2–3 quando o slot não cabe (Vinicius `4749` / Daiane `4367` = P3). Footer + `ALTERNATIVAS` cross-pro. Cola 46589: `docs/prompts/tess-46589-p2-alternativas-handoff-linger.md`.
- [x] **P2.3** linger pós-handoff + ack “Ok” (backend). Cola da boca no mesmo arquivo. Recepção no fio (staff 24h) continua silent.
- [x] **P2.4** digest last4 + `trinksId` em `booking.created` (Ronaldo).

### Estacionado / outras frentes

Chão 10 cancel = STOP até GET série + contrato Aria (`docs/stories/salon-whatsapp-chao-10-recorrencia-trinks.md`). Story 5 AC3 = query 05/09 PASS (ver story 5). Story 6 = falta `duration_ms`. Léxico 383 = `docs/analysis/2026-09-05-orion-lexico-383-residual.md`. `startPilot` sem ACK. OPEN / `BOT_ACCEPT_ALL`.

**Restore allowlist (ritual VPS):** feito em T11. FAQ/PRICING = info-open. Novo PILOT ou booking customer-wide = ACK depois.

## Floor recepção 2026-09-05 — info-open + confirm-hold

**GO Victor:** recepção no fio (manual) → VPS seguro. FAQ alivia demanda. Confirmações em série no WhatsApp fazem o cliente achar que fechou e sumir; slot some no delay.

### Acceptance Criteria

- [x] **F1 info-open:** inbound `FAQ` ou `PRICING` de número **não** allowlisted / fora do PILOT → Tess **responde**. Sem `tryClaim`. Sem row `allow`. Sem `BOT_ACCEPT_ALL`.
- [x] **F2 mutation lock:** no caminho info-open, CREATE/CANCEL/RESCHEDULE **não** POST/PATCH. Tags stripped. Copy honesta se Tess tentou marcar (“pra marcar me fala dia e serviço”).
- [x] **F3 staff wins:** recepção no fio (24h / human-handled) → Tess **silent** mesmo em FAQ.
- [x] **F4 booking intacto:** SCHEDULING/CANCEL/RESCHEDULE de número novo sem claim/allow/dono → silent (como hoje, com P2.1). Owner sempre passa.
- [x] **F5 confirm-hold:** turno sem tag de booking cujo texto é só pedido de confirmação (“Tá certo?”, “Posso registrar?”, “Pra confirmar: …”) **não** vai pro WhatsApp como nova pergunta. História Tess guarda o texto. 1ª vez: hold “Já estou confirmando na agenda, um instante.” Repetição no fio: drop. Com tag + 201: uma bolha de sucesso (2-phase já existente). Sem cola 46589.

### Tasks

- [x] **T9 (F1–F4):** Gate Kapso + `bookingMutationsAllowed` em `processMessage`. Testes bot-pilot / intent.
- [x] **T10 (F5):** Helper `isConfirmAskOutbound` + hold/drop em `selectOutboundBlocks` ou processMessage. Testes booking-parser.
- [x] **T11:** VPS ritual (Gage): `global=false` → archive `backend/` → build → health → `stopPilot` → whitelist só dono → `global=true` `pilot=false` `accept_all=false`.

### AUTO-DECISION Orion

Info-open = `FAQ` + `PRICING` só. `TRIVIAL` / `UNCERTAIN` / `HANDOFF_LIKELY` continuam silent fora da allow. Sem 9º intent.

### File List (P1 addendum)

- `backend/lib/booking-parser.js` — `resolveCreateMoveLeftoverId`, `hydrateCatalogPrice`, `confirmo aqui` em PREMATURE_CONFIRM
- `backend/server.js` — leftover cancel pós-CREATE, hydrate preço, zero_price outcome, skip PUT reschedule
- `backend/test/booking-parser.test.js` — Q2 sanitize + hydrate
- `backend/test/reschedule-sku.test.js` — Q1 Ana leftover (8528)
- `backend/test/cancel-sku.test.js` — Q3 Ronaldo regressão (5482)
- `docs/stories/salon-whatsapp-pilot-first-n-soft-open.md` — addendum P1

### File List (P2 local)

- `backend/lib/tess-context-intent.js` — `isPilotClaimableTurn`
- `backend/lib/bot-pilot.js` — `tryClaim` + text gate
- `backend/lib/booking-parser.js` — POST_FAIL endereço/studio
- `backend/server.js` — passa `text` no tryClaim
- `backend/test/bot-pilot.test.js` — 2185 + bookable text
- `backend/test/tess-context-intent.test.js` — unit isPilotClaimableTurn
- `backend/test/booking-parser.test.js` — postFail endereço
- `docs/stories/salon-whatsapp-pilot-first-n-soft-open.md` — P2 checkboxes

## QA Results

### Review Date: 2026-09-05

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: uncommitted-on-8251f2a (allowlist P1)

### Gate Status

Gate: **CONCERNS** — veredito no chat (sem YAML novo). Commit allowlist **não** bloqueado.

| Caso | Veredito |
|------|----------|
| Q1 Ana 8528 | PASS — resolve id; not_owned; sem serieId; 201→cancel + skip PUT (código) |
| Q2 Rodolfo 9343 | PASS — confirmo/te esperamos; hydrate 7000→70; zero_price + blocked |
| Q3 Ronaldo 5482 | PASS — create intacto; sucesso pós-201 sobrevive sanitize |
| Q4 fatia | PASS — 119/119 + `node --check backend/server.js` (Quinn re-rodou) |
| I1 boca=commit | PASS — Tess sanitizada antes do POST; “Te esperamos” só via finalMessages pós-201 |

Residuais (não bloqueiam): sem teste de integração server do leftover; `endereço` não entra no sanitizer (AC2 literal; turno seguinte Tess/P2).

[AUTO-DECISION] Sem transição InReview→Done (addendum `ready-for-review`, story já live). Sem gate YAML (padrão do repo >20 linhas; missão pediu chat).

P2.1–P2.4, chão 10 STOP, 5–6, replay 383, smoke #8, Hostinger/VPS, POST Trinks, paste 46589, `startPilot` sem ACK: estacionados.
