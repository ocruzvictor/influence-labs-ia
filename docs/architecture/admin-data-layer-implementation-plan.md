# Admin Data Layer — Implementation Plan (Core: Conversas + Toggle + Audit)

**Status:** Draft (pronto pra @sm criar Story 1.2-DATA)
**Autor:** @architect Aria
**Data:** 2026-05-27
**Escopo:** Core MVP — Conversas live + Toggle bot (global + whitelist) + Audit log viewer
**Fora de escopo:** Métricas dashboard, KB editor, Health visual, Trinks sync (próxima iteração)
**Pré-requisito de arquitetura:** [admin-dashboard.md](./admin-dashboard.md) (já aprovado)
**Pré-requisito de schema:** [001_admin_dashboard.sql](../../infra/migrations/001_admin_dashboard.sql) (deve estar aplicado no VPS)

---

## 0. Why this doc exists

A arquitetura completa do dashboard foi fechada em 2026-05-26 (`admin-dashboard.md`, 664 linhas). O schema (10 tabelas + 2 views) foi escrito em `001_admin_dashboard.sql`. A Story 1.1 entregou auth + scaffold em produção.

**O que falta é implementação backend.** Este documento existe pra dar ao @sm/@dev uma especificação determinística do gap, evitando re-arquitetar ou improvisar contratos.

**Princípio guia:** data-first. Backend completo, testável via curl/Postman, **antes** de qualquer UI. UI vira PRs pequenas em sequência depois.

---

## 1. Gap atual vs alvo

| Componente | Hoje | Alvo da Story 1.2-DATA |
|---|---|---|
| **Whitelist do bot** | Hardcoded em env var `BOT_ALLOWED_PHONES` (3 números) lida em `backend/server.js:1290-1307` | Lida de `bot_whitelist` + `bot_toggles.global` no Postgres, cache 5s em memória |
| **Toggle bot global** | Não existe (depende de redeploy) | Endpoint `PATCH /api/toggles` aciona kill switch em <5s |
| **Lista de conversas** | Não exposta (só `/health` antigo) | Endpoint `GET /api/conversas` paginado e filtrado |
| **Drill-down conversa** | Não existe | Endpoint `GET /api/conversas/[phone]` com timeline |
| **Audit log** | Só tabela vazia | Endpoint `GET /api/audit-log` + escrita automática via `lib/audit.ts` em toda mutação |

---

## 2. Contratos REST (OpenAPI 3.1 resumido)

Todos os endpoints abaixo:
- Hospedados em `frontend/admin/app/api/` (Next.js Route Handlers)
- Protegidos pelo middleware `middleware.ts` existente (JWT + session check)
- Respondem JSON; erros seguem `{ error: string, code?: string }`
- Validação de input com Zod

### 2.1 Conversas

#### `GET /api/conversas`

Lista de conversas agregadas usando view `v_admin_conversations_summary`.

**Query params:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `status` | `'all' \| 'active' \| 'inactive'` | `'all'` | `active` = mensagens nas últimas 4h |
| `takeover` | `'all' \| 'yes' \| 'no'` | `'all'` | Filtro por `had_takeover` |
| `search` | string | — | Match por substring em `client_phone` |
| `limit` | int 1-100 | `50` | Paginação |
| `cursor` | ISO timestamp | — | `last_msg_at` da última row da página anterior (keyset pagination) |

**Response 200:**

```json
{
  "items": [
    {
      "client_phone": "5511964540007",
      "msg_count": 47,
      "last_msg_at": "2026-05-27T01:32:11Z",
      "first_msg_at": "2026-04-12T18:01:00Z",
      "last_agent": "principal",
      "is_active_4h": true,
      "had_takeover": false
    }
  ],
  "next_cursor": "2026-05-27T01:30:00Z"
}
```

**Cache:** LRU 2s (lib `lru-cache`, key = querystring serializada).

---

#### `GET /api/conversas/[phone]`

Timeline paginada de mensagens de uma conversa.

**Path:** `phone` em formato E.164 sem `+` (ex: `5511964540007`)

**Query params:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `limit` | int 1-200 | `50` | |
| `before` | ISO timestamp | — | Mensagens com `created_at < before` |

**Response 200:**

