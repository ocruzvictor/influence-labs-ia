# Handoff Orion — próxima fatia (outbox + SLA + scoped)

> 2026-09-03. Victor: “orquestra os próximos passos; pode chamar @devops ou outros”.
> Não é autorização de Hostinger, rsync local, push da árvore inteira, nem `BOT_ACCEPT_ALL`.

| Campo | Valor |
|---|---|
| Branch | `feature/tess-commit-honesty` |
| HEAD | `c93046d` (docs resume-ia.6) |
| Código live conhecido | Story 13 = `07f59cb` |
| Working tree | ~334 entradas **fora** desta fatia — **não empacotar** |
| Allowlist | **conferir sem alterar** (SOT Aria: 1 allow `0007`) |
| `BOT_ACCEPT_ALL` | **preservar o baseline do VPS** — não “corrigir” para `false`. Dossiê registra OPEN (`true`) desde 19:55:18Z |
| Deploy | **não executado**. Plano Gage: `docs/ops/2026-09-03-gage-publish-plan-outbox-sla-scoped.md` |
| Gate Quinn | **CONCERNS** (72) — `docs/qa/gates/2026-09-03-outbox-sla-scoped.yml` |

## O que entra na fatia

Hot-path + testes + CLIs 0-LLM. Sem frontend, sem KB, sem `.aiox-core`, sem nginx, sem stories alheias.

**Novos**

- `backend/lib/outbound-outbox.js`
- `backend/lib/handoff-sla.js`
- `backend/lib/conversation-history.js`
- `backend/lib/salao-cli-ops.js`
- `backend/lib/salao-cli-context.js`
- `backend/lib/salao-cli-catalog.js`
- `backend/scripts/salao/**`
- testes: `outbound-outbox`, `handoff-sla`, `salao-cli-*`, `conversation-history`, `tess-context-bytes-persist`

**Diffs desta fatia em arquivos já versionados**

- `backend/server.js` — persist intent, `tess.context_bytes`, outbox, SLA no handoff
- `backend/lib/tess-context-config.js` — default `scoped`
- `backend/lib/tess-empty-handoff.js` — payload SLA
- `backend/lib/tess-context-bytes.js` — persistência do evento
- `backend/lib/nightwatch-ops.js` — `WATCH_EVENTS` (+ outbound/handoff)
- `backend/test/server-tess-timeout.test.js`
- `backend/test/tess-context-profiles.test.js`

**Cuidado (diff misturado — NÃO publicar o arquivo inteiro sem triagem)**

- `infra/.env.example` e `infra/docker-compose.yml` já tinham linhas de crédito TESS / Nightwatch MCP **antes** desta fatia. Desta fatia só vale o default `TESS_CONTEXT_MODE=scoped`. Se o VPS já define a env, o fallback do compose não muda o processo.

**Fora**

- squads, dossiês Pedro/LibForge (docs/analysis 2026-09-03) — opcional no mesmo commit de docs, nunca no rebuild
- 300+ arquivos locais (AIOX sync, frontend, KB, stories)

## Rito de publish (Gage planeja; **não executa** sem ACK Victor)

1. Commit **só** a allowlist acima (não `git add .`).
2. Push da branch (Gage exclusive) **só** com ACK.
3. VPS: `git fetch` + reset no worktree `/opt/influence-labs/worktrees/tess-commit-honesty`. **Sem rsync da máquina local.** Preferir cópia sem rsync interno; se rsync worktree→Docker, registrar o desvio.
4. `docker compose build --no-cache backend` + `up -d backend`. Nginx reload, sem restart da stack.
5. Confirmar no container: `TESS_CONTEXT_MODE=scoped`, `FORCE_FULL` vazio, **`BOT_ACCEPT_ALL` = baseline** (não forçar `false`), health + `trinks_ping=ok`, agent 46589.
6. `nginx -t` **antes** do reload. Se falhar (n8n/chatwoot parados + upstreams no conf live), **parar** — o reload pode derrubar `api.studiotirra.com.br`.
7. Rollback: `TESS_CONTEXT_MODE=full` ou `TESS_CONTEXT_FORCE_FULL=1` + recreate backend (só funciona se as 2 linhas do compose forem publicadas). Outbox: reset para `07f59cb` ou `backend.bak`. Sem kill switch de env no watchdog.

## Pós-gate Quinn (2026-09-03 ~19:00 BRT)

[Quinn](6b7b46f2-8f59-450e-a3c1-3ccff113c15a): **CONCERNS**. Cliente/I1 PASS. Publish **não** autorizado.

Corrigido agora (ainda local, sem commit):

| ID | Ação |
|---|---|
| SLA-01 + TEST-01 | lookahead 72h; Ter 09:15 assertado (dom e sáb 18:30) |
| OBX-01 | envia copy **antes** do evento; emitEvent em try/catch |
| OBX-02 | copy sem token `cancelei`; teste usa `SUCCESS_COPY_RE` |

Ainda bloqueiam (decisão, não código):

| ID | Pedido |
|---|---|
| ENV-01 | Valor-alvo de `TESS_SKIP_TRIVIAL` no VPS (docs dizem `true` desde 01/set). Preservar baseline. |
| ENV-02 | Passthrough do compose **atômico** com `tess-context-config.js` (Gage já na allowlist C) |
| SCOPE-01 | `tess-context-assembler.js` **fora** do commit (oferta consultiva, não desta fatia) |
| SCOPE-02 | nginx **fora**; se `nginx -t` falhar, abortar reload |

## ACK que falta (Victor)

Responda por número. Gage **não** executa sem isto.

1. **Commit + push** da allowlist A+B atômica + 2 linhas scoped do compose / hunk 1 do `.env.example`. Sem `git add .`. Sem `backend/scripts` inteiro.
2. **Rebuild VPS** — sobe também `4dcbf4e` (resume-ia.6), **nunca live**. Aceita esse ride-along?
3. **`TESS_CONTEXT_MODE=scoped` explícito** no `.env` do host (Gage recomenda) vs só o default do código.
4. **Outbox em OPEN** — o watchdog fala com **todo inbound novo** em 45s/`catch`. Sem env para desligar. Confirma?
5. **nginx:** se `nginx -t` falhar, abortar reload (Gage) ou tratar o conf n8n/chatwoot **neste** rito (fora da fatia).

Smoke `0007` continua **depois** do health, ACK separado. Sem Hostinger. Sem rsync local. Sem mudar allowlist.

## Gate Quinn

- I1: copy do outbox não afirma sucesso de agenda.
- Outbox não fala em kill/allowlist/human-handled/owner.
- SLA não muta Trinks; re-alerta não fala com cliente.
- Default `scoped` vs AC15 da story on-demand = override Victor 2026-09-03, documentado.
- Skip trivial continua OFF.
- Sem story nova H-CRM / H-SPLIT.

## Depois do gate (não agora)

- Smoke WhatsApp last4 `0007` **só** com ACK individual (NÃO RETOMAR no dossiê §2.2 — smoke controlado, não resume de backlog).
- Tiago: `aceitar_handoff.js` no primeiro handoff real.
- @pm/@po se quiser story formal desta fatia. Sem isso, o pacote continua decisão operacional, não epic.
