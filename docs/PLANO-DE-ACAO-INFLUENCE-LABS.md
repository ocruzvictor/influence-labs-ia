# PLANO DE ACAO — Influence Labs (Projeto Salao + Marca)

**Data:** 2026-02-24
**Para:** Agente AIOS executar autonomamente
**Criado por:** Atlas (sessao de pesquisa e analise)

---

## CONTEXTO RAPIDO (para o agente executor)

Victor Cruz esta fundando a **Influence Labs**, empresa de AI Services (boutique de agentes de IA para mid-market brasileiro). Opera sob **dual-brand**: Pareto (licenciado) + marca propria com framework UAOS.

### Material de referencia (LER ANTES DE EXECUTAR):
1. `docs/research/influence-labs-foundation-report.md` — Analise completa de 25+ docs, mercado, ativos
2. `docs/research/analise-complementar-novos-docs.md` — Metodo Pareto operacional, mapeamento squads, sprints do salao
3. `docs/research/stack-tecnica-projeto-salao.md` — Stack decidida, custos, arquitetura multi-agent
4. `memory/influence-labs-project.md` — Estado consolidado do projeto

### Decisoes ja tomadas:
- **Dual-brand**: Pareto para credibilidade + Influence Labs/UAOS como diferencial
- **Stack**: Evolution API (Cloud API) + n8n + Chatwoot + Typebot + Claude/GPT-4o-mini
- **Custo stack**: ~R$ 190-240/mes
- **Projeto beta**: Salao de beleza — agente WhatsApp recepcionista + vendas proativas
- **Coexistencia**: API oficial Meta + Business App no mesmo numero

---

## ESTRUTURA DO PLANO

```
TRACK 1: SALAO (execucao — PRIORIDADE)
  ├── Fase 1: Criar Squad AIOS para o projeto
  ├── Fase 2: Sprint 0 — Discovery
  ├── Fase 3: Sprint 1 — Core Agent
  └── Fase 4: Sprint 2 — Sales & Follow-up

TRACK 2: MARCA (estrategia — PARALELO)
  ├── Fase 1: Identidade Visual
  ├── Fase 2: Landing Page
  ├── Fase 3: Templates Comerciais
  └── Fase 4: Empacotar UAOS
```

---

# TRACK 1: PROJETO SALAO DE BELEZA

## Fase 1: Criar Squad AIOS para o Projeto

**Objetivo:** Montar a infraestrutura de squads, workflows e tasks no AIOS para que o ciclo Descoberta→Build→Deploy funcione de forma orquestrada.

**Agente responsavel:** @aios-master (Orion)

### Task 1.1 — Criar Squad "salon-whatsapp"

Usar o template em `.aios-core/development/templates/squad-template/` como base.

**Criar em:** `.aios-core/squads/salon-whatsapp/`

```
salon-whatsapp/
├── squad.yaml          # Definicao do squad
├── agents/
│   ├── receptionist.yaml    # Agente recepcionista (agendamento)
│   ├── sales.yaml           # Agente de vendas proativas
│   ├── faq.yaml             # Agente FAQ (RAG com KB do salao)
│   └── router.yaml          # Agente roteador de intencoes
├── tasks/
│   ├── discovery-client.md       # Sprint 0: Discovery com cliente
│   ├── build-knowledge-base.md   # Construir KB do salao
│   ├── create-prompts-pacer.md   # Criar prompts PACER para cada agente
│   ├── setup-whatsapp-api.md     # Configurar Evolution API + Cloud API
│   ├── build-n8n-workflows.md    # Criar workflows n8n multi-agent
│   ├── setup-chatwoot.md         # Configurar Chatwoot + human takeover
│   ├── test-scenarios.md         # Testar 50+ cenarios
│   ├── pilot-launch.md           # Lancamento piloto controlado
│   ├── build-sales-followup.md   # Sprint 2: vendas + follow-up
│   └── optimize-autohealing.md   # Sprint 3: otimizacao continua
├── workflows/
│   ├── salon-delivery.yaml       # Workflow principal Discovery→Deploy
│   └── salon-qa-loop.yaml        # QA loop especifico
└── templates/
    ├── salon-kb-template.md      # Template para knowledge base
    ├── salon-canvas.md           # Pareto AI Canvas adaptado
    └── salon-report.md           # Template relatorio de resultados
```

