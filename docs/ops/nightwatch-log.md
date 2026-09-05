# Nightwatch log

Append-only. last4 only. Created 2026-09-02 with squad tess-nightwatch.

## 2026-09-02 ~13:40 UTC — floor + supervisor (pós-deploy 12:31 UTC)

Janela: backend StartedAt 12:31:43Z. Pedido Victor: Bianca insistiu confirmar + Marcel horário do Alisson.

- last4 `4700` 12:49–13:13Z. SCHEDULING. 12:52:51Z tags.parsed creates=4 → guard.blocked consultive distinct=4 → handoff orcamento_referencia. WhatsApp “Confirmado,” (sanitize só pega `Confirmado!`). 2-phase teste. 13:13Z user “Perfeito” human-handled TTL 6h. Trinks Balcão 13:11Z Mechas+Corte Jackie 09:30 05/09. I1 fail. Sem POST bot.
- last4 `2513` 12:52–13:26Z. Erick corte infantil sáb. Ofereceu 13h e 13h30. last4 `5389` já tem Erick 827204 13:00 05/09 (Balcão 11:25Z). trinks_slots 13:00/13:30 available=true synced 01/09 21:10Z. I3 fail. 13:26Z user “Correto” tags.parsed creates=1 → `profsPayload is not defined` → sem kapso send. Sem booking.*. I2 fail. Thread presa.
- Causa comum slots: webhook 11/12/13 upsert appointment, não `markSlotAvailable(false)`.
- Causa Marcel commit: `server.js` copia `assembledCtx.svcPayload`, não `profsPayload`.
- Next: patch C1+C2+C3. Não POST 13:30. Não resume `4700`. Humano no `2513` com slot real.

invariants: I1 broken `4700`, I3+I2 broken `2513`. P0.

## 2026-09-02 ~13:45 UTC — patch P0 pós-feedback Tiago

C1 `profsPayload` atribuído do assembler (crash Marcel Correto).
C2 webhook 11/12/13 + POST bot marcam janela `durationMin` em `trinks_slots` (Alisson 13h/60min ocupa 13:00 e 13:30).
C3 sanitize `Confirmado,` sem exigir `!`.
Intent: `Correto`/`Perfeito` em histórico de agenda → SCHEDULING.
Ops: não gravar Marcel 13:30; não resume Bianca 4700. Backfill SQL de janelas ocupadas no deploy.
Grok Bot: instruções em `docs/ops/grok-bot-instructions/` + setup. Créditos Tess: recarga 300 se ≤30 — não é P0.

## 2026-09-02 ~13:45 UTC — ops model (Victor)

Time do salão + Tiago acompanham WhatsApp e corrigem na Trinks (origem Balcão) quando a Tess erra. `4700` 13:11Z e `5389` 11:25Z são essa rede, não o bot. C2 (webhook sem markSlot) faz a correção humana ficar invisível no HORARIOS → próximo cliente (`2513`) leva o slot já ocupado. Patch C2 é para a rede de segurança não envenenar o fio seguinte. Sem resume `4700`. Sem POST 13:30 `2513`.

## 2026-09-02 ~13:54 UTC — P0 ACK Supervisor + deploy (opção 3)

Victor escolheu patch + time segue no Marcel. Gate local 80/80 (parser, webhook, store, guards). C1/C2/C3 já estavam no host 13:39 + rebuild 13:45 (Erick 13:00/13:30 e Jackie 09:30–14:30 occupied). Endurecimento CREATE crash (`booking.failed` kind=create_crash + copy honesta) rsync server.js + rebuild 13:54:29Z. Health ok, trinks_ping=ok, agent 46589. Zero POST Trinks. Sem resume `4700`/`2513`. Time fecha o Gustavo com início real do Erick.

## 2026-09-02 — canal Grok + MCP Nightwatch

Grupo Grok `Nightwatch` (Nox/Mira/Quinn/Desk) é o canal de handoff (`@` + YAML). MCP read-only em `https://api.studiotirra.com.br/mcp` (tools patrol_live, get_thread, verify_commit, list_orphans). Sem SQL cru, last4 only. Dex continua no Cursor.

## 2026-09-02 ~15:10 UTC — primeiro *patrol-live via MCP (grupo)

Nox: health 46589 / trinks ok / OPEN. orphans 0, mutation fail 0, leak 0.
- P0 `7434` presa ~225min. User 11:23Z “sexta de manhã escova jacki”. Sem reply. Sem `bot_thread_state`. Sem evento após tags.parsed 11:22Z (saudação). I1 N/A (sem afirmação). Não POST. Humano ou resume — não deixar cair.
- P3 listados: `5389` `7247` `4700` handoff ACTIVE — não resume. `2513` fio do Marcel (humano no chat). `8454` só salvou contato.
- Nox subestimou `7247`: 11:48Z “Vou registrar… Tá garantido!” + tags.parsed creates=1; 11:57Z handoff `dado_indisponivel`. I1 para Quinn. Silêncio ACTIVE.

## 2026-09-02 ~15:20 UTC — *audit-floor-quality (negócio, go-live→agora)

Pedido Victor: inventário não técnico das regras + logs da noite OPEN. Mira (Grok) no roteiro/KB; Dex-Night (Composer) no Postgres. Quinn I1/I2 não fechou nesta sessão — veredito Orion a partir da evidência.

Janela 01/09 21:44Z–02/09 15:20Z: events 170; handoff.human 7 (dado_indisponivel 2, orcamento_referencia 2, multi_servico 2, cliente_pediu_humano 1); guard.blocked 3 (needs_reference, consultive, expediente); booking.* 0; agent_mutation 1 PUT reschedule 204; appointments synced 55; user/assistant 290/147. Silêncio ativo `5389` `7247` `4700`. human_only `2513` `8383`.

