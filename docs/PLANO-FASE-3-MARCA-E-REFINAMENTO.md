# PLANO DE ACAO — Fase 3: Marca Influence Labs + Refinamento Tecnico

**Data:** 2026-02-24
**Para:** Agente Codex executar autonomamente
**Pre-requisitos concluidos:**
- Fase 1: Squad AIOS criado (20 arquivos em `.aios-core/squads/salon-whatsapp/`)
- Fase 2: Infra, KB, prompts, workflows n8n, docs (25 arquivos em `infra/`, `data/`, `n8n-workflows/`, `docs/guides/`)

---

## CONTEXTO PARA O AGENTE EXECUTOR

### Decisoes ja tomadas (NAO rediscutir):
- **Dual-brand**: Pareto (credibilidade/metodologia licenciada) + Influence Labs (marca propria com UAOS)
- **Posicionamento**: Boutique de agentes de IA para mid-market brasileiro
- **Diferencial**: Framework UAOS (Unified Autonomous Operation System)
- **Vertical inicial**: Beleza/saude (saloes, clinicas, consultorios)
- **Licenciamento Pareto**: Level 1 (R$15K/12x), fee regressivo 25%→12%, prazo 3 anos

### Arquivos de referencia obrigatorios:
1. `docs/research/influence-labs-foundation-report.md` — Analise de mercado, ativos, gap analysis
2. `docs/research/analise-complementar-novos-docs.md` — Metodo Pareto, precificacao, cases reais
3. `docs/research/stack-tecnica-projeto-salao.md` — Stack e custos
4. `docs/raw-materials/notes.md` — Framework UAOS completo (linhas 1-400 = arquitetura bicameral, 5 principios)
5. `docs/raw-materials/Proposta | Pareto - {{TEMPLATE}}.txt` — Modelo de proposta comercial
6. `docs/raw-materials/Workshop gestão de projetos de IA.txt` — Metodo Pareto operacional
7. `docs/raw-materials/Cópia de [Pareto] - Treinamento Omni.txt` — Tipologia de solucoes, golden rules

---

## ESCOPO DESTE PLANO (2 tracks paralelos)

```
TRACK A: MARCA INFLUENCE LABS (estrategia + identidade + materiais comerciais)
  ├── Parte 1: Posicionamento estrategico
  ├── Parte 2: Identidade visual (brief)
  ├── Parte 3: Landing page (conteudo + estrutura)
  ├── Parte 4: Templates comerciais
  └── Parte 5: Empacotar UAOS

TRACK B: REFINAMENTO TECNICO (elevar workflows n8n de 70% para 95%)
  ├── Parte 6: Completar workflows n8n
  ├── Parte 7: Implementar RAG para FAQ
  └── Parte 8: Testes automatizados
```

---

# TRACK A: MARCA INFLUENCE LABS

## Parte 1: Posicionamento Estrategico

**Criar em:** `docs/strategy/positioning.md`

### Conteudo a produzir:

#### 1.1 — Analise de posicionamento

Pesquisar na web e documentar:
- 5-10 empresas brasileiras que vendem servicos de IA/agentes (concorrentes diretos)
- Como se posicionam (generalista vs especialista, pricing, publico)
- Gap de mercado que a Influence Labs ocupa

Dados de referencia (ja pesquisados):
- Brasil AI agents: CAGR 47.9% (USD 0.24B → 2.41B em 2030)
- Quase zero boutiques especializadas em AI agents para mid-market BR
- 73% clientes preferem pricing baseado em resultado
- 9M empresas BR devem adotar IA, apenas 25% preparadas

#### 1.2 — Proposta de valor (Value Proposition Canvas)

Documentar em formato estruturado:

```markdown
## Cliente (mid-market BR, 50-500 funcionarios)
### Jobs-to-be-done
- Atender clientes 24/7 sem aumentar equipe
- Reduzir tempo de resposta no WhatsApp
- Parar de perder agendamentos/leads por demora
- Ter dados de atendimento para tomar decisoes

### Dores
- Equipe limitada, nao consegue atender rapido
- WhatsApp do negocio e caos (mistura pessoal com profissional)
- Nao sabe por onde comecar com IA
- Medo de "robozao" que espanta cliente
- Projetos de IA caros e longos

### Ganhos desejados
- Atendimento instantaneo sem perder qualidade humana
- Mais agendamentos/vendas com mesma equipe
- Dados claros de performance
- Custo previsivel e acessivel

## Influence Labs
### Produtos/Servicos
- Agentes WhatsApp multi-funcao (recepcionista + vendas + FAQ)
- Implementacao em 30 dias (MVP rapido)
- Coexistencia IA + humano (seguranca)
- Dashboard de KPIs

### Alivios de dor
- IA que soa humana (metodologia PACER de prompts)
- Dono monitora e intervem quando quiser (coexistencia)
- Preco acessivel a partir de R$ [definir]/mes
- Projeto piloto de baixo risco

### Criadores de ganho
- +30-50% taxa de agendamento (case Pareto validado)
- SLA < 1 minuto (vs 30-60min humano)
- Vendas proativas automaticas (follow-up, reativacao)
- Case studies com metricas reais
```

