# Migration 003 — KB TESS Sync

**Story:** [admin-dashboard-story-1.5-kb-editor.md](../../docs/stories/admin-dashboard-story-1.5-kb-editor.md)
**Apply on:** database `influence_labs_salon`
**Depends on:** 001 (kb_items, kb_versions já criadas lá)

## O que esta migration faz

Adiciona 4 colunas em `kb_items` necessárias pro Caminho B (sync com TESS memory_collection):

| Coluna | Tipo | Propósito |
|---|---|---|
| `tess_memory_id` | `BIGINT` (nullable) | ID da memory correspondente no TESS |
| `deleted_at` | `TIMESTAMPTZ` (nullable) | Soft delete (preserva histórico em kb_versions) |
| `tess_sync_failed_at` | `TIMESTAMPTZ` (nullable) | Última falha de sync TESS pós-commit |
| `tess_sync_error` | `TEXT` (nullable) | Mensagem da última falha (máx 500 chars) |

Também ajusta o índice `idx_kb_active_category` pra excluir `deleted_at IS NOT NULL`.

## Apply em produção

```bash
# 1) ssh deploy@72.60.155.118 'cd /opt/influence-labs && git pull origin main'

# 2) Apply migration
ssh deploy@72.60.155.118 'docker compose -f /opt/influence-labs/infra/docker-compose.yml exec -T postgres \
  psql -U postgres -d influence_labs_salon -f /docker-entrypoint-initdb.d/003_kb_tess_sync.sql'
```

Ou apply local pelo container postgres:

```bash
docker compose exec postgres psql -U postgres -d influence_labs_salon \
  -f /docker-entrypoint-initdb.d/003_kb_tess_sync.sql
```

## Smoke checks pós-apply

```sql
-- Ver colunas novas
\d+ kb_items

-- Sanity: nenhum item dessincronizado (esperado: 0 antes da Story 1.5 estar em prod)
SELECT COUNT(*) FROM kb_items WHERE tess_sync_failed_at IS NOT NULL;
-- Esperado: 0

-- Sanity: índice novo existe
SELECT indexname FROM pg_indexes
WHERE tablename = 'kb_items'
AND indexname IN ('idx_kb_items_tess_memory', 'idx_kb_items_sync_failed', 'idx_kb_active_category');
-- Esperado: 3 linhas
```

## Rollback

```bash
docker compose exec postgres psql -U postgres -d influence_labs_salon \
  -f /docker-entrypoint-initdb.d/003_kb_tess_sync.rollback.sql
```

⚠️ Rollback **remove dados** das 4 colunas. Use somente em emergência. `kb_items` e `kb_versions` permanecem intactos no resto.

## Ordem completa de cutover em prod (Story 1.5 §Ordem de cutover)

1. `git pull origin main` (puxa migration + frontend)
2. Apply 003 (esta migration)
3. `node scripts/bootstrap-tess-kb.mjs` (cria collection TESS, captura ID)
4. Adicionar `TIRRA_KB_COLLECTION_ID=<id>` em `infra/.env` MAS NÃO restart backend ainda
5. `DATABASE_URL=... TESS_API_TOKEN=... TIRRA_KB_COLLECTION_ID=... node scripts/migrate-kb-to-tess.mjs` (popula kb_items + memories)
6. `docker compose up -d --build admin-frontend` (UI funcional, bot ainda sem KB)
7. Smoke admin: criar item teste via UI
8. `docker compose up -d --build backend` (bot agora com KB ativa)
9. Smoke prod AC53 no WhatsApp real
