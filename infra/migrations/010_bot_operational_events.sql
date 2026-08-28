-- =============================================================================
-- Migration: 010_bot_operational_events
-- Purpose:   Telemetria operacional do bot — handoff humano e falha de booking
-- Author:    @dev (Story salon-whatsapp-telemetry-handoff-booking)
-- Date:      2026-08-28
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/010_bot_operational_events.rollback.sql
-- =============================================================================
--
-- Contexto:
--   Eventos append-only para KPIs no admin /metricas (handoff.human, booking.failed).
--   Não substitui conversation_history.agent='human' (proxy de takeover Inbox).
--
-- Estratégia:
--   • Append-only — sem UPDATE/DELETE na aplicação
--   • kapso_conversation_id nullable (só quando inbound Kapso traz id)
-- =============================================================================

\c influence_labs_salon;

BEGIN;

CREATE TABLE IF NOT EXISTS bot_operational_events (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event TEXT NOT NULL,
  client_phone TEXT,
  motivo TEXT,
  kapso_conversation_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bot_operational_events_event_received
  ON bot_operational_events (event, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_operational_events_received
  ON bot_operational_events (received_at DESC);

COMMIT;
