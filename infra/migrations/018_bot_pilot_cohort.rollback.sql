-- Rollback de 018_bot_pilot_cohort — não toca bot_whitelist (allows do cohort ficam).

\c influence_labs_salon;

BEGIN;

DROP INDEX IF EXISTS idx_bot_pilot_claims_run;
DROP TABLE IF EXISTS bot_pilot_claims;
DROP INDEX IF EXISTS idx_bot_pilot_runs_one_active;
DROP TABLE IF EXISTS bot_pilot_runs;
DELETE FROM bot_toggles WHERE key = 'pilot';

COMMIT;
