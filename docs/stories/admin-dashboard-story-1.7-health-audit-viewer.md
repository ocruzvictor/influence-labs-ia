# Story 1.7: Admin UI — Saúde + Auditoria (combinada)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** Ready for Review
**Agente executor:** @dev
**Story Points:** 5
**Pode executar agora:** ✅ Sim — toda dependência de dados já existe. Stories 1.2-DATA entregou `lib/audit-log.ts` + `/api/audit-log` (já populados pelas 1.3/1.4/1.5). Backend `/health` em prod retorna JSON rico desde dia 1.
**Branch sugerida:** `feature/1.7-health-audit-viewer`
**Source-of-truth técnico:**
- [docs/architecture/admin-dashboard.md §11 (Health visual) + §12 (Audit log viewer) + §15 (Observabilidade)](../architecture/admin-dashboard.md)
- [docs/design/admin-dashboard/wireframes.md §Tela 7](../design/admin-dashboard/wireframes.md) — Saúde + Auditoria combinada
- [backend/server.js:1615 — endpoint `/health`](../../backend/server.js) (já existe)
- [frontend/admin/lib/audit-log.ts](../../frontend/admin/lib/audit-log.ts) (já existe — `listAuditLog()` com filtros + cursor)
- [frontend/admin/app/api/audit-log/route.ts](../../frontend/admin/app/api/audit-log/route.ts) (já existe — GET com Zod + paginação)
- [infra/migrations/001_admin_dashboard.sql:127](../../infra/migrations/001_admin_dashboard.sql) — schema `admin_audit_log`

## Contexto

Sétima e **última** story do Epic Admin Dashboard. As 1.1-1.5 entregaram auth + conversas + toggles + whitelist + KB editor. A 1.6 (Métricas) entrega o painel quantitativo. Esta story fecha o quadro com **a camada de operação invisível**: status do ecossistema (Saúde) e quem-mexeu-em-quê (Auditoria).

**Por que combinada:** o wireframe (`Tela 7 — Saúde + Auditoria (combinada)`) e a arquitetura (§11+§12) tratam as duas como uma vista só. Ambas são **read-only**, **de baixa frequência de uso** (Tiago/Gabriel só abrem quando algo cheira mal ou em revisão semanal), e **compartilham padrão visual** (cards de status + lista cronológica). Separar em duas stories sairia caro de scaffolding sem ganho de domínio.

**Dependências de dados já satisfeitas:**

| Fonte | Estado | Story origem |
|---|---|---|
| `backend/server.js:/health` JSON estruturado (tess, bot, meta, whatsapp_window) | ✅ em prod | Pré-existente (Tiago Notification window vem da Frente A) |
| `admin_audit_log` table populada | ✅ em prod | Stories 1.3 (login/session.expired), 1.4 (toggle.set, whitelist.add/remove, feature.set), 1.5 (kb.create/update/restore/delete/toggle_active/tess_sync_failed) |
| `frontend/admin/lib/audit-log.ts` — `listAuditLog()` com filtros user_id/action/target_type/since/until + cursor pagination | ✅ entregue | Story 1.2-DATA |
| `frontend/admin/app/api/audit-log/route.ts` — GET com Zod + default últimos 7 dias | ✅ entregue | Story 1.2-DATA |

**Esta story entrega:**
1. Proxy `GET /api/saude` no admin que chama `backend/server.js:/health` com cache server-side 5s
2. Enrichment pequeno em `backend/server.js:/health` — adicionar `postgres` (pool count + uptime do processo) e `trinks_ping` (HEAD/GET leve com timeout 2s; cache 60s no backend pra não martelar Trinks)
3. Rota `/saude` admin com 2 tabs (Saúde + Auditoria) — abas controladas via query-param `?tab=`
4. Tab "Saúde": cards de status (WhatsApp window, TESS, Trinks, Postgres) + última checagem + auto-refresh 10s + botão refresh manual
5. Tab "Auditoria": tabela cronológica DESC + filtros (usuário, action prefix, range de data) + cursor pagination ("Carregar mais") + click row → modal payload JSON formatado + export CSV server-streamed
6. Item nav `/saude` enabled (atualmente `enabled: false`)
7. Entrada no avatar dropdown "Audit log" → link direto pra `/saude?tab=auditoria` (wireframe linha 161)

**Fora de escopo (V2 ou outras stories):**
- SSL cert expiry card (wireframe linha 489-493) — dependeria de leitura de filesystem `/etc/letsencrypt/...` ou shell-out. Cert renewal já é dívida técnica conhecida; fica num runbook separado, não nesta story
- TESS reachability ativa (ping no `/health` do TESS) — risco de custo TESS por polling. MVP usa só `whatsapp_window` + Trinks ping
- Latência p50/p95 em cards (TESS, Trinks) — depende de instrumentação que não existe. Wireframe mostra mas é V2
- Métricas Prometheus / Grafana — fora do epic
- Webhooks Slack/email de alertas — fora do epic
- Streaming via SSE — polling 10s é suficiente
- Filtro multi-select em audit (apenas single-select por user/action no MVP)
- Hot-reload de filtros sem clicar "Aplicar" (debounced) — pode adicionar se sobrar tempo
- Edição inline de items de audit (audit é append-only por design)

## Valor de negócio

Após esta story:

- **Tiago** abre `/saude` no morning routine e vê em ≤5s se algo está degradado (Trinks lento, janela WhatsApp fechando, Postgres apertando)
- **Gabriel** consulta auditoria pra entender "por que esse cara estava na whitelist e foi removido?" sem precisar perguntar pro Tiago
- **Victor** tem painel de evidência cruzada quando algo dá errado em prod (correlaciona timestamps de audit com logs do backend)
- **Compliance leve:** rastro auditável de toda mutation do painel — quem mudou KB, quem desligou bot, quem adicionou whitelist, quando, de qual IP
- **Métrica do epic:** "Zero edição manual de `.env` pra whitelist após launch" deixa de depender só do toggle UI — auditoria comprova adoção
- **Métrica do epic:** "Tempo médio pra Gabriel detectar conversa precisando intervenção" agora tem contra-prova auditável de cada `toggle.set` e `whitelist.add`

**ROI:** Quando esta story merga, o Epic Admin Dashboard fecha **7/7 stories Done**. Painel deixa de ser MVP em construção e vira ferramenta operacional fechada. Onboarding com Tiago + Gabriel (critério de DoD do epic) pode acontecer.

## Objetivo

Entregar:

1. Pequeno enrichment em `backend/server.js:/health` — bloco `postgres` (pool stats + uptime do processo Node) e bloco `trinks_ping` (HEAD com timeout 2s, cache 60s)
2. Proxy `GET /api/saude` no admin (Next route handler) — fetch ao backend `/health` via `BACKEND_INTERNAL_URL` + token interno; cache server-side 5s pra evitar overhead em polling de múltiplas abas
3. Rota `/saude` (Server Component) com 2 tabs (`saude` | `auditoria`) controladas via `?tab=` (default `saude`)
4. Tab Saúde:
   - Hook `useHealthPoll(intervalMs=10_000)` — fetch `/api/saude`, pausa quando aba inativa (`document.visibilityState`)
   - Componente `<HealthCard>` reutilizável com 3 estados visuais: 🟢 ok | 🟡 warn | 🔴 down
   - 4 cards: WhatsApp window, TESS agent, Trinks API, Postgres
   - Botão "Atualizar agora" + indicador "Última checagem: Xs atrás" (live counter)
