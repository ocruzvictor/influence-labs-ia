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
- `TRINKS_API_KEY`

As demais variaveis ja entram pelo blueprint (`TESS_API_URL`, `TRINKS_API_BASE`, `TRINKS_ESTABELECIMENTO_ID`).

## 3) Validacao

Quando o deploy terminar, validar:

- `https://<service>.onrender.com/health`
- `POST https://<service>.onrender.com/webhook/demo-chat`

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
