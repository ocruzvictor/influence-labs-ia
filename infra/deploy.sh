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
$COMPOSE_CMD exec -T n8n sh -lc 'wget -q --spider http://localhost:5678 || exit 1' && echo "n8n: ok" || echo "n8n: erro"
$COMPOSE_CMD exec -T chatwoot sh -lc 'wget -q --spider http://localhost:3000 || exit 1' && echo "Chatwoot: ok" || echo "Chatwoot: erro"

echo "=== Deploy completo ==="
