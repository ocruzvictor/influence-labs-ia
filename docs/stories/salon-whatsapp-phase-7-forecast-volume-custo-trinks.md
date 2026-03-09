# Story: Salon WhatsApp - Phase 7 (Forecast Volume/Custo com Trinks)

## Contexto
Executar o handoff `@pm -> @data-engineer` para modelar forecast operacional e financeiro com dados Trinks, suportando decisao por gate (GO/NO-GO) nas fases Mode 2 e a transicao futura para Mode 1.

## Objetivo
Entregar modelo de dados e camada analitica SQL para previsao 30/60/90 dias (cenarios conservador/base/agressivo), com KPIs de volume/custo e monitoramento semanal de desvio forecast vs realizado.

## Checklist
- [x] Definir modelo de dados de forecast (parametros, tarifas, mapeamentos, cenarios)
- [x] Definir normalizacao de eventos Trinks para create/rebook/cancel/error/retry
- [x] Definir KPIs diarios de volume (mensagens, booking, proatividade)
- [x] Definir KPIs diarios de custo (fixo + Meta variavel + LLM variavel)
- [x] Implementar baseline rolling com nivel de confianca
- [x] Implementar projection views para 30/60/90 dias com intervalo de confianca
- [x] Implementar visao semanal de monitoramento forecast vs realizado
- [x] Documentar formulas, lineage, riscos e plano de ingestao
- [x] Rodar quality gates (`npm run lint`, `npm run typecheck`, `npm test`)
- [x] Atualizar checklist e file list

## File List
- `infra/forecast-volume-custo-trinks.sql`
- `docs/ops/forecast-volume-custo-trinks-mode2.md`
- `docs/stories/salon-whatsapp-phase-7-forecast-volume-custo-trinks.md`
- `.aios/handoffs/handoff-pm-to-data-engineer-trinks-forecast-2026-03-05.yaml`
- `.aios/handoffs/handoff-data-engineer-to-devops-trinks-forecast-freeze-2026-03-05.yaml`
- `infra/backfill-trinks-90d.js`
- `n8n-workflows/WF-01-router.json`
- `.gitignore`
- `.aios/handoffs/handoff-devops-to-data-engineer-trinks-forecast-post-backfill-2026-03-06.yaml`
- `.aios/handoffs/handoff-devops-to-dev-n8n-router-incoming-history-2026-03-06.yaml`