I1 FAIL: `8027` `8194` `7247` `4700` `8528` garantia/confirmado/já marcado sem commit. I2 FAIL: `1305` combo tabela handoff; `5389` 1 SKU+Erick → dado_indisponivel; `7434` escova Jackie sem reply. I3 FAIL: `2513` 13h/13h30 Erick já ocupado pelo `5389`.

Regra que mais empurra humano: I.8 “tá garantido” vs I.1 “não diga agendado”; combo mechas vs tabela; lista de vagos atrasada vs Balcão. Não resume `4700`/`7247`/`5389`. Não POST 13:30 `2513`. Canvas piso: tess-regras-atendimento-negocio.

## 2026-09-03 ~02:55 UTC — *audit-floor-quality Mira (pós 13:54Z)

Janela 02/09 13:54Z–03/09 02:55Z. Amostra 8 reais (excl. `0330`/`1234`). GET 44 vs POST create 2 + PUT 2 + POST cliente 400. booking.created 2. tess.context_bytes 0. C1/C3 não repetiram; C2 marcou `5668` 21:30Z occupied 22:12Z.

I1 FAIL (não PASS): `9605` 21:43Z “tudo certo” manicure 9h Fefe após 3× guard; `0101` 02:13Z “já confirmamos” pós booking.failed TipoId; `5718` 16:19Z franja+escova 15:30 com só franja 15:00 BRT; `5668` 21:22Z “já confirmamos” 17:30 — Balcão gravou 18:30. Quinn *verify-trinks-commit.

I2: `8134` dado_indisponivel mão/pé (molde `5389`); `0101` tess.empty 02:15Z. I3: `4749` 14h Tiago sáb → janela 30min < 60min. Fidelidade: `7163` vazou HABILITACAO. last4 antigos `8027`/`4700`/`2513` sem assistant novo.

Causa: I.8/I.12 ensinam a afirmar na tag; guard/Trinks recusam depois. Cliente nova morre em TipoId. Balcão ainda fala no fio. Dex *patch-booking-path (não patchar daqui). Report: docs/handoffs/2026-09-02-mira-floor-audit.md.

## 2026-09-03 ~02:52 UTC — *patrol-live Nox (pós-deploy 15:02:37Z)

Janela primária: backend StartedAt 15:02:37Z → 02:50Z. Health ok, trinks_ping=ok, OPEN accept_all=true, agent 46589. Créditos 6496/1000 (P2, não P0). last_inbound /health stale (17:40Z) vs inbound real 02:15Z.

P0 novo: `0101` 02:13:03Z booking.failed I2 — POST /clientes 400 TipoId vazio (cliente novo). 2-phase honesto; TESS depois “já confirmamos” I1; 02:15:14Z tess.empty SCHEDULING + fallback. Sem handoff.human. notify-human + activate-dev. Sem resume.

Ainda quebra na versão nova: I1 `9605` 21:43Z manicure “tudo certo” sem POST; I1 `5718` 16:19Z franja+escova com 1 POST; I3 `5668` 21:09Z ofereceu 16:30 → janela-block + handoff encaixe (silêncio até 03:22Z); orfão evento `2185` 20:00Z (PUT 204 — I1 cliente passa, falta booking.rescheduled). Stuck `7163` “Confirma” pós-handoff.

Mutations: 2 POST 201, 1 PUT 204, 1 POST /clientes 400. Orphans OPEN 9 / desta versão 1. Não POST. Não resume. Handoff `docs/handoffs/2026-09-02-nox-patrol-audit.yaml`.

## 2026-09-03 ~04:18 UTC — Orion ACK + Victor rsync `6b4fa07`

Victor autorizou opção 2. Dex rsync lib+server.js + `docker compose up -d --build backend` + nginx. StartedAt `2026-09-03T04:18:08Z`. Health ok, trinks_ping=ok, 46589 OPEN. MD5 live=repo: server.js `e3f8c9d2`, trinks-mapping `8126693d`, tess-empty-handoff `c3528031`, booking-parser `e01ef978`. `TELEFONE_TIPO_ID.WHATSAPP=6` no container. Zero POST Trinks. Zero resume. Prompt v3.2.2 Victor colou (dashboard). I1/I2 vivo ainda CONCERNS até last4 novo — não replay `0101`.

## 2026-09-03 ~13:12 UTC — smoke `0007` + GLOBAL OFF

Whitelist só `0007` + global on de manhã. CREATE 08:15 André 10:30 `trinksId=526039154` 201 (PASS). Ato 1 I1 Fefe 9h PASS. P0.7 tess.empty→handoff PASS. Ops cancel 09:30 204.

Bugs: B1 createKeys sessão trata slot cancelado como duplicata + “Confirmo aqui” sem POST; B2 cancel tag SKU `14232906` → not_owned; B3 “Esquece… agora só um corte” → FAQ abort + dado_indisponivel. TipoId não exercitado.

Ops 10:12 BRT: `bot_toggles.global=false` (silêncio total). 8 allows smoke restaurados. `BOT_ACCEPT_ALL=true`. Handoff plano: `docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md` → sessão madrugada `3dceb1a7-f9d4-4149-9731-dd341cc58bba`. Sem rsync. Sem religar Chatwoot/n8n.

## 2026-09-03 ~15:11 UTC — smoke exclusivo `0007`

Victor autorizou a ativação restrita para o teste. `bot_toggles.global=true` apenas como chave técnica; `BOT_ACCEPT_ALL=false`; exatamente um telefone terminado em `0007` permanece `allow`, e os 8 `allow` anteriores foram mudados para `block`. Fallback `.env` também ficou com somente o sufixo `0007`.

Backend recriado sem build de código, health HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589; nginx recebeu reload para atualizar upstream. Nenhuma mensagem WhatsApp, mutação Trinks ou outro smoke foi executado. Backup do `.env` no VPS: `/opt/influence-labs/infra/.env.pre-0007-20260903T151136Z`.

