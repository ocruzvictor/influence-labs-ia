-- Rollback 005: remove o tester 5511951489295 da whitelist.

\c influence_labs_salon;

BEGIN;

DELETE FROM bot_whitelist WHERE phone = '5511951489295';

COMMIT;