#### 1.3 — Modelo de pricing

Pesquisar e propor 3 modelos de pricing com analise de margem:

```markdown
## Modelo 1: Projeto + Recorrente (recomendado Pareto)
- Setup: R$ 3.000-5.000 (Discovery + Build + Deploy)
- Recorrente: R$ 990-1.500/mes (infra + manutencao + otimizacao)
- Fee Pareto (25% ano 1): R$ 247-375/mes do recorrente
- Margem liquida estimada: R$ [calcular]

## Modelo 2: Subscription Only
- R$ 1.500-2.500/mes tudo incluso (sem setup)
- Compromisso minimo: 6 meses
- Margem liquida estimada: R$ [calcular]

## Modelo 3: Performance-based (hibrido)
- Base: R$ 500/mes (cobre custos)
- Performance: R$ X por agendamento realizado pela IA
- Fee Pareto: 25% sobre receita total
- Margem liquida estimada: R$ [calcular]
```

Para cada modelo calcular:
- Custos fixos: VPS (~R$80), Meta fees (~R$80), LLM (~R$50), tempo Victor (~R$X/h)
- Fee Pareto (25% ano 1, 20% ano 2, 15% ano 3, 12% ano 4+)
- Break-even: quantos clientes para cobrir custo fixo + licenciamento Pareto (R$15K/12 = R$1.250/mes)
- Meta: margem liquida minima 40%

**Criar em:** `docs/strategy/pricing-model.md`

---

## Parte 2: Identidade Visual (Brief para Designer)

**Criar em:** `docs/brand/brand-brief.md`

O agente NAO vai criar o logo (precisa de designer/ferramenta visual), mas deve criar um brief detalhado:

```markdown
# Brand Brief — Influence Labs

## 1. Essencia da marca
- **Missao**: Democratizar agentes de IA para negocios brasileiros de medio porte
- **Visao**: Ser a referencia em AI agents para servicos no Brasil
- **Valores**: Resultado mensuravel, transparencia, parceria (nao vendor), inovacao pratica

## 2. Personalidade da marca
- **Tom**: Profissional mas acessivel. Tecnico quando necessario, humano sempre.
- **Nao somos**: Corporativo frio, startup hype, agencia de marketing
- **Somos**: Parceiro tecnico que entende de negocio
- **Analogia**: "O CTO de IA que voce sempre quis ter, mas sem o salario de CTO"

## 3. Naming
- **Nome**: Influence Labs
- **Tagline opcoes** (Victor escolhe):
  1. "Agentes de IA que trabalham pelo seu negocio"
  2. "IA que entende seu cliente"
  3. "Seu time de IA. Pronto em 30 dias."
  4. "Inteligencia artificial com inteligencia de negocio"
- **Sub-brand**: UAOS (Unified Autonomous Operation System) — framework proprietario

## 4. Direcao visual
- **Paleta primaria**:
  - Azul escuro/marinho (confianca, tecnologia) + Verde/teal (crescimento, inovacao)
  - OU Roxo/violeta (IA, sofisticacao) + Branco (limpeza, modernidade)
- **Paleta secundaria**: Cinza claro (backgrounds), preto (texto), accent color vibrante
- **Tipografia**:
  - Headlines: Sans-serif geometrica moderna (Inter, Manrope, Space Grotesk)
  - Body: Sans-serif legivel (Inter, Source Sans)
  - Monospace (codigo/tech): JetBrains Mono, Fira Code
- **Estilo visual**:
  - Minimalista, limpo, bastante whitespace
  - Icones outline (nao filled)
  - Gradientes sutis (nao flat, nao 3D)
  - Elementos tech sem ser "matrix/hacker"
  - Fotos: pessoas reais usando negocios reais (nao stock generico)

## 5. Aplicacoes necessarias
- Logo principal (horizontal)
- Logo icone (quadrado, para avatar/favicon)
- Versoes: claro, escuro, monocromatico
- Card de visita digital
- Template de proposta (header/footer)
- Template de apresentacao (Google Slides/Canva)
- Assinatura de email

## 6. Referências visuais
Pesquisar e listar 5-8 marcas de referencia (AI companies com branding forte):
- Linear.app (clean, minimalista, tech)
- Vercel (preto/branco, sofisticado)
- Anthropic (marca propria do Claude)
- Scale AI (tech enterprise acessivel)
- Outras relevantes do mercado BR
```