## 2026-09-03 ~16:09 UTC — smoke `0007` B1/B2 (B3 não exercitado)

last4 `0007`. B2/B4 PASS: “Pode cancelar esse que a gente acabou de marcar” → intent CANCEL + PATCH 204 `526180491`. B1 PASS: mesmo corte Erick 14:30 após cancel → POST 201 `526185055` + 2-phase honesta.

Último “Pode cancelar esse também” → intent CANCEL, mas `TESS_CONTEXT_MODE=full` mandou perfil FULL (~91k / 22k tokens, grade de horários inclusa). TESS abortou por timeout. Sem tags.parsed, sem PATCH, sem outbound. Thread **não** está `silenced_until`. Victor cancelou `526185055` manualmente. B3 não rodou.

P0 follow-up: CANCEL em modo `full` não pode carregar a grade inteira (timeout = silêncio aparente).

## 2026-09-03 ~16:17 UTC — smoke `0007` B3

Mensagem B3 recebida: “Esquece isso então. Agora quero só um corte no sábado, 05/09, de tarde, com Erick.” A Tess entrou no fluxo de agendamento e ofereceu `15:00`/`15:30`; não respondeu FAQ, não emitiu `dado_indisponivel`, não gerou `handoff.human` e a thread não está silenciada.

`tags.parsed`: `creates=0`, `cancels=0`, `reschedules=0`; nenhum POST/PATCH Trinks foi executado porque o cliente ainda não escolheu horário. B3 fica **PASS na etapa de classificação/roteamento**; criação completa só ocorre se Victor escolher uma das opções.

## 2026-09-03 ~16:59 UTC — correção local do P0 de timeout

Story 12 implementada no working tree: `CANCEL` high em modo `full` agora carrega somente reservas futuras; timeout/abort TESS retorna copy honesta, persiste o turno, emite `tess.timeout` e não executa mutação nem silêncio automático.

Gate @qa **PASS**: 103/103 focados, 512/512 backend, 79/79 prompts, lint/typecheck/sintaxe/whitespace PASS. CodeRabbit CLI 0.7.5: doctor 9/9 e review do backend com arquivos não rastreados: **0 findings**. Relatório: `docs/qa/coderabbit-reports/epic-tess-commit-honesty-timeout-2026-09-03.jsonl`.

Antes da publicação, a correção foi validada localmente sem nova mensagem WhatsApp, POST/PATCH Trinks, replay `0101`, exercício 03/09 10:30 André ou abertura para clientes. O próximo passo permanece smoke restrito no `0007` em outro slot e conclusão do B3.

## 2026-09-03 ~17:10 UTC — publicação Story 12

Commit `0b39035` publicado em `origin/feature/tess-commit-honesty` e aplicado ao worktree VPS. O backend foi reconstruído sem `rsync`; uma primeira build com cache desatualizado foi corrigida com atualização do contexto Docker e rebuild `--no-cache`.

Health interno/público **200**, `status=ok`, `trinks_ping=ok`, TESS 46589, hashes dos módulos da Story 12 conferindo. Modo **WHITELIST**, `BOT_ACCEPT_ALL=false`, `bot_toggles.global=true` como chave técnica e único `allow` terminado em `0007`; `.env`, whitelist e toggles não foram alterados.

Nenhuma mensagem WhatsApp, mutação Trinks, replay `0101` ou abertura customer-wide foi executada. Próximo passo: smoke manual restrito no `0007`, em outro slot, e B3 completo.

## 2026-09-03 17:17–17:28 UTC — smoke pós-publicação `0007`

Nightwatch puxou a janela real após `0b39035`: health interno/público 200, `status=ok`, `trinks_ping=ok`, TESS 46589, WHITELIST intacta e `BOT_ACCEPT_ALL=false`.

- **B3 PASS:** abort + pedido novo → `SCHEDULING`/`BOOKING`, oferta de horário, depois POST 201.
- **B1 PASS:** CREATE `526224907` → PATCH cancel 204 → novo POST 201 `526226713`; nenhum skip idempotente indevido.
- **B2/B4 PASS:** cancelamento classificado `CANCEL`, perfil `CANCEL`, `horarios=0`, PATCH 204 e `booking.cancelled outcome=all`; nenhum `cancel.not_owned`.
- **P0 PASS:** CANCEL ficou em ~5.958 caracteres / ~1,5k tokens, sem grade grande; TESS respondeu em ~7,2s e não houve `tess.timeout`.

Eventos da janela: `tags.parsed` ×7, `booking.created` ×2, `booking.cancelled` ×1; zero 5xx, `MODULE_NOT_FOUND`, `booking.failed`, `handoff.human` ou silêncio. O piloto segue restrito ao único `allow` `0007`; não abrir `BOT_ACCEPT_ALL=true`.

## 2026-09-03 17:52 UTC — allowlist temporária para smoke de cliente novo

Por autorização explícita do Victor, o telefone terminado em `8440` foi adicionado como `allow` para validar o cadastro de cliente novo. O `0007` existente foi preservado; nenhum outro telefone foi alterado.

- Antes: `bot_whitelist` com 1 allow (`0007`); `BOT_ACCEPT_ALL=false`.
- Depois: `bot_whitelist` com 2 allows (`0007`, `8440`); `BOT_ACCEPT_ALL=false`; `bot_toggles.global=true` preservado.
- `.env` recebeu `8440` em `BOT_ALLOWED_PHONES`; backup: `/opt/influence-labs/infra/.env.pre-8440-20260903T175224Z`.
- Nenhum restart, mensagem WhatsApp ou POST/PATCH Trinks foi executado. O roteamento DB aplica a alteração após o TTL de cache de 5s; o fallback já persistido no container continua `0007`-only até eventual restart.

## 2026-09-03 18:08–18:15 UTC — smoke cliente novo `8440`

O smoke do telefone temporário terminou com fluxo completo e sem silêncio:

