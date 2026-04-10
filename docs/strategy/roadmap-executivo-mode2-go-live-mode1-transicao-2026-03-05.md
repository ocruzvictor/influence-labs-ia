# Roadmap Executivo - Go-Live Mode 2 e Transicao para Mode 1

Data base: 2026-03-05  
Contexto: handoff architect -> pm (`.aios/handoffs/handoff-architect-to-pm-mode2-go-live-roadmap-2026-03-05.yaml`)

## 1) Objetivo executivo
Operar em producao no Mode 2 (Meta Cloud API + Chatwoot + n8n) com rollout controlado, validar estabilidade operacional por fases, e iniciar transicao para Mode 1 (backend proprio) somente apos 30 dias de Fase 3 completa e estavel.

## 2) Premissas e guardrails de governanca
- Fonte de verdade operacional: CLI/workflows/documentacao tecnica.
- Escopo por fase conforme arquitetura alvo em `docs/architecture/target-architectures-mode1-mode2.md`.
- Deploy e ordem operacional conforme `docs/deploy/deploy-guide.md`.
- Fluxos n8n, env vars e dependencias conforme `n8n-workflows/README.md`.
- Regras de seguranca obrigatorias:
  - sem credencial hardcoded em workflow;
  - exposicao publica apenas em 80/443;
  - trilha de auditoria em logs/metricas.

## 3) Cronograma executivo por milestones (orientado a gates)
Definicao de marco temporal:
- `T0`: dia de deploy produtivo da VPS (inicio do go-live).
- Datas abaixo sao relativas a `T0` para evitar acoplamento a calendario fixo.

| Milestone | Janela | Resultado esperado |
| --- | --- | --- |
| M0 - Readiness de VPS | T0-7 ate T0-1 | VPS contratada, DNS (`n8n`/`chat`) pronto, `.env` validado, compose valido |
| M1 - Deploy inicial | T0 | Stack ativa com SSL, workflows importados, webhook Meta e Chatwoot configurados |
| M2 - Rollout 10% | T0+1 ate T0+3 | Operacao controlada com monitoramento intensivo |
| M3 - Rollout 50% | T0+4 ate T0+7 | Escala intermediaria sem degradacao de SLA |
| M4 - Rollout 100% | T0+8 em diante | Operacao plena (se SLOs e gates cumpridos) |
| M5 - Gate Fase 1 | minimo 7 dias apos M4 | Atendimento reativo estavel validado |
| M6 - Gate Fase 2 | apos estabilidade da Fase 1 | Agendamento Trinks consistente validado |
| M7 - Inicio Fase 3 | apos GO da Fase 2 | Proatividade com guardrails ativada |
| M8 - Gate Fase 3 | 30 dias de operacao Fase 3 | Operacao proativa estavel sem violacao de opt-out/janela segura |
| M9 - Gate de transicao Mode 2 -> Mode 1 | D+30 da Fase 3 completa | Decisao executiva de migracao (GO/NO-GO) |
| M10 - Cutover Mode 1 | apos GO em M9 | Paridade funcional 1:1 e cutover sem regressao de SLA |

## 4) Gates formais por fase (entrada/saida com decisao GO/NO-GO)

### Fase 1 - MVP Reativo (WF-01, WF-03, WF-05)
**Entrada (obrigatorio):**
- Meta Cloud API habilitada (token + phone number id + webhook).
- Inbox Chatwoot configurada.
- Workflows importados e IDs de `Execute Workflow` validados.

**Saida (obrigatorio):**
- SLA de resposta inicial dentro da meta definida pelo produto.
- Taxa de handoff sem erro tecnico >= meta acordada.
- Sem queda critica de webhook/roteamento por 7 dias consecutivos.

**KPI de decisao:**
- `tempo_medio_primeira_resposta`
- `taxa_handoff_concluido`
- `taxa_erro_workflow_router`

