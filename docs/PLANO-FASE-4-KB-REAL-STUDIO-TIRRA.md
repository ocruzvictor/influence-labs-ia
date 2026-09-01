# PLANO DE ACAO — Fase 4: KB Real Studio Tirra + Adaptacao Completa

**Data:** 2026-02-25
**Para:** Agente Codex executar autonomamente
**Pre-requisitos:** Fases 1-3 concluidas (63 arquivos). Dados reais do Studio Tirra disponíveis.

---

## CONTEXTO PARA O AGENTE EXECUTOR

### O que mudou (dados reais coletados):
O projeto beta NAO é um "salao generico". É o **Studio Tirra** em Sao Caetano do Sul/SP. Temos:
- Material bruto real em `docs/raw-materials/Studio Tirrá/`
- Prompts v1/v2 ja existentes (versoes Tess AI anteriores)
- 16 conversas WhatsApp "boas" + 12 "ruins" (classificadas pela equipe)
- Base de conhecimento da versao anterior (servicos, profissionais, matriz de atendimento)
- Discovery com o dono (Tiago) — respostas em `docs/PLANO-FASE-4-KB-REAL-STUDIO-TIRRA.md` (este arquivo, secao "Discovery")

### Mudanca critica de arquitetura:
- **Sistema de agenda**: Trinks (nao Google Calendar nem Postgres custom)
- **Supervisor/Escalacao**: a recepção (nao a "dona")
- **Dono**: Tiago Rocha (profissional premium + owner)
- **Classificacao de clientes**: Sistema de score (Bom >80%, Neutro 50-80%, Mau <50%)

### Arquivos de referencia obrigatorios:
1. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/` — KB anterior completa
2. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Promtp Atendente Tirra v1.txt` — Prompt anterior completo
3. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Promtp Atendente Tirra v2.txt` — Prompt anterior + agenda
4. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Serviços.pdf` — Lista completa de servicos
5. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Matriz de Atendimento Studio Tirrá.pdf` — Classificacao clientes
6. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Melhores Práticas - Segundo Gestor de Atendimento.pdf` — Regras operacionais
7. `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Estoque.pdf` — Produtos a venda
8. `docs/raw-materials/Studio Tirrá/Bons/` — 16 conversas boas (ler TODAS as .txt)
9. `docs/raw-materials/Studio Tirrá/Ruins/` — 12 conversas ruins (ler TODAS as .txt)
10. `data/kb/` — KB exemplo atual (sera SUBSTITUIDA)
11. `data/prompts/` — Prompts PACER atuais (serao ATUALIZADOS)

---

## DISCOVERY — RESPOSTAS COLETADAS DO TIAGO

### BLOCO 1: Servicos ✅
- Lista extraida do CSV/PDF do sistema AppBeleza/Trinks
- Tabela Premium (Tiago/Andre: 100% comissao) vs Padrao (equipe: 47% comissao)
- Combos: Cabelo+Barba, Mao+Pe
- 100+ servicos catalogados com preco e duracao

### BLOCO 2: Profissionais ✅
- Tiago (dono, premium), Andre (gestor, premium masculino), Erick, Eli, Maluzinha, Giovanna, Jackie, Fernanda
- Horarios: Terca-Sexta 09-19h, Sabado 09-18h
- Folgas/intervalos gerenciados via Trinks (aparecem como "Ausencia")
- Tiago folga quartas, almoco ~12-14h

### BLOCO 3: Agendamento ✅
- Sistema: Trinks (profissionais usam app proprio)
- Antecedencia ideal: 24h
- Tolerancia atraso: 15min (flexivel)
- Cancelamento: aviso previo 24h, sem taxa no-show (foco em confirmacao)
- Lista de espera: deve ser formalizada pela IA
- Horario: Ter-Sex 09-19h, Sab 09-18h
- Intervalo entre servicos: zero (agendamentos colados)