- Cliente novo confirmado (`client=false`): GET `/clientes` 200 → POST `/clientes` 201 (`agent_mutation_create_client`) → POST `/agendamentos` 201.
- `booking.created` emitido; não houve 400 de `TipoId`, `booking.failed`, `tess.timeout`, 5xx ou `handoff.human`.
- Cancelamento posterior: `CANCEL` enxuto, PATCH 204 e `booking.cancelled outcome=all`; nenhum `cancel.not_owned`.
- Todos os quatro turnos tiveram outbound Kapso 200. B1 re-CREATE no mesmo slot não foi exercitado nesta sessão; já havia PASS no smoke `0007`.
- O turno de confirmação passou por `UNCERTAIN/FULL` (~89k caracteres) e concluiu em ~12,4s; não é falha do P0 de CANCEL, mas permanece sinal de monitoramento.

Após a coleta, o allow temporário `8440` foi removido conforme autorização limitada ao smoke. DB e `.env` voltaram a `0007`-only, `BOT_ACCEPT_ALL=false`, `bot_toggles.global=true`, health público 200, sem restart.

## 2026-09-03 — gate da correção de monitoramento Nightwatch

Story [tess-commit.13](../stories/salon-whatsapp-nightwatch-monitoring-scope.md) e gate [QA PASS](../qa/gates/tess-commit.13-nightwatch-monitoring-scope.yml).

- `tess.timeout` entrou no patrol como `p0_timeout` separado de `p0_leaks`; timeout na janela aciona `activate-peer`.
- `patrolLive` permanece global. `verifyCommit` usa last4 apenas para resolver internamente um telefone completo dentro da janela; colisão retorna `CONCERNS/ambiguous_last4` e não mistura evidências. Mutações ficam scoped por metadata; `listOrphans` correlaciona por telefone completo e aceita `booking.rescheduled`.
- Metadata do ledger é whitelist-only para `agent_mutation_*`; respostas continuam last4/snippets redigidos e as ferramentas Nightwatch seguem read-only.
- Gates: 39/39 focados, 531/531 backend, 79/79 prompts, lint/typecheck/syntax/diff PASS; CodeRabbit CLI 0 findings.
- Nenhuma alteração operacional foi feita: sem deploy/push, Hostinger, `rsync`, mutação Trinks, allowlist ou abertura customer-wide. `tess.context_bytes` segue como follow-up.

## 2026-09-03 ~19:04 UTC — publicação Story 13

Commit `07f59cb` publicado em `origin/feature/tess-commit-honesty` e aplicado ao worktree VPS `/opt/influence-labs/worktrees/tess-commit-honesty`. Backend sincronizado do worktree para o contexto Docker e reconstruído com `docker compose build --no-cache backend` + `up -d backend`; nginx recebeu reload.

Health interno/público **200**, `status=ok`, `trinks_ping=ok`, TESS **46589**. Hashes conferindo (`server.js`, `nightwatch-ops.js`, `trinks-api.js`). `patrol_live` expõe `signals.p0_timeout` no live.

Configuração preservada: `BOT_ACCEPT_ALL=false`, modo **WHITELIST**, `bot_toggles.global=true` (chave técnica), único `allow` last4 **`0007`**; **`8440` ausente**. Sem alteração de `.env`, Postgres/volumes, prompt ou allowlist.

Nenhuma mensagem WhatsApp, POST/PATCH Trinks ou smoke mutável foi executado nesta publicação. Validação read-only: health + `patrol_live` ( `p0_timeout=0`, chave presente).

## 2026-09-03 ~19:11 UTC — baseline da patrulha pós-publicação

- Health interno/público permaneceu HTTP **200**, `status=ok`, `trinks_ping=ok`, TESS **46589**, modo **WHITELIST**, `BOT_ACCEPT_ALL=false` e allow único last4 **`0007`**.
- `patrol_live` em janela de 60 min (mesmo resultado em 15/180): `p0_stuck=20`, `p0_orphans=0`, `p0_mutation_fail=0`, `p0_leaks=0`, `p0_timeout=0`; `next_action=activate-peer`.
- `activate-peer` veio exclusivamente de `p0_stuck`; os 20 fios tinham última mensagem anterior ao início do backend Story 13 (~19:03:50Z), e `0007` não aparece na lista. Não há evidência de regressão pós-deploy.
- Não houve evento operacional pós-deploy na janela. O smoke WhatsApp mutável da Story 13 continua não executado.
- **Follow-up PROPOSTO (P-STUCK):** triar os 20 fios históricos e avaliar lookback/filtro de allowlist, `human_only` e silêncio em `listStuckThreads`; enquanto isso, `activate-peer` deve ser lido como baseline histórico, não como timeout.

## 2026-09-03 19:55:18 UTC (16:55:18 BRT) — OPEN para novas mensagens (autorização Victor)

Corte operacional: `2026-09-03T19:55:18Z` / `2026-09-03T16:55:18 -03`. Escopo: aceitar **novas** mensagens de todos os contatos; **não** processar nem resumir backlog histórico (lista auditada aguarda aprovação individual).

**Before:** `BOT_ACCEPT_ALL=false`, modo **WHITELIST**, `accept_all=false`. `bot_toggles.global=true` (chave técnica, `updated_at` 15:11:37Z — sem update). Whitelist: 1 allow (last4 `0007`), 9 block, 7 human_only (17 total). Backend StartedAt 19:03:50Z (Story 13).

**Change:** somente `.env` `BOT_ACCEPT_ALL=false` → `true`. Backup datado no VPS (`.env.preopen20260903T195518Z`). `BOT_ALLOWED_PHONES`, KAPSO, TESS, Trinks, prompt e demais env **intocados**. `bot_toggles.global` já era `true` — nenhum UPDATE. Whitelist/denylist **sem alteração**.

