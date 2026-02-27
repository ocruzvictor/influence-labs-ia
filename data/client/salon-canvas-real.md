# Pareto AI Canvas - Studio Tirra (Dados Reais)

## 1. Problema
- Dor principal atual: atendimento WhatsApp e recepcao presencial concentrados no Gabriel.
- Impacto no negocio: atrasos de resposta, risco de erro operacional, sobrecarga humana, no-show estimado em 15-20%.

## 2. Processo AS-IS
- Fluxo atual: cliente chama no WhatsApp, Gabriel faz triagem, consulta Trinks manualmente, negocia horario e confirma.
- Ferramentas atuais: WhatsApp Business API (Meta) + Trinks (agenda, CRM e vendas).
- Gargalos: multitarefa no balcao, pouca proatividade comercial, dependecia de uma pessoa.

## 3. Processo TO-BE
- Fluxo alvo: WhatsApp -> Router -> Agente especializado -> Lock + revalidacao -> Commit no Trinks -> Confirmacoes e lembretes.
- Handoff humano: reclamacao, baixa confianca, pedido explicito de humano, caso complexo ou falha de integracao.
- Resultado esperado: atendimento 24/7 com supervisao humana, agenda sem conflito e aumento de conversao.

## 4. Persona do Agente
- Nome: Assistente Virtual Studio Tirra.
- Tom: amigavel, levemente informal, objetivo e profissional.
- Personalidade: resolutiva, educada, focada em agenda.
- Frases permitidas: "vou verificar os horarios agora", "posso te ajudar com agendamento", "te transfiro para o Gabriel se preferir".
- Frases proibidas: prometer sem validar, inventar horario, insistir em venda apos recusa.

## 5. Funcoes do Agente
- [x] Agendamento
- [x] FAQ
- [x] Vendas proativas
- [x] Follow-up
- [x] Human takeover

## 6. Integracoes
- WhatsApp Business API (Meta)
- Trinks API + Webhooks SNS
- n8n (orquestracao)
- Chatwoot (supervisao humana)

## 7. KPIs
| KPI | Baseline | Target MVP | Target Ideal |
|---|---|---|---|
| Taxa de agendamento autonomo | N/D | >60% das conversas elegiveis | >75% |
| Tempo de primeira resposta | N/D | <30s | <5s |
| Taxa de no-show | 15-20% | -30% relativo | -50% relativo |
| Conversao follow-up reagendamento | N/D | >20% | >30% |
| Conversao follow-up produto | N/D | >15% | >20% |
| Reducao da carga do Gabriel | N/D | >40% | >60% |

## 8. Riscos
- Estourar limite da API Trinks sem cache/rate limit.
- Conflito de agenda sem lock/revalidacao.
- Percepcao de spam sem controle de follow-up/opt-out.

## 9. Cronograma
- Sprint 0: 3-5 dias
- Sprint 1: 7-10 dias
- Sprint 2: 7-10 dias

## Aprovacoes
- Dona do salao: PENDENTE
- Victor: PENDENTE
- Data: PENDENTE
