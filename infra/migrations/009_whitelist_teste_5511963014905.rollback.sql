-- Rollback 009: remove o tester 5511963014905 da whitelist.

\c influence_labs_salon;

BEGIN;

DELETE FROM bot_whitelist WHERE phone = '5511963014905';

COMMIT;