**squad.yaml deve conter:**
```yaml
name: "salon-whatsapp"
version: 0.1.0
description: "Squad para projeto beta - Agente WhatsApp para salao de beleza com recepcionista IA, vendas proativas e follow-up"
author: "Victor Cruz / Influence Labs"
license: MIT

aios:
  minVersion: "2.1.0"
  type: squad

components:
  agents:
    - agents/*.yaml
  tasks:
    - tasks/*.yaml
  workflows:
    - workflows/*.yaml
  templates:
    - templates/*.md

config:
  client: "Salao de Beleza (Beta)"
  stack:
    gateway: "Evolution API (Cloud API mode)"
    orchestrator: "n8n Community (self-hosted)"
    crm: "Chatwoot (self-hosted)"
    chatbot: "Typebot (self-hosted, opcional)"
    llm_primary: "Claude API ou GPT-4o-mini"
    llm_router: "GPT-4o-mini ou Claude Haiku"
  pricing:
    infra: "~R$ 80/mes (VPS)"
    llm: "~R$ 30-80/mes"
    meta_fees: "~R$ 80/mes"
    total: "~R$ 190-240/mes"

keywords:
  - aios
  - squad
  - whatsapp
  - salon
  - multi-agent
```

### Task 1.2 — Criar Workflow "salon-delivery"

**Arquivo:** `.aios-core/squads/salon-whatsapp/workflows/salon-delivery.yaml`

Workflow baseado no Metodo Pareto (ver `docs/research/analise-complementar-novos-docs.md` secao 3.1):

```yaml
name: salon-delivery
description: "Ciclo completo de entrega do projeto salao: Discovery → Build → Deploy → Operate"
version: 1.0.0

phases:
  - id: discovery
    name: "Sprint 0 — Discovery"
    duration: "3-5 dias"
    agent: "@analyst + Victor (humano)"
    tasks:
      - discovery-client
      - build-knowledge-base
    artifacts:
      - "Pareto AI Canvas preenchido"
      - "Mapa AS-IS → TO-BE"
      - "KB do salao (servicos, precos, horarios, profissionais)"
      - "KPIs definidos (taxa agendamento, tempo resposta, satisfacao)"
    gate: "Victor aprova escopo e KB"

  - id: architecture
    name: "Arquitetura & Prompts"
    duration: "2-3 dias"
    agent: "@architect + @dev"
    tasks:
      - create-prompts-pacer
      - setup-whatsapp-api
    artifacts:
      - "Prompts PACER para cada agente (recepcionista, FAQ, vendas, router)"
      - "Evolution API configurada com Cloud API"
      - "Fluxo de estados do agente documentado"
    gate: "Prompts testados manualmente no playground LLM"
    depends_on: [discovery]

  - id: build-core
    name: "Sprint 1 — Core Agent"
    duration: "7-10 dias"
    agent: "@dev"
    tasks:
      - build-n8n-workflows
      - setup-chatwoot
      - test-scenarios
    artifacts:
      - "n8n workflows: router + recepcionista + FAQ"
      - "Chatwoot configurado com human takeover"
      - "50+ cenarios testados"
    gate: "@qa valida cenarios + Victor aprova UX"
    depends_on: [architecture]

  - id: pilot
    name: "Lancamento Piloto"
    duration: "3-5 dias"
    agent: "@dev + Victor"
    tasks:
      - pilot-launch
    artifacts:
      - "Agente operando com 10% do trafego"
      - "Dashboard de monitoramento"
      - "Log de conversas para revisao"
    gate: "Metricas OK apos 3 dias → escalar para 50% → 100%"
    depends_on: [build-core]

  - id: build-sales
    name: "Sprint 2 — Vendas & Follow-up"
    duration: "7-10 dias"
    agent: "@dev"
    tasks:
      - build-sales-followup
    artifacts:
      - "Sub-workflow vendas proativas"
      - "Cron: lembrete 24h, follow-up 48h, reativacao 30/60 dias"
      - "Templates de mensagens marketing aprovadas"
    gate: "Victor + dona do salao aprovam tom das mensagens"
    depends_on: [pilot]

  - id: optimize
    name: "Sprint 3 — Otimizacao"
    duration: "continuo"
    agent: "@dev + @analyst"
    tasks:
      - optimize-autohealing
    artifacts:
      - "Auto-healing configurado"
      - "Dashboard KPIs para dona do salao"
      - "Case study documentado com metricas"
    depends_on: [build-sales]
```

