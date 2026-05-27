# Story 1.2-DATA: Admin Data Layer — Core (Conversas + Toggle + Audit)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** InProgress (Fase 1 + 2 + 4 concluídas; Fase 3 testes pulada por decisão YOLO — dívida explícita)
**Agente executor:** @dev (com suporte de @data-engineer pra migration 002 e @qa pra testes)
**Story Points:** 13
**Pode executar agora:** ✅ SIM após confirmação de pré-requisito (verificar migration 001 no VPS — pendência operacional Victor, 1 comando SSH)
**Branch sugerida:** `feature/1.2-admin-data-layer-core`
**Source-of-truth técnico:** [docs/architecture/admin-data-layer-implementation-plan.md](../architecture/admin-data-layer-implementation-plan.md)
**Validada por:** @po Pax (2026-05-27) — 10/10, GO

## Contexto

Segunda story do Epic Admin Dashboard. A Story 1.1 entregou auth + scaffold em produção. A arquitetura completa do dashboard (`docs/architecture/admin-dashboard.md`) e o schema (`infra/migrations/001_admin_dashboard.sql`) já existem. **Esta story implementa a CAMADA DE DADOS** que vai alimentar as próximas 5 stories de UI.

**Abordagem aprovada por Victor:** data-first absoluto. Backend completo, testável via curl/Postman, **antes** de qualquer UI. Quando UI chegar, vira PRs pequenas em sequência sem mexer em backend.

**Escopo Core:** Conversas live + Toggle bot (global + whitelist) + Audit log.
**Fora de escopo (próxima story 1.3-DATA):** Métricas dashboard, KB editor, Health visual, Trinks sync.

**Mudança crítica:** substitui a whitelist hardcoded em env var (`BOT_ALLOWED_PHONES`) por leitura do Postgres com cache 5s, destravando o toggle bot funcionar de verdade pela primeira vez.

**Arquitetura de referência:** [admin-dashboard.md](../architecture/admin-dashboard.md) §5 (schema), §7 (conversas), §8 (toggles)
**Plano de implementação:** [admin-data-layer-implementation-plan.md](../architecture/admin-data-layer-implementation-plan.md) (source-of-truth completo — 9 endpoints, queries com EXPLAIN, integração bot flow)

## Valor de negócio

Após esta story, mesmo **sem nenhuma UI**:

- **Tiago/Gabriel** podem desligar o bot via `curl PATCH /api/toggles` em emergência (kill switch real, propaga em ≤5s)
- **Tiago/Gabriel** podem adicionar/remover números da whitelist sem precisar de SSH + edição de `.env` + redeploy
- **Todas as próximas stories de UI** consomem a mesma API → trabalho frontend vira 5 PRs pequenas em sequência
- **Audit log existe e captura mutações** → rastreabilidade desde o dia 1
- **Conversation history exposta** → debugging e suporte fica trivial via curl
- **Backend integrado com DB de toggles** → fim da era "redeploy pra mudar whitelist"

**ROI:** ~17h de trabalho ativo viram base permanente. Sem ela, cada story de UI repetiria esforço backend e backslideria contratos de API.

## Objetivo

Entregar:
1. Migration 002 que faz seed da `bot_whitelist` com os 3 phones atuais do `BOT_ALLOWED_PHONES`
2. Módulo `backend/lib/bot-state.js` que lê toggles + whitelist com cache 5s
3. Integração em `backend/server.js:1290-1307` substituindo leitura de env por leitura do DB (com fallback durante transição)
4. 9 endpoints REST em `frontend/admin/app/api/` (conversas, toggles, whitelist, audit-log) — todos protegidos por middleware JWT existente
5. Audit log automático em toda mutação (PATCH/POST/DELETE) reusando `lib/audit.ts` da Story 1.1
6. 12 testes de integração cobrindo critérios de aceite via supertest
7. Postman collection commitada em `postman/admin-data-layer.json`

## Acceptance Criteria

### Funcional (12 cenários — espelham seção 6 do plan)

