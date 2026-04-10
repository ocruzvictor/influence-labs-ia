# Forecast de Volume/Custo com Dados Trinks (Mode 2)

Data: 2026-03-05  
Origem: handoff PM -> Data Engineer (`.aios/handoffs/handoff-pm-to-data-engineer-trinks-forecast-2026-03-05.yaml`)

## 1) Objetivo do modelo
Entregar um modelo operacional de forecast para:
- volume (mensagens e agendamentos);
- custo (fixo + variavel Meta + variavel LLM quando aplicavel);
- horizontes de 30/60/90 dias;
- cenarios conservador/base/agressivo;
- suporte aos gates GO/NO-GO das Fases 2 e 3 e ao gate de transicao Mode 2 -> Mode 1.

## 2) Artefato tecnico entregue
Script SQL idempotente:
- `infra/forecast-volume-custo-trinks.sql`

O script cria:
- tabelas de configuracao e premissas;
- camada de normalizacao de eventos Trinks;
- extracao de 90 dias de agendamentos Trinks (daily + summary);
- camada de metricas diarias observadas;
- baseline rolling;
- projecoes 30/60/90 com intervalo de confianca;
- visao semanal de desvio forecast vs realizado.

## 3) Fontes de dados mapeadas (lineage)
- `trinks_sync_events`:
  - eventos de sincronizacao/webhook Trinks para `created`, `confirmed`, `cancelled`, `rebooked`, `no_show`, sucesso/erro/retry.
- `conversation_history`:
  - proxy de tentativas de acao da recepcionista (`receptionist_*`) e deteccao de conversas iniciadas pelo cliente (`conv_service`).
- `proactive_messages`:
  - volume proativo (reminder/followup/reactivation).
- `metrics`:
  - custo LLM explicito (se existir) ou tokens para estimativa.
- `forecast_meta_tariff` e `forecast_parameters`:
  - parametros financeiros/versionamento de premissas.

## 4) Modelo de dados de forecast
Entidades de configuracao:
- `forecast_parameters`:
  - `history_window_days`, `horizon_days_max`, `confidence_z`, `fixed_monthly_cost`, `llm_cost_per_1k_tokens`.
- `forecast_meta_tariff`:
  - tarifa por categoria Meta (`utility`, `service`, `marketing`) com vigencia.
- `forecast_intent_category_map`:
  - mapeamento de intent para categoria de custo.
- `forecast_scenario_factors`:
  - multiplicadores por cenario (`conservador`, `base`, `agressivo`).

Views principais:
- `vw_trinks_events_normalized`
- `vw_forecast_booking_daily`
- `vw_trinks_appointments_90d_daily`
- `vw_trinks_appointments_90d_summary`
- `vw_forecast_volume_daily`
- `vw_forecast_cost_daily`
- `vw_forecast_observed_daily`
- `vw_forecast_baseline`
- `vw_forecast_projection_daily`
- `vw_forecast_projection_summary`
- `vw_forecast_monitoring_weekly`

## 5) Definicao de KPIs e formulas
Volume:
- `bookings_created`, `bookings_confirmed`, `bookings_cancelled`, `bookings_rebooked`, `bookings_no_show`:
  - agregados por dia de eventos Trinks normalizados.
- `unique_clients_trinks`:
  - clientes unicos por dia com evento de agendamento.
- `bookings_created_effective`:
  - usa booking confirmado por evento Trinks; fallback para proxy `receptionist_agendar` quando nao houver evento.
- `booking_success_rate`:
  - `booking_success_events / booking_total_events`.
- `booking_error_rate`:
  - `booking_error_events / booking_total_events`.
- `booking_retry_rate`:
  - `booking_retry_events / booking_total_events`.
- `msg_utility`:
  - `bookings_confirmed + proactive_reminder_volume + proactive_followup_volume`.
- `conv_service`:
  - quantidade de conversas iniciadas pelo cliente no dia (primeira mensagem da conversa com role `user|client|customer`).
- `msg_marketing`:
  - `proactive_reactivation_volume` (campanhas de reativacao).

Custo:
- `fixed_monthly_cost`:
  - parametro em `forecast_parameters` (default inicial: `114.09`, derivado da baseline financeira de contratacao KVM2 com cupom).
- `meta_variable_cost_by_category`:
  - `message_count_by_category * unit_cost_tariff`, com:
  - `utility_messages = msg_utility`
  - `service_messages = conv_service`
  - `marketing_messages = msg_marketing`
  - defaults atuais (CSV financeiro): utility=`0.04`, service=`0.00`, marketing=`0.33`.
- `estimated_llm_variable_cost_when_applicable`:
  - usa custo explicito em `metrics` quando disponivel;
  - fallback token-based se `llm_cost_per_1k_tokens` estiver configurado.