**Deploy:** `docker compose up -d --force-recreate backend` (sem build, rsync, nginx, migrations, volumes). Backend StartedAt **19:55:32Z** (após corte).

**After:** health interno/público HTTP **200**, `status=ok`, `trinks_ping=ok`, TESS **46589**, `accept_all=true`, `mode=OPEN`. `bot_toggles.global=true`. Whitelist inalterada: 1 allow / 9 block / 7 human_only. Log startup: `Bot mode: OPEN (responde todos)`.

**Zero backlog automático:** `bot_operational_events` pós-corte = 0 (sem resume, outbound, inbound processado). Nenhuma mensagem WhatsApp enviada; nenhum POST/PATCH Trinks.

**Limites preservados:** block/human_only continuam valendo sobre OPEN. Backlog histórico depende de aprovação individual — não resume nesta execução.

**Rollback (não executado):** restaurar backup → `BOT_ACCEPT_ALL=false` → `docker compose up -d --force-recreate backend`; manter `bot_toggles`, whitelist e volumes.

## 2026-09-03 20:50:57 UTC (17:50:57 BRT) — retomada backlog aprovado (14 last4)

Autorização Victor após revisão da lista. Story **resume-ia.6** live (`4dcbf4e`). Fluxo: `POST /admin/conversations/:phone/resume` individual, `force=true`, `actor=admin`, nota operacional 229 chars. Janela de resolução auditada: 02:35:52Z–19:52:51Z. Sem Trinks, sem alteração env/whitelist/global, sem redeploy.

**Janela:** `20:50:57Z` → `20:53:58Z` (~3 min). Backend Story 6 StartedAt 20:48:16Z.

**14 aprovados — todos `200 sent`:** `6388`, `7504`, `9002`, `6932`, `9800`, `5031`, `4467`, `7625`, `6397`, `2062`, `1000`, `3653`, `8290`, `8085`. Cada um: 1× `resume.requested` + 1× `resume.sent`. Resolução única por last4 na janela auditada (colisões jun/6388,7625,8085 resolvidas para inbound 03/09). Zero SKIP/HOLD/409/422/503.

**15 HOLD intactos — zero resume/outbound:** `9117`, `5953`, `7051`, `4657`, `6361`, `3300`, `7153`, `7016`, `6153`, `8741`, `1944`, `0007`, `8440`, `0101`, `8194`.

**Pós-op:** health **200**, `status=ok`, `trinks_ping=ok`, TESS **46589**, `mode=OPEN`, `accept_all=true`, `global=true`. Whitelist inalterada: 1 allow / 9 block / 7 human_only.

**Totais:** 14 enviados / 0 window_closed / 0 skipped / 0 hold / 0 pendente nesta execução. 15 hold aguardam decisão futura.

## 2026-09-03 22:30Z — publish fatia outbox + SLA + scoped (`b42bb2b`)

Victor ACK 1 (skip baseline ON) + 2 (passthrough) + 3 (assembler/nginx fora) + 4 (publicar).

