-- Core de clientes (cache local + vinculo com Trinks)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  trinks_client_id VARCHAR(64),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120),
  email VARCHAR(160),
  birth_date DATE,
  last_service VARCHAR(140),
  last_visit TIMESTAMP,
  visit_count INTEGER DEFAULT 0,
  opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Classificacao comportamental (bom/neutro/mau)
CREATE TABLE IF NOT EXISTS client_scores (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  segment VARCHAR(16) NOT NULL CHECK (segment IN ('bom', 'neutro', 'mau')),
  rationale TEXT,
  updated_by VARCHAR(40) DEFAULT 'system',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (client_id)
);

-- Historico de conversa para contexto LLM
CREATE TABLE IF NOT EXISTS conversation_history (
  id SERIAL PRIMARY KEY,
  client_phone VARCHAR(20) NOT NULL,
  role VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  intent VARCHAR(20),
  agent VARCHAR(40),
  trace_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Controle de mensagens proativas
CREATE TABLE IF NOT EXISTS proactive_messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL,
  external_ref VARCHAR(64),
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent'
);

-- Metricas operacionais
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(80) NOT NULL,
  metric_value NUMERIC,
  metric_tags JSONB DEFAULT '{}'::jsonb,
  measured_at TIMESTAMP DEFAULT NOW()
);

-- Eventos de webhook/sincronizacao vindos do Trinks
CREATE TABLE IF NOT EXISTS trinks_sync_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  external_id VARCHAR(64),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_trinks_id ON clients(trinks_client_id);
CREATE INDEX IF NOT EXISTS idx_client_scores_segment ON client_scores(segment, score DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_phone ON conversation_history(client_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_client ON proactive_messages(client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics(metric_name, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_trinks_events_processed ON trinks_sync_events(processed, created_at DESC);