**Regra GO/NO-GO:**
- GO: 100% dos criterios de saida cumpridos.
- NO-GO: qualquer criterio obrigatorio falho; manter em Fase 1 e aplicar rollback guardrail se houver incidente critico.

### Fase 2 - Agendamento (WF-02 + Trinks + contexto em Postgres)
**Entrada (obrigatorio):**
- Fase 1 estavel e sem regressao de SLA.
- `TRINKS_API_BASE_URL`, `TRINKS_API_KEY`, `TRINKS_SALON_ID` validados no ambiente alvo.

**Saida (obrigatorio):**
- Taxa de sucesso de agendamento >= meta acordada.
- Erros de integracao Trinks abaixo do limite de tolerancia.
- Zero confirmacao de horario inexistente na janela de validacao.

**KPI de decisao:**
- `booking_success_rate`
- `booking_error_rate`
- `booking_retry_rate`

**Regra GO/NO-GO:**
- GO: criterios de saida cumpridos e sem incidente recorrente de integracao.
- NO-GO: retorno para modo reativo + handoff humano ate estabilizar integracao.

### Fase 3 - Upsell/Proatividade (WF-04 + WF-06)
**Entrada (obrigatorio):**
- Fase 2 estavel com historico suficiente.
- Regras comerciais e limites de frequencia aprovados pelo negocio.

**Saida (obrigatorio):**
- Conversao de follow-up/reativacao dentro da meta do plano.
- Taxa de reclamacao por mensagens proativas abaixo do limite acordado.
- 30 dias sem violacao de opt-out/janela segura.

**KPI de decisao:**
- `followup_conversion_rate`
- `reactivation_conversion_rate`
- `proactive_optout_rate`
- `proactive_complaint_rate`

**Regra GO/NO-GO:**
- GO: criterios de saida cumpridos por 30 dias corridos.
- NO-GO: pausar `WF-04`/`WF-06` e manter atendimento base (reativo + humano).

### Fase 4 - Transicao para Mode 1 (backend proprio)
**Entrada (obrigatorio):**
- 30 dias de Fase 3 em producao com estabilidade comprovada.
- Regras de negocio estabilizadas e metricas historicas consolidadas.

**Saida (obrigatorio):**
- Paridade funcional 1:1 (Mode 2 vs Mode 1) validada em homologacao.
- Cutover sem regressao de SLA e sem aumento de erro acima do limite acordado.

**KPI de decisao:**
- `slo_parity_mode2_vs_mode1`
- `incident_rate_after_cutover`

**Regra GO/NO-GO:**
- GO: paridade comprovada + risco operacional aceitavel.
- NO-GO: adiar cutover, manter Mode 2 e fechar gaps de paridade.

## 5) RACI simplificado (dono tecnico, operacao, negocio)
Legenda:
- `DT`: Dono Tecnico (arquitetura/engenharia)
- `DO`: Dono Operacao (infra/observabilidade/runbook)
- `DN`: Dono Negocio (produto/resultado/governanca)

| Entrega/Decisao | DT | DO | DN |
| --- | --- | --- | --- |
| Readiness de VPS e hardening | A/R | R | I |
| Deploy stack, SSL, DNS e health checks | R | A/R | I |
| Importacao/config n8n + webhook + Chatwoot | A/R | R | I |
| Gate GO/NO-GO Fase 1 | R | R | A |
| Gate GO/NO-GO Fase 2 | R | R | A |
| Gate GO/NO-GO Fase 3 | R | R | A |
| Decisao de pausar proatividade (rollback guardrail) | C | R | A |
| Decisao de transicao para Mode 1 (M9) | R | C | A |
| Homologacao de paridade e cutover Mode 1 | A/R | R | C |

## 6) Cronograma operacional da VPS (go-live Mode 2)

