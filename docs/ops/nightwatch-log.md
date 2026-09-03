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