### BLOCO 4: Comunicacao (COMPLETAR COM DADOS DAS CONVERSAS)
- Tom: amigavel, levemente informal, objetivo, emojis moderados
- Nome agente: "Assistente Virtual Studio Tirra"
- Frases frequentes: EXTRAIR DAS CONVERSAS BOAS
- O que NUNCA dizer: EXTRAIR DAS CONVERSAS RUINS
- FAQ Top 10: EXTRAIR DAS CONVERSAS BOAS
- Reclamacoes: EXTRAIR DO PROMPT V1 (protocolo 4 passos) + CONVERSAS RUINS

### BLOCO 5: Vendas Proativas (parcial)
- Promocoes: precos reduzidos TERÇAS e QUARTAS
- Cross-sell: EXTRAIR DAS CONVERSAS BOAS (6 padroes identificados)
- Confirmacao: 1 dia antes + manha do dia (para agendamentos a tarde)
- Win-back: 45-60 dias sem visita
- Aniversario: acao na semana do aniversario (10% desconto, max R$30)

### BLOCO 6: Coexistencia
- Tiago aceita sugestoes de regras — DEFINIR DEFAULTS INTELIGENTES

---

## PARTE 1: SUBSTITUIR KB EXEMPLO POR KB REAL

Substituir TODOS os arquivos em `data/kb/` com dados reais do Studio Tirra.

### Task 1.1 — `data/kb/salon-info.md` (REESCREVER)

```markdown
# Studio Tirra — Informacoes Gerais

## Identidade
- **Nome:** Studio Tirra
- **Endereco:** Rua Espirito Santo, 385 — Santo Antonio, Sao Caetano do Sul — SP, CEP 09530-700
- **Google Maps:** [link a definir]
- **Estacionamento:** Sim, no local. Subir rampa lateral.
- **Instagram:** @studiotirra

## Horario de Funcionamento
- Terca a Sexta: 09h as 19h
- Sabado: 09h as 18h
- Domingo e Segunda: FECHADO
- **Almoco:** Horario varia por profissional (geralmente ~12:50-13:50, aparece como "Ausencia" no Trinks)

## Formas de Pagamento
- Cartao de credito/debito
- PIX
- Dinheiro
- Parcelamento disponivel para alguns servicos (ex: Visagismo 3x sem juros)

## Contato
- WhatsApp: [numero]
- Supervisor de atendimento: a recepção

## Mensagem Fora do Horario
"Ola! Que bom que voce entrou em contato! No momento nao estamos disponiveis. Nosso atendimento no WhatsApp e de terca a sexta das 9h as 19h e de sabado das 9h as 18h. Gostaria de adiantar o assunto? Assim que possivel responderemos!"
```

### Task 1.2 — `data/kb/services.md` (REESCREVER)

Ler `docs/raw-materials/Studio Tirrá/Base de Conhecimento/Serviços.pdf` e criar tabela completa organizada por categoria:

**Categorias (manter a estrutura do PDF):**
1. Cabelo — Cortes
2. Cabelo — Tiago Premium (precos diferenciados)
3. Barba
4. Coloracao
5. Alisamento/Progressiva
6. Escova/Styling
7. Tratamentos Capilares
8. Unhas (Manicure/Pedicure/Alongamento)
9. Sobrancelha/Cilios/Rosto
10. Depilacao
11. Massagem/Corpo
12. Consultoria (Visagismo/Avaliacao)
13. Outros

**Para CADA servico incluir:** Nome | Preco (R$) | Duracao (min) | Profissionais habilitados

**Regras especiais de pricing a documentar:**
- Tiago e Andre cobram tabela Premium para servicos masculinos (Corte M R$100 vs R$85)
- Terca e Quarta: precos promocionais (valores reduzidos)
- Servicos gratuitos: Corte de franja, Teste de mechas, Avaliacao, Futura mamae, Tratamento retorno mechas

**Regras de venda consultiva (NAO revelar preco direto):**
- **Visagismo (R$750):** Iniciar fluxo consultivo. Perguntar o que o cliente busca, explicar beneficios, SO DEPOIS revelar preco + opcao de parcelamento 3x
- **Mechas (R$835+):** Iniciar com "Teste de Mechas" gratuito. "Para garantir o melhor resultado e a saude do seu cabelo, nosso primeiro passo e sempre um teste de mechas. Ele e gratuito e sem compromisso."