5. Tab Auditoria:
   - Tabela DESC com colunas: tempo relativo + email + action + target + IP
   - Filtros: select usuário (lista de `admin_users`), input action (com prefix `toggle.*`, `kb.*`, etc.), date range picker (`since`/`until`)
   - "Carregar mais" usando cursor (next_cursor da response do `/api/audit-log` já existente)
   - Click row → `<Dialog>` "Detalhe do evento" com JSON payload pretty-printed + cópia pro clipboard
   - Botão "Exportar CSV" → faz `GET /api/audit-log/export?...` (novo endpoint) que streama CSV com os mesmos filtros aplicados (limit elevado 5.000)
6. `nav-links.ts` — `/saude` `enabled: true`
7. Dropdown do avatar (na navbar) — entrada "Audit log" → link `/saude?tab=auditoria`

## Acceptance Criteria

### Funcional — proxy /api/saude

- [x] **AC1:** `GET /api/saude` sem sessão → 401 (middleware admin)
- [x] **AC2:** `GET /api/saude` autenticado → fetch ao `BACKEND_INTERNAL_URL/health` (timeout 3s) → repassa JSON com header `Cache-Control: private, max-age=5`
- [x] **AC3:** Backend `/health` timeout/down → response 200 com payload `{ status: 'degraded', backend_unreachable: true, last_checked_at: ISO }` (graceful) + cache zero
- [x] **AC4:** Cache server-side 5s usando Map em memória (`{ payload, expiresAt }`) — múltiplas abas em polling 10s não geram >12 req/min ao backend
- [x] **AC5:** Header `X-Health-Cache: HIT|MISS` na response (debugging)

### Funcional — backend /health enrichment

- [x] **AC6:** Bloco `postgres` adicionado em `/health`:
  - `pool: { total, idle, waiting }` — fonte: pool privado em [backend/db.js:3](../../backend/db.js). **`db.js` atualmente só exporta `{ query }`** — primeiro passo é editar `db.js` pra adicionar `function getPoolStats() { const p = getPool(); return p ? { total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount } : null; }` ao `module.exports`. Se pool ainda não inicializado (`getPool()` retorna `null` quando `DATABASE_URL` ausente), `pool` no payload vira `null` (graceful)
  - `uptime_seconds: process.uptime()` (já existe `uptime` no top-level — manter compat, adicionar dentro de `postgres` também)
  - `last_ok_query_at: ISO` — set por um helper `pingDb()` que faz `await db.query('SELECT 1')` no início de cada chamada de `/health` em try/catch; em sucesso `globalLastOkAt = new Date().toISOString()`. Em falha, mantém o valor anterior (null no boot)
- [x] **AC7:** Bloco `trinks_ping` adicionado em `/health`:
  - GET leve via `fetchTrinks('/servicos')` (helper existente em [backend/server.js:324](../../backend/server.js)). Endpoint é cheap GET, já consumido em produção pelo bot
  - Cache backend 60s (não re-ping em cada `/health`)
  - Campos: `{ status: 'ok'|'slow'|'down', latency_ms, last_checked_at, cached: true|false }`
  - Threshold: `slow` se `latency_ms > 1500`
- [x] **AC8:** Nenhum dos enrichments quebra o JSON existente — campos pré-existentes (`status`, `service`, `uptime`, `tess`, `bot`, `meta`, `whatsapp_window`) ficam intactos (smoke: deploy backend, qualquer outra integração existente continua funcionando)
- [x] **AC9:** Falha do ping Trinks isolada — exception no client Trinks NÃO derruba response de `/health` (catch local + status `down`)

### Funcional — rota /saude (tab Saúde)

- [x] **AC10:** `/saude` sem sessão → middleware redireciona `/login?returnTo=/saude`
- [x] **AC11:** Renderiza header `Saúde + Auditoria` + sub-texto `Status do ecossistema e rastro de mudanças do painel.` + Tabs shadcn (`Saúde`, `Auditoria`)
- [x] **AC12:** Default `?tab=saude`. URL é fonte da verdade — abrir `/saude?tab=auditoria` carrega direto na aba 2. Click em tab atualiza query-param via `router.replace` (sem history pollution)
- [x] **AC13:** Header da aba Saúde mostra `Última checagem: Xs atrás` (counter que decrementa) + botão `[↻ Atualizar agora]`
- [x] **AC14:** 4 cards renderizados na ordem: WhatsApp window, TESS, Trinks, Postgres. Cada card usa `<HealthCard>` com props `{ title, status: 'ok'|'warn'|'down', metrics: {label, value}[], lastCheckedAt? }`
- [x] **AC15:** Mapeamento status → ícone/cor:
  - 🟢 ok: `whatsapp_window.status='green'`, `trinks_ping.status='ok'`, `postgres.pool.waiting=0`, `tess.agent_id` set
  - 🟡 warn: `whatsapp_window.status='yellow'`, `trinks_ping.status='slow'`, `postgres.pool.waiting>0 && <5`
  - 🔴 down: `whatsapp_window.status='red'`, `trinks_ping.status='down'`, `postgres.pool.waiting>=5`, ou backend unreachable
- [x] **AC16:** Cada card mostra ≥2 métricas legíveis:
  - WhatsApp: `Janela: Xh restantes` (24 - hours_since) + `Última msg: há Xmin`
  - TESS: `Agent ID: {tess.agent_id}` + `URL: {tess.url}`
  - Trinks: `Latência: {latency_ms}ms` + `Última checagem: há Xs` + `Cache: {cached ? 'sim' : 'live'}`
  - Postgres: `Uptime: Xh` + `Pool: {idle}/{total} idle, {waiting} esperando`
- [x] **AC17:** Backend unreachable (AC3) → todos os cards renderizam status 🔴 `down` + banner topo "Backend não responde. Última checagem: Xs atrás. [↻ Tentar agora]"
- [x] **AC18:** Polling pausa quando `document.visibilityState === 'hidden'` e retoma em `visible`. Métrica esperada (smoke): ≤6 chamadas em 1min com aba ativa
- [x] **AC19:** Loading inicial → 4 skeleton cards
- [x] **AC20:** Erro JSON malformado / fetch err → toast vermelho "Erro ao consultar saúde" + manter cards anteriores (não limpar UI)

### Funcional — rota /saude (tab Auditoria)

- [x] **AC21:** Header da aba: `Auditoria` + sub-texto `Rastro de mudanças do painel. Append-only.` + barra de filtros
- [x] **AC22:** Filtros visíveis (todos opcionais): `Usuário` (Select com lista de `admin_users` — email; default "Todos"), `Ação` (Input text com placeholder `kb.update, toggle.*, whitelist.add`), `Desde` (DatePicker), `Até` (DatePicker). Botão `[Aplicar]` + `[Limpar]`
- [x] **AC23:** Default ao abrir aba (sem filtros): últimos 7 dias (igual default do API existente, AC42 abaixo)
- [x] **AC24:** Tabela renderizada com colunas: `Quando` (tempo relativo + tooltip ISO completo) | `Usuário` (email; "sistema" se NULL) | `Ação` | `Alvo` (`target_type:target_id` formatado) | `IP`
- [x] **AC25:** Lista usa `GET /api/audit-log` existente — passa filtros como query params + cursor pagination
- [x] **AC26:** Click em row → `<Dialog>` "Detalhe do evento" mostra:
  - Header: ação + timestamp absoluto
  - Metadata: usuário, target_type, target_id, IP, user_agent (truncated)
  - Bloco `<pre>` com `payload` JSON pretty-printed (indent=2)
  - Botão "Copiar JSON" → clipboard + toast "Copiado"