```json
{
  "phone": "5511964540007",
  "messages": [
    {
      "id": 12345,
      "role": "user",
      "content": "quero cortar sabado",
      "intent": "agendamento",
      "agent": null,
      "trace_id": "abc123",
      "created_at": "2026-05-27T01:32:11Z"
    },
    {
      "id": 12346,
      "role": "assistant",
      "content": "claro! posso ver os horários...",
      "intent": null,
      "agent": "principal",
      "trace_id": "abc123",
      "created_at": "2026-05-27T01:32:14Z"
    }
  ],
  "has_more": true,
  "next_before": "2026-05-27T01:32:11Z"
}
```

**Cache:** sem cache (timeline precisa ser fresh).

---

### 2.2 Toggle bot

#### `GET /api/toggles`

Lista todos os toggles atuais.

**Response 200:**

```json
{
  "toggles": [
    { "key": "global", "enabled": true, "description": "Kill switch...", "updated_at": "..." },
    { "key": "feature:audio", "enabled": true, "description": "...", "updated_at": "..." },
    { "key": "feature:supervisor", "enabled": true, "description": "...", "updated_at": "..." }
  ]
}
```

---

#### `PATCH /api/toggles`

Atualiza um toggle.

**Body:**

```json
{ "key": "global", "enabled": false }
```

**Validação Zod:**
- `key` deve match `^[a-z_]+(:[a-z_]+)?$` (snake_case, opcional namespace)
- `key` deve existir em `bot_toggles` (erro 404 senão)
- `enabled` boolean

**Side effects:**
1. UPDATE em `bot_toggles` com `updated_by = current_user.id`
2. INSERT em `admin_audit_log` com `action='toggle.set'`, `target_type='bot_toggle'`, `target_id=key`, `payload={ before, after }`

**Response 200:** toggle atualizado.

**Propagação:** Backend Express tem cache 5s — toggle aplica em ≤5s no fluxo de mensagens.

---

#### `GET /api/whitelist`

Lista whitelist atual.

**Query params:** `mode` (filtro opcional: `allow | block | human_only`)

**Response 200:**

```json
{
  "items": [
    {
      "phone": "5511964540007",
      "mode": "allow",
      "reason": "Victor pessoal (smoke tests)",
      "added_by_email": "victor.cruz@pareto.plus",
      "added_at": "2026-05-15T10:00:00Z"
    }
  ]
}
```

---

#### `POST /api/whitelist`

Adiciona/atualiza entrada.

**Body:**

```json
{
  "phone": "5511964540007",
  "mode": "allow",
  "reason": "Cliente VIP — sempre humano responde"
}
```

**Validação:**
- `phone` formato E.164 sem `+`, 10-15 dígitos
- `mode` ∈ `allow | block | human_only`
- `reason` opcional, max 500 chars

**Side effects:**
- INSERT ON CONFLICT (`phone`) DO UPDATE
- Audit `action='whitelist.upsert'`

**Response 201/200:** entry resultante.

---

#### `DELETE /api/whitelist/[phone]`

Remove entrada.

**Side effects:**
- DELETE FROM `bot_whitelist`
- Audit `action='whitelist.remove'`

**Response 204** (no content).

---

### 2.3 Audit log

#### `GET /api/audit-log`

Lista paginada do audit_log.

**Query params:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `user_id` | UUID | — | Filtro por usuário |
| `action` | string | — | Match exato (ex: `toggle.set`) ou prefix (`toggle.*`) |
| `target_type` | string | — | `bot_toggle`, `bot_whitelist`, `kb_item`, `admin_session` |
| `since` | ISO timestamp | -7d | Filtro temporal |
| `until` | ISO timestamp | NOW | Filtro temporal |
| `limit` | int 1-200 | `100` | |
| `cursor` | int (id) | — | Keyset pagination |

**Response 200:**

```json
{
  "items": [
    {
      "id": 142,
      "user_email": "victor.cruz@pareto.plus",
      "action": "toggle.set",
      "target_type": "bot_toggle",
      "target_id": "global",
      "payload": { "before": true, "after": false },
      "ip_address": "179.100.14.91",
      "created_at": "2026-05-27T02:15:00Z"
    }
  ],
  "next_cursor": 138
}
```

---

## 3. Integração crítica no backend (bot flow)