### Task 1.3 — `data/kb/professionals.md` (REESCREVER)

```markdown
# Profissionais — Studio Tirra

| Nome | Funcao | Especialidades | Horario | Dias | Obs |
|------|--------|---------------|---------|------|-----|
| Tiago Rocha | Dono / Hair Stylist Premium | Corte, coloracao, mechas, visagismo | 09-19h | Ter,Qui,Sex,Sab | Folga quarta. Almoco ~12-14h. Tabela Premium. |
| Andre de Oliveira | Gestor / Barbeiro Premium | Corte masc, barba, visagismo | 09-19h | Ter-Sex, Sab 09-18h | Tabela Premium p/ servicos masculinos. |
| Erick Barros | Barbeiro | Corte masc, barba | 09-19h | Ter-Sex, Sab 09-18h | — |
| Eli (Eliane Santana) | Hair Stylist | Corte, escova, coloracao | 09-19h | Ter-Sex, Sab 09-18h | — |
| Maluzinha (Maria Luiza) | Manicure/Nail Designer | Manicure, pedicure, alongamento | 09-19h | Ter-Sex, Sab 09-18h | — |
| Giovanna Ferraz | Esteticista/Sobrancelha | Design sobrancelha, lash lifting, depilacao | 09-19h | Ter-Sex, Sab 09-18h | — |
| Jackie (Jaqueline Aprigio) | Manicure | Manicure, pedicure | 09-19h | Ter-Sex, Sab 09-18h | — |
| Fernanda de Sousa (Fefe) | Hair Stylist | Corte, escova, tratamentos | 09-19h | Ter-Sex, Sab 09-18h | — |

**Nota:** Folgas e intervalos de almoco de cada profissional sao gerenciados via Trinks e aparecem como "Ausencia" na agenda. Consultar Trinks para disponibilidade real.
```

### Task 1.4 — `data/kb/scheduling-rules.md` (REESCREVER)

```markdown
# Regras de Agendamento — Studio Tirra

## Horarios
- Terca a Sexta: 09h-19h
- Sabado: 09h-18h
- Domingo e Segunda: FECHADO

## Regras Gerais
- Antecedencia ideal: 24 horas
- Tolerancia de atraso: 15 minutos (flexivel, proativo — avisar cliente para dirigir com seguranca)
- Intervalo entre servicos: ZERO (agendamentos colados)
- Sistema de agenda: Trinks (profissionais consultam via app)

## Cancelamento e Reagendamento
### Clientes Bons (score >80%):
- Cancelamento >24h: "Sem problemas! Agradecemos por avisar. Quer agendar outro horario?"
- Atraso: "Obrigado por avisar! Ja notifiquei o profissional. Dirija com seguranca!"

### Clientes em Observacao (score <50%):
- Cancelamento <24h: "Conforme nossa politica, cancelamentos com menos de 24h implicam perda do sinal."
- Deposito: 50% do valor via PIX, link valido por 30 minutos
- Tolerancia atraso: 15 minutos MAX, apos isso cancelamento automatico

## Lista de Espera
- Se nao houver horario, oferecer lista de espera
- "Vou te colocar na lista de espera. Assim que abrir uma vaga, te aviso!"
- Notificar proativamente quando slot abrir (pattern observado nas conversas boas)

## Confirmacao (OBRIGATORIO)
1. Confirmacao 1 dia antes: "[Nome], dia [data] as [hora] com [profissional] para [servico]. Posso confirmar?"
2. Lembrete na manha do dia (para agendamentos a tarde)
3. Confirmacao tripla: "So para confirmar: [servico] com [profissional] no dia [data] as [hora]. Correto?"

## Mensagem de Confirmacao Final (template)
"Ola, [Nome]! Voce tem um encontro marcado com [profissional] no dia [data] as [hora] para [servico] no Studio Tirra!
Endereco: Rua Espirito Santo, 385 — Santo Antonio, Sao Caetano do Sul
Estacionamento: Sim, subir rampa lateral
Valor: R$ [valor]
Posso confirmar seu agendamento?"

## Dados para Novos Clientes (coleta obrigatoria)
- Nome completo
- Celular
- Email
- Data de nascimento
- Servico desejado
- Profissional preferido
- Instagram (opcional)
```

