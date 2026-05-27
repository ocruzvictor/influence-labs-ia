# Admin Tests

## Estrutura

```
tests/
├── setup.ts                 — preload env vars (DATABASE_URL stub se não setada)
├── auth.test.ts             — unit tests puros (lib/auth.ts)
└── api/
    ├── helpers.ts           — resetDb(), createTestUser(), dbTest() (skip se DB ausente)
    ├── conversas.test.ts    — AC2, AC3, AC4, AC5 + Zod handler tests
    ├── toggles.test.ts      — AC6, AC7, AC9, AC11, AC12
    ├── whitelist.test.ts    — AC8 + validações de formato
    └── audit-log.test.ts    — AC10 + filtros (action, target_type, since, cursor)
```

## Tipos de teste

| Test file | Requer DB? | Cobertura |
|-----------|-----------|-----------|
| `auth.test.ts` | NÃO | Crypto/JWT puros — sempre rodam |
| `api/*.test.ts` | SIM (`dbTest`) | Integração com Postgres real |

Tests marcados com `dbTest()` (em vez de `test()`) **pulam silenciosamente** quando o
test DB não está disponível — útil em CI sem docker.

## Setup do test DB

Pre-requisito: Docker rodando localmente.

```bash
# Sobe o container postgres-test (porta 5433, init scripts auto-aplicados)
cd infra
docker compose --profile test up -d postgres-test

# Verifica
docker exec postgres-test psql -U postgres -d influence_labs_salon \
  -c "SELECT key FROM bot_toggles ORDER BY key;"
# Esperado: feature:audio, feature:supervisor, global
```

O container `postgres-test` é definido em `infra/docker-compose.yml`:

- **Image:** `postgres:17-bookworm` (mesma família do prod)
- **Porta:** `5433` (host) → `5432` (container) — não conflita com prod postgres
- **DB:** `influence_labs_salon` (nome igual ao prod pra que `\c` dos scripts funcione)
- **Init scripts:** `schema.sql` + `001_admin_dashboard.sql` + `002_seed_whitelist_from_env.sql`
- **`profiles: [test]`** — só sobe quando explícito (`--profile test`)
- **`tmpfs`** em `/var/lib/postgresql/data` — DB em memória, testes rápidos, sem persistência

## Rodando

```bash
cd frontend/admin

# Tests sem DB (unit puros — auth)
npm test
# → auth.test.ts: 8 passes
# → api/*: SKIP (postgres-test não detectado)

# Tests completos (integração)
DATABASE_URL="postgres://postgres:test@localhost:5433/influence_labs_salon" npm test
# → todos passam (auth + api)
```

O script `npm test` injeta `TZ=UTC` automaticamente para evitar bug de comparação
de timestamps em colunas `TIMESTAMP WITHOUT TIME ZONE` (legacy schema.sql) — o
prod já roda em containers UTC, então este alinhamento é equivalente.

### Flags

| Flag | Por quê |
|------|---------|
| `--experimental-test-module-mocks` | habilita `mock.module()` em node:test (ainda experimental no Node 22, estável o suficiente) |
| `--import tsx` | TypeScript runtime sem build |
| `--import ./tests/setup.ts` | preload env vars antes de `lib/env.ts` validar |
| `--test tests/*.test.ts tests/api/*.test.ts` | glob inclui ambos diretórios |

## ACs cobertos

| AC | Onde | Como |
|----|------|------|
| AC1 (auth gate sem cookie → 307) | NÃO unit-testado | Proxy.ts requer Next runtime — coberto por Postman + smoke prod |
| AC2 (DB vazio → items=[]) | conversas.test.ts | `listConversations()` direto |
| AC3 (filter status=active) | conversas.test.ts | insert 2 phones com timestamps diferentes |
| AC4 (cursor pagination) | conversas.test.ts | 5 phones + 3 páginas, valida zero duplicatas |
| AC5 (phone inexistente → vazio) | conversas.test.ts | `getConversationTimeline()` direto |
| AC6 (toggle global=false persiste) | toggles.test.ts | `setToggle()` + listToggles |
| AC7 (toggle global=true persiste) | toggles.test.ts | `setToggle()` toggle round-trip |
| AC8 (whitelist block grava + audit) | whitelist.test.ts | `upsertWhitelist(block)` + listAudit |
| AC9 ({before, after} no audit) | toggles.test.ts | `setToggle` + `logAudit` payload check |
| AC10 (filtro user_id) | audit-log.test.ts | 3 entries 2 usuários, filtro isola |
| AC11 (key UPPERCASE → 400) | toggles.test.ts | Regex schema test |
| AC12 (key inexistente → 404) | toggles.test.ts | `setToggle()` retorna null |

**Halves coberts por Postman/smoke** (não por unit):
- AC1 HTTP redirect (proxy.ts requer Next runtime)
- AC6/AC7 propagação backend ≤5s (já testada em `backend/test/bot-state.test.js`)
- AC8 efeito real no fluxo de mensagem (E2E)

## Troubleshooting

**Tests pulam mesmo com docker rodando:** O helper detecta DB via heurística
`DATABASE_URL.includes("5433")`. Se rodou com outra URL, ajuste:
```bash
DATABASE_URL="postgres://postgres:test@localhost:5433/influence_labs_salon" npm test
```

**AC4 falha com "phone duplicado entre páginas":** Falta `TZ=UTC` no env do
processo de teste. `npm test` já injeta. Se rodar manualmente, prefixe com
`TZ=UTC`. Causa raiz: `conversation_history.created_at` é `TIMESTAMP WITHOUT TIME
ZONE` (legacy) — pg-node lê como local time, gerando offset em máquinas non-UTC.

**Container postgres-test não sobe:** rode com logs visíveis para diagnóstico:
```bash
docker compose --profile test up postgres-test
```