### Task 1.3 — Criar Tasks Detalhadas

Cada task deve ser criada como arquivo `.md` em `.aios-core/squads/salon-whatsapp/tasks/`. Abaixo o conteudo de cada uma:

---

#### `discovery-client.md`

```markdown
# Discovery com Cliente — Salao de Beleza

## Objetivo
Mapear completamente o funcionamento do salao para alimentar os agentes de IA.

## Elicitacao (reuniao com dona do salao)

### Bloco 1: Servicos
- [ ] Lista completa de servicos oferecidos
- [ ] Preco de cada servico
- [ ] Duracao media de cada servico
- [ ] Combos/pacotes disponiveis
- [ ] Servicos que exigem profissional especifico

### Bloco 2: Profissionais
- [ ] Lista de profissionais e especialidades
- [ ] Horarios de trabalho de cada um
- [ ] Dias de folga/rodizio
- [ ] Profissional pode atender mais de um servico simultaneo?

### Bloco 3: Agendamento
- [ ] Como funciona hoje? (caderninho, app, WhatsApp informal?)
- [ ] Regras de agendamento (antecedencia minima, limite por dia)
- [ ] Politica de cancelamento/reagendamento
- [ ] Lista de espera existe?
- [ ] Horario de funcionamento (dias e horas)
- [ ] Intervalo entre atendimentos

### Bloco 4: Comunicacao
- [ ] Tom de voz desejado (formal, informal, carinhoso?)
- [ ] Nome do agente (ex: "Julia", "Equipe do Salao X")
- [ ] Frases que a dona usa frequentemente
- [ ] O que NUNCA dizer
- [ ] Perguntas frequentes dos clientes (top 10)
- [ ] Como lidar com reclamacoes

### Bloco 5: Vendas Proativas
- [ ] Promocoes ativas ou recorrentes
- [ ] Servicos complementares para sugerir (ex: fez cabelo → sugere unha)
- [ ] Frequencia ideal de follow-up (semanal, quinzenal?)
- [ ] Clientes inativos: apos quantos dias reativar?
- [ ] Datas especiais (aniversario cliente, datas comemorativas)

### Bloco 6: Coexistencia
- [ ] Dona quer ser notificada de quais situacoes?
- [ ] Em que momentos ela quer assumir a conversa?
- [ ] Horario em que a IA opera 100% sozinha?
- [ ] Acesso ao computador? (para Chatwoot)

## Output
- Pareto AI Canvas preenchido (usar template `salon-canvas.md`)
- Knowledge Base do salao (usar template `salon-kb-template.md`)
- Lista de KPIs com targets
```

---

#### `build-knowledge-base.md`

```markdown
# Construir Knowledge Base do Salao

## Objetivo
Criar a base de conhecimento estruturada que alimenta o RAG dos agentes.

## Estrutura da KB

### Arquivo: `kb/salon-info.md`
- Nome e endereco do salao
- Horario de funcionamento
- Formas de pagamento aceitas
- Como chegar (referencia)
- Estacionamento

### Arquivo: `kb/services.md`
- Tabela: servico | preco | duracao | profissionais habilitados
- Combos e pacotes com precos

### Arquivo: `kb/professionals.md`
- Tabela: nome | especialidades | horarios | dias
- Observacoes especificas

### Arquivo: `kb/scheduling-rules.md`
- Regras de agendamento
- Politica cancelamento
- Intervalo entre servicos
- Lista de espera

### Arquivo: `kb/faq.md`
- Top 20 perguntas frequentes com respostas aprovadas pela dona

### Arquivo: `kb/sales.md`
- Promocoes ativas
- Regras de sugestao de servicos complementares
- Templates de mensagens de reativacao (tom aprovado)

## Validacao
- [ ] Dona do salao revisou e aprovou CADA arquivo
- [ ] Precos conferidos
- [ ] Horarios conferidos
- [ ] Tom de voz validado
```

---

