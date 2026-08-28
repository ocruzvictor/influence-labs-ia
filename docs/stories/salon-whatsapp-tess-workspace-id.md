# Story: Tess `x-workspace-id` obrigatório (01/09/2026)

**Tipo:** Brownfield hotfix (API Tess)
**Status:** Ready for Review (deployed)
**Agente executor:** @dev · quality gate @qa
**Story Points:** 2
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 28/08/2026 — Workspace ID de produção `1458234`.

## Contexto

A Tess exige o header `x-workspace-id` em toda API autenticada a partir de **01/09/2026**. Sem o header: HTTP **422**. Pesquisa: `docs/research/2026-08-28-tess-workspace-id-kapso-findings/`.

O runtime não enviava o header. Em 2026-03-09 o header foi removido após um **403** — o ID de demo `1269475` (webchat agente 27005) não casa com a API Key do 46589. Victor confirmou o workspace da key de prod: **`1458234`**.

Probe VPS 28/08 (POST execute 46589, token de prod): omitir header → 200; `1458234` → 200; `1269475` → 403 "You do not have access to this workspace."

## Escopo

**IN:** env `TESS_WORKSPACE_ID`, helper de headers, call sites de execute/files/memories, health, fail-claro se ausente.

**OUT:** Kapso Findings, `BOT_ACCEPT_ALL`, n8n como path de produção, hardcoded do ID no código (só env).

## Acceptance Criteria

- [x] **AC1:** `tessAuthHeaders()` inclui `Authorization` e `x-workspace-id` com ID só-dígitos; lança se `TESS_WORKSPACE_ID` ausente/inválido.
- [x] **AC2:** `callTESS`, supervisor execute, transcription (`/files` + execute) usam o helper.
- [x] **AC3:** Admin `tess-client.ts` envia o header; `env.ts` lê `TESS_WORKSPACE_ID`.
- [x] **AC4:** Scripts TESS (`bootstrap-tess-kb`, `migrate-kb-to-tess`, `test-conversa-*`, cancelamento, c1-c2) enviam o header.
- [x] **AC5:** `infra/.env.example` + compose (backend, admin, n8n) expõem `TESS_WORKSPACE_ID`. Sem default hardcoded no JS.
- [x] **AC6:** `GET /health` → `tess.workspace_configured` boolean (não vaza o ID).
- [x] **AC7:** Testes unitários do helper passam.
- [x] **AC8 (smoke pós-deploy):** `GET /health` → `tess.workspace_configured=true`; container `TESS_WORKSPACE_ID` set (len 7); GET `/agents/46589` 200 (`workspace_id` 1458234); POST execute 200. `BOT_ACCEPT_ALL=false`. WhatsApp `oi` no `97504-0517` fica com tester humano.

## File List

- `docs/stories/salon-whatsapp-tess-workspace-id.md` (este arquivo)
- `backend/lib/tess-auth.js` (A)
- `backend/test/tess-auth.test.js` (A)
- `backend/server.js` (M)
- `backend/supervisor.js` (M)
- `backend/transcription.js` (M)
- `backend/test/supervisor.test.js` (M)
- `frontend/admin/lib/tess-client.ts` (M)
- `frontend/admin/lib/env.ts` (M)
- `frontend/admin/lib/health-status.ts` (M)
- `frontend/admin/tests/saude-helpers.test.ts` (M)
- `frontend/admin/.env.example` (M)
- `scripts/tess-auth.mjs` (A)
- `scripts/bootstrap-tess-kb.mjs` (M)
- `scripts/migrate-kb-to-tess.mjs` (M)
- `scripts/test-conversa-v3.mjs` (M)
- `scripts/test-conversa-v2.mjs` (M)
- `scripts/test-conversa-v2-robust.mjs` (M)
- `scripts/test-cancelamento-isolado.mjs` (M)
- `scripts/test-c1-c2-fix.mjs` (M)
- `infra/.env.example` (M)
- `infra/docker-compose.yml` (M)
- `docs/research/2026-08-28-tess-workspace-id-kapso-findings/README.md` (M)

## Dev Agent Record

- Backend `node --test`: 219/219 pass.
- Admin `typecheck` + `npm test`: 77 pass / 25 skip (postgres-test) / 0 fail.
- Probe prod: workspace `1458234` válido na key do VPS.

## Change Log

- 2026-08-28 — @aios-master / @dev: helper + call sites; ID prod `1458234` confirmado (probe 200 vs demo 403). Env no VPS `infra/.env` já gravada. Código ainda não deployado.
- 2026-08-28 — @aios-master / @devops: commit `6ef7193` em `feature/bot-46589-ajustes-resposta`; VPS `docker compose up -d --build backend admin-frontend` + `restart nginx`. Health + Tess GET/POST 200.
