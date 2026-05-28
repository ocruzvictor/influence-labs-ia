-- =============================================================================
-- Rollback: 004_fix_tiago_whitelist
-- Purpose:  Reverte fix do número do Tiago (volta ao estado pré-fix da
--           migration 002, com 5511964540330 e SEM 5511937750330)
-- Date:     2026-05-28
-- =============================================================================
--
-- Use APENAS se for confirmado que 5511964540330 é o número correto e
-- 5511937750330 foi enganado. Diagnóstico em 2026-05-28 indicou o oposto.
-- =============================================================================

\c influence_labs_salon;

BEGIN;

-- Restaura número antigo (mesmo reason do seed 002)
INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511964540330',
  'allow',
  'Seed from BOT_ALLOWED_PHONES env (Story 1.2-DATA, 2026-05-27)',
  '2026-05-27 12:35:26.515499+00'
)
ON CONFLICT (phone) DO NOTHING;

-- Remove número novo
DELETE FROM bot_whitelist
 WHERE phone = '5511937750330';

COMMIT;
