#!/usr/bin/env bash
# Publica um workflow local no n8n cloud via API REST.
# Busca o workflow por nome (evita decorar IDs) e faz PUT.
#
# Uso:
#   ./deploy-n8n-workflow.sh n8n-workflows/WF-01-router.json
#   N8N_API_KEY=xxx N8N_BASE_URL=https://xxx.app.n8n.cloud ./deploy-n8n-workflow.sh WF-01-router.json
#
# Variaveis de ambiente (ou preencher abaixo):
#   N8N_API_KEY   — Settings > n8n API > Create API Key
#   N8N_BASE_URL  — ex: https://paretogroup.app.n8n.cloud

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Config ────────────────────────────────────────────────────────────────────
N8N_API_KEY="${N8N_API_KEY:-}"
N8N_BASE_URL="${N8N_BASE_URL:-https://paretogroup.app.n8n.cloud}"

# ── Args ──────────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <caminho-do-workflow.json>"
  echo "Exemplo: $0 n8n-workflows/WF-01-router.json"
  exit 1
fi

WF_FILE="$1"
# Suporta caminho relativo ao repo ou absoluto
if [[ ! -f "$WF_FILE" ]]; then
  WF_FILE="$REPO_ROOT/$1"
fi
if [[ ! -f "$WF_FILE" ]]; then
  echo "Arquivo nao encontrado: $1"
  exit 1
fi

# ── Validar dependencias ───────────────────────────────────────────────────────
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Dependencia ausente: $cmd — instale com brew install $cmd"
    exit 1
  fi
done

# ── API Key ────────────────────────────────────────────────────────────────────
if [[ -z "$N8N_API_KEY" ]]; then
  echo ""
  echo "N8N_API_KEY nao configurada."
  echo "Obtenha em: $N8N_BASE_URL/settings/api"
  echo -n "Cole aqui: "
  read -r N8N_API_KEY
fi

# ── Ler JSON local ─────────────────────────────────────────────────────────────
WF_NAME=$(jq -r '.name' "$WF_FILE")
echo ""
echo "=== Deploy n8n Workflow ==="
echo "Arquivo  : $WF_FILE"
echo "Nome     : $WF_NAME"
echo "Destino  : $N8N_BASE_URL"
echo ""

# ── Buscar ID real no cloud por nome ──────────────────────────────────────────
echo "→ Buscando workflow por nome..."
LIST_RESPONSE=$(curl -sf \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows?limit=100" 2>&1) || {
  echo "Falha ao conectar na API n8n. Verifique N8N_API_KEY e N8N_BASE_URL."
  echo "Resposta: $LIST_RESPONSE"
  exit 1
}

REAL_ID=$(echo "$LIST_RESPONSE" | jq -r \
  --arg name "$WF_NAME" \
  '.data[] | select(.name == $name) | .id' | head -1)

if [[ -z "$REAL_ID" ]]; then
  echo "Workflow \"$WF_NAME\" nao encontrado no cloud."
  echo ""
  echo "Workflows disponíveis:"
  echo "$LIST_RESPONSE" | jq -r '.data[] | "  \(.id)  \(.name)"'
  echo ""
  echo "Opcoes:"
  echo "  1. Importe manualmente uma vez via UI ($N8N_BASE_URL)"
  echo "  2. Use o nome exato listado acima como 'name' no JSON local"
  exit 1
fi

echo "   ID real: $REAL_ID"

# ── Injetar ID real no payload e fazer PUT ────────────────────────────────────
echo "→ Publicando..."
PAYLOAD=$(jq --arg id "$REAL_ID" '. + {id: $id}' "$WF_FILE")

PUT_RESPONSE=$(curl -sf -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$N8N_BASE_URL/api/v1/workflows/$REAL_ID" 2>&1) || {
  echo "Falha no PUT. Resposta:"
  echo "$PUT_RESPONSE"
  exit 1
}

UPDATED_NAME=$(echo "$PUT_RESPONSE" | jq -r '.name // "?"')
UPDATED_ID=$(echo "$PUT_RESPONSE" | jq -r '.id // "?"')

echo ""
echo "✅ Publicado com sucesso!"
echo "   ID      : $UPDATED_ID"
echo "   Nome    : $UPDATED_NAME"
echo ""
echo "=== Próximos passos ==="
echo "1. Ative o workflow no n8n (se estava inativo)"
echo "2. Valide a credential 'Postgres Main' no editor do workflow"
echo "3. Smoke test — rode a query de validação:"
echo ""
echo "   SELECT client_phone, role, agent, created_at"
echo "   FROM conversation_history"
echo "   ORDER BY created_at DESC LIMIT 10;"
echo ""