---

## Parte 3: Landing Page (Conteudo + Estrutura)

**Criar em:** `docs/brand/landing-page-content.md`

O agente deve criar o CONTEUDO COMPLETO da landing page (textos, CTAs, estrutura de secoes) pronto para implementar em qualquer ferramenta (Framer, Lovable, Next.js, etc).

```markdown
# Landing Page — Influence Labs

## Meta
- **URL**: influencelabs.com.br (ou influencelabs.ai)
- **Objetivo**: Gerar leads (WhatsApp ou formulario)
- **Publico**: Donos de negocios de servicos (saloes, clinicas, consultorios, academias)
- **Tom**: Profissional, direto, sem jargao tecnico

---

## Secao 1: Hero
**Headline**: "Seu negocio atendendo clientes 24/7 pelo WhatsApp — com inteligencia artificial"
**Sub-headline**: "Agentes de IA que agendam, vendem e cuidam dos seus clientes. Voce so monitora."
**CTA**: "Quero saber mais" → WhatsApp ou formulario
**Visual**: Mockup de conversa WhatsApp com agente IA atendendo (agendamento)

---

## Secao 2: Problema
**Headline**: "Quantos clientes voce perdeu essa semana por nao responder a tempo?"
**Bullets**:
- "Cliente mandou mensagem as 21h. Voce viu so de manha. Ele ja marcou em outro lugar."
- "Sua recepcionista atende telefone, WhatsApp e clientes presenciais ao mesmo tempo."
- "Follow-up com clientes inativos? Ninguem tem tempo pra isso."
**Dado**: "Negocios que respondem em menos de 1 minuto convertem 3x mais." (fonte: pesquisa Pareto)

---

## Secao 3: Solucao
**Headline**: "Um time de IA no seu WhatsApp. Pronto em 30 dias."
**3 cards**:

### Card 1: Recepcionista IA
- Agenda, reagenda e cancela automaticamente
- Verifica horarios disponiveis em tempo real
- Responde duvidas sobre precos, servicos, horarios
- "Funciona 24/7, inclusive feriados e madrugadas"

### Card 2: Vendedor IA
- Envia lembretes de agendamento (24h antes)
- Faz follow-up pos-atendimento
- Reativa clientes inativos com ofertas personalizadas
- "Aumenta suas vendas sem voce precisar lembrar"

### Card 3: Voce no controle
- Monitora todas as conversas pelo celular ou computador
- Entra na conversa quando quiser (coexistencia)
- Dashboard com metricas de atendimento
- "A IA trabalha POR voce, nao NO LUGAR de voce"

---

## Secao 4: Como funciona
**Headline**: "3 passos. 30 dias. Resultado real."

### Passo 1: Discovery (Semana 1)
"Entendemos seu negocio: servicos, precos, profissionais, regras, tom de voz. A IA vai soar como VOCE."

### Passo 2: Construcao (Semanas 2-3)
"Criamos e treinamos seus agentes de IA. Testamos com 50+ cenarios reais antes de ligar."

### Passo 3: Go-Live (Semana 4)
"Ligamos no seu WhatsApp real. Comecamos com 10% dos atendimentos e vamos subindo. Voce acompanha tudo."

---

## Secao 5: Resultados (Case Study — usar quando disponivel)
**Headline**: "Resultados reais de negocios como o seu"

### Case: Salao de Beleza [Nome]
- "+X% na taxa de agendamento"
- "Tempo medio de resposta: X segundos (antes: X minutos)"
- "X clientes reativados no primeiro mes"
- "Dona do salao: 'Agora eu consigo focar no que importa.'"

**Nota para o agente**: Se o case study ainda nao existir, criar com dados placeholder marcados como [A PREENCHER] e usar os dados do case Pareto como referencia: "+30-50% agendamento, SLA <1min".

---

## Secao 6: Pricing
**Headline**: "Investimento acessivel. Retorno mensuravel."

**Opcao simples** (recomendada para landing page):
"A partir de R$ [DEFINIR]/mes"
"Inclui: setup, treinamento da IA, suporte, otimizacao continua"
"Sem fidelidade. Cancele quando quiser."

**CTA**: "Fale com a gente e receba uma proposta personalizada"

**Nota**: NAO colocar precos detalhados na landing page. Usar "a partir de" para gerar lead.

---

## Secao 7: FAQ da landing page
1. "Meus clientes vao perceber que e um robo?" → "Nossos agentes sao treinados com o tom de voz do SEU negocio. A maioria dos clientes nao percebe a diferenca."
2. "E se a IA errar?" → "Voce monitora tudo em tempo real e pode entrar na conversa a qualquer momento. Alem disso, a IA escala automaticamente para voce em situacoes complexas."
3. "Preciso trocar de numero?" → "Nao! Usamos a API oficial da Meta. A IA funciona NO SEU numero atual, junto com o WhatsApp Business App."
4. "Quanto tempo demora para ficar pronto?" → "30 dias do inicio ao go-live. A primeira semana e para entender seu negocio, as demais para construir e testar."
5. "E seguro? Nao vou perder meu numero?" → "Usamos a API oficial da Meta (Cloud API), a mesma usada por grandes empresas. Zero risco de banimento."
6. "Funciona para [meu tipo de negocio]?" → "Se voce atende clientes pelo WhatsApp, funciona. Saloes, clinicas, consultorios, academias, escritorios..."

---

## Secao 8: CTA Final
**Headline**: "Pronto para ter seu time de IA?"
**Sub**: "Converse com a gente pelo WhatsApp. Sem compromisso."
**Botao**: "Falar pelo WhatsApp" → link wa.me/55XXXXXXXXXXX
**Botao secundario**: "Agendar uma demonstracao" → Calendly ou similar

---

## Secao 9: Footer
- Logo Influence Labs
- "Powered by Pareto methodology — 500+ projetos de IA entregues"
- Links: Sobre, Contato, Politica de Privacidade
- Redes: LinkedIn, Instagram (quando criados)
- "© 2026 Influence Labs. Todos os direitos reservados."

---

## SEO & Meta Tags
- Title: "Influence Labs — Agentes de IA para WhatsApp Business"
- Description: "Atendimento automatico pelo WhatsApp com inteligencia artificial. Agende, venda e cuide dos seus clientes 24/7."
- Keywords: agente IA WhatsApp, chatbot WhatsApp Business, automacao atendimento, IA para salao, IA para clinica
```

