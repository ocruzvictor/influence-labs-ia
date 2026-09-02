-- =============================================================================
-- Migration: 016_bot_thread_state
-- Purpose:   Persistência de silêncio pós-handoff / takeover Business App
-- Author:    @dev Dex
-- Date:      2026-09-01
-- Story:     salon-whatsapp-resume-ia-1-persistencia
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/016_bot_thread_state.rollback.sql
-- =============================================================================
--
-- Fonte de verdade para human-handled (substitui Map humanHandledUntil em memória).
-- Colunas resume_* reservadas para stories 2–4; não mutam bot_whitelist.
-- Índices parciais SEM NOW() no predicado (NOW não é IMMUTABLE no PG).
-- =============================================================================

\c influence_labs_salon;

BEGIN;

CREATE TABLE IF NOT EXISTS bot_thread_state (
  phone                    VARCHAR(20)  PRIMARY KEY,
  silenced_until           TIMESTAMPTZ,
  silence_reason           TEXT         CHECK (
                             silence_reason IS NULL
                             OR silence_reason IN ('handoff', 'business_app')
                           ),
  last_handoff_at          TIMESTAMPTZ,
  last_handoff_motivo      TEXT,
  resume_note              TEXT,
  resume_note_set_at       TIMESTAMPTZ,
  resume_note_expires_at   TIMESTAMPTZ,
  resume_note_consumed_at  TIMESTAMPTZ,
  last_resume_at           TIMESTAMPTZ,
  last_resume_actor        TEXT         CHECK (
                             last_resume_actor IS NULL
                             OR last_resume_actor IN ('cli', 'admin', 'whatsapp')
                           ),
  last_resume_result       TEXT,
  last_resume_note_hash    TEXT,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bot_thread_state IS
  'Estado por thread WhatsApp: silêncio pós-handoff/takeover e notas de resume (stories resume-ia).';
COMMENT ON COLUMN bot_thread_state.phone IS
  'E.164 sem "+", mesmo formato de bot_whitelist.phone / conversation_history.client_phone.';
COMMENT ON COLUMN bot_thread_state.silenced_until IS
  'Timestamp absoluto até quando o bot fica silencioso (TTL = valor, não reason).';
COMMENT ON COLUMN bot_thread_state.silence_reason IS
  'Origem do silêncio: handoff (TESS) ou business_app (takeover outbound Kapso).';

CREATE INDEX IF NOT EXISTS idx_bot_thread_state_active_silence
  ON bot_thread_state (silenced_until)
  WHERE silenced_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_thread_state_pending_resume_note
  ON bot_thread_state (phone)
  WHERE resume_note IS NOT NULL AND resume_note_consumed_at IS NULL;

DROP TRIGGER IF EXISTS trg_bot_thread_state_updated_at ON bot_thread_state;
CREATE TRIGGER trg_bot_thread_state_updated_at
  BEFORE UPDATE ON bot_thread_state
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMIT;
