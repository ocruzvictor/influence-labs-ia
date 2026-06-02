# Story: Trinks Resiliência — Fim do 429 (cache + limiter + retry)

**Tipo:** Brownfield performance/resilience fix (bot WhatsApp Studio Tirra — backend)
**Status:** ✅ Approved (GO, @po 2026-06-02) — auto-validada em YOLO mode (autorizado por Victor)
**Agente executor:** @dev (quality gate @architect — decisão de arquitetura já registrada)
**Story Points:** 5
**Branch:** `feature/bot-46589-ajustes-resposta` (mesma branch da frente do bot; Fase A ship primeiro)
**Origem:** Fase 0 da story `salon-whatsapp-bot-46589-ajustes-resposta` (Decisão 1 do gate @architect). Ship ANTES dos itens 2/3 porque destrava operação confiável + o probe `/servicos`.

**Source-of-truth técnico:**
- [backend/server.js](../../backend/server.js): `fetchTrinks()` (:324), `getSlots(date)` (:374), `getProfessionals()` (:391), `getServicesText()` (:406), `pingTrinks()` (:343 — já tem cache TTL 60s, **padrão a reusar**), `processMessage` Promise.allSettled (:853 — a rajada de 7 chamadas), bloco 4a/4b/4c de booking (invalidação de cache de slots).

## Contexto / Causa Raiz

Em prod (logs `2026-06-02T05:43Z` e `17:35Z`), conversas reais pegaram o bot **degradado**: TODAS as chamadas Trinks 429-aram no mesmo milissegundo. **Causa:** cada mensagem dispara **7 chamadas Trinks concorrentes** (`getNextBusinessDays(5)` slots + `getProfessionals` + `getServicesText`), **sem cache** (só `pingTrinks` cacheia) e **sem retry**. A rajada estoura o rate-limit da Trinks.

## Decisão de Arquitetura (aprovada, gate @architect 2026-06-02)
Tirar a Trinks do caminho de resposta em tempo-real: cache + limiter + retry. In-process (instância única; padrão `trinksPingCache` já existe). Sem Redis.

## Escopo

### IN
- **Cache de serviços + profissionais** (quase estáticos) — TTL longo (15–30min). Mesma resposta p/ todos os clientes.
- **Cache de slots por data** — TTL curto (30–60s). Colapsa as 5 chamadas/dia entre turnos e clientes concorrentes.
- **Invalidação de cache de slots** após booking create/cancel/reschedule na data afetada (correção: não oferecer slot recém-tomado).
- **Limiter global de concorrência Trinks** (~3 simultâneas) — serializa rajadas.
- **Retry com Retry-After/backoff em 429** dentro de `fetchTrinks` (cap ~3 tentativas).
- Logging das métricas de cache (hit/miss) e de 429/retry.

### OUT
- Persistência de cache (Redis/DB) — in-process basta (1 instância).
- Mudança no contrato do contexto dinâmico (texto idêntico ao atual).
- Itens 1/2/3/5 da story do bot (frentes separadas).

## Acceptance Criteria

- [ ] **AC1:** `getServicesText()` e `getProfessionals()` servem de cache in-process com TTL configurável (default 20min). Cache miss → 1 chamada Trinks; hits subsequentes → 0 chamadas até expirar.
- [ ] **AC2:** `getSlots(date)` cacheia por data com TTL curto (default 45s). Chamadas concorrentes pra mesma data **coalescem** (não disparam N fetches simultâneos do mesmo dado — in-flight dedup) OU no mínimo servem do cache após o 1º retorno.
- [ ] **AC3:** Após `BOOKING_CREATE`/`CANCEL`/`RESCHEDULE` numa data, o cache de slots daquela data é invalidado (próxima leitura busca fresco).
- [ ] **AC4:** `fetchTrinks()` aplica limiter global de concorrência (default 3) — nunca mais de N chamadas Trinks simultâneas no processo.
- [ ] **AC5:** Em 429, `fetchTrinks()` faz retry respeitando `Retry-After` (fallback backoff exponencial 1s→cap), até 3 tentativas, antes de lançar. Sucesso após retry é transparente ao caller.
- [ ] **AC6:** Comportamento de erro preservado: se Trinks falha de vez (após retries), os callers degradam como hoje ("Erro ao consultar" / fallback) — sem quebrar o fluxo.
- [ ] **AC7:** TTLs e limites configuráveis via env (defaults sãos). Documentado.
- [ ] **AC8:** Testes unitários (mock de fetch): cache hit/miss/expiração, invalidação pós-booking, limiter (concorrência ≤ N), retry em 429 (respeita Retry-After, desiste após N). `cd backend && npm test` verde.
- [ ] **AC9:** Smoke prod (deploy branch): após o fix, uma conversa real (ou dryRun equivalente) NÃO gera rajada de 429; `/health` `trinks_ping` volta a `ok`. Validar redução de chamadas via log de cache hit.
- [ ] **AC10:** Sem regressão: contexto dinâmico injetado é idêntico (mesmo texto de slots/serviços/profissionais).

