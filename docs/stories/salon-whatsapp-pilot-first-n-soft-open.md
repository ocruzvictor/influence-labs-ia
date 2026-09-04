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
- [x] **AC8:** `human-handled` ativo, `last_staff_outbound_at` < 10 min, `human_only` ou `block` → sem claim, Tess silent.
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
