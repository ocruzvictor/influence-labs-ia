# Story: Fix HMAC validation usando raw body (Studio Tirra Fase 3)

**Status:** Done (retroativa)
**Type:** Bug-fix emergente
**Created:** 2026-05-26 (retroativa pós-fix)
**Owner:** @dev (Dex) → @qa (Quinn) → @devops (Gage)
**Branch/Commit:** `feature/booking-2phase-v2` → `3fa7e72` → squashed em `3431732`

## Contexto

Story emergente, criada retroativamente pra cumprir Article III (Story-Driven Development) da Constitution. Bug crítico de produção descoberto durante teste E2E de Fase 3 (transcrição áudio) bloqueou o caminho-feliz do recurso recém-deployado.

## Sintoma observado

Durante teste E2E em 2026-05-26 ~15:30 BRT:
- Victor enviou áudio do número 0007 (whitelist) pra recepção do Studio Tirra
- Bot não respondeu — nenhum log de áudio no backend
- Logs mostravam 24+ entradas `[kapso] HMAC mismatch — sig=... expected=...` ao longo das últimas semanas
- Mensagens de texto passavam normalmente — só eventos de áudio falhavam

## Acceptance Criteria

- [x] Eventos de áudio do webhook Kapso são aceitos pelo backend
- [x] Eventos de texto continuam funcionando (regressão zero)
- [x] HMAC signature é validada corretamente independente de ordem de campos / Unicode / escape encoding
- [x] Suite de teste cobre o caso específico do payload áudio que regrediu
- [x] Fix validado em prod com áudio real

## Root Cause Analysis

`validateKapsoSignature(req)` em `backend/server.js:1255-1281` calculava HMAC sobre `JSON.stringify(req.body)`. Problema: `req.body` é o resultado do `express.json` parser, que já reorganizou o JSON. Quando re-stringificado:

- **Ordem de chaves**: `JSON.stringify` do Node usa ordem de inserção do objeto, que vem do parser. Kapso pode mandar payloads com ordem específica que o parser não preserva.
- **Escapes Unicode**: caracteres como `é`, `ç`, ASCII estendido podem ser codificados de forma diferente (escape `\uXXXX` vs literal UTF-8) entre o que Kapso assina e o que `JSON.stringify` produz.
- **Floats**: `123.0` no JSON vira `123` no `JSON.stringify` quando parseado para Number.

Pra payloads de **texto simples**, o `JSON.stringify` por **coincidência canônica** reproduzia byte-a-byte. Pra **áudio**, o payload tinha mais campos (URL longa com base64, MIME type, metadata) e a recodificação divergia, quebrando o HMAC.

## Solução

Express.json já estava configurado com `verify: (req, res, buf) => { req.rawBody = buf; }` (linha 87) — capturado pra validar HMAC da Meta (X-Hub-Signature-256). Bastava usar o mesmo `req.rawBody` no validador do Kapso.

```js
// Antes (bug):
const body = JSON.stringify(req.body);

// Depois (fix):
const body = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
```

Fallback defensivo preserva comportamento antigo se `rawBody` for undefined (improvável, mas falha fechada).

## Test Plan

1. **Unit tests** — `scripts/test-hmac-kapso.mjs` com 8 casos:
   - Payload texto canônica (assinatura válida)
   - Payload áudio com Unicode/URL (REGRESSÃO do bug)
   - Assinatura inválida rejeita
   - Header com prefixo `sha256=` aceito
   - Header alternativo `x-kapso-signature` aceito
   - Skip mode quando secret unset (dev)
   - Fallback sem `rawBody`
   - Sem header de assinatura rejeita
2. **E2E em prod** — Victor enviou áudio do 0007, backend aceitou, pipeline áudio (Kapso-primary) gerou resposta com confirmação I.9 sem emitir tag de booking.

## Files

- `backend/server.js:1266-1270` — fix linha
- `scripts/test-hmac-kapso.mjs` — suite de teste (criado)

## QA Gate Verdict

PASS (Quinn, 2026-05-26). 7/7 quality checks aprovados:
- Code quality, Security (timing-safe compare, no secret leak), Test coverage (8/8 pass), Performance, Documentation, Constitutional compliance (esta story cobre Article III), Production readiness (validado E2E).

## Lições

1. **Sempre validar HMAC sobre o raw body bruto** — nunca re-stringificar payload parseado.
2. **Bugs que afetam só subset de inputs** (texto OK, áudio falha) são insidiosos — testes precisam de fixtures cobrindo variedade de payloads, não só caso feliz.
3. **Express `verify` callback** é a forma idiomática de capturar raw body sem perder o parsing automático.
4. **Article III aplica até em fix emergente** — story retroativa preserva rastreabilidade.

## Dívidas relacionadas (próximas stories)

- Endpoint Kapso `/meta/whatsapp/{ver}/{media_id}` retorna 404 — TESS fallback inoperante, mas Kapso-primary cobre 100% hoje.
- 24+ eventos de áudio perdidos nas últimas semanas antes do fix (não recuperáveis).
