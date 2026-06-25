# Story: Trinks Webhook-First + Orçamento REST do Agente SDR

**Tipo:** Brownfield architecture/integration
**Status:** Ready for Review — webhook real confirmado
**Agente executor:** @dev, com gates @architect, @data-engineer, @qa e deploy @devops
**Branch:** `feature/bot-46589-ajustes-resposta`

## Objetivo

Retirar leituras Trinks do caminho de cada mensagem, usar webhooks Amazon SNS como
fonte primária de alterações e manter o consumo REST do agente abaixo do teto
operacional de 8.500 requisições por mês, sobre uma cota contratada de 10.000.

## Acceptance Criteria

- [x] AC1: `POST /webhook/trinks` confirma assinatura SNS, valida assinatura digital,
  restringe certificados a hosts AWS válidos e deduplica por `MessageId`.
- [x] AC2: eventos de inclusão, alteração e exclusão de agendamento atualizam
  `trinks_appointments` de forma idempotente.
- [x] AC3: eventos de cliente e profissional atualizam snapshots locais.
- [x] AC4: catálogo de serviços, profissionais, compatibilidade e slots têm snapshots
  locais consultáveis pelo runtime.
- [x] AC5: mensagens sem mutação usam somente Postgres e fazem zero requisições Trinks.
- [x] AC6: combinação serviço-profissional inválida é bloqueada antes da mutação.
- [x] AC7: create/cancel/reschedule conhecidos fazem uma mutação REST cada; cliente novo
  tem teto de três chamadas.
- [x] AC8: toda tentativa REST é registrada por método, endpoint, origem e status;
  HTTP 429 não é contabilizado como consumo oficial.
- [x] AC9: `GET /v1/consumo` é persistido separadamente da telemetria local.
- [x] AC10: circuit breaker aplica os limites 6.000, 7.500, 8.200 e 8.500.
- [x] AC11: reconcile roda diariamente fora do pico, persiste por página e para no
  primeiro 429 sem descartar progresso.
- [x] AC12: CLI projeta 28 dias nos cenários conservador, base, agressivo e stress.
- [x] AC13: gates: conservador <3.000, base <5.000, agressivo <8.500 e stress bloqueado
  antes de 8.500.
- [x] AC14: `/health` expõe webhook, snapshots, ledger local, consumo oficial e
  divergência.
- [x] AC15: webhook real validado é gate para clientes reais; `BOT_ACCEPT_ALL` permanece
  desligado até aprovação operacional.
- [x] AC16: lint, typecheck, testes raiz, testes backend e build passam.

## Tasks / Subtasks

- [x] Modelar e migrar estado local, envelopes SNS, ledger e snapshots de consumo.
- [x] Implementar validação/processamento SNS e testes.
- [x] Implementar cliente REST instrumentado, orçamento e circuit breaker.
- [x] Implementar snapshots/reconcile e projeção CLI.
- [x] Refatorar runtime para leitura local e mutações com validação.
- [x] Atualizar health, compose, env example e runbook externo.
- [x] Executar QA e preparar handoff de deploy.
- [x] Executar smoke interno após migration aplicada.

## Dev Agent Record

### Agent Model Used

GPT-5.4 / Codex, orquestrado por AIOS.

### Debug Log References

- Suporte Trinks confirmou em 2026-06-18: cota recorrente 10.000/mês, reset dia 1,
  webhooks não consomem REST e páginas contam individualmente.
- `GET /v1/consumo` retornou cotaTotal=10000, totalUtilizado=20018, saldoRestante=0,
  divergente da liberação operacional; sinais permanecem separados.
- Webhook oficial usa Amazon SNS e suporta eventos 3-7 e 11-13.

### Completion Notes List

- Runtime comum não chama REST Trinks; horários, profissionais, serviços,
  compatibilidade, clientes e agendamentos são lidos do Postgres.
- Cliente REST único registra tentativas e aplica os quatro limites.
- Receptor SNS valida assinatura, certificado, ARN, URL de confirmação e
  deduplica no banco.
- Bootstrap controlado aceita apenas `SubscriptionConfirmation` assinada quando
  a Trinks nao fornece o ARN previamente; o tópico confirmado passa a ser a
  fonte confiável para mensagens seguintes.
- Baseline de produção dos últimos 28 dias: 82,84 clientes/dia e
  58,79 agendamentos/dia.
- Projeção executada: 2.068 / 4.130 / 5.631 / 8.775 requisições por mês.
- Gates raiz, backend e frontend verdes.
- Migration validada em transação revertida e aplicada em produção em 2026-06-20.
- Snapshot inicial concluído: 12 profissionais, 117 serviços, 261 pares de
  compatibilidade, 574 slots recebidos e 840 agendamentos reconciliados.
- Smoke comum respondeu 200 e manteve o ledger em 45 chamadas antes/depois.
- Deploy concluído e gate técnico do webhook liberado.
- Assinatura SNS confirmada em produção em 2026-06-25; ARN fixado no ambiente e
  bootstrap temporário desativado.

### File List

- `backend/lib/trinks-api.js`
- `backend/lib/trinks-client.js`
- `backend/lib/trinks-forecast-model.js`
- `backend/lib/trinks-local-store.js`
- `backend/lib/trinks-sns.js`
- `backend/lib/trinks-usage.js`
- `backend/lib/trinks-webhook-processor.js`
- `backend/db.js`
- `backend/server.js`
- `backend/trinks-forecast.js`
- `backend/trinks-state-worker.js`
- `backend/test/trinks-api.test.js`
- `backend/test/trinks-forecast.test.js`
- `backend/test/trinks-local-store.test.js`
- `backend/test/trinks-sns.test.js`
- `backend/test/trinks-state-worker.test.js`
- `backend/test/trinks-webhook-processor.test.js`
- `frontend/admin/components/saude/health-card.tsx`
- `frontend/admin/components/saude/health-tab.tsx`
- `frontend/admin/lib/health-status.ts`
- `frontend/admin/tests/saude-helpers.test.ts`
- `infra/.env.example`
- `infra/docker-compose.yml`
- `infra/migrations/007_trinks_local_snapshots.sql`
- `infra/migrations/007_trinks_local_snapshots.rollback.sql`
- `docs/ops/trinks-webhook-first-pilot.md`
- `docs/stories/salon-whatsapp-trinks-webhook-first-budget.md`
- `package.json`

### Change Log

- 2026-06-18: story criada a partir do plano acelerado aprovado por Victor.
- 2026-06-19: implementação técnica, testes e runbook concluídos; gates externos pendentes.
- 2026-06-20: migration e deploy aplicados; snapshot, forecast e smoke interno aprovados.

## QA Results

- Gate final: **PASS**.
- Backend: 138/138.
- Prompts raiz: 79/79.
- Admin: 101 testes, 25 integrações Postgres ignoradas por container local indisponível.
- Admin build: concluído.
- Forecast com baseline real de 28 dias: PASS.
- DDL: validado em PostgreSQL real com `ROLLBACK`.