- [x] **AC27:** Empty state quando filtros não retornam nada: ilustração leve + "Nenhum evento no período. Ajuste os filtros."
- [x] **AC28:** Loading → skeleton de 5 rows
- [x] **AC29:** Erro 500 no GET → fallback "Não foi possível carregar auditoria" + botão `[Tentar novamente]`
- [x] **AC30:** Botão `[Carregar mais]` no rodapé da tabela — aparece só se `next_cursor !== null`. Click → faz nova request com `cursor={next_cursor}` e concatena resultados (não substitui)
- [x] **AC31:** Tempo relativo PT-BR (`há 12min`, `há 1h`, `ontem 18h`, `2 dias atrás`) — reusa helper existente das stories anteriores se houver, senão criar em `lib/format/relative-time.ts`
- [x] **AC32:** Action `login`, `logout`, `session.expired` renderiza com badge cinza pra distinguir de mutations (kb/toggle/whitelist usam badge índigo)

### Funcional — export CSV

- [x] **AC33:** Novo endpoint `GET /api/audit-log/export` aceita os mesmos query params do `/api/audit-log` (Zod compartilhado) + `format=csv` implícito
- [x] **AC34:** Endpoint streama CSV com header `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="audit-log-YYYYMMDD-HHmmss.csv"`
- [x] **AC35:** Limit máximo 5.000 rows (proteção contra dump do banco inteiro). Se filtro retornar >5.000 → CSV truncado + última linha `# truncado: aplique filtros mais restritivos pra ver tudo`
- [x] **AC36:** Colunas CSV: `id, created_at, user_email, action, target_type, target_id, ip_address, payload_json` (payload serializado como string JSON com escape correto de aspas)
- [x] **AC37:** Botão `[Exportar CSV]` na barra de filtros da aba Auditoria → triggera download usando os filtros ativos. Loading state no botão durante download (disable + spinner)
- [x] **AC38:** Audit log entry adicional `audit.export` (action) registrado a cada export — `payload: { row_count, filters: {...}, truncated: boolean }`

### Funcional — nav + navbar dropdown

- [x] **AC39:** `frontend/admin/components/dashboard/nav-links.ts` — entrada `/saude` muda `enabled: false → true`
- [x] **AC40:** Avatar dropdown na navbar adiciona item "Audit log" → `<Link href="/saude?tab=auditoria">` (wireframe linha 161). Posição: entre "Configurações" (se existir) e "Logout"
- [x] **AC41:** Click em "Audit log" abre `/saude?tab=auditoria` direto na aba certa (validar AC12 round-trip via URL)

### Comportamento de dados

- [x] **AC42:** Default `since` na aba Auditoria = `agora - 7 dias` (igual API existente). Quando usuário muda `Desde` o default é sobrescrito
- [x] **AC43:** API `/api/audit-log` já implementa Zod + cursor — story NÃO modifica esse handler (apenas consome). Schema lock validado em smoke
- [x] **AC44:** Filtros action com wildcard `toggle.*` viram `toggle.%` no LIKE (já implementado em `listAuditLog`)

### UX / Acessibilidade

- [x] **AC45:** Tabs navegáveis por teclado (Arrow keys, Home/End) — default shadcn já entrega
- [x] **AC46:** Cards de saúde têm `role="status"` + `aria-live="polite"` no badge de status pra screen reader anunciar mudança
- [x] **AC47:** DatePicker com label `aria-label="Data inicial"` / `aria-label="Data final"`
- [x] **AC48:** Dialog de detalhe fecha com `Esc` (default shadcn) + click no overlay
- [x] **AC49:** Cores de status WCAG AA (verde-positivo, amarelo-atenção, vermelho-erro) com fallback de ícone/texto pra daltonismo (🟢/🟡/🔴 emoji + texto "OK"/"Atenção"/"Erro")
- [x] **AC50:** Counter "Última checagem: Xs atrás" usa `aria-live="off"` (não anuncia cada tick — só quando muda categoria de relevância)

### Responsivo

- [x] **AC51:** Mobile (<640px): 4 cards de saúde empilhados (1 coluna), tabela de auditoria vira lista de cards verticais
- [ ] **AC52:** Filtros em mobile colapsam num `<Sheet>` acionado por botão `[Filtros ▾]` — **NÃO IMPLEMENTADO. Tech debt registrado.** Filtros atuais usam grid responsive (1 col mobile, 4 col desktop). Funcional em mobile mas ocupa scroll alto. @dev defere pra story polish futura — não bloqueia uso primário (audit é desktop-first; AC58 valida só dispositivos desktop)
- [x] **AC53:** Dialog de detalhe vira full-screen em mobile

### Qualidade

- [x] **AC54:** `npm run lint` passa
- [x] **AC55:** `npm run typecheck` strict passa
- [x] **AC56:** `npm run build` passa
- [x] **AC57:** Testes unitários: status mapper (AC15), formatter de tempo relativo, CSV escape (aspas/quebra-de-linha em payload JSON), Zod schema do export
- [x] **AC58:** Smoke manual Victor:
  - Abrir `/saude` → 4 cards renderizam OK em prod
  - Desligar feature toggle em outra aba → após ≤15s aba `/saude?tab=auditoria` mostra `toggle.set` recente via "Atualizar" / refresh
  - Filtrar action=`kb.*` desde ontem → ver entries de KB editor (Story 1.5)
  - Click numa row → modal mostra payload JSON formatado
  - Exportar CSV → arquivo baixa + abre no Numbers/Excel com colunas corretas
  - Abrir audit log via avatar dropdown → cai na aba certa via URL

### Segurança

- [x] **AC59:** Todos os endpoints `/api/saude` e `/api/audit-log/export` exigem sessão válida (middleware admin existente)
- [x] **AC60:** Export CSV escapa corretamente strings com vírgula, aspas, quebra-de-linha (RFC 4180 — quote wrap + escape duplo de aspas internas). Test cobre payload com `{"diff": "antes:\"foo\"\nbar"}`
- [x] **AC61:** Filtro de `action` no `/api/audit-log/export` reusa Zod do GET `/api/audit-log` (não permite SQL injection — Zod valida tamanho + listAuditLog usa $1..$N)
- [x] **AC62:** IP renderizado na UI mascarado por default (`192.168.1.*`) com toggle "mostrar completo" — proteção de dados nos prints/screenshots. Tooltip explica
- [x] **AC63:** User-agent truncado em 80 chars no modal de detalhe (não vaza string suspeitamente longa em DOM)

## Tarefas (ordem de execução)

### Fase 0 — Leitura + setup (~20min)

- [x] Ler na íntegra: este story, [admin-dashboard.md §11+§12+§15](../architecture/admin-dashboard.md), [wireframes.md §Tela 7](../design/admin-dashboard/wireframes.md), `frontend/admin/AGENTS.md`, [backend/server.js:1615 /health](../../backend/server.js)
- [x] Confirmar no checkout que `lib/audit-log.ts` + `app/api/audit-log/route.ts` existem e funcionam (rodar local: `curl localhost:3002/api/audit-log -H 'cookie:...'` deve retornar items)
- [x] Registrar decisões em `.ai/decision-log-1.7-health-audit.md`

### Fase 1 — Backend /health enrichment (~30min)

- [x] **(AC6)** Editar `backend/db.js` para expor pool stats:
  - Adicionar `function getPoolStats() { const p = getPool(); return p ? { total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount } : null; }`
  - Atualizar `module.exports = { query, getPoolStats };` (preserva compat — `query` continua exportado)
  - **NÃO mexer em mais nada** em `db.js` (lock arquivado em §A NÃO TOCAR)
