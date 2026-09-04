# PILOT_N / soft-open first-5 — Architecture

**Version:** 1.0  
**Date:** 2026-09-04  
**Author:** Aria / Orion (@architect + @aios-master)  
**Status:** Approved for implementation  
**Story:** [salon-whatsapp-pilot-first-n-soft-open](../stories/salon-whatsapp-pilot-first-n-soft-open.md)

---

## Overview

### Purpose

Depois de publicar uma versão nova da Tess, a operação precisa de um modo que **atenda no máximo N=5 números novos** que pediram horário, serviço ou cancelamento, sem OPEN customer-wide. O cohort fica em `allow`. O restante silencia. Fios em que a recepção já entrou não entram no meio e não consomem vaga.

### Scope

**In**

- Modo de primeira classe `PILOT` (toggle `bot_toggles.pilot`)
- Tabela de run + claims com claim atômico
- CLI start / status / stop
- Gate no webhook Kapso
- Health `mode=PILOT` + `claimed_count` / `n` (last4 only)

**Out**

- UI
- Prompt TESS / Trinks
- Flip `BOT_ACCEPT_ALL`
- Reciclar vaga se um dos 5 for assumido pela recepção

### Success Criteria

- [ ] Dois webhooks concorrentes com 1 vaga → 1 claim
- [ ] Trivial não consome vaga
- [ ] OPEN e WHITELIST inalterados com `pilot=false`
- [ ] Restart do backend não perde cohort nem teto

---

## Current state

Webhook Kapso (`backend/server.js` ~2773–2883):

1. Outbound staff (`origin != cloud_api`) → `markHumanHandled` + `persistStaffOutbound`
2. Kill switch `bot_toggles.global === false` → silent
3. `resolvePhoneAccess` (`backend/lib/bot-state.js`): `block`/`human_only` vencem OPEN; senão OPEN ou allow
4. `isHumanHandled` (TTL 6h em `bot_thread_state.silenced_until`) → silent
5. Watchdog + Tess

Primitivas reutilizadas: `classifyTessIntent`, `bot_whitelist`, `bot_toggles`, `last_staff_outbound_at` (janela 24h no fio; outbound do painel Kapso conta).

**Não existe** contador de cohort nem modo PILOT.

---

## Structural choice

| Opção | Onde vive o estado | Race-safe? | Sobrevive restart? | Acoplamento |
|---|---|---|---|---|
| **A — recomendada** | `bot_pilot_runs` + `bot_pilot_claims` + toggle `pilot` | Sim (lock + COUNT na txn) | Sim | Baixo; whitelist só ganha `allow` no claim |
| B | Só whitelist + toggle/`BOT_PILOT_N` | Fraco: COUNT de `allow` mistura 0007/dono | Sim | Alto; 0007 rouba vaga se não filtrar |
| C | Env + memória | Não | Não | Rejeitada |

**Decisão: A.** Cohort é um run versionado. `allow` pré-existente não entra na tabela de claims → não ocupa vaga. Env `BOT_ACCEPT_ALL` **não** muda no start.

Por que não OPEN-then-freeze: entre o 5º e o freeze manual o 6º já fala. PILOT nunca é OPEN.

---

## Data model (018)

```
bot_pilot_runs
  id           UUID PK
  n            INT CHECK (1..20)
  status       TEXT CHECK (active | frozen | stopped)
  started_at   TIMESTAMPTZ
  stopped_at   TIMESTAMPTZ
  started_by   TEXT

bot_pilot_claims
  run_id       UUID FK
  phone        VARCHAR(20)
  intent       TEXT
  claimed_at   TIMESTAMPTZ
  PRIMARY KEY (run_id, phone)
```

Constraints:

- `UNIQUE (status) WHERE status = 'active'` — no máximo um run ativo
- Toggle seed: `bot_toggles.pilot` default **false**

Rollback 018 dropa as duas tabelas e o toggle `pilot` (não toca `bot_whitelist` nem claims já virados `allow` — esses rows ficam; operação limpa na mão se quiser).

---

## Atomic claim

```sql
BEGIN;
SELECT pg_advisory_xact_lock(881005);  -- chave fixa bot_pilot
SELECT id, n FROM bot_pilot_runs WHERE status = 'active' FOR UPDATE;
-- se já claimed neste run → already_claimed (não incrementa)
-- se COUNT(claims) >= n → cap_reached
INSERT INTO bot_pilot_claims (run_id, phone, intent) VALUES (...);
INSERT INTO bot_whitelist (phone, mode, reason)
  VALUES ($phone, 'allow', 'pilot_claim')
  ON CONFLICT (phone) DO UPDATE
    SET mode = 'allow', reason = 'pilot_claim'
    WHERE bot_whitelist.mode NOT IN ('block', 'human_only');
COMMIT;
```

Dois inbound de phones distintos com 1 vaga: o segundo vê `COUNT >= n` e sai `cap_reached`. Mesmo phone duas vezes: PK impede double-count.

**Nunca** sobrescrever `block` / `human_only`.

---

## Webhook sequence

