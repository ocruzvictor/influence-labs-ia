# Gage — plano de publish da fatia outbox + SLA + scoped

> 2026-09-03. **PLANEJAMENTO. Nada foi commitado, pushado ou deployado nesta rodada.**
> Executado por Gage (@devops) em modo `*pre-push`, escopo restrito.

| Campo | Valor |
|---|---|
| SOT | `docs/handoffs/2026-09-03-orion-proxima-fatia-outbox-sla-scoped.md` |
| Rito | `docs/handoffs/2026-09-03-aiox-master-audit-dossier-tess.md` §9.4 |
| Branch | `feature/tess-commit-honesty` |
| HEAD local | `c93046d` |
| Código live | `07f59cb` (Story 13) |
| Working tree | 335 entradas — **`git add .` proibido** |
| Status desta rodada | commit **não** feito · push **não** feito · VPS **não** tocado |

## 1. Pré-condições verificadas (item 1 do pedido)

| Check | Resultado |
|---|---|
| `gh auth status` | OK — `ocruzvictorpareto` ativo, scopes `gist, read:org, repo, workflow` |
| Remote `origin` | `https://github.com/ocruzvictorpareto/influence-labs-ia.git` |
| Remote `vps` | `deploy@72.60.155.118:/opt/influence-labs` (existe; **não** usado como caminho de deploy) |
| Upstream da branch | `origin/feature/tess-commit-honesty` — já trackeia |
| Ahead/behind | `0 / 0` — local e remoto idênticos em `c93046d` |

Nenhum `git fetch`, `push`, `pull` ou PR foi executado. A branch já trackeia origin, então o push
futuro é `git push origin feature/tess-commit-honesty` **sem** `-u` e **sem** `-f`
(a regra `push -f origin main` do rito vale para `/app` Vercel em `main`, **não** para esta branch).

## 2. Commit allowlist (item 2 do pedido)

### (A) Novos da fatia — 35 arquivos

Libs (6):

- `backend/lib/outbound-outbox.js`
- `backend/lib/handoff-sla.js`
- `backend/lib/conversation-history.js`
- `backend/lib/salao-cli-ops.js`
- `backend/lib/salao-cli-context.js`
- `backend/lib/salao-cli-catalog.js`

Testes (7):

- `backend/test/outbound-outbox.test.js`
- `backend/test/handoff-sla.test.js`
- `backend/test/conversation-history.test.js`
- `backend/test/tess-context-bytes-persist.test.js`
- `backend/test/salao-cli-ops.test.js`
- `backend/test/salao-cli-context.test.js`
- `backend/test/salao-cli-catalog.test.js`

CLIs 0-LLM — `backend/scripts/salao/` (22 arquivos):

```
backend/scripts/salao/README.md
backend/scripts/salao/_lib/cli.js
backend/scripts/salao/agendamento/resolver_id_cancelamento.js
backend/scripts/salao/backlog/triar_backlog_last4.js
backend/scripts/salao/catalogo/consultar_faq_estatica.js
backend/scripts/salao/catalogo/consultar_preco_servico.js
backend/scripts/salao/contexto/agregar_bytes_contexto.js
backend/scripts/salao/contexto/classificar_intencao.js
backend/scripts/salao/contexto/medir_orcamento_contexto.js
backend/scripts/salao/contexto/simular_perfil_contexto.js
backend/scripts/salao/contexto/simular_skip_trivial.js
backend/scripts/salao/observabilidade/aceitar_handoff.js
backend/scripts/salao/observabilidade/correlacionar_last4.js
backend/scripts/salao/observabilidade/detectar_ack_sem_outbound.js
backend/scripts/salao/observabilidade/listar_fios_presos.js
backend/scripts/salao/observabilidade/listar_handoff_sla.js
backend/scripts/salao/observabilidade/listar_orfaos.js
backend/scripts/salao/observabilidade/patrulhar_ao_vivo.js
backend/scripts/salao/observabilidade/realertar_handoff_sla.js
backend/scripts/salao/observabilidade/relatar_slo_eventos.js
backend/scripts/salao/observabilidade/verificar_commit.js
backend/scripts/salao/snapshot/checar_frescura_snapshot.js
```

> **Atenção de staging:** `backend/scripts/` inteiro aparece como `??`. Estagiar
> `backend/scripts/salao` — **nunca** `backend/scripts`. `s3-tess-scoped-golden.js` e
> `sync-kb-content-to-tess.cjs` **não** são desta fatia.

