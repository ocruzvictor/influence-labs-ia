# Story 3: Cleanup + Deploy Runbook + Validação

**Epic:** EPIC-kapso-vps-migration
**Status:** Ready
**Agente executor:** @dev / @devops
**Pode executar agora:** ✅ Código SIM — Deploy só após QR code conectado

## Objetivo

Remover artefatos do Render, atualizar URLs no frontend, preparar `deploy.sh` para o backend e documentar o runbook de ativação (sequência exata para quando o QR code estiver pronto).

## Acceptance Criteria

- [ ] `render.yaml` deletado
- [ ] `frontend/demo-chat.html` aponta para `https://api.studiotirra.com.br/webhook/demo-chat`
- [ ] `infra/deploy.sh` inclui health check do backend
- [ ] Runbook de ativação documentado em `docs/ops/kapso-activation-runbook.md`
- [ ] Commit limpo com todas as mudanças das Stories 1, 2 e 3

## Tarefas

### Cleanup

- [ ] Deletar `render.yaml` (não será mais usado)
- [ ] Verificar se existe referência ao Render em outros arquivos (`grep -r "render.com" .`) e remover

### frontend/demo-chat.html

- [ ] Atualizar URL do webhook de `http://localhost:3000/webhook/demo-chat` (ou URL Render) para:
  ```
  https://api.studiotirra.com.br/webhook/demo-chat
  ```
- [ ] Manter o `/webhook/demo-chat` apontando — esse endpoint continua existindo no server.js para testes via chat widget

### infra/deploy.sh — health check backend

- [ ] Adicionar ao final do script (após docker compose up):
  ```bash
  echo "Checking backend health..."
  sleep 5
  curl -sf https://api.studiotirra.com.br/health || echo "WARNING: backend health check failed"
  ```

### docs/ops/kapso-activation-runbook.md

- [ ] Criar runbook com a sequência exata de ativação:

```markdown
# Runbook: Ativação Kapso + Backend VPS

## Pré-requisitos
- [ ] Número Studio Tirra conectado no Kapso via QR code
- [ ] Código das Stories 1+2+3 no main branch

## Passo 1 — Deploy no VPS (2 min)
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git pull
cp .env .env.bak  # backup
# Adicionar ao .env se não existir:
echo "KAPSO_WEBHOOK_SECRET=<gerar_no_dashboard_kapso>" >> .env
docker compose up -d --build backend
curl https://api.studiotirra.com.br/health  # deve retornar 200

## Passo 2 — Configurar webhook no Kapso (5 min)
1. Acessar app.kapso.ai → Settings → Webhooks
2. Adicionar webhook:
   - URL: https://api.studiotirra.com.br/webhook/kapso
   - Events: whatsapp.message.received
   - Buffer window: 5 segundos (debouncing nativo)
3. Copiar o Webhook Secret gerado → adicionar no .env do VPS como KAPSO_WEBHOOK_SECRET
4. Reiniciar backend: docker compose restart backend

## Passo 3 — Teste smoke (5 min)
1. Enviar "oi" pelo WhatsApp para o número do Studio Tirra
2. Verificar log: docker logs backend -f --tail=50
3. Aguardar resposta do TESS (10-30s)
4. Verificar: resposta coerente com KB do salão?

## Passo 4 — Teste booking (10 min)
1. Conversar até pedir agendamento
2. Confirmar que TESS pede confirmação
3. Confirmar agendamento
4. Verificar no painel Trinks se o agendamento foi criado

## Rollback
Se algo falhar: docker compose stop backend
O n8n/Chatwoot continuam rodando normalmente.
```

### Commit final

- [ ] `git add -A`
- [ ] `git commit -m "feat(kapso): integration + backend dockerized + VPS infra [Epic kapso-vps-migration]"`
- [ ] @devops push + PR

## File List

- `render.yaml` — DELETAR
- `frontend/demo-chat.html` — atualizar URL webhook
- `infra/deploy.sh` — health check backend
- `docs/ops/kapso-activation-runbook.md` — CRIAR

## Notas

- O `demo-chat.html` continua funcionando via VPS (mesmo endpoint, nova infraestrutura)
- O Kapso vai usar `/webhook/kapso` — o Tirra enviará pelo WhatsApp real
- Após 30 dias de beta estável: avaliar Redis para persistência de sessão (P1-E futuro)