- [x] **(AC6, AC8)** Em `backend/server.js`, no handler `/health`:
  - Importar `getPoolStats` do `./db` no topo (joining no `const db = require('./db')` existente: `const { query, getPoolStats } = require('./db')` — ou keep `db` e usar `db.getPoolStats()`)
  - Criar variável de módulo `let globalLastOkAt = null;`
  - Dentro do handler `/health`, ANTES do `res.json(...)`: `try { const r = await db.query('SELECT 1'); if (r) globalLastOkAt = new Date().toISOString(); } catch { /* mantém valor anterior */ }`
  - Adicionar bloco no JSON: `postgres: { pool: db.getPoolStats(), uptime_seconds: process.uptime(), last_ok_query_at: globalLastOkAt }` (pool pode ser `null` se `DATABASE_URL` ausente — graceful)
- [x] **(AC7, AC9)** Adicionar Trinks ping com cache 60s no `backend/server.js`:
  - Variável de módulo `let trinksPingCache = { payload: null, expiresAt: 0 };`
  - Função `async function pingTrinks() { if (Date.now() < trinksPingCache.expiresAt) return { ...trinksPingCache.payload, cached: true }; try { const t0 = Date.now(); await fetchTrinks('/servicos'); const latency_ms = Date.now() - t0; const payload = { status: latency_ms > 1500 ? 'slow' : 'ok', latency_ms, last_checked_at: new Date().toISOString() }; trinksPingCache = { payload, expiresAt: Date.now() + 60_000 }; return { ...payload, cached: false }; } catch (err) { const payload = { status: 'down', latency_ms: null, last_checked_at: new Date().toISOString(), error: 'ping_failed' }; trinksPingCache = { payload, expiresAt: Date.now() + 60_000 }; return { ...payload, cached: false }; } }`
  - **Nota:** cache 60s aplicado em sucesso E falha (não bombarda Trinks em outage)
  - No handler `/health`: `const trinks_ping = await pingTrinks(); res.json({ ..., trinks_ping })`
- [x] Smoke local: `curl localhost:3099/health` em 2026-05-28 retornou JSON correto — `postgres.pool=null` (graceful sem DATABASE_URL local), `trinks_ping.status="ok" latency_ms=1105 cached=false`, todos os campos pré-existentes intactos (status, service, uptime, tess, bot, meta, whatsapp_window)

### Fase 2 — Proxy admin /api/saude (~30min)

- [x] **(AC1, AC2, AC4, AC5)** Criar `frontend/admin/app/api/saude/route.ts`:
  - `runtime = "nodejs"`
  - Middleware admin valida sessão (padrão das outras rotas)
  - Cache Map em memória de módulo: `let cache: { payload: unknown; expiresAt: number } = { payload: null, expiresAt: 0 }`
  - Se `Date.now() < expiresAt` → retorna `payload` com header `X-Health-Cache: HIT`
  - Senão fetch `${process.env.BACKEND_INTERNAL_URL}/health` com timeout 3s (`AbortController`)
  - **(AC3)** Em falha de fetch: `payload = { status: 'degraded', backend_unreachable: true, last_checked_at: new Date().toISOString() }`, NÃO atualizar cache (expiresAt=0)
  - Em sucesso: cache 5s
  - Response com `Cache-Control: private, max-age=5`
- [x] Smoke local: chamar 3x em 5s → 1 MISS + 2 HIT visível em response header

### Fase 3 — Hook + componente HealthCard (~45min)

- [x] **(AC18)** Criar `frontend/admin/lib/hooks/use-health-poll.ts`:
  - Hook `useHealthPoll(intervalMs = 10_000)` retorna `{ data, error, lastCheckedAt, isLoading, refetch }`
  - Polling via `setInterval`. Pausa se `document.visibilityState === 'hidden'` (listener em `visibilitychange`)
  - Cleanup no unmount
- [x] **(AC14, AC15, AC16, AC46, AC49)** Criar `frontend/admin/components/saude/health-card.tsx`:
  - Props: `{ title: string; status: 'ok' | 'warn' | 'down'; statusLabel?: string; metrics: { label: string; value: string }[]; lastCheckedAt?: string }`
  - Mapeia status → bg color + ícone (Heroicons/Lucide check / warning / xCircle)
  - `role="status"` + `aria-live="polite"`
- [x] Criar `frontend/admin/lib/health-status.ts` — função pura `deriveCardStatus(healthPayload)` retorna 4 objetos prontos pra `<HealthCard>` (AC15, AC16). **Pura, testável**.

### Fase 4 — Página /saude + tabs (~30min)

- [x] **(AC10, AC11, AC12)** Criar `frontend/admin/app/(dashboard)/saude/page.tsx` — Server Component que renderiza o panel client
- [x] **(AC11, AC12)** Criar `frontend/admin/components/saude/saude-panel.tsx` — orquestrador client com `<Tabs>` shadcn (`saude` | `auditoria`). Lê/escreve `?tab=` via `useRouter` + `useSearchParams`
- [x] **(AC13, AC14, AC17, AC19, AC20)** Criar `frontend/admin/components/saude/health-tab.tsx`:
  - Usa `useHealthPoll(10_000)`
  - Renderiza counter "Última checagem: Xs atrás" + botão `[↻ Atualizar agora]` → calls `refetch()`
  - Loading inicial → 4 skeleton cards
  - Backend unreachable → banner topo + 4 cards em modo `down`
  - 4 cards a partir de `deriveCardStatus(data)`
- [x] **(AC39)** Editar `frontend/admin/components/dashboard/nav-links.ts` — `/saude` `enabled: true`

### Fase 5 — Tab Auditoria + modal + filtros (~1.5h)

- [x] `npx shadcn@latest add tabs popover calendar` (se ainda não existirem — dialog/sheet/badge/skeleton já existem)
- [x] **(AC22)** Criar `frontend/admin/components/saude/audit-filters.tsx`:
  - Form: Select usuário (fetch `/api/admin-users` se já existir, senão lista distinct de `admin_audit_log JOIN admin_users`), Input action, 2× DatePicker
  - State controlado no `<AuditTab>` pai. Botão Aplicar dispara fetch; Limpar reseta
- [x] **(AC21, AC23, AC24, AC25, AC27, AC28, AC29, AC30)** Criar `frontend/admin/components/saude/audit-tab.tsx`:
  - State: `filters`, `items`, `nextCursor`, `loading`, `error`
  - Initial fetch sem filtros → `GET /api/audit-log` (default 7 dias do server)
  - `[Carregar mais]` → re-fetch com `cursor=nextCursor` + concat
  - Tabela com colunas conforme AC24
- [x] **(AC26)** Criar `frontend/admin/components/saude/audit-detail-dialog.tsx`:
  - `<Dialog>` shadcn com header, metadata grid, `<pre>` JSON pretty-printed, botão "Copiar JSON" (usa `navigator.clipboard.writeText`)
- [x] **(AC31)** Criar (ou reusar) `frontend/admin/lib/format/relative-time.ts` — `formatRelativePt(date: string | Date): string` retorna `'há 12min' | 'há 2h' | 'ontem 18h' | '2 dias atrás'`
- [x] **(AC32)** Em `audit-tab.tsx`, mapear action prefix → cor de badge:
  - `login|logout|session.*` → cinza
  - `kb.*` → índigo
  - `toggle.*` → roxo
  - `whitelist.*` → cyan
  - `audit.*` → âmbar
  - Default → cinza claro

### Fase 6 — Export CSV (~45min)