---

## Parte 4: Templates Comerciais

### Task 4.1 — Proposta Comercial

**Criar em:** `docs/brand/templates/proposta-comercial.md`

Adaptar o template Pareto (em `docs/raw-materials/Proposta | Pareto - {{TEMPLATE}}.txt`) com marca Influence Labs.

Estrutura:

```markdown
# Proposta Comercial — {{NOME_CLIENTE}}

## Influence Labs
**Agentes de IA para o seu negocio**

---

## 1. Entendemos seu desafio
{{Resumo do problema do cliente, capturado na Discovery}}

## 2. Nossa solucao
{{Descricao do que sera implementado, com base no AI Canvas}}

### Agentes incluidos:
- [ ] Recepcionista IA (agendamento 24/7)
- [ ] FAQ IA (respostas automaticas)
- [ ] Vendedor IA (follow-up + reativacao)
- [ ] Human takeover (escalacao para humano)

### Diferenciais:
- API oficial Meta (zero risco de banimento)
- Coexistencia: voce monitora e intervem quando quiser
- Metodologia validada em 500+ projetos (Pareto)
- Framework UAOS — inteligencia que aprende e melhora

## 3. Cronograma
| Fase | Entrega | Prazo |
|------|---------|-------|
| Discovery | Mapeamento completo do negocio | Semana 1 |
| Construcao | Agentes treinados e testados | Semanas 2-3 |
| Go-Live | Piloto controlado → producao | Semana 4 |

## 4. Investimento

### Opcao A: Projeto + Recorrente
| Item | Valor |
|------|-------|
| Setup (Discovery + Build + Deploy) | R$ {{VALOR_SETUP}} |
| Recorrente mensal (infra + manutencao + otimizacao) | R$ {{VALOR_MENSAL}}/mes |

### Opcao B: Assinatura mensal
| Item | Valor |
|------|-------|
| Tudo incluso (setup diluido + operacao) | R$ {{VALOR_SUBSCRIPTION}}/mes |
| Compromisso minimo | 6 meses |

## 5. O que esta incluso
- Configuracao completa da stack (WhatsApp API + n8n + CRM)
- Treinamento dos agentes com dados do seu negocio
- 50+ cenarios de teste antes do go-live
- Dashboard de KPIs
- Suporte prioritario via WhatsApp
- Otimizacao continua dos agentes (ajuste mensal de prompts)

## 6. O que NAO esta incluso
- Hardware ou infraestrutura do cliente
- Custos de API da Meta (WhatsApp) — estimado ~R$ 80/mes
- Custos de API de IA (LLM) — estimado ~R$ 30-80/mes
- Desenvolvimento de features nao especificadas no escopo

## 7. Resultados esperados
(Baseado em 500+ projetos Pareto)
| KPI | Antes | Depois |
|-----|-------|--------|
| Tempo de resposta | 15-60 min | < 1 min |
| Taxa de agendamento | Base | +30-50% |
| Atendimento fora de horario | 0% | 100% |
| Follow-up de clientes | Esporadico | Automatico |

## 8. Proximo passo
Para iniciar, precisamos de:
1. Aceite desta proposta (assinatura digital)
2. Acesso ao WhatsApp Business do negocio
3. Agendamento da reuniao de Discovery (1-2 horas)

**Contato**: Victor Cruz — {{TELEFONE}} — {{EMAIL}}
**Influence Labs** | Powered by Pareto methodology
```

