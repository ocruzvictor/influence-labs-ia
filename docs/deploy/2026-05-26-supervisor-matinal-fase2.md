# Deploy Fase 2: Supervisor matinal cron 7h

**Branch:** `feature/booking-2phase-v2` (continuação)
**Data:** 2026-05-26
**Escopo:** triagem priorizada das conversas fora-de-horário, digest enviado ao Tiago às 7h ter-sáb

## O que entra

1. `backend/supervisor.js` — módulo standalone (zero dependência nova; usa fetch nativo + db existente).
2. Scheduler interno: `setInterval` 60s checando se é 7:00-7:05 ter-sáb fuso `America/Sao_Paulo`. Guarda dia executado em memória pra evitar duplicação.
3. Endpoint admin: `POST /admin/trigger-supervisor?dryRun=1` protegido por header `X-Admin-Token`. Permite rodar fora do cron pra testar.
4. Pipeline:
   - Lookback dinâmico: 24h normalmente, 48h na terça (pega dom+seg).
   - Coleta conversas distintas por `client_phone` do `conversation_history`.
   - Chama TESS Supervisor (agente 46590) por conversa com as últimas 12 msgs + dados do cliente.
   - Parseia JSON, ordena por `priority_score`, pega top N.
   - Renderiza msg numerada e envia ao `TIAGO_NOTIFICATION_PHONE` via Kapso usando o último `phoneNumberId` visto em webhooks.
5. Prompt Supervisor v1 atualizado com `priority_score` + tabela de calibração + categoria nova (`oportunidade_quente`, `cliente_vip`).

## Atualizações necessárias

### 1. Painel TESS — agente 46590

Atualizar prompt do Supervisor (cola conteúdo de `docs/prompts/tess-supervisor-v1.md`). Mudança principal:
- Novo campo obrigatório no JSON: `priority_score: 0-100`
- Tabela de calibração na seção `## PRIORITY_SCORE`
- Categorias novas: `oportunidade_quente`, `cliente_vip`

### 2. `.env` no VPS

Adicionar:
```
ADMIN_TOKEN=<gera uma string aleatoria, vou usar pra trigger manual>
```

Opcional (defaults vêm do docker-compose):
```
SUPERVISOR_AGENT_ID=46590       # default ja eh 46590
SUPERVISOR_TOP_N=10              # default ja eh 10
```

Pra gerar token aleatório no terminal:
```bash
openssl rand -hex 16
```

## Deploy

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git pull
nano .env      # adiciona ADMIN_TOKEN=...
docker compose up -d --build backend
```

Espera ~30s. Confere:

```bash
docker logs --tail 20 backend 2>&1 | grep supervisor
```

Esperado: `[supervisor] scheduler iniciado (verifica 7h ter-sab horario salao)`

## Smoke test em produção (sem esperar 7h)

Roda do seu terminal local:

```bash
# Dry run — gera digest mas NAO envia ao Tiago
curl -X POST -H "X-Admin-Token: SEU_TOKEN_AQUI" \
  "https://api.studiotirra.com.br/admin/trigger-supervisor?dryRun=1" | python3 -m json.tool
```

**Esperado:**
- `ok: true`
- `ranked_count: N` (depende de quantas conversas tiveram nas últimas 24h)
- `digest_preview`: amostra do texto que iria pro Tiago

Se o dry run veio bem, dispara o REAL (sem dryRun):

```bash
curl -X POST -H "X-Admin-Token: SEU_TOKEN_AQUI" \
  "https://api.studiotirra.com.br/admin/trigger-supervisor" | python3 -m json.tool
```

**Esperado:**
- Tiago recebe no WhatsApp dele uma mensagem `🌅 Bom dia! Top N conversa(s)...`

Log do backend deve mostrar:
```
[supervisor] triagem matinal iniciada (lookback=24h, dryRun=false)
[supervisor] N conversas distintas nas ultimas 24h
[supervisor] digest pronto: M itens (de N classificadas)
[supervisor] digest enviado a 5511937750330
```

## Comportamento do scheduler automático

- Checa a cada 60s se é 7:00-7:05 no fuso do salão.
- Roda **apenas ter-sex e sáb** (dom-seg não, salão fechado).
- Marca o dia em memória pra não rodar 2x.
- **Cuidado:** se o container reiniciar entre 7h e meia-noite do mesmo dia, pode rodar 2x. Trade-off aceito (cron simples sem dependência externa).
- Próximo passo (se quiser robustez extra): mover marcação pro DB. P1.

## Rollback

```bash
cd /opt/influence-labs/infra
git checkout feature/meta-cloud-direct
docker compose up -d --build backend
```

## Custos previstos

Cada chamada Supervisor TESS = ~R$ 0,04. Se aparecerem 20 conversas distintas em 24h, custo do digest = ~R$ 0,80/dia. Aceitável.

Se quiser limitar: setar `SUPERVISOR_TOP_N=5` reduz pra ~R$ 0,20/dia (mesmo número de chamadas TESS, mas é só a renderização — não economiza chamadas).

**Otimização P2 (não-bloqueante):** pré-filtrar no SQL conversas que já têm tag `[HANDOFF_HUMAN]` no histórico OU mais que N turnos sem fechamento. Reduz chamadas TESS pela metade.
