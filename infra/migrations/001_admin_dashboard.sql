-- =============================================================================
-- Migration: 001_admin_dashboard
-- Purpose:   Schemas para Studio Tirra Admin Dashboard MVP
-- Author:    @data-engineer Dara
-- Date:      2026-05-26
-- Epic:      EPIC-studio-tirra-admin-dashboard.md
-- Spec:      docs/architecture/admin-dashboard.md (§5)
-- Apply on:  database `influence_labs_salon`
-- Rollback:  infra/migrations/001_admin_dashboard.rollback.sql
-- =============================================================================
--
-- Convenções desta migration:
--   • Idempotente — safe to re-run via IF NOT EXISTS
--   • UUID + TIMESTAMPTZ (domínio admin diferente do legado SERIAL/TIMESTAMP)
--   • Foreign keys com ON DELETE explícito
--   • Audit fields (created_at, updated_at) em toda tabela mutável
--   • Append-only tables: audit_log, kb_versions, magic_link_tokens
--   • Comentários COMMENT ON pra documentação embebida
--
-- Pré-requisitos:
--   • PostgreSQL >= 13 (gen_random_uuid nativo)
--   • Database `influence_labs_salon` já existente
--   • Tabela `conversation_history(client_phone, ...)` existente (referenciada por views)
-- =============================================================================

\c influence_labs_salon;

BEGIN;

-- -----------------------------------------------------------------------------
-- Trigger function reutilizável: atualiza updated_at em UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION admin_set_updated_at IS
  'Trigger function: seta updated_at = NOW() em qualquer UPDATE. Usada por todas as tabelas admin_*.';

-- =============================================================================
-- 1. admin_users — Usuários do painel
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT         UNIQUE NOT NULL,
  name         TEXT         NOT NULL,
  role         TEXT         NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email_active
  ON admin_users(email)
  WHERE active = TRUE;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMENT ON TABLE admin_users IS
  'Usuários autorizados do painel admin. MVP: roles "admin" (full access) e "viewer" (read-only).';
COMMENT ON COLUMN admin_users.email IS 'Email único, normalizado lowercase pela aplicação';
COMMENT ON COLUMN admin_users.active IS 'Soft-disable: FALSE bloqueia login sem deletar histórico';

