-- =============================================================================
-- Migration: 003_kb_tess_sync
-- Purpose:   Adiciona colunas pra sincronização TESS memory_collection (Story 1.5)
-- Author:    @dev Dex (yolo mode)
-- Date:      2026-05-27
-- Story:     docs/stories/admin-dashboard-story-1.5-kb-editor.md
-- Spec:      §Implementation Pattern + §Decisões técnicas FECHADAS
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/003_kb_tess_sync.rollback.sql
-- Depends:   001_admin_dashboard.sql (kb_items, kb_versions já criadas lá)
-- =============================================================================
--
-- Caminho B (spike 2026-05-27): Postgres source-of-truth de edição/audit/history,
-- TESS memory_collection source-of-truth de runtime. Cada CRUD admin sincroniza
-- com TESS via `update_memory`/`create_memory`/`delete_memory`. Em falha pós-commit,
-- marca tess_sync_failed_at + audit log; UI mostra banner de alerta.
--
-- Pré-requisitos:
--   • PostgreSQL >= 13
--   • Tabela kb_items já existente (migration 001)
-- =============================================================================

\c influence_labs_salon;

BEGIN;

-- -----------------------------------------------------------------------------
-- ALTER kb_items: adiciona colunas pra sync com TESS memory_collections
-- -----------------------------------------------------------------------------

-- ID da memory correspondente no TESS (NULL quando item criado mas TESS sync falhou,
-- ou quando active=false e memory foi removida temporariamente)
ALTER TABLE kb_items
  ADD COLUMN IF NOT EXISTS tess_memory_id BIGINT;

COMMENT ON COLUMN kb_items.tess_memory_id IS
  'ID da memory correspondente na TESS memory_collection. NULL = não sincronizado (criação falhou ou item inativo).';

-- Soft delete: marca quando item foi removido pelo usuário
-- (kb_versions é preservada pra audit; CASCADE não dispara em UPDATE)
ALTER TABLE kb_items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN kb_items.deleted_at IS
  'Soft delete: NULL = ativo na lista; preenchido = removido (histórico preservado em kb_versions).';

-- Tracking de falha de sync com TESS (após commit Postgres bem-sucedido)
ALTER TABLE kb_items
  ADD COLUMN IF NOT EXISTS tess_sync_failed_at TIMESTAMPTZ;

COMMENT ON COLUMN kb_items.tess_sync_failed_at IS
  'Timestamp da última falha de sync TESS pós-commit. NULL = sincronizado ou nunca tentado.';

ALTER TABLE kb_items
  ADD COLUMN IF NOT EXISTS tess_sync_error TEXT;

COMMENT ON COLUMN kb_items.tess_sync_error IS
  'Mensagem de erro da última falha de sync TESS (máx 500 chars na aplicação). NULL se sincronizado.';

-- -----------------------------------------------------------------------------
-- Índices novos
-- -----------------------------------------------------------------------------

-- Lookup rápido por tess_memory_id (ex: cleanup de memories órfãs)
CREATE INDEX IF NOT EXISTS idx_kb_items_tess_memory
  ON kb_items(tess_memory_id)
  WHERE tess_memory_id IS NOT NULL;

-- Items dessincronizados (banner de alerta da UI)
CREATE INDEX IF NOT EXISTS idx_kb_items_sync_failed
  ON kb_items(tess_sync_failed_at DESC)
  WHERE tess_sync_failed_at IS NOT NULL;

-- Soft delete: lista ativa exclui deleted_at (sobrescreve idx_kb_active_category)
DROP INDEX IF EXISTS idx_kb_active_category;
CREATE INDEX IF NOT EXISTS idx_kb_active_category
  ON kb_items(category)
  WHERE active = TRUE AND deleted_at IS NULL;

COMMIT;

-- =============================================================================
-- Post-migration smoke checks (manual)
-- =============================================================================
-- Rodar após COMMIT:
--   \d+ kb_items                                      -- ver colunas novas
--   SELECT COUNT(*) FROM kb_items WHERE deleted_at IS NULL;
--   SELECT COUNT(*) FROM kb_items WHERE tess_memory_id IS NOT NULL;
--   SELECT COUNT(*) FROM kb_items WHERE tess_sync_failed_at IS NOT NULL;  -- 0 esperado
-- =============================================================================