**Before:** worktree `07f59cb`. Processo: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true`. Health ok.

**Change:** commit `b42bb2b` → origin. Worktree reset `b42bb2b`. `git archive` só `backend/` (sem rsync, sem sobrescrever compose). Backup `backend.bak.1788474285`. `docker compose build --no-cache backend` + `up -d`. `nginx -t` ok → reload.

**After:** worktree `b42bb2b`. Log: `context mode=scoped skip_trivial=true`, `Bot mode: OPEN`. Env idêntico ao baseline. Health interno/público ok, `trinks_ping=ok`, agent 46589. Libs `outbound-outbox`, `handoff-sla`, `conversation-history` no container. Zero MODULE_NOT_FOUND.

**Fora:** assembler, nginx conf, allowlist, prompt, Hostinger. Smoke `0007` **não** rodou.

## 2026-09-04 12:37Z — publish fatia pool Victor (`a08f23b`)

Victor ACK “pode publicar”. Quinn CONCERNS 86, zero `blocks_publish`.

**Before:** worktree `b42bb2b`. `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true`. Health ok.

**Change:** `a08f23b` → origin. Worktree reset `a08f23b`. `git archive` só `backend/`. Backup `backend.bak.1788525408`. `docker compose build --no-cache backend` + `up -d`. `nginx -t` ok → reload.

**After:** worktree `a08f23b`. Container: `UNCERTAIN profile=MIN`, `tess-trace.js` presente. Env = baseline. Health público ok, `trinks_ping=ok`, agent 46589.

**Fora:** Hostinger, rsync, compose overwrite, `BOT_ACCEPT_ALL`, smoke `0007`.

## 2026-09-04 14:24Z — publish item 7 P-BUDGET (`fa0ec92`)

Victor ACK “orquestra até entregarmos”. Quinn PASS 91, zero `blocks_publish`.

**Before:** worktree `9cb5834`. `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true`. Health ok.

**Change:** `fa0ec92` → origin. Worktree reset `fa0ec92`. `git archive` só `backend/`. Backup `backend.bak.1788531845`. `docker compose build --no-cache backend` + `up -d`. `nginx -t` ok → reload. Caps no código; sem `TESS_CONTEXT_CAP_*` no `.env` VPS.

**After:** worktree `fa0ec92`. Container: `lib/tess-context-budget.js`, DEFAULT_CAPS MIN 8000 / FAQ 8000 / PRICE 10000 / BOOKING 16000 / CANCEL 10000 / FULL 24000, `applyContextBudget` no assembler. Env = baseline. Health público ok, `trinks_ping=ok`, agent 46589.

**Fora:** Hostinger, rsync, compose overwrite, `BOT_ACCEPT_ALL`, smoke `0007`, André 10:30, CREATE 9800.

## 2026-09-04 ~15:10 UTC — Mira W3 Wave 1 amostra léxico (não crédito)

Janela 01–04/09. 8 last4. Kill switch off 11:33 BRT: silêncio depois ≠ fail Tess. Sem patch, sem cola, sem POST. `0007` skip (teste).

- Amostra: `2987` `4905` `4501` `4749` `0330` `3684` `1000` `2874`.
- Top 3 language fails: `1000` pezinho→pedicure→cabelo/barba (handoff `orcamento_referencia`); `4501` pezinho `UNCERTAIN` MIN `tess.timeout` 11:05 BRT (antes do off); `4749` “Masculino”→Tess confirma Feminino + leak `TA -`.
- Win: `0330` “quem é maquiador” → Fefe/Eli/Kamila (dono). Chão: `2874` progressiva masculina preço no 1º tiro.
- `3684` inbound-only “pé e mão”+Fefe 11:49 BRT = kill switch. `2987` I3 2h/15:00 ocupado → handoff `conflito_agenda`. `4905` tintura ok, gloss drop.
- Sugestão Onda 2: stems `tintura`/`gloss`/`pezinho`/`maquiador`/`masculino` no FILTER; `pezinho`≠pedicure; `DATE_RE` sense_gap `\d{1,2}h`. Relatório: `docs/handoffs/2026-09-04-mira-amostra-lexico.md`.

## 2026-09-04 ~15:54Z — publish Onda 2 Fase A triagem léxico (`405b005`)

Victor ACK commit/publish. Quinn CONCERNS 86, zero `blocks_publish`. Kill switch permanece off.

**Before:** worktree `fa0ec92`. `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true`, `FORCE_FULL` absent, agent 46589. `bot_toggles.global=false` (enabled=f).

**Change:** `405b005` → origin (`feature/tess-commit-honesty`). Worktree reset `405b005`. `git archive` só `backend/`. Backup `backend.bak.1788537207`. `docker compose build --no-cache backend` + `up -d`. `docker compose exec nginx nginx -t` ok → reload.

**After:** worktree `405b005`. Container: `pezinho` em `FILTER_SERVICE_KEYWORDS`, `CATALOG_SYNONYMS`, `genderQualifier` em `server.js`. Env = baseline. Health interno/público ok, `trinks_ping=ok`, agent 46589, `accept_all=true`, `mode=OPEN`. `bot_toggles.global=false` inalterado — bot não responde (esperado).

**Fora:** Hostinger, rsync, compose overwrite, `BOT_ACCEPT_ALL`, `UPDATE bot_toggles`, smoke `0007`, André 10:30, CREATE 9800, paste 46589.

## 2026-09-04 ~16:27Z — piloto exclusivo `0007` (Victor, prompt v3.2.3 colado por ele)

Victor autorizou: ligar só o chip de teste; resto continua off. Prompt 46589 ele mesmo colou (não foi cola desta sessão).

**Before:** `BOT_ACCEPT_ALL=true`, `mode=OPEN`, `bot_toggles.global=false` (kill switch 14:33Z). Whitelist já era 1 allow last4 `0007` + blocks/human_only. `0007` sem `silenced_until`. Código live `405b005`.

**Change:** backup `.env.pre-0007-20260904T162716Z`. `.env` `BOT_ACCEPT_ALL=false` (fallback `BOT_ALLOWED_PHONES` já era só `0007`). `UPDATE bot_toggles` global=`true` (chave técnica). Recreate backend sem rebuild. `nginx -t` ok + reload.

**After:** health `status=ok`, `accept_all=false`, `mode=WHITELIST`, `whitelist_count=1`, TESS 46589, `trinks_ping=ok`. `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`. Só last4 `0007` responde. Número fora da tabela não entra (OPEN fechado de propósito).

**Fora:** Hostinger, rsync, compose overwrite, OPEN customer-wide, André 10:30, CREATE 9800. Smoke WhatsApp fica com o Victor neste chip.

## 2026-09-04 ~16:37Z — piloto `0007` de volta ao off (plano único)

Victor não segue o teste incremental. Roteiro salvo em `docs/ops/smoke-0007-roteiro-lexico-v323.md`. Programa: `docs/analysis/2026-09-04-orion-programa-chao-unico.md`.

**Change:** `bot_toggles.global=false` (16:37:48Z). `.env` intocado: `BOT_ACCEPT_ALL=false`, fallback só `0007`. Sem recreate.

**After:** Tess muda de novo para todo mundo, inclusive `0007`. Whitelist permanece 1 allow. Sem OPEN.

## 2026-09-04 ~17:38Z — publish chão 1–6 pré-smoke `0007` (`a9d5af8`)

Victor ACK 14:35 BRT: orquestrar o que falta para testar no `0007`. Gates 1+2 PASS 96 · 3 PASS · 4 PASS 96 · 5 CONCERNS 90 · 6 CONCERNS — todos `blocks_publish=[]`. Kill switch permanece off durante publish.

**Before:** worktree `405b005`. `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=false`, `FORCE_FULL` absent, agent 46589. `bot_toggles.global=false`.

**Change:** commit `a9d5af8` (51 arquivos allowlist) → origin `feature/tess-commit-honesty`. Worktree reset `a9d5af8`. `git archive` só `backend/`. Backup `backend.bak.20260904173826`. `docker compose build --no-cache backend` + `up -d`. Sem rsync, sem compose overwrite, sem `UPDATE bot_toggles`.

**After:** worktree `a9d5af8`. Container: `resolveTessAbortMs` (`tess-timeout-budget.js`), `intentToPersist` (`tess-context-intent.js`), `subtractOccupiedSlotStarts` (`tess-context-slots.js`), `persistTessTurnEvent` (`tess-context-bytes.js`). Env: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=false`, `TESS_CONTEXT_FORCE_FULL=` (vazio), `TESS_AGENT_ID=46589`, parede `TESS_TIMEOUT_WALL_MS=25000` (código, não env). Health interno ok, `trinks_ping=ok` (658 ms). `bot_toggles.global=false` inalterado.