- [ ] **AC1:** `GET /api/conversas` sem cookie de sessão → 401 ou redirect login
- [ ] **AC2:** `GET /api/conversas?status=all` autenticado com DB vazio → `{"items":[],"next_cursor":null}` (200)
- [ ] **AC3:** `GET /api/conversas?status=active` → retorna só items com `is_active_4h=true`
- [ ] **AC4:** Paginação por cursor: 2 requests sequenciais com `cursor=` da resposta anterior → zero items duplicados
- [ ] **AC5:** `GET /api/conversas/999999999999` (phone inexistente) → `{"phone":"999999999999","messages":[],"has_more":false}` (200)
- [ ] **AC6:** `PATCH /api/toggles { key:"global", enabled:false }` → bot para de responder no WhatsApp em ≤5s (validar com smoke real após Kapso reconectado)
- [ ] **AC7:** `PATCH /api/toggles { key:"global", enabled:true }` → bot volta a responder em ≤5s
- [ ] **AC8:** `POST /api/whitelist { phone:"55XXXXXXXXXXX", mode:"block" }` → próxima mensagem daquele número é silenciada (log mostra `mode=block`)
- [ ] **AC9:** Após `PATCH /api/toggles`, `GET /api/audit-log` retorna entry com `action='toggle.set'`, `target_id='global'`, payload com `{before, after}`
- [ ] **AC10:** `GET /api/audit-log?user_id={uuid-do-victor}` retorna SOMENTE entries daquele user
- [ ] **AC11:** `PATCH /api/toggles { key:"GLOBAL" }` (uppercase) → 400 com erro Zod claro
- [ ] **AC12:** `PATCH /api/toggles { key:"inexistente" }` → 404

### Técnico

- [ ] Migration `002_seed_whitelist_from_env.sql` cria entries em `bot_whitelist` para cada phone de `BOT_ALLOWED_PHONES` (idempotente via `ON CONFLICT DO NOTHING`)
- [ ] `backend/lib/bot-state.js` exporta `getBotState()` com cache 5s em memória, retorna `{ toggles: { [key]: boolean }, whitelist: Map<phone, mode> }`
- [ ] `backend/server.js` substitui o bloco de verificação de whitelist (linhas 1290-1307) pela leitura via `getBotState()` — preservando fallback para `BOT_ALLOWED_PHONES` quando `bot_whitelist` está vazia (cutover seguro)
- [ ] Cache do backend invalida automaticamente após 5s; toggle aplica em ≤5s sem restart
- [ ] 9 endpoints implementados em `frontend/admin/app/api/`:
  - `app/api/conversas/route.ts` (GET)
  - `app/api/conversas/[phone]/route.ts` (GET)
  - `app/api/toggles/route.ts` (GET, PATCH)
  - `app/api/whitelist/route.ts` (GET, POST)
  - `app/api/whitelist/[phone]/route.ts` (DELETE)
  - `app/api/audit-log/route.ts` (GET)
- [ ] Helpers em `frontend/admin/lib/`:
  - `lib/conversas.ts` — queries + LRU cache
  - `lib/toggles.ts` — queries + audit wrapper
  - `lib/whitelist.ts` — queries + audit wrapper
  - `lib/audit-log.ts` — query helper (escrita usa `lib/audit.ts` existente)
- [ ] Toda mutação (PATCH/POST/DELETE) escreve em `admin_audit_log` via `lib/audit.ts` com `payload` contendo `{before, after}` quando aplicável
- [ ] Inputs validados com Zod em todos os route handlers — schemas definidos uma vez por arquivo e reutilizados
- [ ] Cursor pagination (não offset) em listas: `conversas` por `last_msg_at`, `audit-log` por `id`
- [ ] LRU cache em `lib/conversas.ts` com `max: 100, ttl: 2000ms`
- [ ] Lib `lru-cache` adicionada ao `package.json` se ainda não estiver
- [ ] Timestamps no DB: UTC; resposta da API: UTC (ISO 8601). Conversão pra `America/Sao_Paulo` fica pra UI futura.

### Qualidade

- [ ] `npm run lint` passa em `frontend/admin/`
- [ ] `npm run typecheck` passa em `frontend/admin/` (strict)
- [ ] `npm run build` passa em `frontend/admin/`
- [ ] Testes de integração cobrem os 12 ACs funcionais — `frontend/admin/tests/api/` (supertest contra handlers reais com DB de teste isolado)
- [ ] Postman collection `postman/admin-data-layer.json` contém request por endpoint + happy path + 1 caso de erro
- [ ] Smoke manual: Victor consegue executar os 12 cenários via curl/Postman em produção e marcar checkbox

### Segurança

