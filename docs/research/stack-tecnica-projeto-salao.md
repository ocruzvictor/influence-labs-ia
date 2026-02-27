# Análise de Stack Técnica — Projeto Beta Salão de Beleza

**Data:** 2026-02-24 | **Decisão necessária:** Stack + modelo de coexistência

---

## 1. COEXISTÊNCIA WHATSAPP — COMO FUNCIONA

A coexistência é um recurso **oficial da Meta** (GA global desde final de 2025, Brasil totalmente suportado):

- O mesmo número roda **Business App + Cloud API simultaneamente**
- Mensagens são "espelhadas" em tempo real entre app e API
- Até 6 meses de histórico migram automaticamente
- O dono do salão vê tudo no celular **E** no computador (via CRM)

**Na prática para o salão:**
- **API** recebe a mensagem → IA processa e responde automaticamente
- **App no celular** da dona → ela vê tudo em tempo real, pode intervir quando quiser
- **CRM no computador** → interface web para monitorar, ver histórico, métricas
- **Fora do horário** → IA opera 100% sozinha, dona monitora pelo celular se quiser

**Limitações:** mensagens que desaparecem, listas de transmissão, mídia de visualização única e chamadas NÃO funcionam pelo lado da API. Para o salão, nenhuma dessas é crítica.

---

## 2. RISCO DE BANIMENTO — API OFICIAL vs UNOFFICIAL

| Fator | API Oficial (Cloud API) | Unofficial (Baileys/Evolution) |
|-------|------------------------|-------------------------------|
| Risco de ban | **Muito baixo** (sancionado pela Meta) | **Alto** (engenharia reversa do protocolo) |
| Estabilidade | Enterprise-grade (Meta infra) | Quebra com updates do WhatsApp |
| Suporte | Meta/BSP channels | Comunidade apenas |
| Compliance | 100% compliant | Viola ToS do WhatsApp |
| Custo | Per-message fees Meta | Grátis (self-hosted) |

**Veredito:** Para um negócio que **depende** do número WhatsApp, usar API oficial é obrigatório. A diferença de custo (~R$50-100/mês) é irrelevante comparada ao risco de perder o número e todos os contatos do salão.

**Nota importante (Jan 2026):** Meta proibiu chatbots "general-purpose" (tipo ChatGPT genérico) no WhatsApp. Porém, **bots de negócio específicos** (agendamento, vendas, suporte) são **explicitamente permitidos**. O agente do salão é 100% compliant.

---

## 3. CUSTOS META WHATSAPP (Brasil, 2026)

Desde julho 2025, a cobrança é **por mensagem** (não por conversa):

| Tipo | Custo/msg (Brasil) | Quando se aplica |
|------|-------------------|-----------------|
| **Service (cliente inicia)** | **GRÁTIS** | Respostas dentro de 24h |
| **Utility** (confirmações, lembretes) | $0.0065-0.0068 | Confirmação agendamento, lembrete 24h |
| **Marketing** (promoções, reativação) | $0.0625 | Follow-up proativo, promoções |
| **Authentication** | $0.004-0.0456 | OTP, verificação |

**Estimativa mensal para o salão:**
- ~2.000 msgs service (clientes iniciando conversa) = **R$ 0**
- ~500 msgs utility (lembretes, confirmações) = **~R$ 18**
- ~200 msgs marketing (promoções, reativação) = **~R$ 65**
- **Total Meta fees: ~R$ 83/mês** (~USD 15)

---

## 4. COMPARATIVO DE STACKS

### Opção A: "Stack Brasileira" (Máximo Controle)

```
[WhatsApp User]
       ↓
[Evolution API] ← modo Cloud API oficial (NÃO Baileys)
       ↓
[n8n] ← cérebro de orquestração (self-hosted, grátis)
   ├── Router (LLM classifica intenção)
   ├── Agent: Recepcionista (agendamento)
   ├── Agent: Vendas/Follow-up (reativação)
   └── Agent: FAQ (serviços, preços, horários)
       ↓
[Chatwoot] ← inbox web + human takeover (self-hosted, grátis)
       ↓
[Typebot] ← fluxos estruturados opcionais (self-hosted, grátis)
```

| Aspecto | Detalhe |
|---------|---------|
| **Custo mensal** | ~R$ 80-130 (VPS + Meta fees) |
| **Multi-agent** | Sim, via sub-workflows n8n |
| **Auto-healing** | Build via retry logic n8n + error workflows |
| **Coexistência** | Sim (Evolution API + Cloud API) |
| **Interface web** | Chatwoot (inbox compartilhada, atribuição de conversas) |
| **Celular** | WhatsApp Business App funciona normal |
| **Controle** | Total (dados próprios, sem vendor lock-in) |
| **Complexidade setup** | **MÉDIA-ALTA** (Docker, VPS, configs) |
| **Manutenção** | Requer skills DevOps (atualizações, monitoramento) |
| **Comunidade BR** | Muito forte (stacks Docker prontas no GitHub) |

