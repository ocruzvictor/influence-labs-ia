# Pricing Model - Influence Labs

**Data:** 2026-02-25  
**Objetivo:** definir 3 modelos comerciais com margem e break-even considerando custos operacionais e fee Pareto.

## 1. Premissas financeiras usadas

### 1.1 Custos diretos mensais por cliente (referencia MVP)

| Item | Valor (R$) | Observacao |
|---|---:|---|
| VPS/infra | 80 | Stack self-hosted base |
| Meta WhatsApp fees | 80 | media de utilidade + marketing |
| LLM API | 50 | uso moderado com modelo economico |
| Tempo Victor (manutencao) | 480 | 4h/mes x R$120/h |
| **Total custo direto** | **690** | antes do fee Pareto |

### 1.2 Custos estruturais

| Item | Valor (R$) |
|---|---:|
| Licenciamento Pareto (12x) | 1.250 |

### 1.3 Fee Pareto por ano

| Ano | Fee sobre receita |
|---|---:|
| Ano 1 | 25% |
| Ano 2 | 20% |
| Ano 3 | 15% |
| Ano 4+ | 12% |

### 1.4 Formulas

- `Receita liquida apos fee = Receita bruta x (1 - fee)`
- `Lucro mensal por cliente = Receita liquida apos fee - 690`
- `Margem liquida = Lucro / Receita bruta`
- `Clientes para cobrir licenciamento = 1.250 / Lucro por cliente`

## 2. Modelo 1 - Projeto + Recorrente (recomendado para entrada)

### Estrutura
- Setup: `R$ 3.000-5.000`
- Recorrente: `R$ 990-1.500/mes`

### Margem no Ano 1 (fee 25%) sobre recorrente

| Cenario | Recorrente (R$) | Receita apos fee (R$) | Lucro/cliente (R$) | Margem |
|---|---:|---:|---:|---:|
| Piso | 990 | 742,50 | 52,50 | 5,3% |
| Medio | 1.250 | 937,50 | 247,50 | 19,8% |
| Teto da faixa | 1.500 | 1.125,00 | 435,00 | 29,0% |

### Analise
- O setup ajuda caixa no mes de entrada, mas **a recorrencia ate R$1.500 nao bate meta de 40% de margem no Ano 1**.
- Para margem >= 40% no Ano 1, a recorrencia precisa ficar perto de `R$ 2.000+` com estas premissas de custo.

### Break-even do licenciamento (R$1.250/mes)

| Cenario | Lucro/cliente (R$) | Clientes para cobrir licenciamento |
|---|---:|---:|
| Recorrente R$1.250 | 247,50 | 6 |
| Recorrente R$1.500 | 435,00 | 3 |

## 3. Modelo 2 - Subscription Only

### Estrutura
- `R$ 1.500-2.500/mes` tudo incluso
- Compromisso minimo: 6 meses

### Margem no Ano 1 (fee 25%)

| Cenario | Assinatura (R$) | Receita apos fee (R$) | Lucro/cliente (R$) | Margem |
|---|---:|---:|---:|---:|
| Piso | 1.500 | 1.125,00 | 435,00 | 29,0% |
| Medio recomendado | 2.200 | 1.650,00 | 960,00 | 43,6% |
| Teto | 2.500 | 1.875,00 | 1.185,00 | 47,4% |

### Analise
- Modelo mais previsivel para operacao e forecast.
- Para manter meta de margem >=40% no Ano 1, faixa recomendada: `R$2.100-R$2.400/mes`.

### Break-even do licenciamento

| Cenario | Lucro/cliente (R$) | Clientes para cobrir licenciamento |
|---|---:|---:|
| Assinatura R$2.200 | 960,00 | 2 |
| Assinatura R$2.500 | 1.185,00 | 2 |

## 4. Modelo 3 - Performance-based (hibrido)

### Estrutura proposta
- Base fixa: `R$ 500/mes`
- Variavel: `R$ 35 por agendamento realizado pela IA`

### Sensibilidade de margem no Ano 1 (fee 25%)

| Agendamentos/mes | Receita bruta (R$) | Receita apos fee (R$) | Lucro/cliente (R$) | Margem |
|---:|---:|---:|---:|---:|
| 30 | 1.550 | 1.162,50 | 472,50 | 30,5% |
| 50 | 2.250 | 1.687,50 | 997,50 | 44,3% |
| 70 | 2.950 | 2.212,50 | 1.522,50 | 51,6% |

### Analise
- Muito atrativo quando ha volume e boa instrumentacao de resultados.
- Exige governanca forte de atribuicao (o que conta como agendamento da IA).
- Bom para casos com dados confiaveis e cliente maduro.

### Break-even do licenciamento

| Cenario | Lucro/cliente (R$) | Clientes para cobrir licenciamento |
|---|---:|---:|
| 50 agendamentos/mes | 997,50 | 2 |
| 70 agendamentos/mes | 1.522,50 | 1 |

## 5. Recomendacao de portfolio comercial

### Oferta de entrada (mais simples de vender)
- `Setup + recorrente` para destravar decisao (risco percebido menor).
- Sugestao tatica: setup entre `R$3.500-R$4.500` e recorrente inicial em `R$1.500-R$1.900` com revisao em 60 dias.

### Oferta principal (margem mais saudavel)
- `Subscription Only` em `R$2.100-R$2.400` para novos clientes sem customizacoes extremas.

### Oferta avancada
- `Hibrida por performance` para contas com volume, KPI acordado e rastreamento robusto.

## 6. Meta de margem minima 40%: conclusao objetiva

Com as premissas atuais de custo e fee Pareto no Ano 1:
- Modelos abaixo de `~R$2.000 de receita mensal por cliente` tendem a ficar abaixo de 40%.
- A combinacao mais segura para bater meta e manter previsibilidade e:
  - assinatura >= `R$2.100`, ou
  - modelo hibrido com `>=50 agendamentos/mes` monitorados.

## 7. Proximos ajustes recomendados

1. Validar custo real de horas (R$/h) apos 2-3 clientes para recalibrar margem.
2. Separar SLA por plano (Standard/Pro) para proteger capacidade.
3. Revisar faixas a cada trimestre conforme reducao do fee Pareto (ano 2+ melhora margem automaticamente).