#### `create-prompts-pacer.md`

```markdown
# Criar Prompts PACER para Agentes do Salao

## Metodologia: P.A.C.E.R.
- **P**ersona: Quem o agente é
- **A**ction: O que deve fazer
- **C**ontext: Informacoes de contexto (KB)
- **E**xamples: Exemplos de conversas ideais
- **R**estrictions: O que NAO fazer

## Agentes a criar

### 1. Router (classificador de intencao)
- Persona: Classificador silencioso (nao gera resposta, apenas classifica)
- Action: Classificar mensagem em: agendamento | faq | vendas | reclamacao | humano
- Context: Historico da conversa (ultimas 5 msgs)
- Examples: 10 exemplos por categoria
- Restrictions: Nunca responder ao cliente, apenas classificar

### 2. Recepcionista
- Persona: [Nome definido na discovery] do [Salao X]
- Action: Agendar, reagendar, cancelar, informar horarios disponiveis
- Context: KB completa + agenda do dia + historico do cliente
- Examples: 5 conversas completas de agendamento
- Restrictions: Nao inventar horarios, nao confirmar sem checar disponibilidade, nao dar descontos

### 3. FAQ
- Persona: Mesmo nome/tom da recepcionista
- Action: Responder duvidas usando APENAS informacoes da KB (verbatim quando possivel)
- Context: KB do salao (RAG)
- Examples: 10 perguntas reais com respostas
- Restrictions: Se nao sabe, dizer "vou verificar com a equipe" e acionar human takeover

### 4. Vendas/Follow-up
- Persona: Mesmo nome/tom, porem mais proativo e entusiasmado
- Action: Sugerir servicos, enviar promocoes, reativar clientes inativos
- Context: Historico do cliente + promocoes ativas + ultima visita
- Examples: 3 mensagens de follow-up em tons diferentes
- Restrictions: Maximo 1 msg proativa por semana, nao insistir se cliente disse nao, respeitar opt-out

## Testes
- [ ] Cada prompt testado no playground LLM com 10 cenarios
- [ ] Prompt do router testado com 30+ mensagens reais
- [ ] Victor aprovou tom de todos os agentes
- [ ] Dona do salao aprovou tom de todos os agentes
```

---

#### `setup-whatsapp-api.md`

```markdown
# Configurar WhatsApp API (Evolution API + Cloud API)

## Pre-requisitos
- [ ] VPS contratada (Hetzner CX31 ou DigitalOcean ~$15-25/mes)
- [ ] Docker e Docker Compose instalados na VPS
- [ ] Dominio apontando para VPS (ex: api.influencelabs.com.br)
- [ ] SSL configurado (Certbot/Let's Encrypt)
- [ ] Meta Business Manager conta criada
- [ ] WhatsApp Business Account criada no Meta Business Manager
- [ ] Numero de telefone verificado

## Passos

### 1. Deploy Evolution API
- [ ] Clonar repositorio Evolution API
- [ ] Configurar docker-compose.yml com modo Cloud API (NAO Baileys)
- [ ] Configurar variaveis de ambiente:
  - AUTHENTICATION_API_KEY
  - DATABASE_CONNECTION_URI (Postgres)
  - RABBITMQ (opcional, para filas)
- [ ] Subir container: `docker-compose up -d`
- [ ] Testar endpoint: GET /instance/info

### 2. Configurar Cloud API
- [ ] No Meta Business Manager: criar app tipo "Business"
- [ ] Gerar token permanente (System User token)
- [ ] Configurar webhook URL: https://api.dominio.com/webhook/whatsapp
- [ ] Verificar webhook com token de verificacao
- [ ] Registrar numero de telefone
- [ ] Testar envio de mensagem template

### 3. Configurar Coexistencia
- [ ] No WhatsApp Business App do celular da dona: manter logado
- [ ] Verificar que mensagens aparecem em AMBOS (API + App)
- [ ] Testar envio pela API e visualizacao no App
- [ ] Testar envio pelo App e recepcao pela API

### 4. Conectar ao n8n
- [ ] Configurar webhook no n8n para receber msgs da Evolution API
- [ ] Testar fluxo: mensagem recebida → n8n webhook → log

## Validacao
- [ ] Mensagem enviada pela API aparece no celular da dona
- [ ] Mensagem enviada pelo celular da dona chega no webhook
- [ ] Latencia < 2 segundos
- [ ] Nenhum erro no log por 24h
```

