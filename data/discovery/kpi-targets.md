# KPIs - Baseline e Targets (Studio Tirra)

| KPI | Baseline Atual | Target MVP (30 dias) | Target Ideal (90 dias) | Fonte de Medicao |
|---|---|---|---|---|
| Volume WhatsApp/dia | 50-80 mensagens/dia | manter SLA com pico | escalar sem ampliar carga humana | logs webhook |
| Taxa de agendamento autonomo | N/D | >60% das conversas elegiveis | >75% | conversas roteadas vs bookings |
| Tempo de primeira resposta | N/D | <30s | <5s | timestamp entrada/saida |
| Taxa de no-show | 15-20% | -30% relativo | -50% relativo | appointments status |
| Taxa de escalacao para humano | N/D | <30% | <20% | logs de handoff |
| Conversao follow-up reagendamento | N/D | >20% | >30% | proactive_messages -> booking |
| Conversao follow-up produto | N/D | >15% | >20% | proactive_messages -> venda |
| Reducao da carga da recepção | N/D | >40% | >60% | volume manual vs automatico |

## Regras de mensuracao
- Baseline com janela anterior de 30 dias.
- Congelar formulas antes do piloto.
- Revisao semanal no piloto e quinzenal apos escala 100%.
