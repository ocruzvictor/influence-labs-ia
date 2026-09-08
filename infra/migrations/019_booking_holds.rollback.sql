-- Rollback de 019_booking_holds — não toca Trinks, allowlist, prompt, bot_thread_state.

\c influence_labs_salon;

BEGIN;

DROP TRIGGER IF EXISTS trg_booking_holds_updated_at ON booking_holds;
DROP INDEX IF EXISTS booking_holds_phone_ix;
DROP INDEX IF EXISTS booking_holds_expire_ix;
DROP INDEX IF EXISTS booking_holds_active_phone_slot_ux;
DROP INDEX IF EXISTS booking_holds_active_slot_ux;
DROP TABLE IF EXISTS booking_holds;

COMMIT;