---

#### `build-n8n-workflows.md`

```markdown
# Construir Workflows n8n Multi-Agent

## Arquitetura

```
Webhook (msg recebida)
    ↓
[Router Workflow]
  - Carregar historico conversa (Redis/Postgres)
  - LLM classifica intencao
  - Verificar estado da conversa
    ↓
  ├── intencao: agendamento → [Sub-workflow: Recepcionista]
  │   └── Verifica horarios disponveis (Google Calendar ou DB)
  │   └── Confirma ou oferece alternativas
  │   └── Salva agendamento
  │   └── Envia confirmacao
  │
  ├── intencao: duvida → [Sub-workflow: FAQ]
  │   └── RAG: busca na KB
  │   └── LLM gera resposta com base nos resultados
  │   └── Envia resposta
  │
  ├── intencao: promo/recompra → [Sub-workflow: Vendas]
  │   └── Verifica historico do cliente
  │   └── Seleciona oferta relevante
  │   └── Envia mensagem personalizada
  │
  └── intencao: reclamacao/complexo → [Human Takeover]
      └── Notifica no Chatwoot
      └── Avisa dona no celular (mensagem no Chatwoot)
      └── Responde ao cliente: "Vou transferir para [nome]"
```

## Workflows a criar no n8n

### WF-01: Router Principal
- Trigger: Webhook (Evolution API)
- Nodes: Parse msg → Load context → LLM classify → Switch → Sub-workflows
- Error handler: Log + notificar Victor

### WF-02: Recepcionista
- Input: mensagem + contexto
- Nodes: LLM (prompt PACER recepcionista) → Check calendar → Format response → Send via Evolution API
- Memory: salvar estado da conversa (agendamento em andamento)

### WF-03: FAQ
- Input: mensagem + contexto
- Nodes: RAG search (KB) → LLM (prompt PACER FAQ) → Send response
- Fallback: se confidence < 70% → Human Takeover

### WF-04: Vendas
- Input: mensagem + contexto + historico cliente
- Nodes: LLM (prompt PACER vendas) → Format response → Send response

### WF-05: Human Takeover
- Input: mensagem + contexto
- Nodes: Create ticket Chatwoot → Notify owner → Send holding msg to client

### WF-06: Cron Jobs (proativos)
- Trigger: Cron schedule
- Lembrete 24h: query agendamentos amanha → enviar utility msg
- Follow-up 48h: query atendimentos de 2 dias atras → enviar msg satisfacao
- Reativacao 30 dias: query clientes inativos → enviar marketing msg

## Testes por workflow
- [ ] WF-01: 30 mensagens de teste com intencoes variadas
- [ ] WF-02: 10 cenarios de agendamento (marcar, reagendar, cancelar, horario lotado)
- [ ] WF-03: 10 perguntas frequentes
- [ ] WF-04: 5 cenarios de venda proativa
- [ ] WF-05: 3 cenarios de escalacao
- [ ] WF-06: Testar cada cron job individualmente

## Tratamento de erros
- Retry automatico: 3 tentativas com backoff exponencial
- Fallback LLM: se Claude falhar, usar GPT-4o-mini (ou vice-versa)
- Dead letter queue: mensagens que falharam 3x → notificar Victor
- Timeout: se LLM nao responder em 15s → mensagem padrao + human takeover
```

---

#### `setup-chatwoot.md`

```markdown
# Configurar Chatwoot + Human Takeover

## Deploy
- [ ] Adicionar Chatwoot ao docker-compose da VPS
- [ ] Configurar variaveis (SMTP, Redis, Postgres)
- [ ] Subir container
- [ ] Acessar interface web e criar conta admin

## Configuracao
- [ ] Criar inbox "WhatsApp Salao"
- [ ] Conectar com Evolution API (webhook bidirecional)
- [ ] Criar agente "IA" (para msgs automaticas)
- [ ] Criar agente "Dona do Salao" (para human takeover)
- [ ] Configurar regras de atribuicao automatica
- [ ] Configurar notificacoes (email + push se possivel)

## Human Takeover Flow
1. n8n detecta necessidade de humano → cria conversa no Chatwoot
2. Chatwoot notifica dona (email/push)
3. Dona assume conversa no Chatwoot (web ou mobile)
4. Quando dona encerra → n8n retoma controle automatico

## Validacao
- [ ] Dona consegue ver todas as conversas no Chatwoot
- [ ] Dona consegue responder pelo Chatwoot
- [ ] Resposta da dona chega ao cliente via WhatsApp
- [ ] Apos dona encerrar, IA retoma automaticamente
```

