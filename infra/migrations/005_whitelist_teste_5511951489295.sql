-- =============================================================================
-- Migration: 005_whitelist_teste_5511951489295
-- Purpose:   Libera +55 11 95148-9295 para teste no bot 95502 (sem BOT_ACCEPT_ALL)
-- Author:    @aios-master Orion (autorizado por Victor 2026-08-19)
-- Date:      2026-08-19
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/005_whitelist_teste_5511951489295.rollback.sql
-- =============================================================================
--
-- Contexto:
--   Número mandou "Boa tarde" em 17/08 e foi só logged (agent=passive) —
--   ausente da bot_whitelist. Victor pediu para incluir na lista de teste.
--
-- Estratégia:
--   • Idempotente: ON CONFLICT (phone) DO UPDATE mode=allow
--   • DB é autoritativo (cache 5s em backend/lib/bot-state.js)
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511951489295',
  'allow',
  'Teste autorizado Victor 2026-08-19 — +55 11 95148-9295',
  NOW()
)
ON CONFLICT (phone) DO UPDATE
  SET mode   = 'allow',
      reason = 'Teste autorizado Victor 2026-08-19 — +55 11 95148-9295',
      added_at = NOW();

COMMIT;
