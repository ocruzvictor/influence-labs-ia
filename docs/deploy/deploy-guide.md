# Deploy Guide - Influence Labs Salon Bot (Mode 2)

Arquitetura: Meta Cloud API + Chatwoot + n8n (sem Evolution API).

## Pre-requisitos
- VPS Linux com Docker Compose
- Dominio com subdominios `n8n` e `chat`
- Conta Meta Business com Cloud API habilitada
- Acesso API Trinks

## 1. Configuracao inicial
```bash
git clone <repo-url> && cd influence-labs-ia/infra
cp .env.example .env
# preencher .env
```

## 2. SSL (primeira vez)
```bash
docker compose up -d nginx
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d n8n.seudominio.com.br \
  -d chat.seudominio.com.br
docker compose down
```

## 3. Subir stack
```bash
docker compose up -d
docker compose ps
```

## 4. Importar workflows n8n
Importar em ordem:
1. `WF-01-router.json`
2. `WF-02-receptionist.json`
3. `WF-03-faq.json`
4. `WF-04-sales.json`
5. `WF-05-human-takeover.json`
6. `WF-06-cron-jobs.json`

Depois, ajustar IDs dos `Execute Workflow` no WF-01/WF-03.

## 5. Configurar credencial Postgres no n8n
- Host: `postgres`
- Port: `5432`
- Database: `influence_labs_salon`
- User: `postgres`
- Password: `${POSTGRES_PASSWORD}`

## 6. Configurar webhook Meta -> n8n
- Endpoint: `https://n8n.seudominio.com.br/webhook/salon/router`
- Metodo: POST
- Verificacao do webhook: usar `META_WEBHOOK_VERIFY_TOKEN`

## 7. Configurar Chatwoot
- Criar inbox API/WhatsApp
- Preencher no `.env`:
  - `CHATWOOT_ACCOUNT_ID`
  - `CHATWOOT_INBOX_ID`
  - `CHATWOOT_INBOX_IDENTIFIER`
  - `CHATWOOT_ASSIGNEE_ID`
  - `CHATWOOT_API_TOKEN`

## 8. Teste end-to-end
1. Enviar mensagem de teste para o WhatsApp
2. Verificar execucao WF-01 no n8n
3. Confirmar resposta no WhatsApp
4. Confirmar log no Postgres:
```bash
docker compose exec postgres psql -U postgres -d influence_labs_salon \
  -c "SELECT * FROM conversation_history ORDER BY created_at DESC LIMIT 5;"
```

## 9. Go-live gradual
1. 10% do trafego
2. 50%
3. 100% apos estabilidade
