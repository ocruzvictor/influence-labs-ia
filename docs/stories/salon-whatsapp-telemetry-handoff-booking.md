# Story: Telemetria nossa — `handoff.human` e `booking.failed`

**Tipo:** Brownfield (Postgres + admin `/metricas`)
**Status:** Ready for Review
**Agente executor:** @dev · migration @data-engineer · gate @qa
**Story Points:** 5
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 28/08/2026 — item 3. Destino = **nosso** admin, não Kapso Agent / Findings.

## Contexto

O backend **já sabe** os dois fatos: `handoffHuman` em `processMessage` (`backend/server.js`, parser em `booking-parser.js`) e falha de create em `createBookingInTrinks` (log `Booking creation FAILED` / incompatível). Nada disso vira série temporal no admin.

`/metricas` hoje expõe takeovers via `conversation_history.agent = 'human'` (Story 1.6) — proxy de takeover de Inbox, **não** o evento `HANDOFF_HUMAN` do Tess nem falha de Trinks.

Decisão (28/08): medir e atuar **sem** pagar Findings. Quem consome pode ser Tiago no admin, o supervisor 46590 depois, ou outro colaborador. **Não** exigir Kapso Agent. **Não** POST para project events Kapso nesta story (pode ser story futura se o Findings for ligado).

`conversation_id` Kapso: o webhook inbound traz `events[].conversation`; o Express **hoje não extrai** id. Persistir se o payload tiver; senão `NULL`. Não inventar id.

## Escopo

**IN:** tabela de eventos operacionais; emit em handoff humano (exceto thread do dono, mesma regra de `isOwnerPhone`); emit em falha de **create** Trinks (exceção, incl. incompatível); KPIs ou lista no admin `/metricas` (ou `/saude` se `/metricas` ficar inchado — preferir `/metricas`); testes.

**OUT:** Kapso Findings, Kapso Agent, `project.event` outbound, `BOT_ACCEPT_ALL`, `94831`, n8n, webhook v2 (outra story), generate-in-composer.

## Acceptance Criteria

- [x] **AC1:** Migration versionada (próximo número livre após 009) cria tabela append-only, no mínimo: `id`, `received_at`, `event` (`handoff.human` | `booking.failed`), `client_phone`, `motivo` ou `error` (texto curto), `kapso_conversation_id` nullable, `payload` jsonb. Rollback SQL no mesmo padrão das migrations 008/009.
- [x] **AC2:** Quando `handoffHuman` dispara e o telefone **não** é dono, grava `handoff.human` com o `motivo` já existente. Falha de persist **não** quebra a resposta ao cliente (log + swallow, mesmo espírito de `whatsapp-account-events`).
- [x] **AC3:** No `catch` de create Trinks (`Booking creation FAILED` / incompatível), grava `booking.failed` com recorte da mensagem de erro (sem vazar PII extra além do telefone já no session).
- [x] **AC4:** Se o inbound Kapso trouxer id de conversa, o emit usa esse id; se não trouxer, coluna fica `NULL`. Sem chamada extra à API Kapso só para preencher id.
- [x] **AC5:** Admin autenticado vê no período de `/metricas` (24h/7d/30d/90d) a **contagem** de `handoff.human` e `booking.failed` (KPI ou tabela curta). Empty-state se a tabela não existir ainda (health/métricas não 500).
- [x] **AC6:** Testes unitários do emit/parse (handoff dono **não** grava; create fail grava). `npm test` / `node --test` da fatia nova passam. Sem `BOT_ACCEPT_ALL` no smoke.

## File List (previsto)

- `docs/stories/salon-whatsapp-telemetry-handoff-booking.md` (M)
- `infra/migrations/010_bot_operational_events.sql` (A)
- `infra/migrations/010_bot_operational_events.rollback.sql` (A)
- `backend/lib/operational-events.js` (A)
- `backend/server.js` (M) — call sites handoff + catch create + kapso conversation id
- `backend/test/operational-events.test.js` (A)
- `frontend/admin/lib/metrics.ts` (M)
- `frontend/admin/components/metricas/metricas-panel.tsx` (M)
- `frontend/admin/components/metricas/kpi-card.tsx` (M)
- `frontend/admin/tests/metrics.test.ts` (M)
- `frontend/admin/tests/api/metrics.test.ts` (M)

## Dev Agent Record

- Draft @aios-master 28/08/2026. Número da migration: o @data-engineer confirma o próximo livre no VPS/repo (009 já é whitelist tester).
- @dev 28/08/2026: AC1–AC6 implementados. Migration 010, helper `operational-events.js` com `shouldEmitHandoff` + `emitOperationalEvent`, wiring em `server.js` (6º arg `kapsoConversationId`), KPIs `handoffsHuman`/`bookingFailed` no admin. Testes: backend 17/17 pass; frontend metrics unit 6/6 pass; tsc OK.

## Change Log

- 2026-08-28 — @aios-master: story draft. Telemetria nossa; Kapso como destino adiado.
- 2026-08-28 — @dev: implementação AC1–AC6, status Ready for Review.
