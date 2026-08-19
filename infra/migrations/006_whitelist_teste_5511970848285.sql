-- =============================================================================
-- Migration: 006_whitelist_teste_5511970848285
-- Purpose:   Libera +55 11 97084-8285 para teste no bot 95502 (sem BOT_ACCEPT_ALL)
-- Author:    @aios-master Orion (autorizado por Victor 2026-08-19)
-- Date:      2026-08-19
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/006_whitelist_teste_5511970848285.rollback.sql
-- =============================================================================
--
-- Victor corrigiu o número. 005 tinha seedado 5511951489295 por inferência
-- de um inbound passivo; este arquivo coloca o número certo e remove o errado.
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511970848285',
  'allow',
  'Teste autorizado Victor 2026-08-19 — +55 11 97084-8285',
  NOW()
)
ON CONFLICT (phone) DO UPDATE
  SET mode   = 'allow',
      reason = 'Teste autorizado Victor 2026-08-19 — +55 11 97084-8285',
      added_at = NOW();

DELETE FROM bot_whitelist WHERE phone = '5511951489295';

COMMIT;
