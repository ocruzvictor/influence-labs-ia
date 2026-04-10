# Story: Salon WhatsApp - Phase 6 (Hardening + Mode 2 Target)

## Contexto
Consolidar a arquitetura de operacao em Mode 2 (Meta + Chatwoot + n8n), remover legados da Evolution, corrigir fragilidades de seguranca e alinhar deploy/workflows com runtime real.

## Objetivo
Colocar o projeto em condicao de operacao estavel e segura no Mode 2, preservando caminho claro para migracao futura ao backend proprio (Mode 1) apos 30 dias de aprendizado em producao.

## Checklist
- [x] Remover dependencia de envio WhatsApp via Evolution nos workflows principais (WF-02..WF-06)
- [x] Atualizar parser de entrada do WF-01 para aceitar payload da Meta Cloud API
- [x] Remover credenciais hardcoded dos workflows WF-META-*
- [x] Atualizar `infra/.env.example` para variaveis do Mode 2
- [x] Atualizar `infra/docker-compose.yml` com env vars necessarias no n8n
- [x] Reduzir superficie de ataque removendo exposicao direta de portas internas
- [x] Remover residuos de banco/servico legado (Evolution/Typebot)
- [x] Atualizar scripts operacionais (`deploy.sh`, `dry-run.sh`, `seed-example.sql`)
- [x] Consolidar documentacao de deploy para o Mode 2
- [x] Documentar arquiteturas alvo Mode 1/Mode 2 + gatilho de migracao
- [x] Rodar quality gates (`npm run lint`, `npm run typecheck`, `npm test`)
- [x] Atualizar checklist e file list apos validacao final

## File List
- `n8n-workflows/WF-01-router.json`
- `n8n-workflows/WF-02-receptionist.json`
- `n8n-workflows/WF-03-faq.json`
- `n8n-workflows/WF-04-sales.json`
- `n8n-workflows/WF-05-human-takeover.json`
- `n8n-workflows/WF-06-cron-jobs.json`
- `n8n-workflows/WF-META-01-bot-principal.json`
- `n8n-workflows/WF-META-02-chatwoot-reply.json`
- `n8n-workflows/WF-DEMO-01-webchat.json`
- `n8n-workflows/README.md`
- `infra/.env.example`
- `infra/docker-compose.yml`
- `infra/nginx/default.conf`
- `infra/init-databases.sql`
- `infra/deploy.sh`
- `infra/dry-run.sh`
- `infra/seed-example.sql`
- `infra/check-availability.sql`
- `docs/guides/deploy-guide.md`
- `docs/deploy/deploy-guide.md`
- `docs/architecture/target-architectures-mode1-mode2.md`
- `docs/strategy/roadmap-executivo-mode2-go-live-mode1-transicao-2026-03-05.md`
- `docs/stories/salon-whatsapp-phase-6-hardening-mode-2.md`