-- =============================================================================
-- 2. magic_link_tokens — Tokens single-use de login (TTL 15min)
-- =============================================================================
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash    TEXT         PRIMARY KEY,  -- sha256(token) hex — NUNCA armazenar plaintext
  user_id       UUID         NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ  NOT NULL,
  consumed_at   TIMESTAMPTZ,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_expires
  ON magic_link_tokens(expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_magic_link_user_created
  ON magic_link_tokens(user_id, created_at DESC);

COMMENT ON TABLE magic_link_tokens IS
  'Tokens single-use de magic link. Plaintext nunca armazenado — apenas sha256 hex.';
COMMENT ON COLUMN magic_link_tokens.token_hash IS 'sha256(token_plaintext) em hex (64 chars)';
COMMENT ON COLUMN magic_link_tokens.consumed_at IS 'NULL = válido; preenchido = já usado (single-use enforcement)';

-- =============================================================================
-- 3. admin_sessions — Sessions JWT com jti pra revogação
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  jti            UUID         PRIMARY KEY,
  user_id        UUID         NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ  NOT NULL,
  last_seen_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,
  device_label   TEXT,
  ip_address     INET
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_active
  ON admin_sessions(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_active
  ON admin_sessions(expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE admin_sessions IS
  'Tracking de sessions JWT ativas. jti = JWT ID; permite revogação server-side sem invalidar secret.';
COMMENT ON COLUMN admin_sessions.jti IS 'JWT ID — claim "jti" do token, lookup em cada request';
COMMENT ON COLUMN admin_sessions.revoked_at IS 'NULL = ativa; preenchido = revogada (logout, admin force-logout)';

-- =============================================================================
-- 4. admin_audit_log — Log append-only de mutações
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  action       TEXT         NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  payload      JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time
  ON admin_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action_time
  ON admin_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_target
  ON admin_audit_log(target_type, target_id)
  WHERE target_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_created_brin
  ON admin_audit_log USING BRIN (created_at);

COMMENT ON TABLE admin_audit_log IS
  'Audit append-only. Nunca UPDATE/DELETE — apenas INSERT. BRIN index pra range queries eficientes em série temporal.';
COMMENT ON COLUMN admin_audit_log.action IS
  'Verbo + objeto: login, logout, kb.update, toggle.set, whitelist.add, whitelist.remove, session.revoke, etc';
COMMENT ON COLUMN admin_audit_log.payload IS
  'JSONB com diff ou snapshot do estado. Pra kb.update: {before, after, diff_summary}';

-- Garantir append-only via revoke (defesa em profundidade — opcional, comentado)
-- REVOKE UPDATE, DELETE ON admin_audit_log FROM PUBLIC;

-- =============================================================================
-- 5. bot_toggles — Feature flags do agente
-- =============================================================================
CREATE TABLE IF NOT EXISTS bot_toggles (
  key          TEXT         PRIMARY KEY,
  enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
  description  TEXT,
  updated_by   UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_bot_toggles_updated_at ON bot_toggles;
CREATE TRIGGER trg_bot_toggles_updated_at
  BEFORE UPDATE ON bot_toggles
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMENT ON TABLE bot_toggles IS
  'Feature flags do agente. Backend lê em cada inbound (cache memória 5s).';
COMMENT ON COLUMN bot_toggles.key IS
  'Convenção: snake_case. Ex: "global" (kill switch), "feature:audio", "feature:supervisor"';

-- Seeds iniciais (idempotentes)
INSERT INTO bot_toggles (key, enabled, description) VALUES
  ('global',           TRUE,  'Kill switch global — FALSE silencia o bot completamente'),
  ('feature:audio',    TRUE,  'Transcrição e resposta a mensagens de áudio'),
  ('feature:supervisor', TRUE, 'Supervisor matinal (TESS 46590) ativo')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 6. bot_whitelist — Whitelist/blacklist por número
-- =============================================================================
CREATE TABLE IF NOT EXISTS bot_whitelist (
  phone        VARCHAR(20)  PRIMARY KEY,
  mode         TEXT         NOT NULL CHECK (mode IN ('allow', 'block', 'human_only')),
  reason       TEXT,
  added_by     UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_whitelist_mode
  ON bot_whitelist(mode);

COMMENT ON TABLE bot_whitelist IS
  'Whitelist por número WhatsApp. Modos: allow (sem efeito, documentação), block (bot ignora), human_only (humano responde, bot silencia).';
COMMENT ON COLUMN bot_whitelist.phone IS
  'Formato E.164 sem "+" (padrão Kapso/Meta). Ex: 5511964540007. VARCHAR(20) pra match com clients.phone';

-- =============================================================================
-- 7. kb_items — Knowledge Base items (editável via UI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS kb_items (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT         UNIQUE NOT NULL,
  category     TEXT         NOT NULL CHECK (category IN ('faq', 'servicos', 'regras', 'padroes', 'info')),
  title        TEXT         NOT NULL,
  content_md   TEXT         NOT NULL,
  version      INTEGER      NOT NULL DEFAULT 1,
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  source_file  TEXT,                                          -- caminho original em data/kb/ (migração)
  updated_by   UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_active_category
  ON kb_items(category)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_kb_slug
  ON kb_items(slug);

DROP TRIGGER IF EXISTS trg_kb_items_updated_at ON kb_items;
CREATE TRIGGER trg_kb_items_updated_at
  BEFORE UPDATE ON kb_items
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMENT ON TABLE kb_items IS
  'Knowledge Base editável pelo painel. Versão atual ativa por slug. Histórico em kb_versions.';
COMMENT ON COLUMN kb_items.slug IS 'Ex: faq-servicos, info-estatica, padroes-fala (match com data/kb/conversa-v2/*.md)';
COMMENT ON COLUMN kb_items.version IS 'Incrementado a cada update. Insere snapshot em kb_versions ANTES de update.';
COMMENT ON COLUMN kb_items.source_file IS 'Path original durante migração inicial. NULL para items criados via UI.';

-- =============================================================================
-- 8. kb_versions — Histórico append-only de versões da KB
-- =============================================================================
CREATE TABLE IF NOT EXISTS kb_versions (
  id           BIGSERIAL    PRIMARY KEY,
  kb_item_id   UUID         NOT NULL REFERENCES kb_items(id) ON DELETE CASCADE,
  version      INTEGER      NOT NULL,
  content_md   TEXT         NOT NULL,
  diff_summary TEXT,
  updated_by   UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (kb_item_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_item_time
  ON kb_versions(kb_item_id, created_at DESC);

COMMENT ON TABLE kb_versions IS
  'Histórico append-only de versões da KB. Cada UPDATE em kb_items deve criar entry aqui ANTES (pre-trigger ou aplicação).';

-- =============================================================================
-- 9. trinks_appointments — Sync local de agendamentos Trinks
-- =============================================================================
CREATE TABLE IF NOT EXISTS trinks_appointments (
  trinks_id            VARCHAR(64)  PRIMARY KEY,
  client_trinks_id     VARCHAR(64),
  client_phone         VARCHAR(20),
  client_name          VARCHAR(120),
  professional_id      VARCHAR(64),
  professional_name    VARCHAR(120),
  service_id           VARCHAR(64),
  service_name         VARCHAR(140),
  status               TEXT         NOT NULL CHECK (status IN
                         ('scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'unknown')),
  scheduled_at         TIMESTAMPTZ  NOT NULL,
  duration_min         INTEGER      CHECK (duration_min IS NULL OR duration_min > 0),
  price_cents          INTEGER      CHECK (price_cents IS NULL OR price_cents >= 0),
  created_at_trinks    TIMESTAMPTZ,
  updated_at_trinks    TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  no_show_at           TIMESTAMPTZ,
  raw                  JSONB,
  synced_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinks_scheduled
  ON trinks_appointments(scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_trinks_status_scheduled
  ON trinks_appointments(status, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_trinks_phone_scheduled
  ON trinks_appointments(client_phone, scheduled_at DESC)
  WHERE client_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trinks_created_brin
  ON trinks_appointments USING BRIN (created_at_trinks);

CREATE INDEX IF NOT EXISTS idx_trinks_professional_scheduled
  ON trinks_appointments(professional_id, scheduled_at DESC)
  WHERE professional_id IS NOT NULL;

COMMENT ON TABLE trinks_appointments IS
  'Cache local de agendamentos Trinks. UPSERT por worker admin-trinks-sync (cron 15min). Source-of-truth permanece Trinks.';
COMMENT ON COLUMN trinks_appointments.raw IS 'Payload completo da Trinks API pra debug e backfill de campos novos sem migration';
COMMENT ON COLUMN trinks_appointments.status IS
  'Normalizado. "unknown" pra status Trinks ainda não mapeados (sentry alert na aplicação).';

-- =============================================================================
-- 10. trinks_sync_state — Singleton de estado do sync worker
-- =============================================================================
CREATE TABLE IF NOT EXISTS trinks_sync_state (
  id                       INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_sync_at             TIMESTAMPTZ  NOT NULL DEFAULT '1970-01-01'::TIMESTAMPTZ,
  last_success_at          TIMESTAMPTZ,
  last_error               TEXT,
  consecutive_failures     INTEGER      NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  records_synced_total     BIGINT       NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Singleton row (id=1 sempre)
INSERT INTO trinks_sync_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_trinks_sync_state_updated_at ON trinks_sync_state;
CREATE TRIGGER trg_trinks_sync_state_updated_at
  BEFORE UPDATE ON trinks_sync_state
  FOR EACH ROW EXECUTE FUNCTION admin_set_updated_at();

COMMENT ON TABLE trinks_sync_state IS
  'Estado singleton do worker de sync Trinks. CHECK constraint força id=1 (não permite múltiplos workers).';

-- =============================================================================
-- 11. Views de leitura (otimizam queries do dashboard)
-- =============================================================================

-- View: conversas com último contato + contagem
-- Note: depende de conversation_history existente (schema.sql)
CREATE OR REPLACE VIEW v_admin_conversations_summary AS
SELECT
  client_phone,
  COUNT(*)                                          AS msg_count,
  MAX(created_at)                                   AS last_msg_at,
  MIN(created_at)                                   AS first_msg_at,
  MAX(CASE WHEN role = 'assistant' THEN agent END)  AS last_agent,
  BOOL_OR(role = 'user' AND created_at > NOW() - INTERVAL '4 hours')
                                                    AS is_active_4h,
  BOOL_OR(agent = 'human')                          AS had_takeover
FROM conversation_history
GROUP BY client_phone;

COMMENT ON VIEW v_admin_conversations_summary IS
  'Resumo de conversas pro dashboard. Cache LRU 2s na aplicação.';

-- View: métricas diárias de agendamentos (últimos 90d)
CREATE OR REPLACE VIEW v_admin_appointments_daily AS
SELECT
  DATE(scheduled_at AT TIME ZONE 'America/Sao_Paulo') AS day,
  COUNT(*) FILTER (WHERE status IN ('scheduled', 'confirmed', 'completed')) AS created,
  COUNT(*) FILTER (WHERE status = 'cancelled')                              AS cancelled,
  COUNT(*) FILTER (WHERE status = 'no_show')                                AS no_shows,
  COUNT(*) FILTER (WHERE status = 'completed')                              AS completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'no_show')
         / NULLIF(COUNT(*) FILTER (WHERE status IN ('no_show', 'completed')), 0),
    2
  ) AS no_show_rate_pct
FROM trinks_appointments
WHERE scheduled_at > NOW() - INTERVAL '90 days'
GROUP BY DATE(scheduled_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY day DESC;

COMMENT ON VIEW v_admin_appointments_daily IS
  'Agregação diária de agendamentos para dashboard de métricas. Timezone São Paulo.';

COMMIT;

-- =============================================================================
-- Post-migration: smoke checks (manuais, não dentro da transaction)
-- =============================================================================
-- Rodar após COMMIT para validar:
--   SELECT COUNT(*) FROM admin_users;                       -- esperado: 0
--   SELECT COUNT(*) FROM bot_toggles;                       -- esperado: 3 (seeds)
--   SELECT COUNT(*) FROM trinks_sync_state;                 -- esperado: 1 (singleton)
--   SELECT key FROM bot_toggles ORDER BY key;               -- global, feature:audio, feature:supervisor
--   SELECT * FROM v_admin_conversations_summary LIMIT 1;    -- view funcional
--   \d+ admin_users                                          -- inspect schema completo
-- =============================================================================