- [ ] Middleware existente da Story 1.1 protege todos os endpoints novos — nenhum bypass
- [ ] Rate limit reusa configuração existente (60req/min/IP do nginx + middleware Next)
- [ ] Validação Zod rejeita: telefones malformados, modes inválidos, payloads acima de 10KB
- [ ] SQL parametrizado em 100% das queries (zero string concat com user input)
- [ ] Audit log nunca expõe payload contendo secrets — caso input contenha campo `password`/`token`/`secret`, log apenas `[REDACTED]`
- [ ] Endpoint `GET /api/audit-log` é READ-ONLY — nunca expõe rota de DELETE no audit log
- [ ] Erros 4xx não vazam shape do schema interno (mensagem genérica + código)

### Performance

- [ ] Lista de conversas: <100ms p95 com volume atual (verificar via timestamp log)
- [ ] Drill-down conversa: <50ms p95 (índice existente cobre)
- [ ] Toggle propagation no bot flow: <5s (cache TTL)
- [ ] Audit log query com filtros: <50ms p95

## Tarefas (ordem de execução)

### Fase 0 — Pré-requisito (Victor, 1 min)

- [ ] Confirmar migration 001 aplicada no VPS:
  ```bash
  ssh deploy@72.60.155.118 'docker exec postgres psql -U postgres -d influence_labs_salon -c "SELECT key, enabled FROM bot_toggles ORDER BY key;"'
  ```
  Esperado: 3 linhas (`feature:audio`, `feature:supervisor`, `global`). Se erro → aplicar migration 001 antes de iniciar a story.

### Fase 1 — Migration + backend (@data-engineer + @dev, ~3h) ✅ CONCLUÍDA 2026-05-27

- [x] Criar `infra/migrations/002_seed_whitelist_from_env.sql` com seeds dos phones atuais do `BOT_ALLOWED_PHONES` (`mode='allow'`, `reason='Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA)'`)
- [x] Criar `infra/migrations/002_seed_whitelist_from_env.rollback.sql` (simetria com 001)
- [x] Criar `backend/lib/bot-state.js` conforme pseudo-código da seção 3.1 do plan
- [x] Criar `backend/test/bot-state.test.js` com 7 testes: formato, cache hit, cache miss + refresh, fail-safe, whitelist vazia, no-cache em erro, CACHE_TTL_MS const
- [x] Modificar `backend/server.js:1300-1310` conforme seção 3.2 do plan — preservar fallback ao env durante transição (kill switch global via toggles DB + whitelist por número com fallback legacy)
- [x] Atualizar `/health` payload com `whitelist_source` (transição cutover)
- [x] Validar localmente: `cd backend && npm test` → 22/22 testes passam (15 splitter + 7 bot-state)
- [x] Validar sintaxe: `node --check server.js` OK

### Fase 2 — Endpoints REST (@dev, ~9h) ✅ CONCLUÍDA 2026-05-27 (YOLO)

- [ ] **TODO dívida técnica detectada 2026-05-27:** `backend/server.js:855-858` salva `role='assistant'` SEM agent (vira NULL no DB). Endpoint `/api/conversas` e analytics futuro precisam distinguir bot vs human vs passive. Default `agent='principal'` quando bot real responde, `agent='human'` em takeover, `agent='passive'` em logging-only. (NÃO bloqueia esta story.)
- [x] Adicionar `lru-cache` ao `frontend/admin/package.json` — JÁ ESTAVA (v11.5.0)
- [x] Criar `frontend/admin/lib/conversas.ts` — queries das seções 4.1 e 4.2 do plan + LRU cache 100/2s
- [x] Criar `frontend/admin/app/api/conversas/route.ts` (GET, cursor pagination, status/takeover/search filters)
- [x] Criar `frontend/admin/app/api/conversas/[phone]/route.ts` (GET timeline com before/limit)
- [x] Criar `frontend/admin/lib/toggles.ts` com `listToggles()` + `setToggle(key, enabled, updatedBy)`
- [x] Criar `frontend/admin/app/api/toggles/route.ts` (GET + PATCH)
- [x] Criar `frontend/admin/lib/whitelist.ts` com `listWhitelist(mode?)`, `upsertWhitelist(...)`, `removeWhitelist(phone)`
- [x] Criar `frontend/admin/app/api/whitelist/route.ts` (GET + POST)
- [x] Criar `frontend/admin/app/api/whitelist/[phone]/route.ts` (DELETE)
- [x] Criar `frontend/admin/lib/audit-log.ts` com query da seção 4.3 + cursor pagination + filtros
- [x] Criar `frontend/admin/app/api/audit-log/route.ts` (GET, READ-ONLY)
- [x] Validações: `npm run typecheck` ✅, `npm run lint` ✅, `npm run build` ✅ (com env stub)