---

#### `test-scenarios.md`

```markdown
# Cenarios de Teste — Agente WhatsApp Salao

## Cenarios de Agendamento (20)
1. Agendar corte simples para amanha
2. Agendar coloracao com profissional especifico
3. Reagendar horario existente
4. Cancelar agendamento
5. Horario solicitado nao disponivel → oferecer alternativa
6. Agendar combo (corte + barba)
7. Agendar para outra pessoa
8. Perguntar horarios disponiveis sem escolher
9. Agendar fora do horario de funcionamento
10. Agendar em dia de folga do profissional
11. Duas pessoas agendando mesmo horario (concorrencia)
12. Cliente tenta agendar servico que nao existe
13. Cliente envia audio (nao texto)
14. Cliente envia imagem de referencia
15. Cliente envia localizacao
16. Agendar para "semana que vem" (sem data especifica)
17. Agendar para "hoje a tarde" (vago)
18. Confirmar agendamento existente
19. Perguntar se tem encaixe
20. Agendar 3 servicos em sequencia

## Cenarios FAQ (10)
21. Perguntar preco de servico
22. Perguntar endereco/como chegar
23. Perguntar formas de pagamento
24. Perguntar horario de funcionamento
25. Perguntar se aceita pix
26. Perguntar sobre servico que nao existe no salao
27. Perguntar nome do profissional especialista em X
28. Perguntar se tem estacionamento
29. Perguntar se atende criancas
30. Perguntar sobre produto a venda

## Cenarios Vendas (10)
31. Follow-up pos-atendimento (satisfacao)
32. Reativacao cliente inativo 30 dias
33. Reativacao cliente inativo 60 dias
34. Sugestao servico complementar apos agendamento
35. Promocao sazonal (Black Friday, Dia das Maes)
36. Cliente responde "nao quero" a promocao → parar
37. Cliente responde "me conte mais" a promocao
38. Lembrete 24h antes do agendamento
39. Aniversario do cliente
40. Indicacao (cliente satisfeito → pedir indicacao)

## Cenarios Human Takeover (10)
41. Cliente reclama de servico anterior
42. Cliente quer falar com a dona
43. Cliente faz pergunta que IA nao sabe
44. Cliente esta irritado/usa palavras grosseiras
45. Cliente pede desconto
46. Cliente quer negociar pagamento parcelado
47. Situacao ambigua que IA nao tem confianca
48. Cliente fala em outro idioma
49. Cliente envia msg muito longa e complexa
50. Tres tentativas de IA sem resolver → escalar automatico

## Criterios de aprovacao
- [ ] 90%+ dos cenarios resolvidos corretamente
- [ ] Tempo medio de resposta < 5 segundos
- [ ] Zero respostas inventadas (alucinacao)
- [ ] Tom de voz consistente em todas as respostas
- [ ] Human takeover funciona em 100% dos cenarios criticos
```

---

### Task 1.4 — Criar Templates do Squad

#### `salon-canvas.md` (adaptacao do Pareto AI Canvas)

```markdown
# Pareto AI Canvas — {{NOME DO SALAO}}

## 1. PROBLEMA
> Qual dor estamos resolvendo?

## 2. PROCESSO AS-IS
> Como funciona hoje (antes da IA)?

## 3. PROCESSO TO-BE
> Como vai funcionar com a IA?

## 4. PERSONA DO AGENTE
- Nome:
- Tom de voz:
- Personalidade:

## 5. FUNCOES DO AGENTE
- [ ] Agendamento
- [ ] FAQ
- [ ] Vendas proativas
- [ ] Follow-up
- [ ] Human takeover

## 6. INTEGRAÇÕES
- WhatsApp (Evolution API + Cloud API)
- n8n (orquestracao)
- Chatwoot (CRM/inbox)
- Sistema de agenda: ___

## 7. KPIs
| KPI | Target MVP | Target Ideal |
|-----|-----------|-------------|
| Taxa de agendamento | +20% | +30-50% |
| Tempo resposta | < 30s | < 5s |
| Satisfacao cliente | > 80% | > 90% |
| Conversao follow-up | > 10% | > 20% |
| Reducao carga humana | -40% | -70% |

## 8. RISCOS
-
-

## 9. CRONOGRAMA
- Sprint 0 (Discovery): __ dias
- Sprint 1 (Core): __ dias
- Sprint 2 (Sales): __ dias
```

