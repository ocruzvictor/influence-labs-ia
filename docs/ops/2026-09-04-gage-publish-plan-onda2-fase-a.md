# Gage — publish Onda 2 Fase A (triagem léxico)

> **W4 autorizado.** Victor ACK 04/09 ~12:50 BRT: commit/publish; **não** export `94831`; **não** religar.  
> Quinn CONCERNS 86, `blocks_publish: []`. REQ-01 last-wins aplicado no worktree.  
> Motor: Composer 2.5 Fast. Persona: Gage (@devops).

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-04-aria-onda2-triagem-tetos.md` |
| Gate | `docs/qa/gates/2026-09-04-onda2-fase-a.yml` |
| Branch | `feature/tess-commit-honesty` |
| Live antes | `fa0ec92` |
| Kill switch | **permanece** `bot_toggles.global=false` |

## Allowlist (já no commit desta fatia)

Código live: `booking-parser.js`, `tess-context-{intent,slots,assembler,budget}.js`, `server.js`, testes, CLI dump corpus.  
**Fora:** `infra/docker-compose.yml`, nginx, frontend, KB, `docs/prompts/tess-conversa-v3-clean.md`, Hostinger.

## Rito

1. Push da branch (sem `-f`). SHA = HEAD após o commit Orion.
2. VPS `deploy@72.60.155.118`: fetch + reset no worktree `/opt/influence-labs/worktrees/tess-commit-honesty`. **Sem rsync local.**
3. Backup `cp -a /opt/influence-labs/backend /opt/influence-labs/backend.bak.<ts>`
4. `git archive <SHA> backend | tar -x -C /opt/influence-labs`
5. `cd /opt/influence-labs/infra && docker compose build --no-cache backend && docker compose up -d backend`. Compose **não** sobrescrever.
6. **Não** setar `TESS_CONTEXT_CAP_*`. **Não** flip `BOT_ACCEPT_ALL`. **Não** `UPDATE bot_toggles`.
7. Confirmar env: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true` (baseline — kill switch vence), `FORCE_FULL` vazio, agent 46589.
8. Health + `trinks_ping=ok`. Grep no container: `pezinho` em FILTER, `CATALOG_SYNONYMS`, `ROLE_RE`, `genderQualifier`.
9. `nginx -t` antes de reload. Se falhar, parar.
10. Append `docs/ops/nightwatch-log.md` (SHA, backup id). Sem WhatsApp smoke, sem `0007`, sem André 10:30, sem CREATE 9800.

## Rollback

Worktree + archive do `fa0ec92` + rebuild backend. Caps P-BUDGET permanecem (não esta fatia).
