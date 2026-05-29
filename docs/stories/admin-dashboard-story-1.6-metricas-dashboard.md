# Story 1.6: Admin UI — Métricas dashboard (+ Trinks sync worker)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** Done
**Agente executor:** @dev (suporte @data-engineer nas queries/worker; @architect aprova o desvio de placement do worker — ver Dev Notes §Decisão A)
**⚠️ Condições pré-dev (PO, 2026-05-28):** (1) **começar pela Fase 0** — se a API Trinks não listar agendamentos por range, HALT e replanejar (AC4); (2) **@architect confirma Decisão A** (worker na imagem do backend vs admin) no kickoff — não codar o container antes; (3) **story grande (13 SP)** — recomendado checkpoint/commit após o worker (Fase 0 + AC5-12) antes de atacar o dashboard, pra QA incremental.
**Story Points:** 13 (8 do dashboard + 5 do sync worker — Victor optou por incluir o worker, 2026-05-28)
**Pode executar agora:** 🟡 Parcial — KPIs de `conversation_history` podem ser construídos imediatamente. Os KPIs de negócio (agendamentos, no-show, cancelamentos, top profissionais, taxa de sucesso) dependem do **Trinks sync worker**, que por sua vez exige uma **Fase 0 de verificação** do endpoint Trinks que *lista* agendamentos (hoje o backend só consome slots, não registros). Começar pela Fase 0.
**Branch sugerida:** `feature/1.6-metricas-dashboard`
**Source-of-truth técnico:**
- [docs/architecture/admin-dashboard.md §9 (Métricas) + §13 (Trinks sync worker)](../architecture/admin-dashboard.md)
- [docs/design/admin-dashboard/wireframes.md §Tela 5 (Métricas) + §Tela 2 (Overview/home)](../design/admin-dashboard/wireframes.md)
- [infra/migrations/001_admin_dashboard.sql:267](../../infra/migrations/001_admin_dashboard.sql) — `trinks_appointments`, `trinks_sync_state`, e **views já entregues** `v_admin_appointments_daily` (linha 360) + `v_admin_conversations_summary` (linha 343)
- [backend/server.js:324 — `fetchTrinks(path)`](../../backend/server.js) (helper Trinks já existente, com creds)
- [backend/db.js:39 — `module.exports = { query, getPoolStats }`](../../backend/db.js)
- [frontend/admin/lib/conversas.ts](../../frontend/admin/lib/conversas.ts) (padrão de query Postgres via `lib/db.ts`)
- [frontend/admin/lib/hooks/use-polling.ts:26](../../frontend/admin/lib/hooks/use-polling.ts) + [frontend/admin/lib/format/date.ts:24](../../frontend/admin/lib/format/date.ts) + [frontend/admin/lib/format/phone.ts:45](../../frontend/admin/lib/format/phone.ts)

## Contexto

Sexta story do Epic Admin Dashboard (1.7 Saúde+Auditoria já está Ready for Review). As 1.1-1.5 entregaram auth + conversas + toggles + whitelist + KB editor; a 1.7 entrega saúde + auditoria. **Esta story entrega o painel quantitativo** — os números que o **Tiago (dono, persona primária)** abre toda manhã: quantos agendamentos, quanto no-show, como o bot está convertendo. É a tela de maior valor de negócio do epic.

**Descoberta crítica que define o escopo (2026-05-28, @sm):** a arquitetura (§9, §13) e os wireframes (Tela 2 mostra "Sync Trinks: ok há 12m") assumem um **worker cron de 15min** populando `trinks_appointments`. Esse worker **nunca foi construído** — nenhuma story (1.5, 1.7) tocou nisso. A tabela `trinks_appointments` existe (migration 001) mas está **vazia em produção**. Logo, sem o worker, todos os KPIs de negócio não têm fonte de dados. **Victor decidiu incluir o worker nesta story** (em vez de fatiar numa story separada), pra que o dashboard suba útil no dia 1 e cumpra o DoD do epic ("métricas batem com dados reais Trinks da semana").

**Bom de reuso (já existe — não reinventar):**

| Recurso | Estado | Origem |
|---|---|---|
| `trinks_appointments` + `trinks_sync_state` (schema + índices) | ✅ migration 001 (vazias) | @data-engineer |
| View `v_admin_appointments_daily` — agregação diária (created/cancelled/no_shows/completed/no_show_rate_pct, TZ São Paulo, últimos 90d) | ✅ migration 001 | @data-engineer |
| View `v_admin_conversations_summary` — por telefone (msg_count, last_msg_at, had_takeover, is_active_4h) | ✅ migration 001 | @data-engineer |
| `backend/server.js:324 fetchTrinks(path)` — GET Trinks com creds (`X-Api-Key`, `estabelecimentoId`), timeout 10s | ✅ em prod | bot |
| `backend/db.js` — `query(sql, params)` (pool compartilhado) | ✅ em prod | backend |
| `lib/db.ts` — `query<T>()` + `withTx()` (admin) | ✅ entregue | Story 1.2-DATA |
| `lib/hooks/use-polling.ts` — `usePolling(fn, ms, {pauseOnHidden})` | ✅ entregue | Story 1.3 |
| `lib/format/date.ts` `formatRelative` / `format/phone.ts` `digitsOnly` | ✅ entregue | Stories 1.2/1.3 |
| Padrão route handler: Zod + sessão + `query()` direto (ex: `lib/conversas.ts` + `app/api/conversas/route.ts`) | ✅ entregue | Story 1.3 |
| shadcn `card`, `select`, `tabs`, `skeleton`, `table` em `components/ui/` | ✅ presentes | Stories anteriores |

**Esta story entrega:**
1. **Fase 0 — verificação Trinks:** confirmar o endpoint que *lista* agendamentos (não slots) + mapear campos da resposta → colunas de `trinks_appointments`. (Spike curto, como a Fase 0 da 1.5.)
2. **Trinks sync worker** (`backend/trinks-sync-worker.js`) — cron 15min + backfill inicial, reusando `fetchTrinks` + creds + `db.js`; atualiza `trinks_sync_state` (sucesso/erro/failures). Deploy como container isolado `admin-trinks-sync` (imagem do backend, command override).
3. **Camada de dados de métricas** (`frontend/admin/lib/metrics.ts`) — funções de agregação sobre as views + `conversation_history`, com cache LRU 60s.
4. **API:** `GET /api/metricas?period=7d` (KPIs + série diária + top profissionais) e `GET /api/overview` (KPIs compactos da home).
5. **Rota `/metricas`** (Tela 5): period selector (24h/7d/30d/90d) + 6 KPI cards + bar chart "Agendamentos por dia" (Recharts) + tabela "Top profissionais" + botão refresh.
6. **Home `/` (Tela 2):** substituir o placeholder atual por 3 KPI cards + card de status do sistema + lista compacta de conversas ativas.
7. **Empty-state gracioso:** enquanto `trinks_sync_state.last_success_at IS NULL` (worker nunca rodou), KPIs Trinks mostram skeleton "Aguardando primeiro sync Trinks" em vez de "0" enganoso.
8. **Recharts** adicionado ao `package.json` do admin (in-spec arch §17).
9. Item nav `/metricas` `enabled: true`.