### (B) Diffs limpos da fatia — 7 arquivos versionados

| Arquivo | Δ | Conteúdo |
|---|---|---|
| `backend/server.js` | +49/−16 | persist intent, `tess.context_bytes`, watchdog outbox, SLA no handoff |
| `backend/lib/tess-context-bytes.js` | +34 | `persistContextBytesEvent` |
| `backend/lib/tess-context-config.js` | +4/−3 | default `scoped` (Victor 2026-09-03) |
| `backend/lib/nightwatch-ops.js` | +3 | `WATCH_EVENTS` += `handoff.accepted`, `handoff.sla_breach`, `outbound.watchdog` |
| `backend/lib/tess-empty-handoff.js` | +2/−1 | payload SLA no `handoff.human` |
| `backend/test/server-tess-timeout.test.js` | +11/−5 | intent nos turnos |
| `backend/test/tess-context-profiles.test.js` | +5/−5 | default `scoped` |

**Atomicidade obrigatória (verificado, não suposto):** `tess-empty-handoff.js` faz
`require('./handoff-sla')` e `server.js` requer `outbound-outbox`, `handoff-sla` e
`conversation-history`. Rodando a suíte sem os libs novos → `Cannot find module './handoff-sla'`
em 4 testes. **(A) e (B) têm de ir no mesmo commit** — repetir o `MODULE_NOT_FOUND`
(`tess-context-slots`) do 1º publish honesty do dia é o risco concreto.

### (C) Infra misturada — staging por hunk, nunca o arquivo inteiro

#### `infra/.env.example` — 4 hunks, **incluir só o 1**

| Hunk | Conteúdo | Decisão |
|---|---|---|
| `@@ -57,9 +57,9 @@` | `TESS_CONTEXT_MODE` `full` → `scoped` | **INCLUIR** — é a fatia |
| `@@ -81,6 +81,15 @@` | `TESS_CREDIT_BUDGET`, `TESS_ALERT_*`, `TESS_CREDIT_CHECK_MIN` | EXCLUIR — fatia de crédito |
| `@@ -97,6 +106,8 @@` | `HUMAN_HANDLED_TTL_HOURS` | EXCLUIR — outra fatia |
| `@@ -111,6 +122,10 @@` | `NIGHTWATCH_MCP_TOKEN` | EXCLUIR — outra fatia |

#### `infra/docker-compose.yml` — 2 hunks, **incluir 2 linhas do hunk 2**

| Hunk | Conteúdo | Decisão |
|---|---|---|
| `@@ -108 +108 @@` | `NIGHTWATCH_MCP_TOKEN: ${NIGHTWATCH_MCP_TOKEN:-}` | EXCLUIR — outra fatia; sem ele o backend cai no `ADMIN_TOKEN` |
| `@@ -135,6 +136,17 @@` | bloco de 11 linhas | **SPLIT** — ver abaixo |

Do bloco de 11 linhas, **incluir exatamente 2**:

```yaml
      TESS_CONTEXT_MODE: ${TESS_CONTEXT_MODE:-scoped}
      TESS_CONTEXT_FORCE_FULL: ${TESS_CONTEXT_FORCE_FULL:-}
```

Excluir as 9 restantes: `TESS_SKIP_TRIVIAL`, `TESS_TRIVIAL_MAX_CHARS`, `TESS_CREDIT_BUDGET`,
`TESS_ALERT_THRESHOLDS`, `TESS_ALERT_REMAINING_THRESHOLDS`, `TESS_ALERT_PHONES`,
`TESS_CREDIT_CHECK_MIN`, `TRINKS_ALERT_PHONES`, `TRINKS_QUOTA_CHECK_MIN`.

> **Correção ao SOT — as 2 linhas são obrigatórias, não cosméticas.**
> O handoff diz “se o VPS já define a env, o fallback do compose não muda o processo”.
> Verificado em `git show HEAD:infra/docker-compose.yml`: o serviço `backend` **não** tem
> `env_file` e **não** lista `TESS_CONTEXT_MODE` nem `TESS_CONTEXT_FORCE_FULL`. Logo a env
> **não chega ao processo** hoje, independente do `.env` do VPS.
> Consequência: sem essas 2 linhas, o default `scoped` do código entra em vigor mas
> **o rollback por env vira no-op** — `TESS_CONTEXT_MODE=full` e `TESS_CONTEXT_FORCE_FULL=1`
> no `.env` do VPS não teriam efeito, e o único rollback seria reset de código.
> `TESS_SKIP_TRIVIAL` fica fora sem risco: o código lê `=== 'true'`, então o default é `false`
> com ou sem a linha — gate “skip trivial OFF” satisfeito.