- `total_daily_cost_estimated`:
  - `meta_variable_cost_total + llm_variable_cost_estimated + fixed_daily_cost_estimated`.
- `cost_per_booking_confirmed`:
  - `total_daily_cost_estimated / bookings_created_effective`.

## 6) Forecast 30/60/90 e confianca
Metodo:
- baseline rolling de `history_window_days` (default 28 dias);
- multiplicadores por cenario em `forecast_scenario_factors`;
- intervalo de confianca via desvio padrao diario e `confidence_z` (default 1.96).

Saida executiva:
- `vw_forecast_projection_summary` retorna por `cenario x horizonte (30/60/90)`:
  - `forecast_msg_utility`, `forecast_conv_service`, `forecast_msg_marketing`;
  - bookings previstos (e faixa baixa/alta);
  - custo total previsto (e faixa baixa/alta);
  - custo medio mensal e custo por booking previsto;
  - confianca do baseline (`high|medium|low`) e dias observados.

## 7) Plano de ingestao/sincronizacao Trinks
Para forecast recorrente confiavel:
1. Garantir persistencia de eventos Trinks em `trinks_sync_events` para `created`, `confirmed`, `cancelled`, `rebooked`, `no_show` + erro + retry.
2. Padronizar `event_type`/`payload.action` para facilitar normalizacao.
3. Registrar retry/attempt no payload quando houver nova tentativa.
4. Manter `proactive_messages` com `status` consistente.
5. Garantir gravacao da primeira mensagem de conversa do cliente em `conversation_history` para medir `conv_service`.
6. Popular `metrics` com custo LLM explicito ou tokens por dia.

## 8) Thresholds recomendados para gates GO/NO-GO
Observacao: metas numericas finais continuam responsabilidade de produto/operacao (ja previstas no roadmap).

Recomendacao de governanca:
- Gate Fase 2 (agendamento):
  - `booking_success_rate_7d` >= meta;
  - `booking_error_rate_7d` <= limite;
  - `booking_retry_rate_7d` <= limite;
  - desvio de custo semanal (`actual vs base forecast`) dentro da banda acordada.
- Gate Fase 3 (proatividade):
  - crescimento de `proactive_message_volume` sem piora de `booking_error_rate`;
  - manter custo por booking dentro da banda planejada.
- Gate transicao Mode 2 -> Mode 1:
  - 30 dias de desvio controlado em volume/custo;
  - estabilidade sustentada de sucesso de booking.

## 9) Monitoramento semanal
View pronta para acompanhamento:
- `vw_forecast_monitoring_weekly`

Campos chave:
- `bookings_delta_pct`
- `total_cost_delta_pct`
- `actual_booking_success_rate`
- `actual_booking_error_rate`

Cadencia recomendada:
- revisao semanal com dono tecnico + operacao + negocio;
- durante ramp (10%/50%/100%), revisao diaria de `vw_forecast_observed_daily`.

## 10) Queries de uso rapido
Baseline:
```sql
SELECT * FROM vw_forecast_baseline;
```

Forecast executivo 30/60/90:
```sql
SELECT * FROM vw_forecast_projection_summary ORDER BY scenario, horizon_days;
```

Extracao Trinks (90 dias):
```sql
SELECT * FROM vw_trinks_appointments_90d_summary;
SELECT * FROM vw_trinks_appointments_90d_daily ORDER BY day;
```

Desvio semanal forecast vs realizado:
```sql
SELECT * FROM vw_forecast_monitoring_weekly ORDER BY week_start DESC;
```

## 11) Runbook operacional pos-freeze
Pre-requisito local:
- criar `infra/.env` (a partir de `infra/.env.example`) e definir no minimo `POSTGRES_PASSWORD`;
- manter `TRINKS_API_KEY` e `TRINKS_SALON_ID` (ou `TRINKS_ESTABELECIMENTO_ID`) disponiveis em `infra/.env` ou `backend/.env`.

Refresh completo (modelo + backfill 90d):
```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d postgres
docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  psql -U postgres -d influence_labs_salon < infra/forecast-volume-custo-trinks.sql
node infra/backfill-trinks-90d.js --days 90
```

Detalhes do backfill:
- o script pagina `agendamentos` (`page/pageSize`) e filtra a janela de 90 dias por `dataHoraInicio`;
- deduplica por `external_id` e regrava somente eventos da fonte `trinks_backfill_90d`.

Validacao rapida:
```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  psql -U postgres -d influence_labs_salon -c "SELECT * FROM vw_trinks_appointments_90d_summary;"

docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  psql -U postgres -d influence_labs_salon -c \
  "SELECT scenario,horizon_days,forecast_msg_utility,forecast_conv_service,forecast_msg_marketing,forecast_bookings_created,forecast_total_cost,baseline_confidence_level,baseline_observed_days FROM vw_forecast_projection_summary ORDER BY scenario,horizon_days;"

docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  psql -U postgres -d influence_labs_salon -c \
  "SELECT week_start,actual_bookings,forecast_bookings,bookings_delta_pct,actual_total_cost,forecast_total_cost,total_cost_delta_pct FROM vw_forecast_monitoring_weekly ORDER BY week_start DESC LIMIT 8;"
```