**Próximo (Orion, não Gage):** sync TESS collection 39496 (4 arquivos KB), unlock `0007`-only (`global=true`, allow único `0007`), Victor corre roteiro `docs/ops/smoke-0007-roteiro-lexico-v323.md`.

**Fora:** Hostinger, rsync, compose overwrite, `BOT_ACCEPT_ALL=true`, smoke WhatsApp, paste 46589, nginx 25s/35s, TESS PATCH.

## 2026-09-04 ~17:46Z — sync 39496 + piloto `0007` de novo

**Change:** PATCH 4 memories (163141, 163142, 163146, 163147) — pezinho + `TA -` não falável. padroes/info/laser intocados. Registro: `docs/intake/registro-chao4-kb-sync-2026-09-04.md`. `UPDATE bot_toggles` global=`true` (17:46:30Z). `.env` intocado: `BOT_ACCEPT_ALL=false`. Sem recreate.

**After:** health `status=ok`, `accept_all=false`, `mode=WHITELIST`, `whitelist_count=1`, TESS 46589, `trinks_ping=ok`. Código live `a9d5af8`. Só last4 `0007` responde.

**Smoke:** Victor correu o roteiro. Relatório: `docs/ops/2026-09-04-smoke-0007-relatorio.md`.

## 2026-09-04 ~18:24Z — smoke `0007` fechado; kill switch off

**Change:** `bot_toggles.global=false` (18:24:11Z). `.env` intocado. Sem recreate.

**After:** Tess muda de novo. Whitelist permanece 1 allow `0007`. Sem OPEN.

**Score:** 1 FAQ PASS · 2 pezinho FAIL regra (handoff certo pro desenho velho; salão = cortesia sem agenda) · 3–7 PASS · 8 FAIL Ausência/snapshot velha, duração OK.

**Fora:** Hostinger, OPEN, André 10:30, CREATE 9800, paste 46589.

## 2026-09-04 ~18:58Z — Victor colou v3.2.4 + sync 39496 chão 8

**Change:** Victor ACK `colei` prompt v3.2.4 no 46589. Orion PATCH 4 memories (163141, 163142, 163146, 163147) — pezinho cortesia v1.3 + FAQ §22 + regras + fichas gratuitos. `kb_items.version`=5 nos 4 slugs. padroes/info intocados. Registro: `docs/intake/registro-chao8-kb-sync-2026-09-04.md`.

**After:** prompt dashboard v3.2.4. Memories alinhadas ao chão 8 local. Código backend 8+9 **ainda não live** (`a9d5af8`). `bot_toggles.global=false` inalterado.

**Próximo:** Gage publish backend 8+9 quando Victor pedir live/smoke. Depois religar `0007`-only + re-smoke.

**Fora:** Hostinger, OPEN, André 10:30, CREATE 9800, religar sem publish.

## 2026-09-04 ~19:03Z — publish chão 8+9 + unlock `0007`

**Change:** Victor `pode publicar 8+9`. Gage commit `4356489` → push → VPS `git archive` backend → `docker compose build --no-cache backend`. Backup `backend.bak.20260904160233`. Live `4356489`. `isSoloPezinhoTurn` + `refreshDates=unique(slotDates)` no container. `UPDATE bot_toggles` global=`true` pós-health. `.env` intocado: `BOT_ACCEPT_ALL=false`.

**After:** health `status=ok`, `accept_all=false`, `mode=WHITELIST`, `whitelist_count=1`, TESS 46589, `trinks_ping=ok`. Prompt v3.2.4 colado. Memories 39496 v5.

**Smoke:** Victor corre `docs/ops/smoke-0007-roteiro-lexico-v323.md`. Depois: `global=false` salvo ACK OPEN.

**Fora:** Hostinger, OPEN, André 10:30, CREATE 9800.

## 2026-09-04 ~19:40Z — publish chão 11 (oferta 60min + pezinho curto)

**Change:** Story 11. Commit `8d06340` → push → VPS `git archive` backend → `docker compose build --no-cache backend`. Backup `backend.bak.20260904163913`. Live `8d06340`. Fixes: `resolveOfferDurationMin` narrows corte catalog (60 vs 120 mixed SKUs); `inferGrainMinutes` ignores sparse gaps >60min.

**After:** health `status=ok`, TESS 46589, uptime fresh. Prompt **v3.2.5** local — **Victor colar** dashboard (Orion não cola). KB inalterada — sem sync 39496.

**Smoke sugerido:** re-rodar `#2` + `#8` no `0007` (Tiago 12/09 sem 12:30; André 11/09 sem 14:00; pezinho ≤2 frases).

**Pendente T4:** Victor cola v3.2.5 → AC6 done.

## 2026-09-04 ~19:52Z — chão 11 fechado (v3.2.5 + D11.1 + FAQ sync)

**Change:** Victor colou v3.2.5. Publish `8c9c90e` (D11.1 Aria-aligned `narrowServicesForOfferDuration`). Backup `backend.bak.20260904165231`. PATCH FAQ §22 memory=163141 only. Registro: `docs/intake/registro-chao11-kb-sync-2026-09-04.md`.

**After:** health ok · backend `8c9c90e` · prompt v3.2.5 · memories FAQ one-liner. Story 11 AC1–AC6 done.

**Smoke sugerido:** re-rodar `#2` + `#8` no `0007` se quiser validar pezinho curto + horários 60min.

## 2026-09-04 ~23:57 BRT — re-smoke pós chão 11

**Change:** Victor rodou roteiro contínuo no `0007` (PILOT mode). Log: `conversation_history` 23:33–23:57 BRT.

**Score:** #1 PASS · #2 PASS pezinho · #3–7 PASS · #4 SKIP (histórico confundiu) · #8 PARCIAL (Erick, não Tiago/André). Zero handoff/guard no intervalo.