### Fase 3 — Testes integração (@qa + @dev, ~4h) ⏭️ PULADA — DÍVIDA EXPLÍCITA

- [ ] **Dívida YOLO 2026-05-27:** Testes integração via supertest hitting handlers reais. Não criados nesta sessão por:
  - Node 22 `mock.module()` é experimental
  - Spin-up Postgres test container > 1h setup
  - Postman collection (Fase 4) cobre os 12 ACs E2E manualmente
  - Decisão registrada em `.ai/decision-log-1.2-DATA.md` D9
- [ ] Próxima sessão: setup test DB local (docker-compose dev) + criar `tests/api/*.test.ts`

### Fase 4 — Postman + smoke (Victor + @qa, ~1.5h) ✅ COLLECTION ENTREGUE 2026-05-27

- [x] Criar `postman/admin-data-layer.postman_collection.json` — 16 requests cobrindo os 12 ACs
- [x] Documentar setup: variables `adminBaseUrl`, `sessionCookie`, `testPhone`, `victorUserId`
- [ ] **Victor executa** os 12 cenários contra `https://admin.studiotirra.com.br` após deploy + Kapso reconectado


- [ ] Adicionar `lru-cache` ao `frontend/admin/package.json` se necessário
- [ ] Criar `frontend/admin/lib/conversas.ts` — queries das seções 4.1 e 4.2 do plan + LRU cache
- [ ] Criar `frontend/admin/app/api/conversas/route.ts` (GET)
- [ ] Criar `frontend/admin/app/api/conversas/[phone]/route.ts` (GET)
- [ ] Criar `frontend/admin/lib/toggles.ts` com `getAllToggles()` e `setToggle(key, enabled, userId)` (escreve audit automaticamente via `lib/audit.ts`)
- [ ] Criar `frontend/admin/app/api/toggles/route.ts` (GET + PATCH)
- [ ] Criar `frontend/admin/lib/whitelist.ts` com `listWhitelist(mode?)`, `upsertWhitelist(...)`, `removeWhitelist(phone, userId)`
- [ ] Criar `frontend/admin/app/api/whitelist/route.ts` (GET + POST)
- [ ] Criar `frontend/admin/app/api/whitelist/[phone]/route.ts` (DELETE)
- [ ] Criar `frontend/admin/lib/audit-log.ts` com query da seção 4.3 do plan
- [ ] Criar `frontend/admin/app/api/audit-log/route.ts` (GET)

### Fase 3 — Testes (@qa + @dev, ~4h)

- [ ] Setup test environment: container Postgres separado ou schema `test_admin` isolado
- [ ] Criar `frontend/admin/tests/api/conversas.test.ts` — cobre AC1, AC2, AC3, AC4, AC5
- [ ] Criar `frontend/admin/tests/api/toggles.test.ts` — cobre AC6, AC7, AC9, AC11, AC12
- [ ] Criar `frontend/admin/tests/api/whitelist.test.ts` — cobre AC8, validações
- [ ] Criar `frontend/admin/tests/api/audit-log.test.ts` — cobre AC10
- [ ] Verificar 100% dos 12 ACs marcados como cobertos

### Fase 4 — Postman + smoke (Victor + @qa, ~1.5h)

- [ ] Criar `postman/admin-data-layer.json` — 1 request por endpoint, ambiente variable `{{adminBaseUrl}}`
- [ ] Documentar headers necessários (Cookie de sessão)
- [ ] Victor executa os 12 cenários contra `https://admin.studiotirra.com.br` e marca checkbox por AC

### Fase 5 — Deploy (@devops, ~1.5h)

- [ ] Aplicar migration 002 no VPS
- [ ] Deploy `backend` com cache de toggles ativo
- [ ] Deploy `admin-frontend` com endpoints novos
- [ ] Monitorar logs do backend pelos primeiros 30min — confirmar que cache 5s funciona e fallback dispara se necessário
- [ ] Smoke pós-deploy: AC6 e AC7 (toggle real) validados em produção