---

## Fase 2: Sprint 0 — Discovery (3-5 dias)

**Agente:** @analyst (Atlas) + Victor (humano)
**Dependencia:** Fase 1 completa (squad criado)

### Acoes:
1. Victor agenda reuniao com dona do salao
2. Usar `discovery-client.md` como roteiro da reuniao
3. Preencher `salon-canvas.md`
4. Construir KB usando `build-knowledge-base.md`
5. Victor valida KB com dona do salao

### Entregaveis:
- [ ] Canvas preenchido
- [ ] KB completa (6 arquivos)
- [ ] KPIs definidos com targets
- [ ] Dona do salao aprovou tudo

---

## Fase 3: Sprint 1 — Core Agent (7-10 dias)

**Agente:** @dev (Dex)
**Dependencia:** Sprint 0 completo + KB aprovada

### Acoes (em ordem):
1. Contratar VPS e deploy stack Docker (`setup-whatsapp-api.md`)
2. Configurar Chatwoot (`setup-chatwoot.md`)
3. Criar prompts PACER (`create-prompts-pacer.md`)
4. Construir workflows n8n (`build-n8n-workflows.md`) — WF-01 a WF-05
5. Testar cenarios (`test-scenarios.md`) — cenarios 1-30 e 41-50
6. Piloto controlado (`pilot-launch.md`) — 3-5 dias com monitoramento intensivo

### Entregaveis:
- [ ] Stack operacional (Evolution API + n8n + Chatwoot)
- [ ] Agendamento funcionando end-to-end
- [ ] FAQ respondendo com base na KB
- [ ] Human takeover funcionando
- [ ] 90%+ cenarios aprovados
- [ ] Piloto rodando com clientes reais

---

## Fase 4: Sprint 2 — Sales & Follow-up (7-10 dias)

**Agente:** @dev (Dex)
**Dependencia:** Sprint 1 completo + piloto aprovado

### Acoes:
1. Construir WF-06 (cron jobs proativos)
2. Criar templates de mensagens marketing (com aprovacao da dona)
3. Implementar cenarios 31-40
4. Escalar para 100% do trafego
5. Gerar relatorio de resultados (case study)

### Entregaveis:
- [ ] Lembretes 24h funcionando
- [ ] Follow-up pos-atendimento funcionando
- [ ] Reativacao de clientes inativos funcionando
- [ ] 100% trafego passando pelo agente
- [ ] Case study com metricas documentado

---

# TRACK 2: MARCA INFLUENCE LABS

**Prioridade:** Paralela ao Track 1, pode comecar quando Track 1 estiver em Sprint 1.

## Fase 1: Identidade Visual

**Agente:** @analyst (pesquisa) + Victor (decisao) + ferramenta de design

### Acoes:
1. Pesquisar referências de marcas de AI Services brasileiras e internacionais
2. Definir:
   - Nome confirmado: Influence Labs
   - Tagline (ex: "AI that works for your business")
   - Paleta de cores (sugestao: tech + acessivel, nao frio/corporativo demais)
   - Tipografia
   - Logo (contratar designer ou usar IA + refinar)
3. Criar brand guidelines basico (1 pagina)

### Entregaveis:
- [ ] Logo em PNG/SVG (versoes claro/escuro)
- [ ] Paleta de cores definida
- [ ] Tipografia definida
- [ ] Brand guidelines v1

---

## Fase 2: Landing Page

**Agente:** @dev ou ferramenta no-code (Lovable, Framer, etc.)

