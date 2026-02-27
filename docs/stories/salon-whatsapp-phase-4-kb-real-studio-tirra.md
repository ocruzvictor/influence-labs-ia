# Story: Salon WhatsApp - Phase 4 (KB Real Studio Tirra + Trinks)

## Contexto
Executar o plano `docs/PLANO-FASE-4-KB-REAL-STUDIO-TIRRA.md` com substituicao da KB generica, atualizacao de prompts, adaptacao para Trinks e reforco de testes/RAG.

## Objetivo
Entregar uma base operacional real do Studio Tirra para atendimento WhatsApp com consistencia de tom, regras e arquitetura de agenda centrada na Trinks API.

## Checklist
- [x] Reescrever `data/kb/salon-info.md`
- [x] Reescrever `data/kb/services.md` com catalogo real
- [x] Reescrever `data/kb/professionals.md`
- [x] Reescrever `data/kb/scheduling-rules.md`
- [x] Reescrever `data/kb/faq.md`
- [x] Reescrever `data/kb/sales.md`
- [x] Criar `data/kb/products.md`
- [x] Criar `data/kb/client-classification.md`
- [x] Atualizar `data/prompts/router-prompt.md`
- [x] Reescrever `data/prompts/receptionist-prompt.md`
- [x] Atualizar `data/prompts/faq-prompt.md`
- [x] Atualizar `data/prompts/sales-prompt.md`
- [x] Criar `data/prompts/anti-patterns.md`
- [x] Criar `docs/research/trinks-api-research.md`
- [x] Atualizar `infra/schema.sql`
- [x] Atualizar workflows n8n de agenda para Trinks HTTP
- [x] Atualizar `data/rag/kb-index.json` (150+ entradas)
- [x] Atualizar `tests/prompt-tests.json` com cenarios Studio Tirra
- [x] Rodar quality gates (`npm run lint`, `npm run typecheck`, `npm test`)
- [x] Atualizar checklist e file list com status final

## File List
- `data/kb/salon-info.md`
- `data/kb/services.md`
- `data/kb/professionals.md`
- `data/kb/scheduling-rules.md`
- `data/kb/faq.md`
- `data/kb/sales.md`
- `data/kb/products.md`
- `data/kb/client-classification.md`
- `data/prompts/router-prompt.md`
- `data/prompts/receptionist-prompt.md`
- `data/prompts/faq-prompt.md`
- `data/prompts/sales-prompt.md`
- `data/prompts/anti-patterns.md`
- `docs/research/trinks-api-research.md`
- `infra/schema.sql`
- `n8n-workflows/WF-02-receptionist.json`
- `n8n-workflows/WF-04-sales.json`
- `n8n-workflows/WF-06-cron-jobs.json`
- `data/rag/kb-index.json`
- `tests/prompt-tests.json`
- `tests/run-prompt-tests.js`
- `docs/stories/salon-whatsapp-phase-4-kb-real-studio-tirra.md`
