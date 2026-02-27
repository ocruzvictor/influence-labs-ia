# Story: Salon WhatsApp - Phase 2 (Discovery + Build Assets)

## Contexto
Executar o plano `docs/PLANO-FASE-2-DISCOVERY-E-BUILD.md` para transformar o esqueleto da Fase 1 em artefatos operacionais de deploy, dados, prompts e workflows.

## Objetivo
Entregar a base tecnica completa para deploy da stack e testes end-to-end antes da discovery real com a dona do salao.

## Checklist
- [x] Criar infraestrutura `infra/` (compose, env, nginx, deploy, sql)
- [x] Criar KB de exemplo em `data/kb/` (6 arquivos)
- [x] Criar prompts PACER completos em `data/prompts/` (4 arquivos)
- [x] Criar JSONs n8n importaveis em `n8n-workflows/` (6 workflows + README)
- [x] Criar guia de deploy em `docs/guides/deploy-guide.md`
- [x] Atualizar checklist e file list

## File List
- `infra/docker-compose.yml`
- `infra/init-databases.sql`
- `infra/.env.example`
- `infra/nginx/default.conf`
- `infra/deploy.sh`
- `infra/schema.sql`
- `infra/check-availability.sql`
- `data/kb/salon-info.md`
- `data/kb/services.md`
- `data/kb/professionals.md`
- `data/kb/scheduling-rules.md`
- `data/kb/faq.md`
- `data/kb/sales.md`
- `data/prompts/router-prompt.md`
- `data/prompts/receptionist-prompt.md`
- `data/prompts/faq-prompt.md`
- `data/prompts/sales-prompt.md`
- `n8n-workflows/WF-01-router.json`
- `n8n-workflows/WF-02-receptionist.json`
- `n8n-workflows/WF-03-faq.json`
- `n8n-workflows/WF-04-sales.json`
- `n8n-workflows/WF-05-human-takeover.json`
- `n8n-workflows/WF-06-cron-jobs.json`
- `n8n-workflows/README.md`
- `docs/guides/deploy-guide.md`
- `docs/stories/salon-whatsapp-phase-2-discovery-build.md`
