# Plano de Pesquisa — WhatsApp BSP / Plataforma Definitiva

**Data:** 2026-05-27
**Autor:** @analyst Atlas
**Triggered by:** Kapso free tier (2k msgs/mês) bateu limite em 7 dias. Bot mudo. Ciclo reseta 20/jun.
**Decisor:** Victor (arquiteto/decisor)
**Tolerância downtime aprovada:** até 48h (cronograma comprimido pra 24h por Victor 2026-05-27)
**CNPJ Influence Labs:** ✅ ATIVO — F2 (Meta direto via BM IL) é rota técnica viável

---

## Contexto factual

| Fato | Valor |
|---|---|
| Limite Kapso free | 2.000 msgs/mês |
| Ciclo billing | 20→20 do mês (reset 20/jun) |
| Estado atual | 100% consumido em 7 dias |
| Volume real medido (26/05) | 322 msgs inbound + 26 outbound = 348/dia |
| Conversas únicas em 1 dia (26/05) | 91 clientes do salão |
| Projeção 30d (volume sustentado) | 10-25k msgs/mês |
| BM Meta Tiago | **INVIÁVEL** sem previsão (decisão Meta) |
| BMs alternativos disponíveis | Influence Labs (se CNPJ ativo) ou pessoal Victor |
| Branch interna `feature/meta-cloud-direct` | Código pronto, mas BM Tiago morto — precisa reativar com outro BM |

---

## Estrutura: 2 horizontes, 4 frentes

### Horizonte 1: RELIGAR BOT (próximas 2h)

**Objetivo:** mitigação rápida, reversível, baratinha.

| # | Pesquisa | Owner | Tempo |
|---|---|---|---|
| **R1** | Pegar todos os planos pagos Kapso (preço, limite msgs, features) | Victor (painel) | 5 min |
| **R2** | Confirmar definição de "message" no Kapso (in? out? eventos?) via docs/suporte | IA (Atlas) | 10 min |
| **R3** | Calcular qual plano cobre 24 dias até 20/jun (não precisa cobrir mês inteiro) | IA (Atlas) | 5 min |

**Critério decisão imediata:** se existir plano Kapso ≤ USD 30/mês que cobre ~10k msgs → **COMPRA agora** + segue pesquisa estratégica em paralelo. Senão → bot mudo até decisão Fase 2.

---

### Horizonte 2: DECISÃO ESTRATÉGICA (48h)

**Objetivo:** escolher plataforma definitiva para volume 10-25k msgs/mês com headroom 3x.

#### Frente F1 — Kapso completo (depth)

Refinar R1/R2/R3 acima.

- Roadmap Kapso (eles vão lançar planos novos?)
- Trade-offs específicos: latência, confiabilidade, suporte, SLA
- Permite múltiplos números no futuro?
- Roi com 3x volume

**Pesquisa:** Atlas (30 min) + suporte Kapso opcional.

#### Frente F2 — Meta Cloud API direto (renascida)

BM alternativo viabiliza essa rota.

- **F2.a** Influence Labs tem CNPJ ativo? Se sim, dá pra abrir BM hoje (Victor confirma)
- **F2.b** BM pessoal Victor é tecnicamente possível mas tem limitações (limite 50 conversation/dia inicial, escala lenta)
- **F2.c** Custo Meta Cloud API real com volume 10-25k msgs/mês — pricing model é "conversation-based" (janela 24h, não per-msg)
- **F2.d** Tempo de verificação Meta com BM novo (com base no que aconteceu com Tiago: 1 dia? 1 semana? 1 mês?)
- **F2.e** Branch `feature/meta-cloud-direct` precisa quanto retrabalho pra apontar pra novo BM?

**Pesquisa:** Atlas (45 min) + Victor confirma CNPJ Influence Labs (5 min).

#### Frente F3 — BSPs alternativos brasileiros

Lista priorizada (mais conhecidos no mercado BR):

