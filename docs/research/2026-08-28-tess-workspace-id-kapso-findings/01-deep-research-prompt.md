# Prompt de pesquisa

## Tópico principal

Gap TESS `x-workspace-id` no runtime Studio Tirrá + mapeamento de novidades Kapso vs o que já usamos.

## Sub-queries

1. Onde o repo chama a API Tess hoje (execute, files, memories) e quais headers envia.
2. O que a Tess documenta como obrigatório em 01/09 (status HTTP, escopo de endpoints).
3. Qual Workspace ID de produção está documentado vs demo (`1269475` no webchat).
4. O que são Kapso Findings / project events / conversation.ended e o que o plano exige.
5. O que o changelog Kapso adicionou além do comunicado (inbox, logs, agent, retention, enforcement, broadcasts).
6. Os quatro GitHubs gokapso vs skills já vendidas no repo (`integrate-whatsapp`, `observe-whatsapp`, `automate-whatsapp`).
7. Devil's advocate: o que **não** deve ser adotado (trocar TESS 46589 por workflow Kapso, n8n legado, BOT_ACCEPT_ALL).

## Fontes

- Código: `backend/server.js`, `backend/supervisor.js`, `backend/transcription.js`, `frontend/admin/lib/tess-client.ts`, `scripts/*tess*`, `n8n-workflows/`
- Tess: https://docs.tess.im/pt/workspace-id, `/en/execute-agent`, `/en/api-overview`, `/en/errors`
- Kapso: https://docs.kapso.ai/docs/platform/findings, `/docs/platform/events`, `/changelog`, `/docs/kapso-agent/overview`
- GitHub: gokapso/agent-skills, kapso-workflows, hermes-agent-plugin, whatsapp-support-agent
