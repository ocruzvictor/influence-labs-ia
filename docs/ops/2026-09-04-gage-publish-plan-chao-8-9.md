# Gage — publish chão 8+9 (pezinho cortesia · Ausência refresh)

> **Autorizado.** Victor 04/09 ~16:01 BRT: `pode publicar 8+9`.  
> Gate: Quinn PASS 96 · `blocks_publish=[]` · T4 fechado (v3.2.4 + sync 39496).

| Campo | Valor |
|---|---|
| Branch | `feature/tess-commit-honesty` |
| Live antes | `a9d5af8` |
| Kill switch durante publish | `bot_toggles.global=false` |
| Smoke | Victor `0007` depois do unlock |

## Allowlist commit

### Backend (git archive)

- `backend/lib/booking-parser.js` — `isSoloPezinhoTurn`, `suppressSoloPezinhoTags`
- `backend/lib/tess-context-assembler.js` — `refreshDates = unique(slotDates)`
- `backend/server.js` — OPERATIONAL_NOTES + suppress pós-strip
- testes: booking-parser, tess-context-assembler, tess-context-slots, tess-context-intent, trinks-local-store, trinks-sync

### Docs/KB (commit; KB já sync TESS)

- 4 KB, stories 8+9, gate, handoff, prompt v3.2.4 + archive v3.2.3, registro sync chão 8

## Rito

1. Commit allowlist → push
2. VPS fetch worktree → backup backend → `git archive` → build --no-cache backend
3. Health + grep `isSoloPezinhoTurn` / `refreshDates`
4. Unlock `0007`-only (Orion pós-publish)
5. Append nightwatch-log

## Fora

Hostinger, compose overwrite, nginx, OPEN, André 10:30, CREATE 9800.
