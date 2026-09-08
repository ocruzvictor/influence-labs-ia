-- =============================================================================
-- Migration: 019_booking_holds
-- Purpose:   Soft-lock local de slot (profissional + início) antes da boca
-- Author:    @dev Dex
-- Date:      2026-09-08
-- Story:     salon-whatsapp-tess-redesenho-1-hold-sanitize-f5
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/019_booking_holds.rollback.sql
-- =============================================================================
--
-- Hold NÃO é fato Trinks. trinks_id só em status=confirmed.
-- Unique parciais SEM NOW() no predicado (NOW não é IMMUTABLE).
-- =============================================================================

\c influence_labs_salon;

BEGIN;

CREATE TABLE IF NOT EXISTS booking_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(20) NOT NULL,
  profissional_id VARCHAR(64) NOT NULL,
  servico_id      VARCHAR(64) NOT NULL,
  slot_start      TIMESTAMPTZ NOT NULL,
  slot_end        TIMESTAMPTZ,
  status          VARCHAR(16) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  trinks_id       VARCHAR(64),
  trace_id        VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_holds_status_chk
    CHECK (status IN (
      'held', 'committing', 'confirmed',
      'released', 'expired', 'rejected', 'failed'
    )),
  CONSTRAINT booking_holds_trinks_only_when_confirmed
    CHECK (trinks_id IS NULL OR status = 'confirmed')
);

COMMENT ON TABLE booking_holds IS
  'Soft-lock Tess-Tess de inventário. Não substitui POST Trinks 2xx (I1).';

CREATE UNIQUE INDEX IF NOT EXISTS booking_holds_active_slot_ux
  ON booking_holds (profissional_id, slot_start)
  WHERE status IN ('held', 'committing');

CREATE UNIQUE INDEX IF NOT EXISTS booking_holds_active_phone_slot_ux
  ON booking_holds (phone, profissional_id, slot_start)
  WHERE status IN ('held', 'committing');

CREATE INDEX IF NOT EXISTS booking_holds_expire_ix
  ON booking_holds (expires_at)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS booking_holds_phone_ix
  ON booking_holds (phone, created_at DESC);

DROP TRIGGER IF EXISTS trg_booking_holds_updated_at ON booking_holds;
CREATE TRIGGER trg_booking_holds_updated_at
  BEFORE UPDATE ON booking_holds
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMIT;