**Fora de escopo (V2 / V1.1 / outras stories):**
- **Heatmap dia × hora** — wireframe marca explicitamente "coming soon — V2".
- **Sparklines** nos KPI cards — wireframe diz "(V2) — MVP: número + trend percentual".
- **Export CSV de métricas** — wireframe marca "(V1.1)". (Se sobrar tempo, há helper de CSV streamed reutilizável da Story 1.7.)
- **Alertas** quando `consecutive_failures >= 3` (arch §13.1 marca "V1.1").
- **Sync em tempo real / webhook Trinks** — cron 15min é suficiente (decisão arch #4).
- **Reconciliação de status histórico** (ex: detectar no-show retroativo além do que a API retorna) — MVP confia no status da API Trinks.
- **Métricas de custo TESS/Trinks (créditos)** — fora do epic.

## Valor de negócio

- **Tiago** abre a home toda manhã e vê em ≤3 cards: agendamentos hoje, no-shows da semana, conversas hoje — sem abrir Trinks separado.
- **Taxa de sucesso do bot** dá ao Victor/Tiago o primeiro número objetivo de "o bot está convertendo conversa em agendamento?" — base pra decidir investir mais no agente.
- **Trinks sync worker** destrava permanentemente qualquer métrica de negócio futura (a tabela local some a latência/rate-limit da API Trinks; queries agregadas em <100ms).
- **DoD do epic:** "Métricas batem com `/health` e com dados reais Trinks da semana" — só fica cumprível com esta story.
- **ROI:** com 1.6 mergeada + 1.7 já em review, o epic fecha **7/7 Done** e o painel vira ferramenta operacional completa.

## Objetivo

Entregar, em três frentes que podem ser implementadas em sequência (Fase 0 → worker → dashboard):

1. **Fase 0 (verificação):** descobrir e documentar o endpoint Trinks de listagem de agendamentos por intervalo de datas e o shape da resposta. Gravar o resultado em Dev Agent Record → Completion Notes (vira fonte de verdade do mapping).
2. **Worker `backend/trinks-sync-worker.js`:** processo standalone que (a) no boot faz backfill dos últimos 90 dias em janelas, (b) a cada 15min via cron faz pull incremental desde `last_sync_at`, (c) faz UPSERT em `trinks_appointments` normalizando status e telefone, (d) atualiza `trinks_sync_state`. Reusa `fetchTrinks` + creds + `db.js` do backend. Container isolado.
3. **Dashboard:** `lib/metrics.ts` (agregações + cache 60s) → `/api/metricas` + `/api/overview` → páginas `/metricas` (Tela 5) e `/` (Tela 2) com Recharts e empty-states.

## Acceptance Criteria

### Fase 0 — Verificação Trinks (bloqueante do worker)

- [ ] **AC1:** Identificar o endpoint Trinks que retorna **registros de agendamentos** (não horários vagos) filtrável por intervalo de datas — candidato a verificar: `GET /agendamentos?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` (Trinks API v1). Confirmar via chamada real com as creds de prod (`fetchTrinks` no backend ou `curl` documentado). **NÃO inventar o shape** — colar a resposta real (1 registro anonimizado) em Completion Notes.
- [ ] **AC2:** Mapear cada campo da resposta Trinks → coluna de `trinks_appointments` (`trinks_id`, `client_phone`, `client_name`, `professional_id/name`, `service_id/name`, `status`, `scheduled_at`, `duration_min`, `price_cents`, `created_at_trinks`, `cancelled_at`). Documentar o de-para. Campos não mapeáveis ficam só em `raw` (JSONB).
- [ ] **AC3:** Mapear os valores de `status` da Trinks → enum normalizado da tabela (`scheduled | confirmed | cancelled | no_show | completed | unknown`). Qualquer status não previsto → `unknown` (e logar warning). Documentar a tabela de-para de status.
- [ ] **AC4:** Se o endpoint de listagem **não existir / não suportar range de datas**, HALT e escalar pro Victor com o que a API oferece (a decisão de worker-in pressupõe que dá pra listar; se não der, é replanejamento de escopo, não improviso).

### Trinks sync worker

- [ ] **AC5:** `backend/trinks-sync-worker.js` é um entrypoint standalone (`node trinks-sync-worker.js`) que **reusa** `fetchTrinks` (extraído pra módulo compartilhável se necessário — ver Dev Notes §Decisão A) + `backend/db.js` `query()`. Não duplica creds Trinks nem conexão pg.
- [ ] **AC6:** **Backfill no boot:** se `trinks_sync_state.last_success_at IS NULL`, puxa os últimos **90 dias** em janelas (ex: 7 em 7 dias com pequeno sleep entre páginas pra respeitar rate limit — arch §18) e faz UPSERT. Loga progresso.
- [ ] **AC7:** **Sync incremental:** cron `*/15 * * * *` puxa agendamentos com `updated`/`created` desde `last_sync_at` (ou re-puxa janela móvel de N dias se a API não tiver filtro incremental — decidir na Fase 0) e faz UPSERT.
- [ ] **AC8:** UPSERT usa `INSERT ... ON CONFLICT (trinks_id) DO UPDATE` — idempotente, não duplica. `client_phone` é **normalizado com `digitsOnly`** antes de gravar (E.164 sem `+`, igual a `conversation_history.client_phone`) — pré-requisito da taxa de sucesso (ver AC18).
- [ ] **AC9:** Sucesso → `UPDATE trinks_sync_state SET last_sync_at=NOW(), last_success_at=NOW(), consecutive_failures=0, last_error=NULL, records_synced_total = records_synced_total + N`.
- [ ] **AC10:** Falha (exception no fetch/UPSERT) → `UPDATE trinks_sync_state SET consecutive_failures = consecutive_failures + 1, last_error = $msg` (NÃO atualiza `last_success_at`). Worker não crasha o processo — captura e tenta de novo no próximo tick.
- [ ] **AC11:** Container `admin-trinks-sync` adicionado ao `infra/docker-compose.yml` (imagem do backend, `command` override `node trinks-sync-worker.js`, env Trinks + `DATABASE_URL`, `restart: unless-stopped`, `depends_on: postgres healthy`). Documentado em `docs/ops/admin-dashboard-deploy.md`.
- [ ] **AC12:** Worker loga estruturado (início/fim de cada ciclo, contagem, erros) no mesmo padrão do backend.

### Camada de dados (`lib/metrics.ts`) + API

- [ ] **AC13:** `lib/metrics.ts` exporta `getMetrics(period)` e `getOverview()`, ambas usando `lib/db.ts` `query()` (mesmo padrão de `lib/conversas.ts`). `period` ∈ `{'24h','7d','30d','90d'}` validado por Zod; default `7d`.
- [ ] **AC14:** `getMetrics(period)` retorna, **derivado das views/tabelas existentes** (não inventar colunas), respeitando a **base temporal por métrica definida na AC14-BASE**:
  - **Agendamentos criados no período**: `COUNT(*) FROM trinks_appointments WHERE created_at_trinks` na janela (base = data do **booking**, conforme arch §9.1). ⚠️ **NÃO** somar a coluna `created` de `v_admin_appointments_daily` — ela é keyed em `scheduled_at` (data do atendimento), não do booking (ver AC14-BASE + Dev Notes §Risco P0 base temporal)
  - **No-shows** + `no_show_rate_pct` (base `scheduled_at` — a view `v_admin_appointments_daily` serve aqui; `no_show_rate_pct` já calculado com `NULLIF`)
  - **Cancelamentos** (base `cancelled_at` na janela)
  - **Conversas atendidas** (`COUNT(DISTINCT client_phone)` em `conversation_history` na janela por `created_at`) e **Mensagens/dia (média)** = `COUNT(*) na janela / nº de dias do período` (denominador = dias corridos do período: 1 pra 24h, 7 pra 7d, etc.)
  - **Takeovers humanos** = `COUNT(DISTINCT client_phone)` em `conversation_history` `WHERE agent='human' AND created_at` na janela. ⚠️ **NÃO usar `had_takeover` de `v_admin_conversations_summary`** — essa view agrega por telefone **sem janela temporal** (`had_takeover`/`msg_count` são lifetime, [migration 001:343-354](../../infra/migrations/001_admin_dashboard.sql)). A view de conversas só serve pra lista "Conversas ativas" da home (`is_active_4h`) e pra `/conversas` — **não** pra métricas de período
  - **Taxa de sucesso do bot** (ver AC18)
  - **Série diária** `[{day, created, cancelled, no_shows}]` pro bar chart
  - **Top profissionais** `[{professional_name, count}]` (top 10, por `COUNT` em `trinks_appointments` no período) — usa índice `idx_trinks_professional_scheduled`
  - **Trend** vs período anterior (Δ% ou Δ absoluto) pra cada KPI principal
- [ ] **AC15:** `getOverview()` retorna KPIs compactos da home: `conversas_hoje`, `agendamentos_hoje`, `no_shows_semana` (+ trend vs ontem/semana anterior) e um bloco `sync_status` (`last_success_at`, `consecutive_failures`) pra a home mostrar "Sync Trinks: ok há Xm".
- [ ] **AC16:** Cache LRU/Map 60s por chave (`metrics:{period}`, `overview`) — arch §9.2. Refresh manual (botão) força bypass do cache (query string `?fresh=1` ou header).
- [ ] **AC17:** `GET /api/metricas` e `GET /api/overview` — sessão obrigatória (proxy/middleware), Zod no input, 200 com payload, 500 gracioso com mensagem. Header `Cache-Control: private, max-age=60`.
- [ ] **AC14-BASE (P0 — adjudicar com @data-engineer/@po):** A base temporal de cada métrica é **explícita e correta**, porque `created_at_trinks` (data do booking) ≠ `scheduled_at` (data do atendimento) e a view `v_admin_appointments_daily` agrupa por `scheduled_at`:
  - `/metricas` → **Agendamentos criados** + **chart "Agendamentos por dia"** + **taxa de sucesso**: base `created_at_trinks` (velocidade de booking) → query direta em `trinks_appointments` (a view NÃO serve aqui)
  - `/metricas` → **No-shows** / **Cancelamentos**: base `scheduled_at` / `cancelled_at` respectivamente → a view `v_admin_appointments_daily` serve
  - **Home "AGENDAMENTOS HOJE"** (AC28): base `scheduled_at::date = hoje` (= "o que está na agenda hoje", leitura do Tiago) — base legitimamente diferente do KPI de período de `/metricas`
  - **Backfill 90d** (AC6): puxar por janela de `scheduled_at` (a tabela precisa cobrir ambas as bases) — confirmar na Fase 0 qual filtro a API Trinks oferece
  - Toda query de janela tem **teto superior** quando a base é `scheduled_at` (senão agendamentos futuros vazam na contagem — a view atual filtra só `> NOW()-90d`, sem `< NOW()` para métricas retrospectivas)
- [ ] **AC18:** **Taxa de sucesso do bot** definida explicitamente (MVP, heurística): `% de telefones distintos que tiveram conversa no período E têm ≥1 agendamento com created_at_trinks no mesmo período`, join por `client_phone` **normalizado** (`digitsOnly` dos dois lados — ver AC8). Documentar no código que é atribuição heurística (não prova causalidade). Se `trinks_appointments` vazia → retorna `null` (não 0%).

### Empty-state / graceful (worker ainda não rodou)

- [ ] **AC19:** Se `trinks_sync_state.last_success_at IS NULL` OU `trinks_appointments` vazia: os KPIs dependentes de Trinks (agendamentos, no-show, cancelamentos, top profissionais, taxa de sucesso) retornam `null` na API (não `0`), e a UI renderiza skeleton + texto "Aguardando primeiro sync Trinks" (wireframe Tela 5). KPIs de `conversation_history` (conversas, mensagens, takeovers) continuam renderizando dados reais normalmente.
- [ ] **AC20:** Se `consecutive_failures >= 3`: banner discreto no topo de `/metricas` "⚠️ Sync Trinks com falhas (última: {last_error}, há Xmin)". Não bloqueia a tela.

### Rota `/metricas` (Tela 5)

- [ ] **AC21:** `/metricas` sem sessão → redireciona `/login?returnTo=/metricas`.
- [ ] **AC22:** Header "Métricas" + period selector shadcn `Select` (24h · 7d · 30d · 90d, default 7d) + botão `[↻]` refresh. Mudar período atualiza via `?period=` (URL é fonte da verdade, igual ao padrão `?tab=` da 1.7).
- [ ] **AC23:** 6 KPI cards na ordem do wireframe: **Agendamentos**, **Taxa de sucesso bot**, **Takeovers humanos**, **No-shows**, **Cancelamentos**, **Msgs/dia (média)**. Cada card: label + número grande + trend (Δ% ou Δ, com seta ↑/↓ e cor). Componente `<KpiCard>` reutilizável.
- [ ] **AC24:** Bar chart "Agendamentos por dia" com **Recharts** (`<BarChart>` simples, responsivo via `<ResponsiveContainer>`), série diária do período. Eixo X = dia, Y = contagem. Empty-state se sem dados Trinks.
- [ ] **AC25:** Tabela "Top profissionais (período)" — nome + nº de agendamentos, top 10 DESC. Usa shadcn `table`. Empty-state se sem dados.
- [ ] **AC26:** Polling 30s (wireframe: "polling 30s nos KPIs cached") via `usePolling`, pausa quando aba inativa. Loading inicial → skeletons.
- [ ] **AC27:** Item nav `/metricas` passa a `enabled: true` (atualmente em breve).

### Home `/` overview (Tela 2)

- [ ] **AC28:** Substituir o placeholder atual de `app/(dashboard)/page.tsx` por: saudação "Olá, {nome} 👋" + data/hora + 3 KPI cards (Conversas hoje, Agendamentos hoje, No-shows semana) consumindo `/api/overview`.
- [ ] **AC29:** Card "status do sistema" compacto: bot ativo/inativo (de `bot_toggles.global` — reusar `lib/toggles.ts`) + "Sync Trinks: ok há Xm" (de `overview.sync_status`). (Não duplicar a tela /saude — é um resumo de 1 linha.)
- [ ] **AC30:** Lista compacta "Conversas ativas" (top ~5 de `v_admin_conversations_summary` com `is_active_4h`) — reusar `lib/conversas.ts`; cada linha clicável → drill-down `/conversas` (link). Empty-state se nenhuma ativa.
- [ ] **AC31:** Os KPIs Trinks da home seguem o mesmo empty-state da AC19 (skeleton "Aguardando sync" em vez de 0).

### Não-funcional / qualidade

- [ ] **AC32:** Recharts adicionado a `frontend/admin/package.json`; build standalone Next continua passando; bundle do chart só carrega na rota `/metricas` (dynamic import se necessário pra não inflar a home).
- [ ] **AC33:** Queries agregadas <100ms em dataset realista (arch §17 target dashboard <800ms) — validar com `EXPLAIN ANALYZE` na QA; índices da migration 001 (`idx_trinks_status_scheduled`, `idx_trinks_professional_scheduled`) já cobrem os filtros.
- [ ] **AC34:** Lint 0 errors, typecheck strict 0 errors, todos os testes passando.
- [ ] **AC35:** Testes: (a) `lib/metrics.ts` — agregação e trend com fixtures (incluindo dataset vazio → `null`, não 0); (b) worker — mapping de status + normalização de telefone + idempotência do UPSERT; (c) `/api/metricas` — Zod rejeita period inválido, 200 com payload. Padrão Vitest no admin (`tests/*.test.ts`), `node:test` no backend (`backend/test/*.test.js`).

## 🤖 CodeRabbit Integration

### Story Type Analysis
- **Primary Type:** Integration (Trinks sync worker) + Frontend (dashboard/charts)
- **Secondary Type(s):** API (route handlers), Database (queries de agregação sobre views existentes)
- **Complexity:** High — atravessa backend (worker + Trinks API), Postgres (agregações), e admin (2 telas + Recharts); inclui um processo novo e uma integração externa real.

### Specialized Agent Assignment
**Primary Agents:**
- @dev (implementação + pre-commit reviews)
- @data-engineer (revisão das queries de agregação + plano de índices/EXPLAIN)

**Supporting Agents:**
- @architect (aprovar o desvio de placement do worker — backend vs admin image; ver Dev Notes §Decisão A)
- @devops (container `admin-trinks-sync` no compose + deploy)

### Quality Gate Tasks
- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted` antes de marcar Ready for Review
- [ ] Pre-PR (@devops): `coderabbit --prompt-only --base main` antes de criar PR
- [ ] Pre-Deployment (@devops): rebuild de `backend` (worker) + `admin-frontend` + novo serviço `admin-trinks-sync`

### Self-Healing Configuration
**Expected Self-Healing:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior:**
- CRITICAL issues: auto_fix (até 2 iterações)
- HIGH issues: document_only (Dev Notes)

### CodeRabbit Focus Areas
**Primary Focus:**
- Integração externa: timeout/retry/error handling no worker; falha do Trinks isolada (não crasha worker nem deixa `last_success_at` mentir)
- SQL: agregações corretas, sem N+1, `NULLIF` em divisões (evitar divide-by-zero na taxa), índices usados (EXPLAIN)
- Normalização de telefone consistente nos dois lados do join (AC8/AC18)

**Secondary Focus:**
- Frontend: empty-state vs `0` enganoso (AC19); Recharts não infla bundle da home; a11y dos cards/tabela
- Idempotência do UPSERT; cache 60s com bypass de refresh

## Tasks / Subtasks

- [x] **Fase 0 — Verificação Trinks (AC1-AC4)** ✅
  - [x] Endpoint confirmado: `GET /agendamentos?dataInicio&dataFim&page=N` (paginado por `scheduled_at`); shape + de-para campos/status em Completion Notes
  - [x] De-para status (id 4/6/8/9) + gaps (sem created date, phone só em /clientes) documentados
  - [x] Listagem com range EXISTE → não houve HALT (gaps viraram decisões D-A/D-B com Victor)
- [x] **Worker Trinks (AC5-AC12)** ✅ (Decisão A: imagem do backend; Decisão B: phone via /clientes cacheado)
  - [x] `backend/lib/trinks-client.js` standalone (reusa env/headers do `fetchTrinks` sem tocar no hot-path do bot) + `backend/lib/trinks-mapping.js` (puro)
  - [x] `backend/trinks-sync-worker.js`: backfill 90d no boot + janela móvel a cada 15min (`setInterval`, sem cron lib); paginação `page`; timezone BR (`-03:00`) no `scheduled_at`
  - [x] UPSERT idempotente (`ON CONFLICT (trinks_id)`, `COALESCE` preserva phone) com status normalizado; phone normalizado (`normalizePhoneBR`, prefixa 55)
  - [x] Atualiza `trinks_sync_state` (sucesso/erro/failures/total)
  - [x] Serviço `admin-trinks-sync` no `infra/docker-compose.yml` + runbook em `docs/ops/admin-dashboard-deploy.md`
  - [x] Testes: status mapping, normalização, timezone, syncWindow, idempotência UPSERT (13 testes, `backend/test/trinks-sync.test.js`) — validados; dry-run real fetch→map OK (112 recs)
- [x] **Camada de dados + API (AC13-AC20)** ✅
  - [x] `lib/metrics.ts`: `getMetrics(period)` + `getOverview()` sobre `v_admin_appointments_daily` + `conversation_history` + cache LRU 60s (bypass `?fresh=1`)
  - [x] Taxa de sucesso heurística (join por telefone normalizado `regexp_replace('\D')` dos 2 lados; null se sem dados)
  - [x] `app/api/metricas/route.ts` + `app/api/overview/route.ts` (Zod, sessão via proxy, Cache-Control 60s, 500 gracioso)
  - [x] Empty-state (`null` quando `last_success_at IS NULL` ou tabela vazia) + flag `consecutive_failures>=3`
  - [x] Testes: `assembleMetrics` (dataset vazio→null, trend, no_show_rate) + `trend` (5 testes, `tests/metrics.test.ts`)
- [x] **Rota /metricas (AC21-AC27, AC32)** ✅
  - [x] Recharts adicionado (^3.8.1); chart só carrega na rota `/metricas` (home não importa)
  - [x] `<KpiCard>` reutilizável + 6 cards na ordem do wireframe
  - [x] Bar chart Recharts (`<AgendamentosChart>`) + tabela top profissionais + empty-states "Aguardando sync"
  - [x] Period selector via `?period=` (router.replace) + polling 30s pausável + skeletons + banner de falha
  - [x] nav `/metricas` enabled
- [x] **Home overview (AC28-AC31)** ✅
  - [x] `app/(dashboard)/page.tsx` substituído + `<OverviewPanel>` client
  - [x] 3 KPI cards + card status (bot ativo via `bot_toggles.global` + sync Trinks) + conversas ativas (reusa `/api/conversas?status=active`)
- [ ] **Fechamento (AC33-AC35)**
  - [x] lint 0 / typecheck 0 / build OK (28 rotas) / admin 73 pass + backend 35 pass
  - [ ] CodeRabbit pre-commit self-healing (rodando)
  - [ ] EXPLAIN ANALYZE das queries — **deferido pra QA** (precisa DB com dados reais; índices da migration 001 cobrem os filtros)

## Dev Notes

> Regra anti-alucinação: tudo abaixo veio de arquivos reais do repo (citados). Onde a Trinks API é incógnita, está marcado como **Fase 0 resolve** — NÃO inventar shape.

### Decisão A — Onde mora o worker (precisa aval @architect)

A arquitetura §13.2 propôs o worker na **imagem do admin-frontend** (`node lib/trinks-sync-worker.js`). **Recomendação desta story: mover pra imagem do backend.** Racional (IDS — REUSE > CREATE):
- O backend **já tem** 100% da plumbing Trinks: `fetchTrinks` ([backend/server.js:324](../../backend/server.js)) + creds (`TRINKS_API_KEY`, `TRINKS_ESTABELECIMENTO_ID`, `TRINKS_API_BASE`) + `backend/db.js` `query()`.
- O admin (Next/TS) **não tem nada disso** — colocar o worker lá exigiria reimplementar fetch + creds + pg, duplicando.
- Isolamento de crash (a preocupação real da §13.2) é preservado: roda como **container separado** `admin-trinks-sync` usando a imagem do backend com `command` override — processo apartado do bot e da UI.

Se @architect/@po preferirem manter na imagem do admin, é um replanejamento (a story assume backend). Não decidir sozinho em prod.

### Schema real (migration 001 — já aplicado em prod)
`trinks_appointments` ([infra/migrations/001_admin_dashboard.sql:267](../../infra/migrations/001_admin_dashboard.sql)): PK `trinks_id VARCHAR(64)`, `client_phone VARCHAR(20)`, `professional_id/name`, `service_id/name`, `status` CHECK (`scheduled|confirmed|cancelled|no_show|completed|unknown`), `scheduled_at`, `created_at_trinks`, `cancelled_at`, `no_show_at`, `raw JSONB`, `synced_at`. Índices: `idx_trinks_scheduled`, `idx_trinks_status_scheduled`, `idx_trinks_professional_scheduled`, `idx_trinks_phone_scheduled`, BRIN em `created_at_trinks`.

`trinks_sync_state` (linha 315): singleton `id=1`, `last_sync_at` (default `1970-01-01`), `last_success_at`, `last_error`, `consecutive_failures`, `records_synced_total`, `updated_at` (trigger). **Já tem a row id=1 seedada.**

**Views já entregues — USAR, não recriar:**
- `v_admin_appointments_daily` (linha 360): `day, created, cancelled, no_shows, completed, no_show_rate_pct` por dia (TZ `America/Sao_Paulo`), últimos 90d. `created` = status IN (scheduled,confirmed,completed). `no_show_rate_pct` já com `NULLIF` (sem divide-by-zero).
- `v_admin_conversations_summary` (linha 343): por `client_phone` — `msg_count`, `last_msg_at`, `first_msg_at`, `last_agent`, `is_active_4h`, `had_takeover` (`BOOL_OR(agent='human')`).

### conversation_history (legado, já populado)
Colunas usadas pelas views: `client_phone`, `role` (`user`/`assistant`), `agent` (string; `'human'` indica takeover), `created_at`. Telefone em E.164 **sem `+`** (ex: `5511964540007` — ver comment em `bot_whitelist`, [migration 001:207](../../infra/migrations/001_admin_dashboard.sql)). Para séries diárias de mensagens/conversas, agregar `conversation_history` direto por `DATE(created_at AT TIME ZONE 'America/Sao_Paulo')`.

### Trinks API (Fase 0 resolve o que falta)
Conhecido do backend: `fetchTrinks(path)` faz GET com `X-Api-Key` + `estabelecimentoId`, timeout 10s, retorna `res.json()`. Endpoints já usados: `/servicos`, `/profissionais`, `/agendamentos/profissionais/{date}` (este retorna **slots/horariosVagos**, NÃO registros de agendamento). **O endpoint de listagem de agendamentos por intervalo NÃO está no código** — Fase 0 confirma (candidato `GET /agendamentos?dataInicio=&dataFim=`). Doc de apoio: [docs/architecture/booking-confirmation-flow.md](../architecture/booking-confirmation-flow.md) (fluxo de criação de agendamento já existe).

### Risco P0 — normalização de telefone para "taxa de sucesso"
`conversation_history.client_phone` é E.164 sem `+`. `trinks_appointments.client_phone` virá do payload Trinks em **formato desconhecido** (pode ter máscara/DDI/parênteses). O join da taxa de sucesso (AC18) só funciona se ambos forem normalizados. **Mitigação:** o worker grava `digitsOnly(phone)` ([lib/format/phone.ts:45](../../frontend/admin/lib/format/phone.ts) — replicar a lógica no backend, é trivial: `(s||'').replace(/\D/g,'')`) e a query da taxa compara `regexp_replace(client_phone,'\D','','g')` dos dois lados. Validar na Fase 0 com um telefone real qual o formato Trinks.

### Risco P0 — base temporal (`created_at_trinks` vs `scheduled_at`)
Conflito real entre as fontes: arch §9.1 define "Agendamentos criados (7d/30d)" por `created_at_trinks > NOW()-7d` (data do **booking**), mas a view `v_admin_appointments_daily` ([migration 001:360](../../infra/migrations/001_admin_dashboard.sql)) agrupa por `DATE(scheduled_at)` e sua coluna `created` = `COUNT(*) FILTER (status IN scheduled/confirmed/completed)` — base = data do **atendimento**. **O nome `created` da view é uma armadilha** — não é booking. Consequência: somar `created` da view ≠ "agendamentos feitos no período". AC14-BASE fixa qual base cada tela usa. Implicação prática: o KPI "Agendamentos criados" e o chart de `/metricas` precisam de **query direta em `trinks_appointments` por `created_at_trinks`** (ou @data-engineer cria/ajusta uma view por booking-date); a view existente só serve para os recortes por `scheduled_at` (no-show/cancelamento) e pra home. A view também não tem teto superior (`< NOW()`), então agendamentos futuros entram — aplicar teto nas queries retrospectivas. **@po/@data-engineer adjudicam na validação.**

### Padrão de route handler / query (copiar de existente)
`lib/conversas.ts` consulta `v_admin_conversations_summary` via `lib/db.ts` `query<T>(sql, params)` ([lib/db.ts:26](../../frontend/admin/lib/db.ts)); `app/api/conversas/route.ts` faz sessão + Zod + chama a lib. **Reproduzir esse mesmo padrão** pra `lib/metrics.ts` + `/api/metricas`. Métricas leem Postgres **direto** (não passam pelo backend Express — diferente da `/api/saude` da 1.7 que é proxy).

### Hooks/format reutilizáveis
- `usePolling(fn, intervalMs, { pauseOnHidden })` — [lib/hooks/use-polling.ts:26](../../frontend/admin/lib/hooks/use-polling.ts). Usar nas duas telas (30s métricas, 5-30s home).
- `formatRelative(date)` — [lib/format/date.ts:24](../../frontend/admin/lib/format/date.ts) pra "há Xm".

### Recharts
Em arquitetura (§1 Charts = Recharts; §17). Adicionar dep ao admin. Como a home (Tela 2) NÃO tem chart (só cards), e só `/metricas` usa `<BarChart>`, considerar `next/dynamic` import do chart pra não pesar a home (AC32).

### O que NÃO fazer
- Não recriar as views de agregação (já existem).
- Não construir alertas/webhooks (V1.1).
- Não retornar `0` quando não há dado Trinks — retornar `null` e deixar a UI mostrar "Aguardando sync" (AC19). `0` mente pro Tiago ("zero agendamento hoje?!").
- Não duplicar a tela /saude na home — só um resumo de 1 linha.

### Testing
- **Admin:** Vitest, arquivos em `frontend/admin/tests/*.test.ts` (ver `saude-helpers.test.ts`, `format-phone.test.ts` como referência). Cobrir `lib/metrics.ts` (agregação + trend + dataset vazio→null) e validação Zod do route.
- **Backend/worker:** `node:test` em `backend/test/*.test.js` (ver `bot-state.test.js`). Cobrir mapping de status, normalização de telefone, idempotência do UPSERT (mockar `fetchTrinks` e `db.query`).
- **EXPLAIN ANALYZE** das queries de agregação na QA (AC33).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-28 | 0.1 | Story 1.6 draftada. Descoberta crítica: Trinks sync worker nunca foi construído → `trinks_appointments` vazia. Victor decidiu incluir o worker nesta story (13 SP). Escopo: Fase 0 (verificação endpoint Trinks) + worker (backend image, container isolado) + `lib/metrics.ts` + `/api/metricas` + `/api/overview` + telas `/metricas` (Tela 5) e home `/` (Tela 2) com Recharts. Reuso forte das views `v_admin_appointments_daily`/`v_admin_conversations_summary` (migration 001), `fetchTrinks`, `db.js`, `usePolling`, `format/*`. Heatmap/sparklines/export CSV/alertas → OUT (V2/V1.1). Riscos P0: endpoint Trinks de listagem (Fase 0) + normalização de telefone pro join da taxa de sucesso. | @sm River |
| 2026-05-28 | 0.2 | Adicionada **AC14-BASE** (P0) após review: conflito de base temporal entre arch §9.1 (`created_at_trinks`/booking) e a view `v_admin_appointments_daily` (`scheduled_at`/atendimento; coluna `created` é armadilha). Fixada a base por tela (booking em `/metricas` KPI+chart; `scheduled_at` em home/no-show/cancelamento) + teto superior em queries retrospectivas. Dev Notes §Risco P0 base temporal. | @sm River |
| 2026-05-29 | 2.0 | **@devops: DEPLOYED → Done.** PR #25 mergeado em main + deploy VPS. Backfill sincronizou **4221 agendamentos** (90d). 3 hotfixes de prod no caminho: 429 backoff (#26), upsert resiliente por página + janelas menores (#27), `client_phone` VARCHAR(20) overflow → UPSERT falhava silencioso (#28). nginx 502 pós-recreate resolvido com restart. Smoke prod das 3 telas validado por Victor (✅ tudo visível). | @devops Gage |
| 2026-05-28 | 1.3 | **@dev: validação de integração contra schema real** (postgres-test). `getMetrics`/`getOverview` + worker `upsertChunk` executam corretamente (4 novos testes em `tests/api/metrics.test.ts`); suíte completa 99/99 pass. **Corrigido stub `admin-trinks-sync` duplicado no compose** (quebraria o deploy inteiro). Flags QA reduzidas a EXPLAIN + smoke prod (precisam de volume real). | @dev Dex |
| 2026-05-28 | 1.2 | **@dev: Fases 2-3 (dashboard) implementadas → Ready for Review.** `lib/metrics.ts` + `/api/metricas` + `/api/overview` + `/metricas` (Recharts) + home overview + nav. Decisões D-A (worker backend) e D-B (phone /clientes cacheado) aplicadas. Validações: typecheck 0, lint 0, build 28 rotas, admin 78 testes pass (73+5) + backend 35 pass. Self-review pegou bug latente (params SQL sem cast `::int`). CodeRabbit self-healing: iter1 1 CRITICAL (optional chaining) auto-fix + 2 minors reais; iter2 0 CRITICAL. 2 minors documentados (trend-overlap tech-debt + skips justificados). Pendente QA/Victor: EXPLAIN + SQL contra DB real + smoke (sem acesso a DB local). Próximo: `@devops *push`. | @dev Dex |
| 2026-05-28 | 1.1 | **@dev: Fase 0 executada (probes read-only Trinks, sem mutação) → InProgress.** Endpoint `/agendamentos?dataInicio&dataFim` confirmado (paginado, filtro por `scheduled_at`). Status no-show existe (id 6). 2 gaps achados: `created_at_trinks` não existe na API (→ tudo keyed em `scheduled_at`, NULL na coluna); telefone só via `/clientes/:id` N+1 (só afeta taxa de sucesso). De-para campos+status gravado em Completion Notes. **Bloqueado em 2 decisões com Victor:** (D-A) placement worker; (D-B) approach taxa de sucesso. | @dev Dex |
| 2026-05-28 | 1.0 | **Validada GO 9/10 → Ready.** Anti-alucinação limpo (refs conferidas no código: `db.js`, `fetchTrinks`, views, `digitsOnly`, `usePolling`; Recharts e cron confirmados ausentes). 2 Should-Fix aplicados: (1) **AC14 corrigido** — métricas de período (takeovers/conversas/mensagens) devem consultar `conversation_history` direto com janela; **proibido** usar `had_takeover` de `v_admin_conversations_summary` (view é lifetime per-phone, sem janela temporal); (2) denominador de "Msgs/dia" explicitado (dias do período). Condições pré-dev registradas no header (Fase 0 first + @architect confirma Decisão A + checkpoint após worker). 0 critical. CodeRabbit completo. Pronta para `@dev *develop 1.6`. | @po Pax |

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (@dev Dex)

### Debug Log References
- Fase 0 executada via probes read-only ao Trinks com creds de `backend/.env` (2026-05-28). Nenhuma mutação.

### Completion Notes List

**FASE 0 — Verificação Trinks (AC1-AC4) — CONCLUÍDA ✅ (com achados que ajustam o escopo)**

**Endpoint de listagem (AC1):** `GET {TRINKS_API_BASE}/agendamentos?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` → HTTP 200. Headers: `X-Api-Key` + `estabelecimentoId` (mesmos do `fetchTrinks`). **Filtro de range é por `dataHoraInicio` (data do ATENDIMENTO), não por data de criação do booking.**

**Resposta paginada:** `{ data: [...], page, pageSize, totalPages, totalRecords }`. pageSize=50; ex.: 7 dias = 388 registros / 8 páginas. ⚠️ Backfill 90d precisa paginar. **Mecânica do param de paginação a confirmar no build** — `&page=2` na sondagem retornou shape inesperado (campos `page`/`data` undefined); pode ser `pagina`, offset, ou outro. Resolver no início do worker.

**Shape do registro (AC2) — de-para campos:**
| Trinks (listagem) | → coluna `trinks_appointments` |
|---|---|
| `id` (number) | `trinks_id` (cast string) |
| `status.id` / `status.nome` | `status` (normalizado — ver abaixo) |
| `cliente.id` / `cliente.nome` | `client_trinks_id` / `client_name` |
| `servico.id` / `servico.nome` | `service_id` / `service_name` |
| `profissional.id` / `profissional.nome` | `professional_id` / `professional_name` |
| `dataHoraInicio` (ISO local) | `scheduled_at` |
| `duracaoEmMinutos` | `duration_min` |
| `valor` (ex: 105 = R$105, reais) | `price_cents` = `Math.round(valor*100)` |
| (registro inteiro) | `raw` (JSONB) |

**De-para status (AC3) — vocabulário real observado em ~90d:**
| Trinks `status.id:nome` | → enum tabela |
|---|---|
| `4 : Confirmado` | `confirmed` |
| `6 : Cliente não compareceu` | `no_show` ✅ (no-show EXISTE) |
| `8 : Finalizado` | `completed` |
| `9 : Cancelado` | `cancelled` |
| (qualquer outro, ex. "Agendado" se aparecer) | `unknown` + log warning |
> Mapear por `status.id` (estável), não por `nome`. `scheduled` provavelmente é um id ainda não observado (agendamento não confirmado) — tratar como `unknown` até aparecer.

**GAP 1 — sem data de criação do booking:** detalhe `/agendamentos/:id` adiciona `cancelamento` e `dataHoraUltimaAlteracao` (última edição), mas **não há campo de criação**. → `created_at_trinks` fica **NULL**. **Consequência:** todos os KPIs de agendamento keyed em `scheduled_at` (alinha com `v_admin_appointments_daily`). AC14-BASE simplificada: não há base de booking-date. `cancelled_at`/`no_show_at` também ficam NULL (a view bucketiza por `scheduled_at`, não precisa deles).

**GAP 2 — telefone não está no agendamento:** `cliente` na listagem só tem `{id, nome}`. Telefone só em `GET /clientes/:id` → `telefone` (11 dígitos, DDD+número, **SEM o `55`**; `conversation_history.client_phone` tem 13 dígitos COM `55`). Normalização da taxa de sucesso (AC18) precisa reconciliar isso (prefixar `55`). Resolver phone exige N+1 (`/clientes/:id` por cliente distinto, cacheável) ou sync separado de clientes — **só impacta a taxa de sucesso**, nenhum outro KPI.

**Decisões resolvidas (Victor, 2026-05-28):** D-A → worker na **imagem do backend** (container isolado). D-B → taxa de sucesso **com phone via /clientes cacheado** (prefixa 55).

**FASE 2-3 — Dashboard — IMPLEMENTADO ✅**
- `lib/metrics.ts`: `getMetrics(period)` + `getOverview()`, cache LRU 60s. KPIs de agendamento via view `v_admin_appointments_daily` (base `scheduled_at` — `created_at_trinks` não existe na API); KPIs de conversa via `conversation_history` direto com janela `created_at` (NÃO a view lifetime). Taxa de sucesso = join heurístico por telefone normalizado (`regexp_replace('\D')` nos 2 lados). Empty-state: KPIs Trinks → `null` quando `last_success_at IS NULL` ou tabela vazia. Montagem pura extraída (`assembleMetrics`/`trend`) → testável.
- `app/api/metricas/route.ts` + `app/api/overview/route.ts`: Zod, sessão via proxy, Cache-Control 60s, 500 gracioso.
- `/metricas` (Tela 5): period selector `?period=`, 6 KPI cards (`<KpiCard>`), bar chart Recharts (`<AgendamentosChart>`), top profissionais, refresh (`?fresh=1`), polling 30s pausável, banner de falha (`consecutive_failures>=3`).
- Home `/` (Tela 2): `<OverviewPanel>` — 3 KPI cards + status (bot `bot_toggles.global` + sync Trinks) + conversas ativas (reusa `/api/conversas?status=active`).
- Recharts ^3.8.1 (só carrega em `/metricas`). nav `/metricas` enabled.

**Validações:** typecheck 0, lint 0, build OK (28 rotas), admin 73 pass (+5 métricas), backend 35 pass (+13 worker). Dry-run real fetch→map: 112 recs OK.

**Self-review pegou bug latente:** queries `convAgg`/`taxaSucesso` tinham `$1 + $2` sem cast → pg inferiria `text` e `text + text` daria erro runtime (500). Corrigido com `$1::int + $2::int`.

**CodeRabbit (self-healing @dev light):** iter 1 → 1 CRITICAL (optional chaining `data?.syncStatus?.lastSuccessAt` em overview-panel) auto-corrigido + 2 minors reais aplicados (`toNum` NaN→null; key de tabela com índice). iter 2 → **0 CRITICAL**. 2 minors documentados (não corrigidos — modo @dev light = document_only):
- **Tech-debt (trend-only):** janelas de `apptAgg` (getMetrics linhas ~209-214 e getOverview ~330-337) têm overlap de 1 dia na borda entre período atual/anterior → afeta levemente o **Δ do trend**, não o valor headline do KPI. Fix de borda precisa validação contra DB real → deferido pra QA junto do EXPLAIN. Registrar via `*backlog-debt` se não corrigido na QA.
- Skipados na iter 1: `deepEqual` em float no test (determinístico — `expected` re-deriva a mesma expressão IEEE) e `shortDay` defensivo (input sempre `YYYY-MM-DD` de `toISOString().slice(0,10)`).

**Validação de integração contra schema real (postgres-test, NÃO prod) — FEITA ✅:**
- `tests/api/metrics.test.ts` (novo): `getMetrics`/`getOverview` executam contra schema real (schema.sql + migration 001 com views + trinks tables). Caminho populado (agendamentos=2, no_show=1, cancelamento=1, takeover=1, no_show_rate=33.3%, taxa_sucesso=50%, série + top prof) + empty-state (KPIs Trinks null, conversa preservada). **Pegou bug de fixture que confirmou o contrato do join: telefone precisa estar normalizado com 55 dos 2 lados** (o worker garante isso via `normalizePhoneBR`).
- Worker `upsertChunk` validado contra schema real: INSERT 17-col + `ON CONFLICT` idempotente (não duplica) + `COALESCE` preserva phone em re-sync + `raw`→jsonb + timezone (19:30 -03:00 → 22:30 UTC). Worker não crasha no 1º ciclo.
- Suíte completa com DB: **99/99 pass, 0 skip**.

**Compose fix:** havia um stub **duplicado** `admin-trinks-sync` (linha 181, da arch §13.2 original — imagem do admin, `dist/lib/trinks-sync-worker.js` inexistente) que tornava o `docker-compose.yml` **inválido** (quebraria o deploy de TODOS os serviços). Removido; consolidado na versão backend (Decisão A). `docker compose config` valida OK.

**Flags remanescentes para QA/Victor (precisam de DB de prod com dados reais):**
- AC33: EXPLAIN ANALYZE das queries com volume realista (<100ms; índices migration 001 cobrem). Estrutura já validada contra schema.
- Smoke prod: deploy `admin-trinks-sync` → backfill popula `trinks_appointments` → KPIs Trinks saem do empty-state na UI.

### File List

**Fase 1 — Worker (commitado):**
- `backend/lib/trinks-mapping.js` (novo) — funções puras: mapStatus, normalizePhoneBR, valorToCents, mapAppointment
- `backend/lib/trinks-client.js` (novo) — client Trinks standalone: fetchTrinks, listAllAgendamentos (paginado), getClientePhone
- `backend/trinks-sync-worker.js` (novo) — orquestração backfill/incremental + UPSERT + sync_state
- `backend/test/trinks-sync.test.js` (novo) — 13 testes
- `infra/docker-compose.yml` (modificado) — serviço `admin-trinks-sync`
- `docs/ops/admin-dashboard-deploy.md` (modificado) — runbook do worker

**Fase 2-3 — Dashboard:**
- `frontend/admin/lib/metrics.ts` (novo) — getMetrics/getOverview + assembleMetrics/trend (puros) + cache 60s
- `frontend/admin/app/api/metricas/route.ts` (novo)
- `frontend/admin/app/api/overview/route.ts` (novo)
- `frontend/admin/components/metricas/kpi-card.tsx` (novo)
- `frontend/admin/components/metricas/agendamentos-chart.tsx` (novo — Recharts)
- `frontend/admin/components/metricas/metricas-panel.tsx` (novo)
- `frontend/admin/app/(dashboard)/metricas/page.tsx` (novo)
- `frontend/admin/components/dashboard/overview-panel.tsx` (novo)
- `frontend/admin/app/(dashboard)/page.tsx` (modificado — placeholder → overview)
- `frontend/admin/components/dashboard/nav-links.ts` (modificado — /metricas enabled)
- `frontend/admin/tests/metrics.test.ts` (novo — 5 testes unit puros)
- `frontend/admin/tests/api/metrics.test.ts` (novo — 4 testes de integração contra schema real)
- `frontend/admin/package.json` + `package-lock.json` (modificado — recharts ^3.8.1)
- `infra/docker-compose.yml` (modificado — removido stub `admin-trinks-sync` duplicado/quebrado)

## DoD Self-Assessment (@dev)

- **Requisitos/AC:** Funcionais implementados. AC33 (EXPLAIN <100ms) e validação do SQL contra DB com dados → **deferidos pra QA** (não tenho acesso a DB; conexão direta a prod foi bloqueada por guardrail). Smoke prod (worker popula tabela → KPIs saem do empty-state) → Victor.
- **Padrões/estrutura:** ✅ espelha padrões existentes (`conversas.ts`, saude components, route handlers). Lint 0, typecheck 0.
- **Testes:** ✅ unit (worker mapping/UPSERT 13; metrics puro 5). Integração contra DB **não rodada** (sem DB) — `lib/metrics.ts` SQL testado só na montagem pura; cobre QA.
- **Verificação funcional:** worker fetch→map validado contra API real (dry-run 112 recs). UI **não verificada em app rodando** (precisa DB + dev server) → smoke Victor/QA.
- **Story admin:** ✅ tasks marcados, decisões documentadas, File List + Change Log atualizados.
- **Build/deps:** ✅ build OK (28 rotas). Recharts ^3.8.1 (in-spec arch §17/AC32). Serviço compose + runbook documentados.
- **Não-resolvido (honesto):** trend Δ com overlap de 1 dia na borda (minor, tech-debt documentado); EXPLAIN + smoke prod pendentes.

**Veredito:** pronto para review/QA. Bloqueios de validação são por falta de acesso a DB (ambiente), não por código incompleto.

## QA Results
_(preenchido pelo @qa)_