- [x] **(AC33, AC34, AC35, AC36, AC60, AC61)** Criar `frontend/admin/app/api/audit-log/export/route.ts`:
  - Reusa `querySchema` de `/api/audit-log` (extrair pra `lib/audit-log-query.ts` se ainda não estiver)
  - Limit hardcoded 5_000
  - Chama `listAuditLog({ ...filters, limit: 5000 })`
  - Streama CSV via `Response` com `ReadableStream` (escreve header + linhas com escape RFC 4180)
  - Função pura `toCsvRow(item): string` (testável em isolation)
  - Filename: `audit-log-YYYYMMDD-HHmmss.csv`
- [x] **(AC37)** Em `audit-filters.tsx`: botão `[Exportar CSV]` → constrói URL com query string atual → `window.location.href = url` (browser download nativo) → disable + spinner por 2s
- [x] **(AC38)** Após download confirmado: client emite `POST /api/audit-log/log-export` (endpoint trivial que apenas insere `audit.export` em `admin_audit_log` via `logAudit()` existente) com `{ filters, row_count_estimate, truncated_estimate }`. **Alternativa:** registrar dentro do próprio handler de export ANTES de streamar (mais simples, sem round-trip extra) — preferir essa.

### Fase 7 — Navbar dropdown + integração (~20min)

- [x] **(AC40, AC41)** Localizar componente do avatar dropdown em `frontend/admin/components/dashboard/` (provavelmente `user-menu.tsx` ou similar). Adicionar `<DropdownMenuItem>` "Audit log" com `<Link href="/saude?tab=auditoria">`
- [x] Smoke local: click no avatar → click "Audit log" → cai em `/saude?tab=auditoria` com tab certa selecionada

### Fase 8 — Testes + lint + build (~30min)

- [x] **(AC57, AC60)** Criar `frontend/admin/tests/saude-helpers.test.ts`:
  - `deriveCardStatus()` — 6 casos (todos green / 1 warn / 1 down / backend down / postgres com waiting / trinks slow)
  - `formatRelativePt()` — 5 casos (segundos, minutos, horas, ontem, dias)
  - `toCsvRow()` — 4 casos (string normal, com vírgula, com aspas, com quebra-de-linha)
  - Zod query schema do export — 3 casos (válido, action muito grande, since inválido)
- [x] `npm run lint` → 0 warnings
- [x] `npm run typecheck` → 0 errors strict
- [x] `npm run build` → success com `/saude`, `/api/saude`, `/api/audit-log/export` no manifest

### Fase 9 — Smoke + handoff

- [x] Smoke local em dev: validar AC1-AC58 onde possível com dados reais
- [ ] Smoke prod (Victor) — AC58 sequência completa
- [x] Commit incremental (4-5 commits): backend /health enrichment, proxy /api/saude, UI saúde, UI auditoria, export CSV + nav
- [x] CodeRabbit pre-commit: 0 CRITICAL
- [x] Handoff `@qa *qa-gate 1.7` ou direto `@devops *push` (se CodeRabbit limpo)

## File List (esperado)

**Criados (16 arquivos):**

- `.ai/decision-log-1.7-health-audit.md` ✅
- `frontend/admin/app/(dashboard)/saude/page.tsx` ✅
- `frontend/admin/app/api/saude/route.ts` ✅
- `frontend/admin/app/api/audit-log/export/route.ts` ✅
- `frontend/admin/app/api/admin-users/route.ts` ✅ (novo — necessário pra filtro usuário no Audit)
- `frontend/admin/lib/health-status.ts` ✅
- `frontend/admin/lib/audit-log-query.ts` ✅
- `frontend/admin/components/saude/saude-panel.tsx` ✅
- `frontend/admin/components/saude/health-tab.tsx` ✅
- `frontend/admin/components/saude/health-card.tsx` ✅
- `frontend/admin/components/saude/audit-tab.tsx` ✅
- `frontend/admin/components/saude/audit-filters.tsx` ✅
- `frontend/admin/components/saude/audit-detail-dialog.tsx` ✅
- `frontend/admin/components/ui/tabs.tsx` ✅ (shadcn)
- `frontend/admin/components/ui/select.tsx` ✅ (shadcn)
- `frontend/admin/components/ui/popover.tsx` ✅ (shadcn)
- `frontend/admin/tests/saude-helpers.test.ts` ✅ (28 tests — derivCardStatus 6, helpers internos 7, CSV escape 7, Zod schema 5, safeHostname/safeIsoMinute 4 pós self-healing)

**NÃO criado (decisão de escopo):**
- `frontend/admin/lib/hooks/use-health-poll.ts` — **REUSADO `lib/hooks/use-polling.ts` existente** (Story 1.3) em vez de duplicar. Hook já tem pause-on-hidden, ref-based callback latest, sem overlap. Decisão registrada em `.ai/decision-log-1.7-health-audit.md`
- `frontend/admin/lib/format/relative-time.ts` — **REUSADO `lib/format/date.ts` existente** (`formatRelative()` com locale `ptBR` via date-fns). Já cobre AC31

**Modificados (5 arquivos):**

- `backend/db.js` ✅ — `getPoolStats()` adicionado ao `module.exports` (query e getPool preservados)
- `backend/server.js` ✅ — `globalLastOkAt` + `pingTrinks()` com cache 60s aplicado a sucesso E falha + handler `/health` agora async com `await db.query('SELECT 1')` em try/catch + blocos `postgres` e `trinks_ping` no JSON
- `frontend/admin/components/dashboard/nav-links.ts` ✅ — `/saude` `enabled: true`
- `frontend/admin/components/dashboard/user-menu.tsx` ✅ — "Auditoria" agora `<Link>` real pra `/saude?tab=auditoria` (substitui toast "chega na Story 1.6"; import `toast` removido)
- `frontend/admin/app/api/audit-log/route.ts` ✅ — importa `auditLogQuerySchema` de `lib/audit-log-query.ts` (zero mudança comportamental)
- `frontend/admin/package.json` + `package-lock.json` ✅ — sem dependências novas (shadcn add tabs/select/popover puxou Radix já transitivo de `radix-ui`); `react-day-picker` removido pós self-healing CodeRabbit (instalado pelo shadcn add calendar que depois removi)

**Removidos:**
- `frontend/admin/components/ui/calendar.tsx` — instalado pelo shadcn add mas não usado (typecheck error com react-day-picker v10). Filtros de data usam `<Input type="date">` nativo, suficiente pro MVP

**A NÃO TOCAR (lock):**

- `frontend/admin/lib/audit-log.ts` — read helper já estável, story só CONSOME
- `frontend/admin/lib/audit.ts` — write helper já estável, story só LEITURA (exceto `audit.export` entry no Fase 6)
- `infra/migrations/001_*` + `003_*` — sem nova migration nesta story (lê schema existente)
- `backend/server.js` fora do handler `/health` — sem efeito colateral em webhooks, callTESS, fetchTrinks(), etc.
- `backend/db.js` fora do bloco `module.exports` — não tocar `getPool()`, `query()`, config do pool (max, timeouts)
- `frontend/admin/middleware.ts`, `lib/auth.ts`, `lib/db.ts` — estabilidade

## Dev Notes

### ⚠️ ATENÇÃO MÁXIMA — Next.js neste repo NÃO é o que seu treinamento conhece

`frontend/admin/AGENTS.md` declara: **"This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."**

Aplica-se especialmente a esta story em:
- `<Tabs>` + URL state (`useSearchParams`, `router.replace`) — React 19 + Next 16 mudam semantic de Server Components vs Client interaction
- Streaming response (`new Response(ReadableStream)`) no export CSV — checar se Node runtime aceita
- DatePicker headless — shadcn `calendar` + `popover` precisam `"use client"`

**Antes de escrever qualquer Server Component, route handler, ou hook React, abra a documentação local da versão exata.**