### Preflight (T0-7 ate T0-1)
- Contratar VPS (Hostinger) com capacidade minima para Mode 2.
- Configurar DNS para `n8n.<dominio>` e `chat.<dominio>`.
- Preencher `infra/.env` com todas as variaveis obrigatorias.
- Rodar `docker compose config` para validar compose.

### Provisionamento e deploy (T0)
1. Acesso SSH inicial + update do sistema + hardening basico.
2. Instalar Docker e Docker Compose.
3. Clonar repositorio e copiar `.env.example` para `.env`.
4. Ajustar `.env` com Meta/Chatwoot/Trinks/LLM.
5. Subir `nginx + certbot` e emitir SSL.
6. Subir stack completa (`docker compose up -d`).
7. Validar servicos (`docker compose ps` + health checks).
8. Importar `WF-01..WF-06` e ajustar IDs `Execute Workflow`.
9. Configurar credencial `Postgres Main` no n8n (`influence_labs_salon`).
10. Configurar webhook Meta em `/webhook/salon/router`.
11. Configurar inbox Chatwoot e `CHATWOOT_*` no `.env`.
12. Executar smoke test E2E real (WhatsApp -> resposta -> log em Postgres).

### Ramp de trafego (apos T0)
- Dia 1-3: 10% do trafego.
- Dia 4-7: 50% do trafego.
- Dia 8+: 100% do trafego (somente se SLOs cumpridos).

### Guardrails de rollback
- Falha critica em webhook/roteamento acima do limite: pausar `WF-04`/`WF-06`.
- Erro recorrente Trinks: operar em modo reativo + handoff humano.
- Manter toggle operacional documentado para desligar proatividade sem parar atendimento base.

## 7) Plano de transicao Mode 2 -> Mode 1 (apos 30 dias da Fase 3)
Marco de inicio: `T3+30`, onde `T3` = data de conclusao da Fase 3 (gate de saida aprovado).

### Etapa A - Gate de entrada (T3+30)
- Consolidar 30 dias de indicadores de Fase 3.
- Confirmar estabilidade operacional e regras de negocio maduras.
- Deliberacao executiva GO/NO-GO (M9).

### Etapa B - Paridade funcional e homologacao
- Mapear fluxos 1:1 (router, FAQ, agendamento, handoff humano, cron/proatividade).
- Validar contratos de integracao (Meta, Trinks, Chatwoot, Postgres).
- Executar homologacao comparativa Mode 2 vs Mode 1 por casos criticos.

### Etapa C - Cutover controlado
- Iniciar cutover progressivo com janela controlada.
- Monitorar `slo_parity_mode2_vs_mode1` e `incident_rate_after_cutover`.
- Reverter para Mode 2 se houver regressao acima do limite acordado.

### Etapa D - Estabilizacao pos-cutover
- Confirmar SLA e taxa de erro no novo runtime.
- Formalizar encerramento da transicao quando paridade e estabilidade forem sustentadas.

## 8) Monitoramento semanal com thresholds de decisao
Ritmo:
- Cerimonia semanal de operacao (DT + DO + DN).
- Revisao diaria durante ramp (10%/50%/100%).

Thresholds (alinhados ao handoff; metas numericas devem ser definidas pelo produto antes de T0):
- `tempo_medio_primeira_resposta`: <= meta de SLA.
- `taxa_handoff_concluido`: >= meta acordada.
- `taxa_erro_workflow_router`: <= limite de tolerancia.
- `booking_success_rate`: >= meta acordada.
- `booking_error_rate` e `booking_retry_rate`: <= limite de tolerancia.
- `proactive_optout_rate` e `proactive_complaint_rate`: <= limite acordado.
- Violacao de opt-out/janela segura: tolerancia zero na Fase 3 (gatilho de NO-GO).

Regra executiva de decisao:
- Qualquer violacao de criterio obrigatorio bloqueia avancar de fase.
- Em incidente critico, priorizar continuidade de atendimento base e acionar guardrail de rollback.
