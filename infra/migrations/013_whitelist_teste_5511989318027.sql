-- =============================================================================
-- Migration: 013_whitelist_teste_5511989318027
-- Purpose:   Libera +55 11 98931-8027 (cliente real) para teste no bot 46589
-- Author:    @aios-master Orion (autorizado por Victor 2026-09-01)
-- Date:      2026-09-01
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/013_whitelist_teste_5511989318027.rollback.sql
-- =============================================================================
--
-- Estratégia:
--   • Idempotente: ON CONFLICT (phone) DO UPDATE mode=allow
--   • DB é autoritativo (cache 5s em backend/lib/bot-state.js)
--   • BOT_ACCEPT_ALL permanece false
--   • Não entra em OWNER_PHONES; recepção 94831 intacta
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511989318027',
  'allow',
  'Cliente real autorizado Victor 2026-09-01 — +55 11 98931-8027',
  NOW()
)
ON CONFLICT (phone) DO UPDATE
  SET mode   = 'allow',
      reason = 'Cliente real autorizado Victor 2026-09-01 — +55 11 98931-8027',
      added_at = NOW();

COMMIT;