## Dev Notes
- **Reusar o padrão `trinksPingCache`** (server.js:342): `{ payload, expiresAt }` + checagem `Date.now() < expiresAt`. Generalizar num helper de cache TTL (chave→{value,expiresAt}).
- **Limiter:** semáforo simples (contador + fila de promessas) em volta de `fetchTrinks`; sem dep externa (manter "boring").
- **In-flight dedup (AC2):** Map de promessas em andamento por chave (slots:{date}); concorrentes aguardam a mesma promise.
- **Invalidação (AC3):** os blocos 4a/4b/4c já têm a data do booking (`bookingData.date`, `bookingCancel.date`, etc.) — chamar `invalidateSlots(date)` após sucesso Trinks.
- **Retry (AC5):** mesmo espírito do backfill worker da Story 1.6 (memória: Retry-After + exp 2s→30s). Aqui cap menor (resposta de chat tem orçamento ~25s do TESS).
- **Deploy:** branch → VPS `ssh deploy@72.60.155.118`, `cd infra && docker compose up -d --build backend` → `docker compose restart nginx`. Testar de dentro do container (`wget localhost:3001/health`).

## Tasks
1. [ ] Helper de cache TTL genérico + limiter + retry em `fetchTrinks`.
2. [ ] Aplicar cache em getServicesText/getProfessionals (longo) e getSlots (curto + dedup).
3. [ ] Invalidação de slots pós-booking (4a/4b/4c).
4. [ ] Env config + logging de métricas.
5. [ ] Testes unitários (AC8).
6. [ ] Deploy branch + smoke (AC9).

## Dev Agent Record

### Completion Notes (2026-06-02, @dev, YOLO)
- **Lógica extraída p/ `lib/trinks-cache.js`** (`createTrinksCache`, fetch/sleep/now injetáveis) — NÃO confundir com `lib/trinks-client.js` (worker da Story 1.6, processo separado, intocado).
- **Limiter de concorrência** (semáforo, default 3) em volta de toda chamada Trinks; libera o slot ANTES do backoff.
- **Retry em 429** respeitando `Retry-After` (fallback backoff exp 1s→cap 8s), default 2 retries. `pingTrinks` usa `retries:0` (health não mascara 429).
- **Cache TTL + in-flight dedup**: serviços/profissionais TTL 20min, slots TTL 45s. Chamadas concorrentes à mesma chave coalescem (1 fetch).
- **Invalidação (AC3)**: `invalidateTrinksCache(slotsCacheKey(date))` após create (data nova), cancel (data), reschedule (data antiga + nova).
- **Observabilidade**: `/health.trinks_cache` expõe hits/misses/retries/cached_keys/concurrency_active.
- **Config via env**: `TRINKS_MAX_CONCURRENCY`, `TRINKS_MAX_RETRIES`, `TRINKS_SERVICES_TTL_S`, `TRINKS_PROFS_TTL_S`, `TRINKS_SLOTS_TTL_S` (defaults sãos).
- **Testes**: `test/trinks-cache.test.js` — 10 casos (hit/miss/expiração/dedup/invalidate/limiter≤N/retry 429+Retry-After/backoff/desistência/5xx-sem-retry/erro-não-cacheado). Suíte total **89/89** verde. `node --check` OK.
- ⏳ **AC9 (smoke prod)** pendente de deploy da branch.

### File List
- `backend/lib/trinks-cache.js` (A) — client resiliente (cache+limiter+retry).
- `backend/server.js` (M) — instancia `trinksCache`; wrappers finos; getSlots/getProfessionals/getServicesText via `cachedFetchTrinks`; invalidação pós-booking; `/health.trinks_cache`; ping com `retries:0`.
- `backend/test/trinks-cache.test.js` (A) — 10 testes.

### Change Log
- 2026-06-02: Fase A implementada (cache + limiter + retry). 89/89 testes. Aguarda deploy branch + smoke (AC9).

## CodeRabbit Integration
- Specialized: backend (Node/Express), performance/resilience.
- Quality gate: @architect (design já aprovado); self-healing CodeRabbit máx 2 iter (CRITICAL) antes do commit.
