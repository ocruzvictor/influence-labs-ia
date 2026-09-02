-- Rollback: 017_last_staff_outbound_at
\c influence_labs_salon;

BEGIN;

DROP INDEX IF EXISTS idx_bot_thread_state_staff_outbound;

ALTER TABLE bot_thread_state
  DROP COLUMN IF EXISTS last_staff_outbound_at;

COMMIT;