### Conteudo da landing page:
1. Hero: "Agentes de IA que trabalham pelo seu negocio 24/7"
2. Problema: "Voce perde clientes por nao responder rapido o bastante"
3. Solucao: O que a Influence Labs faz (agentes WhatsApp, automacao, multi-agent)
4. Case study: Resultado do salao (quando disponivel)
5. Como funciona: 3 etapas (Discovery → Build → Deploy)
6. Pricing: "A partir de R$ X/mes" (definir apos validar custos reais)
7. CTA: Agendar conversa / WhatsApp direto
8. Footer: Sobre, contato, "Powered by Pareto methodology"

### Entregaveis:
- [ ] Landing page publicada
- [ ] Dominio configurado (influencelabs.com.br ou similar)
- [ ] Formulario de contato funcionando
- [ ] Google Analytics configurado

---

## Fase 3: Templates Comerciais

**Agente:** @analyst + @pm

### Adaptar do kit Pareto (em `docs/raw-materials/`):
1. Proposta comercial (baseada em `Proposta | Pareto - {{TEMPLATE}}`)
   - Trocar branding para Influence Labs
   - Adaptar pricing para realidade solo + IA
   - Manter estrutura faseada
2. Canvas de projeto (baseado no Pareto AI Canvas)
3. Relatorio de resultados (para case studies)
4. Apresentacao institucional (10 slides)

### Entregaveis:
- [ ] Template proposta comercial
- [ ] Template canvas de projeto
- [ ] Template relatorio de resultados
- [ ] Apresentacao institucional

---

## Fase 4: Empacotar UAOS

**Agente:** @analyst + Victor
**Dependencia:** Apos Track 1 gerar case study real

### Acoes:
1. Documentar UAOS como diferencial (baseado em `docs/raw-materials/notes.md`)
2. Criar narrativa: "Por que UAOS e diferente"
   - Nao e so chatbot, e workforce de IA
   - Arquitetura bicameral (Office + Factory)
   - 5 principios imutaveis
   - Auto-healing, auto-critique
3. Definir como vender UAOS:
   - Como metodologia (embutida no servico)?
   - Como produto (licenciavel)?
   - Como diferencial de marca (storytelling)?

### Entregaveis:
- [ ] Documento UAOS 1-pager (para clientes)
- [ ] Secao no site explicando UAOS
- [ ] Decisao: metodologia vs produto vs storytelling

---

# CRONOGRAMA CONSOLIDADO

```
Semana 1:  [TRACK 1] Fase 1 (criar squad AIOS) + Fase 2 (Sprint 0 Discovery)
Semana 2:  [TRACK 1] Fase 3 (Sprint 1 — setup infra + prompts)
           [TRACK 2] Fase 1 (identidade visual — paralelo)
Semana 3:  [TRACK 1] Fase 3 cont. (Sprint 1 — workflows + testes)
           [TRACK 2] Fase 2 (landing page — paralelo)
Semana 4:  [TRACK 1] Fase 3 fim (piloto controlado)
           [TRACK 2] Fase 3 (templates comerciais — paralelo)
Semana 5:  [TRACK 1] Fase 4 (Sprint 2 — vendas + follow-up)
Semana 6:  [TRACK 1] Fase 4 fim + case study
           [TRACK 2] Fase 4 (empacotar UAOS)
```

---

# INSTRUCOES PARA O AGENTE EXECUTOR

1. **Comece pelo Track 1, Fase 1** — Criar o squad AIOS e o squad inteiro.
2. **Use @aios-master** para criar o squad: `*create` seguindo a estrutura acima
3. **Leia os 3 relatorios de pesquisa** antes de comecar (listados em "Material de referencia")
4. **Nao invente dados** — tudo que precisa de input do cliente (salao) esta marcado com checkbox [ ] nas tasks
5. **Siga o Metodo Pareto** — Discovery antes de Build, Quick Wins primeiro
6. **Victor é o decisor** — escale para ele em decisoes de UX, pricing, tom de voz, brand
7. **Golden Rules Pareto**: KB sempre, verbatim quando possivel, validacao humana, personalizacao, nao superestimar a IA
8. **Anti-padroes proibidos**: nao assumir o que o cliente quer, nao comecar sem escopo claro, nao esconder progresso

---

*— Atlas, investigando a verdade*