Observacao de operacao:
- `WF-01-router` deve registrar a primeira mensagem de entrada do cliente com `role='user'` em `conversation_history`.
- `WF-06-cron-jobs` ja registra `proactive_messages` com `type` em `reminder/followup/reactivation` e `status='sent'`.

Status desta sessao (2026-03-06):
- Backfill 90d executado via paginacao real do endpoint Trinks (`agendamentos`): 2444 eventos dentro da janela.
- Resumo de eventos gravados: `created=2000`, `confirmed=56`, `cancelled=388`, `rebooked=0`, `no_show=0`.
- `vw_forecast_projection_summary` saiu de baseline `low` para `medium` (`baseline_observed_days=20`).
- Restricao de dados: nao existe historico legado de `conversation_history`/`proactive_messages`; essas metricas so serao preenchidas a partir da captura operacional daqui para frente.

## 13) Modo bookings-first (recalibração 2026-03-06)

**Contexto:** Backfill Trinks confirmou 2.444 eventos em 45 dias, mas `conversation_history` e `proactive_messages` não possuem histórico legado estruturado. O modelo antigo calculava `msg_utility = bookings_confirmed + proactive_*` → resultado próximo de zero, tornando custo Meta subestimado.

**Solução implementada:** detecção automática de disponibilidade de dados com fallback para proxy bookings-first.

### Lógica de detecção

A view `vw_forecast_volume_daily` verifica, na janela de 90 dias:
- `conv_history_available` — se `conversation_history` tem registros
- `proactive_available` — se `proactive_messages` tem registros

O campo `data_source_mode` indica o modo usado por dia:
- `observed` — dados reais de ambas as tabelas
- `bookings_first_proxy` — proxy via bookings (sem conversation_history)
- `partial_proxy` — conversation_history disponível mas sem proactive

### Parâmetros de proxy (tabela `forecast_booking_ratios`)

| Parâmetro | Valor padrão | Premissa |
|-----------|-------------|----------|
| `msg_utility_per_booking_created` | `3.0` | 3 msgs utility por agendamento criado (confirmação + lembrete + pós-atendimento) |
| `conv_service_rate` | `1.0` | 100% dos bookings iniciados pelo cliente via WhatsApp |
| `msg_marketing_monthly_baseline` | `0.0` | Zero controlado — sem campanhas de reativação na fase atual |

Para ajustar as premissas:
```sql
UPDATE forecast_booking_ratios
SET param_value = 4.0, updated_at = NOW()
WHERE param_key = 'msg_utility_per_booking_created';
```

### Impacto no custo estimado (com dados reais do backfill)

Com ~44 bookings criados/dia (média dos 45 dias com dados) e `msg_utility_per_booking = 3.0`:
- `msg_utility ≈ 132/dia` → custo utility ≈ R$5,28/dia → **R$158,40/mês**
- Somado ao fixo de R$114,09 → **total base ≈ R$272/mês**
- `cost_per_booking_confirmed` recalculado sobre `bookings_created_effective`

### Transição automática para modo observed

Quando `conversation_history` for populado operacionalmente (a partir da captura de mensagens reais via WF-01-router), o modelo muda automaticamente para `data_source_mode = 'observed'` sem necessidade de reaplica o script. As premissas de proxy deixam de ser usadas.

### Queries de validação do modo

```sql
-- Verificar modo de calculo por dia
SELECT day, bookings_created, msg_utility, conv_service, msg_marketing, data_source_mode
FROM vw_forecast_observed_daily
ORDER BY day DESC LIMIT 14;

-- Confirmar que forecast usa valores calibrados
SELECT scenario, horizon_days, forecast_bookings_created, forecast_total_cost,
       forecast_cost_per_booking, baseline_confidence_level
FROM vw_forecast_projection_summary
ORDER BY scenario, horizon_days;
```

## 12) Riscos de dados e mitigacoes
- Historico curto no inicio do rollout:
  - mitigacao: usar `confidence_level` e nao tomar decisoes estruturais com baseline `low`.
- Diferenca entre evento Trinks real e proxy via `conversation_history`:
  - mitigacao: priorizar `trinks_sync_events` como fonte primaria de sucesso/erro.
- Custo LLM incompleto:
  - mitigacao: enviar custo explicito para `metrics` e calibrar `llm_cost_per_1k_tokens`.
- Mudanca de tarifa Meta:
  - mitigacao: versionar em `forecast_meta_tariff` por `effective_from`.
