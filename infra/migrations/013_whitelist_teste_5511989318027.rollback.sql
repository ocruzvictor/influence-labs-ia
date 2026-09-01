-- Rollback 013: remove o tester 5511989318027 da whitelist.

\c influence_labs_salon;

BEGIN;

DELETE FROM bot_whitelist WHERE phone = '5511989318027';

COMMIT;