```
inbound Kapso
  → kill switch? silent
  → resolvePhoneAccess
       block | human_only → silent
       allow | owner | OPEN (pilot off) → fluxo atual
       not_allowlisted + pilot on → CANDIDATO
  → human-handled? silent (sem claim)
  → staff no fio (tag ou outbound Kapso não-Tess, 24h)? silent (sem claim)
  → [texto] classifyTessIntent(messageText, [], [])
       se intent ∉ {SCHEDULING, CANCEL, RESCHEDULE} → silent
       tryClaim → se falhar → silent
  → [áudio-only] passa o gate sem claim; depois da transcrição
       classify + tryClaim; se falhar, sem Tess / sem watchdog final
  → invalidateCache()
  → startOutboundWatchdog + processMessage
```

Claim **antes** do watchdog no caminho texto. Áudio-only classifica o texto final ainda **antes** de `processMessage`.

Classificação do claim usa histórico vazio de propósito: “sim” sozinho não queima vaga. “oi quero cortar amanhã” já é SCHEDULING no classificador atual.

---

## “Conversa em andamento”

Só colunas existentes:

| Sinal | Efeito |
|---|---|
| `bot_whitelist.mode` ∈ {block, human_only} | Sem claim, silent |
| `bot_thread_state.silenced_until > now()` | Sem claim, silent |
| `last_staff_outbound_at` há < 24h | Sem claim, silent — inclui outbound do **painel Kapso** (`cloud_api` que a Tess não enviou) |

Se o staff falou há 2 dias e o TTL de human-handled expirou, o número **pode** ser claimed. Não inventar detector novo de “histórico humano”.

---

## Owner / 0007

- `isOwnerPhone` → passa o gate, **não** chama `tryClaim`
- Row `allow` já existente → passa `resolvePhoneAccess`, **não** chama `tryClaim`
- `claimed_count` = `COUNT(*)` em `bot_pilot_claims` do run ativo, não COUNT de whitelist

---

## CLI (First)

```
node backend/scripts/salao/bot/pilot_start.js --n 5
node backend/scripts/salao/bot/pilot_status.js
node backend/scripts/salao/bot/pilot_stop.js
```

Start: insert run `active`, `pilot=true`. Não toca `.env`.  
Stop: run `frozen`, `pilot=false`, cohort permanece `allow`.  
Status JSON: `{ mode, n, claimed_count, phones_last4[], started_at, run_id }` — zero E.164.

---

## Health

Quando `toggles.pilot === true`:

```
bot.mode = "PILOT"
bot.pilot = { n, claimed_count, started_at }
```

Se 018 não aplicada: `pilot: { table_ready: false }`, health 200.  
Lite Nightwatch: mesmo `mode`. Sem lista de phones.

Kill switch: se `global=false`, `mode` pode continuar reportando PILOT no toggle, mas o webhook silencia. Preferir `mode=OFF` se `global===false` (capacidade nova, não quebra OPEN/WHITELIST).

---

## Capability preservation

`resolvePhoneAccess` **não muda** semântica OPEN/WHITELIST. PILOT é ramo no webhook quando `toggles.pilot` e reason `not_allowlisted`. Testes 8–10 de `bot-state.test.js` ficam verdes sem edição de comportamento.

---

## Tests required

1. Trivial / FAQ / PRICING → `rejected` `intent_not_claimable`, COUNT=0
2. SCHEDULING → claim + allow
3. Race: n=1, dois phones → um claimed
4. Cap: 6º silent
5. Already claimed → Tess seguiria (reason `already_claimed`), COUNT inalterado
6. human-handled / staff 24h / human_only / block → no insert
7. Owner / pré-allow → no insert
8. stop → status frozen, toggle false
9. Restart simulado: getPilotStatus lê Postgres, não memória
10. OPEN/WHITELIST regression (`bot-state.test.js`)

---

## Files @dev touches

- `infra/migrations/018_bot_pilot_cohort.sql` + rollback
- `backend/lib/bot-pilot.js` (novo)
- `backend/lib/bot-thread-state.js` (`hasStaffOnConversation`)
- `backend/lib/kapso-staff-outbound.js`
- `backend/server.js` (gate + health)
- `backend/scripts/salao/bot/pilot_{start,status,stop}.js`
- `backend/test/bot-pilot.test.js`
- `backend/test/bot-thread-state.test.js` (1 caso staff)

---

## Stop rules / risks

- ⛔ Não implementar claim em memória
- ⛔ Não setar `BOT_ACCEPT_ALL=true` no start
- ⛔ Não sobrescrever `block`/`human_only`
- ⛔ Não logar E.164 no health
- ⛔ Não misturar cache de pilot no scan 5s de `getBotState` além do boolean `toggles.pilot`

**@data-engineer:** 018 é tabela nova (A). Se a unique de um run ativo for rejeitada, o alternativa é `id` + CHECK via trigger. Partial unique `(true) WHERE status='active'` é suficiente.

---

## How to customize

- Teto: `--n` no start (1–20). Produto travado em 5.
- Intents claimable: `CLAIMABLE_INTENTS` em `bot-pilot.js`
- Janela staff no fio: 24h (`STAFF_CONVERSATION_WINDOW_MS`); resume ainda usa 10 min
