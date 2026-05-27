-- =============================================================================
-- Rollback: 002_seed_whitelist_from_env
-- Purpose:  Remove seeds inseridos pela migration 002
-- Author:   @dev Dex
-- =============================================================================
--
-- ATENÇÃO: Este rollback remove apenas entries com a reason específica do seed.
-- Não toca em outros phones que possam ter sido adicionados via UI/API após.
-- =============================================================================

\c influence_labs_salon;

BEGIN;

DELETE FROM bot_whitelist
WHERE phone IN ('5511964540007', '5511964540330', '5511964542495')
  AND reason LIKE 'Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA%';

COMMIT;
