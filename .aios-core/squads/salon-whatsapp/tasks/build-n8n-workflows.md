# Construir Workflows n8n Multi-Agent

## Arquitetura

```text
Webhook (msg recebida)
    |
    v
[Router Workflow]
  - Carregar historico conversa (Redis/Postgres)
  - LLM classifica intencao
  - Verificar estado da conversa
    |
    +-- intencao: agendamento -> [Sub-workflow: Recepcionista]
    |   `-- Verifica horarios disponiveis (Google Calendar ou DB)
    |   `-- Confirma ou oferece alternativas
    |   `-- Salva agendamento
    |   `-- Envia confirmacao
    |
    +-- intencao: duvida -> [Sub-workflow: FAQ]
    |   `-- RAG: busca na KB
    |   `-- LLM gera resposta com base nos resultados
    |   `-- Envia resposta
    |
    +-- intencao: promo/recompra -> [Sub-workflow: Vendas]
    |   `-- Verifica historico do cliente
    |   `-- Seleciona oferta relevante
    |   `-- Envia mensagem personalizada
    |
    `-- intencao: reclamacao/complexo -> [Human Takeover]
        `-- Notifica no Chatwoot
        `-- Avisa dona no celular (mensagem no Chatwoot)
        `-- Responde ao cliente: "Vou transferir para [nome]"
```

## Workflows a criar no n8n

### WF-01: Router Principal
- Trigger: Webhook (Evolution API)
- Nodes: Parse msg -> Load context -> LLM classify -> Switch -> Sub-workflows
- Error handler: Log + notificar Victor

### WF-02: Recepcionista
- Input: mensagem + contexto
- Nodes: LLM (prompt PACER recepcionista) -> Check calendar -> Format response -> Send via Evolution API
- Memory: salvar estado da conversa (agendamento em andamento)

### WF-03: FAQ
- Input: mensagem + contexto
- Nodes: RAG search (KB) -> LLM (prompt PACER FAQ) -> Send response
- Fallback: se confidence < 70% -> Human Takeover

### WF-04: Vendas
- Input: mensagem + contexto + historico cliente
- Nodes: LLM (prompt PACER vendas) -> Format response -> Send response

### WF-05: Human Takeover
- Input: mensagem + contexto
- Nodes: Create ticket Chatwoot -> Notify owner -> Send holding msg to client

### WF-06: Cron Jobs (proativos)
- Trigger: Cron schedule
- Lembrete 24h: query agendamentos amanha -> enviar utility msg
- Follow-up 48h: query atendimentos de 2 dias atras -> enviar msg satisfacao
- Reativacao 30 dias: query clientes inativos -> enviar marketing msg

## Testes por workflow
- [ ] WF-01: 30 mensagens de teste com intencoes variadas
- [ ] WF-02: 10 cenarios de agendamento (marcar, reagendar, cancelar, horario lotado)
- [ ] WF-03: 10 perguntas frequentes
- [ ] WF-04: 5 cenarios de venda proativa
- [ ] WF-05: 3 cenarios de escalacao
- [ ] WF-06: Testar cada cron job individualmente

## Tratamento de erros
- Retry automatico: 3 tentativas com backoff exponencial
- Fallback LLM: se Claude falhar, usar GPT-4o-mini (ou vice-versa)
- Dead letter queue: mensagens que falharam 3x -> notificar Victor
- Timeout: se LLM nao responder em 15s -> mensagem padrao + human takeover