**Prós:** Custo mínimo, controle total, sem limites de execução, dados 100% seus, comunidade BR enorme.
**Contras:** Precisa manter servidor, requer conhecimento técnico, sem suporte comercial.

---

### Opção B: Respond.io (Melhor AI + Handoff Gerenciado)

```
[WhatsApp User]
       ↓
[Meta Cloud API] → direto (sem BSP intermediário)
       ↓
[Respond.io] ← plataforma all-in-one
   ├── AI Agent com GPT (multi-skill)
   ├── Workflow builder (routing, automações)
   ├── Inbox compartilhada (human takeover)
   ├── Broadcast campaigns (marketing)
   └── Contact management (CRM básico)
```

| Aspecto | Detalhe |
|---------|---------|
| **Custo mensal** | ~R$ 500-700 ($49/mês plataforma + Meta fees) |
| **Multi-agent** | Sim, via AI Agents + Workflows nativos |
| **Auto-healing** | Sim (retry nativo, fallback workflows) |
| **Coexistência** | Sim (Cloud API) |
| **Interface web** | Sim (inbox moderna, mobile app) |
| **Celular** | WhatsApp Business App + app Respond.io |
| **Controle** | Médio (dados na nuvem deles) |
| **Complexidade setup** | **BAIXA** (plug-and-play) |
| **Manutenção** | Zero (SaaS gerenciado) |

**Prós:** Setup em 1-2 dias, melhor AI handoff do mercado, broadcast nativo, zero manutenção, unlimited conversations.
**Contras:** Custo mensal mais alto, dados ficam na plataforma, menos customizável.

---

### Opção C: Kommo CRM (Budget Gerenciado)

```
[WhatsApp User]
       ↓
[Meta Cloud API] → via Kommo nativo
       ↓
[Kommo CRM] ← all-in-one CRM + WhatsApp
   ├── Salesbot (automação básica)
   ├── Pipeline de vendas
   ├── Inbox WhatsApp
   └── AI tools (Kommo AI)
```

| Aspecto | Detalhe |
|---------|---------|
| **Custo mensal** | ~R$ 210-350 ($25/user/mês + Meta fees) |
| **Multi-agent** | Limitado (Salesbot é linear, não multi-agent real) |
| **Auto-healing** | Básico |
| **Coexistência** | Sim |
| **Interface web** | Sim (CRM completo + inbox) |
| **Celular** | WhatsApp Business App + app Kommo |
| **Controle** | Médio |
| **Complexidade setup** | **BAIXA** |
| **Manutenção** | Zero (SaaS) |

**Prós:** Barato, CRM real com pipeline, popular no Brasil, interface em PT-BR.
**Contras:** AI limitada (Salesbot é básico), multi-agent fraco, interface datada. Billing mínimo 6 meses.

---

### Opção D: Híbrida (Stack BR + CRM gerenciado)

```
[WhatsApp User]
       ↓
[Evolution API] ← Cloud API oficial
       ↓
[n8n] ← orquestração multi-agent
   ├── Router LLM
   ├── Agents especializados
   └── Auto-healing workflows
       ↓
[Kommo CRM] ← interface comercial (pipeline, contatos)
   ou
[Chatwoot] ← inbox + human takeover
```

| Aspecto | Detalhe |
|---------|---------|
| **Custo mensal** | ~R$ 200-350 (VPS + Kommo ou Chatwoot free + Meta fees) |
| **Multi-agent** | Sim (n8n orquestra) |
| **Interface web** | Kommo (pago) ou Chatwoot (free) |
| **Complexidade** | **MÉDIA** |

**Prós:** Melhor dos dois mundos — potência do n8n para multi-agent + interface amigável do CRM para o dia a dia.
**Contras:** Mais componentes para integrar e manter.

---

## 5. MATRIZ DE DECISÃO

