-- =============================================================================
-- Migration: 009_whitelist_teste_5511963014905
-- Purpose:   Libera +55 11 96301-4905 para teste no bot 46589 (sem BOT_ACCEPT_ALL)
-- Author:    @aios-master Orion (autorizado por Victor 2026-08-27)
-- Date:      2026-08-27
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/009_whitelist_teste_5511963014905.rollback.sql
-- =============================================================================
--
-- Contexto:
--   Victor pediu para incluir mais um número na lista de teste.
--   DB é autoritativo (cache 5s em backend/lib/bot-state.js).
--
-- Estratégia:
--   • Idempotente: ON CONFLICT (phone) DO UPDATE mode=allow
--   • BOT_ACCEPT_ALL permanece false
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511963014905',
  'allow',
  'Teste autorizado Victor 2026-08-27 — +55 11 96301-4905',
  NOW()
)
ON CONFLICT (phone) DO UPDATE
  SET mode   = 'allow',
      reason = 'Teste autorizado Victor 2026-08-27 — +55 11 96301-4905',
      added_at = NOW();

COMMIT;