**Arquivo:** `backend/server.js`
**Região:** linhas 1290-1307 (filtro whitelist atual)
**Mudança:** trocar leitura de env var por leitura do Postgres, com cache 5s.

### 3.1 Pseudo-código da mudança

```javascript
// backend/lib/bot-state.js (NOVO arquivo)
const { pool } = require('./db'); // pg pool já existe no backend
const CACHE_TTL_MS = 5_000;

let cache = { value: null, expiresAt: 0 };

async function getBotState() {
  if (Date.now() < cache.expiresAt) return cache.value;

  const [togglesResult, whitelistResult] = await Promise.all([
    pool.query('SELECT key, enabled FROM bot_toggles'),
    pool.query('SELECT phone, mode FROM bot_whitelist'),
  ]);

  const toggles = Object.fromEntries(
    togglesResult.rows.map(r => [r.key, r.enabled])
  );
  const whitelist = new Map(
    whitelistResult.rows.map(r => [r.phone, r.mode])
  );

  const value = { toggles, whitelist };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

module.exports = { getBotState };
```

### 3.2 Onde plugar em `server.js`

Trecho atual (~linha 1300):

```javascript
if (BOT_ALLOWED_PHONES.length === 0 && !BOT_ACCEPT_ALL) {
  console.log(`[kapso][${sessionId}] WHITELIST VAZIA — bot silencioso`);
  return;
}
if (!BOT_ACCEPT_ALL && !BOT_ALLOWED_PHONES.includes(fromPhone)) {
  console.log(`[kapso][${sessionId}] telefone fora do whitelist — bot inativo`);
  return;
}
```

Substituir por:

```javascript
const { getBotState } = require('./lib/bot-state');
const { toggles, whitelist } = await getBotState();

// 1. Kill switch global
if (toggles.global === false) {
  console.log(`[kapso][${sessionId}] BOT GLOBAL DESLIGADO — silencioso`);
  return;
}

// 2. Whitelist por número
const mode = whitelist.get(fromPhone);
if (mode === 'block' || mode === 'human_only') {
  console.log(`[kapso][${sessionId}] phone ${fromPhone} mode=${mode} — bot inativo`);
  return;
}

// 3. Modo OPEN ainda funciona se ninguém na whitelist com allow
if (whitelist.size === 0 && !process.env.BOT_ACCEPT_ALL) {
  // Compat: se DB vazio, cai no env var (transição segura)
  if (!BOT_ALLOWED_PHONES.includes(fromPhone)) {
    console.log(`[kapso][${sessionId}] DB whitelist vazia + env não inclui ${fromPhone}`);
    return;
  }
}
```

**Estratégia de cutover:**
1. Deploy do código novo com fallback pro env var quando `bot_whitelist` está vazia
2. Migração: INSERT INTO `bot_whitelist` os 3 números do `BOT_ALLOWED_PHONES` atual (mode=`allow`)
3. Validar (smoke test)
4. Remover `BOT_ALLOWED_PHONES` do env (próxima iteração)

---

## 4. Queries críticas (com EXPLAIN previsto)

### 4.1 Lista de conversas filtrada (`GET /api/conversas`)

```sql
SELECT
  client_phone, msg_count, last_msg_at, first_msg_at,
  last_agent, is_active_4h, had_takeover
FROM v_admin_conversations_summary
WHERE
  ($1::text = 'all' OR
   ($1 = 'active' AND is_active_4h) OR
   ($1 = 'inactive' AND NOT is_active_4h))
  AND ($2::text = 'all' OR
       ($2 = 'yes' AND had_takeover) OR
       ($2 = 'no' AND NOT had_takeover))
  AND ($3::text IS NULL OR client_phone LIKE '%' || $3 || '%')
  AND ($4::timestamptz IS NULL OR last_msg_at < $4)
ORDER BY last_msg_at DESC
LIMIT $5;
```

**EXPLAIN previsto:**
- View resolvida via `GROUP BY` em `conversation_history`
- Index `idx_conversation_phone(client_phone, created_at DESC)` já existe (schema.sql:74)
- Para volume atual (<50k linhas em `conversation_history`), expected < 50ms
- **Risco:** quando volume crescer 10x, query agregada pode degradar — mitigação V2 = materialized view com refresh 30s

### 4.2 Timeline de conversa (`GET /api/conversas/[phone]`)

