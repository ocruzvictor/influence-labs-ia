# Deploy: 2-phase booking + handoff humano via Kapso

**Branch:** `feature/booking-2phase-v2`
**Data:** 2026-05-26
**Status pré-deploy:** validado localmente (parser 7/7, smoke E2E 2/2)

## O que entra

1. Parser de tags v2 inline (`[BOOKING_CREATE servicoId=N ...]`) com retrocompat v1 (`[BOOKING_CONFIRM]\n{json}`)
2. Sanitização de "Agendado!/Confirmado!/Pronto!" quando há tag de booking
3. Mensagem de sucesso/falha construída pelo backend após resposta Trinks (2-phase Opção A)
4. Reconhecimento de `[HANDOFF_HUMAN motivo=...]` → silencia bot via `markHumanHandled` (TTL existente)
5. Notificação ao Tiago via WhatsApp interno (Kapso) quando handoff dispara

## Pré-deploy — Victor precisa atualizar no VPS

### 1. Atualizar `TESS_API_URL` no `.env` do VPS

Hoje aponta para agente **33200** (MVP antigo). Deve apontar para **46589** (Conversa v2).

```bash
# No VPS, em /opt/influence-labs/infra/.env (ou onde for):
TESS_API_URL=https://api.tess.im/agents/46589/execute
# (alternativa: TESS_AGENT_ID=46589 e remover TESS_API_URL)
```

### 2. Adicionar `TIAGO_NOTIFICATION_PHONE` no `.env` do VPS

```bash
TIAGO_NOTIFICATION_PHONE=<numero_do_tiago_so_digitos>
```

Pré-requisitos para a notificação funcionar:
- O telefone do Tiago deve estar dentro da janela 24h do WhatsApp Business (ele combinou de mandar msg diária pra recepção naturalmente).
- O telefone também precisa estar em `BOT_ALLOWED_PHONES` se você quer que o bot responda a ele em testes, mas isso é independente da notificação.

## Deploy

```bash
# 1. Push (devops)
git push origin feature/booking-2phase-v2

# 2. SSH VPS
ssh deploy@72.60.155.118

# 3. Pull
cd /opt/influence-labs/infra
git fetch
git checkout feature/booking-2phase-v2
git pull

# 4. Atualizar .env (passos 1 e 2 acima)
nano .env

# 5. Rebuild + restart só o backend
docker compose up -d --build backend

# 6. Confirma
curl -s https://api.studiotirra.com.br/health | python3 -c "import sys,json;d=json.load(sys.stdin);print('TESS:', d['tess']['url']);print('Status:', d['status'])"
# Esperado: TESS apontando para 46589, status ok
```

## Pós-deploy — smoke test em produção

1. Você manda do seu número (terminado em 0007) algo tipo "oi" via WhatsApp do salão.
   → Bot responde, sem booking.
2. Você simula um agendamento completo.
   → Bot pede confirmação tripla.
   → Você confirma.
   → **Esperado:** bot manda 2 mensagens: (a) "Confirmo aqui então 👀" (b) mensagem com endereço/valor/estacionamento — construída pelo backend após Trinks 201.
   → Confirma agendamento na Trinks pelo painel.
   → **CANCELA imediatamente** pelo painel pra não bagunçar a agenda real do salão.
3. Você simula reclamação: "isso tá uma bagunça, quero falar com alguém"
   → Bot responde "Vou pedir pro Gabriel..."
   → **Esperado:** Tiago (no número 0330) recebe mensagem `🔔 Bot pediu sua atencao` no WhatsApp dele.
   → Bot fica silencioso pra você pelas próximas 6h (TTL `markHumanHandled`).

## Rollback

```bash
cd /opt/influence-labs/infra
git checkout feature/meta-cloud-direct
docker compose up -d --build backend
```

## Conhecidas não-feitas (P1)

- **Supervisor TESS 46590 síncrono.** Hoje `[HANDOFF_HUMAN]` chama direto a notificação Tiago via Kapso, **sem passar pelo Supervisor**. Supervisor com cron 4x/dia também pendente.
- **Transcrição de áudio.** Mensagens de áudio são ignoradas no backend (linha que filtra `msg.type !== 'text'`).
- **TIAGO_NOTIFICATION_PHONE em produção fora da janela 24h.** Se passar 24h sem msg do Tiago pra recepção, Meta vai bloquear. Combinado: ele manda 1 msg/dia pra recepção naturalmente.
