-- =============================================================================
-- Rollback: 003_kb_tess_sync
-- =============================================================================
-- ATENÇÃO: este rollback REMOVE colunas adicionadas pela migration 003.
-- Use somente em emergência. Dados em tess_memory_id, deleted_at, tess_sync_*
-- serão perdidos. kb_items intactos no resto.
-- =============================================================================

\c influence_labs_salon;

BEGIN;

-- Restaura índice original (sem condição deleted_at)
DROP INDEX IF EXISTS idx_kb_active_category;
CREATE INDEX IF NOT EXISTS idx_kb_active_category
  ON kb_items(category)
  WHERE active = TRUE;

-- Remove índices novos
DROP INDEX IF EXISTS idx_kb_items_tess_memory;
DROP INDEX IF EXISTS idx_kb_items_sync_failed;

-- Remove colunas
ALTER TABLE kb_items DROP COLUMN IF EXISTS tess_sync_error;
ALTER TABLE kb_items DROP COLUMN IF EXISTS tess_sync_failed_at;
ALTER TABLE kb_items DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE kb_items DROP COLUMN IF EXISTS tess_memory_id;

COMMIT;