### Task 4.2 — Apresentacao Institucional

**Criar em:** `docs/brand/templates/apresentacao-institucional.md`

Conteudo para 10-12 slides (Victor implementa no Canva/Google Slides):

```markdown
# Apresentacao Institucional — Influence Labs

## Slide 1: Capa
- Logo Influence Labs
- "Agentes de IA para o seu negocio"
- www.influencelabs.com.br

## Slide 2: O Problema
- 78% das empresas usam IA, mas 80% nao veem resultado (McKinsey 2025)
- No mid-market BR: equipes pequenas, WhatsApp como canal principal, sem tempo para IA
- "Voce nao precisa de mais tecnologia. Precisa de IA que FUNCIONA."

## Slide 3: Quem somos
- Influence Labs: boutique de agentes de IA para negocios de servicos
- Fundador: Victor Cruz — [bio curta]
- Metodologia: Pareto (500+ projetos) + UAOS (framework proprietario)
- Foco: resultados mensuraveis em 30 dias

## Slide 4: O que fazemos
- Agentes de IA para WhatsApp Business (API oficial Meta)
- Recepcionista IA | Vendedor IA | FAQ IA | Human Takeover
- Funciona 24/7 no seu numero, voce monitora e intervem

## Slide 5: Como funciona (diagrama visual)
- Discovery (1 semana) → Build (2 semanas) → Go-Live (1 semana)
- Em 30 dias seu agente esta operando com clientes reais

## Slide 6: Diferenciais
1. API oficial Meta — zero risco de banimento
2. Coexistencia — IA + humano no mesmo numero
3. Multi-agent — varios agentes especializados, nao chatbot generico
4. Auto-healing — IA que se corrige e melhora sozinha
5. 500+ projetos — metodologia validada (Pareto)

## Slide 7: Resultados comprovados
- +30-50% taxa de agendamento
- SLA < 1 minuto (vs 30-60min humano)
- Atendimento 24/7 (inclusive feriados)
- [Case study real quando disponivel]

## Slide 8: Para quem
- Saloes de beleza e barbearias
- Clinicas e consultorios
- Academias e studios
- Escritorios de servicos profissionais
- "Se voce atende pelo WhatsApp, a gente resolve."

## Slide 9: Investimento
- "A partir de R$ [DEFINIR]/mes"
- Setup + recorrente ou assinatura mensal
- ROI tipico: 3-6 meses
- Sem fidelidade longa

## Slide 10: Nosso Framework (UAOS)
- Unified Autonomous Operation System
- Nao e chatbot — e uma equipe de IA coordenada
- Arquitetura multi-agente com auto-healing
- "Seu time de IA aprende, melhora e escala"

## Slide 11: CTA
- "Vamos conversar?"
- QR code para WhatsApp
- Email: contato@influencelabs.com.br
- LinkedIn: [perfil]
```

### Task 4.3 — Template de relatorio mensal para cliente

**Criar em:** `docs/brand/templates/relatorio-mensal-cliente.md`