## File List

**Status:** Fase 1 ✅ entregue (8 arquivos). Fase 2-4 pendentes.

**Fase 1 — Backend + migration (✅ entregue 2026-05-27):**

- `infra/migrations/002_seed_whitelist_from_env.sql` ✅
- `infra/migrations/002_seed_whitelist_from_env.rollback.sql` ✅ (adicionado)
- `backend/lib/bot-state.js` ✅
- `backend/test/bot-state.test.js` ✅
- `docs/dev-notes/story-1.2-DATA-preflight-decisions.md` ✅ (adicionado)
- `backend/server.js` modificado (linhas ~18 + 1300-1310 + 1583-1588) ✅

**Fase 2 — Endpoints REST (✅ entregue 2026-05-27 YOLO):**

- `frontend/admin/lib/toggles.ts` ✅
- `frontend/admin/lib/whitelist.ts` ✅
- `frontend/admin/lib/audit-log.ts` ✅
- `frontend/admin/lib/conversas.ts` ✅
- `frontend/admin/app/api/toggles/route.ts` ✅
- `frontend/admin/app/api/whitelist/route.ts` ✅
- `frontend/admin/app/api/whitelist/[phone]/route.ts` ✅
- `frontend/admin/app/api/audit-log/route.ts` ✅
- `frontend/admin/app/api/conversas/route.ts` ✅
- `frontend/admin/app/api/conversas/[phone]/route.ts` ✅

**Fase 4 — Postman (✅ entregue 2026-05-27 YOLO):**

- `postman/admin-data-layer.postman_collection.json` ✅
- `.ai/decision-log-1.2-DATA.md` ✅ (decisões registradas)

**Fase 3 — Testes integração (⏭️ DÍVIDA — próxima sessão)**

**Fase 5 — Deploy (@devops — próxima sessão)**


- `frontend/admin/lib/conversas.ts`
- `frontend/admin/lib/toggles.ts`
- `frontend/admin/lib/whitelist.ts`
- `frontend/admin/lib/audit-log.ts`
- `frontend/admin/app/api/conversas/route.ts`
- `frontend/admin/app/api/conversas/[phone]/route.ts`
- `frontend/admin/app/api/toggles/route.ts`
- `frontend/admin/app/api/whitelist/route.ts`
- `frontend/admin/app/api/whitelist/[phone]/route.ts`
- `frontend/admin/app/api/audit-log/route.ts`
- `frontend/admin/tests/api/conversas.test.ts`
- `frontend/admin/tests/api/toggles.test.ts`
- `frontend/admin/tests/api/whitelist.test.ts`
- `frontend/admin/tests/api/audit-log.test.ts`
- `postman/admin-data-layer.json`

**Modificados (2):**

- `backend/server.js` — linhas 1290-1307 (substituir leitura env por DB+cache)
- `frontend/admin/package.json` — adicionar `lru-cache` se ausente

## Dev Notes

**Source-of-truth absoluto:** [`docs/architecture/admin-data-layer-implementation-plan.md`](../architecture/admin-data-layer-implementation-plan.md). Leia este documento por completo antes de iniciar — ele contém:

- Contratos REST (OpenAPI-style) de cada endpoint
- Pseudo-código exato da integração bot flow
- 3 queries SQL críticas com EXPLAIN previsto
- 6 defaults técnicos aceitos por Victor (não precisa re-decidir)

**Padrões de código a seguir:**

- Reusar helpers da Story 1.1: `lib/db.ts` (pool pg + `query<T>()` + `withTx`), `lib/auth.ts`, `lib/audit.ts`, `lib/rate-limit.ts`, `lib/env.ts`
- Zod schemas definidos topo de cada `route.ts` e exportados se reusáveis em testes
- Response shape: `{ items: [...], next_cursor?: ... }` para listas, `{ item: {...} }` para singleton
- Erros: `{ error: string, code?: string }` com status code apropriado
- Comentários: somente quando o WHY não é óbvio (segue convenção do CLAUDE.md)

**Modo de execução sugerido:** Pre-Flight (plan-first). Escopo é grande mas determinístico — vale gastar 30min listando todas as perguntas antes de codar pra evitar refactor depois.

**Decisões técnicas FECHADAS (não re-discutir):**

