-- =============================================================================
-- Migration: 018_bot_pilot_cohort
-- Purpose:   Soft-open first-N — run + claims atômicos (PILOT_N)
-- Author:    @dev Dex / @aios-master
-- Date:      2026-09-04
-- Story:     salon-whatsapp-pilot-first-n-soft-open
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/018_bot_pilot_cohort.rollback.sql
-- =============================================================================

\c influence_labs_salon;

BEGIN;

CREATE TABLE IF NOT EXISTS bot_pilot_runs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  n           INTEGER      NOT NULL CHECK (n >= 1 AND n <= 20),
  status      TEXT         NOT NULL CHECK (status IN ('active', 'frozen', 'stopped')),
  started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stopped_at  TIMESTAMPTZ,
  started_by  TEXT
);

COMMENT ON TABLE bot_pilot_runs IS
  'Janela PILOT_N: no máximo um run active. Claims vivem em bot_pilot_claims.';
COMMENT ON COLUMN bot_pilot_runs.n IS
  'Teto de números distintos claimable nesta janela (produto travado em 5).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_pilot_runs_one_active
  ON bot_pilot_runs ((true))
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bot_pilot_claims (
  run_id      UUID         NOT NULL REFERENCES bot_pilot_runs(id) ON DELETE CASCADE,
  phone       VARCHAR(20)  NOT NULL,
  intent      TEXT         NOT NULL,
  claimed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, phone)
);

COMMENT ON TABLE bot_pilot_claims IS
  'Cohort do run PILOT. allow pré-existente (0007/dono) NÃO entra aqui.';
COMMENT ON COLUMN bot_pilot_claims.phone IS
  'E.164 sem "+", mesmo formato de bot_whitelist.phone.';

CREATE INDEX IF NOT EXISTS idx_bot_pilot_claims_run
  ON bot_pilot_claims (run_id);

INSERT INTO bot_toggles (key, enabled, description) VALUES
  ('pilot', FALSE, 'Soft-open first-N — Tess só reclama inbound não-trivial até o teto')
ON CONFLICT (key) DO NOTHING;

COMMIT;
