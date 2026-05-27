-- =============================================================================
-- Migration: 002_seed_whitelist_from_env
-- Purpose:   Popula bot_whitelist com os phones do BOT_ALLOWED_PHONES env atual
-- Author:    @dev Dex (Story 1.2-DATA)
-- Date:      2026-05-27
-- Story:     docs/stories/admin-dashboard-story-1.2-data-layer-core.md
-- Spec:      docs/architecture/admin-data-layer-implementation-plan.md §3.2
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/002_seed_whitelist_from_env.rollback.sql
-- =============================================================================
--
-- Contexto:
--   A Story 1.2-DATA substitui a whitelist hardcoded em env var
--   (backend/server.js:1300-1310) por leitura do Postgres com cache 5s.
--   Esta migration popula bot_whitelist com os 3 phones que estavam no
--   BOT_ALLOWED_PHONES, garantindo zero downtime no cutover.
--
-- Estratégia:
--   • Idempotente: ON CONFLICT (phone) DO NOTHING
--   • mode='allow' — todos os 3 são números autorizados a interagir com o bot
--   • added_by=NULL — não há admin user "system" (schema permite ON DELETE SET NULL)
--   • reason — auditável: "Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA)"
--
-- Pré-requisitos:
--   • Migration 001_admin_dashboard.sql aplicada (tabela bot_whitelist existe)
--
-- Validação manual pós-apply:
--   SELECT phone, mode, reason FROM bot_whitelist ORDER BY phone;
--   -- Esperado: 3 linhas, todas mode='allow'
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_by) VALUES
  ('5511964540007', 'allow', 'Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA, 2026-05-27)', NULL),
  ('5511964540330', 'allow', 'Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA, 2026-05-27)', NULL),
  ('5511964542495', 'allow', 'Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA, 2026-05-27)', NULL)
ON CONFLICT (phone) DO NOTHING;

COMMIT;

-- =============================================================================
-- Post-migration smoke
-- =============================================================================
-- SELECT phone, mode FROM bot_whitelist ORDER BY phone;
--   -- Esperado: 3 rows (todas com mode='allow')
-- =============================================================================
