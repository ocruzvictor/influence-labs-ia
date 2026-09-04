# Gage — plano de publish da fatia pool Victor

> **PLANEJAMENTO. W4 só depois de W3 (Victor: “pode publicar”).**
> Quinn: CONCERNS 86, `blocks_publish: []`, yes-with-conditions.

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-03-orion-fatia-pool-victor.md` |
| Gate | `docs/qa/gates/2026-09-03-fatia-pool-victor.yml` |
| Workflow | `docs/ops/2026-09-03-orion-workflow-pool.md` |
| Branch | `feature/tess-commit-honesty` |
| Live | `b42bb2b` |
| Working tree | ~300+ fora desta fatia — **`git add .` proibido** |

## Allowlist (commit + archive backend)

Mesma lista do gate §5 + docs desta orquestração:

- `backend/lib/tess-context-assembler.js`
- `backend/lib/tess-context-slots.js`
- `backend/lib/tess-context-profiles.js`
- `backend/lib/tess-context-intent.js`
- `backend/lib/tess-context-bytes.js`
- `backend/lib/tess-trace.js` *(novo)*
- `backend/lib/conversation-history.js`
- `backend/lib/salao-cli-ops.js`
- `backend/lib/nightwatch-ops.js`
- `backend/server.js`
- `backend/scripts/salao/observabilidade/listar_fila_atendimento.js` *(novo)*
- `backend/scripts/salao/observabilidade/correlacionar_last4.js`
- `backend/scripts/salao/README.md`
- testes da fatia (7 arquivos já no gate)
- docs: fatia, pacote QA, gate Quinn, handoff Quinn, workflow, estacionados, decisões, este plano

**Fora:** `docs/prompts/README-46589.md`, `infra/*`, nginx, frontend, KB, squads, ~300 locais.

## Rito W4 (Gage, `AIOX_ACTIVE_AGENT=devops`)

1. Commit allowlist-only. Sem `--no-verify`. Sem amend.
2. Push da branch (sem `-f`).
3. VPS: fetch + reset no worktree `tess-commit-honesty`. **Sem rsync local.** Archive só `backend/`.
4. `docker compose build --no-cache backend` + `up -d backend` a partir de `/opt/influence-labs/infra`. Compose live **não** sobrescrever.
5. Confirmar: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL` = baseline VPS, `BOT_ACCEPT_ALL` = baseline, `FORCE_FULL` vazio, health + `trinks_ping=ok`, agent 46589.
6. `nginx -t` antes de reload. Se falhar, parar.
7. Sem smoke `0007`. Sem Hostinger.

## Rollback

- Item 1 (duração): revert do wiring `durationMin` no assembler.
- Item 6: `UNCERTAIN` **não** volta para FULL via env. Rollback = revert do early-return MIN.
- `TESS_CONTEXT_MODE=full` ainda dumpa intents conhecidos.

## W5 verify

Log: `UNCERTAIN` sem `HORARIOS VAGOS` gordos; `snapshot.stale` se idade ≥45; `tess.turn` com `context_profile` no banco.
