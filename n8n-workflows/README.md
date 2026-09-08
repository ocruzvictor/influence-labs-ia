# n8n Workflows - Salon WhatsApp (Mode 2)

Arquitetura alvo: Meta Cloud API + Chatwoot + n8n.

## Arquivos principais
- `WF-01-router.json`: webhook principal, classificacao de intencao e roteamento.
- `WF-02-receptionist.json`: agendamento/reagendamento/cancelamento via Trinks.
- `WF-03-faq.json`: FAQ com RAG local em `data/rag/kb-index.json`.
- `WF-04-sales.json`: vendas proativas e follow-up.
- `WF-05-human-takeover.json`: escalacao para atendimento humano no Chatwoot.
- `WF-06-cron-jobs.json`: lembretes, follow-up e reativacao.
- `WF-07-owner-alert.json`: alertas duplos (resumo humano + JSON tecnico) via `ALERT_WEBHOOK_URL`.

## Fluxos de apoio (opcionais)
- `WF-META-01-bot-principal.json`
- `WF-META-02-chatwoot-reply.json`

## Como importar
1. Acesse n8n (`https://n8n.seudominio.com.br`).
2. Importe `WF-07` **primeiro** (sub-workflow de alertas).
3. Importe `WF-01` a `WF-06`.
4. Importe `WF-META-01` e `WF-META-02` (se usar bot principal Mode 2).
5. Ajuste IDs dos nodes `Execute Workflow` apos importacao (inclui chamadas ao WF-07).
6. Ative somente depois de configurar env vars e testar.

## Variaveis obrigatorias no container n8n
- `META_PHONE_NUMBER_ID`
- `META_ACCESS_TOKEN`
- `META_GRAPH_VERSION` (ex: `v21.0`)
- `LLM_PROVIDER` (`openai` ou `anthropic`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` (se usar Anthropic)
- `ANTHROPIC_MODEL` (se usar Anthropic)
- `TRINKS_API_BASE_URL`
- `TRINKS_API_KEY`
- `TRINKS_SALON_ID`
- `CHATWOOT_BASE_URL`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_INBOX_ID`
- `CHATWOOT_INBOX_IDENTIFIER`
- `CHATWOOT_ASSIGNEE_ID`
- `CHATWOOT_API_TOKEN`
- `RAG_INDEX_PATH` (default: `/data/rag/kb-index.json`)
- `ALERT_WEBHOOK_URL` (opcional — webhook Grok Bot / grupo ops; recebe `owner_summary` + `technical`)

## Payload do ALERT_WEBHOOK_URL (WF-07)

```json
{
  "channel": "owner_alert",
  "audience": "owner",
  "owner_summary": "📱 Atendimento #123456\n👤 Cliente: Maria\n...",
  "technical": {
    "workflow": "WF-META-01-bot-principal",
    "event": "message_handled",
    "status": "success",
    "message_id": "wamid.xxx",
    "timestamp": "2026-09-07T19:40:00.000Z"
  }
}
```

No Grok Bot, use o campo `owner_summary` para mensagens ao dono; `technical` fica para logs entre agentes.

## Credenciais necessarias no n8n
- `Postgres Main` (database: `influence_labs_salon`).

## Observacoes
- Todos os envios WhatsApp dos fluxos principais usam Graph API oficial da Meta.
- `WF-03` mantem RAG simples (sem vector DB) para MVP.
- `WF-06` aplica janela segura (08h-20h), opt-out e controle de frequencia.
