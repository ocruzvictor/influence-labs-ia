# Análise Complementar — Novos Documentos + Contexto do Projeto Beta

**Data:** 2026-02-24 | **Contexto:** Victor clarificou que precisa montar squads/workflows para destravar projeto beta (salão de beleza WhatsApp)

---

## 1. O QUE OS NOVOS DOCUMENTOS REVELAM

### 1.1 Método Pareto Operacional (Workshop Gestão de Projetos)

Este é o documento mais valioso dos 3 — mostra como a Pareto **realmente** entrega projetos no dia a dia (não o framework teórico do MVP 30 dias).

**Ciclo de Vida Real:**

```
Reunião com cliente → Descoberta → Modelagem → Priorização → Execução
         ↓                                                        ↓
  Reunião interna Pareto                                    Lançamento
  Reunião interna Cliente                                       ↓
  Fluxo recorrente de atualização                     Suporte e Manutenção
                                                            ↓
                                                    Pós-venda e Upsell
```

**Dois Modelos de Engajamento:**

| Modelo | Quando usar | Preço referência |
|--------|------------|-----------------|
| **Escopo Aberto** | Cliente com pouca clareza, baixa maturidade, ideia pouco elaborada | R$ 8.000/mês (squad alocado part-time) |
| **Escopo Fechado** | Cliente sabe o que quer, escopo bem definido | R$ 8.000 pagamento único |

**Ritos e Rotinas (CRUCIAL para montar squads):**

| Ritual | Frequência | Quem |
|--------|-----------|------|
| Prioridades da semana | Semanal | Gestores |
| Prioridades do dia | Diário | Todos |
| Retrospectiva | Semanal | Gestores |
| Atualização ao cliente | Semanal/quinzenal | Cliente + Gestor |
| Questões técnicas | Ad-hoc | Equipe de desenvolvimento |

**12 Anti-Padrões (Golden Rules negativas):**
1. Não assumir o que o cliente deseja
2. Não começar sem escopo claro
3. Não excluir o cliente do processo
4. Não esconder progresso
5. Não assumir que o cliente entende tudo
6. Não ocultar mudanças de cronograma
7. Não comunicar problemas sem soluções
8. Não demorar para responder
9. Não assumir satisfação
10. Não falar com o time só 1x/semana
11. Não descumprir prazos sem justificativa
12. Não usar IA generativa para TODOS os problemas

---

### 1.2 Cases Reais com Resultados (Workshop)

| Case | Fluxo | Resultado |
|------|-------|----------|
| **AI SDR WhatsApp** | Tráfego → Atendimento instantâneo → Qualificação → Agendamento/CRM → Vendedor acionado | +30-50% taxa agendamento, SLA <1min |
| **Fábrica de Criativos (Agência)** | Briefing → Validador de Marca → Designer Generativo → Revisão humana → Post pronto | -80% tempo design, 3x velocidade |
| **Fábrica de Criativos (Print on Demand)** | Arte → 3 estilos diferentes → Aprovação → Alta resolução → Enxoval completo | -50% tempo design, 2x velocidade |
| **Análise Desempenho Comercial** | CRM → Análise por registro → Agrupamento/Nota → Relatório por email → Gestor avalia | 100% verificação, -30-50% curva aprendizado |
| **Validador de Licitação** | Edital → Identificar requisitos → Buscar comprobatórios → Resultado com referências → Validação humana | -87% tempo execução |

**Observação crítica:** O case **AI SDR WhatsApp** é praticamente idêntico ao projeto beta do salão de beleza. A Pareto já validou esse modelo com resultados comprovados.

---

### 1.3 Estrutura Real de Squad e Precificação (Proposta Template)

**Dream Team Pareto (referência):**

| Posição | PJ Full Time | CLT Full Time |
|---------|-------------|---------------|
| Gestor do Projeto | R$ 17.000 | R$ 23.800 |
| Product Owner | R$ 13.000 | R$ 18.200 |
| Cientista de Dados / Dev (Infra) | R$ 15.000 | R$ 21.000 |
| AI Workflow Developer | R$ 10.000 | R$ 14.000 |
| AI Engineer | R$ 10.000 | R$ 14.000 |
| **Total** | **R$ 65.000** | **R$ 91.000** |

