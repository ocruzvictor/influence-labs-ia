# ADR: WhatsApp BSP — Upgrade Kapso Pro

**Status:** Decided
**Data:** 2026-05-27
**Decisor:** Victor (com pesquisa @analyst Atlas)
**Supersede:** Plano original 24h de pesquisa F1+F2+F3 (encerrado por dimishing returns)

---

## Contexto

Bot Studio Tirra mudo desde ~26/05. Kapso free tier (2.000 msgs/mês) bateu limite em ~7 dias do ciclo. Reset apenas 20/jun. Volume real medido em 26/05: 322 msgs inbound + 26 outbound de 91 conversas únicas — clientes existentes do salão, **volume sustentado**.

Projeção 30 dias forward: **10-25k msgs/mês**.

---

## Decisão

**Comprar Kapso Pro = USD 25/mês.**

| Feature | Valor |
|---|---|
| Preço | $25/mês ($300/ano) |
| Limite mensagens | 100.000/mês (inbound + outbound) |
| Números WhatsApp | 3 |
| Read receipts | Não contam |
| Templates Meta | Custo separado (bot é reativo → impacto mínimo) |
| API/AI/Workflows | Ilimitado |

---

## Racional

### Por que Kapso Pro venceu

1. **Cobre folgado o volume real:** 100k vs projeção 10-25k → 4-10x de headroom. Pode crescer 5x sem trocar de plano.
2. **Reversível:** mensal, cancela quando quiser. Zero lock-in contratual.
3. **Zero retrabalho técnico:** integração já existe, splitter funciona, webhook OK. Migração teria custo de 1-3 dias dev.
4. **Custo absoluto baixo:** $300/ano. Mesmo se Meta direto saísse $60/ano, economia de $240/ano não justifica risco + tempo + esforço.
5. **3 números no plano:** room pra Tiago expandir (segundo salão, linha pessoal separada) sem upgrade.

### Por que NÃO Meta Cloud API direto

- BM Tiago: inviável (Meta bloqueada sem previsão)
- BM Influence Labs: CNPJ ativo, mas requer abrir BM novo + verificação Meta (1-3 dias incerto + risco de mesma restrição arbitrária)
- Economia anual estimada vs trabalho: dimishing returns
- Branch `feature/meta-cloud-direct` preservada como dívida técnica/opção futura — não morre

### Por que NÃO BSPs alternativos

- Pesquisa F3 cancelada por dimishing returns
- Cenário pra reabrir: se Kapso Pro ficar insuficiente em escala 5x (>500k msgs/mês) ou se Kapso tiver issue de qualidade/uptime
- Anotado como follow-up se sinal mudar

---

## Trade-offs aceitos

| Trade-off | Mitigação |
|---|---|
| Lock-in soft em Kapso (3-6 meses de produto rodando neles) | Mensal — desliga em qualquer momento |
| Templates Meta pagos separado | Bot é reativo, raro usar templates |
| Custo $300/ano vs $60/ano Meta direto | Custo é < 1% do faturamento esperado salão |
| Não exploramos BSPs alternativos | Reabrir pesquisa se sinal mudar (issue Kapso, escala 5x) |

---

## Próximas ações (imediato)

1. **Victor (5 min):** painel Kapso → Upgrade plan → Pro → pagar
2. **Victor (10 min):** smoke test WhatsApp — manda msg do …0007 pro número do salão, valida bot respondendo
3. **Resultado esperado:** bot religa em ≤5min após pagamento (créditos liberados pelo Kapso)

Se smoke falhar pós-upgrade: investigar webhook URL no painel Kapso (pode ter sido desconfigurado durante outage do free tier).

---

## Follow-ups (dívida técnica anotada)

| Item | Quando reavaliar |
|---|---|
| Migração Meta Cloud API direto (branch `feature/meta-cloud-direct` preservada) | Se Kapso atingir limites ou degradar qualidade |
| BSPs alternativos comparados (Z-API, ChatPro, 360dialog, Twilio) | Idem |
| Splitter `<break>` multiplica outbound msgs no Kapso | Otimização: avaliar se reduzir nº bolhas economiza no quota (provavelmente ganho minor a esse volume) |

---

## Tempo decisão

- Plano original: 24-48h pesquisa
- Decisão final: **15 min** (R1 + R2 + R3 fechou o caso)
- Lição: começar pelo R1+R2 (dados duros do fornecedor + semântica) sempre vence vs pesquisa exaustiva especulativa

---

## Change log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @analyst Atlas | Decisão registrada após pesquisa de 15min. F2/F3 encerradas. |
