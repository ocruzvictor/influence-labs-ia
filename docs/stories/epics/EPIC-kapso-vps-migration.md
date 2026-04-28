# EPIC: Kapso Integration + Backend Migration (Mode 3 — VPS Native)

**Status:** Ready (aguardando Kapso QR code conectado)
**Criado em:** 2026-04-28
**Objetivo:** Substituir Meta Cloud API + Render Free pelo stack Kapso (QR code) + backend dockerizado no VPS, eliminando cold start e bloqueio de aprovação Meta.

## Contexto

O Studio Tirra (beta) usa atualmente `/webhook/demo-chat` no Render Free como backend.
Problemas:
- Render Free hiberna após 15min → cold start 30-50s no WhatsApp (péssima UX)
- Meta Cloud API bloqueada por semanas (erro de restrição não resolvido pelo suporte)
- Kapso resolve: QR code sem aprovação Meta, HMAC nativo, debouncing nativo, transcrição de áudio

**Decisão:** Kapso substitui Meta/Evolution + n8n como camada WhatsApp.
Backend migra do Render Free para o VPS Hostinger já pago (api.studiotirra.com.br).

## Arquitetura Resultante

```
WhatsApp (Tirra/Tiago)
    ↕ QR code
Kapso (kapso.ai)
    ↓ POST https://api.studiotirra.com.br/webhook/kapso
nginx (VPS 72.60.155.118)
    ↓ proxy → backend:3001
backend/server.js (Node 20, Docker)
    ↓           ↓
TESS AI      Trinks API
(33200)      (agendamentos)
```

## Pré-requisito manual (Victor)

- [ ] Conta Kapso criada ✅
- [ ] Número Studio Tirra conectado via QR code (aguardando migração Meta → WA normal → WA Business)
- [ ] Configurar webhook no Kapso dashboard: `https://api.studiotirra.com.br/webhook/kapso`

## Stories

| # | Story | Status | Pode executar agora? |
|---|-------|--------|----------------------|
| 1 | Fix P0 bugs + adapter Kapso | Ready | ✅ SIM |
| 2 | Dockerize backend + nginx VPS | Ready | ✅ SIM |
| 3 | Cleanup, deploy runbook, validação | Ready | ✅ SIM (deploy só após QR code) |

## Variáveis de ambiente confirmadas

```env
TESS_AGENT_ID=33200
TESS_API_BASE=https://api.tess.im
TRINKS_ESTABELECIMENTO_ID=243868
PORT=3001
# Secrets (já no .env do VPS ou adicionar):
TESS_API_TOKEN=...
TRINKS_API_KEY=...
KAPSO_WEBHOOK_SECRET=...  # gerado no dashboard Kapso
```

## Resultado esperado

Após QR code conectado + deploy:
- Zero cold start (VPS sempre up)
- Webhook autenticado via HMAC-SHA256 (Kapso nativo)
- Debouncing de 5s nativo (sem Wait node n8n)
- Mensagens de áudio transcritas automaticamente
- Handoff humano automático (origin === 'business_app')
- Deploy futuro = `git pull && docker compose up -d --build backend`