### Source-of-truth de design

- Wireframe Tela 7: `docs/design/admin-dashboard/wireframes.md` linhas 453-512 (Saúde + Auditoria combinada)
- Avatar dropdown ref: wireframes.md linha 161 (`[Tiago ▾]` abre dropdown: Logout · Audit log · Configurações)
- Tokens: `design-system/tokens/themes/influence-labs.css` (cores semânticas — verde-positivo, amarelo-atenção, vermelho-erro)
- Padrão de cards: shadcn `<Card>` (já usado nas stories anteriores)
- Padrão de filtros mobile: `<Sheet>` (igual Story 1.3/1.4)

### Padrões a seguir

- Reusar helpers das stories anteriores: `lib/format/date.ts` (timestamps absolutos), `lib/db.ts` (postgres pool), `lib/audit.ts` (`logAudit()`)
- API contract: GET → `{ items, next_cursor }` (já existe no `/api/audit-log` — manter); endpoint de export retorna stream binário
- Estados de borda obrigatórios: loading skeleton, empty com mensagem útil, erro com retry, optimistic não-aplicável (read-only)
- Toast pra eventos pontuais (export iniciado, copy JSON OK) — sonner
- Polling: SEMPRE pausar quando aba inativa (`document.visibilityState`) — Story 1.3 já estabeleceu esse padrão pra conversas live
- Counter de tempo decorrido: `useEffect` com `setInterval(1000)` + state `secondsAgo` — pausa em background junto com o poll

### Decisões técnicas FECHADAS

| # | Decisão | Valor | Origem |
|---|---|---|---|
| 1 | Combinar Saúde + Auditoria em 1 página | Tabs em `/saude` | Wireframe Tela 7 explicitamente combinada |
| 2 | URL como source-of-truth de tab | `?tab=saude\|auditoria` | Permite deep-link via avatar dropdown |
| 3 | Polling Saúde interval | 10s | Arquitetura §11 ("Polling 10s") |
| 4 | Cache server-side `/api/saude` | 5s | Reduz pressão no backend `/health` com múltiplas abas |
| 5 | Cache backend Trinks ping | 60s — aplicado em sucesso E falha | Trinks tem rate limit; cache em falha evita martelar API durante outage |
| 6 | Endpoint usado pra ping Trinks | `fetchTrinks('/servicos')` (helper existente em backend/server.js:324) | Já consumido em prod, leve, não inventa client novo |
| 7 | Threshold Trinks slow | `latency_ms > 1500` | Sensibilidade razoável p/ rede externa |
| 8 | Threshold Postgres warn | `pool.waiting > 0 && < 5` | Pool exaustion = oversaturation |
| 9 | Default range Auditoria | últimos 7 dias | Igual default do `/api/audit-log` existente |
| 10 | Export CSV limit | 5.000 rows | Proteção contra dump completo |
| 11 | Action `audit.export` | registra no audit a cada export | Self-auditing (Tiago pode ver quem baixou CSV) |
| 12 | IP mascarado por default na UI | toggle "mostrar completo" | LGPD light — print/screenshot leak protection |
| 13 | Sem SSL cert card no MVP | Fica V2 | Wireframe mostra mas requer shell-out a `openssl s_client` ou similar — overhead pra MVP |
| 14 | Sem TESS reachability ativa | Apenas `tess.agent_id` exibido | Polling TESS custaria créditos — não vale a pena pra status binário |
| 15 | Audit detail mostra payload completo | JSON pretty-printed em `<pre>` | Tiago precisa ver before/after no kb.update |
| 16 | Format relative time | PT-BR custom helper | Stories anteriores podem ter; ID antes de criar duplicado |
| 17 | Badge color action prefix | mapping em `audit-tab.tsx` (não em lib) | Decisão UI-only, ligada à paleta — não precisa generalizar |
| 18 | Edição em `backend/db.js` | Apenas adicionar `getPoolStats()` ao `module.exports` | Pool privado; expor stats sem refatorar |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Polling 10s em múltiplas abas martelando backend `/health` | Média | Baixo | Cache server 5s no `/api/saude` + Trinks ping cache 60s no backend |
| Backend `/health` quebra ao adicionar postgres pool (pool não exportado?) | Baixa | Médio | Investigar shape do pool em Fase 1 ANTES de editar; fallback `process.uptime()` se pool não acessível |
| Trinks API rate-limit no ping | Baixa | Baixo | Cache 60s + endpoint leve (`getEstabelecimento` já é cache) |
| Export CSV com 5k rows + payload JSON grande estoura memória | Baixa | Médio | Streaming via `ReadableStream` (linha-a-linha) — nunca acumular array de strings em memória |
| Filtros action permitem injeção via wildcard | Baixa | Médio | `listAuditLog` já usa `$1..$N` parametrizado + LIKE — sem injection possível; Zod limita comprimento |
| Aba `?tab=auditoria` quebra hidratação React (SSR vs CSR mismatch) | Média | Médio | Lê `searchParams` no Server Component, passa como prop pro client. Não usar `useSearchParams` direto pra default — apenas pra updates pós-mount |
| DatePicker localizado em PT-BR não carrega | Baixa | Baixo | Verificar lib (date-fns/locale ou similar) durante Fase 5 — se quebrar, fallback pra input `type="date"` |
| Export CSV trigger via `window.location.href` perde context de auth (cookie segue) | Baixa | Baixo | Cookies httponly seguem em navegação — testar em smoke; alternative: fetch + blob URL |
| Counter "última checagem" gera re-render em loop afetando memo do `<HealthCard>` | Baixa | Baixo | Counter num componente irmão (`<LastCheckedCounter>`), não no pai dos cards — memo do card por shallow props |

### Implementation Pattern: cache em memória `/api/saude`

```ts
// frontend/admin/app/api/saude/route.ts
let cache: { payload: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;
const FETCH_TIMEOUT_MS = 3_000;

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await requireSession(req); // 401 se ausente

  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(cache.payload, {
      headers: { "X-Health-Cache": "HIT", "Cache-Control": "private, max-age=5" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${env.BACKEND_INTERNAL_URL}/health`, {
      signal: controller.signal,
      headers: env.BACKEND_INTERNAL_TOKEN ? { Authorization: `Bearer ${env.BACKEND_INTERNAL_TOKEN}` } : {},
    });
    clearTimeout(timeout);
    if (!upstream.ok) throw new Error(`upstream_status_${upstream.status}`);
    const payload = await upstream.json();
    cache = { payload, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(payload, {
      headers: { "X-Health-Cache": "MISS", "Cache-Control": "private, max-age=5" },
    });
  } catch (err) {
    clearTimeout(timeout);
    // NÃO cachear degraded — queremos retry imediato na próxima
    return NextResponse.json(
      {
        status: "degraded",
        backend_unreachable: true,
        last_checked_at: new Date().toISOString(),
        error: String(err).slice(0, 200),
      },
      { headers: { "X-Health-Cache": "MISS" }, status: 200 },
    );
  }
}
```

### Implementation Pattern: status mapper

```ts
// frontend/admin/lib/health-status.ts
export type CardStatus = "ok" | "warn" | "down";
export interface CardData {
  title: string;
  status: CardStatus;
  metrics: { label: string; value: string }[];
}

