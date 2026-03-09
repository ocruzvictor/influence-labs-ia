-- Forecast model for volume/cost using Trinks + WhatsApp operational data.
-- Idempotent script: safe to run multiple times.
-- Database: influence_labs_salon

\c influence_labs_salon;

-- Rebuild dependent views to allow schema evolution without manual cleanup.
DROP VIEW IF EXISTS vw_forecast_monitoring_weekly;
DROP VIEW IF EXISTS vw_forecast_projection_summary;
DROP VIEW IF EXISTS vw_forecast_projection_daily;
DROP VIEW IF EXISTS vw_forecast_baseline;
DROP VIEW IF EXISTS vw_forecast_observed_daily;
DROP VIEW IF EXISTS vw_forecast_cost_daily;
DROP VIEW IF EXISTS vw_forecast_volume_daily;
DROP VIEW IF EXISTS vw_trinks_appointments_90d_summary;
DROP VIEW IF EXISTS vw_trinks_appointments_90d_daily;
DROP VIEW IF EXISTS vw_forecast_booking_daily;
DROP VIEW IF EXISTS vw_trinks_events_normalized;

-- ---------------------------------------------------------------------------
-- 1) Configuration tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS forecast_parameters (
  param_key TEXT PRIMARY KEY,
  param_value_numeric NUMERIC,
  param_value_text TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO forecast_parameters (param_key, param_value_numeric)
VALUES
  ('history_window_days', 28),
  ('horizon_days_max', 90),
  ('confidence_z', 1.96),
  ('fixed_monthly_cost', 114.09),
  ('llm_cost_per_1k_tokens', 0)
ON CONFLICT (param_key) DO UPDATE
SET
  param_value_numeric = EXCLUDED.param_value_numeric,
  updated_at = NOW();

INSERT INTO forecast_parameters (param_key, param_value_text)
VALUES ('model_reference_date', '2026-03-05')
ON CONFLICT (param_key) DO UPDATE
SET
  param_value_text = EXCLUDED.param_value_text,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS forecast_meta_tariff (
  category VARCHAR(20) NOT NULL CHECK (category IN ('utility', 'service', 'marketing')),
  unit_cost NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  PRIMARY KEY (category, effective_from)
);

-- Defaults from docs/strategy/studio-tirra-planejamento-financeiro.csv
INSERT INTO forecast_meta_tariff (category, unit_cost, effective_from, effective_to)
VALUES
  ('utility', 0.04, DATE '2026-03-05', NULL),
  ('service', 0.00, DATE '2026-03-05', NULL),
  ('marketing', 0.33, DATE '2026-03-05', NULL)
ON CONFLICT (category, effective_from) DO UPDATE
SET
  unit_cost = EXCLUDED.unit_cost,
  effective_to = EXCLUDED.effective_to;

CREATE TABLE IF NOT EXISTS forecast_intent_category_map (
  intent VARCHAR(30) PRIMARY KEY,
  category VARCHAR(20) NOT NULL CHECK (category IN ('utility', 'service', 'marketing')),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO forecast_intent_category_map (intent, category)
VALUES
  ('agendamento', 'utility'),
  ('faq', 'utility'),
  ('reclamacao', 'utility'),
  ('humano', 'service'),
  ('vendas', 'marketing'),
  ('proactive', 'marketing')
ON CONFLICT (intent) DO UPDATE
SET
  category = EXCLUDED.category,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS forecast_scenario_factors (
  scenario VARCHAR(20) PRIMARY KEY CHECK (scenario IN ('conservador', 'base', 'agressivo')),
  volume_multiplier NUMERIC(8,4) NOT NULL CHECK (volume_multiplier > 0),
  meta_cost_multiplier NUMERIC(8,4) NOT NULL CHECK (meta_cost_multiplier > 0),
  llm_cost_multiplier NUMERIC(8,4) NOT NULL CHECK (llm_cost_multiplier > 0),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO forecast_scenario_factors (
  scenario,
  volume_multiplier,
  meta_cost_multiplier,
  llm_cost_multiplier
)
VALUES
  ('conservador', 0.85, 0.85, 0.85),
  ('base', 1.00, 1.00, 1.00),
  ('agressivo', 1.20, 1.20, 1.20)
ON CONFLICT (scenario) DO UPDATE
SET
  volume_multiplier = EXCLUDED.volume_multiplier,
  meta_cost_multiplier = EXCLUDED.meta_cost_multiplier,
  llm_cost_multiplier = EXCLUDED.llm_cost_multiplier,
  updated_at = NOW();

-- Proxy ratios para modo bookings-first
-- Usados quando conversation_history / proactive_messages estao vazios (sem historico legado).
-- Premissas explicitas: msg_utility estimada por booking criado, conv_service como fracao de bookings,
-- msg_marketing = zero controlado ate dados reais de proactive_messages.
CREATE TABLE IF NOT EXISTS forecast_booking_ratios (
  param_key TEXT PRIMARY KEY,
  param_value NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO forecast_booking_ratios (param_key, param_value, description)
VALUES
  ('msg_utility_per_booking_created', 3.0,
   'Mensagens utility estimadas por agendamento criado (proxy sem conversation_history). Ex: 3 = confirmacao + lembrete + pos-atendimento.'),
  ('conv_service_rate', 1.0,
   'Fracao de bookings criados que geram conv_service iniciada pelo cliente (proxy sem conversation_history). 1.0 = 100%, assume que todo agendamento foi iniciado pelo cliente via WhatsApp.'),
  ('msg_marketing_monthly_baseline', 0.0,
   'Volume mensal base de msg_marketing quando proactive_messages indisponivel. Zero controlado: premissa explicita de ausencia de campanhas de reativacao na fase atual.')
ON CONFLICT (param_key) DO UPDATE
SET
  param_value = EXCLUDED.param_value,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2) Normalized Trinks events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_trinks_events_normalized AS
WITH raw_events AS (
  SELECT
    e.id,
    e.created_at,
    e.external_id,
    e.payload,
    LOWER(
      COALESCE(
        NULLIF(e.payload->>'action', ''),
        NULLIF(e.payload->>'event', ''),
        NULLIF(e.payload->>'type', ''),
        NULLIF(e.event_type, ''),
        'unknown'
      )
    ) AS raw_event
  FROM trinks_sync_events e
),
staged AS (
  SELECT
    r.id,
    r.created_at,
    COALESCE(
      NULLIF(r.payload->>'appointment_id', ''),
      NULLIF(r.payload->>'appointmentId', ''),
      NULLIF(r.payload->>'id', ''),
      NULLIF(r.external_id, '')
    ) AS appointment_ref,
    REGEXP_REPLACE(
      COALESCE(
        NULLIF(r.payload->>'phone', ''),
        NULLIF(r.payload#>>'{client,phone}', ''),
        NULLIF(r.payload#>>'{customer,phone}', ''),
        ''
      ),
      '[^0-9]',
      '',
      'g'
    ) AS client_phone,
    r.raw_event,
    LOWER(
      COALESCE(
        NULLIF(r.payload->>'status', ''),
        NULLIF(r.payload#>>'{appointment,status}', ''),
        NULLIF(r.payload#>>'{appointmentStatus}', ''),
        ''
      )
    ) AS payload_status,
    CASE
      WHEN r.raw_event LIKE '%no_show%' OR r.raw_event LIKE '%noshow%' OR r.raw_event LIKE '%nao_compareceu%' THEN 'no_show'
      WHEN LOWER(
        COALESCE(
          NULLIF(r.payload->>'status', ''),
          NULLIF(r.payload#>>'{appointment,status}', ''),
          NULLIF(r.payload#>>'{appointmentStatus}', ''),
          ''
        )
      ) IN ('no_show', 'noshow', 'nao_compareceu') THEN 'no_show'
      WHEN r.raw_event LIKE '%confirm%' THEN 'confirmed'
      WHEN LOWER(
        COALESCE(
          NULLIF(r.payload->>'status', ''),
          NULLIF(r.payload#>>'{appointment,status}', ''),
          NULLIF(r.payload#>>'{appointmentStatus}', ''),
          ''
        )
      ) IN ('confirmed', 'confirmado', 'confirmada') THEN 'confirmed'
      WHEN r.raw_event LIKE '%rebook%' OR r.raw_event LIKE '%remarc%' THEN 'rebooked'
      WHEN r.raw_event LIKE '%cancel%' THEN 'cancelled'
      WHEN r.raw_event LIKE '%create%' OR r.raw_event LIKE '%book%' OR r.raw_event LIKE '%agend%' THEN 'created'
      ELSE 'unknown'
    END AS event_stage,
    CASE
      WHEN r.raw_event LIKE '%error%' OR r.raw_event LIKE '%fail%' THEN 'error'
      WHEN LOWER(COALESCE(NULLIF(r.payload->>'success', ''), 'true')) IN ('false', '0', 'no') THEN 'error'
      ELSE 'success'
    END AS status,
    CASE
      WHEN COALESCE(r.payload->>'retry_count', '') ~ '^[0-9]+$' THEN (r.payload->>'retry_count')::INT
      WHEN COALESCE(r.payload->>'attempt', '') ~ '^[0-9]+$' THEN GREATEST((r.payload->>'attempt')::INT - 1, 0)
      ELSE 0
    END AS retry_count
  FROM raw_events r
),
mapped AS (
  SELECT
    s.id,
    s.created_at,
    s.appointment_ref,
    s.client_phone,
    s.raw_event,
    s.payload_status,
    s.event_stage,
    CASE
      WHEN s.event_stage = 'rebooked' THEN 'rebook'
      WHEN s.event_stage = 'cancelled' THEN 'cancel'
      WHEN s.event_stage = 'created' THEN 'create'
      WHEN s.event_stage = 'confirmed' THEN 'confirm'
      WHEN s.event_stage = 'no_show' THEN 'no_show'
      ELSE 'unknown'
    END AS operation,
    s.status,
    s.retry_count
  FROM staged s
)
SELECT
  id,
  created_at,
  DATE(created_at) AS event_day,
  appointment_ref,
  client_phone,
  raw_event,
  payload_status,
  event_stage,
  operation,
  status,
  retry_count
FROM mapped;

-- ---------------------------------------------------------------------------
-- 3) Daily booking KPIs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_booking_daily AS
WITH trinks_agg AS (
  SELECT
    event_day AS day,
    COUNT(*) FILTER (WHERE event_stage = 'created' AND status = 'success') AS bookings_created,
    COUNT(*) FILTER (WHERE event_stage = 'confirmed' AND status = 'success') AS bookings_confirmed,
    COUNT(*) FILTER (WHERE event_stage = 'rebooked' AND status = 'success') AS bookings_rebooked,
    COUNT(*) FILTER (WHERE event_stage = 'cancelled' AND status = 'success') AS bookings_cancelled,
    COUNT(*) FILTER (WHERE event_stage = 'no_show' AND status = 'success') AS bookings_no_show,
    COUNT(DISTINCT client_phone) FILTER (
      WHERE event_stage IN ('created', 'confirmed', 'rebooked', 'cancelled', 'no_show')
        AND client_phone IS NOT NULL
        AND client_phone <> ''
    ) AS unique_clients_trinks,
    COUNT(*) FILTER (WHERE event_stage IN ('created', 'confirmed', 'rebooked', 'cancelled', 'no_show') AND status = 'success') AS booking_success_events,
    COUNT(*) FILTER (WHERE event_stage IN ('created', 'confirmed', 'rebooked', 'cancelled', 'no_show') AND status = 'error') AS booking_error_events,
    SUM(retry_count) FILTER (WHERE event_stage IN ('created', 'confirmed', 'rebooked', 'cancelled', 'no_show')) AS booking_retry_events,
    COUNT(*) FILTER (WHERE event_stage IN ('created', 'confirmed', 'rebooked', 'cancelled', 'no_show')) AS booking_total_events
  FROM vw_trinks_events_normalized
  GROUP BY event_day
),
proxy_agg AS (
  SELECT
    DATE(created_at) AS day,
    COUNT(*) FILTER (WHERE agent = 'receptionist_agendar') AS bookings_create_proxy,
    COUNT(*) FILTER (WHERE agent = 'receptionist_reagendar') AS bookings_rebook_proxy,
    COUNT(*) FILTER (WHERE agent = 'receptionist_cancelar') AS bookings_cancel_proxy
  FROM conversation_history
  WHERE role = 'assistant'
    AND agent LIKE 'receptionist_%'
  GROUP BY DATE(created_at)
),
day_index AS (
  SELECT day FROM trinks_agg
  UNION
  SELECT day FROM proxy_agg
)
SELECT
  d.day,
  COALESCE(t.bookings_created, 0) AS bookings_created,
  COALESCE(t.bookings_confirmed, 0) AS bookings_confirmed,
  COALESCE(t.bookings_rebooked, 0) AS bookings_rebooked,
  COALESCE(t.bookings_cancelled, 0) AS bookings_cancelled,
  COALESCE(t.bookings_no_show, 0) AS bookings_no_show,
  COALESCE(t.unique_clients_trinks, 0) AS unique_clients_trinks,
  COALESCE(t.booking_success_events, 0) AS booking_success_events,
  COALESCE(t.booking_error_events, 0) AS booking_error_events,
  COALESCE(t.booking_retry_events, 0) AS booking_retry_events,
  COALESCE(t.booking_total_events, 0) AS booking_total_events,
  COALESCE(p.bookings_create_proxy, 0) AS bookings_create_proxy,
  COALESCE(p.bookings_rebook_proxy, 0) AS bookings_rebook_proxy,
  COALESCE(p.bookings_cancel_proxy, 0) AS bookings_cancel_proxy,
  CASE
    WHEN COALESCE(t.booking_total_events, 0) > 0
      THEN ROUND((COALESCE(t.booking_success_events, 0)::NUMERIC / t.booking_total_events::NUMERIC), 4)
    ELSE NULL
  END AS booking_success_rate,
  CASE
    WHEN COALESCE(t.booking_total_events, 0) > 0
      THEN ROUND((COALESCE(t.booking_error_events, 0)::NUMERIC / t.booking_total_events::NUMERIC), 4)
    ELSE NULL
  END AS booking_error_rate,
  CASE
    WHEN COALESCE(t.booking_total_events, 0) > 0
      THEN ROUND((COALESCE(t.booking_retry_events, 0)::NUMERIC / t.booking_total_events::NUMERIC), 4)
    ELSE NULL
  END AS booking_retry_rate,
  CASE
    WHEN COALESCE(t.booking_total_events, 0) > 0 THEN COALESCE(NULLIF(t.bookings_confirmed, 0), t.bookings_created, 0)
    ELSE COALESCE(p.bookings_create_proxy, 0)
  END AS bookings_created_effective
FROM day_index d
LEFT JOIN trinks_agg t ON t.day = d.day
LEFT JOIN proxy_agg p ON p.day = d.day;

CREATE OR REPLACE VIEW vw_trinks_appointments_90d_daily AS
SELECT
  event_day AS day,
  COUNT(*) FILTER (WHERE event_stage = 'created' AND status = 'success') AS created_count,
  COUNT(*) FILTER (WHERE event_stage = 'confirmed' AND status = 'success') AS confirmed_count,
  COUNT(*) FILTER (WHERE event_stage = 'cancelled' AND status = 'success') AS cancelled_count,
  COUNT(*) FILTER (WHERE event_stage = 'rebooked' AND status = 'success') AS rebooked_count,
  COUNT(*) FILTER (WHERE event_stage = 'no_show' AND status = 'success') AS no_show_count,
  COUNT(DISTINCT client_phone) FILTER (
    WHERE event_stage IN ('created', 'confirmed', 'cancelled', 'rebooked', 'no_show')
      AND client_phone IS NOT NULL
      AND client_phone <> ''
  ) AS unique_clients
FROM vw_trinks_events_normalized
WHERE event_day >= CURRENT_DATE - 89
GROUP BY event_day
ORDER BY event_day;

CREATE OR REPLACE VIEW vw_trinks_appointments_90d_summary AS
SELECT
  COUNT(*) FILTER (WHERE event_stage = 'created' AND status = 'success') AS created_count,
  COUNT(*) FILTER (WHERE event_stage = 'confirmed' AND status = 'success') AS confirmed_count,
  COUNT(*) FILTER (WHERE event_stage = 'cancelled' AND status = 'success') AS cancelled_count,
  COUNT(*) FILTER (WHERE event_stage = 'rebooked' AND status = 'success') AS rebooked_count,
  COUNT(*) FILTER (WHERE event_stage = 'no_show' AND status = 'success') AS no_show_count,
  COUNT(DISTINCT client_phone) FILTER (
    WHERE event_stage IN ('created', 'confirmed', 'cancelled', 'rebooked', 'no_show')
      AND client_phone IS NOT NULL
      AND client_phone <> ''
  ) AS unique_clients
FROM vw_trinks_events_normalized
WHERE event_day >= CURRENT_DATE - 89;

-- ---------------------------------------------------------------------------
-- 4) Daily volume KPIs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_volume_daily AS
WITH intent_agg AS (
  SELECT
    DATE(created_at) AS day,
    intent,
    COUNT(*) AS message_count
  FROM conversation_history
  WHERE role = 'assistant'
    AND intent IS NOT NULL
  GROUP BY DATE(created_at), intent
),
intent_pivot AS (
  SELECT
    day,
    SUM(message_count) AS assistant_messages_total,
    SUM(message_count) FILTER (WHERE intent = 'agendamento') AS intent_agendamento,
    SUM(message_count) FILTER (WHERE intent = 'faq') AS intent_faq,
    SUM(message_count) FILTER (WHERE intent = 'vendas') AS intent_vendas,
    SUM(message_count) FILTER (WHERE intent = 'reclamacao') AS intent_reclamacao,
    SUM(message_count) FILTER (WHERE intent = 'humano') AS intent_humano
  FROM intent_agg
  GROUP BY day
),
proactive_agg AS (
  SELECT
    DATE(sent_at) AS day,
    COUNT(*) FILTER (WHERE status = 'sent') AS proactive_message_volume,
    COUNT(*) FILTER (WHERE status = 'sent' AND type = 'reminder') AS proactive_reminder_volume,
    COUNT(*) FILTER (WHERE status = 'sent' AND type = 'followup') AS proactive_followup_volume,
    COUNT(*) FILTER (WHERE status = 'sent' AND type = 'reactivation') AS proactive_reactivation_volume
  FROM proactive_messages
  GROUP BY DATE(sent_at)
),
conversation_starts AS (
  SELECT
    DATE(created_at) AS day,
    client_phone,
    MIN(created_at) AS first_event_at
  FROM conversation_history
  WHERE client_phone IS NOT NULL
    AND client_phone <> ''
  GROUP BY DATE(created_at), client_phone
),
service_conv AS (
  SELECT
    cs.day,
    COUNT(*) FILTER (
      WHERE (
        SELECT ch.role
        FROM conversation_history ch
        WHERE ch.client_phone = cs.client_phone
          AND DATE(ch.created_at) = cs.day
        ORDER BY ch.created_at ASC, ch.id ASC
        LIMIT 1
      ) IN ('user', 'client', 'customer')
    ) AS conv_service
  FROM conversation_starts cs
  GROUP BY cs.day
),
-- Detecta disponibilidade de historico na janela de 90 dias.
-- Controla qual modo de calculo usar: 'observed' vs 'bookings_first_proxy'.
data_availability AS (
  SELECT
    (SELECT COUNT(*) FROM conversation_history
      WHERE created_at >= CURRENT_DATE - 90) > 0 AS conv_history_available,
    (SELECT COUNT(*) FROM proactive_messages
      WHERE sent_at >= CURRENT_DATE - 90) > 0 AS proactive_available
),
-- Parametros de proxy bookings-first (da tabela forecast_booking_ratios)
booking_ratios AS (
  SELECT
    COALESCE(MAX(CASE WHEN param_key = 'msg_utility_per_booking_created'  THEN param_value END), 3.0) AS msg_utility_per_booking,
    COALESCE(MAX(CASE WHEN param_key = 'conv_service_rate'                THEN param_value END), 1.0) AS conv_service_rate,
    COALESCE(MAX(CASE WHEN param_key = 'msg_marketing_monthly_baseline'   THEN param_value END), 0.0) AS msg_marketing_monthly_baseline
  FROM forecast_booking_ratios
),
day_index AS (
  SELECT day FROM intent_pivot
  UNION
  SELECT day FROM proactive_agg
  UNION
  SELECT day FROM service_conv
  UNION
  SELECT day FROM vw_forecast_booking_daily
)
SELECT
  d.day,
  COALESCE(i.assistant_messages_total, 0) AS assistant_messages_total,
  COALESCE(i.intent_agendamento, 0) AS intent_agendamento,
  COALESCE(i.intent_faq, 0) AS intent_faq,
  COALESCE(i.intent_vendas, 0) AS intent_vendas,
  COALESCE(i.intent_reclamacao, 0) AS intent_reclamacao,
  COALESCE(i.intent_humano, 0) AS intent_humano,
  COALESCE(p.proactive_message_volume, 0) AS proactive_message_volume,
  COALESCE(p.proactive_reminder_volume, 0) AS proactive_reminder_volume,
  COALESCE(p.proactive_followup_volume, 0) AS proactive_followup_volume,
  COALESCE(p.proactive_reactivation_volume, 0) AS proactive_reactivation_volume,
  COALESCE(b.bookings_created, 0) AS bookings_created,
  COALESCE(b.bookings_confirmed, 0) AS bookings_confirmed,
  COALESCE(b.bookings_rebooked, 0) AS bookings_rebooked,
  COALESCE(b.bookings_cancelled, 0) AS bookings_cancelled,
  COALESCE(b.bookings_no_show, 0) AS bookings_no_show,
  COALESCE(b.unique_clients_trinks, 0) AS unique_clients_trinks,
  -- conv_service: observado quando disponivel, proxy via taxa de booking quando nao ha historico
  CASE
    WHEN da.conv_history_available THEN COALESCE(s.conv_service, 0)
    ELSE ROUND(COALESCE(b.bookings_created, 0) * r.conv_service_rate)
  END AS conv_service,
  -- msg_utility: observado quando disponivel, proxy N msgs/booking-criado quando nao ha historico
  CASE
    WHEN da.conv_history_available
      THEN (COALESCE(b.bookings_confirmed, 0)
            + COALESCE(p.proactive_reminder_volume, 0)
            + COALESCE(p.proactive_followup_volume, 0))
    ELSE ROUND(COALESCE(b.bookings_created, 0) * r.msg_utility_per_booking)
  END AS msg_utility,
  -- msg_marketing: observado quando disponivel, zero controlado quando nao ha proactive_messages
  CASE
    WHEN da.proactive_available THEN COALESCE(p.proactive_reactivation_volume, 0)
    ELSE 0
  END AS msg_marketing,
  COALESCE(b.bookings_created_effective, 0) AS bookings_created_effective,
  b.booking_success_rate,
  b.booking_error_rate,
  b.booking_retry_rate,
  -- Rastreabilidade do modo de calculo usado neste dia
  CASE
    WHEN da.conv_history_available AND da.proactive_available THEN 'observed'
    WHEN NOT da.conv_history_available                        THEN 'bookings_first_proxy'
    ELSE                                                           'partial_proxy'
  END AS data_source_mode
FROM day_index d
LEFT JOIN intent_pivot i ON i.day = d.day
LEFT JOIN proactive_agg p ON p.day = d.day
LEFT JOIN service_conv s ON s.day = d.day
LEFT JOIN vw_forecast_booking_daily b ON b.day = d.day
CROSS JOIN data_availability da
CROSS JOIN booking_ratios r;

-- ---------------------------------------------------------------------------
-- 5) Daily cost KPIs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_cost_daily AS
WITH model_counts AS (
  SELECT
    day,
    COALESCE(msg_utility, 0) AS utility_messages,
    COALESCE(conv_service, 0) AS service_messages,
    COALESCE(msg_marketing, 0) AS marketing_messages
  FROM vw_forecast_volume_daily
),
llm_metrics AS (
  SELECT
    DATE(measured_at) AS day,
    SUM(
      CASE
        WHEN metric_name IN ('llm_variable_cost', 'llm_cost', 'openai_cost', 'anthropic_cost')
          THEN metric_value
        ELSE 0
      END
    ) AS llm_cost_explicit,
    SUM(
      CASE
        WHEN metric_name IN ('llm_total_tokens', 'llm_input_tokens', 'llm_output_tokens', 'openai_total_tokens', 'anthropic_total_tokens')
          THEN metric_value
        ELSE 0
      END
    ) AS llm_tokens
  FROM metrics
  GROUP BY DATE(measured_at)
),
params AS (
  SELECT
    COALESCE(MAX(CASE WHEN param_key = 'fixed_monthly_cost' THEN param_value_numeric END), 0) AS fixed_monthly_cost,
    COALESCE(MAX(CASE WHEN param_key = 'llm_cost_per_1k_tokens' THEN param_value_numeric END), 0) AS llm_cost_per_1k_tokens
  FROM forecast_parameters
),
day_index AS (
  SELECT day FROM model_counts
  UNION
  SELECT day FROM llm_metrics
  UNION
  SELECT day FROM vw_forecast_booking_daily
)
SELECT
  d.day,
  COALESCE(c.utility_messages, 0) AS utility_messages,
  COALESCE(c.service_messages, 0) AS service_messages,
  COALESCE(c.marketing_messages, 0) AS marketing_messages,
  COALESCE(
    (
      SELECT t.unit_cost
      FROM forecast_meta_tariff t
      WHERE t.category = 'utility'
        AND t.effective_from <= d.day
        AND (t.effective_to IS NULL OR d.day <= t.effective_to)
      ORDER BY t.effective_from DESC
      LIMIT 1
    ),
    0
  ) AS utility_unit_cost,
  COALESCE(
    (
      SELECT t.unit_cost
      FROM forecast_meta_tariff t
      WHERE t.category = 'service'
        AND t.effective_from <= d.day
        AND (t.effective_to IS NULL OR d.day <= t.effective_to)
      ORDER BY t.effective_from DESC
      LIMIT 1
    ),
    0
  ) AS service_unit_cost,
  COALESCE(
    (
      SELECT t.unit_cost
      FROM forecast_meta_tariff t
      WHERE t.category = 'marketing'
        AND t.effective_from <= d.day
        AND (t.effective_to IS NULL OR d.day <= t.effective_to)
      ORDER BY t.effective_from DESC
      LIMIT 1
    ),
    0
  ) AS marketing_unit_cost,
  COALESCE(c.utility_messages, 0)
    * COALESCE(
        (
          SELECT t.unit_cost
          FROM forecast_meta_tariff t
          WHERE t.category = 'utility'
            AND t.effective_from <= d.day
            AND (t.effective_to IS NULL OR d.day <= t.effective_to)
          ORDER BY t.effective_from DESC
          LIMIT 1
        ),
        0
      ) AS meta_cost_utility,
  COALESCE(c.service_messages, 0)
    * COALESCE(
        (
          SELECT t.unit_cost
          FROM forecast_meta_tariff t
          WHERE t.category = 'service'
            AND t.effective_from <= d.day
            AND (t.effective_to IS NULL OR d.day <= t.effective_to)
          ORDER BY t.effective_from DESC
          LIMIT 1
        ),
        0
      ) AS meta_cost_service,
  COALESCE(c.marketing_messages, 0)
    * COALESCE(
        (
          SELECT t.unit_cost
          FROM forecast_meta_tariff t
          WHERE t.category = 'marketing'
            AND t.effective_from <= d.day
            AND (t.effective_to IS NULL OR d.day <= t.effective_to)
          ORDER BY t.effective_from DESC
          LIMIT 1
        ),
        0
      ) AS meta_cost_marketing,
  (
    COALESCE(c.utility_messages, 0)
      * COALESCE(
          (
            SELECT t.unit_cost
            FROM forecast_meta_tariff t
            WHERE t.category = 'utility'
              AND t.effective_from <= d.day
              AND (t.effective_to IS NULL OR d.day <= t.effective_to)
            ORDER BY t.effective_from DESC
            LIMIT 1
          ),
          0
        )
    + COALESCE(c.service_messages, 0)
      * COALESCE(
          (
            SELECT t.unit_cost
            FROM forecast_meta_tariff t
            WHERE t.category = 'service'
              AND t.effective_from <= d.day
              AND (t.effective_to IS NULL OR d.day <= t.effective_to)
            ORDER BY t.effective_from DESC
            LIMIT 1
          ),
          0
        )
    + COALESCE(c.marketing_messages, 0)
      * COALESCE(
          (
            SELECT t.unit_cost
            FROM forecast_meta_tariff t
            WHERE t.category = 'marketing'
              AND t.effective_from <= d.day
              AND (t.effective_to IS NULL OR d.day <= t.effective_to)
            ORDER BY t.effective_from DESC
            LIMIT 1
          ),
          0
        )
  ) AS meta_variable_cost_total,
  CASE
    WHEN COALESCE(l.llm_cost_explicit, 0) > 0 THEN COALESCE(l.llm_cost_explicit, 0)
    WHEN p.llm_cost_per_1k_tokens > 0 THEN (COALESCE(l.llm_tokens, 0) / 1000.0) * p.llm_cost_per_1k_tokens
    ELSE 0
  END AS llm_variable_cost_estimated,
  ROUND((p.fixed_monthly_cost / 30.0), 4) AS fixed_daily_cost_estimated,
  (
    (
      COALESCE(c.utility_messages, 0)
        * COALESCE(
            (
              SELECT t.unit_cost
              FROM forecast_meta_tariff t
              WHERE t.category = 'utility'
                AND t.effective_from <= d.day
                AND (t.effective_to IS NULL OR d.day <= t.effective_to)
              ORDER BY t.effective_from DESC
              LIMIT 1
            ),
            0
          )
      + COALESCE(c.service_messages, 0)
        * COALESCE(
            (
              SELECT t.unit_cost
              FROM forecast_meta_tariff t
              WHERE t.category = 'service'
                AND t.effective_from <= d.day
                AND (t.effective_to IS NULL OR d.day <= t.effective_to)
              ORDER BY t.effective_from DESC
              LIMIT 1
            ),
            0
          )
      + COALESCE(c.marketing_messages, 0)
        * COALESCE(
            (
              SELECT t.unit_cost
              FROM forecast_meta_tariff t
              WHERE t.category = 'marketing'
                AND t.effective_from <= d.day
                AND (t.effective_to IS NULL OR d.day <= t.effective_to)
              ORDER BY t.effective_from DESC
              LIMIT 1
            ),
            0
          )
    )
    + (
      CASE
        WHEN COALESCE(l.llm_cost_explicit, 0) > 0 THEN COALESCE(l.llm_cost_explicit, 0)
        WHEN p.llm_cost_per_1k_tokens > 0 THEN (COALESCE(l.llm_tokens, 0) / 1000.0) * p.llm_cost_per_1k_tokens
        ELSE 0
      END
    )
    + (p.fixed_monthly_cost / 30.0)
  ) AS total_daily_cost_estimated,
  CASE
    WHEN COALESCE(b.bookings_created_effective, 0) > 0
      THEN (
        (
          (
            COALESCE(c.utility_messages, 0)
              * COALESCE(
                  (
                    SELECT t.unit_cost
                    FROM forecast_meta_tariff t
                    WHERE t.category = 'utility'
                      AND t.effective_from <= d.day
                      AND (t.effective_to IS NULL OR d.day <= t.effective_to)
                    ORDER BY t.effective_from DESC
                    LIMIT 1
                  ),
                  0
                )
            + COALESCE(c.service_messages, 0)
              * COALESCE(
                  (
                    SELECT t.unit_cost
                    FROM forecast_meta_tariff t
                    WHERE t.category = 'service'
                      AND t.effective_from <= d.day
                      AND (t.effective_to IS NULL OR d.day <= t.effective_to)
                    ORDER BY t.effective_from DESC
                    LIMIT 1
                  ),
                  0
                )
            + COALESCE(c.marketing_messages, 0)
              * COALESCE(
                  (
                    SELECT t.unit_cost
                    FROM forecast_meta_tariff t
                    WHERE t.category = 'marketing'
                      AND t.effective_from <= d.day
                      AND (t.effective_to IS NULL OR d.day <= t.effective_to)
                    ORDER BY t.effective_from DESC
                    LIMIT 1
                  ),
                  0
                )
          )
          + (
            CASE
              WHEN COALESCE(l.llm_cost_explicit, 0) > 0 THEN COALESCE(l.llm_cost_explicit, 0)
              WHEN p.llm_cost_per_1k_tokens > 0 THEN (COALESCE(l.llm_tokens, 0) / 1000.0) * p.llm_cost_per_1k_tokens
              ELSE 0
            END
          )
  + (p.fixed_monthly_cost / 30.0)
        ) / b.bookings_created_effective::NUMERIC
      )
    ELSE NULL
  END AS cost_per_booking_confirmed
FROM day_index d
LEFT JOIN model_counts c ON c.day = d.day
LEFT JOIN llm_metrics l ON l.day = d.day
LEFT JOIN vw_forecast_booking_daily b ON b.day = d.day
CROSS JOIN params p;

-- ---------------------------------------------------------------------------
-- 6) Consolidated observed daily layer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_observed_daily AS
SELECT
  v.day,
  v.assistant_messages_total,
  v.intent_agendamento,
  v.intent_faq,
  v.intent_vendas,
  v.intent_reclamacao,
  v.intent_humano,
  v.proactive_message_volume,
  v.proactive_reminder_volume,
  v.proactive_followup_volume,
  v.proactive_reactivation_volume,
  v.bookings_created,
  v.bookings_confirmed,
  v.bookings_rebooked,
  v.bookings_cancelled,
  v.bookings_no_show,
  v.unique_clients_trinks,
  v.conv_service,
  v.msg_utility,
  v.msg_marketing,
  v.bookings_created_effective,
  v.booking_success_rate,
  v.booking_error_rate,
  v.booking_retry_rate,
  c.utility_messages,
  c.service_messages,
  c.marketing_messages,
  c.meta_cost_utility,
  c.meta_cost_service,
  c.meta_cost_marketing,
  c.meta_variable_cost_total,
  c.llm_variable_cost_estimated,
  c.fixed_daily_cost_estimated,
  c.total_daily_cost_estimated,
  c.cost_per_booking_confirmed,
  v.data_source_mode
FROM vw_forecast_volume_daily v
JOIN vw_forecast_cost_daily c
  ON c.day = v.day;

-- ---------------------------------------------------------------------------
-- 7) Forecast baseline (rolling window)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_baseline AS
WITH params AS (
  SELECT
    COALESCE(MAX(CASE WHEN param_key = 'history_window_days' THEN param_value_numeric END), 28)::INT AS history_window_days,
    COALESCE(MAX(CASE WHEN param_key = 'confidence_z' THEN param_value_numeric END), 1.96) AS confidence_z
  FROM forecast_parameters
),
windowed AS (
  SELECT o.*
  FROM vw_forecast_observed_daily o
  CROSS JOIN params p
  WHERE o.day >= CURRENT_DATE - (p.history_window_days - 1)
)
SELECT
  p.history_window_days,
  p.confidence_z,
  COUNT(*) AS observed_days,
  MIN(w.day) AS observed_start_day,
  MAX(w.day) AS observed_end_day,
  COALESCE(AVG(w.assistant_messages_total), 0)::NUMERIC(12,4) AS avg_daily_assistant_messages,
  COALESCE(AVG(w.proactive_message_volume), 0)::NUMERIC(12,4) AS avg_daily_proactive_messages,
  COALESCE(AVG(w.msg_utility), 0)::NUMERIC(12,4) AS avg_daily_msg_utility,
  COALESCE(AVG(w.conv_service), 0)::NUMERIC(12,4) AS avg_daily_conv_service,
  COALESCE(AVG(w.msg_marketing), 0)::NUMERIC(12,4) AS avg_daily_msg_marketing,
  COALESCE(AVG(w.bookings_created_effective), 0)::NUMERIC(12,4) AS avg_daily_bookings_created,
  COALESCE(AVG(w.bookings_confirmed), 0)::NUMERIC(12,4) AS avg_daily_bookings_confirmed,
  COALESCE(AVG(w.bookings_no_show), 0)::NUMERIC(12,4) AS avg_daily_bookings_no_show,
  COALESCE(AVG(w.bookings_rebooked), 0)::NUMERIC(12,4) AS avg_daily_bookings_rebooked,
  COALESCE(AVG(w.bookings_cancelled), 0)::NUMERIC(12,4) AS avg_daily_bookings_cancelled,
  COALESCE(AVG(w.meta_variable_cost_total), 0)::NUMERIC(12,4) AS avg_daily_meta_variable_cost,
  COALESCE(AVG(w.llm_variable_cost_estimated), 0)::NUMERIC(12,4) AS avg_daily_llm_variable_cost,
  COALESCE(AVG(w.fixed_daily_cost_estimated), 0)::NUMERIC(12,4) AS avg_daily_fixed_cost,
  COALESCE(AVG(w.total_daily_cost_estimated), 0)::NUMERIC(12,4) AS avg_daily_total_cost,
  COALESCE(STDDEV_SAMP(w.bookings_created_effective), 0)::NUMERIC(12,4) AS stddev_daily_bookings_created,
  COALESCE(STDDEV_SAMP(w.total_daily_cost_estimated), 0)::NUMERIC(12,4) AS stddev_daily_total_cost,
  CASE
    WHEN COUNT(*) >= p.history_window_days THEN 'high'
    WHEN COUNT(*) >= GREATEST((p.history_window_days / 2), 1) THEN 'medium'
    ELSE 'low'
  END AS confidence_level
FROM params p
LEFT JOIN windowed w ON TRUE
GROUP BY p.history_window_days, p.confidence_z;

-- ---------------------------------------------------------------------------
-- 8) Forecast projections (daily and 30/60/90 summary)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_projection_daily AS
WITH params AS (
  SELECT COALESCE(MAX(CASE WHEN param_key = 'horizon_days_max' THEN param_value_numeric END), 90)::INT AS horizon_days_max
  FROM forecast_parameters
),
baseline AS (
  SELECT * FROM vw_forecast_baseline
),
day_series AS (
  SELECT generate_series(1, (SELECT horizon_days_max FROM params))::INT AS day_offset
)
SELECT
  s.scenario,
  (CURRENT_DATE + ds.day_offset) AS forecast_day,
  ds.day_offset,
  CASE
    WHEN ds.day_offset <= 30 THEN 30
    WHEN ds.day_offset <= 60 THEN 60
    ELSE 90
  END AS horizon_bucket_days,
  ROUND(b.avg_daily_assistant_messages * s.volume_multiplier, 4) AS projected_assistant_messages_daily,
  ROUND(b.avg_daily_proactive_messages * s.volume_multiplier, 4) AS projected_proactive_messages_daily,
  ROUND(b.avg_daily_msg_utility * s.volume_multiplier, 4) AS projected_msg_utility_daily,
  ROUND(b.avg_daily_conv_service * s.volume_multiplier, 4) AS projected_conv_service_daily,
  ROUND(b.avg_daily_msg_marketing * s.volume_multiplier, 4) AS projected_msg_marketing_daily,
  ROUND(b.avg_daily_bookings_created * s.volume_multiplier, 4) AS projected_bookings_created_daily,
  ROUND(b.avg_daily_bookings_confirmed * s.volume_multiplier, 4) AS projected_bookings_confirmed_daily,
  ROUND(b.avg_daily_bookings_no_show * s.volume_multiplier, 4) AS projected_bookings_no_show_daily,
  ROUND(b.avg_daily_bookings_rebooked * s.volume_multiplier, 4) AS projected_bookings_rebooked_daily,
  ROUND(b.avg_daily_bookings_cancelled * s.volume_multiplier, 4) AS projected_bookings_cancelled_daily,
  ROUND(b.avg_daily_meta_variable_cost * s.meta_cost_multiplier, 4) AS projected_meta_variable_cost_daily,
  ROUND(b.avg_daily_llm_variable_cost * s.llm_cost_multiplier, 4) AS projected_llm_variable_cost_daily,
  ROUND(b.avg_daily_fixed_cost, 4) AS projected_fixed_cost_daily,
  ROUND(
    (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
    + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
    + b.avg_daily_fixed_cost,
    4
  ) AS projected_total_cost_daily,
  ROUND(
    GREATEST(
      0,
      (b.avg_daily_bookings_created * s.volume_multiplier)
      - (b.confidence_z * b.stddev_daily_bookings_created)
    ),
    4
  ) AS projected_bookings_ci_low_daily,
  ROUND(
    (b.avg_daily_bookings_created * s.volume_multiplier)
    + (b.confidence_z * b.stddev_daily_bookings_created),
    4
  ) AS projected_bookings_ci_high_daily,
  ROUND(
    GREATEST(
      0,
      (
        (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
        + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
        + b.avg_daily_fixed_cost
      )
      - (b.confidence_z * b.stddev_daily_total_cost)
    ),
    4
  ) AS projected_total_cost_ci_low_daily,
  ROUND(
    (
      (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
      + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
      + b.avg_daily_fixed_cost
    )
    + (b.confidence_z * b.stddev_daily_total_cost),
    4
  ) AS projected_total_cost_ci_high_daily,
  b.confidence_level AS baseline_confidence_level,
  b.observed_days AS baseline_observed_days
FROM forecast_scenario_factors s
CROSS JOIN baseline b
CROSS JOIN day_series ds;

CREATE OR REPLACE VIEW vw_forecast_projection_summary AS
WITH baseline AS (
  SELECT * FROM vw_forecast_baseline
),
horizons AS (
  SELECT 30 AS horizon_days
  UNION ALL
  SELECT 60 AS horizon_days
  UNION ALL
  SELECT 90 AS horizon_days
)
SELECT
  s.scenario,
  h.horizon_days,
  ROUND(((b.avg_daily_msg_utility * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_msg_utility,
  ROUND(((b.avg_daily_conv_service * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_conv_service,
  ROUND(((b.avg_daily_msg_marketing * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_msg_marketing,
  ROUND(((b.avg_daily_bookings_created * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_bookings_created,
  ROUND(((b.avg_daily_bookings_confirmed * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_bookings_confirmed,
  ROUND(((b.avg_daily_bookings_no_show * s.volume_multiplier) * h.horizon_days)::NUMERIC, 2) AS forecast_bookings_no_show,
  ROUND(
    GREATEST(
      0,
      ((b.avg_daily_bookings_created * s.volume_multiplier) * h.horizon_days)
      - (b.confidence_z * b.stddev_daily_bookings_created * SQRT(h.horizon_days))
    )::NUMERIC,
    2
  ) AS forecast_bookings_ci_low,
  ROUND(
    (
      ((b.avg_daily_bookings_created * s.volume_multiplier) * h.horizon_days)
      + (b.confidence_z * b.stddev_daily_bookings_created * SQRT(h.horizon_days))
    )::NUMERIC,
    2
  ) AS forecast_bookings_ci_high,
  ROUND(
    (
      (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
      + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
      + b.avg_daily_fixed_cost
    )::NUMERIC * h.horizon_days,
    2
  ) AS forecast_total_cost,
  ROUND(
    GREATEST(
      0,
      (
        (
          (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
          + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
          + b.avg_daily_fixed_cost
        ) * h.horizon_days
      ) - (b.confidence_z * b.stddev_daily_total_cost * SQRT(h.horizon_days))
    )::NUMERIC,
    2
  ) AS forecast_total_cost_ci_low,
  ROUND(
    (
      (
        (
          (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
          + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
          + b.avg_daily_fixed_cost
        ) * h.horizon_days
      ) + (b.confidence_z * b.stddev_daily_total_cost * SQRT(h.horizon_days))
    )::NUMERIC,
    2
  ) AS forecast_total_cost_ci_high,
  ROUND(
    (
      (
        (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
        + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
        + b.avg_daily_fixed_cost
      ) * h.horizon_days
    )::NUMERIC / (h.horizon_days / 30.0),
    2
  ) AS forecast_avg_monthly_cost,
  ROUND(
    (
      (
        (b.avg_daily_meta_variable_cost * s.meta_cost_multiplier)
        + (b.avg_daily_llm_variable_cost * s.llm_cost_multiplier)
        + b.avg_daily_fixed_cost
      ) * h.horizon_days
    )::NUMERIC / NULLIF(((b.avg_daily_bookings_created * s.volume_multiplier) * h.horizon_days), 0),
    2
  ) AS forecast_cost_per_booking,
  b.confidence_level AS baseline_confidence_level,
  b.observed_days AS baseline_observed_days,
  b.observed_start_day,
  b.observed_end_day
FROM forecast_scenario_factors s
CROSS JOIN baseline b
CROSS JOIN horizons h
ORDER BY s.scenario, h.horizon_days;

-- ---------------------------------------------------------------------------
-- 9) Weekly monitoring view (actual vs base forecast)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_forecast_monitoring_weekly AS
WITH actual AS (
  SELECT
    DATE_TRUNC('week', day)::DATE AS week_start,
    SUM(msg_utility) AS actual_msg_utility,
    SUM(conv_service) AS actual_conv_service,
    SUM(msg_marketing) AS actual_msg_marketing,
    SUM(bookings_created_effective) AS actual_bookings,
    AVG(booking_success_rate) AS actual_booking_success_rate,
    AVG(booking_error_rate) AS actual_booking_error_rate,
    SUM(total_daily_cost_estimated) AS actual_total_cost
  FROM vw_forecast_observed_daily
  GROUP BY DATE_TRUNC('week', day)::DATE
),
forecast_base AS (
  SELECT
    DATE_TRUNC('week', forecast_day)::DATE AS week_start,
    SUM(projected_msg_utility_daily) AS forecast_msg_utility,
    SUM(projected_conv_service_daily) AS forecast_conv_service,
    SUM(projected_msg_marketing_daily) AS forecast_msg_marketing,
    SUM(projected_bookings_created_daily) AS forecast_bookings,
    SUM(projected_total_cost_daily) AS forecast_total_cost
  FROM vw_forecast_projection_daily
  WHERE scenario = 'base'
  GROUP BY DATE_TRUNC('week', forecast_day)::DATE
)
SELECT
  a.week_start,
  a.actual_msg_utility,
  f.forecast_msg_utility,
  a.actual_conv_service,
  f.forecast_conv_service,
  a.actual_msg_marketing,
  f.forecast_msg_marketing,
  a.actual_bookings,
  f.forecast_bookings,
  ROUND((a.actual_bookings - COALESCE(f.forecast_bookings, 0))::NUMERIC, 2) AS bookings_delta_abs,
  ROUND(
    CASE
      WHEN COALESCE(f.forecast_bookings, 0) > 0
        THEN ((a.actual_bookings - f.forecast_bookings) / f.forecast_bookings::NUMERIC) * 100
      ELSE NULL
    END,
    2
  ) AS bookings_delta_pct,
  ROUND(a.actual_total_cost::NUMERIC, 2) AS actual_total_cost,
  ROUND(COALESCE(f.forecast_total_cost, 0)::NUMERIC, 2) AS forecast_total_cost,
  ROUND((a.actual_total_cost - COALESCE(f.forecast_total_cost, 0))::NUMERIC, 2) AS total_cost_delta_abs,
  ROUND(
    CASE
      WHEN COALESCE(f.forecast_total_cost, 0) > 0
        THEN ((a.actual_total_cost - f.forecast_total_cost) / f.forecast_total_cost::NUMERIC) * 100
      ELSE NULL
    END,
    2
  ) AS total_cost_delta_pct,
  ROUND(a.actual_booking_success_rate::NUMERIC, 4) AS actual_booking_success_rate,
  ROUND(a.actual_booking_error_rate::NUMERIC, 4) AS actual_booking_error_rate
FROM actual a
LEFT JOIN forecast_base f
  ON f.week_start = a.week_start
ORDER BY a.week_start DESC;