```sql
SELECT id, role, content, intent, agent, trace_id, created_at
FROM conversation_history
WHERE client_phone = $1
  AND ($2::timestamptz IS NULL OR created_at < $2)
ORDER BY created_at DESC
LIMIT $3;
```

**EXPLAIN previsto:**
- Index `idx_conversation_phone(client_phone, created_at DESC)` → seek + reverse scan
- Expected < 10ms mesmo com milhões de linhas

### 4.3 Audit log com filtros (`GET /api/audit-log`)

```sql
SELECT a.id, u.email AS user_email, a.action, a.target_type, a.target_id,
       a.payload, a.ip_address, a.created_at
FROM admin_audit_log a
LEFT JOIN admin_users u ON u.id = a.user_id
WHERE ($1::uuid IS NULL OR a.user_id = $1)
  AND ($2::text IS NULL OR a.action LIKE $2)
  AND ($3::text IS NULL OR a.target_type = $3)
  AND a.created_at >= $4
  AND a.created_at <= $5
  AND ($6::bigint IS NULL OR a.id < $6)
ORDER BY a.id DESC
LIMIT $7;
```

**EXPLAIN previsto:**
- Index `idx_audit_user_time` ou `idx_audit_action_time` conforme filtro
- BRIN index `idx_audit_created_brin` para range temporal grande
- Expected < 20ms

---

## 5. Arquivos a criar (lista determinística)

```
frontend/admin/
├── app/api/
│   ├── conversas/
│   │   ├── route.ts                    # GET (lista)
│   │   └── [phone]/route.ts            # GET (timeline)
│   ├── toggles/
│   │   └── route.ts                    # GET, PATCH
│   ├── whitelist/
│   │   ├── route.ts                    # GET, POST
│   │   └── [phone]/route.ts            # DELETE
│   └── audit-log/
│       └── route.ts                    # GET
├── lib/
│   ├── conversas.ts                    # queries + cache LRU
│   ├── toggles.ts                      # queries + audit wrapper
│   ├── whitelist.ts                    # queries + audit wrapper
│   └── audit-log.ts                    # query helper (já tem audit.ts pra escrita)
└── tests/
    └── api/
        ├── conversas.test.ts
        ├── toggles.test.ts
        ├── whitelist.test.ts
        └── audit-log.test.ts

backend/
├── lib/
│   └── bot-state.js                    # NOVO: leitura + cache de toggles/whitelist
├── server.js                           # MODIFICAR: linhas 1290-1307 + remover BOT_ALLOWED_PHONES dep
└── test/
    └── bot-state.test.js               # NOVO: testes do cache + fallback

infra/
└── migrations/
    └── 002_seed_whitelist_from_env.sql # NOVO: seed os 3 phones de BOT_ALLOWED_PHONES → bot_whitelist
```

**Total:** 11 arquivos novos, 1 modificado. ~600 linhas de código líquidas estimadas.

---

## 6. Critérios de aceite (testáveis via curl)

| # | Cenário | Comando | Resultado esperado |
|---|---|---|---|
| 1 | Auth bloqueia sem cookie | `curl -i https://admin.../api/conversas` | 401/302 redirect login |
| 2 | Lista conversas vazia retorna 200 | `curl --cookie ... /api/conversas?status=all` | `{"items":[],"next_cursor":null}` |
| 3 | Filtro `status=active` retorna só msgs 4h | `... ?status=active` | items com `is_active_4h=true` |
| 4 | Paginação por cursor funciona | request 1 + cursor da resposta | 0 overlap |
| 5 | Drill-down inexistente retorna lista vazia | `/api/conversas/999999999999` | `{"phone":"...","messages":[]}` |
| 6 | Toggle global=false silencia bot | PATCH + smoke WhatsApp em <5s | bot não responde |
| 7 | Toggle global=true reanima bot | PATCH + smoke | bot responde normalmente |
| 8 | Whitelist mode=block silencia número | POST + smoke daquele número | bot não responde, log "mode=block" |
| 9 | Audit log captura toggle change | PATCH /toggles → GET /audit-log | item com `action='toggle.set'` aparece |
| 10 | Audit filtra por user_id | GET /audit-log?user_id=... | só itens do usuário |
| 11 | Input inválido retorna 400 | PATCH /toggles `{key:"GLOBAL"}` (uppercase) | 400 com erro Zod |
| 12 | Toggle não-existente retorna 404 | PATCH /toggles `{key:"inexistente"}` | 404 |

