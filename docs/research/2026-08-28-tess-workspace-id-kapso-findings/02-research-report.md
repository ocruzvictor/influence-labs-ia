# Relatório — TESS workspace-id + Kapso 2026

**Data:** 2026-08-28  
**Lentes:** @architect (Aria) · @analyst (Atlas) · @devops (Gage) · @ux (Uma)

## TL;DR

1. **P0 TESS (4 dias):** o backend de produção **não envia** `x-workspace-id`. Em 01/09 a Tess passa a responder **422** em execute e nos demais endpoints autenticados. Bot 46589, supervisor, transcrição e editor de KB quebram juntos.
2. **P1 Kapso (sem código):** Findings + busca da inbox + log search já existem no painel. Não substituem o TESS. Ligar Findings no projeto Kapso do `97504-0517` (exige project events no plano + créditos de AI).
3. **Não fazer:** trocar o agente TESS 46589 por Kapso Agent / whatsapp-support-agent; reativar n8n; ligar `BOT_ACCEPT_ALL`.

---

## 1. TESS — o que muda

Fonte: [Workspace ID](https://docs.tess.im/pt/workspace-id), [Execute Agent](https://docs.tess.im/en/execute-agent), [Errors](https://docs.tess.im/en/errors).

| Até 31/08/2026 | A partir de 01/09/2026 |
|---|---|
| Header opcional; fallback para o workspace “selecionado” do token (deprecated) | Header **obrigatório** em requests autenticados |
| Omitir ainda funciona | Omitir → **HTTP 422** `{ "message": "The x-workspace-id header is required." }` |

O valor é o ID numérico do **workspace associado à API Key**, não um filtro de agente. Créditos saem desse workspace. Agentes públicos de outros workspaces continuam executáveis; o header ainda é o workspace de origem.

Como achar: Tess → Configurações → Workspace → Workspace ID (ou `?w=` na URL). Copiar só o número.

Há um `TESS_WORKSPACE_ID=1269475` em `docs/deploy/render-webchat-backend.md` para o **demo** agente `27005`. **Não reutilizar às cegas no 46589.** Confirmar no workspace da key de produção.

### Call sites no repo (nenhum manda o header hoje)

| Superfície | Arquivo | Endpoints | Produção? |
|---|---|---|---|
| Bot WhatsApp 46589 | `backend/server.js` `callTESS()` | `POST /agents/{id}/execute` | Sim — cada inbound |
| Supervisor 46590 | `backend/supervisor.js` | `POST /agents/{id}/execute` | Sim — cron triagem |
| Áudio fallback | `backend/transcription.js` | `POST /files` + `POST /agents/{id}/execute` | Sim se Kapso transcript falhar |
| Admin KB | `frontend/admin/lib/tess-client.ts` | `/api/memories*` (host default `tess.pareto.io`) | Sim — editor KB |
| Bootstrap/migrate KB | `scripts/bootstrap-tess-kb.mjs`, `scripts/migrate-kb-to-tess.mjs` | `/api/memory-collections`, `/api/memories` | Sob demanda |
| Harness de prompt | `scripts/test-conversa-*.mjs` | execute 46589 | Dev/QA |
| n8n legado | `n8n-workflows/WF-*.json` | execute | **Não** no cutover Kapso; risco só se alguém ainda rodar |

`infra/.env.example` e `frontend/admin/lib/env.ts` **não** declaram `TESS_WORKSPACE_ID`. Docker Compose também não.

Dois hosts TESS no projeto: `api.tess.im` (backend) e `tess.pareto.io` (admin/scripts). O header vale nos dois.

### Desenho recomendado (@architect)

Um helper único de headers (`Authorization` + `x-workspace-id` + `Content-Type`). Env `TESS_WORKSPACE_ID` obrigatória no boot do backend (fail-fast, no mesmo espírito do warn de `TESS_API_TOKEN`). Admin `env.ts` passa a validar o mesmo. Sem o ID, não deployar.

Não inventar workspace. Victor copia de Configurações → Workspace da key de prod.

---

## 2. Kapso — o que o comunicado cobre vs o changelog

Produção atual: webhook `whatsapp.message.received` → `POST /webhook/kapso` → TESS 46589. Inbox Kapso = recepção humana no número API. Já persistimos `account_update` Meta em `whatsapp_account_events` (migration 008).

### 2.1 Findings (comunicado)

[Docs](https://docs.kapso.ai/docs/platform/findings). Workflow gerenciado em `whatsapp.conversation.ended` emite eventos (`user_frustrated`, `unresolved`, `agent_response_wrong`, `positive_outcome`, `security.prompt_injection_attempt`). Kapso agrupa (7d vs baseline 28d) e o Investigator (read-only) explica causa + até 3 fixes.

- Precisa **project events no plano** e **número de produção** (temos `97504-0517` Dedicated).
- Consome créditos de AI (evaluator + investigator).
- Setup no sidebar Findings; pode reprocessar até 50 conversas dos últimos 7 dias.
- API `GET /platform/v1/findings` e tool MCP `findings`.
- Eventos customizados (ex. `handoff.human`, `booking.failed`) entram no mesmo motor.

**Adequação:** ligar no painel. Não precisa de código no backend para o default. Custom events = P2 depois que o P0 TESS estiver verde.

Limite estatístico: Findings “rising” pede ≥30 conversas avaliadas na janela. Com whitelist pequena, o modo **recurring** (sinal em ≥5 conversas / 2 dias) é o realista até go-live.

### 2.2 Conversation / project events

[Project events](https://docs.kapso.ai/docs/platform/events) são records append-only (`lead.qualified`, `conversation.csat_scored`, …), não logs de step de workflow. Disparam workflows e webhooks `project.event`. Findings usa isso por baixo.

Nosso webhook hoje **não** assina `whatsapp.conversation.ended`. Para Findings default, o evaluator Kapso assina isso **dentro do projeto Kapso** — não no nosso Express. Só precisamos assinar `conversation.ended` no backend se quisermos persistir fim de conversa localmente.

### 2.3 Log search

API `GET/POST /platform/v1/log_search` (query, `problems_only`, sources: API, Meta webhooks, flow, webhook delivery). MCP + CLI. Skill local `observe-whatsapp` já aponta para logs Kapso.

**Adequação:** uso operacional imediato (Victor / @dev) sem deploy. Útil quando HMAC, send 4xx ou transcript falham.

### 2.4 Inbox search + extras de inbox

Antes: filtro por telefone. Agora: texto da mensagem, nome, telefone. Também: contact property filters, quick replies (`/atalho`), atalhos J/K/Enter/R, generate-in-composer (créditos).

**Adequação:** recepção / recepção / Tiago no Inbox Kapso. Zero código. Maior ganho de UX humana desta leva.

### 2.5 Changelog além do e-mail

| Novidade | Valor aqui | Prioridade |
|---|---|---|
| Kapso Agent (dashboard/Slack/API) — **não** é o bot do cliente | Debug de webhook, templates, Findings | P2 ops |
| GitHub App no projeto | Investigator lê este repo | P2 |
| WhatsApp account enforcement events (`disabled/restricted/…`) v2 | Complementa migration 008 | P2 |
| Message retention (pago) | Custo/LGPD no Inbox; Postgres nosso fica | P3 |
| Marketing opt-outs | Só se houver broadcast/template marketing | P3 (hoje não) |
| Duplicate/schedule broadcast | Templates WABA nova (identidade) | P3 pós-identidade |
| Embedded inbox | Admin `/conversas` já existe; embed é opcional | P3 |
| Phone health check cache 3 min | Health Kapso; temos `/health` próprio | ignorar |
| `@kapso/workflows` as code | Não substituir o backend TESS | não adotar como runtime |
| gokapso/agent-skills | Já espelhado em `.claude/skills/{integrate,observe,automate}-whatsapp` | sync se skill local estiver velha |
| hermes-agent-plugin | Só se o time usar Hermes CLI | opcional |
| whatsapp-support-agent | Starter; nosso bot é TESS+Trinks | não substituir |

---

## 3. Personas

| Persona | Dor hoje | O que ajuda |
|---|---|---|
| Cliente | Resposta errada / conversa trava | Findings (frustração, unresolved, claim errado) → prompt/backend |
| Atendente (recepção / app 94831 + Inbox Kapso) | Achar conversa, repetir texto | Inbox search, quick replies, atalhos |
| Administrador (Tiago) | Não vê padrão de falha | Findings no sidebar Kapso; enforcement e-mail |
| AI / backend (Victor) | Debug HMAC/send/TESS | Log search, Kapso Agent + repo, header workspace-id |
| Recepção humana 94831 | Fora desta leva (não mexer no número) | — |

---

## 4. O que não fazer

- Não mover o diálogo do cliente para Kapso Agent / workflow `agent` node. Kapso Agent é operador de **projeto**, não o 46589.
- Não reativar n8n como path de produção.
- Não ligar `BOT_ACCEPT_ALL`.
- Não copiar `1269475` sem confirmar o workspace da key de prod.
- Não ligar retention curta no Kapso sem saber que apaga mídia/histórico do Inbox (o Postgres `conversation_history` permanece).
