# Gage — plano de publish da fatia item 7 P-BUDGET

> **W4 autorizado.** Quinn PASS 91, `blocks_publish: []`. Victor ACK = “orquestra até entregarmos” (2026-09-04 ~11:03 BRT).
> Motor: Composer 2.5 Fast. Persona: Gage (@devops). Não substituir a persona pelo modelo.

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-04-aria-p-budget-tetos.md` |
| Gate | `docs/qa/gates/2026-09-04-fatia-item7.yml` (Quinn PASS 91) |
| Workflow | `docs/ops/2026-09-04-orion-workflow-item7.md` |
| Branch | `feature/tess-commit-honesty` |
| Live | `9cb5834` |
| Working tree | ~300+ fora desta fatia — **`git add .` proibido** |

## Allowlist (commit)

- `backend/lib/tess-context-budget.js` *(novo)*
- `backend/lib/tess-context-assembler.js`
- `backend/lib/tess-context-bytes.js`
- `backend/server.js`
- `backend/test/tess-context-budget.test.js` *(novo)*
- `backend/test/tess-context-assembler.test.js`
- `backend/test/tess-context-bytes-persist.test.js`
- `infra/.env.example` — **SOMENTE** o bloco CAP (comentário + 6 linhas `TESS_CONTEXT_CAP_*`). Quinn MNT-01: **não** levar `TESS_CREDIT_*`, `HUMAN_HANDLED_TTL_HOURS`, `NIGHTWATCH_MCP_TOKEN`.
- `docs/analysis/2026-09-04-aria-p-budget-tetos.md`
- `docs/ops/2026-09-04-orion-workflow-item7.md`
- `docs/handoffs/2026-09-04-orion-fatia-item7-qa.md`
- `docs/qa/gates/2026-09-04-fatia-item7.yml`
- `docs/handoffs/2026-09-04-quinn-gate-item7.md`
- este plano

**Fora:** `tess-context-profiles.js`, `docs/prompts/*`, nginx, frontend, KB, resto dirty.

### MNT-01 — `.env.example` cirúrgico (obrigatório antes do `git add`)

`git checkout HEAD -- infra/.env.example` e reaplicar **apenas**:

```
# Override opcional de teto por perfil (chars UTF-16). Faixa válida: 1000–100000. Fora disso → default da tabela.
# TESS_CONTEXT_CAP_MIN=8000
# TESS_CONTEXT_CAP_FAQ=8000
# TESS_CONTEXT_CAP_PRICE=10000
# TESS_CONTEXT_CAP_BOOKING=16000
# TESS_CONTEXT_CAP_CANCEL=10000
# TESS_CONTEXT_CAP_FULL=24000
```

logo após `# TESS_CONTEXT_MODE=full`. Sem `git add -i`. Sem `git add .`.

## Rito W4 (Gage)

1. Recorte: `cd backend && node --test test/tess-context-budget.test.js test/tess-context-assembler.test.js test/tess-context-profiles.test.js test/tess-context-bytes-persist.test.js` — precisa 46/46.
2. Commit allowlist-only. Sem `--no-verify`. Sem amend. Conventional: `feat: cap Tess context per profile and degrade overflow`.
3. Push da branch (sem `-f`).
4. VPS `deploy@72.60.155.118`: fetch + reset no worktree `/opt/influence-labs/worktrees/tess-commit-honesty`. **Sem rsync local.** Archive só `backend/`.
5. Backup `cp -a /opt/influence-labs/backend /opt/influence-labs/backend.bak.<ts>`.
6. `git archive <SHA> backend | tar -x -C /opt/influence-labs`
7. `cd /opt/influence-labs/infra && docker compose build --no-cache backend && docker compose up -d backend`. Compose live **não** sobrescrever. **Não** setar `TESS_CONTEXT_CAP_*` no `.env` do VPS (default no código).
8. Confirmar: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL` e `BOT_ACCEPT_ALL` = baseline VPS, `FORCE_FULL` vazio, health + `trinks_ping=ok`, agent 46589, `tess-context-budget.js` no container.
9. `nginx -t` antes de reload. Se falhar, parar.

Proibido: Hostinger, smoke `0007` CREATE, André 10:30, CREATE 9800, paste 46589, flip `BOT_ACCEPT_ALL`.

## Rollback

Reverter `tess-context-budget.js` + wiring assembler/server. Caps não têm kill switch (`BUDGET=off` vetado). `TESS_CONTEXT_MODE=full` **ainda** leva teto 24000.

## W5 verify (Orion depois do Gage)

- Container: `test -f lib/tess-context-budget.js`; grep `DEFAULT_CAPS` / `applyContextBudget`.
- Env baseline intocado.
- Não exige turno WhatsApp; se logar, `tess.context_trimmed` só quando cortou. Sem André 10:30.
