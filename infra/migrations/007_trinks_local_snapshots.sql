-- =============================================================================
-- Migration: 007_trinks_local_snapshots
-- Purpose:   Estado local consultavel para operacao Trinks webhook-first
-- Date:      2026-06-18
-- Story:     salon-whatsapp-trinks-webhook-first-budget
-- Rollback:  infra/migrations/007_trinks_local_snapshots.rollback.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS trinks_professionals (
  trinks_id         VARCHAR(64)  PRIMARY KEY,
  name              VARCHAR(160),
  nickname          VARCHAR(160),
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  raw               JSONB        NOT NULL DEFAULT '{}'::JSONB,
  deleted_at        TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinks_professionals_active_name
  ON trinks_professionals(active, name)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE trinks_professionals IS
  'Snapshot local de profissionais Trinks para leituras sem chamada REST.';

CREATE TABLE IF NOT EXISTS trinks_services (
  trinks_id         VARCHAR(64)  PRIMARY KEY,
  name              VARCHAR(180),
  duration_min      INTEGER      CHECK (duration_min IS NULL OR duration_min > 0),
  price_cents       INTEGER      CHECK (price_cents IS NULL OR price_cents >= 0),
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  raw               JSONB        NOT NULL DEFAULT '{}'::JSONB,
  deleted_at        TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinks_services_active_name
  ON trinks_services(active, name)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE trinks_services IS
  'Snapshot local do catalogo de servicos Trinks para leituras sem chamada REST.';

CREATE TABLE IF NOT EXISTS trinks_service_professionals (
  service_id        VARCHAR(64) NOT NULL
                    REFERENCES trinks_services(trinks_id) ON DELETE CASCADE,
  professional_id   VARCHAR(64) NOT NULL
                    REFERENCES trinks_professionals(trinks_id) ON DELETE CASCADE,
  active            BOOLEAN     NOT NULL DEFAULT TRUE,
  raw               JSONB       NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_trinks_service_professionals_professional
  ON trinks_service_professionals(professional_id, service_id)
  WHERE active = TRUE;

COMMENT ON TABLE trinks_service_professionals IS
  'Compatibilidade local entre servicos e profissionais Trinks.';

CREATE TABLE IF NOT EXISTS trinks_slots (
  professional_id   VARCHAR(64) NOT NULL
                    REFERENCES trinks_professionals(trinks_id) ON DELETE CASCADE,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ,
  available         BOOLEAN     NOT NULL DEFAULT TRUE,
  raw               JSONB       NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (professional_id, starts_at),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_trinks_slots_available_time
  ON trinks_slots(starts_at, professional_id)
  WHERE available = TRUE;

COMMENT ON TABLE trinks_slots IS
  'Snapshot local de horarios por profissional; compatibilidade de servico e validada separadamente.';

CREATE TABLE IF NOT EXISTS trinks_slot_snapshot_runs (
  snapshot_date DATE PRIMARY KEY,
  slot_count    INTEGER     NOT NULL DEFAULT 0 CHECK (slot_count >= 0),
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trinks_slot_snapshot_runs IS
  'Cobertura de snapshots de horario, inclusive dias sincronizados sem vagas.';

CREATE TABLE IF NOT EXISTS trinks_clients (
  trinks_id         VARCHAR(64)  PRIMARY KEY,
  phone             VARCHAR(20),
  name              VARCHAR(160),
  email             VARCHAR(200),
  birth_date        DATE,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  raw               JSONB        NOT NULL DEFAULT '{}'::JSONB,
  deleted_at        TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinks_clients_phone
  ON trinks_clients(phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE trinks_clients IS
  'Snapshot local de clientes Trinks, inclusive registros ainda sem telefone conhecido.';

ALTER TABLE trinks_appointments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trinks_appointments_client_future_active
  ON trinks_appointments(client_phone, scheduled_at)
  WHERE client_phone IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS trinks_webhook_events (
  message_id      VARCHAR(160) PRIMARY KEY,
  topic_arn       TEXT         NOT NULL,
  message_type    VARCHAR(40)  NOT NULL,
  event_id        INTEGER,
  action_id       INTEGER,
  subject         TEXT,
  envelope        JSONB        NOT NULL,
  message_payload JSONB,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'processing'
                    CHECK (processing_status IN ('processing', 'processed', 'failed')),
  attempts         INTEGER      NOT NULL DEFAULT 1 CHECK (attempts > 0),
  error           TEXT,
  received_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trinks_webhook_events_received
  ON trinks_webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_trinks_webhook_events_pending
  ON trinks_webhook_events(received_at)
  WHERE processing_status <> 'processed';

CREATE TABLE IF NOT EXISTS trinks_api_requests (
  id           BIGSERIAL   PRIMARY KEY,
  method       VARCHAR(12) NOT NULL,
  endpoint     TEXT        NOT NULL,
  origin       VARCHAR(80) NOT NULL,
  http_status  INTEGER,
  consumed     BOOLEAN     NOT NULL DEFAULT FALSE,
  latency_ms   INTEGER     CHECK (latency_ms IS NULL OR latency_ms >= 0),
  metadata     JSONB       NOT NULL DEFAULT '{}'::JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinks_api_requests_month
  ON trinks_api_requests(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_trinks_api_requests_origin_endpoint
  ON trinks_api_requests(origin, endpoint, requested_at DESC);

CREATE TABLE IF NOT EXISTS trinks_consumption_snapshots (
  id          BIGSERIAL   PRIMARY KEY,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan_name   TEXT,
  quota_total INTEGER,
  total_used  INTEGER,
  remaining   INTEGER,
  local_consumed_at_check INTEGER NOT NULL DEFAULT 0,
  consistent  BOOLEAN     NOT NULL DEFAULT FALSE,
  raw         JSONB       NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_trinks_consumption_snapshots_checked
  ON trinks_consumption_snapshots(checked_at DESC);

COMMIT;
