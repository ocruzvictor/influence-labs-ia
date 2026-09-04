# Gage — publish PILOT_N (soft-open first-5)

> **Autorizado.** Victor 04/09 17:28 BRT: opção 2 — commit + Gage publica + ligar PILOT.  
> Story: `docs/stories/salon-whatsapp-pilot-first-n-soft-open.md`  
> Arch: `docs/architecture/pilot-first-n-soft-open.md`

| Campo | Valor |
|---|---|
| Branch | `feature/pilot-first-n-soft-open` |
| Kill switch durante publish | `bot_toggles.global=false` |
| `BOT_ACCEPT_ALL` | **não** ligar |
| Depois do health | `018` + `pilot_start.js --n 5` + `global=true` |

## Allowlist

- `infra/migrations/018_bot_pilot_cohort.sql` + rollback
- `backend/lib/bot-pilot.js`
- `backend/lib/bot-thread-state.js`
- `backend/server.js`
- `backend/scripts/salao/bot/pilot_{start,status,stop}.js`
- `backend/test/bot-pilot.test.js`
- `backend/test/bot-thread-state.test.js`

## Rito

1. Victor autoriza commit desta fatia (só arquivos da allowlist — **não** o dirty tree do honesty)
2. @devops push da branch
3. VPS: backup backend → apply 018 → `git archive` backend → build
4. Health: `mode` ainda OFF enquanto `global=false`; `pilot.table_ready=true`
5. `node backend/scripts/salao/bot/pilot_start.js --n 5`
6. `UPDATE bot_toggles SET enabled=true WHERE key='global'`
7. Health: `mode=PILOT`, `claimed_count=0`, `n=5`
8. Recepção observa. Status: `pilot_status.js` (last4)
9. Abort: `global=false` **ou** `pilot_stop.js`

## Fora

Hostinger, compose overwrite, nginx, `BOT_ACCEPT_ALL=true`, OPEN, smoke 0007 como vaga do cohort.