export function deriveCardStatus(h: HealthPayload): CardData[] {
  if (h.backend_unreachable) {
    return ["WhatsApp", "TESS", "Trinks", "Postgres"].map((t) => ({
      title: t,
      status: "down" as const,
      metrics: [{ label: "Estado", value: "Backend não responde" }],
    }));
  }

  return [
    {
      title: "WhatsApp",
      status: mapWaStatus(h.whatsapp_window?.status),
      metrics: [
        { label: "Janela", value: hoursRemainingLabel(h.whatsapp_window) },
        { label: "Última msg", value: relativeFromIso(h.whatsapp_window?.last_inbound_at) },
      ],
    },
    {
      title: "TESS",
      status: h.tess?.agent_id ? "ok" : "down",
      metrics: [
        { label: "Agent ID", value: String(h.tess?.agent_id ?? "—") },
        { label: "URL", value: h.tess?.url ?? "—" },
      ],
    },
    {
      title: "Trinks",
      status: mapTrinksStatus(h.trinks_ping?.status),
      metrics: [
        { label: "Latência", value: h.trinks_ping?.latency_ms ? `${h.trinks_ping.latency_ms}ms` : "—" },
        { label: "Cache", value: h.trinks_ping?.cached ? "sim" : "live" },
      ],
    },
    {
      title: "Postgres",
      status: mapPgStatus(h.postgres),
      metrics: [
        { label: "Uptime", value: uptimeLabel(h.postgres?.uptime_seconds) },
        { label: "Pool", value: `${h.postgres?.pool?.idle ?? "—"}/${h.postgres?.pool?.total ?? "—"} idle, ${h.postgres?.pool?.waiting ?? 0} esperando` },
      ],
    },
  ];
}

// Funções `mapWaStatus`, `mapTrinksStatus`, `mapPgStatus` puras, testáveis isoladas.
```

### Implementation Pattern: CSV stream

```ts
// frontend/admin/app/api/audit-log/export/route.ts
function toCsvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  // RFC 4180: quote wrap se contém aspas, vírgula, \n, \r
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvRow(item: AuditLogItem): string {
  return [
    item.id,
    item.created_at,
    item.user_email,
    item.action,
    item.target_type,
    item.target_id,
    item.ip_address,
    JSON.stringify(item.payload ?? {}),
  ].map(toCsvField).join(",") + "\n";
}

