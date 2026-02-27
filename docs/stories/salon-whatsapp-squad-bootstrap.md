# Story: Squad Bootstrap - salon-whatsapp

## Contexto
Implementar a Fase 1 do plano de acao de Influence Labs para o projeto beta de salao, criando o squad completo em `.aios-core/squads/salon-whatsapp`.

## Objetivo
Criar a base operacional Discovery -> Build -> Deploy para o projeto WhatsApp do salao com agentes, tasks, workflows e templates.

## Checklist
- [x] Criar estrutura do squad `salon-whatsapp`
- [x] Criar manifest `squad.yaml`
- [x] Criar 4 agentes base (`router`, `receptionist`, `faq`, `sales`)
- [x] Criar workflow principal `salon-delivery.yaml`
- [x] Criar workflow de qualidade `salon-qa-loop.yaml`
- [x] Criar 10 task files em Markdown
- [x] Criar templates (`salon-kb-template`, `salon-canvas`, `salon-report`)
- [x] Atualizar file list

## File List
- `.aios-core/squads/salon-whatsapp/squad.yaml`
- `.aios-core/squads/salon-whatsapp/agents/router.yaml`
- `.aios-core/squads/salon-whatsapp/agents/receptionist.yaml`
- `.aios-core/squads/salon-whatsapp/agents/faq.yaml`
- `.aios-core/squads/salon-whatsapp/agents/sales.yaml`
- `.aios-core/squads/salon-whatsapp/workflows/salon-delivery.yaml`
- `.aios-core/squads/salon-whatsapp/workflows/salon-qa-loop.yaml`
- `.aios-core/squads/salon-whatsapp/tasks/discovery-client.md`
- `.aios-core/squads/salon-whatsapp/tasks/build-knowledge-base.md`
- `.aios-core/squads/salon-whatsapp/tasks/create-prompts-pacer.md`
- `.aios-core/squads/salon-whatsapp/tasks/setup-whatsapp-api.md`
- `.aios-core/squads/salon-whatsapp/tasks/build-n8n-workflows.md`
- `.aios-core/squads/salon-whatsapp/tasks/setup-chatwoot.md`
- `.aios-core/squads/salon-whatsapp/tasks/test-scenarios.md`
- `.aios-core/squads/salon-whatsapp/tasks/pilot-launch.md`
- `.aios-core/squads/salon-whatsapp/tasks/build-sales-followup.md`
- `.aios-core/squads/salon-whatsapp/tasks/optimize-autohealing.md`
- `.aios-core/squads/salon-whatsapp/templates/salon-canvas.md`
- `.aios-core/squads/salon-whatsapp/templates/salon-kb-template.md`
- `.aios-core/squads/salon-whatsapp/templates/salon-report.md`
- `docs/stories/salon-whatsapp-squad-bootstrap.md`
