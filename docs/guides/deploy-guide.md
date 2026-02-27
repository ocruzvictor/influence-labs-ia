# Guia de Deploy - Stack Salao WhatsApp

## Pre-requisitos
1. VPS com Ubuntu 22.04+ (minimo 4 GB RAM, 2 vCPU)
   - Recomendado: Hetzner CX31 ou DigitalOcean 2vCPU/4GB
2. Dominio apontando para o IP da VPS
3. Conta no Meta Business Manager
4. WhatsApp Business Account criada
5. Numero de telefone verificado no Meta
6. Chave API da Anthropic ou OpenAI

## Versoes base usadas neste setup (validadas em 2026-02-25)
- Evolution API: `atendai/evolution-api:v2.3.7`
- n8n: `n8nio/n8n:2.7.4`
- Chatwoot: `chatwoot/chatwoot:v4.10.1`
- Typebot: `baptistearno/typebot-builder:3.15.1` e `baptistearno/typebot-viewer:3.15.1`
- Postgres: `postgres:17.7-bookworm`
- Redis: `redis:7.4.7-alpine`

## Passo 1: Preparar VPS
1. Instalar Docker e Docker Compose.
2. Instalar Nginx.
3. Instalar Certbot (Let's Encrypt).
4. Configurar firewall:
   - `ufw allow 22`
   - `ufw allow 80`
   - `ufw allow 443`
   - `ufw enable`

## Passo 2: Clonar repositorio
```bash
git clone <repo-url>
cd influence-labs-ia/infra
```

## Passo 3: Configurar variaveis
```bash
cp .env.example .env
```
Preencha todas as variaveis obrigatorias no `.env`.

## Passo 4: Deploy da stack
```bash
./deploy.sh
```

## Passo 5: Configurar Nginx + SSL
1. Copie `infra/nginx/default.conf` para o host Nginx.
2. Ajuste os dominios reais.
3. Gere certificados:
```bash
certbot --nginx -d api.seudominio.com.br -d n8n.seudominio.com.br -d chat.seudominio.com.br -d bot.seudominio.com.br
```
4. Recarregue Nginx:
```bash
nginx -t && systemctl reload nginx
```

## Passo 6: Configurar Meta Cloud API
1. Criar app tipo Business no Meta Business Manager.
2. Gerar token permanente (System User).
3. Configurar webhook para Evolution API.
4. Registrar numero de telefone.

## Passo 7: Configurar Evolution API
1. Acessar `https://api.seudominio.com.br`.
2. Criar instancia em modo Cloud API (nao Baileys).
3. Configurar webhook de saida para n8n:
   - `https://n8n.seudominio.com.br/webhook/salon/router`

## Passo 8: Importar workflows no n8n
1. Acesse `https://n8n.seudominio.com.br`.
2. Importar todos os JSONs de `n8n-workflows/`.
3. Configurar credenciais (Postgres, Evolution API, OpenAI/Anthropic, Chatwoot).
4. Ativar workflows apos testes.

## Passo 9: Configurar Chatwoot
1. Acesse `https://chat.seudominio.com.br`.
2. Crie conta admin.
3. Crie inbox "WhatsApp Salao".
4. Configure token de API e IDs para uso no n8n.

## Passo 10: Testes
1. Envie mensagem de teste para o numero.
2. Validar fluxo completo:
   - mensagem -> webhook -> roteamento -> resposta
3. Testar escalacao human takeover.
4. Testar coexistencia no app do celular da dona.

## Passo 11: Go-live gradual
1. Iniciar com 10% do trafego.
2. Monitorar por 3 dias.
3. Escalar para 50%, depois 100%.
4. Acompanhar KPIs (tempo de resposta, taxa de agendamento, handoff).
