# Gage — publish chão 1–6 (pré-smoke `0007`)

> **W8 autorizado.** Victor 04/09 ~14:35 BRT: orquestrar o que falta para testar no `0007`.  
> Gates: 1+2 PASS 96 · 3 PASS · 4 PASS 96 local · 5 CONCERNS 90 `blocks_publish=[]` · 6 CONCERNS `blocks_publish=[]`.  
> Motor: Composer 2.5 Fast. Persona: Gage (@devops).

| Campo | Valor |
|---|---|
| Branch | `feature/tess-commit-honesty` |
| Live antes | `405b005` (onda 2) / HEAD docs `7482d3d` |
| Kill switch **durante o publish** | permanece `bot_toggles.global=false` |
| Smoke | **depois** deste publish + sync memories + unlock `0007` |

## Allowlist commit (NÃO `git add .`)

### Backend (entra no `git archive backend`)

- `backend/lib/tess-context-slots.js` — chão 1+2 durationMin + subtract
- `backend/lib/trinks-local-store.js` — `listActiveAppointmentWindowsForDate`
- `backend/lib/tess-context-intent.js` — `intentToPersist`
- `backend/lib/tess-context-profiles.js` — MIN sem SKU
- `backend/lib/tess-context-assembler.js` — durationMin opts + flags + telemetry
- `backend/lib/tess-context-bytes.js` — `persistTessTurnEvent` sent_chars/timed_out/salon_day
- `backend/lib/tess-timeout-budget.js` — **novo** abort por perfil
- `backend/lib/salao-cli-ops.js` — replay helper
- `backend/server.js` — persist passivo + `callTESS({ timeoutMs })`
- `backend/scripts/salao/contexto/replay_intent_null.js` — **novo**
- testes: `tess-context-slots`, `trinks-local-store`, `tess-context-intent`, `tess-context-profiles`, `tess-context-assembler`, `conversation-history`, `salao-cli-ops`, `tess-context-bytes-persist`, `tess-timeout-budget`, `server-tess-timeout`, `tess-timeout`

### KB (commit; **não** vai no archive — sync TESS à parte)

- `data/kb/conversa-v2/{sinonimos-servicos,regras-comerciais,faq-servicos,fichas-tecnicas-servicos}.md`

### Ops (commit; não archive)

- `infra/.env.example` — `TESS_ABORT_MS_*` comentados
- stories/gates/analysis/handoffs deste epic (só os já escritos)

### Fora (veto)

- `git add .` · `infra/docker-compose.yml` · nginx · frontend · `archive-et11-uncommitted-*` · visagismo 900/880 · Hostinger · `docs/prompts/tess-conversa-v3-clean.md`

## Rito publish

1. Commit allowlist. Mensagem: `feat: chão 1–6 oferta/snapshot/intent/kb/crédito/timeout [EPIC-tess-chao-unico]`
2. Push da branch (sem `-f`). SHA = HEAD.
3. VPS `deploy@72.60.155.118`: fetch + reset no worktree `/opt/influence-labs/worktrees/tess-commit-honesty`. **Sem rsync local.**
4. Backup `cp -a /opt/influence-labs/backend /opt/influence-labs/backend.bak.<ts>`
5. `git archive <SHA> backend | tar -x -C /opt/influence-labs`
6. `cd /opt/influence-labs/infra && docker compose build --no-cache backend && docker compose up -d backend`. Compose **não** sobrescrever.
7. **Não** `UPDATE bot_toggles`. **Não** `BOT_ACCEPT_ALL=true`. **Não** subir Nginx 25s/35s.
8. Confirmar: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=false`, `FORCE_FULL` vazio, agent 46589, `TESS_REQUEST_TIMEOUT_MS` 25000.
9. Health + `trinks_ping=ok`. Grep container: `resolveTessAbortMs`, `intentToPersist`, `subtractOccupiedSlotStarts`, `persistTessTurnEvent`.
10. Append `docs/ops/nightwatch-log.md`. Sem WhatsApp neste passo.

## Depois do container (Orion, não Gage)

1. Sync TESS collection 39496 — **só** os 4 arquivos do IN (pezinho + `TA -`). padroes/info/laser **não** reescrever comercial. Rito Etapa 11, script `sync-kb-content-to-tess.cjs`. Snapshot pré-sync já em `archive-live-pre-chao4-2026-09-04/`.
2. Unlock `0007`-only: `global=true`, `BOT_ACCEPT_ALL=false`, allow único `0007`.
3. Victor corre o roteiro. Depois: `global=false` salvo ACK OPEN.

## Rollback

Worktree + archive do SHA live anterior + rebuild backend. Memories: re-PATCH do snapshot `archive-live-pre-chao4` se o sync já tiver ido.