**Argumento de venda:** Squad Pareto por R$ 8K/mês vs contratar equipe equivalente por R$ 65-91K/mês.

**Projeto real faseado (referência):**

| Fase | Entrega | Valor |
|------|---------|-------|
| Fase 1+4 | Discovery e Arquitetura + Go-live | R$ 10.000 |
| Fase 2 | Implementação Core + WhatsApp | R$ 21.500 |
| Fase 3 | Agentes de IA e Automações Avançadas | R$ 22.000 |
| Tess | Licença mensal (plano anual, 50 créditos/dia) | R$ 249,99/mês |
| Infra | Manutenção (até 5.000 msgs/mês) | R$ 990/mês |
| **Total** | **Setup + Recorrente** | **R$ 53.500 + R$ 1.240/mês** |

---

### 1.4 Treinamento Omni — Insights Adicionais

**Tipologia simplificada de soluções (como a Pareto vende):**

```
Chat → Agente → Automação (Workflow) → Orquestrador → Aplicação Web (App)
 ↑                                                                      ↑
Simples                                                             Complexo
Barato                                                               Caro
```

**Golden Rules (da experiência Pareto):**
1. **Base de Conhecimento (RAG Memory)** — sempre ter KB, nunca operar no vazio
2. **Verbatim** — responder com as palavras exatas da KB quando possível
3. **Validação Humana** — sempre ter human-in-the-loop
4. **Personalização** — agente deve soar como a marca do cliente
5. **Habilidades "Básicas" da IA** — não superestimar capacidades
6. **Comece com IA Generativa** — não pular para o complexo antes do básico

**Cases de Fracasso (lições):**
- Klarna: IA criou "lacunas de empatia" — US$ 14.6B avaliação ameaçada
- E-commerce sem KB: tradução automática sem base de conhecimento = desastre
- Amazon: "Não posso atender" sem validação humana = ridículo público
- Air Canada: chatbot deu informação errada sobre reembolso → **perdeu nos tribunais**

---

## 2. ANÁLISE CRUZADA COM CONTEXTO DO VICTOR

### 2.1 Recalibrando o Entendimento

Victor esclareceu pontos cruciais que mudam a análise:

| Antes (o que eu entendia) | Agora (o que Victor quer) |
|--------------------------|--------------------------|
| Empresa de AI Services genérica | **Sistema de IA (workforce) para rodar o próprio negócio** |
| Vender serviços depois de pesquisar | **Pesquisar para decidir posicionamento E criar squads para destravar o projeto beta** |
| Teoria primeiro, prática depois | **Tem cliente beta JÁ (salão de beleza)**, precisa entregar |

### 2.2 O Projeto Beta — Salão de Beleza

**Escopo:**
- Agente WhatsApp via API oficial da Meta (modelo de coexistência)
- Função de recepcionista: agendamentos + variáveis (reagendamento, cancelamento, lista de espera, etc.)
- **Proativo em vendas**: follow-up, promoções, reativação de clientes inativos
- Modelo de coexistência: agente + humano operando simultaneamente

**Por que é o MVP perfeito:**
- Case idêntico ao "AI SDR WhatsApp" da Pareto (+30-50% agendamento, SLA <1min)
- **Demanda palpável** — todo salão/clínica/consultório precisa disso
- Escopo fechado e bem definido
- Resultado mensurável em 30 dias
- Gera case study próprio para vender para outros salões/clínicas
- Vertical replicável (beleza → saúde → serviços profissionais)

**Riscos do projeto beta:**
- Preço acessível pode comprimir margem
- Variáveis de agendamento são complexas (horários, profissionais, serviços, combos, tempo de cada serviço)
- Follow-up proativo precisa ser delicado para não ser spam
- Coexistência agente+humano no mesmo WhatsApp requer arquitetura cuidadosa

---

## 3. MAPEAMENTO: MÉTODO PARETO → SQUADS INFLUENCE LABS

