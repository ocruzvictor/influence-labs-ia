# Story: Trinks Quota Monitor — contador mensal + alerta de cota

**Tipo:** Brownfield feature (backend + worker) — observabilidade da cota Trinks
**Status:** ✅ Implementado (YOLO 2026-06-03), aguarda deploy + smoke
**Agente executor:** @dev | **Story Points:** 3
**Branch:** `feature/bot-46589-ajustes-resposta`
**Origem:** decisão Victor pós-conversa com suporte Trinks (ver [[trinks-api-limits]]).

## Contexto
Cota Trinks: **5.000/mês (R$120)** + adicionais **R$60/+5.000, NÃO cumulativos**. Pra manter a API viva sem susto, precisamos **monitorar o consumo** e **ser avisados** ao chegar perto do teto — pra decidir "compro +5.000 agora ou espero o mês virar". **Dois processos** consomem a mesma chave: backend (bot, via `lib/trinks-cache`) e worker `admin-trinks-sync` (via `lib/trinks-client`).

## Entrega
- **Contador único no Postgres** (`trinks_api_usage`, migration 005): chave `yyyymm` (fuso salão), `used` incrementado por UPSERT. Ambos os processos incrementam (nova linha por mês = reset natural, alinhado à cota não-cumulativa).
- **`lib/trinks-usage.js`** (testável): `recordTrinksCall(db)` (fire-and-forget, +1), `getTrinksUsage(db, budget)` (`{month, used, budget, remaining, pct}`), `newlyCrossed(pct, thresholds, alerted)`, `salonMonthKey`.
- **Instrumentação:** `trinks-cache` chama `onCall` por tentativa (cada request consome cota, inclusive 429); `trinks-client` (worker) chama `recordTrinksCall` direto.
- **`/health.trinks_usage`** expõe o snapshot.
- **Alerta WhatsApp** (`setInterval` 10min, configurável): ao cruzar **80/90/100%**, manda msg pra `TRINKS_ALERT_PHONES` (CSV) via Kapso + WARN log; 1×/threshold/mês (reset no virar do mês).
- **Budget configurável:** `TRINKS_MONTHLY_BUDGET` (default 5000; setar **10000** em junho com o adicional contratado).

## Acceptance Criteria
- [x] **AC1:** Toda chamada Trinks (bot + worker) incrementa o contador do mês corrente.
- [x] **AC2:** `/health.trinks_usage` mostra used/budget/remaining/pct.
- [x] **AC3:** Alerta dispara 1× por threshold (80/90/100%) por mês; reseta no mês novo.
- [x] **AC4:** Fire-and-forget — falha de DB nunca quebra o hot-path nem o worker.
- [x] **AC5:** Testes unitários (db mock): 8 casos. Suíte 102/102.
- [ ] **AC6 (PRIORIDADE quando a API voltar):** checar se a Trinks devolve header de rate-limit (`X-RateLimit-Remaining`/`-Limit`). Se SIM → é autoritativo, resolve o cold-start do contador (que começa em 0 cego à cota já gasta) e vira a fonte primária; o self-counter fica como tendência. **Não confiar no self-counter pra decisão de compra em junho sem antes checar isso.**

## Env novas
- `TRINKS_MONTHLY_BUDGET` — **⚠️ em JUNHO usar ~5000 (o ADICIONAL), NÃO 10000.** O contador começa em 0 no deploy, mas a base de 5000 de junho **já foi gasta** (causa do bloqueio). Com budget=adicional, "chamadas desde o deploy" ≈ "adicional sendo consumido" → os alertas 80/90/100% disparam no que de fato dá pra esgotar. **Julho** é o 1º mês com contador preciso desde o dia 1 → aí usar o total contratado.
- `TRINKS_ALERT_PHONES` (CSV, dígitos) — quem recebe o alerta (ex: número do Victor).
- `TRINKS_QUOTA_CHECK_MIN` (default 10).

> **Premissa do contador:** conta TODA tentativa, inclusive retries de 429 → roda **ligeiramente à frente** da contagem da Trinks (defensivo, alerta cedo). Se a Trinks não contar 429 rejeitado, a diferença é maior. Por isso o header autoritativo (AC6) é o alvo real.

## Follow-up (não nesta story)
- Enriquecer com header autoritativo de rate-limit da Trinks (se existir) — verificar quando a API voltar.
- Exibir a cota no painel admin `/saude` (card).

## File List
- `infra/migrations/005_trinks_api_usage.sql` (+ rollback) (A)
- `backend/lib/trinks-usage.js` (A) + `backend/test/trinks-usage.test.js` (A)
- `backend/lib/trinks-cache.js` (M — onCall)
- `backend/lib/trinks-client.js` (M — worker conta no mesmo contador)
- `backend/server.js` (M — wiring, /health, alerta, budget)