### Task 1.5 — `data/kb/faq.md` (REESCREVER com dados reais)

Criar FAQ baseado nas conversas reais + prompt v1. Top 20 perguntas:

```markdown
# FAQ — Studio Tirra

## Perguntas Frequentes

### 1. Quanto custa o corte masculino?
"O corte masculino com a equipe e R$ 85. Com o Tiago ou Andre (tabela premium) e R$ 100. As tercas e quartas temos precos promocionais!"

### 2. Quanto custa o corte feminino?
"O corte feminino com a equipe e R$ 180. Com o Tiago e R$ 190."

### 3. Quanto custa cabelo e barba?
"O combo cabelo + barba e R$ 130 com a equipe e R$ 155 com o Tiago."

### 4. Tem horario para [dia]?
"Vou verificar os horarios disponiveis! Com qual profissional voce gostaria?"

### 5. Qual o endereco?
"Estamos na Rua Espirito Santo, 385 — Santo Antonio, Sao Caetano do Sul. Tem estacionamento no local, e so subir a rampa lateral!"

### 6. Tem estacionamento?
"Sim! Temos estacionamento no local. E so subir a rampa lateral."

### 7. Aceitam PIX?
"Sim! Aceitamos PIX, cartao de credito/debito e dinheiro."

### 8. Qual o horario de funcionamento?
"Terca a sexta das 9h as 19h e sabado das 9h as 18h."

### 9. Posso remarcar meu horario?
"Claro! Sem problema nenhum. Qual outro dia e horario fica bom pra voce?"

### 10. Quanto custa visagismo?
⚠️ RESPOSTA CONSULTIVA (NAO revelar preco direto):
"Que otima escolha! O visagismo e uma consultoria completa que analisa seu rosto, estilo de vida e personalidade para encontrar o visual perfeito pra voce. Inclui corte, barba e sobrancelha. Posso te contar mais sobre como funciona?"
[Apos explicar beneficios]: "O investimento e R$ 750, com opcao de parcelamento em 3x sem juros."

### 11. Quanto custam as mechas?
⚠️ RESPOSTA CONSULTIVA (NAO revelar preco direto):
"Para garantir o melhor resultado e a saude do seu cabelo, nosso primeiro passo e sempre um teste de mechas. Ele e GRATUITO e sem compromisso! Que tal agendarmos?"
[So revelar preco R$835+ apos teste]

### 12. Qual o Instagram do profissional?
"Posso te passar o Instagram do [profissional] pra voce ver o trabalho! [link]"

### 13. Meu [familiar] pode agendar tambem?
"Claro! Ficaremos felizes em atender! Qual servico ele(a) gostaria?"

### 14. Voces atendem criancas?
"Sim! Temos corte infantil masculino (R$ 85) e feminino (R$ 180)."

### 15. Posso encaixar outro servico no mesmo horario?
"Vou verificar se da pra encaixar! Depende da disponibilidade do profissional e do tempo."

### 16. Voces vendem produtos?
"Sim! Temos produtos da BOAZ, Don Alcides (barba), e outros. Posso te contar mais sobre alguma linha?"

### 17. Tem promocao?
"Tercas e quartas temos precos promocionais em varios servicos! Quer saber os valores?"

### 18. Quem e o melhor profissional para [servico]?
[Escalar para a recepção — recomendacao subjetiva demais para IA]
"Todos os nossos profissionais sao otimos! Mas para te indicar o ideal pro seu caso, vou passar para a recepção que pode te orientar melhor."

### 19. Parcelam?
"Alguns servicos como o Visagismo podem ser parcelados em 3x sem juros. Para outros servicos, aceitamos cartao de credito."

### 20. Quero falar com uma pessoa / com a recepção / com o Tiago
[ESCALACAO IMEDIATA]
"Claro! Vou te transferir agora mesmo."
```

### Task 1.6 — `data/kb/sales.md` (REESCREVER com dados reais)

