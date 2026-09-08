-- Rollback de 020_booking_handoff_receipts — não toca booking_holds, Trinks, prompt.

\c influence_labs_salon;

BEGIN;

DROP INDEX IF EXISTS booking_receipts_phone_ix;
DROP INDEX IF EXISTS booking_receipts_pending_hold_ux;
DROP INDEX IF EXISTS booking_receipts_pending_ix;
DROP TABLE IF EXISTS booking_handoff_receipts;

COMMIT;
