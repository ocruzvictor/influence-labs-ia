-- =============================================================================
-- Migration: 005_trinks_api_usage
-- Purpose:   Contador mensal compartilhado de requisições à API Trinks
-- Author:    @dev Dex (YOLO, assistido por Victor)
-- Date:      2026-06-03
-- Story:     salon-whatsapp-trinks-quota-monitor
-- Apply on:  database influence_labs_salon
-- Rollback:  infra/migrations/005_trinks_api_usage.rollback.sql
-- =============================================================================
--
-- Contexto:
--   A API Trinks limita 5.000 req/mês (plano base R$120) + adicionais de R$60/+5.000,
--   NÃO cumulativos. DOIS processos consomem a mesma chave: o backend (bot, via
--   lib/trinks-cache) e o worker admin-trinks-sync (via lib/trinks-client). Precisamos
--   de um contador ÚNICO que ambos incrementam, pra monitorar consumo e alertar antes
--   de estourar (e decidir comprar +5.000 ou esperar o mês virar).
--
--   Chave por mês no fuso do salão (America/Sao_Paulo). Reset = naturalmente uma nova
--   linha quando vira o mês (a leitura usa o mês corrente).
-- =============================================================================

CREATE TABLE IF NOT EXISTS trinks_api_usage (
  yyyymm     TEXT        PRIMARY KEY,                         -- 'YYYY-MM' (fuso salão)
  used       INTEGER     NOT NULL DEFAULT 0 CHECK (used >= 0),-- chamadas feitas no mês
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trinks_api_usage IS
  'Contador mensal compartilhado de requisições Trinks (backend + worker). Monitora cota de 5.000/mês + adicionais.';
COMMENT ON COLUMN trinks_api_usage.yyyymm IS 'Mês corrente no fuso America/Sao_Paulo. Nova linha a cada mês (cota nao e cumulativa).';
