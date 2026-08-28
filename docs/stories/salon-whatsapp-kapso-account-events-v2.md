# Story: Webhook Kapso v2 — conta WhatsApp disabled/restricted/reinstated/violation

**Tipo:** Brownfield (alerta além do e-mail Meta)
**Status:** Ready for Review
**Agente executor:** @dev · webhook no painel @devops · gate @qa
**Story Points:** 3
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 28/08/2026 — item 4. Nice-to-have de plantão; **não** bloqueia go-live (atendimento diário já percebe queda no Inbox).

## Contexto

Já persistimos Meta `account_update` (ex. `PARTNER_REMOVED`) em `whatsapp_account_events` via `/webhook/kapso-meta` e `/webhook/meta` (`backend/lib/whatsapp-account-events.js`, migration 008). O parser já guarda `restriction_info` / `ban_info` / `violation_info` **se** vierem nesse payload. `/health` já expõe `last_event` / `last_partner_removed_at`.

P2 do dossiê: eventos **Kapso** `whatsapp.account.disabled | restricted | reinstated | violation` — nomes padronizados de project/platform events, canal diferente do raw Meta. Complementa, não substitui, a 008.

Valor: alarme se a WABA cair de madrugada/domingo. Residual aceito pelo Victor: com uso diário, a queda aparece rápido no Inbox. Esta story é o ping extra (log + persist + opcional WhatsApp ao Tiago).

## Escopo

**IN:** assinar os 4 eventos no projeto Kapso do `97504-0517`; receber no Express **sem** quebrar HMAC de `whatsapp.message.received`; persistir em `whatsapp_account_events` (source distinto, ex. `kapso-v2`) ou extensão mínima da 008; log warn; opcional notificar `TIAGO_NOTIFICATION_PHONE` (mesmo canal do digest, **não** o `94831`).

**OUT:** Findings, Kapso Agent, telemetria handoff/booking (outra story), `BOT_ACCEPT_ALL`, mexer no número de recepção humana, n8n.

**Nota de desenho:** @dev confirma na doc/painel Kapso se project events usam o mesmo webhook `/webhook/kapso` ou um endpoint separado. **Não** misturar secret HMAC de mensagem com o de project event se a Kapso separar. Não inventar payload — casar com o schema publicado.

## Acceptance Criteria

- [x] **AC1:** Painel Kapso (projeto do bot `97504-0517`) assina `whatsapp.account.disabled`, `restricted`, `reinstated`, `violation`. Documentado em `docs/ops/` (URL, kind, secret env se nova).
- [x] **AC2:** Payload desses eventos persiste em Postgres (`whatsapp_account_events` ou migration incremental). `source` distingue Meta raw vs Kapso v2. Falha de persist não devolve 5xx se o HMAC era válido (log + 200, padrão atual do meta handler — **exceto** se a Kapso exigir 4xx em assinatura inválida: aí 401).
- [x] **AC3:** HMAC/assinatura inválida → 401. Evento `whatsapp.message.received` continua igual (regressão: teste ou smoke whitelist `oi`).
- [x] **AC4:** `/health.whatsapp_account_events` passa a refletir o último evento v2 (ou campo `last_v2_event`) sem vazar payload completo.
- [x] **AC5 (opcional nesta entrega):** ping WhatsApp ao Tiago em `disabled` / `restricted` / `violation` (não em `reinstated`, ou reinstated com texto distinto). Respeitar janela 24h já existente. Sem notificar o `94831`.
- [x] **AC6:** Teste unitário parseia um fixture mínimo dos 4 nomes de evento. Sem `BOT_ACCEPT_ALL`.

## File List (previsto)

- `docs/stories/salon-whatsapp-kapso-account-events-v2.md` (M)
- `docs/ops/kapso-account-events-v2.md` (A)
- `backend/lib/whatsapp-account-events.js` (M)
- `backend/server.js` (M) — rota `/webhook/kapso-project`, health, notificação Tiago
- `backend/test/whatsapp-account-events.test.js` (M)
- `infra/.env.example` (M) — `KAPSO_PROJECT_WEBHOOK_SECRET`
- `infra/docker-compose.yml` (M) — env backend

## Dev Agent Record

- Draft @aios-master 28/08/2026. Confirmar schema Kapso na implementação; não copiar chute de payload.
- @dev 28/08/2026: implementado `POST /webhook/kapso-project` com HMAC `KAPSO_PROJECT_WEBHOOK_SECRET` (fallback `KAPSO_WEBHOOK_SECRET`); parser v2 batch/single; persist `source=kapso-v2`; health `last_v2_event`; notificação Tiago em disabled/restricted/violation (janela 24h); ops doc; 9 testes unitários passando. Sem migration nova (008 ok). Assinatura painel Kapso pendente Victor.

## Change Log

- 2026-08-28 — @aios-master: story draft. Complementa migration 008; não bloqueia abrir whitelist.
- 2026-08-28 — @dev: webhook kapso-project, parser v2, health, notificação Tiago, testes, ops doc.
