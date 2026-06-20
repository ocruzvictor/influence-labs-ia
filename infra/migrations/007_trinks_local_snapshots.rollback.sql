-- =============================================================================
-- Rollback: 007_trinks_local_snapshots
-- Purpose:  Remove somente o estado local introduzido pela migration 007
-- Date:     2026-06-18
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_trinks_appointments_client_future_active;

ALTER TABLE trinks_appointments
  DROP COLUMN IF EXISTS deleted_at;

DROP TABLE IF EXISTS trinks_consumption_snapshots;
DROP TABLE IF EXISTS trinks_api_requests;
DROP TABLE IF EXISTS trinks_webhook_events;
DROP TABLE IF EXISTS trinks_slot_snapshot_runs;
DROP TABLE IF EXISTS trinks_slots;
DROP TABLE IF EXISTS trinks_service_professionals;
DROP TABLE IF EXISTS trinks_clients;
DROP TABLE IF EXISTS trinks_services;
DROP TABLE IF EXISTS trinks_professionals;

COMMIT;
