#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Docker Compose nao encontrado"
  exit 1
fi

echo "[1/5] Validando servicos"
$COMPOSE_CMD ps

echo "[2/5] Aplicando seed de exemplo"
$COMPOSE_CMD exec -T postgres psql -U postgres -d influence_labs_salon < seed-example.sql

echo "[3/5] Conferindo clientes"
$COMPOSE_CMD exec -T postgres psql -U postgres -d influence_labs_salon -c "SELECT phone, name, last_service, visit_count FROM clients ORDER BY id;"

echo "[4/5] Conferindo metricas e fila proativa"
$COMPOSE_CMD exec -T postgres psql -U postgres -d influence_labs_salon -c "SELECT metric_name, metric_value, measured_at FROM metrics ORDER BY measured_at DESC LIMIT 5;"

echo "[5/5] Dry-run concluido"
