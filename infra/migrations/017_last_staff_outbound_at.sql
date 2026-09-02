-- =============================================================================
-- Migration: 017_last_staff_outbound_at
-- Purpose:   Gate human_spoke_recently sobrevive restart (story resume-ia-2)
-- Author:    @dev Dex
-- Date:      2026-09-01
-- Story:     salon-whatsapp-resume-ia-2-comando-api
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/017_last_staff_outbound_at.rollback.sql
-- =============================================================================

\c influence_labs_salon;

BEGIN;

ALTER TABLE bot_thread_state
  ADD COLUMN IF NOT EXISTS last_staff_outbound_at TIMESTAMPTZ;

COMMENT ON COLUMN bot_thread_state.last_staff_outbound_at IS
  'Timestamp do último outbound staff (Kapso origin != cloud_api). Gate human_spoke_recently (10 min).';

CREATE INDEX IF NOT EXISTS idx_bot_thread_state_staff_outbound
  ON bot_thread_state (last_staff_outbound_at)
  WHERE last_staff_outbound_at IS NOT NULL;

COMMIT;
