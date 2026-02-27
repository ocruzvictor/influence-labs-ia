#!/usr/bin/env bash
# Deploy completo da stack Influence Labs (Projeto Salao)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Influence Labs - Deploy Stack Salao ==="

if command -v docker >/dev/null 2>&1; then
  echo "Docker encontrado"
else
  echo "Docker nao instalado"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Docker Compose nao instalado"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Arquivo .env nao encontrado."
  echo "Copie .env.example para .env e preencha todas as variaveis."
  exit 1
fi

echo "Subindo stack com: $COMPOSE_CMD"
$COMPOSE_CMD up -d

echo "Aguardando servicos iniciarem..."
sleep 30

echo "=== Status dos servicos ==="
$COMPOSE_CMD ps

echo "=== Testando endpoints locais ==="
curl -s -o /dev/null -w "Evolution API: %{http_code}\n" http://localhost:8080/ || true
curl -s -o /dev/null -w "n8n: %{http_code}\n" http://localhost:5678/ || true
curl -s -o /dev/null -w "Chatwoot: %{http_code}\n" http://localhost:3000/ || true
curl -s -o /dev/null -w "Typebot Viewer: %{http_code}\n" http://localhost:3002/ || true

echo "=== Deploy completo ==="
