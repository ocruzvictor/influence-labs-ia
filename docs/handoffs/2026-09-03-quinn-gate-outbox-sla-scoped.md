# Gate Quinn — fatia outbox + SLA + scoped

> 2026-09-03T21:57Z · Quinn (@qa, Test Architect) · `*gate` sobre **fatia operacional**, não story formal.
> Gate completo: [docs/qa/gates/2026-09-03-outbox-sla-scoped.yml](../qa/gates/2026-09-03-outbox-sla-scoped.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **CONCERNS** (quality score 72) |
| SOT | [handoff Orion](2026-09-03-orion-proxima-fatia-outbox-sla-scoped.md) + [decisões](../analysis/2026-09-03-orion-decisoes-execucao.md) |
| Branch / HEAD | `feature/tess-commit-honesty` / `c93046d` (worktree dirty) |
| Testes | fatia **40/40**; backend completo **555/555**; syntax 12/12 |
| Publish | Gage **pode planejar**, **não pode executar** — 5 bloqueadores |
| Não executado | deploy, rsync, Hostinger, build, smoke WhatsApp, allowlist, prompt Tess, Trinks |

## Veredito por item pedido

| # | Verificação | Status |
|---|---|---|
| 1 | I1 — OUTBOX_COPY não afirma sucesso de agenda | **PASS** |
| 1 | I1 — fail/markFinal não duplica envio | **PASS** |
| 2 | Outbox não dispara em kill/allowlist/human-handled/owner | **PASS** |
| 3 | SLA 15 min comercial | **CONCERNS** (bug de fim de semana) |
| 3 | Re-alerta não fala com o cliente | **PASS** |
| 3 | last4-only nas CLIs | **PASS** |
| 4 | Default scoped = override Victor vs AC15 | **CONCERNS** (rastreável, story sem emenda) |
| 4 | Skip trivial OFF | **FAIL** (código OFF, **prod ON**) |
| 5 | Testes da fatia (`node --test`) | **PASS** 40/40 |
| 6 | Risco de publicar infra/* inteiros | **CONCERNS** (enumerado linha a linha) |

## O que está sólido

**I1 preservado no caminho da cliente.** `OUTBOX_COPY` (`backend/lib/outbound-outbox.js:6-7`) nega estado de agenda em vez de afirmar sucesso. A não-duplicação é garantida por `fired = true` setado **sincronamente** antes de qualquer `await` (`:23-24`), com `sentFinal` cortando o envio pós-`markFinal` (`:22`, `:51-54`). Auditei três ordenações (markFinal→fail, fail→markFinal, timer→markFinal): todas ≤1 envio.

**Gating do outbox correto.** Kill switch (`server.js:2649-2651`), allowlist (`:2660-2663`) e human-handled (`:2667-2670`) retornam **antes** da construção do outbox (`:2680-2690`); owner recebe stub no-op (`:2681-2682`). Nenhum caminho silencioso acorda a cliente.

**Re-alerta não toca na cliente.** `realertar_handoff_sla.js` não importa `sendKapsoMessage`; `realertBreachedHandoffs` (`handoff-sla.js:124-156`) só emite `handoff.sla_breach` com `clientPhone: null` e devolve o aviso. *Efeito colateral (não bloqueante):* o re-alerta também **não** avisa o Tiago por WhatsApp — só emite evento e imprime JSON.

**last4-only mantido.** `last4FromPhone` + `redactSnippet` na camada lib (`handoff-sla.js:80,84`; `salao-cli-ops.js:105,108`); teste prova ausência do telefone cheio (`handoff-sla.test.js:50`). As 21 CLIs são wrappers finos de `printJson`.

**Segurança sem regressão.** Zero mutação Trinks, zero rota nova no backend, allowlist intacta, `BOT_ACCEPT_ALL` não tocado, `infra/.env` gitignored (`.gitignore:5`). O `/mcp` que o nginx passa a expor **falha fechado** (503 sem token, `timingSafeEqual` — `nightwatch-mcp.js:189-198`).

## Bloqueadores de publish

**SLA-01 (high) — SLA nasce vencido no fim de semana.** `computeHandoffSlaAt` (`handoff-sla.js:17-24`) olha 96 × 15 min = **24h** à frente. Domingo e segunda são fechados (`salon-dates.js:139-140`), então de sáb-18h a ter-09h são ~63h: o loop esgota e cai no fallback `now + 15 min`, dentro de horário fechado. Medido:

```
Dom 15:00 → SLA Dom 15:15 (FECHADO)   esperado Ter 09:15
Sáb 18:30 → SLA Sáb 18:45 (FECHADO)   esperado Ter 09:15
Dom 09:00 → SLA Dom 09:15 (FECHADO)   esperado Ter 09:15
Seg 12:00 → SLA Ter 09:15 (ok, 21h < 24h)
```

Handoff de fim de semana já nasce `breached=true` → `realertar_handoff_sla` repete `handoff.sla_breach`. Alert-fatigue no próprio guarda-corpo criado para proteger o tempo de resposta. ~39h/semana (~23%). **Interno ao Tiago; nunca atinge a cliente.**

**ENV-01 (high) — "Skip trivial OFF" não vale em produção.** O default de código está OFF (`tess-context-config.js:11`) e o compose tem fallback `false`. Mas o processo live roda **`skip_trivial=true` desde 2026-09-01**: tabela e log do container em `docs/ops/smoke-tess-context-scoped-whitelist-2026-09-01.md:15,53` e Task 6 da story (`:134`). O passo 5 do rito confere `TESS_CONTEXT_MODE`, `BOT_ACCEPT_ALL` e allowlist — **não** confere `TESS_SKIP_TRIVIAL`. Qualquer rota gera flip silencioso: publicando o compose, `${TESS_SKIP_TRIVIAL:-false}` resolve pelo `infra/.env` do VPS (=true) e o skip **continua ON**; resetando sem publicar, o passthrough desaparece e o skip **desliga sozinho**.

**ENV-02 (high) — o rollback documentado não existe hoje.** `git show HEAD:infra/docker-compose.yml | grep TESS_CONTEXT` → **nada**. O serviço `backend` usa bloco `environment:` explícito, **sem `env_file:`**, e `server.js` não carrega dotenv — logo o valor do `infra/.env` só chega ao processo via passthrough. O smoke afirma que as vars *estão* no container "via docker-compose.yml" (`:97`), ou seja **o compose do VPS tem edição local não commitada**. O passo 3 do rito (`git fetch` + reset) reverte esse arquivo para HEAD e leva o passthrough embora — com isso o passo 6 (`TESS_CONTEXT_MODE=full` / `TESS_CONTEXT_FORCE_FULL=1`) **deixa de funcionar** e o único rollback passa a ser reverter código + rebuild. A frase do handoff *"se o VPS já define a env, o fallback do compose não muda o processo"* é enganosa por isso.

**SCOPE-01 (medium) — mudança de hot-path fora da allowlist.** `backend/lib/tess-context-assembler.js` (+ 74 linhas de teste) não consta no handoff, mas adiciona `durationMin: resolveOfferDurationMin(...)` no bloco de slots — **comportamento de oferta visível à cliente**. Sem risco de crash: `resolveOfferDurationMin` é exportado (`tess-context-slots.js:442`) e esse arquivo está limpo.

**SCOPE-02 (medium) — nginx alterado apesar do "sem nginx".** `infra/nginx/default.conf` tem 43 linhas mexidas e o rito manda dar reload. Parte é **protetiva**: remove `n8n_upstream`/`chatwoot_upstream` (containers pausados) que fariam `nginx -t`/reload falhar e derrubar `api.studiotirra.com.br` junto. Parte é **superfície nova**: `location /mcp` público (auth falha fechado, mas não declarado). Sanidade offline: chaves balanceadas, zero referência remanescente.

## Findings não bloqueantes

- **OBX-01 (medium)** — a copy honesta morre em silêncio se o DB cair: `fired = true` e `await emitEvent(...)` vêm **antes** do `sendFn` (`outbound-outbox.js:23-35`), e `fired` bloqueia retry. O outbox existe para cenários de falha, que costumam coincidir com problema de infra. Não derruba o processo (`withTimeout` captura, `server.js:2248-2257`).
- **OBX-02 (low)** — armadilha latente de falso-positivo I1: `SUCCESS_COPY_RE` (`nightwatch-ops.js:27`) inclui o token **`cancelei`**, e a copy diz "Não gravei nem **cancelei** nada" → casa. Hoje **inativo**, porque a copy nunca é persistida e `verifyCommit` ignora `assistantText` externo de propósito (`:334-344`). Vira FAIL/I1 falso no instante em que alguém persistir a copy. O teste da fatia não pega: usa regex ad-hoc em vez de importar `SUCCESS_COPY_RE` (`outbound-outbox.test.js:7`).
- **OBX-03 (low)** — a copy não entra no `conversation_history`, então a cliente recebe algo que o bot não registra; em `scoped` (menos histórico) a Tess pode se contradizer no turno seguinte. Corrigir junto com OBX-02.
- **TEST-01 (medium)** — o teste `closed Sunday waits until Tuesday open + 15 min` (`handoff-sla.test.js:18-27`) asserta só `sla > now` e `getUTCHours() >= 12`; com o resultado bugado Dom 15:15 (18:15 UTC) **passa**. SLA-01 embarca verde.
- **SCOPE-03 (low)** — AC15 da story ainda diz default `full` (`:81`, `:96`); o override está em docs operacionais, mas sem nota de emenda na story.

## Triagem dos arquivos infra (risco #6)

| Arquivo | **Dentro** da fatia | **Fora** da fatia |
|---|---|---|
| `infra/.env.example` | `TESS_CONTEXT_MODE` full→scoped (`:59-61`) | bloco de crédito TESS (5 vars), `HUMAN_HANDLED_TTL_HOURS=6`, `NIGHTWATCH_MCP_TOKEN` |
| `infra/docker-compose.yml` | `TESS_CONTEXT_MODE`, `TESS_SKIP_TRIVIAL`, `TESS_CONTEXT_FORCE_FULL`, `TESS_TRIVIAL_MAX_CHARS` | `NIGHTWATCH_MCP_TOKEN`, `TESS_CREDIT_*` (5), `TRINKS_ALERT_PHONES`, `TRINKS_QUOTA_CHECK_MIN` |

Os adicionais do compose usam fallback `${VAR:-default}`, então são inertes se o VPS não definir nada — exceto `TESS_CREDIT_BUDGET:-1000` e os thresholds, que passam a existir no container e podem ativar alerta de crédito.

## Ações para liberar publish

| # | Ação | Owner |
|---|---|---|
| SLA-01 | Lookahead ≥288 iterações (72h) + assertar `isSalonOpen(sla).open` | @dev |
| ENV-01 | Victor define `TESS_SKIP_TRIVIAL` alvo; incluir a var no passo 5 do rito | Victor + @devops |
| ENV-02 | Commit **atômico** de `tess-context-config.js` + passthrough do compose; backup/diff do compose do VPS antes do reset | @devops |
| SCOPE-01 | Decidir `tess-context-assembler.js` (+teste): entra na allowlist com justificativa ou fica fora | Orion + Victor |
| SCOPE-02 | Decidir nginx: publicar (com `nginx -t` antes do reload) ou manter fora e não recarregar | Orion + @devops |

Antes de qualquer reset, capturar no VPS: `docker exec backend env | grep -E "TESS_(CONTEXT|SKIP)"` e anexar ao plano.

## Limites deste gate

Não autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, alteração de allowlist, abertura customer-wide, paste de prompt Tess, mutação Trinks nem smoke WhatsApp. Nenhum código de aplicação foi alterado nesta revisão — só os dois artefatos de QA. Estado real do env do VPS **não** foi verificado (sem autorização): ENV-01 e ENV-02 dependem de confirmação do Gage.
