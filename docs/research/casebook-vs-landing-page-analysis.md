# Casebook Pareto vs Landing Page Influence Labs — Análise Comparativa

> **Data:** 2026-02-28
> **Fontes:** `pareto-casebook.lovable.app` (11 cases) vs `frontend/index.html` (landing page IL)
> **Objetivo:** Identificar gaps, oportunidades de alinhamento e ações concretas

---

## 1. Posicionamento: Alinhado, mas Landing Subestima o Portfólio

| Dimensão | Casebook Pareto | Landing Influence Labs | Gap |
|----------|----------------|----------------------|-----|
| **Escopo** | IA Generativa, Automação, Análise Preditiva, Visão Computacional | Agentes WhatsApp (agendamento, vendas, FAQ) | Landing foca em 1 vertical; casebook mostra 6+ soluções |
| **Setores** | 14 setores filtráveis | Implícito: salões/clínicas | Landing não menciona amplitude de setores |
| **Credibilidade** | +366 projetos, +146 clientes, desde 2013 | "Powered by Pareto methodology" (badge discreto) | KPIs da rede Pareto NÃO aparecem na landing |
| **KPIs** | Dados concretos (70% ticket, -90% custo, R$200k receita) | "24/7", "<30s", "30d" — operacionais genéricos | Landing sem resultados de negócio quantificados |
| **Tom** | Técnico-consultivo, foco em ROI | Prático-operacional, foco em dor do dono | Complementares — landing está certa para seu público |

---

## 2. O Que a Landing Acerta (manter)

### Foco no WhatsApp + Dor Concreta
- **"Quantos clientes você perdeu essa semana por demora no WhatsApp?"** — copy excelente, fala a língua do dono
- Mockup de conversa com Studio Tirra — prova social tangível
- 3 passos em 30 dias — clareza operacional
- FAQ sólido com objeções reais (robô? erro? trocar número?)

### Agentes Especializados
- Recepcionista IA, Vendedor IA, FAQ IA, Controle Humano — estrutura clara de valor

### Trust Signals
- API oficial Meta
- IA + humano no mesmo fluxo
- Implementação orientada a KPI

---

## 3. O Que a Landing Perde (gaps críticos)

### GAP 1: Sem Social Proof Quantificada
**Problema:** A landing não usa NENHUM KPI do casebook Pareto. O badge "Powered by Pareto methodology" é discreto demais.

**Ação sugerida:** Adicionar seção de credibilidade:
- "+366 projetos de IA entregues pela rede Pareto"
- "+146 clientes transformados"
- "Desde 2013 implementando IA para negócios brasileiros"

### GAP 2: Sem Cases Relevantes
**Problema:** Nenhum case do casebook é citado. O case mais alinhado com IL é o **Case 1 (Personal Stylist)** — agente conversacional + WhatsApp API + RAG que gera +70% ticket medio. Perfeito para salões.

**Cases do casebook que IL pode usar como referência:**

| Case | Relevância para IL | Por quê |
|------|-------------------|---------|
| **#1 Personal Stylist** | ALTA | Agente WhatsApp + RAG + aumento de ticket — exatamente o que IL faz |
| **#10 Suporte Técnico** | ALTA | RAG + agentes + escalada humana — modelo idêntico ao FAQ IA da IL |
| **#4 Assistente Design** | MÉDIA | Agente conversacional que faz cross-sell — padrão replicável |
| **#9 Conteúdo Omnichannel** | MÉDIA | -85% tempo produção — futuro upsell para clientes IL |

### GAP 3: Seção Resultados Sem Dados Reais
**Problema:** Os KPIs atuais (24/7, <30s, 30d) são promessas operacionais, não resultados de negócio. O disclaimer diz "dados próprios em consolidação com beta Studio Tirra".

**Ação sugerida:** Substituir por KPIs reais do casebook até ter dados próprios:
- "+70% aumento no ticket médio" (Case 1)
- "-30% abandono de carrinho" (Case 1)
- "-80% no tempo de catalogação" (Case 6 — adaptável para "tempo de resposta")

### GAP 4: Pricing Vazio
**Problema:** "R$ consulte/mês" — sem âncora de valor.

**Ação sugerida:** Usar economia do casebook como âncora:
- "Clientes da rede Pareto economizam de R$8k a R$12k/mês em operações automatizadas"

### GAP 5: Sem Link para Casebook
**Problema:** O casebook existe, é rico, é atualizado diariamente — mas não é linkado de lugar nenhum na landing.

**Ação sugerida:** Adicionar "Ver cases reais" apontando para `pareto-casebook.lovable.app`

---

## 4. Matriz de Ações Prioritárias

| # | Ação | Impacto | Esforço | Prioridade |
|---|------|---------|---------|------------|
| 1 | Adicionar barra de credibilidade Pareto (366 projetos, 146 clientes, desde 2013) | ALTO | Baixo | P0 |
| 2 | Linkar casebook na landing ("Ver cases reais da rede Pareto") | ALTO | Mínimo | P0 |
| 3 | Trocar KPIs genéricos por dados do casebook (+70% ticket, -30% abandono) | ALTO | Baixo | P0 |
| 4 | Adicionar mini-case Personal Stylist como prova de conceito na landing | ALTO | Médio | P1 |
| 5 | Usar quote do casebook como testimonial ("Clientes nao sabem combinar pecas sozinhos...") | MÉDIO | Baixo | P1 |
| 6 | Adicionar âncora de valor no pricing (economia R$8-12k/mês da rede) | MÉDIO | Baixo | P1 |
| 7 | Criar seção "Para quem" listando setores do casebook como expansão futura | MÉDIO | Médio | P2 |

---

## 5. Messaging Unificado Sugerido

### Hero Badge (atualizar)
**Atual:** "Powered by Pareto methodology"
**Sugerido:** "Powered by Pareto — +366 projetos de IA entregues"

### Seção Resultados (atualizar)
**Atual:** 24/7 | <30s | 30d
**Sugerido:**
- **+70%** — Aumento médio no ticket com agente conversacional
- **<30s** — Tempo médio de resposta (manter)
- **-30%** — Redução no abandono com atendimento IA

### CTA com Prova Social
**Atual:** "Pronto para ativar seu time de IA?"
**Sugerido:** "Junte-se a +146 empresas que já transformaram seu atendimento com IA"

### Footer (atualizar)
**Atual:** "Powered by Pareto methodology"
**Sugerido:** "Powered by Pareto | +366 projetos | Desde 2013"

---

## 6. Cases que IL Deve Criar (futuro)

Baseado nos setores vazios do casebook, IL pode criar cases próprios para:

| Setor Vazio no Casebook | Oportunidade IL |
|------------------------|-----------------|
| Saúde (clínicas) | Agente WhatsApp para agendamento médico |
| Restaurantes & Food Service | Reservas + cardápio por WhatsApp |
| Imobiliário | Qualificação de leads por WhatsApp |
| Educação | Matrículas e dúvidas por WhatsApp |

Esses setores são filtráveis no casebook mas não têm cases — IL pode ser a primeira licenciada a preencher esses gaps.