```markdown
# Vendas Proativas — Studio Tirra

## Promocoes Ativas
- TERCAS e QUARTAS: precos reduzidos em servicos selecionados
- Formato: "Sabia que tercas e quartas temos precos especiais? O [servico] sai por R$ [preco promo]!"

## Cross-sell (6 padroes identificados em conversas reais)

### Padrao 1: Add-on durante visita
- Trigger: Cliente ja tem agendamento
- Tecnica: "Aproveitando que voce ja vai estar aqui..."
- Exemplos reais: Manicure → sobrancelha, Corte → barba, Cabelo → franja

### Padrao 2: Referencia familiar
- Trigger: Cliente menciona familiar ou traz junto
- Tecnica: "Seu [familiar] gostaria de agendar tambem?"
- Exemplos reais: Esposa, marido, filho, noiva, mae

### Padrao 3: Aniversario
- Trigger: Semana do aniversario (dados no cadastro)
- Template: "Feliz Aniversario, [Nome]! 🎂 O Studio Tirra tem um presente especial: 10% de desconto (limitado a R$30,00) no servico que voce desejar. Valido por 30 dias!"

### Padrao 4: Campanha sazonal
- Trigger: Datas comemorativas (Dia das Maes, Natal, etc)
- Tecnica: Broadcast com oferta especial

### Padrao 5: Upsell premium
- Trigger: Cliente mostra interesse em mudanca visual
- Tecnica: Abordagem consultiva + portfolio Instagram + explicacao detalhada
- Exemplos: Corte basico → Visagismo (R$750), Coloracao simples → Mechas completas

### Padrao 6: Notificacao proativa de slot
- Trigger: Cancelamento abre vaga para profissional disputado
- Tecnica: "Abriu um horario com o Tiago! Quer aproveitar?"

## Follow-up
- Confirmacao: 1 dia antes do agendamento
- Lembrete extra: Manha do dia (para agendamentos a tarde)

## Win-back (clientes inativos)
- 45-60 dias sem visita: mensagem de reativacao
- Tom: gentil, nao insistente
- Template: "Oi, [Nome]! Faz um tempinho que voce nao aparece por aqui. Que tal agendar seu [ultimo servico]? Temos horarios essa semana!"
- REGRA: Se cliente nao responder em 7 dias, nao insistir

## Regras de Seguranca
- Maximo 1 mensagem proativa por semana por cliente
- NAO enviar entre 20h e 8h
- Respeitar opt-out ("nao quero receber", "para")
- NUNCA upsell durante momento de frustracao
- NUNCA insistir se cliente disse nao
```

### Task 1.7 — NOVO: `data/kb/products.md`

Criar arquivo NOVO com catalogo de produtos a venda, extraido de `Estoque.pdf`:
- Don Alcides (barba): Balm, Leave-in, Pomada, Shampoo — R$60-160
- BOAZ (cabelo): Shampoo, Mascara, Leave-in, Nano Olium — R$105-299
- Alice da Venda (aromas): Difusores, Velas — R$67-110
- Bebidas: Cafe R$3, Refrigerante R$6, Heineken R$12, RedBull R$15, Whey R$10
- Outros: Perfume cabelo, protetor solar, gel sobrancelha

### Task 1.8 — NOVO: `data/kb/client-classification.md`

Criar arquivo NOVO com sistema de classificacao de clientes:

```markdown
# Classificacao de Clientes — Studio Tirra

## Score de Cliente
- **Bom (>80%):** VIP — tom caloroso, encaixes permitidos, flexibilidade, emojis OK
- **Neutro (50-80%):** Padrao — reclassificar conforme comportamento
- **Mau (<50%):** Barreiras — tom formal, sem encaixes, deposito 50%, tolerancia 15min MAX

## Indicadores de Bom Cliente
- Frequencia >95% comparecimento
- Reagendamento com >24h antecedencia
- Comunicacao cordial, respostas rapidas
- Historico de fidelidade

## Indicadores de Mau Cliente
- Agendamentos esporadicos com no-shows
- Cancelamento no mesmo dia
- Tom imperativo/monossilabico
- Ignora confirmacoes
- Reclamacoes pos-servico via mensagem

## Novo Cliente
- Primeira mensagem clara/educada → tratar como potencial Bom (VIP inicial)
- Primeira mensagem vaga/urgente → tratar como potencial Mau (barreiras sutis + cadastro + deposito)

## Regras Eticas (LGPD)
- Classificacao baseada APENAS em comportamento de agendamento
- NUNCA por caracteristicas pessoais
- Direito a revisao: sem "blacklist" permanente
- Reavaliacao periodica
```

