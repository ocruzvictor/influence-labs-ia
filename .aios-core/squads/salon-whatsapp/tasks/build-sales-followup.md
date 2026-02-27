# Sprint 2 - Vendas e Follow-up

## Objetivo
Implementar automacoes proativas de vendas e reengajamento sem comprometer experiencia do cliente.

## Escopo funcional
- Lembrete de agendamento (24h antes)
- Follow-up de satisfacao (48h apos atendimento)
- Reativacao de clientes inativos (30/60 dias)
- Sugestao de servicos complementares

## Implementacao
1. Construir WF-06 no n8n com cron jobs separados por caso de uso
2. Criar templates de mensagens aprovados pela dona do salao
3. Personalizar mensagens com historico do cliente
4. Implementar regras de limite (1 proativa/semana, opt-out obrigatorio)

## Testes
- [ ] Cenarios 31-40 executados e aprovados
- [ ] Opt-out respeitado em 100% dos testes
- [ ] Nenhuma mensagem enviada fora da janela permitida
- [ ] Reativacao nao gera spam ou duplicidade

## Gate
- [ ] Victor aprovou implementacao tecnica
- [ ] Dona do salao aprovou tom das mensagens
- [ ] KPI de conversao inicial registrado

## Output
- WF-06 operacional + templates de marketing aprovados + plano de escalonamento para 100% do trafego