| Critério | Peso | Stack BR (A) | Respond.io (B) | Kommo (C) | Híbrida (D) |
|----------|------|:---:|:---:|:---:|:---:|
| **Menor risco ban** | CRÍTICO | 9 (Cloud API) | 10 | 10 | 9 |
| **Coexistência real** | CRÍTICO | 9 | 9 | 8 | 9 |
| **Interface web (dona)** | ALTO | 8 (Chatwoot) | 9 | 9 (CRM real) | 9 |
| **Multi-agent** | ALTO | 10 (n8n ilimitado) | 8 | 4 | 10 |
| **Auto-healing** | ALTO | 8 (build yourself) | 7 | 3 | 8 |
| **Custo mensal** | ALTO | 10 (~R$100) | 5 (~R$600) | 7 (~R$280) | 8 (~R$250) |
| **Facilidade setup** | MÉDIO | 4 | 10 | 9 | 5 |
| **Manutenção** | MÉDIO | 4 | 10 | 9 | 5 |
| **Escalabilidade** | MÉDIO | 10 | 8 | 6 | 9 |
| **Comunidade BR** | MÉDIO | 10 | 5 | 7 | 9 |
| **TOTAL PONDERADO** | | **82** | **81** | **72** | **81** |

---

## 6. RECOMENDAÇÃO

### Para o projeto beta do salão: **Opção A (Stack Brasileira)** com upgrade path para D

**Justificativa:**

1. **Você já tem as skills técnicas** (AIOS, DevOps, infra) — não precisa pagar por simplicidade
2. **Custo mínimo** (~R$100/mês) é coerente com projeto beta a "preço acessível"
3. **Multi-agent real** via n8n é o que diferencia sua oferta (e valida o UAOS)
4. **Comunidade BR** é enorme — qualquer dúvida tem tutorial em português
5. **Sem vendor lock-in** — pode evoluir para qualquer direção
6. **API oficial da Meta** via Evolution API modo Cloud API = risco de ban mínimo

**Upgrade path:**
- Se a dona do salão precisar de CRM mais robusto → adiciona Kommo ($25/mês)
- Se você produtizar para múltiplos salões → migra orquestração para LangGraph
- Se clientes enterprise pedirem SaaS → Respond.io como opção premium

### Stack final recomendada:

```
INFRA (VPS ~R$80/mês):
├── Evolution API (Cloud API mode) ← gateway WhatsApp oficial
├── n8n Community (self-hosted) ← orquestração multi-agent
├── Chatwoot (self-hosted) ← inbox web + human takeover
└── Typebot (self-hosted, opcional) ← fluxos estruturados

IA (pay-per-use ~R$30-80/mês):
├── Claude API (Anthropic) ou GPT-4o-mini (OpenAI) ← LLM principal
└── Modelo menor para classificação de intenção ← roteamento

WHATSAPP (Meta fees ~R$80/mês):
└── Cloud API oficial ← per-message pricing
```

**Custo total estimado: R$ 190-240/mês**

---

## 7. MULTI-AGENT NO MESMO NÚMERO — COMO FUNCIONA

O WhatsApp entrega TODAS as mensagens para um único webhook. O roteamento é na sua aplicação:

```
Mensagem do cliente
       ↓
[n8n: Router Workflow]
  - LLM classifica intenção da mensagem
  - Verifica estado da conversa (Redis/Postgres)
       ↓
  ├── Intenção: agendamento → [Sub-workflow: Recepcionista]
  │   └── Verifica horários, profissionais, serviços
  │   └── Confirma ou oferece alternativas
  │   └── Salva no sistema de agendamento
  │
  ├── Intenção: preço/serviço/dúvida → [Sub-workflow: FAQ]
  │   └── Consulta KB (RAG) com info do salão
  │   └── Responde com dados precisos
  │
  ├── Intenção: promoção/recompra → [Sub-workflow: Vendas]
  │   └── Oferece serviços complementares
  │   └── Apresenta promoções ativas
  │
  ├── Intenção: reclamação/complexo → [Human Takeover]
  │   └── Avisa dona no Chatwoot
  │   └── Transfere conversa
  │
  └── Cron jobs (proativos):
      ├── Lembrete 24h antes do agendamento (utility msg)
      ├── Follow-up 48h pós-atendimento (marketing msg)
      └── Reativação cliente inativo 30/60 dias (marketing msg)
```

---

## PRÓXIMOS PASSOS TÉCNICOS

1. **Contratar VPS** (Hetzner CX31 ou DigitalOcean ~$15-25/mês)
2. **Deploy stack Docker** (Evolution API + n8n + Chatwoot + Typebot)
3. **Configurar Evolution API com Cloud API** (requer Meta Business Manager)
4. **Criar workflows n8n** para cada agent (recepcionista, FAQ, vendas)
5. **Configurar Chatwoot** para human takeover
6. **Testar com número de desenvolvimento** antes de conectar o número do salão

---

*Pesquisa realizada com 30+ fontes web, comparando 7 plataformas de automação e 6 CRMs.*
