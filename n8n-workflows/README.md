# n8n Workflows - Salon WhatsApp

## Arquivos
- `WF-01-router.json`: Webhook principal, classificacao de intencao e roteamento.
- `WF-02-receptionist.json`: Fluxo de agendamento/reagendamento/cancelamento.
- `WF-03-faq.json`: FAQ com RAG local em `data/kb`.
- `WF-04-sales.json`: Vendas proativas e follow-up.
- `WF-05-human-takeover.json`: Escalacao para Chatwoot.
- `WF-06-cron-jobs.json`: Lembretes, follow-up e reativacao.

## Como importar
1. Acesse n8n (`https://n8n.seudominio.com.br`).
2. Menu `Workflows` -> `Import from file`.
3. Importe cada JSON na ordem `WF-01` a `WF-06`.
4. Abra cada workflow e valide os IDs de `Execute Workflow`:
   - WF-01 chama: `WF-02-receptionist`, `WF-03-faq`, `WF-04-sales`, `WF-05-human-takeover`.

## Credenciais necessarias no n8n
- `Postgres Main` (tipo Postgres): host `postgres`, db `n8n`, usuario `postgres`, senha `${POSTGRES_PASSWORD}`.
- HTTP para Evolution API:
  - Base URL em env: `EVOLUTION_BASE_URL=http://evolution-api:8080`
  - `EVOLUTION_INSTANCE=<nome-da-instancia>`
  - `EVOLUTION_API_KEY=<api-key>`
- HTTP para OpenAI:
  - `OPENAI_API_KEY`
- HTTP para Anthropic (opcional, quando `LLM_PROVIDER=anthropic`):
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL` (ex: `claude-3-5-sonnet-latest`)
- HTTP para Chatwoot:
  - `CHATWOOT_BASE_URL=https://chat.seudominio.com.br`
  - `CHATWOOT_ACCOUNT_ID`
  - `CHATWOOT_INBOX_ID`
  - `CHATWOOT_INBOX_IDENTIFIER` (slug da inbox para endpoint public API)
  - `CHATWOOT_ASSIGNEE_ID` (opcional, para auto-atribuicao)
  - `CHATWOOT_API_TOKEN`

## Variaveis de ambiente recomendadas no container n8n
- `EVOLUTION_BASE_URL`
- `EVOLUTION_INSTANCE`
- `EVOLUTION_API_KEY`
- `LLM_PROVIDER` (`openai` ou `anthropic`)
- `OPENAI_MODEL` (opcional; default `gpt-4o-mini`)
- `ANTHROPIC_API_KEY` (opcional)
- `ANTHROPIC_MODEL` (opcional)
- `OPENAI_API_KEY`
- `CHATWOOT_BASE_URL`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_INBOX_ID`
- `CHATWOOT_INBOX_IDENTIFIER`
- `CHATWOOT_ASSIGNEE_ID`
- `CHATWOOT_API_TOKEN`
- `KB_PATH=/data/kb`
- `RAG_INDEX_PATH=/data/rag/kb-index.json`
- `ALERT_WEBHOOK_URL` (opcional, alerta de erro no router)

## Observacoes
- Os workflows ja incluem fallback para handoff humano nos cenarios sensiveis.
- `WF-03` usa RAG simples por keyword com `kb-index.json` (sem vector DB no MVP).
- `WF-06` aplica checks de opt-out, frequencia (7 dias) e janela segura (08h-20h).
- Todos iniciam com `active=false`; ative apenas apos configurar credenciais e testar.
- Para producao, ajuste as queries SQL e os prompts para os dados reais da discovery.