**Relatório:** `docs/ops/2026-09-04-smoke-0007-resmoke-relatorio.md`. Handoff restante: `docs/handoffs/2026-09-04-orion-handoff-chao-restante.md`.

## 2026-09-04 ~20:32Z — PILOT_N live (first-5)

**Before:** `BOT_ACCEPT_ALL=false`, `mode=WHITELIST`, `global=true`, 1 allow / 9 block / 10 human_only. Código live anterior `8c9c90e`.

**Change:** Victor opção 2. Commit `af2e58b` → push `feature/pilot-first-n-soft-open` → VPS archive backend + 018 + rebuild. Kill switch off durante publish. `startPilot n=5` run `876b8633-a77b-4eaf-bb21-437b830e7813`. `global=true` depois do health. `.env` intocado: `BOT_ACCEPT_ALL=false`. Backup `backend.bak.20260904T203031Z`.

**After:** health `status=ok`, `mode=PILOT`, `accept_all=false`, `pilot.n=5`, `claimed_count=0`. Toggles: `global=t` `pilot=t`.

**Abort:** `UPDATE bot_toggles SET enabled=false WHERE key='global'` **ou** `stopPilot`. Não OPEN.

**Fora:** Hostinger, `BOT_ACCEPT_ALL=true`, UI.

## 2026-09-04 ~20:47Z — silêncio se a recepção falou no painel Kapso

**Change:** Victor: não é só a tag human-handled. Qualquer outbound que a Tess não enviou (painel Kapso, `cloud_api` sem fingerprint) silencia o fio por 24h. Commit `0e0c01f` + `8251f2a` → push → archive backend. Backup `backend.bak.20260904T204602Z`. Backfill Kapso 24h: 21 fios marcados (excluiu `0007` depois, para o smoke). Kill switch off só no publish; `global=true` + `pilot=true` depois.

**After:** health `status=ok`, `mode=PILOT`, `accept_all=false`, `claimed_count=1` (last4 `4367` SCHEDULING). `.env` intocado.

**Abort:** `UPDATE bot_toggles SET enabled=false WHERE key='global'`.

## 2026-09-05 ~16:10Z — floor reception: reschedule leftover + confirm sem Trinks

**Source:** recepção (Ana Carolina / Ronaldo 15:30 / Rodolfo 16:30). Cruzado com `conversation_history`, `bot_operational_events`, `trinks_api_requests`, `trinks_appointments`.

**Ana Carolina Chenta `8528` (pré-PILOT, 02/09):** pediu mover sáb 05 → sáb 12 (tatuagem + mão). Tess emitiu `reschedules:1` e depois `creates:1` (manicure 12/09). Sem `booking.rescheduled` / sem PUT no telefone dela. Manicure 05/09 11h ficou viva até recepção cancelar hoje 08:55 SP. Tatuagem 12/09 16:30 + manicure 12/09 14:30 confirmadas.

**Ronaldo `5482`:** Tess **gravou** Trinks `526831469` 09:06 SP (`booking.created`, POST 201). Cabelo e Barba André 15:30. Recepção antecipou no WhatsApp — I1 ok; percepção de “não entrou no sistema” não bate o log.

**Rodolfo `9343`:** Tess disse “Confirmo aqui…” + `creates:1`, **bloqueou** `catalog.zero_price_blocked` SKU `14232900` (TA Barba). Sem POST. Cliente “Ok”; Tess mandou endereço. Recepção agendou `526949090` 16:30. I1 quebrado no WhatsApp (afirmou / pediu ok sem commit).

**PILOT agora:** 5/5. Último claim `2185` (alisamento, ~13:08 SP).

**P1:** reschedule-as-create sem cancel do slot antigo; zero_price em SKU que o prompt cotou R$70; “Confirmo aqui” vaza antes do guard.

**Fora:** POST Trinks, OPEN, prompt paste.

## 2026-09-05 ~19:00Z — T11 info-open live (recepção ACK)

**Ritual:** Victor ACK recepção no fio → Gage VPS `deploy@72.60.155.118`. Kill switch `global=false` → backup `backend.bak.20260905T190047Z` → worktree `tess-commit-honesty` reset `c043a75` → archive só `backend/` → `docker compose build --no-cache backend` + up.

**Before allow (last4):** `0007` owner + cohort `4367 4749 5482 9343 2185` (`pilot_claim`). Toggles: `global=false` (publish), `pilot=true` → `stopPilot` congelou run `…830e7813` (`frozen`, 5/5).

**After allow (last4):** único `0007` allow. Cohort removido de allow (DELETE 5 `pilot_claim`). `human_only` / `block` intactos. Toggles: `global=true`, `pilot=false`. `.env` intocado (`BOT_ACCEPT_ALL=false`).

**Health:** `status=ok`, `mode=WHITELIST`, `accept_all=false`, `trinks_ping=ok`, `whitelist_count=1`. SHA live `c043a75`. Nginx não tocado.

**Abort:** `UPDATE bot_toggles SET enabled=false WHERE key='global'`.

## 2026-09-05 ~19:27Z — P2 alternativas + linger live

**Ritual:** Victor ACK plano 1–6. Gage push `683857d` → kill `global=false` → backup `backend.bak.20260905T192718Z` → archive só `backend/` → build `--no-cache` → `global=true`. Sem `startPilot`. Whitelist intocada.

**After:** health `ok` · `WHITELIST` · `accept_all=false` · `pilot=false` · allow só `0007` · `trinks_ping=ok`. SHA live `683857d`.

**Código:** P2.2 ALTERNATIVAS 2–3 · P2.3 linger/Ok · P2.4 `[booking.digest]` · `duration_ms` em `tess.turn`.

**Boca:** cola 46589 ainda com Victor (`docs/prompts/tess-46589-p2-alternativas-handoff-linger.md`).

**Abort:** `UPDATE bot_toggles SET enabled=false WHERE key='global'`.