---

## 7. Ordem de implementação (delegação por agente)

| # | Tarefa | Owner | Dep | Estimativa |
|---|---|---|---|---|
| 1 | Confirmar migration 001 aplicada no VPS | Victor / @devops | — | 5min |
| 2 | Migration 002 (seed whitelist do env atual) | @data-engineer | 1 | 30min |
| 3 | `backend/lib/bot-state.js` + integração `server.js:1290` | @dev | 2 | 2h |
| 4 | `lib/conversas.ts` + `app/api/conversas/route.ts` + handler `[phone]` | @dev | 1 | 3h |
| 5 | `lib/toggles.ts` + `app/api/toggles/route.ts` (GET + PATCH) | @dev | 1 | 2h |
| 6 | `lib/whitelist.ts` + `app/api/whitelist/route.ts` + `[phone]/route.ts` | @dev | 1 | 2h |
| 7 | `lib/audit-log.ts` + `app/api/audit-log/route.ts` | @dev | 1 | 2h |
| 8 | Testes integração (supertest hitting handlers) — 12 cenários | @qa | 4-7 | 4h |
| 9 | Postman collection commitada em `postman/admin-data-layer.json` | @qa | 4-7 | 1h |
| 10 | Smoke test produção (manual via curl com cookie real) | Victor | 8 | 30min |
| 11 | Deploy + monitoring logs no VPS | @devops | 10 | 1h |

**Total estimado:** ~17h de trabalho ativo. Em ritmo de sessão Victor+IA: ~2-3 sessões.

---

## 8. Decisões de design pendentes (precisam ser confirmadas antes do @dev)

| # | Decisão | Default sugerido | Por quê |
|---|---|---|---|
| 1 | Estratégia quando user_id é deletado (admin_audit_log) | `ON DELETE SET NULL` (já no schema) | Mantém histórico mesmo se admin sair |
| 2 | Rate limit dos endpoints data | Reusar middleware da Story 1.1 (60req/min/IP) | Consistência |
| 3 | Internacionalização timestamps | UTC no DB, conversão pra `America/Sao_Paulo` no client | Padrão |
| 4 | Onde escrever audit (lib `audit.ts` existente?) | Sim, usar `lib/audit.ts` da Story 1.1 | Reuso |
| 5 | Cache LRU em conversas: tamanho? | `max: 100, ttl: 2000` | Suficiente pra 50 abas abertas |
| 6 | Lib `lru-cache` é dep nova? | Verificar `package.json` antes; se não tem, adicionar | — |

---

## 9. Riscos e mitigações

| Risco | P | I | Mitigação |
|---|---|---|---|
| Migration 001 não aplicada → tudo quebra | Baixa | Alto | Step 1 do plano confirma antes de codar |
| Cache 5s no backend cria inconsistência durante restart | Baixa | Médio | Cache se reidrata no primeiro request pós-restart (~1ms latência extra) |
| Whitelist com 1000+ entries enche memória | Muito baixa | Baixo | Cap em 500 entries; rejeitar inserts além disso |
| Drill-down de conversa com milhões de msgs trava polling | Baixa | Médio | `LIMIT 50` + keyset pagination obrigatório |
| Audit log cresce sem bound | Média | Médio | V2: partitioning por mês (já discutido em handoff aios-master) — fora desta story |

---

## 10. Próximos passos pós este plan

1. **Victor revisa este doc** e aprova / pede ajustes
2. `@sm *draft Story 1.2-DATA` usando este plan como source-of-truth (anexa link como referência)
3. `@po *validate-story-draft` 10-point checklist
4. `@dev` implementa em modo Interactive ou Pre-Flight (sugiro Pre-Flight dado escopo grande)
5. `@qa` valida todos os 12 critérios via curl + Postman
6. `@devops` deploya no VPS, monitora logs
7. Smoke produção com Victor disparando curls reais
8. UI dessas features (PRs separados, próximas iterações) consome esta API sem mexer em backend

---

## Change log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @architect Aria | Plan inicial criado a partir de admin-dashboard.md + análise de gap no código atual |
