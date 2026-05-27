-- =============================================================================
-- Kapso Usage Analysis — Story 1.2-DATA suporte / investigação free tier limit
-- =============================================================================
-- Objetivo: estimar consumo Kapso (msgs/mês, conversas/mês) usando
-- conversation_history como fonte. Projetar uso 30d pra frente.
--
-- Como rodar (Victor):
--   ssh deploy@72.60.155.118
--   docker exec -i postgres psql -U postgres -d influence_labs_salon < /caminho/local/kapso-usage-analysis.sql
--
-- OU copiar e colar cada query individual:
--   docker exec -it postgres psql -U postgres -d influence_labs_salon
--   (cola a query desejada)
-- =============================================================================

\echo '================================'
\echo 'Q1: Período coberto e total geral'
\echo '================================'
SELECT
  MIN(created_at)::date AS primeira_msg,
  MAX(created_at)::date AS ultima_msg,
  (MAX(created_at)::date - MIN(created_at)::date + 1) AS dias_de_historico,
  COUNT(*) AS total_msgs,
  COUNT(*) FILTER (WHERE role = 'user') AS inbound_total,
  COUNT(*) FILTER (WHERE role = 'assistant') AS outbound_total,
  COUNT(*) FILTER (WHERE agent = 'passive') AS inbound_passive_only,
  COUNT(*) FILTER (WHERE role = 'assistant' AND agent != 'passive') AS outbound_efetivo,
  COUNT(DISTINCT client_phone) AS contatos_unicos
FROM conversation_history;

\echo ''
\echo '======================================'
\echo 'Q2: Mensagens por dia (últimos 60 dias)'
\echo '======================================'
SELECT
  created_at::date AS dia,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE role = 'user') AS inbound,
  COUNT(*) FILTER (WHERE role = 'assistant') AS outbound_total,
  COUNT(*) FILTER (WHERE role = 'assistant' AND agent != 'passive') AS outbound_bot,
  COUNT(DISTINCT client_phone) AS conversas_unicas_dia
FROM conversation_history
WHERE created_at > NOW() - INTERVAL '60 days'
GROUP BY created_at::date
ORDER BY dia DESC;

\echo ''
\echo '======================================'
\echo 'Q3: Agregado por mês (rolling 30d windows)'
\echo '======================================'
SELECT
  DATE_TRUNC('month', created_at)::date AS mes,
  COUNT(*) AS msgs_total,
  COUNT(*) FILTER (WHERE role = 'user') AS inbound,
  COUNT(*) FILTER (WHERE role = 'assistant' AND agent != 'passive') AS outbound_bot_real,
  COUNT(DISTINCT client_phone) AS contatos_unicos_mes,
  COUNT(DISTINCT (client_phone, created_at::date)) AS conversas_dia_unicas
FROM conversation_history
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;

\echo ''
\echo '======================================'
\echo 'Q4: Janela 24h conversations (proxy Kapso billing model)'
\echo '======================================'
-- Conta "conversas distintas iniciadas" — definição: phone que mandou msg
-- numa janela 24h após >24h de silêncio. Aproxima como Kapso conta conversation-windows.
WITH msg_gaps AS (
  SELECT
    client_phone,
    created_at,
    LAG(created_at) OVER (PARTITION BY client_phone ORDER BY created_at) AS prev_msg_at,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY client_phone ORDER BY created_at))) / 3600 AS hours_since_prev
  FROM conversation_history
  WHERE role = 'user'
),
new_conversations AS (
  SELECT
    client_phone,
    created_at::date AS dia,
    1 AS new_conv
  FROM msg_gaps
  WHERE prev_msg_at IS NULL OR hours_since_prev > 24
)
SELECT
  DATE_TRUNC('month', dia)::date AS mes,
  COUNT(*) AS novas_conversas_iniciadas_24h
FROM new_conversations
GROUP BY DATE_TRUNC('month', dia)
ORDER BY mes DESC;

\echo ''
\echo '======================================'
\echo 'Q5: Top 10 dias de maior volume'
\echo '======================================'
SELECT
  created_at::date AS dia,
  COUNT(*) AS msgs,
  COUNT(*) FILTER (WHERE role = 'assistant' AND agent != 'passive') AS outbound_bot,
  COUNT(DISTINCT client_phone) AS contatos
FROM conversation_history
GROUP BY created_at::date
ORDER BY msgs DESC
LIMIT 10;
