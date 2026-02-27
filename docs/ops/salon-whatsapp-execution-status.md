# Status de Execucao - Salon WhatsApp

Data de referencia: 2026-02-25

## Concluido
- [x] Fase 1: squad criado (agentes, tasks, workflows, templates)
- [x] Fase 2 build assets: infra, SQL, KB exemplo, prompts PACER, workflows n8n, guia deploy
- [x] Sprint 0 operacionalizacao: pacote de discovery e KB real preenchivel
- [x] Prefill da discovery com contexto real do Studio Tirra (material de campo)
- [x] Prompts real-draft ampliados (router, recepcionista, faq, vendas, orquestrador, avaliador)

## Em andamento (executavel agora)
- [ ] Realizar reuniao de discovery com dona do salao
- [x] Preencher `data/client/salon-canvas-real.md` com dados ja confirmados
- [x] Preencher `data/client/kb/*.md` com dados ja confirmados
- [x] Registrar regras finais de horarios variaveis, pagamento e desconto
- [ ] Revisar e aprovar respostas finais

## Bloqueado por dependencia externa
- [ ] Contratar VPS
- [ ] Configurar Meta Cloud API em conta real
- [ ] Subir stack em ambiente real
- [ ] Importar workflows no n8n do ambiente real
- [ ] Rodar piloto com trafego real

## Proximas tarefas possiveis sem bloqueio tecnico
- [x] Consolidar prompts finais em versao draft com dados reais
- [x] Gerar pacote de teste manual para cenarios 1-50 usando dados reais
- [x] Preparar script de dry-run de agendamento em ambiente local
