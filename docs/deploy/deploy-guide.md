# Deploy Guide — Influence Labs Salon Bot

## Pre-requisitos

- VPS com 4+ vCPU, 8GB RAM, 80GB SSD, Ubuntu 22.04+
- Docker e Docker Compose instalados
- Dominio configurado com subdominos apontando para o IP da VPS
- Contas: Meta Business, Trinks (API habilitada)

## 1. Configuracao Inicial

```bash
# Clonar repositorio
git clone <repo-url> && cd influence-labs-ia/infra

# Copiar e preencher variaveis de ambiente
cp .env.example .env
# Editar .env com valores reais (NUNCA commitar .env)
```

## 2. SSL com Certbot (primeira vez)

Antes do primeiro `docker-compose up`, gerar certificados SSL:

```bash
# Comentar blocos SSL no nginx/default.conf temporariamente
# Subir apenas nginx para validacao ACME
docker compose up -d nginx

# Gerar certificados para cada subdominio
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d api.seudominio.com.br \
  -d n8n.seudominio.com.br \
  -d chat.seudominio.com.br \
  -d bot.seudominio.com.br

# Restaurar blocos SSL no nginx/default.conf
docker compose down
```

## 3. Subir Stack Completa

```bash
docker compose up -d
```

Verificar que todos os containers estao saudaveis:
```bash
docker compose ps
```

## 4. Mapeamento de Workflow IDs no n8n

**IMPORTANTE:** Apos importar os workflows no n8n, os IDs internos sao numericos (ex: 1, 2, 3...) e NAO correspondem aos nomes dos arquivos JSON.

### Passo a passo:

1. Importar os workflows na ordem:
   - WF-01-router.json
   - WF-02-receptionist.json
   - WF-03-faq.json
   - WF-04-sales.json
   - WF-05-human-takeover.json
   - WF-06-cron-jobs.json

2. Anotar os IDs atribuidos pelo n8n para cada workflow importado (visivel na URL do editor: `n8n.seudominio.com.br/workflow/XXXX`)

3. Editar o WF-01 (Router) e atualizar os nodes `executeWorkflow`:
   - **Call WF-02** → trocar `workflowId` pelo ID numerico real do WF-02
   - **Call WF-03** → trocar `workflowId` pelo ID numerico real do WF-03
   - **Call WF-04** → trocar `workflowId` pelo ID numerico real do WF-04
   - **Call WF-05** → trocar `workflowId` pelo ID numerico real do WF-05

4. Editar o WF-03 (FAQ) e atualizar:
   - **Call WF-05** → trocar `workflowId` pelo ID numerico real do WF-05

5. Salvar e ativar todos os workflows

### Tabela de mapeamento (preencher apos import):

| Workflow | Nome no arquivo | ID no n8n |
|----------|----------------|-----------|
| Router | WF-01-router | ___ |
| Receptionist | WF-02-receptionist | ___ |
| FAQ | WF-03-faq | ___ |
| Sales | WF-04-sales | ___ |
| Human Takeover | WF-05-human-takeover | ___ |
| Cron Jobs | WF-06-cron-jobs | ___ |

## 5. Configurar Credenciais no n8n

No painel do n8n, criar as seguintes credenciais:

1. **Postgres Main** — conexao com database `influence_labs_salon`:
   - Host: `postgres`
   - Port: `5432`
   - Database: `influence_labs_salon`
   - User: `postgres`
   - Password: (valor do POSTGRES_PASSWORD no .env)

2. As credenciais de API (OpenAI, Anthropic, Trinks, Evolution, Chatwoot) sao passadas via variaveis de ambiente do n8n.

## 6. Configurar Evolution API

1. Acessar `https://api.seudominio.com.br`
2. Criar instancia com nome `studio-tirra`
3. Conectar WhatsApp (QR code ou Cloud API)
4. Configurar webhook apontando para: `https://n8n.seudominio.com.br/webhook/salon/router`

## 7. Configurar Chatwoot

1. Acessar `https://chat.seudominio.com.br`
2. Criar conta admin
3. Criar inbox do tipo API
4. Anotar `inbox_id`, `inbox_identifier`, e `assignee_id`
5. Atualizar esses valores no .env

## 8. Teste End-to-End

1. Enviar mensagem de teste para o numero WhatsApp conectado
2. Verificar no n8n se o workflow WF-01 executou
3. Verificar se a resposta foi recebida no WhatsApp
4. Verificar no Postgres se o historico foi salvo:

```bash
docker compose exec postgres psql -U postgres -d influence_labs_salon \
  -c "SELECT * FROM conversation_history ORDER BY created_at DESC LIMIT 5;"
```
