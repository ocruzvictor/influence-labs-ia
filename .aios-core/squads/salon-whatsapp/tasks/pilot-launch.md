# Lancamento Piloto Controlado

## Objetivo
Colocar o agente em operacao real com risco controlado e monitoramento intensivo.

## Escopo do piloto
- Fase inicial com 10% do trafego
- Escalonamento progressivo: 10% -> 50% -> 100%
- Duracao minima: 3 dias uteis com analise diaria

## Checklist de execucao
- [ ] Definir janela do piloto e responsaveis de plantao
- [ ] Ativar dashboard de monitoramento (latencia, taxa de sucesso, handoff)
- [ ] Habilitar logging completo de conversas
- [ ] Configurar alertas para falhas criticas
- [ ] Alinhar protocolo de escalacao com a dona do salao

## Metricas de gate
- [ ] Tempo medio de resposta < 5 segundos
- [ ] Taxa de resolucao automatica >= 90%
- [ ] Zero falhas criticas sem fallback
- [ ] Human takeover funcionando em 100% dos casos criticos
- [ ] Satisfacao inicial positiva da dona do salao

## Regras de rollback
- Se houver falha sistemica ou risco de reputacao:
  1. Pausar respostas automaticas
  2. Transferir 100% para humano (Chatwoot)
  3. Corrigir causa raiz
  4. Retestar antes de reativar piloto

## Output
- Relatorio de piloto com incidentes, metricas e decisoes de escala