```markdown
# Relatorio Mensal — {{NOME_CLIENTE}}
**Periodo**: {{MES/ANO}}
**Preparado por**: Influence Labs

---

## Resumo Executivo
{{2-3 frases sobre performance do mes}}

## KPIs do Periodo

| Metrica | Meta | Realizado | vs. Mes Anterior |
|---------|------|-----------|-----------------|
| Mensagens recebidas | — | {{N}} | {{+/-X%}} |
| Mensagens respondidas pela IA | — | {{N}} ({{%}}) | {{+/-X%}} |
| Tempo medio resposta | < 1min | {{Xs}} | {{+/-}} |
| Agendamentos via IA | — | {{N}} | {{+/-X%}} |
| Taxa de agendamento | {{META}}% | {{REAL}}% | {{+/-}} |
| Escalacoes para humano | — | {{N}} ({{%}}) | {{+/-X%}} |
| Follow-ups enviados | — | {{N}} | — |
| Clientes reativados | — | {{N}} | — |
| Satisfacao (quando medida) | > 80% | {{%}} | {{+/-}} |

## Destaques do Mes
- {{Destaque positivo 1}}
- {{Destaque positivo 2}}
- {{Ponto de atencao, se houver}}

## Conversas Interessantes
{{2-3 exemplos de conversas bem-sucedidas (anonimizadas)}}

## Otimizacoes Realizadas
- {{Ajuste 1 nos prompts/fluxos}}
- {{Ajuste 2}}

## Recomendacoes para Proximo Mes
- {{Recomendacao 1}}
- {{Recomendacao 2}}

---
*Influence Labs — IA que trabalha pelo seu negocio*
```

---

## Parte 5: Empacotar UAOS

**Criar em:** `docs/brand/uaos-overview.md`

O agente deve ler `docs/raw-materials/notes.md` (especialmente linhas 1-400 sobre arquitetura UAOS) e criar um documento de 1-2 paginas que explique o UAOS de forma vendavel para clientes e parceiros:

```markdown
# UAOS — Unified Autonomous Operation System

## O que e
O UAOS e o framework proprietario da Influence Labs para criar equipes de IA coordenadas. Diferente de chatbots simples, o UAOS organiza multiplos agentes de IA que trabalham juntos como uma equipe real.

## Por que e diferente

### Chatbot tradicional:
- 1 bot, 1 funcao, regras fixas
- Quando nao sabe, trava
- Nao aprende, nao melhora sozinho
- "Desculpe, nao entendi. Digite 1 para X, 2 para Y"

### UAOS:
- Multiplos agentes especializados (recepcionista, vendedor, FAQ)
- Router inteligente que entende a intencao e direciona
- Auto-healing: se algo falha, o sistema se corrige
- Escala humana: quando precisa, chama voce
- Melhora continua: aprende com cada conversa

## Arquitetura (simplificada para cliente)

```text
Mensagem do cliente
       ↓
[Router IA] — Entende o que o cliente quer
       ↓
   ├── Quer agendar? → [Recepcionista IA] → Agenda automaticamente
   ├── Tem duvida? → [FAQ IA] → Responde com dados reais
   ├── Quer comprar? → [Vendedor IA] → Sugere e converte
   └── Situacao complexa? → [Voce] → Entra na conversa
```

## 5 Principios

1. **Memoria** — A IA lembra do historico de cada cliente
2. **Hierarquia** — Cada agente tem seu papel, ninguem faz tudo
3. **Proatividade** — A IA nao espera, ela age (follow-up, lembretes)
4. **Auto-correcao** — Se algo da errado, o sistema tenta consertar antes de escalar
5. **Controle humano** — Voce esta sempre no comando, a IA e sua equipe

## Para o cliente, isso significa:
- Atendimento que parece humano (porque sao VARIOS agentes especializados)
- Menos erros (cada agente foca no que sabe fazer)
- Mais vendas (agente de vendas proativo)
- Mais seguranca (voce monitora e intervem)
- Melhoria continua (sem voce precisar pedir)
```

**Nota para o agente**: Ler `notes.md` linhas 1-400 para extrair os 5 principios imutaveis do UAOS e traduzir de linguagem tecnica para linguagem de negocios. O documento acima e um MODELO — o agente deve refinar com base no conteudo real do notes.md.

---

# TRACK B: REFINAMENTO TECNICO

## Parte 6: Completar Workflows n8n

Os workflows JSON em `n8n-workflows/` estao ~70% completos. O agente deve:

### Task 6.1 — Refinar WF-01-router.json
- Adicionar o prompt completo do router (de `data/prompts/router-prompt.md`) no node HTTP Request
- Configurar corretamente o body do request para a API da Anthropic ou OpenAI
- Adicionar node de error handling com notificacao
- Adicionar node para salvar intencao classificada no conversation_history

