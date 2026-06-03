# Checklist de deploy — branch `feature/bot-46589-ajustes-resposta`

> Executar quando a **cota Trinks estiver destravada** (Victor contratou +5.000). Deploy de BRANCH no VPS (não merge em main — esse é gate explícito do Victor). Salão fechado = janela segura.

## 0. Pré-requisitos
- [ ] Trinks destravada (adicional +5.000 contratado OU mês virou).
- [ ] Victor aplicou (ou vai aplicar) os 4 blocos de prompt no TESS 46589 → `46589-prompt-changes-2026-06-02.md`. (Backend funciona sem, mas itens 2/3 só ficam completos com o prompt.)

## 1. Env vars novas no VPS (`infra/.env` ou compose)
- [ ] `TRINKS_MONTHLY_BUDGET=5000` — **⚠️ JUNHO usar ~5000 (o ADICIONAL), não 10000** (o contador começa em 0 e a base de junho já foi gasta; ver story quota-monitor). Em julho, usar o total contratado.
- [ ] `TRINKS_ALERT_PHONES=<número do Victor com 55>` — recebe os alertas de cota.
- [ ] (já têm default são, conferir): `TRINKS_SYNC_INTERVAL_MIN=360`, `TRINKS_PING_TTL_S=600`, `TRINKS_MAX_CONCURRENCY=3`, `TRINKS_MAX_RETRIES=2`.

## 2. Deploy
```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs && git fetch && git checkout feature/bot-46589-ajustes-resposta && git pull
# Migration 005 (contador de cota) — APLICAR antes de subir:
docker exec -i <postgres-container> psql -U <user> -d influence_labs_salon < infra/migrations/005_trinks_api_usage.sql
cd infra
docker compose up -d --build backend admin-trinks-sync   # ⚠️ REBUILD do worker também (pegou trinks-client/trinks-usage novos)
docker compose restart nginx                               # SEMPRE após recreate (senão 502)
```

## 3. Smoke (verificar de dentro do container; só tem wget)
- [ ] **Boot OK:** `docker exec backend sh -c 'wget -qO- localhost:3001/health'` → 200 e JSON (não erro de module-load). Conferir startup logs sem throw.
- [ ] **Trinks viva:** `trinks_ping.status` = `ok` (confirma cota destravada).
- [ ] **Contador do BOT incrementa:** ver `trinks_usage.used` subir após uma conversa de teste (ou após o `/health` que dispara o ping).
- [ ] **Contador do WORKER incrementa (CRÍTICO — processo separado):** rodar/aguardar um ciclo do `admin-trinks-sync` e confirmar que `trinks_usage.used` subiu por causa dele (o worker era o 11× consumidor; o require de db/trinks-usage nele é lazy/try-catch → se o path não resolver na imagem, ele NÃO conta silenciosamente). `docker logs admin-trinks-sync` + comparar `used` antes/depois.
- [ ] **Cache funcionando:** `trinks_cache.hits` > 0 após repetir chamadas (serviços/profs cacheados 20min).
- [ ] **Item 1:** criar um agendamento de teste via bot → card de confirmação mostra a **linha do serviço** (💅).
- [ ] **Item 3 (e2e, número de teste whitelisted):** criar agendamento → pedir cancelamento → confirmar na Trinks que cancelou + log `Booking cancel from tag` + `PATCH cancelado → 200`. Limpar resíduo.
- [ ] **Sem regressão:** fluxo de agendamento feliz continua OK.

## 4. AC6 — checar header autoritativo de cota (fazer assim que a API responder)
- [ ] Inspecionar uma resposta da Trinks por headers `X-RateLimit-Remaining`/`-Limit`/`Retry-After`. Se existirem → são a fonte autoritativa de cota (resolve o cold-start do self-counter). Registrar e, se fizer sentido, enriquecer o `/health.trinks_usage` com o valor real.

## 5. Pós-smoke
- [ ] Fechar stories (resiliência-429, quota-monitor) + atualizar `/saude` se for exibir a cota.
- [ ] **Merge em main = decisão explícita do Victor** (nada pushado até ele autorizar).
- [ ] Seguir: item 2 (Fase C — probe `/servicos` + worker constrói mapa de habilitação) e story de webhooks.

## Commits da branch (ordem)
`59da171` item1 · `2618975` decisões arq · `7c0e7b4` resiliência · `a480d2b` item3 RotaC · `3a0f305` prompt deliverables · `764b468` cortes consumo · `1c9b211` story webhooks · `bbcbaab` quota-monitor (+ fix pnid fallback).
