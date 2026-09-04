# Gage — plano de publish da fatia slots+contexto

> **W4 só depois de W1 sem `blocks_publish`.** Victor ACK = “orquestra até concluir” (2026-09-04 ~10:49 BRT).
> Motor: Composer 2.5 Fast. Persona: Gage (@devops). Não substituir a persona pelo modelo.

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md` |
| Gate | `docs/qa/gates/2026-09-04-fatia-slots-contexto.yml` (Quinn) |
| Workflow | `docs/ops/2026-09-04-orion-workflow-slots-contexto.md` |
| Branch | `feature/tess-commit-honesty` |
| Live | `a08f23b` |
| Working tree | ~300+ fora desta fatia — **`git add .` proibido** |

## Allowlist (commit + archive backend)

Ajustar se o gate Quinn alterar `slice_allowlist`. Piso:

- `backend/lib/booking-parser.js`
- `backend/lib/tess-context-assembler.js`
- `backend/lib/trinks-local-store.js`
- `backend/server.js`
- `backend/test/booking-parser.test.js`
- `backend/test/tess-context-assembler.test.js`
- `backend/test/trinks-local-store.test.js`
- `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md`
- `docs/analysis/2026-09-03-orion-estacionados.md`
- `docs/ops/2026-09-04-orion-workflow-slots-contexto.md`
- `docs/handoffs/2026-09-04-orion-fatia-slots-contexto-qa.md`
- `docs/handoffs/2026-09-04-quinn-gate-slots-contexto.md`
- `docs/qa/gates/2026-09-04-fatia-slots-contexto.yml`
- este plano

**Fora:** `docs/prompts/*`, `infra/*`, nginx, frontend, KB, squads, ~300 locais.

## Rito W4 (Gage, `AIOX_ACTIVE_AGENT=devops`)

1. Commit allowlist-only. Sem `--no-verify`. Sem amend. Conventional commit + motivo (1b/2b/9800).
2. Push da branch (sem `-f`).
3. VPS: fetch + reset no worktree `tess-commit-honesty`. **Sem rsync local.** Archive só `backend/`.
4. `docker compose build --no-cache backend` + `up -d backend` a partir de `/opt/influence-labs/infra`. Compose live **não** sobrescrever.
5. Confirmar: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL` e `BOT_ACCEPT_ALL` = baseline VPS, `FORCE_FULL` vazio, health + `trinks_ping=ok`, agent 46589.
6. `nginx -t` antes de reload. Se falhar, parar.
7. Sem smoke `0007` CREATE. Sem Hostinger. Sem replay André 10:30.

## Rollback

- 1b/2b: revert assembler + `ensureSlotSnapshot` maxAge.
- 9800: `isCompatible` volta a ser só matriz; `getServicesText` sem observed pairs.

## W5 verify

- `ensureSlotSnapshot` / hasSlotSnapshotForDate com idade em horas fracionárias no container.
- `isCompatible` SQL menciona `trinks_appointments`.
- Health ok. Env baseline intocado.