---

## PARTE 2: ATUALIZAR PROMPTS PACER COM DADOS REAIS

### Task 2.1 — `data/prompts/router-prompt.md` (ATUALIZAR)

Manter estrutura PACER mas atualizar com:
- Categorias do Studio Tirra: agendamento, faq, vendas, reclamacao, humano
- Adicionar regra: se cliente menciona "deposito" ou questiona politica → classificar como "humano"
- Adicionar regra: 3+ tentativas de reagendamento na mesma conversa → "humano"
- Adicionar regra: keywords de escalacao do prompt v1: "decepcionado", "problema", "nao gostei", "horrivel"

### Task 2.2 — `data/prompts/receptionist-prompt.md` (REESCREVER)

Incorporar do prompt v1 do Studio Tirra:
- **Persona**: Assistente Virtual Studio Tirra (empatico, proativo, consultivo)
- **Protocolo de saudacao**: "Ola! Tudo bem?" + identificar se novo ou recorrente
- **Confirmacao tripla** obrigatoria
- **Mensagem final** com endereco + estacionamento + valor
- **Resolucao de conflitos**: NUNCA resolver sozinho, escalar para a recepção
- **Tom adaptativo**: caloroso para bons clientes, formal para maus clientes
- **Frases reais extraidas das conversas boas**:
  - "Vou verificar os horarios disponiveis"
  - "Agendado! Te esperamos no dia [data]!"
  - "Sem problema nenhum!"
  - "Ficamos te esperando!"
  - "Qualquer coisa, estamos a disposicao!"
- **Dados para novos clientes**: Nome, celular, email, data nascimento, servico, profissional, Instagram

### Task 2.3 — `data/prompts/faq-prompt.md` (ATUALIZAR)

Incorporar regras especiais:
- **Visagismo**: NUNCA revelar preco direto. Fluxo consultivo primeiro.
- **Mechas**: NUNCA revelar preco direto. Oferecer teste gratuito primeiro.
- **Recomendacao de profissional**: Escalar para a recepção (subjetivo demais)
- Respostas VERBATIM da KB quando possivel

### Task 2.4 — `data/prompts/sales-prompt.md` (ATUALIZAR)

Incorporar os 6 padroes reais de cross-sell + regras de aniversario com template real.

### Task 2.5 — NOVO: `data/prompts/anti-patterns.md`

Criar documento com as 12 regras "NUNCA FAZER" extraidas das conversas ruins:

```markdown
# O que NUNCA Fazer — Studio Tirra

## Regras Absolutas (extraidas de falhas reais)

1. **NUNCA responder "Ah, que bom!" a emergencia medica.** Sempre expressar preocupacao genuina primeiro.

2. **NUNCA pedir dados cadastrais de cliente recorrente.** O sistema deve reconhecer clientes que ja vieram.

3. **NUNCA minimizar a necessidade do cliente** (chamar de "corte comum" algo especifico). Validar sempre.

4. **NUNCA cobrar por servico nao realizado.** Verificar historico antes de cobrar.

5. **NUNCA enviar horario errado na confirmacao.** Verificar dados antes de enviar.

6. **NUNCA pedir que o cliente mude horario confirmado para conveniencia do salao.** Especialmente no mesmo dia.

7. **NUNCA disparar autoresponder no meio de conversa ativa.** Detectar conversa ativa e suprimir.

8. **NUNCA demorar tanto que o cliente perca o horario.** Responder em minutos, nao horas.

9. **NUNCA fazer upsell durante momento de frustracao.**

10. **NUNCA dar horario recorrente de cliente para outro sem avisar primeiro.**

11. **NUNCA dar informacoes contraditorias sobre disponibilidade** (12h, nao 13h, nao 12h de novo).

12. **NUNCA priorizar cobranca sobre empatia em momentos delicados** (cliente no hospital, luto, etc).

## Gatilhos de Escalacao Imediata para a recepção
- Qualquer reclamacao, feedback negativo ou insatisfacao
- Keywords: "decepcionado", "problema", "nao gostei", "horrivel", "absurdo"
- Conflito de agenda (dois clientes no mesmo slot)
- Pedido para falar com pessoa: "Quero falar com uma pessoa", "Posso falar com a recepção?"
- 3+ tentativas de reagendamento na mesma conversa
- Agendamento complexo (multiplos profissionais na mesma visita)
- Pergunta nao coberta na FAQ apos 2 tentativas
- Cliente questionando politica de deposito com insistencia
- Conversa em loop de indecisao por 5+ mensagens
```

