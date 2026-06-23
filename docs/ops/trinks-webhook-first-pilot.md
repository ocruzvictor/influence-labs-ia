# Operacao Trinks Webhook-First

## Objetivo

Operar o agente SDR com leituras locais durante a conversa, mutacoes Trinks
instrumentadas e bloqueio automatico antes de 8.500 requisicoes no mes.

## Matriz de consumo

| Acao | REST no hot path | Custo esperado |
|---|---:|---:|
| FAQ, preco, upsell e orientacao | Nao | 0 |
| Listar profissionais e servicos | Nao | 0 |
| Consultar sete dias de horarios | Nao | 0 |
| Identificar cliente conhecido | Nao | 0 |
| Listar agendamentos futuros | Nao | 0 |
| Criar agendamento de cliente conhecido | Sim | 1 |
| Cancelar agendamento conhecido | Sim | 1 |
| Remarcar agendamento conhecido | Sim | 1 |
| Cliente novo + agendamento | Sim | ate 3 |
| Atualizar `/consumo` | Sim | 1 por consulta |
| Snapshot de horarios | Sim | 1 por data |
| Catalogo e compatibilidade | Sim | 1 + 1 por profissional |
| Reconcile | Sim | 1 por pagina |

As chamadas removidas do processamento de cada mensagem sao:
`GET /agendamentos/profissionais/{data}`, `GET /profissionais`,
`GET /servicos`, `GET /profissionais/{id}/servicos` e
`GET /agendamentos?clienteId=...`.

## Preparacao do deploy

1. Manter `BOT_ACCEPT_ALL=false`.
2. Configurar `TRINKS_MONTHLY_BUDGET=10000`.
3. Configurar `TRINKS_OPERATIONAL_CAP=8500`.
4. Aplicar `infra/migrations/007_trinks_local_snapshots.sql`.
5. Subir backend e `admin-trinks-sync`.
6. Executar `npm run forecast:trinks -- --json`.
7. Confirmar no `/health`:
   - `trinks_usage.mode` diferente de `blocked`;
   - `trinks_snapshots.available_slots > 0`;
   - catalogo e compatibilidades preenchidos;
   - `trinks_webhook.pending_notifications = 0`.

## Ativacao do webhook

Endpoint publico:

```text
POST https://api.studiotirra.com.br/webhook/trinks
```

Configurar no backend o ARN exato recebido da Trinks:

```text
TRINKS_SNS_TOPIC_ARN=arn:aws:sns:<regiao>:<conta>:<topico>
```

Quando a Trinks nao informar o ARN antes do primeiro convite, habilitar
temporariamente `TRINKS_SNS_BOOTSTRAP=true`. Nesse modo, apenas uma
`SubscriptionConfirmation` com assinatura AWS valida pode iniciar a confianca.
Depois do aceite, copiar o `topic_arn` persistido para `TRINKS_SNS_TOPIC_ARN`,
desligar o bootstrap e reiniciar o backend.

O backend valida assinatura RSA, certificado AWS, regiao do `TopicArn`,
`SubscribeURL`, token e deduplicacao por `MessageId`. O piloto real so pode
iniciar depois que uma `SubscriptionConfirmation` e ao menos um evento real
aparecerem no health.

## Circuit breaker

| Consumo efetivo | Modo | Comportamento |
|---:|---|---|
| abaixo de 6.000 | `normal` | operacao completa |
| 6.000 | `warning` | alerta operacional |
| 7.500 | `restricted` | suspende snapshots nao essenciais |
| 8.200 | `essential_only` | apenas mutacoes e `/consumo` |
| 8.500 | `blocked` | bloqueia novas chamadas Trinks |

HTTP 429 interrompe o ciclo atual e nao e contado como consumo. Outros status
HTTP sao registrados como consumidos; falhas antes de resposta nao sao.

## Piloto supervisionado

1. Numeros internos por duas horas.
2. Conferir criacao, cancelamento, remarcacao, audio, upsell e handoff.
3. Abrir para ate tres clientes somente com webhook, snapshots e forecast verdes.
4. Expandir para 5-10 clientes no proximo dia comercial.
5. Expandir para 10-20 casos no sabado sem falha critica.
6. Na segunda-feira comparar consumo real, projecao, intervencoes e conversao.

## Rollback

1. Manter `BOT_ACCEPT_ALL=false` e remover numeros da whitelist.
2. Parar `admin-trinks-sync`.
3. Reverter o deploy do backend.
4. Preservar tabelas da migration para investigacao.
5. Usar `007_trinks_local_snapshots.rollback.sql` somente se for necessario
   remover os dados novos e depois de exportar ledger e envelopes.
