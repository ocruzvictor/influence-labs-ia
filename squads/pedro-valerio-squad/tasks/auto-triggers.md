# Task: auto-triggers — Triggers e Eventos

```yaml
task:
  id: auto-triggers
  name: Triggers de Workflow Automatizado
  agent: pedro-valerio
  command: "*auto-triggers {workflow}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: auto-triggers
  input: "{workflow}"
  output: "catálogo de triggers (fonte, condição, ação)"
  action_items: "Listar eventos; ligar handlers; vetar trigger órfão"
  acceptance_criteria: "Nenhuma automação dispara sem evento verificável; nenhum evento esperado sem handler"
```

## Objetivo

Definir todos os triggers (eventos que iniciam automação) de um workflow com fonte, condição e ação.
Resultado: nenhuma automação dispara sem evento verificável e nenhum evento esperado fica sem handler.

## Entradas Necessárias

1. **Workflow alvo** — qual processo automatizado?
2. **Fontes de eventos disponíveis** — webhooks, cron, mensageria, mudanças de DB
3. **Sistemas integrados** que podem emitir eventos

## Workflow de Execução

### Fase 1: Catalogar Eventos Possíveis

Tipos de trigger:

| Tipo | Exemplo | Latência | Confiabilidade |
|------|---------|----------|---------------|
| Webhook | POST recebido | < 1s | depende do source |
| Schedule (cron) | A cada 5min | exato no schedule | alta |
| DB change | INSERT/UPDATE em tabela X | < 1s (com trigger) | alta |
| Message queue | Mensagem em fila | < 1s | alta (com ack) |
| Polling | Consulta a cada N min | até N min | baixa |
| Manual | Botão clicado por usuário | imediato | depende de humano |

⚠️ Polling é último recurso. Sempre preferir webhook/DB change/queue.

### Fase 2: Mapear Trigger → Workflow

Por trigger, defina:
- **Evento:** descrição do que aconteceu
- **Fonte:** sistema que emite
- **Payload:** dados disponíveis no evento
- **Workflow disparado:** qual automação executa

### Fase 3: Condições de Entrada

Nem todo evento que chega deve disparar workflow:

| Condição | Exemplo |
|----------|---------|
| Filtro de tipo | Webhook X, mas só se `event_type='purchase'` |
| Filtro de payload | Lead criado, mas só se `source='ads'` |
| Filtro temporal | Apenas em horário comercial |
| Filtro de estado | Lead em status='qualified' apenas |

### Fase 4: Idempotência

Eventos podem chegar duplicados (especialmente webhooks com retry). Estratégia:
- **Event ID:** rejeitar se já processado (cache de event_ids por TTL)
- **Janela temporal:** rejeitar se mesmo trigger nos últimos N segundos
- **State-based:** rejeitar se entidade já está no estado-destino

### Fase 5: Tratamento de Falhas

- Trigger recebido mas processamento falhou: retry com backoff exponencial?
- Após N retries: DLQ (dead letter queue) + alerta
- Tempo máximo de processamento (timeout)
- Compensação (rollback) se workflow parcial falhou

## Formato de Saída

```
## Triggers: {workflow}

### Catálogo de Triggers
| # | Tipo | Evento | Fonte | Workflow Disparado |
|---|------|--------|-------|---------------------|
| 1 | Webhook | new_lead | site/forms | lead_qualification |
| 2 | Schedule | every_24h | cron | follow_up_24h |
| 3 | DB change | lead.status='qualified' | postgres | proposta_generation |

### Condições por Trigger
**1. new_lead (webhook):**
- Filtro: `payload.source IN ('ads', 'organic', 'referral')`
- Filtro: `payload.email IS NOT NULL`
- Reject se: domínio email em blocklist

**2. every_24h (cron):**
- Filtro: leads em status='waiting_response' com last_contact_at < NOW() - 24h
- Limite: máximo 100 leads por execução

### Idempotência
| Trigger | Estratégia | Janela |
|---------|-----------|--------|
| new_lead | event_id cache | 24h |
| every_24h | state-based (skip se já followed_up_24h) | - |

### Tratamento de Falhas
- Retry: 3 tentativas com backoff 30s/2min/10min
- DLQ após 3 falhas + alerta ao owner em < 15min
- Timeout por workflow: 30s
- Compensação: rollback de updates parciais via SAGA pattern

### Eventos NÃO Cobertos (gaps)
- ⚠️ {eventos que deveriam disparar algo mas não têm handler}
```

## Critério de Conclusão

DONE quando: catálogo completo de triggers, condições explícitas, estratégia de idempotência por trigger, tratamento de falhas com retry/DLQ/timeout, gaps de cobertura sinalizados.
