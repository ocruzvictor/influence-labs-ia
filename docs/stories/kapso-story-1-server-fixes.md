# Story 1: Fix P0 bugs + Adapter Kapso

**Epic:** EPIC-kapso-vps-migration
**Status:** Ready
**Agente executor:** @dev
**Pode executar agora:** ✅ SIM (não depende do QR code)

## Objetivo

Corrigir dois bugs críticos no `backend/server.js` que causam agendamentos duplicados e perda de contexto, e criar o novo endpoint `/webhook/kapso` pronto para receber mensagens do Kapso.

## Acceptance Criteria

- [ ] P0-A corrigido: agendamento só criado quando TESS emite `[BOOKING_CONFIRM]` explicitamente
- [ ] P0-B corrigido: `state.history` passado corretamente para `buildDynamicContext`
- [ ] Endpoint `POST /webhook/kapso` criado e funcional
- [ ] Mensagens do Business App ignoradas automaticamente (`origin === 'business_app'`)
- [ ] HMAC-SHA256 validado no header `X-Webhook-Signature` (rejeitar se inválido)
- [ ] Endpoint `/webhook/demo-chat` mantido e funcional (sem regressão)
- [ ] Variável `KAPSO_WEBHOOK_SECRET` no `.env.example`
- [ ] Log `[kapso][sessionId] message recebida` no início do handler

## Tarefas

### P0-A — Fix booking duplicado (backend/server.js linha 682)

- [ ] Alterar condição de `if (bookingConfirm || (!bookingCancel && !bookingReschedule))` para `if (bookingConfirm)`
- [ ] Verificar que o bloco `extractFromHistory` só é chamado quando `bookingConfirm` é truthy

**Antes:**
```js
if (bookingConfirm || (!bookingCancel && !bookingReschedule)) {
```
**Depois:**
```js
if (bookingConfirm) {
```

### P0-B — Fix histórico ausente no contexto TESS (backend/server.js linha 651)

- [ ] Alterar `buildDynamicContext(..., [], svcText)` para `buildDynamicContext(..., state.history, svcText)`

**Antes:**
```js
const dynamicContext = buildDynamicContext(businessDays, slotsAll, profsPayload.text, [], svcText);
```
**Depois:**
```js
const dynamicContext = buildDynamicContext(businessDays, slotsAll, profsPayload.text, state.history, svcText);
```

### Adapter Kapso — novo endpoint

- [ ] Criar função helper `validateKapsoSignature(req)` que:
  - Lê `X-Webhook-Signature` do header
  - Computa `hmac-sha256` do body com `KAPSO_WEBHOOK_SECRET`
  - Retorna `false` se não bater → responder 401
  - Se `KAPSO_WEBHOOK_SECRET` não estiver definido: logar warning e passar (modo dev)
- [ ] Criar `app.post('/webhook/kapso', ...)` que:
  1. Valida assinatura HMAC
  2. Extrai campos do payload Kapso:
     ```js
     const { message, conversation } = req.body;
     if (message?.kapso?.origin === 'business_app') return res.json({ response: '' });
     const messageText = message?.kapso?.content || message?.text?.body;
     const sessionId   = conversation?.phone_number;
     const contactName = conversation?.kapso?.contact_name || 'Cliente';
     ```
  3. Delega para a mesma lógica de orquestração do `/webhook/demo-chat` (extrair em função compartilhada ou duplicar com comentário TODO refactor)
  4. Retorna `{ response: cleanText }` em caso de sucesso
  5. Em caso de erro: retorna `{ response: 'Desculpe, tive um problema. Pode repetir?' }`

### .env.example

- [ ] Adicionar `KAPSO_WEBHOOK_SECRET=` com comentário explicativo

## File List

- `backend/server.js` — P0-A (linha 682), P0-B (linha 651), novo endpoint /webhook/kapso
- `infra/.env.example` — nova variável KAPSO_WEBHOOK_SECRET

## Notas técnicas

Payload Kapso completo:
```json
{
  "message": {
    "id": "wamid.123",
    "type": "text",
    "from": "5511999999999",
    "text": { "body": "Quero agendar um corte" },
    "kapso": {
      "direction": "inbound",
      "origin": "cloud_api",
      "content": "Quero agendar um corte",
      "has_media": false
    }
  },
  "conversation": {
    "id": "conv_123",
    "phone_number": "5511999999999",
    "status": "active",
    "kapso": { "contact_name": "João Silva" }
  },
  "phone_number_id": "123456789012345"
}
```

`origin` values: `cloud_api` (bot), `business_app` (Tiago respondeu manual → ignorar), `history_sync` (ignorar)