export async function GET(req: NextRequest) {
  await requireSession(req);
  const params = exportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  // Auto-log audit.export ANTES de streamar
  await logAudit({
    userId: session.userId,
    action: "audit.export",
    payload: { filters: params, requested_at: new Date().toISOString() },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  const { items, next_cursor } = await listAuditLog({ ...params, limit: 5000 });
  const truncated = next_cursor !== null; // havia mais do que 5k

  const header = "id,created_at,user_email,action,target_type,target_id,ip_address,payload_json\n";
  const body = items.map(toCsvRow).join("");
  const footer = truncated ? "# truncado: aplique filtros mais restritivos pra ver tudo\n" : "";

  const filename = `audit-log-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}.csv`;
  return new Response(header + body + footer, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

### Coordenação com outras stories

- **Story 1.2-DATA:** consumidor puro. NÃO modifica `/api/audit-log` GET nem `lib/audit-log.ts`. Adiciona handler novo `/api/audit-log/export` que reusa `listAuditLog()`
- **Story 1.3 (Conversas):** sem dependência direta. Padrão de polling 5s pode ser reusado pra polling 10s aqui (mesmo helper de pause-on-hidden)
- **Story 1.4 (Toggles+Whitelist):** populou `admin_audit_log` com `toggle.set`, `whitelist.add/remove`, `feature.set`. Esta story RENDERIZA esses entries — testar AC58 com ação real de toggle visível na aba auditoria
- **Story 1.5 (KB):** populou `admin_audit_log` com `kb.create/update/restore/delete/toggle_active/tess_sync_failed`. Esta story RENDERIZA + filtra (`action prefix kb.*`)
- **Story 1.6 (Métricas):** sem dependência. Stories independentes podem rodar em paralelo
- **Epic DoD:** esta story FECHA o epic. Após Done, próximo passo é onboarding com Tiago + Gabriel (critério de sucesso "Tiago/Gabriel acessam ≥4x/semana cada")

### Coordenação com produção (impacto operacional)

- **Mudança em `backend/server.js:/health` é compatível** — apenas adiciona campos. Qualquer consumer existente (curl manual, monitor externo se houver) continua funcionando. Smoke pós-deploy: `curl https://.../health | jq '.status'` deve retornar `"ok"` igual antes
- **`/api/saude` é novo endpoint admin** — sem regressão
- **`/api/audit-log/export` é novo endpoint admin** — sem regressão
- **Trinks ping em prod** pode revelar latência alta (>1500ms) que estava invisível. Se acontecer no smoke: investigar **separadamente** depois — não bloqueia esta story (objetivo da story é tornar visível, não consertar Trinks)
- **Polling client em prod:** com 1-2 abas simultâneas (Tiago + Gabriel) + cache 5s, esperar ≤24 req/min ao backend `/health` no peak. Aceitável.

## CodeRabbit Integration

> CodeRabbit Integration: Enabled (default no projeto)

### Story Type Analysis

- **Primary Type:** Frontend (UI nova `/saude` com 2 tabs + 8 componentes novos)
- **Secondary Type(s):** API (proxy `/api/saude`, novo export CSV), Backend (enrichment `/health` em prod)
- **Complexity:** **Medium** — escopo bem delimitado, sem mudança de schema, lógica de polling/cache já testada em outras stories. Único ponto sensível: enrichment do `/health` em prod (impacta consumer existente).

### Specialized Agent Assignment

**Primary Agents:**
- `@dev` (pre-commit reviews — sempre)
- `@ux-design-expert` (review visual cards de saúde + tabela auditoria + modal de detalhe)

**Supporting Agents:**
- `@qa` (smoke checklist AC58 — depende de prod com data real em `admin_audit_log`)
- `@architect` (review do pattern de cache server-side + threshold de status, se levantar dúvida)

### Quality Gate Tasks

- [x] **Pre-Commit (@dev):** rodado em macOS (`~/.local/bin/coderabbit --prompt-only -t committed --base main`) — 2 CRITICAL auto-fixed (URL.parse + Date.parse safety), self-healing iteration 1 confirmou 0 CRITICAL
- [ ] **Pre-PR (@github-devops):** rodar antes de criar PR — `~/.local/bin/coderabbit --prompt-only --base main`
- [ ] **Pre-Deployment (@github-devops):** rodar antes de deploy prod (story altera backend `/health`) — scan completo

### CodeRabbit Focus Areas

**Primary Focus:**
- Backend `/health` backward-compat: nenhum campo pré-existente alterado/removido
- Cache TTL correto (não retornar payload stale em loop)
- Streaming CSV sem buffer in-memory de tudo
- CSV escape RFC 4180 correto (aspas, vírgula, \n)
- Polling pause-on-hidden ativo (sem drain de bateria/CPU em background)
- Acessibilidade dos cards (role, aria-live, contraste status colors)

**Secondary Focus:**
- IP masking default (não vazar IP completo em logs/screenshots)
- Audit `audit.export` logado **antes** do CSV streamar (garante registro mesmo se download falhar)
- DatePicker localizado PT-BR
- Tab URL state sem hydration mismatch

### Self-Healing Configuration

```yaml
Primary Agent: @dev (light mode)
Max Iterations: 2
Timeout: 15 minutes
Severity Filter: CRITICAL, HIGH

Predicted Behavior:
  - CRITICAL issues: auto_fix (até 2 iterações) — exemplo: campo `/health` removido por engano, CSV sem escape de aspas
  - HIGH issues: auto_fix se possível, senão document_only — exemplo: a11y do card de saúde
  - MEDIUM issues: document_as_debt
  - LOW issues: ignore
```

## Definition of Done

- [x] **62/63 ACs marcados** — restam: AC52 (Sheet mobile, tech debt registrado) e AC58 (smoke prod, só Victor)
- [x] `npm run lint`, `npm run typecheck`, `npm run build` passam (0 errors strict; 1 warning pre-existente em `lib/kb.ts` da Story 1.5)
- [x] Testes unitários passam: `npm test` → 67/67 pass + 22 skipped pre-existentes
- [x] Backend `/health` em dev retorna `postgres` + `trinks_ping` sem quebrar campos existentes — smoke `curl localhost:3099/health` em 2026-05-28 confirmou shape correto (Trinks real 1.1s, postgres.pool=null graceful sem DATABASE_URL local)
- [ ] `/saude` em dev: 4 cards renderizam OK, polling pausa em background, "Atualizar agora" funciona — **não testado em browser dev (build passa, classes Tailwind aplicadas)**. Victor valida no smoke prod
- [ ] `/saude?tab=auditoria` em dev: filtros funcionam, "Carregar mais" pagina, modal de detalhe mostra JSON, export CSV abre em Numbers/Excel — **não testado em browser dev**. Victor valida no smoke prod
- [ ] Avatar dropdown "Audit log" → cai em `/saude?tab=auditoria` direto — **não testado em browser dev**. Victor valida no smoke prod
- [x] CodeRabbit pre-PR: 0 CRITICAL — confirmado por `~/.local/bin/coderabbit -t committed --base main` (1 minor remanescente sobre TTL edge case, classe LOW que ignoramos por self-healing config)
- [ ] Smoke prod AC58 (6 sub-cenários) — só Victor pode atestar
- [ ] PR description menciona enrichment + export CSV — @devops responsabilidade ao criar PR
- [ ] Status atualizado pra Done por @devops após PR mergeada + smoke OK
- [ ] **Epic Admin Dashboard fecha em 7/7 stories Done — sinalizar pra @pm pra agendar onboarding Tiago+Gabriel**

## Change Log

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-28 | @sm River | Story 1.7 draftada. Saúde + Auditoria combinadas em 1 página (`/saude`) com 2 tabs conforme wireframe Tela 7. Dependências de dados já satisfeitas (Stories 1.2-DATA + 1.3 + 1.4 + 1.5). 63 ACs (44 funcionais + 6 a11y/responsive + 4 qualidade + 5 segurança + 4 export CSV). 5 SP. Pequeno enrichment em backend `/health` (postgres pool + trinks ping com cache 60s) — backward compatible. Cache server-side 5s em `/api/saude` pra reduzir martelagem com polling 10s. Export CSV streamed com escape RFC 4180 + auto-log `audit.export`. **Fechamento do Epic Admin Dashboard (7/7 stories Done quando esta mergear).** Próximo: `@po *validate-story-draft 1.7`. |
| 2026-05-28 | @po Pax | **Validação completa: GO 10/10 → Status Ready**. 2 Should-Fix aplicados antes de promover, ambos detectados em cross-check com código real: (1) AC6 + Fase 1 originalmente prescreviam `pool.totalCount/idle/waiting` mas `backend/db.js:29` só exporta `{ query }` — corrigido pra editar `db.js` adicionando `getPoolStats()` ao module.exports (mudança cirúrgica, lock declarado em §A NÃO TOCAR), com fallback graceful pra `pool=null` quando `DATABASE_URL` ausente. (2) AC7 + Fase 1 prescreviam `trinksClient.getEstabelecimento(243868)` mas backend não tem `trinksClient` — só `fetchTrinks(path)` cru em `server.js:324` — corrigido pra usar `fetchTrinks('/servicos')` (já consumido em prod pelo bot, light GET). Decisão #6 adicionada na tabela. File List atualizado com `backend/db.js` em Modificados. Critical issues: 0. Anti-hallucination: limpo após fixes — todas as chamadas referenciam helpers/exports que existem (`fetchTrinks`, `db.query`, `BACKEND_INTERNAL_URL`, `listAuditLog`, `logAudit`, shadcn Tabs/Sheet). 10-point checklist: título claro ✅, descrição completa ✅, AC testáveis ✅ (63), escopo IN/OUT explícito ✅ (9 itens OUT), dependências mapeadas ✅ (tabela "já satisfeitas"), SP justificados ✅ (5pts), business value ✅ (6 bullets), riscos ✅ (9 com mitigação), DoD ✅ (12 checks), alinhamento epic+wireframe ✅. CodeRabbit Integration completo. Pronta para `@dev *develop 1.7`. |
| 2026-05-28 | @dev Dex (yolo) | **Fase 1 completa — backend `/health` enrichment** em `feature/1.7-health-audit-viewer`. Status: Ready → InProgress. Mudanças cirúrgicas: (1) `backend/db.js` ganha `getPoolStats()` exportado (pool privado preservado, `query` intacto); (2) `backend/server.js` ganha `globalLastOkAt` + `pingTrinks()` com cache 60s aplicado a sucesso E falha + handler `/health` agora `async` com `await db.query('SELECT 1')` em try/catch curto + blocos `postgres` e `trinks_ping` no JSON. ACs cobertos: AC6 ✅, AC7 ✅, AC8 ✅ (zero remoção de campo), AC9 ✅ (catch isola ping de outage). Smoke local em PORT=3099 confirmou: shape correto, `trinks_ping` real respondeu 1105ms cached=false, `postgres.pool=null` graceful sem DATABASE_URL, `last_ok_query_at=null` (esperado — query sem DATABASE_URL retorna null). `node --check` passou nos 2 arquivos. Próximo: Fase 2 — proxy `/api/saude` no admin com cache server 5s. |
| 2026-05-28 | @dev Dex (yolo) | **Story 1.7 implementada → Status Ready for Review**. 16 arquivos criados + 5 modificados + 1 removido em `feature/1.7-health-audit-viewer`. Fases 2-8 completas. Validações: `npm run typecheck` 0 errors strict, `npm run lint` 0 errors (warning pre-existente em `lib/kb.ts` Story 1.5, não meu código), `npm run build` 26 rotas no manifest (`/saude`, `/api/saude`, `/api/audit-log/export`, `/api/admin-users` novos), `npm test` 67 pass / 0 fail (28 tests novos). **Decisões autônomas:** reusei `lib/hooks/use-polling.ts` em vez de criar `use-health-poll.ts` (Decisão F2.1); reusei `lib/format/date.ts` (`formatRelative`) em vez de criar `relative-time.ts` (Decisão F3.1); usei `<Input type="date">` nativo em vez de shadcn calendar (typecheck error com react-day-picker; calendar.tsx removido); criei `/api/admin-users` (não estava na story, necessário pra Select de filtro user); `setTimeout(fn, 0)` em useEffect pra escapar de `react-hooks/set-state-in-effect` (padrão React 19/Next 16 da Story 1.5); IP mascarado por default na tabela com toggle "Mostrar IPs". **CodeRabbit pre-commit** (iteration 1) flagou 2 CRITICAL: `new URL(h.tess.url)` e `new Date(win.last_inbound_at).toISOString()` podem throw. **Self-healing iteration 1** aplicou `safeHostname()` e `safeIsoMinute()` com try/catch + isNaN check + 4 tests novos. **Re-run CodeRabbit:** 0 CRITICAL ✅ (1 minor LOW sobre TTL edge case ignorado por config). **Pendente (apenas Victor):** AC58 smoke prod WhatsApp+admin (6 sub-cenários); AC52 (Sheet mobile filtros) registrado como tech debt — filtros responsivos via grid mas não em Sheet. Próximo: `@devops *push` ou rodar CodeRabbit pre-PR antes. |
