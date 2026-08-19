-- Rollback 006: remove 5511970848285. Não recoloca o 5511951489295 (era seed errado).

\c influence_labs_salon;

BEGIN;

DELETE FROM bot_whitelist WHERE phone = '5511970848285';

COMMIT;