Procedimento de staging (revisável):

```bash
git add -p infra/docker-compose.yml   # hunk 1 -> n ; hunk 2 -> s, depois e (manter só as 2 linhas)
git add -p infra/.env.example         # hunk 1 -> y ; hunks 2,3,4 -> n
git diff --cached --stat              # conferir ANTES de commitar
git diff --cached -- infra            # conferir linha a linha
```

### Explicitamente FORA do commit

| Arquivo | Motivo |
|---|---|
| `backend/lib/tess-context-assembler.js` (+2/−1) | fatia “oferta consultiva” (`resolveOfferDurationMin`) — outra fatia |
| `backend/test/tess-context-assembler.test.js` (+71/−3) | par do acima (OFERTA CONSULTIVA, `getSlotsGrouped`) |
| `infra/nginx/default.conf` (+19/−24) | fatia própria — **ler §5, impacta o runbook** |
| `infra/migrations/008,011,012,014,015*` | whitelist de teste + crédito TESS — outras fatias |
| `backend/scripts/s3-tess-scoped-golden.js`, `sync-kb-content-to-tess.cjs` | fora da fatia |
| ~300 restantes (AIOX sync, `.claude`, `.codex`, frontend, KB, stories) | fora |

**Par assembler verificado, não assumido.** Em worktree limpo em `c93046d` apliquei só os
libs + testes da fatia, mantendo o assembler em HEAD: `tess-context-profiles.test.js` +
`salao-cli-context.test.js` = **18/18 pass**. E `tess-context-assembler.test.js` (versão HEAD)
**não** quebrou. A fatia é autocontida sem o assembler.

**Migração: nenhuma necessária.** `conversation-history.js` grava `intent`, e
`infra/schema.sql:38` já define `intent VARCHAR(20)` (arquivo commitado e limpo). Sem
migration nova nesta fatia. Confirmar em prod com o `SELECT` do §4.

**Envs novas: nenhuma obrigatória.** A única env nova lida em runtime é `OUTBOX_WAIT_MS`
(`server.js`), com default 45s e piso de 5s. Fica **fora** do compose de propósito.

### Mensagem de commit proposta

```
feat(ops): outbox watchdog + SLA de handoff + contexto scoped por default

- outbound-outbox: watchdog pós-ACK com copy honesta (nao afirma agenda)
- handoff-sla: owner Tiago, SLA 15 min em horario comercial, aceite/re-alerta
- conversation-history: persiste turnos com intent
- tess-context-bytes: persiste tess.context_bytes em bot_operational_events
- tess-context-config: default scoped (override Victor 2026-09-03)
- nightwatch-ops: WATCH_EVENTS += handoff.accepted, handoff.sla_breach, outbound.watchdog
- scripts/salao: CLIs 0-LLM de observabilidade, contexto e catalogo

Sem migration. Sem alterar allowlist, BOT_ACCEPT_ALL ou prompt.
Rollback: TESS_CONTEXT_MODE=full ou TESS_CONTEXT_FORCE_FULL=1.
```

## 3. Runbook VPS (item 3 do pedido) — **executar só com ACK**

Host `deploy@72.60.155.118`. Worktree `/opt/influence-labs/worktrees/tess-commit-honesty`.
Contexto Docker/compose `/opt/influence-labs`. **Sem rsync da máquina local. Sem Hostinger.**

### Passo 0 — baseline (fazer sempre, antes de tocar em nada)

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs
git -C worktrees/tess-commit-honesty rev-parse HEAD          # esperado: 07f59cb
docker compose exec -T backend printenv | grep -E '^(BOT_ACCEPT_ALL|TESS_CONTEXT_MODE|TESS_CONTEXT_FORCE_FULL)=' || true
docker compose exec -T backend sha256sum server.js lib/nightwatch-ops.js
curl -s localhost:3001/health | head -c 400
docker compose ps
```

Registrar o `BOT_ACCEPT_ALL` observado. **Ele é o valor a preservar** — ver §5, risco R2.

### Passo 1 — worktree

```bash
git -C worktrees/tess-commit-honesty fetch origin feature/tess-commit-honesty
git -C worktrees/tess-commit-honesty reset --hard <SHA_NOVO>
git -C worktrees/tess-commit-honesty status --short   # tem de sair vazio
```

### Passo 2 — worktree → contexto Docker, **sem rsync**

O rito de Story 13 usou `rsync` interno e isso ficou registrado como desvio. Alternativa
determinística, sem rsync:

```bash
cd /opt/influence-labs
cp -a backend backend.bak.$(date +%s)      # rede de segurança do passo 2
git -C worktrees/tess-commit-honesty archive <SHA_NOVO> backend infra/docker-compose.yml \
  | tar -x -C /opt/influence-labs