### Task 6.2 — Refinar WF-02-receptionist.json
- Integrar a query de disponibilidade (`infra/check-availability.sql`) no node Postgres
- Adicionar o prompt completo da recepcionista com injection de {{AVAILABLE_SLOTS}}
- Adicionar logica de INSERT no appointments quando agendamento confirmado
- Adicionar logica de UPDATE para reagendamento/cancelamento
- Adicionar salvamento de conversa no historico

### Task 6.3 — Refinar WF-03-faq.json
- Implementar RAG basico: Function node que faz busca por keywords nos arquivos da KB
  (Nao precisa de vector DB para MVP — busca por texto simples e suficiente)
- Injetar resultados do RAG no prompt do FAQ
- Adicionar logica de confidence check (se LLM retorna confidence < 0.7, escalar para humano)
- Conectar ao WF-05 para escalacao

### Task 6.4 — Refinar WF-04-sales.json
- Adicionar query de historico do cliente (ultimo servico, ultima visita, frequencia)
- Injetar dados do cliente no prompt de vendas
- Adicionar logica de opt-out check (se opted_out = true, nao enviar)
- Adicionar log de mensagem proativa na tabela proactive_messages

### Task 6.5 — Refinar WF-05-human-takeover.json
- Configurar chamada real para API do Chatwoot (criar conversa + atribuir agente)
- Adicionar mensagem de transicao para o cliente
- Adicionar flag na conversation_history (agent = 'human_takeover')

### Task 6.6 — Refinar WF-06-cron-jobs.json
- Implementar check de frequencia: nao enviar se ja enviou msg proativa nos ultimos 7 dias
- Implementar check de opt-out
- Implementar horario seguro: nao enviar entre 20h e 8h
- Adicionar metricas: contar mensagens enviadas por tipo (lembrete, follow-up, reativacao)

**IMPORTANTE**: O agente deve pesquisar o formato JSON correto do n8n para:
- HTTP Request node (com headers, body, authentication)
- Postgres node (com query parametrizada)
- Function/Code node (JavaScript para logica customizada)
- Switch node (com condicoes)
- IF node (com expressoes)

---

## Parte 7: Implementar RAG Simples para FAQ

**Criar em:** `data/rag/`

Para o MVP, NAO precisamos de vector database. Implementar RAG simples:

### Task 7.1 — Criar script de busca na KB

**Criar em:** `data/rag/search-kb.js`

```javascript
// Script para n8n Function node
// Busca por keywords nos arquivos da KB
// Input: query (mensagem do cliente)
// Output: trechos relevantes da KB

function searchKB(query, kbContent) {
  // 1. Tokenizar query (split por espacos, remover stop words)
  // 2. Para cada arquivo da KB, calcular score de relevancia (keyword match)
  // 3. Retornar top 3 trechos mais relevantes
  // 4. Se nenhum trecho tem score > threshold, retornar null (trigger human takeover)
}
```

### Task 7.2 — Criar indice da KB

**Criar em:** `data/rag/kb-index.json`

Pre-processar os arquivos da KB em formato otimizado para busca:

```json
{
  "entries": [
    {
      "source": "services.md",
      "section": "Corte feminino",
      "content": "Corte feminino: R$ 80, 45min, profissionais Ana e Carla",
      "keywords": ["corte", "feminino", "cabelo", "preco", "valor", "quanto"]
    },
    // ... todas as entradas da KB indexadas
  ]
}
```

---

## Parte 8: Testes Automatizados

### Task 8.1 — Criar suite de testes para os prompts

**Criar em:** `tests/prompt-tests.json`

```json
{
  "router_tests": [
    {"input": "Quero marcar um horario", "expected_intent": "agendamento"},
    {"input": "Quanto custa corte?", "expected_intent": "faq"},
    {"input": "Vi a promocao, me conta", "expected_intent": "vendas"},
    {"input": "Ficou horrivel!", "expected_intent": "reclamacao"},
    {"input": "Quero falar com a dona", "expected_intent": "humano"},
    // ... 30+ testes
  ],
  "receptionist_tests": [
    {
      "input": "Quero cortar o cabelo amanha as 14h",
      "context": {"available_slots": ["14:00", "15:00", "16:00"]},
      "expected_contains": ["14h", "confirma"],
      "expected_not_contains": ["nao temos", "indisponivel"]
    },
    // ... 10+ testes
  ],
  "faq_tests": [
    {
      "input": "Voces aceitam pix?",
      "expected_contains": ["Pix", "sim"],
      "source": "faq.md"
    },
    // ... 10+ testes
  ]
}
```

### Task 8.2 — Criar script de teste

**Criar em:** `tests/run-prompt-tests.js`

