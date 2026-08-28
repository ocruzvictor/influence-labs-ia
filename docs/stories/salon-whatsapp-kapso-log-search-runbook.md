# Story: Runbook Kapso log search + ensaio pré-go-live

**Tipo:** Brownfield ops (precaution de volume)
**Status:** Ready for Review
**Agente executor:** @devops (runbook + ensaio na VPS/painel) · @dev (opcional: sync skill) · gate @qa informal
**Story Points:** 2
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 28/08/2026 — item 1 da sequência go-live. Findings Kapso **fora**.

## Contexto

Pesquisa: `docs/research/2026-08-28-tess-workspace-id-kapso-findings/` §2.3. API `GET/POST /platform/v1/log_search` (query, `problems_only`, sources: API, Meta webhooks, flow, webhook delivery). Painel: Logs → Problems / texto livre.

O bot 46589 já responde na whitelist. O risco do go-live não é “falta um feature”: é o primeiro dia com volume (HMAC 401, send 4xx, webhook que não entrega, transcript). Log search é a câmera da **canalização Kapso/Meta**, não da Tess.

A skill local `observe-whatsapp` ainda aponta scripts legados (`api-logs.js`, `webhook-deliveries.js`). O log search unificado é o caminho novo.

## Escopo

**IN:** runbook de 10 linhas em `docs/ops/`; ensaio controlado **antes** de abrir a whitelist; opcional atualizar `observe-whatsapp` para citar log search.

**OUT:** Kapso Findings, créditos de AI Kapso, Kapso Agent, `BOT_ACCEPT_ALL`, número `94831`, n8n, código no `backend/server.js`.

## Acceptance Criteria

- [x] **AC1:** Existe `docs/ops/kapso-log-search-go-live.md` com: onde clicar no painel (projeto do `97504-0517`); filtro Problems; busca livre para HMAC / send 4xx / transcript / webhook delivery; quando olhar VPS (`docker compose logs backend`) vs quando olhar só Kapso.
- [x] **AC2:** O runbook lista 4 consultas mínimas alinhadas ao dossiê: HMAC rejeitado, falha de send Kapso, falha de entrega de webhook ao nosso Express, falha de transcript de áudio.
- [x] **AC3:** Ensaio documentado no próprio runbook (data + quem): uma mensagem whitelist no `97504-0517` aparece no log search **ou** fica explícito o gap (ex. HMAC só aparece quando falha). Sem `BOT_ACCEPT_ALL`.
- [x] **AC4 (opcional):** Skill `observe-whatsapp` (local) menciona `log_search` / painel Logs como path preferido; scripts velhos ficam como fallback. Sem nova dependência de Findings.

## File List

- `docs/stories/salon-whatsapp-kapso-log-search-runbook.md` (M)
- `docs/ops/kapso-log-search-go-live.md` (A)
- `.claude/skills/observe-whatsapp/SKILL.md` (M)

## Dev Agent Record

- Draft @aios-master 28/08/2026. Sem implementação.
- @dev 28/08/2026: runbook criado; skill `observe-whatsapp` atualizada (log_search/painel preferido, scripts fallback, sem Findings). Ensaio happy-path documentado (Victor 5511964540007 → 97504-0517, `[kapso] send → 200`). **Pendência Victor:** pass no painel Logs → Problems (checkbox) — filtros HMAC/Problems só aparecem quando há falha; happy path não gera linha em Problems.
- @aios-master 28/08/2026: `POST /platform/v1/log_search` `problems_only=true` via `KAPSO_API_KEY` na VPS → **200** (CLI `kapso` sem login local / ausente na VPS). Quick replies **sem** endpoint público (404).

## Change Log

- 2026-08-28 — @aios-master: story draft. Findings adiado. Supervisor Tess 46590 permanece o fiscal de qualidade.
- 2026-08-28 — @dev: AC1–AC4 implementados (AC3 happy-path + gap explícito). Status → Ready for Review.
