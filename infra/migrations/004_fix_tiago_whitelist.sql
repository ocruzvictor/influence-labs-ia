-- =============================================================================
-- Migration: 004_fix_tiago_whitelist
-- Purpose:   Corrige número do Tiago na bot_whitelist
-- Author:    @aios-master Orion (assistido por Victor)
-- Date:      2026-05-28
-- Story:     Operacional — diagnóstico em sessão de troubleshooting
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/004_fix_tiago_whitelist.rollback.sql
-- =============================================================================
--
-- Contexto:
--   A migration 002_seed_whitelist_from_env.sql seedou '5511964540330' como
--   número do Tiago, mas o número correto é '5511937750330'. O seed errado
--   ocorreu por confusão visual com o início do número de Victor
--   (5511964540007) — os dígitos '96454' foram parar no lugar de '93775'.
--
--   Consequência: Tiago nunca recebeu resposta do agente em produção pós-cutover
--   Story 1.2-DATA (DB-first virou autoritativo, env BOT_ALLOWED_PHONES não
--   é mais lido se DB tem whitelist preenchida).
--
-- Estratégia:
--   • Idempotente: ON CONFLICT (phone) DO UPDATE e DELETE silencioso
--   • Pode ser re-rodada sem efeito colateral
--   • Aplicação direta no VPS já foi feita em 2026-05-28 ~15:35 UTC via
--     psql interativo; esta migration apenas formaliza o estado para que
--     restore de backup + replay de migrations reproduza o fix.
--
-- Pré-requisitos:
--   • Migration 002_seed_whitelist_from_env.sql aplicada
--
-- Validação pós-apply:
--   SELECT phone, mode FROM bot_whitelist ORDER BY phone;
--   -- Esperado:
--   --   5511937750330 | allow  (Tiago — número correto)
--   --   5511964540007 | allow  (Victor)
--   --   5511964542495 | allow  (terceiro testador)
-- =============================================================================

\c influence_labs_salon;

BEGIN;

INSERT INTO bot_whitelist (phone, mode, reason, added_at)
VALUES (
  '5511937750330',
  'allow',
  'Fix 2026-05-28: número correto do Tiago. Seed 002 pegou 5511964540330 por confusão visual com início do número de Victor (5511964540007).',
  NOW()
)
ON CONFLICT (phone) DO UPDATE
  SET mode   = 'allow',
      reason = 'Fix 2026-05-28: reativado com mode=allow (idempotente)';

DELETE FROM bot_whitelist
 WHERE phone = '5511964540330';

COMMIT;

-- =============================================================================
-- Post-migration smoke
-- =============================================================================
-- SELECT phone, mode, reason FROM bot_whitelist ORDER BY phone;
--   -- Esperado: 3 rows, todas mode='allow', sem 5511964540330
-- =============================================================================