1. **Z-API** — popular BR, pricing por conexão + msg
2. **ChatPro** — BR, foco em pequenos negócios
3. **360dialog** — global, BSP oficial Meta
4. **Twilio** — global enterprise, caro mas confiável

Comparar:
- Custo a 10k e 25k msgs/mês
- Free tier / trial
- Feature parity (webhooks, QR vs Cloud, áudio, mídia)
- Reputação / saúde da operação BR
- Lock-in (migração futura quanto custa)

**Pesquisa:** Atlas (60 min). Não considera self-hosted (WPPConnect, Baileys) — risco operacional alto, Victor não é executor.

#### Frente F4 — (DESCARTADA) Status BM Tiago

Memory: BM 100% inviável sem previsão Meta. Branch `feature/meta-cloud-direct` continua válida como CÓDIGO, mas requer novo BM (cobre F2).

---

## Cronograma comprimido (24h)

| Tempo | Ação | Owner |
|---|---|---|
| **Agora (0h)** | Victor pega R1 (planos Kapso, print do painel) | Victor |
| **Agora (0h)** | Atlas inicia R2 (semântica msg Kapso) via WebSearch | Atlas |
| **+ 30min** | Decisão IMEDIATA: compra Kapso ou bot mudo? | Victor com R1+R2+R3 |
| **+ 1-3h** | Atlas executa F1 (Kapso depth) + F3 (3 BSPs) em paralelo | Atlas |
| **+ 3-6h** | Atlas executa F2 (Meta direto via BM IL — preço, processo, tempo verificação) | Atlas |
| **+ 12h** | Drafts F1+F2+F3 prontos | Atlas |
| **+ 18h** | ADR consolidada | Atlas |
| **+ 24h** | Decisão Victor + execução iniciada | Victor + agente apropriado |

---

## Output esperado (deliverables)

| Doc | Conteúdo | Quando |
|---|---|---|
| `docs/analysis/kapso-pricing-findings.md` | R1+R2+R3 + F1 | +4h |
| `docs/analysis/meta-cloud-api-alternative.md` | F2 completo (factibilidade + custo + tempo) | +8h |
| `docs/analysis/bsp-alternatives-comparison.md` | F3 (Z-API, ChatPro, 360dialog, Twilio) | +12h |
| `docs/analysis/whatsapp-bsp-decision.md` | **ADR final** com decisão fundamentada | +24h |

---

## Critérios de decisão (pesos sugeridos — refinar com Victor)

| Critério | Peso | Por quê |
|---|---|---|
| Custo total a 10k msgs/mês | 30% | Margem do produto |
| Custo total a 30k msgs/mês (escala 3x) | 25% | Trajetória |
| Tempo até bot voltar | 20% | Tiago perdendo negócio |
| Lock-in / facilidade de migração | 10% | Otimização futura |
| Suporte / SLA / reputação BR | 10% | Reliability |
| Setup técnico (esforço dev) | 5% | Já temos código pronto pra Meta |

**Empate:** preferir solução com menor lock-in (facilita migrar depois).

---

## Riscos da pesquisa

| Risco | P | I | Mitigação |
|---|---|---|---|
| Influence Labs sem CNPJ → F2 só viável com BM pessoal Victor | M | M | Confirmar nas primeiras 2h. Se sem CNPJ, F2 perde força. |
| Plano Kapso pago intermediário inexistente (só free ou enterprise) | B | A | F1 desbloqueia antes — sabemos isso em 30min. |
| BSPs alternativos com pricing oculto/contato comercial | A | B | Anotar "preciso de quote", marcar como "não-self-serve". |
| Volume real cresce 3x antes da decisão | B | M | Decisão é tomada em 48h — janela curta. |

---

## Próximo passo

Victor aprova este plano (ou ajusta) → Atlas executa R1+R2+R3 + F1 inicial → 30min depois apresenta dados pra decisão imediata.

---

## Change log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @analyst Atlas | Plano inicial criado. Estrutura 2-horizontes, 4-frentes, 48h. F4 descartada (BM Tiago morto). |