### 3.1 De Método para Workflow Operacional

Baseado no ciclo de vida do Workshop, traduzido para squads de IA:

```
MÉTODO PARETO              →    WORKFLOW INFLUENCE LABS
─────────────────────            ─────────────────────────

1. Reunião com cliente      →    DISCOVERY (Humano + @analyst)
   - Entender problema           - Pareto AI Canvas preenchido
   - Mapear processo AS-IS       - Mapa AS-IS → TO-BE
   - Identificar persona         - ICP/persona documentado

2. Descoberta               →    SPEC (Humano + @pm + @analyst)
   - Aprofundar necessidade      - Requisitos funcionais
   - Mapear integrações          - Requisitos técnicos (API Meta, CRM, etc.)
   - Definir KPIs                - KPIs com targets MVP/Ideal

3. Modelagem                →    ARCHITECTURE (@architect + @dev)
   - Processo TO-BE              - Fluxo do agente (estados, transições)
   - Tipologia da solução        - Stack técnica (TESS/n8n/Make/API direta)
   - Pontos de validação humana  - Human-in-the-loop design

4. Priorização              →    PLANNING (@pm + @po)
   - Matriz Impacto x Esforço    - Backlog priorizado
   - Quick Wins primeiro         - Sprint 1 = core (agendamento básico)
   - Roadmap faseado             - Sprint 2 = advanced (follow-up, vendas)

5. Execução                 →    BUILD (@dev + @qa)
   - Construir agente            - Prompts PACER/FAFAC
   - Integrar APIs               - WhatsApp API + KB + automações
   - Testar internamente         - Testes com 50+ cenários
   - Iterar                      - Auto-healing loop

6. Lançamento               →    DEPLOY (@devops + @qa)
   - Go-live controlado          - Piloto 10% → 50% → 100%
   - Monitoramento intensivo     - Dashboard KPIs real-time
   - Ajustes rápidos             - Iteração diária Semana 1

7. Suporte e Manutenção     →    OPERATE (Sistema autônomo + Humano)
   - Monitorar performance       - KPIs automatizados
   - Ajustar prompts             - Autohealing (Type 6)
   - Relatórios periódicos       - Report mensal automatizado

8. Pós-venda e Upsell       →    GROW (@analyst + Humano)
   - Identificar oportunidades   - Análise de dados do agente → insights
   - Propor expansão             - Novos agentes / verticais
```

### 3.2 Squad Mínimo Viável (para o projeto beta)

Victor opera solo + IA. O squad precisa ser de **agentes de IA** que fazem o papel dos humanos:

| Papel Pareto | Agente IA Influence Labs | Função no Projeto Beta |
|-------------|------------------------|----------------------|
| **Gestor do Projeto** | Victor (humano) + @pm | Coordena, comunica com cliente, toma decisões |
| **Product Owner** | @po | Valida requisitos, prioriza backlog, aceita entregas |
| **AI Engineer** | @dev + @architect | Cria prompts, configura agentes, integra APIs |
| **AI Workflow Developer** | @dev | Constrói automações (n8n/Make), conecta sistemas |
| **QA** | @qa | Testa cenários, valida qualidade, gate de lançamento |

**Ritmos adaptados (solo + IA):**

| Ritual | Frequência | Como fazer com IA |
|--------|-----------|-------------------|
| Prioridades da semana | Segunda | Victor define, @pm organiza em tasks |
| Standup | Diário (5min) | Victor revisa progresso no board de tasks |
| Update ao cliente | Semanal | Victor (reunião/mensagem), template gerado por IA |
| Retrospectiva | Semanal | @analyst analisa o que funcionou/falhou |

### 3.3 Workflow Específico: Projeto Salão de Beleza

**Sprint 0 — Discovery (3-5 dias):**
- [ ] Reunião com cliente: entender fluxo atual da recepcionista
- [ ] Mapear todos os serviços, profissionais, horários, regras de agendamento
- [ ] Identificar variáveis: reagendamento, cancelamento, lista de espera, combos, tempo por serviço
- [ ] Definir persona do agente (tom, nome, limites)
- [ ] Preencher Pareto AI Canvas
- [ ] Definir KPIs: taxa de agendamento, tempo resposta, satisfação, conversão de follow-up