---

## PARTE 3: ADAPTAR ARQUITETURA PARA TRINKS

### Task 3.1 — Pesquisar API do Trinks

O agente deve pesquisar na web:
- Trinks tem API publica? REST? GraphQL?
- Documentacao oficial: https://trinks.com ou docs
- Endpoints necessarios:
  - GET disponibilidade (slots livres por profissional/data)
  - POST criar agendamento
  - GET agendamentos existentes (para confirmar)
  - GET dados do cliente (para reconhecer recorrentes)
- Autenticacao: API key? OAuth?
- Rate limits?

**Criar em:** `docs/research/trinks-api-research.md`

### Task 3.2 — Atualizar schema.sql

Se Trinks tem API:
- REMOVER tabela `appointments` (Trinks gerencia)
- MANTER tabela `clients` (cache local + score de classificacao)
- MANTER tabela `conversation_history` (contexto para LLM)
- MANTER tabela `proactive_messages` (controle de frequencia)
- MANTER tabela `metrics` (KPIs)
- ADICIONAR tabela `client_scores` para classificacao Bom/Neutro/Mau

**Atualizar em:** `infra/schema.sql`

### Task 3.3 — Atualizar workflows n8n

Para cada workflow, substituir nodes Postgres de agenda por chamadas HTTP para API do Trinks:

- **WF-01 Router**: Sem mudanca (nao consulta agenda)
- **WF-02 Recepcionista**: Substituir `check-availability.sql` por HTTP Request para Trinks API
- **WF-03 FAQ**: Sem mudanca
- **WF-04 Vendas**: Atualizar para consultar historico do Trinks (ultimo servico, ultima visita)
- **WF-05 Human Takeover**: Sem mudanca
- **WF-06 Cron Jobs**: Atualizar para consultar agendamentos do Trinks (lembretes, follow-up)

**Se Trinks NAO tiver API publica:**
- Documentar alternativas (webhook, scraping, manual sync)
- Considerar integracao via Zapier/Make se Trinks suportar
- Worst case: manter agenda manual com input da recepção via Chatwoot

**Atualizar em:** `n8n-workflows/WF-02-receptionist.json`, `WF-04-sales.json`, `WF-06-cron-jobs.json`

---

## PARTE 4: ATUALIZAR RAG E TESTES

### Task 4.1 — Atualizar `data/rag/kb-index.json`

Reindexar com dados reais do Studio Tirra (100+ servicos, 8 profissionais, 20+ FAQs, produtos).
O indice deve crescer de ~15 entradas para 150+ entradas.

### Task 4.2 — Atualizar `tests/prompt-tests.json`

Substituir cenarios genericos por cenarios reais do Studio Tirra:

```json
{
  "router_tests": [
    {"input": "Quanto custa corte com o Tiago?", "expected_intent": "faq"},
    {"input": "Tem horario quinta com o Andre?", "expected_intent": "agendamento"},
    {"input": "Vi a promocao de terca, me conta", "expected_intent": "vendas"},
    {"input": "O corte ficou horrivel", "expected_intent": "reclamacao"},
    {"input": "Quero falar com a recepção", "expected_intent": "humano"},
    {"input": "Quanto custa visagismo?", "expected_intent": "faq"},
    {"input": "Posso remarcar pra sabado?", "expected_intent": "agendamento"}
  ],
  "receptionist_tests": [
    {"input": "Quero cortar cabelo e barba quinta as 14h com o Tiago", ...},
    {"input": "Tiago ta de folga quarta? Tem outro barbeiro?", ...}
  ]
}
```