Script Node.js que:
1. Carrega os testes de `prompt-tests.json`
2. Para cada teste, envia o prompt para a API do LLM (com o system prompt correspondente)
3. Verifica se a resposta contem os termos esperados
4. Gera relatorio de pass/fail
5. Calcula taxa de acerto por agente

```javascript
// Uso: node tests/run-prompt-tests.js --agent router --llm anthropic
// Output: relatorio com taxa de acerto e falhas detalhadas
```

---

## CHECKLIST DE ENTREGAVEIS

### Track A — Marca (10 arquivos)
- [ ] `docs/strategy/positioning.md` — Analise competitiva + posicionamento
- [ ] `docs/strategy/pricing-model.md` — 3 modelos de pricing com margem
- [ ] `docs/brand/brand-brief.md` — Brief completo para designer
- [ ] `docs/brand/landing-page-content.md` — Conteudo completo da landing page
- [ ] `docs/brand/templates/proposta-comercial.md` — Template de proposta
- [ ] `docs/brand/templates/apresentacao-institucional.md` — 10-12 slides
- [ ] `docs/brand/templates/relatorio-mensal-cliente.md` — Template relatorio
- [ ] `docs/brand/uaos-overview.md` — UAOS 1-2 pager vendavel

### Track B — Refinamento Tecnico (8+ arquivos)
- [ ] `n8n-workflows/WF-01-router.json` — ATUALIZADO com prompt completo
- [ ] `n8n-workflows/WF-02-receptionist.json` — ATUALIZADO com SQL + logica
- [ ] `n8n-workflows/WF-03-faq.json` — ATUALIZADO com RAG
- [ ] `n8n-workflows/WF-04-sales.json` — ATUALIZADO com historico + opt-out
- [ ] `n8n-workflows/WF-05-human-takeover.json` — ATUALIZADO com Chatwoot API
- [ ] `n8n-workflows/WF-06-cron-jobs.json` — ATUALIZADO com checks
- [ ] `data/rag/search-kb.js` — Script de busca RAG simples
- [ ] `data/rag/kb-index.json` — Indice pre-processado da KB
- [ ] `tests/prompt-tests.json` — Suite de testes (50+ cenarios)
- [ ] `tests/run-prompt-tests.js` — Script de teste automatizado

### Total: ~18 arquivos (10 novos + 6 atualizados + 2 testes)

---

## INSTRUCOES PARA O AGENTE EXECUTOR (CODEX)

1. **Leia PRIMEIRO**: Os arquivos de referencia listados no inicio, especialmente `notes.md` linhas 1-400 (UAOS)
2. **Track A e B sao independentes** — pode executar em qualquer ordem ou paralelo
3. **Pesquisa web necessaria**:
   - Concorrentes BR de AI services para `positioning.md`
   - Formato JSON de export do n8n v1.x (2026) para refinar workflows
   - API do Chatwoot para WF-05
   - API da Anthropic/OpenAI para configurar HTTP nodes
4. **Pricing**: Usar custos reais (VPS ~R$80, Meta ~R$80, LLM ~R$50, fee Pareto 25%) para calcular margens
5. **UAOS**: O documento deve traduzir linguagem tecnica (bicameral, auto-healing, DNA cloning) para linguagem de negocios que um dono de salao entenda
6. **Landing page**: O conteudo deve ser COMPLETO (copy final, nao bullet points vagos) — pronto para colar em qualquer page builder
7. **Workflows n8n**: Ao atualizar, manter retrocompatibilidade — nao quebrar o que ja funciona, adicionar o que falta
8. **Testes**: Os testes de prompt devem ser executaveis com `node tests/run-prompt-tests.js` (criar package.json se necessario)

---

## SEQUENCIA RECOMENDADA DE EXECUCAO

```
1. Ler referencias (30 min)
2. Track A - Parte 1: Posicionamento (pesquisa web + documento)
3. Track A - Parte 2: Brand brief
4. Track A - Parte 3: Landing page content (maior entrega de copy)
5. Track A - Parte 4: Templates comerciais (3 templates)
6. Track A - Parte 5: UAOS overview
7. Track B - Parte 6: Refinar workflows (6 JSONs)
8. Track B - Parte 7: RAG simples
9. Track B - Parte 8: Testes
```

---

*Plano criado por Atlas (analyst) em 2026-02-24*
*Continuacao do PLANO-DE-ACAO-INFLUENCE-LABS.md (Fase 1) e PLANO-FASE-2-DISCOVERY-E-BUILD.md (Fase 2)*
