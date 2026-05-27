-- =============================================================================
-- Rollback: 001_admin_dashboard
-- Purpose:  Reverter migration 001_admin_dashboard.sql
-- Author:   @data-engineer Dara
-- Date:     2026-05-26
--
-- ⚠️  ATENÇÃO: Esta operação é DESTRUTIVA.
--    Drops: admin_users, magic_link_tokens, admin_sessions, admin_audit_log,
--           bot_toggles, bot_whitelist, kb_items, kb_versions,
--           trinks_appointments, trinks_sync_state
--    Drops: views v_admin_*, função admin_set_updated_at
--    Preserva: conversation_history, clients, e demais tabelas legadas
--
-- Pré-rollback recomendado:
--   • Snapshot: pg_dump -t 'admin_*' -t 'bot_*' -t 'kb_*' -t 'trinks_appointments*' -t 'magic_link_tokens' \
--               influence_labs_salon > backup_admin_$(date +%Y%m%d_%H%M%S).sql
--   • Confirmar: nenhum serviço (admin-frontend, admin-trinks-sync) está rodando
-- =============================================================================

\c influence_labs_salon;

BEGIN;

-- Drop views primeiro (dependências)
DROP VIEW IF EXISTS v_admin_appointments_daily;
DROP VIEW IF EXISTS v_admin_conversations_summary;

-- Drop tabelas em ordem reversa de dependências FK
DROP TABLE IF EXISTS trinks_sync_state;
DROP TABLE IF EXISTS trinks_appointments;
DROP TABLE IF EXISTS kb_versions;
DROP TABLE IF EXISTS kb_items;
DROP TABLE IF EXISTS bot_whitelist;
DROP TABLE IF EXISTS bot_toggles;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS magic_link_tokens;
DROP TABLE IF EXISTS admin_users;

-- Drop função trigger compartilhada (apenas se nenhuma outra tabela usar)
-- Verificar antes: SELECT trigger_name, event_object_table FROM information_schema.triggers
--                  WHERE action_statement LIKE '%admin_set_updated_at%';
DROP FUNCTION IF EXISTS admin_set_updated_at();

COMMIT;

-- =============================================================================
-- Post-rollback smoke checks:
--   SELECT COUNT(*) FROM information_schema.tables
--     WHERE table_name IN ('admin_users','bot_toggles','kb_items','trinks_appointments');
--   -- Esperado: 0
--
--   SELECT COUNT(*) FROM conversation_history;  -- preservado
--   SELECT COUNT(*) FROM clients;               -- preservado
-- =============================================================================
