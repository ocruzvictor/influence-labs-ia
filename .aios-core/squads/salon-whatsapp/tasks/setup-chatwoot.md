# Configurar Chatwoot + Human Takeover

## Deploy
- [ ] Adicionar Chatwoot ao docker-compose da VPS
- [ ] Configurar variaveis (SMTP, Redis, Postgres)
- [ ] Subir container
- [ ] Acessar interface web e criar conta admin

## Configuracao
- [ ] Criar inbox "WhatsApp Salao"
- [ ] Conectar com Evolution API (webhook bidirecional)
- [ ] Criar agente "IA" (para msgs automaticas)
- [ ] Criar agente "Dona do Salao" (para human takeover)
- [ ] Configurar regras de atribuicao automatica
- [ ] Configurar notificacoes (email + push se possivel)

## Human Takeover Flow
1. n8n detecta necessidade de humano -> cria conversa no Chatwoot
2. Chatwoot notifica dona (email/push)
3. Dona assume conversa no Chatwoot (web ou mobile)
4. Quando dona encerra -> n8n retoma controle automatico

## Validacao
- [ ] Dona consegue ver todas as conversas no Chatwoot
- [ ] Dona consegue responder pelo Chatwoot
- [ ] Resposta da dona chega ao cliente via WhatsApp
- [ ] Apos dona encerrar, IA retoma automaticamente
