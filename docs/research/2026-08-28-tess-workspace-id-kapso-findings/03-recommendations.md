# Recomendações — sem código de produção

## Sequência

### Já — P0 TESS (antes de 01/09)

Story sugerida: `salon-whatsapp-tess-workspace-id` (draft `@sm` / `@po`). Executor `@dev`. Gate `@qa` smoke whitelist.

1. Victor copia Workspace ID em Tess → Configurações → Workspace (workspace da **mesma** API Key de prod).
2. Env `TESS_WORKSPACE_ID` em `infra/.env` (VPS) + `.env.example` + compose backend/admin/supervisor.
3. Helper de headers compartilhado; usar em:
   - `backend/server.js` `callTESS`
   - `backend/supervisor.js`
   - `backend/transcription.js` (execute **e** upload `/files`)
   - `frontend/admin/lib/tess-client.ts` + `env.ts`
   - `scripts/bootstrap-tess-kb.mjs`, `scripts/migrate-kb-to-tess.mjs`, harness `test-conversa-*`
4. Fail-fast se a env estiver vazia (backend não sobe mudo).
5. Deploy backend + admin. Smoke: `oi` de um número allow → resposta. Log sem `TESS 422`.
6. n8n: só se ainda houver instância viva; senão anotar legado.

### P1 Kapso — painel, zero deploy

1. ~~Kapso → Findings → setup~~ **Adiado 28/08** (Victor): sobrepõe Tess supervisor 46590; crédito de AI Kapso extra. Reavaliar depois do go-live se a UI deles valer.
2. Ensinar recepção/Tiago: busca da inbox por texto; 3–5 quick replies (`/preco`, `/endereco`, `/horario`). Story: `docs/stories/salon-whatsapp-kapso-inbox-quick-replies.md`.
3. Victor: Logs → Problems / free text. Story: `docs/stories/salon-whatsapp-kapso-log-search-runbook.md`.

### P2 — depois do P0

1. GitHub App Kapso neste repo → Investigator lê prompt/backend.
2. Webhook projeto v2: `whatsapp.account.disabled|restricted|reinstated|violation` (além do `account_update` que já gravamos). Story: `docs/stories/salon-whatsapp-kapso-account-events-v2.md`.
3. Custom events **nossos** (Postgres + `/metricas`), não Kapso Agent: `handoff.human`, `booking.failed`. Story: `docs/stories/salon-whatsapp-telemetry-handoff-booking.md`. POST Kapso project events adiado com o Findings.
4. Sync das skills `gokapso/agent-skills` se `observe-whatsapp` local estiver atrás do log search novo.

### P3 / não agora

Broadcasts, marketing opt-out, embedded inbox, message retention, Hermes plugin, substituir TESS por whatsapp-support-agent.

## Próximos agentes

- `@po` / `@sm` — story P0 com AC: header em todos os call sites + smoke 422-negativo.
- `@dev` — implementar helper + env (após story).
- `@devops` — env no VPS + restart backend/admin; **não** push sem pedido.
- `@qa` — smoke whitelist + um teste de harness `test-conversa-v3`.
- `@pm` — backlog P1/P2 Kapso (Findings como hipótese de qualidade, não go-live).