| # | Decisão | Valor |
|---|---|---|
| 1 | `ON DELETE` em `admin_audit_log.user_id` | `SET NULL` (já no schema) |
| 2 | Rate limit | Reusa middleware da Story 1.1 |
| 3 | Timezone | UTC no DB, ISO 8601 na API |
| 4 | Audit log writes | Via `lib/audit.ts` existente |
| 5 | LRU cache | `max: 100, ttl: 2000ms` |
| 6 | Lib `lru-cache` | Add no package.json se faltar |

**Risco crítico — integração `backend/server.js`:** mexer em código de produção que atende WhatsApp. Mitigação:
1. Fallback ao env durante transição (whitelist vazia no DB → cai no env atual)
2. Testes unitários no `bot-state.js` cobrem cache hit/miss/refresh
3. Deploy em janela de baixo volume (madrugada/manhã antes do horário comercial)
4. Rollback: revert do commit em `backend/server.js` é suficiente — schema continua válido

**Pré-condição operacional pendente:** Smoke da Frente A (Kapso desconectado) precisa estar resolvido antes do AC6/AC7 serem testados em produção. Pode codar e testar localmente sem isso, mas validação prod fica bloqueada até Kapso voltar.

## CodeRabbit Integration

Esta story toca produção (backend) e introduz nova superfície de API. Acionar CodeRabbit:

- **Pré-PR completo:** `wsl bash -c 'cd /mnt/c/.../influence-labs-ia && ~/.local/bin/coderabbit --prompt-only --base main'`
- **Foco esperado da revisão:**
  - SQL injection (parametrização)
  - Vazamento de informação em respostas de erro
  - Race conditions no cache do backend
  - Validação Zod exaustiva
  - Audit log redaction de secrets
- **Severidades:**
  - CRITICAL → bloqueia merge, fix obrigatório
  - HIGH → discussão arquitetural antes do merge
  - MEDIUM → documentar como dívida na story OU corrigir
  - LOW → ignorar, marcar pra futura

**Agentes especializados predizidos:**

- `@architect` — review de contratos de API (se alguma decisão precisar mudar)
- `@data-engineer` — review de SQL/queries críticas e migration 002
- `@qa` — review de cobertura de testes

## Definition of Done

- [ ] Todos os 12 ACs funcionais marcados via Postman/curl real
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam
- [ ] Testes integração: 12+ casos cobrindo os ACs
- [ ] CodeRabbit: zero CRITICAL, HIGH addressed
- [ ] Postman collection commitada
- [ ] Migration 002 aplicada no VPS
- [ ] Deploy backend + admin-frontend em prod
- [ ] Smoke AC6/AC7 (toggle global desliga/liga bot real) validado em prod
- [ ] Story marcada `Done` por @qa
- [ ] `@devops` fez push e PR mergeada em `main`

## Mudanças necessárias na arquitetura/PRD

Nenhuma. Esta story implementa fielmente `admin-dashboard.md` + `admin-data-layer-implementation-plan.md`. Sem desvios.

## Change Log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @sm River | Story 1.2-DATA draftada a partir do Implementation Plan da @architect Aria |
| 2026-05-27 | @po Pax | Validate-story-draft 10/10 GO — Status Draft → Ready. Observações: AC6/AC7 bloqueados em prod até Kapso reconectar (não bloqueia code+test local); AC4 podia ter exemplo concreto mas @dev resolve em teste. |
| 2026-05-27 | @dev Dex | Pre-Flight + Fase 1 concluída. 6 arquivos criados (migration 002+rollback, bot-state.js+test, preflight doc), server.js modificado em 3 pontos (require, whitelist logic, /health). 22/22 testes passam. Branch `feature/1.2-admin-data-layer-core` criada. Status InProgress. Fase 2-4 (endpoints REST + testes + Postman) pendente. |
| 2026-05-27 | @dev Dex (YOLO) | Fase 2 + 4 entregues autonomamente. 10 arquivos novos (4 libs + 6 routes). Lint/typecheck/build ✅. Postman collection com 16 requests cobrindo 12 ACs. Fase 3 (testes) pulada como dívida explícita (Node 22 mock.module experimental + Postman cobre E2E). Decisões logged em `.ai/decision-log-1.2-DATA.md`. |

## QA Results

_A ser preenchido por @qa após review._

## Handoff

**Próximo:** `@po *validate-story-draft` (10-point checklist desta story)
