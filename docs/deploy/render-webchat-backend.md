# Deploy Render - MVP Webchat Backend

Este guia publica o backend alternativo ao n8n cloud para o demo chat.

## 1) Blueprint

O arquivo `render.yaml` na raiz ja cria o servico:

- Service name: `studio-tirra-webchat-backend`
- Root dir: `backend`
- Healthcheck: `GET /health`

No Render:
1. New + -> Blueprint
2. Selecionar este repositorio/branch
3. Confirmar o `render.yaml`

## 2) Env vars obrigatorias

No service criado, definir:

- `TESS_API_TOKEN`
- `TESS_AGENT_ID` (para este demo validado: `27005`)
- `TESS_WORKSPACE_ID` (para este demo validado: `1269475`)
- `TRINKS_API_KEY`

As demais variaveis ja entram pelo blueprint (`TESS_API_BASE`, `TRINKS_API_BASE`, `TRINKS_ESTABELECIMENTO_ID`).

Se aparecer `TESS 404`, normalmente o `TESS_AGENT_ID` nao existe no workspace/token atual.
Se aparecer `TESS 403`, o token nao tem acesso ao `TESS_WORKSPACE_ID` configurado.

## 3) Validacao

Quando o deploy terminar, validar:

- `https://<service>.onrender.com/health`
- `POST https://<service>.onrender.com/webhook/demo-chat`

No `/health`, confirme tambem:
- `tess.agent_id = "27005"`
- `tess.workspace_id = "1269475"`

Exemplo de payload:

```json
{
  "message": "Oi, quero agendar um corte",
  "session_id": "demo-session-1",
  "contact_name": "Visitante"
}
```

## 4) Frontend demo-chat

`frontend/demo-chat.html` aceita webhook dinamico por query param:

- Local: `http://localhost:8888/demo-chat.html`
- Producao: `https://<seu-host>/demo-chat.html?webhook=https://<service>.onrender.com/webhook/demo-chat`

O valor de `webhook` fica salvo em `localStorage` (`st_webhook_url`).

## 5) Debug rapido em Docker local

Se o Render estiver instavel, rode local para isolar erro de infra:

```bash
docker run -d --rm \
  --name studio-tirra-webchat-local \
  -p 3001:3001 \
  --env-file backend/.env \
  -e TESS_API_TOKEN="<seu-token>" \
  -e TESS_API_URL="https://api.tess.im/agents/27005/execute" \
  -e TESS_WORKSPACE_ID="1269475" \
  -v "$PWD/backend:/app" \
  -w /app \
  node:20-alpine node server.js
```

Validacoes:

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/webhook/demo-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"oi","session_id":"debug-local-1","contact_name":"Debug"}'
```

Para encerrar:

```bash
docker stop studio-tirra-webchat-local
```
