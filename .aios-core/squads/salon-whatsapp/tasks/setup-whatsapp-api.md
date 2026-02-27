# Configurar WhatsApp API (Evolution API + Cloud API)

## Pre-requisitos
- [ ] VPS contratada (Hetzner CX31 ou DigitalOcean ~$15-25/mes)
- [ ] Docker e Docker Compose instalados na VPS
- [ ] Dominio apontando para VPS (ex: api.influencelabs.com.br)
- [ ] SSL configurado (Certbot/Let's Encrypt)
- [ ] Meta Business Manager conta criada
- [ ] WhatsApp Business Account criada no Meta Business Manager
- [ ] Numero de telefone verificado

## Passos

### 1. Deploy Evolution API
- [ ] Clonar repositorio Evolution API
- [ ] Configurar docker-compose.yml com modo Cloud API (NAO Baileys)
- [ ] Configurar variaveis de ambiente:
  - AUTHENTICATION_API_KEY
  - DATABASE_CONNECTION_URI (Postgres)
  - RABBITMQ (opcional, para filas)
- [ ] Subir container: `docker-compose up -d`
- [ ] Testar endpoint: GET /instance/info

### 2. Configurar Cloud API
- [ ] No Meta Business Manager: criar app tipo "Business"
- [ ] Gerar token permanente (System User token)
- [ ] Configurar webhook URL: https://api.dominio.com/webhook/whatsapp
- [ ] Verificar webhook com token de verificacao
- [ ] Registrar numero de telefone
- [ ] Testar envio de mensagem template

### 3. Configurar Coexistencia
- [ ] No WhatsApp Business App do celular da dona: manter logado
- [ ] Verificar que mensagens aparecem em AMBOS (API + App)
- [ ] Testar envio pela API e visualizacao no App
- [ ] Testar envio pelo App e recepcao pela API

### 4. Conectar ao n8n
- [ ] Configurar webhook no n8n para receber msgs da Evolution API
- [ ] Testar fluxo: mensagem recebida -> n8n webhook -> log

## Validacao
- [ ] Mensagem enviada pela API aparece no celular da dona
- [ ] Mensagem enviada pelo celular da dona chega no webhook
- [ ] Latencia < 2 segundos
- [ ] Nenhum erro no log por 24h
