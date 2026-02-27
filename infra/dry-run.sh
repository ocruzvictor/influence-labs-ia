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
$COMPOSE_CMD exec -T postgres psql -U postgres -d evolution < seed-example.sql

echo "[3/5] Conferindo clientes"
$COMPOSE_CMD exec -T postgres psql -U postgres -d evolution -c "SELECT phone, name, last_service, visit_count FROM clients ORDER BY id;"

echo "[4/5] Conferindo agendamentos de amanha"
$COMPOSE_CMD exec -T postgres psql -U postgres -d evolution -c "SELECT service, professional, date, time, status FROM appointments WHERE date = CURRENT_DATE + INTERVAL '1 day' ORDER BY time;"

echo "[5/5] Dry-run concluido"
