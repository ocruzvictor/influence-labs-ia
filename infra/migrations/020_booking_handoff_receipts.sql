-- =============================================================================
-- Migration: 020_booking_handoff_receipts
-- Purpose:   Martelo — aceite nomeado; silêncio ≠ release
-- Author:    @dev Dex
-- Date:      2026-09-08
-- Story:     salon-whatsapp-tess-redesenho-2-martelo-receipt
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/020_booking_handoff_receipts.rollback.sql
-- =============================================================================
--
-- Receipt NÃO é fato Trinks. Silence NÃO apaga booking_holds.
-- Índice parcial SEM NOW() no predicado.
-- =============================================================================

\c influence_labs_salon;

BEGIN;

CREATE TABLE IF NOT EXISTS booking_handoff_receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id      UUID REFERENCES booking_holds(id),
  phone        VARCHAR(20) NOT NULL,
  assigned_to  VARCHAR(80) NOT NULL,
  sla_until    TIMESTAMPTZ NOT NULL,
  action       VARCHAR(16) NOT NULL DEFAULT 'pending',
  acted_at     TIMESTAMPTZ,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_receipts_action_chk
    CHECK (action IN ('pending', 'approved', 'rejected', 'timeout')),
  CONSTRAINT booking_receipts_assigned_not_generic
    CHECK (lower(assigned_to) NOT IN ('recepção', 'recepcao', 'a recepção', 'staff'))
);

COMMENT ON TABLE booking_handoff_receipts IS
  'Martelo: aceite nomeado. Silêncio do bot não libera hold.';

CREATE INDEX IF NOT EXISTS booking_receipts_pending_ix
  ON booking_handoff_receipts (sla_until)
  WHERE action = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS booking_receipts_pending_hold_ux
  ON booking_handoff_receipts (hold_id)
  WHERE action = 'pending' AND hold_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_receipts_phone_ix
  ON booking_handoff_receipts (phone, created_at DESC);

COMMIT;
