# Runbook: Kapso Platform webhook v2 — eventos de conta WhatsApp

Contexto: complementa `/webhook/kapso-meta` (Meta raw `account_update`) com eventos
padronizados Kapso `whatsapp.account.*` no nível do **projeto** (payload_version v2).

## O que assinar (Victor — painel Kapso)

1. Kapso → projeto do bot (`97504-0517`) → **Integrations → Webhooks → Platform webhooks**
2. Criar webhook:
   - **URL:** `https://api.studiotirra.com.br/webhook/kapso-project`
   - **Payload version:** v2
   - **Eventos** (somente estes quatro):
     - `whatsapp.account.disabled`
     - `whatsapp.account.restricted`
     - `whatsapp.account.reinstated`
     - `whatsapp.account.violation`
3. Copiar o **Webhook Secret** gerado → VPS `infra/.env`:

```bash
KAPSO_PROJECT_WEBHOOK_SECRET=<secret_copiado_do_painel>
```

4. Recriar o backend:

```bash
cd /opt/influence-labs/infra
docker compose up -d --build backend admin-frontend
docker compose restart nginx
```

## O que NÃO assinar neste webhook

- `whatsapp.message.received` — continua em `/webhook/kapso` (phone-number webhook)
- `kapso_agent.*` — fora de escopo
- `project.event` — fora de escopo

## Secrets (referência)

| Env | Uso |
|---|---|
| `KAPSO_WEBHOOK_SECRET` | Phone-number webhook `/webhook/kapso` (mensagens) |
| `KAPSO_META_WEBHOOK_SECRET` | Meta raw `/webhook/kapso-meta` (fallback: `KAPSO_WEBHOOK_SECRET`) |
| `KAPSO_PROJECT_WEBHOOK_SECRET` | Platform webhook `/webhook/kapso-project` (fallback: `KAPSO_WEBHOOK_SECRET`) |

## Verificação pós-deploy

```bash
curl -sS https://api.studiotirra.com.br/health | python3 -m json.tool | grep -A6 whatsapp_account_events
curl -sS https://api.studiotirra.com.br/health | python3 -m json.tool | grep -A4 kapso_project_webhook
```

Campos esperados em `/health`:

- `whatsapp_account_events.last_v2_event` — último evento Kapso v2 (sem payload completo)
- `whatsapp_account_events.last_v2_event_at` — timestamp
- `kapso_project_webhook.secret_env` — `KAPSO_PROJECT_WEBHOOK_SECRET` ou fallback

## Nginx

Assumir que `/webhook/*` já está proxied para o backend (mesmo padrão de `/webhook/kapso-meta`).
Nenhuma alteração de nginx necessária se essa regra já existir.

## Notificações Tiago (opcional, já implementado)

Em `disabled`, `restricted` ou `violation`, o backend tenta ping via `TIAGO_NOTIFICATION_PHONE`
(respeitando janela 24h). **Não** notifica o número de recepção (`94831`). `reinstated` só persiste/loga.
