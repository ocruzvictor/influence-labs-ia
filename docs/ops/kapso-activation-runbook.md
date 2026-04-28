# Runbook: Ativação Kapso + Backend VPS

**Quando usar:** Após o número do Studio Tirra ser reconectado no Kapso via QR code.
**Tempo estimado:** 15-20 minutos
**VPS:** `deploy@72.60.155.118` | `/opt/influence-labs/infra`

---

## Pré-requisitos

- [ ] Número Studio Tirra conectado no Kapso (app.kapso.ai) via QR code
- [ ] Código da branch `main` com as Stories 1+2+3 do Epic kapso-vps-migration
- [ ] Acesso SSH ao VPS (`ssh deploy@72.60.155.118`)

---

## Passo 1 — Gerar Webhook Secret no Kapso (2 min)

1. Acessar [app.kapso.ai](https://app.kapso.ai) → **Settings → Webhooks**
2. Criar novo webhook:
   - **URL:** `https://api.studiotirra.com.br/webhook/kapso`
   - **Events:** `whatsapp.message.received`
   - **Buffer window:** `5` segundos (debouncing nativo — evita múltiplos disparos por msg rápida)
3. Copiar o **Webhook Secret** gerado (vai no .env do VPS no passo seguinte)

---

## Passo 2 — Deploy no VPS (5 min)

```bash
ssh deploy@72.60.155.118

cd /opt/influence-labs/infra

# Puxar código atualizado
git pull

# Backup do .env atual
cp .env .env.bak.$(date +%Y%m%d)

# Adicionar variáveis do backend ao .env (se ainda não existirem)
grep -q "KAPSO_WEBHOOK_SECRET" .env || echo "KAPSO_WEBHOOK_SECRET=" >> .env
grep -q "TESS_API_BASE" .env        || echo "TESS_API_BASE=https://api.tess.im" >> .env
grep -q "TRINKS_API_BASE" .env      || echo "TRINKS_API_BASE=https://api.trinks.com/v1" >> .env
grep -q "TRINKS_ESTABELECIMENTO_ID" .env || echo "TRINKS_ESTABELECIMENTO_ID=243868" >> .env

# Editar .env para inserir o secret do Kapso copiado no Passo 1
nano .env
# → Preencher: KAPSO_WEBHOOK_SECRET=<secret_copiado_do_kapso>
# → Confirmar: TESS_API_TOKEN e TRINKS_API_KEY estão preenchidos

# Build e subir o backend
docker compose up -d --build backend

# Verificar se subiu
docker compose ps backend
docker logs backend --tail=20
```

---

## Passo 3 — Verificar health (1 min)

```bash
curl -s https://api.studiotirra.com.br/health | python3 -m json.tool
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "studio-tirra-webchat",
  "uptime": 12.3,
  "tess": {
    "agent_id": "33200",
    "url": "https://api.tess.im/agents/33200/execute"
  }
}
```

Se retornar 502/504: `docker logs backend --tail=50` para diagnosticar.

---

## Passo 4 — Ativar webhook no Kapso (1 min)

1. Voltar ao Kapso → **Settings → Webhooks**
2. Clicar em **Enable** no webhook criado no Passo 1
3. Enviar mensagem de teste pelo próprio painel Kapso (ou pelo WhatsApp)

---

## Passo 5 — Teste smoke (10 min)

**Via WhatsApp** (Tiago ou Victor enviam para o número do Studio Tirra):

```
1. Enviar: "oi"
   → Aguardar resposta do TESS (10-30s na primeira mensagem)

2. Enviar: "quero agendar um corte"
   → TESS deve perguntar data/profissional

3. Confirmar agendamento quando TESS propuser
   → Verificar no painel Trinks se o agendamento foi criado
```

**Via logs do backend:**
```bash
docker logs backend -f --tail=50
# Deve aparecer:
# [kapso][5511999...] message recebida: "oi"
# [Trinks] GET /profissionais → ...
# [TESS] Response ...
```

---

## Passo 6 — Validar handoff humano

1. Tiago responde manualmente pelo WhatsApp Business App
2. Verificar nos logs: `origin: business_app` → sem resposta do bot (resposta vazia `{}`)

---

## Rollback (se algo falhar)

```bash
# Parar apenas o backend (n8n e Chatwoot continuam)
docker compose stop backend

# O QR code do Kapso continua conectado — apenas o webhook fica sem resposta
# Para reverter completamente: desativar webhook no Kapso dashboard
```

---

## Variáveis de ambiente confirmadas

| Variável | Valor |
|----------|-------|
| `TESS_AGENT_ID` | `33200` ✅ |
| `TESS_API_BASE` | `https://api.tess.im` |
| `TRINKS_ESTABELECIMENTO_ID` | `243868` |
| `KAPSO_WEBHOOK_SECRET` | Gerado no Kapso dashboard |

---

## Pós-ativação — monitoramento

```bash
# Logs em tempo real
docker logs backend -f

# Verificar uso de memória/CPU
docker stats backend --no-stream

# Restart rápido se necessário
docker compose restart backend
```

**UptimeRobot (opcional):** Configurar monitor em `https://api.studiotirra.com.br/health` a cada 5 min para alertas de downtime.