git -C worktrees/tess-commit-honesty archive <SHA_NOVO> backend \
  | tar -tf - | wc -l                       # conferir contagem extraída
```

`git archive` não remove arquivo que saiu do commit. Nesta fatia só há adição/alteração,
nenhuma remoção — então é seguro. Se algum publish futuro remover arquivo, o `archive`
**não** serve. Se por qualquer motivo o `rsync` interno voltar a ser usado, **registrar como
desvio no `docs/ops/nightwatch-log.md`**, como foi feito na 13.

### Passo 3 — build + up (só backend)

```bash
docker compose build --no-cache backend
docker compose up -d backend
docker compose logs --tail=80 backend      # procurar MODULE_NOT_FOUND
```

### Passo 4 — nginx, **com guarda** (ver §5, risco R1)

```bash
docker compose exec -T nginx nginx -t      # SE FALHAR: PARAR. Nao recarregar. Escalar ao Victor.
docker compose exec -T nginx nginx -s reload
```

### Passo 5 — verificação

```bash
docker compose exec -T backend printenv | grep -E '^TESS_CONTEXT_MODE='        # scoped
docker compose exec -T backend printenv | grep -E '^TESS_CONTEXT_FORCE_FULL='  # vazio
docker compose exec -T backend printenv | grep -E '^BOT_ACCEPT_ALL='           # == baseline do Passo 0
docker compose exec -T backend sha256sum server.js lib/outbound-outbox.js lib/handoff-sla.js
curl -s localhost:3001/health          # status=ok, trinks_ping=ok, agent 46589
curl -s https://api.studiotirra.com.br/health | head -c 400
node backend/scripts/salao/observabilidade/patrulhar_ao_vivo.js --minutos 15   # read-only
```

Allowlist: **conferir sem alterar** — 1 `allow` (`0007`), 9 `block`, 7 `human_only`.
`block`/`human_only` **não** removidos.

### Rollback explícito

| Cenário | Ação | Toca código? |
|---|---|---|
| Contexto scoped regrediu | `TESS_CONTEXT_MODE=full` no `.env` + `docker compose up -d --force-recreate backend` | não |
| Emergência de contexto | `TESS_CONTEXT_FORCE_FULL=1` + recreate | não |
| Outbox mandando copy indevida | `OUTBOX_WAIT_MS` **não** desliga o watchdog. Rollback é de código: reset para `07f59cb` + Passo 2/3 | sim |
| `MODULE_NOT_FOUND` no boot | `git reset --hard 07f59cb` no worktree + Passo 2/3, ou `cp -a backend.bak.<ts> backend` | sim |
| nginx caiu no reload | restaurar `infra/nginx/default.conf` anterior + `nginx -t` + reload | sim (nginx) |

Ambos os rollbacks por env **dependem das 2 linhas do compose** do §2(C). Sem elas o rollback
por env é no-op e sobra só o reset de código.

## 4. Gates rodados local, sem publish (item 4 do pedido)

| Gate | Comando | Resultado |
|---|---|---|
| Testes da fatia | `node --test` nos 9 arquivos da fatia | **40/40 pass** |
| Suíte backend completa | `cd backend && npm test` | **555/555 pass**, 0 fail |
| Lint | `npm run lint` | **OK** |
| Typecheck | `npm run typecheck` | **OK** |
| Prompt tests | `npm test` (root, mock) | **79/79** — router 39, receptionist 20, faq 20 |
| Fatia sem o assembler | worktree limpo em `c93046d` + libs da fatia | **18/18 pass** |
| Segredos na allowlist | regex `api_key\|secret\|token\|password\|bearer` = literal ≥16 | **nada** |
| Telefone E.164 hardcoded | regex `55[0-9]{10,11}` nos novos libs/CLIs | **nada** |

Lint e typecheck da raiz são `tests/run-prompt-tests.js` (prompts), não ESLint de monorepo —
baratos e não são ruído, então rodei. Não existe lint de JS de backend configurado.

### O que NÃO foi coberto e por quê

- **A árvore está suja (335 entradas).** `npm test` do backend rodou contra a working tree,
  que **inclui** o `tess-context-assembler.js` que vai ficar **fora** do commit. Os 555/555
  são do estado local, não do commit proposto.
- Mitigação aplicada: worktree descartável em `c93046d` com **só** a fatia → 18/18 pass nos
  dois testes acoplados ao assembler, e o teste do assembler em HEAD não quebrou. Não fiz a
  suíte inteira nesse worktree porque ele não tem `node_modules` (`Cannot find module 'pg'`,
  `'express'` em 5 arquivos) — limitação de ambiente, não defeito de código.
- **Gate definitivo do commit:** rodar `cd backend && npm test` **no worktree do VPS** depois
  do Passo 1 e **antes** do Passo 3. É a única execução que valida exatamente o que vai buildar.
- Nada de rede foi executado: sem `git fetch`, sem push, sem PR, sem SSH, sem Hostinger, sem
  MCP de deploy.
- Prod **não** foi consultado. Ficam pendentes de confirmação no VPS: valor real de
  `BOT_ACCEPT_ALL`, presença de `conversation_history.intent`
  (`SELECT column_name FROM information_schema.columns WHERE table_name='conversation_history' AND column_name='intent';`)
  e se o `nginx.conf` do VPS já tem o ajuste n8n/chatwoot.

## 5. Riscos P-REL

### R1 — `nginx -s reload` pode derrubar `api.studiotirra.com.br` · **P-REL alto**

O `infra/nginx/default.conf` local (que está **fora** desta fatia) remove `n8n_upstream` e
`chatwoot_upstream` com o comentário: *“n8n/chatwoot paused (Hostinger CPU limit, 2026-09-03).
Do not resolve those hostnames here — nginx -t / reload would fail and take
api.studiotirra.com.br down with them.”*

A versão **commitada** (a que o VPS deve estar rodando) ainda tem os dois upstreams. Se n8n e
chatwoot estiverem parados no VPS, `nginx -t` falha na resolução e o reload do Passo 4 quebra o
vhost do backend junto. O Passo 4 já está guardado por `nginx -t`, mas isto é um **bloqueio de
decisão**: ou o VPS já recebeu esse ajuste fora de banda, ou o reload precisa de tratamento
próprio. O reload não é opcional — `upstream backend_upstream { server backend:3001; }` resolve
no boot e cacheia o IP; sem reload, o recreate do backend gera 502.

### R2 — o SOT contradiz o live em `BOT_ACCEPT_ALL` · **P-REL alto**

O handoff manda confirmar `BOT_ACCEPT_ALL=false` (§5, passo 5). O dossiê §9.6b registra que
Victor autorizou **OPEN** em `2026-09-03T19:55:18Z` e o live está **`BOT_ACCEPT_ALL=true`**.
Operador que seguir o handoff ao pé da letra “corrige” para `false` e **fecha o bot**. A
instrução desta rodada é não alterar. Por isso o Passo 0 grava o baseline e o Passo 5 compara
com o baseline, **não** com o literal `false`.

### R3 — o outbox fala com cliente real, e o live está OPEN · **P-REL alto**

`startOutboundWatchdog` dispara depois de `waitMs` (45s) ou no `catch`, e envia
`"Tive um problema técnico agora. Não gravei nem cancelei nada na agenda. Pode mandar de novo?"`.
Sob `BOT_ACCEPT_ALL=true`, o raio é **todo inbound novo**, não uma allowlist. Só o telefone do
owner é bypassado; kill/allowlist/human-handled retornam antes do watchdog ser armado.
Victor autorizou duplicar, mas o gate era pensado em piloto restrito, não em OPEN — e o dossiê
tinha 20 `p0_stuck`. Não há kill switch de env: desligar exige rollback de código.
**Vale ACK explícito de “outbox ligado em OPEN”.**

### R4 — write amplification em `bot_operational_events` · **P-REL médio**

`persistContextBytesEvent` é chamado em **dois** pontos de `processMessage` (caminho skip e
caminho assembled), a cada turno. `bot_operational_events` é append-only, sem retenção nem
particionamento (migration 010), com 2 índices em `received_at`. Em OPEN a tabela passa a
crescer por mensagem, não por incidente — e é a mesma tabela que `handoff-sla.js` e as CLIs de
patrulha consultam. Sem plano de retenção, degrada patrulha e backup. Não bloqueia o publish;
pede vigilância de tamanho depois do primeiro dia.

### R5 — o rebuild embarca `resume-ia.6`, que nunca esteve live · **P-REL médio**

Live é `07f59cb`; a branch está em `c93046d`. São 8 commits de intervalo, 7 de docs e **1 de
código**: `4dcbf4e fix: enable forced conversation resume [Story resume-ia.6]`
(`backend/lib/resume-conversation.js` +167/−37, `resume-conversation.test.js` +172).
Esse commit já está em origin, mas **não** está live. O rebuild o publica junto com a fatia.
Não é escopo desta fatia e precisa ser declarado no ACK — resume forçado sob OPEN mexe em
retomada de conversa.

### R6 — rollback por env é no-op sem as 2 linhas do compose · **P-REL médio**

Detalhado em §2(C). Se o hunk do compose for cortado inteiro “por prudência”, o efeito é o
oposto: `scoped` entra em vigor pelo default do código e `TESS_CONTEXT_MODE=full` deixa de ter
efeito. Cortar tudo é mais arriscado que incluir as 2 linhas.

### R7 — commit parcial quebra o boot · **P-REL médio, mitigado**

`tess-empty-handoff.js` e `server.js` requerem os libs novos. Se (B) entrar sem (A), o backend
sobe com `MODULE_NOT_FOUND` — exatamente a falha do 1º publish honesty de 2026-09-03
(`tess-context-slots`). Mitigação: `git diff --cached --stat` antes do commit + `npm test` no
worktree do VPS antes do build.

### R8 — `git archive` não propaga remoção · **P-REL baixo**

O Passo 2 troca rsync por `git archive | tar -x`. `tar -x` sobrescreve e adiciona, mas não
apaga arquivo que saiu do commit. Nesta fatia não há remoção, então é seguro; para publishes
futuros com remoção, o método não serve.

### R9 — re-alerta de SLA não é automático · **P-REL baixo, expectativa**

`realertBreachedHandoffs` só existe via CLI
(`backend/scripts/salao/observabilidade/realertar_handoff_sla.js`). Não há `setInterval` no
`server.js` (só existem os de quota Trinks e crédito TESS). O SLA de 15 min **mede e registra**,
mas o re-alerta é manual/cron. Ninguém deve esperar re-alerta automático depois do deploy.

## 6. Gate Quinn — conferido no código

| Item | Verificação | Status |
|---|---|---|
| I1: copy do outbox não afirma agenda | `OUTBOX_COPY` = “Tive um problema técnico agora. Não gravei nem cancelei nada na agenda. Pode mandar de novo?” | PASS |
| Outbox não fala de kill/allowlist/human-handled/owner | copy única, sem ramo por estado | PASS |
| SLA não muta Trinks | `handoff-sla.js` só faz `SELECT` em `bot_operational_events` + `emitEvent` | PASS |
| Re-alerta não fala com cliente | `realertBreachedHandoffs` emite `handoff.sla_breach` e devolve `notice`; `clientPhone: null`, sem `sendFn` | PASS |
| SLA notice é interno | `formatHandoffSlaNotice` só entra em `notifyTiagoHandoff` (WhatsApp do Tiago) | PASS |
| Default `scoped` vs AC15 | override Victor 2026-09-03 documentado no header de `tess-context-config.js` | PASS |
| Skip trivial OFF | `skipTrivial = env.TESS_SKIP_TRIVIAL === 'true'` → default `false`; linha fora do compose | PASS |
| Sem story nova H-CRM / H-SPLIT | nada em `docs/stories/` nesta allowlist | PASS |
| CLIs 0-LLM | sem `callTESS`, `openai`, `anthropic` em `backend/scripts/salao/` | PASS |

## 7. Pendências de ACK do Victor

Nada avança sem estes quatro. Gage não commita, não pusha e não toca o VPS até o ACK.

1. **Commit + push** de `feature/tess-commit-honesty` com a allowlist do §2 (35 novos +
   7 diffs + 2 hunks de infra). Sem PR nesta rodada.
2. **Rebuild do VPS** — que embarca também `resume-ia.6` / `4dcbf4e` (risco R5).
3. **As 2 linhas de `TESS_CONTEXT_MODE` / `TESS_CONTEXT_FORCE_FULL` no compose** (risco R6),
   e se o `.env` do VPS deve declarar `TESS_CONTEXT_MODE=scoped` explicitamente ou ficar
   no default do compose.
4. **Outbox ligado sob OPEN** (risco R3) e **como tratar o `nginx -t`** se ele falhar por
   n8n/chatwoot (risco R1).
