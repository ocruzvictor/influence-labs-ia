# Story: Trinks Webhooks — Sync de agendamentos em tempo real (corta polling)

**Tipo:** Brownfield architecture/integration (backend) — evolução da resiliência Trinks
**Status:** Draft — bloqueada na Fase 0 (capacidade de webhook da Trinks) + conta Trinks (cota)
**Agente executor:** @dev (gate @architect; config do webhook no painel Trinks = Victor/@devops)
**Story Points:** 8 (estimado; refinar pós-Fase 0)
**Branch sugerida:** `feature/trinks-webhooks-realtime`
**Origem:** decisão Victor (2026-06-02) — fix do worker = webhooks, não só baixar frequência. A FAQ da Trinks recomenda API (ativo) + Webhooks (passivo). Resolve o teto de 5.000/mês de vez.

## Contexto / Problema
O worker `trinks-sync` paginava a janela de agendamentos **a cada 15min** (~55k chamadas/mês = 11× o teto de 5.000/mês da Trinks) — causa-raiz do 429 que degradou o bot. Medida imediata já aplicada (commit `764b468`): worker 15min→6h + ping 60s→10min. **Esta story é o estado-final:** a Trinks empurra eventos de agendamento (criado/alterado/cancelado) em tempo real → atualizamos `trinks_appointments` na hora → o worker vira só **reconciliação diária** (rede de segurança), não a fonte primária.

**Bônus:** os webhooks trazem o evento de **criação** → preenchem `created_at_trinks` (hoje NULL, porque a API REST não dá data de criação — limitação documentada na Story 1.6).

## Fase 0 — Descoberta (BLOQUEIA implementação)
- [ ] **AC1:** Confirmar na doc/painel Trinks: (a) quais eventos de webhook existem (agendamento criado/alterado/cancelado/status), (b) o **payload** de cada evento, (c) o mecanismo de **assinatura/validação** (HMAC? header? secret?), (d) como **assinar/configurar** o webhook (painel vs API). Fonte: `https://ajuda.trinks.com/faq-completo-conecta-trinks-e-integracoes` + doc de referência. **Precisa de acesso à conta/painel Trinks (Victor) — e idealmente API destravada (upgrade ou pós-1º/jul).**

## Escopo
### IN
- Endpoint `POST /webhook/trinks` no backend: valida assinatura, normaliza o evento, faz **upsert em `trinks_appointments`** (reusa `mapAppointment` da Story 1.6).
- Idempotência (eventos duplicados/reentrega não corrompem estado — UPSERT por `trinks_id` já é idempotente).
- Worker `trinks-sync` rebaixado a **reconciliação 1×/dia** (rede de segurança p/ eventos perdidos), janela ampla, fora do horário de pico.
- `created_at_trinks` preenchido a partir do evento de criação.
- Logging/observabilidade dos eventos recebidos.
- Config do webhook na Trinks (Victor/@devops).

### OUT
- Webhooks de outros domínios (clientes, serviços) — só agendamentos nesta story.
- UI de gestão de webhooks.
- O item 2 (mapa de habilitação) — frente separada (Fase C da story do bot).

## Acceptance Criteria (preliminar — refinar pós-Fase 0)
- [ ] **AC2:** `POST /webhook/trinks` valida assinatura e rejeita inválidos (padrão do `/webhook/kapso` já existente — `validateKapsoSignature` como referência).
- [ ] **AC3:** Evento de criação/alteração/cancelamento → `trinks_appointments` reflete em ≤ segundos (upsert idempotente por `trinks_id`).
- [ ] **AC4:** `created_at_trinks` populado pelos eventos de criação.
- [ ] **AC5:** Worker rebaixado a 1×/dia (reconcile) — consumo total Trinks projetado **< 5.000/mês** (worker ~570/mês + ping + bot cacheado).
- [ ] **AC6:** Reentrega/duplicata de evento não cria linha duplicada nem corrompe status.
- [ ] **AC7:** Webhook indisponível/atrasado → o reconcile diário cobre o gap (consistência eventual garantida).
- [ ] **AC8:** Testes unitários do parser/upsert de evento (mock). Smoke: evento real (criar/cancelar um agendamento de teste) reflete no DB.
- [ ] **AC9:** Doc de configuração do webhook (secret, URL, eventos assinados) no repo.

## Dev Notes
- Reusar `validateKapsoSignature` (server.js) como molde de validação HMAC.
- Reusar `mapAppointment` / `normalizePhoneBR` (lib/trinks-mapping) e `upsertChunk` (worker) — extrair o upsert pra um lib compartilhado se necessário.
- Endpoint deve responder 2xx rápido (ack) e processar — padrão do `/webhook/kapso`.
- Depende de: conta Trinks destravada (upgrade ou reset 1º/jul) p/ configurar e testar o webhook.

## CodeRabbit Integration
- Specialized: backend, integração/segurança (validação de assinatura).
- Gate: @architect (design) + @qa (idempotência/segurança).
