-- =============================================================================
-- Migration: 006_trinks_api_usage_daily
-- Purpose:   Converte o contador de cota Trinks de mensal (yyyymm) para DIÁRIO (day)
-- Author:    @dev Dex (assistido por Victor)
-- Date:      2026-06-10
-- Story:     salon-whatsapp-trinks-quota-monitor
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/006_trinks_api_usage_daily.rollback.sql
-- =============================================================================
--
-- Contexto:
--   A 005 criou o contador por mês (yyyymm). Para eliminar o "ponto cego" de consumo
--   (não saber dia-a-dia quanto a API consumiu), passamos a contar por DIA. O total
--   mensal vira a soma dos dias do mês. Pega runaway (ex: worker hammer) no mesmo dia
--   e permite cruzar extrato diário com a fatura Trinks.
--
--   A 005 só tinha dados de junho (cota já estourada) — descartáveis. DROP + recria.
-- =============================================================================

DROP TABLE IF EXISTS trinks_api_usage;

CREATE TABLE trinks_api_usage (
  day        DATE        PRIMARY KEY,                          -- dia no fuso America/Sao_Paulo
  used       INTEGER     NOT NULL DEFAULT 0 CHECK (used >= 0), -- chamadas feitas no dia (inclui 429)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trinks_api_usage IS
  'Contador DIÁRIO compartilhado de requisições Trinks (backend + worker). Total mensal = soma dos dias. Cruza com fatura Trinks.';
COMMENT ON COLUMN trinks_api_usage.day IS 'Dia no fuso America/Sao_Paulo (YYYY-MM-DD).';
COMMENT ON COLUMN trinks_api_usage.used IS 'Requisições no dia — conta TODA tentativa, inclusive 429 (cada uma consome cota Trinks).';