**Sprint 1 — Core Agent (7-10 dias):**
- [ ] Construir KB do salão (serviços, preços, horários, profissionais, FAQ)
- [ ] Criar prompt PACER para o agente recepcionista
- [ ] Configurar integração WhatsApp Business API (Meta oficial)
- [ ] Implementar fluxo de agendamento básico (marcar, reagendar, cancelar)
- [ ] Configurar modelo de coexistência (agente + humano no mesmo número)
- [ ] Testar com 50+ cenários internos
- [ ] Piloto controlado (3-5 dias com acompanhamento intensivo)

**Sprint 2 — Sales & Follow-up (7-10 dias):**
- [ ] Implementar follow-up pós-atendimento (satisfação)
- [ ] Implementar reativação de clientes inativos (30/60/90 dias)
- [ ] Implementar sugestão proativa de serviços complementares
- [ ] Implementar lembretes de agendamento (24h antes)
- [ ] Escalar para 100% do tráfego
- [ ] Gerar relatório de resultados para o case study

**Sprint 3 — Otimização (contínuo):**
- [ ] Analisar conversas reais e ajustar prompts
- [ ] Implementar autohealing baseado em feedback
- [ ] Dashboard de KPIs para o dono do salão
- [ ] Documentar case study com métricas (para vender para outros salões)

---

## 4. DECISÕES ESTRATÉGICAS PENDENTES

Com base em tudo que foi analisado, Victor precisa tomar estas decisões:

### Decisão 1: Stack Técnica do Projeto Beta

| Opção | Prós | Contras |
|-------|------|---------|
| **TESS AI + n8n/Make** | Já tem licença Pareto, apostilas cobrem, suporte do ecossistema | Dependência da TESS, custo mensal plataforma |
| **API direta (Claude/GPT) + n8n** | Controle total, sem intermediário, maior margem | Mais trabalho técnico, sem suporte Pareto |
| **Híbrido** | TESS para prototipagem rápida, migrar para API própria depois | Complexidade transitória |

### Decisão 2: Modelo de Coexistência WhatsApp

| Opção | Descrição |
|-------|-----------|
| **Handoff por palavra-chave** | Cliente digita "humano" → transfere para atendente |
| **Handoff por complexidade** | Agente detecta que não sabe responder → transfere |
| **Handoff por horário** | Agente opera fora do horário comercial, humano no horário |
| **Coexistência real** | Ambos operam simultaneamente, agente é "primeira linha" |

### Decisão 3: Posicionamento da Influence Labs

| Opção | Foco | Risco |
|-------|------|-------|
| **Licenciado Pareto puro** | Usar marca/método Pareto 100% | Sem diferenciação, fee de 25% |
| **Marca própria com método Pareto** | Influence Labs como marca, método Pareto como base | Precisa justificar marca desconhecida |
| **Marca própria com UAOS** | Influence Labs + UAOS como diferencial | Mais trabalho de empacotamento, mas maior moat |
| **Dual-brand** | Pareto para credibilidade inicial, UAOS como evolução | Complexidade de marca, mas pragmático |

---

## 5. PRÓXIMOS PASSOS RECOMENDADOS

**Imediato (esta semana):**
1. Decidir stack técnica para o projeto beta
2. Criar os workflows/tasks no AIOS para o ciclo Discovery→Build→Deploy do salão
3. Iniciar Sprint 0 (discovery) com o cliente do salão

**Curto prazo (próximas 2-3 semanas):**
4. Executar Sprint 1 (core agent) do salão
5. Documentar decisões de arquitetura
6. Estabelecer ritos mínimos (diário + semanal)

**Médio prazo (mês 2):**
7. Sprint 2 do salão (vendas proativas + follow-up)
8. Case study documentado
9. Decidir posicionamento de marca
10. Empacotar oferta produtizada para "vertical beleza/saúde"

---

*— Atlas, investigando a verdade*