Manter os 62 cenarios existentes + adicionar 20+ cenarios especificos do Studio Tirra.

---

## CHECKLIST DE ENTREGAVEIS

### KB Real (`data/kb/`) — 8 arquivos (6 reescritos + 2 novos)
- [ ] `salon-info.md` — REESCRITO com dados Studio Tirra
- [ ] `services.md` — REESCRITO com 100+ servicos reais
- [ ] `professionals.md` — REESCRITO com 8 profissionais reais
- [ ] `scheduling-rules.md` — REESCRITO com regras reais + classificacao
- [ ] `faq.md` — REESCRITO com 20 FAQs reais + regras consultivas
- [ ] `sales.md` — REESCRITO com 6 padroes cross-sell + templates reais
- [ ] `products.md` — NOVO: catalogo de produtos a venda
- [ ] `client-classification.md` — NOVO: sistema de score Bom/Neutro/Mau

### Prompts Atualizados (`data/prompts/`) — 5 arquivos (4 atualizados + 1 novo)
- [ ] `router-prompt.md` — ATUALIZADO com keywords escalacao Studio Tirra
- [ ] `receptionist-prompt.md` — REESCRITO com tom/frases reais + confirmacao tripla
- [ ] `faq-prompt.md` — ATUALIZADO com regras consultivas (visagismo, mechas)
- [ ] `sales-prompt.md` — ATUALIZADO com 6 padroes cross-sell reais
- [ ] `anti-patterns.md` — NOVO: 12 regras "nunca fazer"

### Pesquisa Trinks (`docs/research/`)
- [ ] `trinks-api-research.md` — Pesquisa API + endpoints + alternativas

### Arquitetura atualizada
- [ ] `infra/schema.sql` — ATUALIZADO (remover appointments se Trinks gerencia)
- [ ] `n8n-workflows/WF-02-receptionist.json` — ATUALIZADO para Trinks
- [ ] `n8n-workflows/WF-04-sales.json` — ATUALIZADO para Trinks
- [ ] `n8n-workflows/WF-06-cron-jobs.json` — ATUALIZADO para Trinks

### RAG e Testes
- [ ] `data/rag/kb-index.json` — ATUALIZADO com 150+ entradas reais
- [ ] `tests/prompt-tests.json` — ATUALIZADO com cenarios Studio Tirra

### Total: ~18 arquivos (8 KB + 5 prompts + 1 pesquisa + 3 workflows + 1 schema + 1 RAG + 1 testes) → maioria sao ATUALIZACOES, nao arquivos novos

---

## INSTRUCOES PARA O AGENTE EXECUTOR (CODEX)

1. **Leia PRIMEIRO todos os arquivos em `docs/raw-materials/Studio Tirrá/Base de Conhecimento/`** — especialmente os prompts v1/v2 e o PDF de servicos
2. **Leia as conversas boas** em `docs/raw-materials/Studio Tirrá/Bons/` — extrair tom, frases, padroes
3. **Leia as conversas ruins** em `docs/raw-materials/Studio Tirrá/Ruins/` — extrair anti-padroes
4. **NAO invente dados** — tudo deve vir dos materiais brutos ou da discovery
5. **Precos EXATOS** do PDF de servicos — nao arredondar
6. **Tom de voz** deve ser extraido das conversas reais, nao inventado
7. **Visagismo e Mechas**: respeitar fluxo consultivo (NAO revelar preco direto)
8. **Trinks**: se nao encontrar API publica, documentar alternativas e seguir com arquitetura que funcione sem API
9. **Prompts v1/v2 do Studio Tirra sao REFERENCIA** — nao copiar integralmente, mas incorporar as regras e protocolos que sao bons
10. **Manter retrocompatibilidade** nos workflows — atualizar, nao quebrar

---

*Plano criado por Atlas (analyst) em 2026-02-25*
*Baseado em: Discovery real com Tiago, 28 conversas WhatsApp reais, KB anterior completa, prompts v1/v2*
