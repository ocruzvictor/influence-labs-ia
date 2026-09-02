-- Rollback de 016_bot_thread_state — não toca bot_whitelist nem conversation_history.

\c influence_labs_salon;

BEGIN;

DROP TRIGGER IF EXISTS trg_bot_thread_state_updated_at ON bot_thread_state;
DROP INDEX IF EXISTS idx_bot_thread_state_pending_resume_note;
DROP INDEX IF EXISTS idx_bot_thread_state_active_silence;
DROP TABLE IF EXISTS bot_thread_state;

COMMIT;
