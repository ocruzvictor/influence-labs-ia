-- Rollback 010: remove tabela de eventos operacionais do bot.

\c influence_labs_salon;

BEGIN;

DROP TABLE IF EXISTS bot_operational_events;

COMMIT;
