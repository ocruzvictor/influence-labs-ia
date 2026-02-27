# PLANO DE ACAO — Fase 2: Discovery + Arquitetura + Build

**Data:** 2026-02-24
**Para:** Agente Codex executar autonomamente
**Pre-requisito concluido:** Squad `salon-whatsapp` criado em `.aios-core/squads/salon-whatsapp/` (20 arquivos, 100% do plano Fase 1)

---

## CONTEXTO PARA O AGENTE EXECUTOR

### O que ja foi feito (NAO repetir):
- Pesquisa completa de mercado, stack, custos (em `docs/research/`)
- Squad AIOS criado com 4 agentes, 10 tasks, 2 workflows, 3 templates
- Decisao de stack: Evolution API (Cloud API) + n8n + Chatwoot + Claude/GPT

### O que falta (escopo DESTE plano):
A Fase 1 criou a ESTRUTURA (esqueleto). Agora precisamos criar o CONTEUDO real — os prompts, a KB, os workflows n8n exportaveis, os configs Docker, tudo que um dev precisa para deployar o sistema.

### Arquivos de referencia obrigatorios:
1. `.aios-core/squads/salon-whatsapp/` — Squad completo (ler squad.yaml + todos os tasks)
2. `docs/research/stack-tecnica-projeto-salao.md` — Stack decidida e arquitetura multi-agent
3. `docs/research/analise-complementar-novos-docs.md` — Metodo Pareto, sprints, cases reais
4. `docs/research/influence-labs-foundation-report.md` — Contexto geral

---

## PARTE 1: PREPARAR INFRAESTRUTURA DE DEPLOY

### Task 1.1 — Criar docker-compose.yml da stack completa

**Criar em:** `infra/docker-compose.yml`

O compose deve subir TODA a stack em um unico comando `docker-compose up -d`:

```yaml
# Servicos obrigatorios:
services:
  # 1. Evolution API (gateway WhatsApp)
  evolution-api:
    image: atendai/evolution-api:latest
    ports: ["8080:8080"]
    environment:
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/evolution
      - RABBITMQ_ENABLED=false
      # IMPORTANTE: Modo Cloud API, NAO Baileys
      - PROVIDER_ENABLED=true
      - PROVIDER_HOST=https://graph.facebook.com
      - PROVIDER_PREFIX=v21.0
    depends_on: [postgres, redis]

  # 2. n8n (orquestrador de workflows)
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=postgres
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - WEBHOOK_URL=https://${DOMAIN}/n8n/
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n

  # 3. Chatwoot (CRM + inbox + human takeover)
  chatwoot:
    image: chatwoot/chatwoot:latest
    ports: ["3000:3000"]
    environment:
      - RAILS_ENV=production
      - SECRET_KEY_BASE=${CHATWOOT_SECRET}
      - FRONTEND_URL=https://${DOMAIN}
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/chatwoot
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  # 4. Typebot (fluxos estruturados — opcional)
  typebot-builder:
    image: baptistearno/typebot-builder:latest
    ports: ["3001:3000"]
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/typebot
      - NEXTAUTH_URL=https://${DOMAIN}:3001
      - ENCRYPTION_SECRET=${TYPEBOT_ENCRYPTION_SECRET}

  typebot-viewer:
    image: baptistearno/typebot-viewer:latest
    ports: ["3002:3000"]
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/typebot
      - NEXTAUTH_URL=https://${DOMAIN}:3001

  # 5. Postgres (banco principal)
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      # Script de init cria os bancos necessarios
      - ./init-databases.sql:/docker-entrypoint-initdb.d/init.sql

  # 6. Redis (cache + filas)
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  n8n_data:
  postgres_data:
  redis_data:
```

**IMPORTANTE:** Pesquisar as versoes ATUAIS das imagens Docker de cada servico (fev 2026) antes de escrever o compose final. As versoes acima sao referencias — o agente deve verificar no Docker Hub ou docs oficiais quais sao as tags mais recentes e estaveis.

### Task 1.2 — Criar script de inicializacao de bancos

**Criar em:** `infra/init-databases.sql`

```sql
CREATE DATABASE evolution;
CREATE DATABASE n8n;
CREATE DATABASE chatwoot;
CREATE DATABASE typebot;
```

### Task 1.3 — Criar arquivo .env.example

**Criar em:** `infra/.env.example`

```env
# === DOMINIO ===
DOMAIN=api.seudominio.com.br

# === POSTGRES ===
POSTGRES_PASSWORD=TROCAR_SENHA_FORTE

# === EVOLUTION API ===
EVOLUTION_API_KEY=TROCAR_CHAVE_API

# === META WHATSAPP (Cloud API) ===
META_APP_ID=
META_APP_SECRET=
META_PHONE_NUMBER_ID=
META_BUSINESS_ACCOUNT_ID=
META_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=TROCAR_TOKEN_VERIFICACAO

# === N8N ===
N8N_USER=admin
N8N_PASSWORD=TROCAR_SENHA_FORTE
N8N_ENCRYPTION_KEY=TROCAR_CHAVE_32_CHARS

# === CHATWOOT ===
CHATWOOT_SECRET=TROCAR_CHAVE_SECRETA

# === TYPEBOT ===
TYPEBOT_ENCRYPTION_SECRET=TROCAR_CHAVE_SECRETA

# === LLM ===
ANTHROPIC_API_KEY=sk-ant-TROCAR
OPENAI_API_KEY=sk-TROCAR
```

### Task 1.4 — Criar nginx reverse proxy config

**Criar em:** `infra/nginx/default.conf`

Configurar subdomains ou paths para cada servico:
- `api.dominio.com` → Evolution API (8080)
- `n8n.dominio.com` → n8n (5678)
- `chat.dominio.com` → Chatwoot (3000)
- `bot.dominio.com` → Typebot viewer (3002)

Incluir SSL via Certbot/Let's Encrypt.

### Task 1.5 — Criar script de deploy

**Criar em:** `infra/deploy.sh`

```bash
#!/bin/bash
# Deploy completo da stack Influence Labs
# Uso: ./deploy.sh

set -e

echo "=== Influence Labs — Deploy Stack Salao ==="

# 1. Verificar pre-requisitos
command -v docker >/dev/null 2>&1 || { echo "Docker nao instalado"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose nao instalado"; exit 1; }

# 2. Verificar .env
if [ ! -f .env ]; then
  echo "Arquivo .env nao encontrado. Copie .env.example para .env e preencha."
  exit 1
fi

# 3. Subir stack
docker-compose up -d

# 4. Aguardar servicos
echo "Aguardando servicos iniciarem..."
sleep 30

# 5. Verificar saude
echo "=== Status dos servicos ==="
docker-compose ps

# 6. Testar endpoints
echo "=== Testando endpoints ==="
curl -s -o /dev/null -w "Evolution API: %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "n8n: %{http_code}\n" http://localhost:5678/
curl -s -o /dev/null -w "Chatwoot: %{http_code}\n" http://localhost:3000/

echo "=== Deploy completo! ==="
```

---

## PARTE 2: CRIAR KNOWLEDGE BASE SIMULADA

Como o Sprint 0 (Discovery com cliente) depende de reuniao presencial com a dona do salao, o agente deve criar uma **KB de exemplo realista** que sirva como:
1. Template funcional para Victor preencher com dados reais
2. Base para testar os workflows antes do go-live

### Task 2.1 — Criar KB de exemplo

**Criar em:** `data/kb/` (6 arquivos conforme template em `.aios-core/squads/salon-whatsapp/templates/salon-kb-template.md`)

#### `data/kb/salon-info.md`
- Nome ficticio: "Salao Bella Vida"
- Endereco: Rua Example, 123 — Bairro Centro
- Horario: Seg-Sex 9h-19h, Sab 9h-17h, Dom fechado
- Pagamento: Pix, credito, debito, dinheiro
- Estacionamento: Sim, 2 vagas na frente

#### `data/kb/services.md`
Tabela com 15-20 servicos realistas de salao:

| Servico | Preco | Duracao | Profissionais |
|---------|-------|---------|---------------|
| Corte feminino | R$ 80 | 45min | Ana, Carla |
| Corte masculino | R$ 45 | 30min | Ana, Marcos |
| Coloracao | R$ 150 | 90min | Carla |
| Mechas/Luzes | R$ 200 | 120min | Carla |
| Escova | R$ 60 | 40min | Ana, Carla, Julia |
| Progressiva | R$ 250 | 180min | Carla |
| Manicure | R$ 40 | 40min | Julia |
| Pedicure | R$ 50 | 50min | Julia |
| Mani + Pedi | R$ 80 | 80min | Julia |
| Sobrancelha | R$ 30 | 20min | Julia, Ana |
| Barba | R$ 35 | 25min | Marcos |
| Corte + Barba | R$ 70 | 50min | Marcos |
| Hidratacao capilar | R$ 90 | 60min | Ana, Carla |
| Penteado (festa) | R$ 120 | 60min | Carla |
| Maquiagem | R$ 100 | 50min | Ana |

#### `data/kb/professionals.md`
Tabela com 4 profissionais:

| Nome | Especialidades | Horario | Dias | Obs |
|------|---------------|---------|------|-----|
| Ana | Corte fem/masc, escova, sobrancelha, maquiagem | 9h-18h | Seg-Sex | Folga: quarta |
| Carla | Coloracao, mechas, progressiva, penteado, hidratacao | 9h-19h | Seg-Sab | Dona do salao |
| Julia | Manicure, pedicure, sobrancelha, escova | 9h-17h | Seg-Sex | — |
| Marcos | Corte masc, barba | 10h-19h | Ter-Sab | Barbeiro |

#### `data/kb/scheduling-rules.md`
- Antecedencia minima: 2 horas
- Cancelamento gratuito: ate 4 horas antes
- Reagendamento: sem custo, com 4h antecedencia
- Maximo 3 agendamentos por cliente por semana
- Intervalo entre servicos: 15 minutos
- Lista de espera: sim, notificar quando abrir vaga
- Horarios bloqueados: almoco 12h-13h (exceto Carla)

#### `data/kb/faq.md`
Top 20 perguntas com respostas no tom do salao (informal, carinhoso):

1. "Qual o endereco?" → "Estamos na Rua Example, 123, no Centro! Bem facil de encontrar, do lado da farmacia X."
2. "Aceitam Pix?" → "Sim, aceitamos Pix, cartao de credito, debito e dinheiro!"
3. "Tem estacionamento?" → "Temos sim! 2 vaguinhas na frente do salao."
4. (+ 17 perguntas cobrindo: precos, horarios, profissionais, servicos especiais, criancas, produtos, etc.)

#### `data/kb/sales.md`
- Promocao ativa: "Combo Mani+Pedi por R$ 80 (economize R$ 10)"
- Cross-sell: Corte fem → sugerir hidratacao; Coloracao → sugerir escova
- Follow-up 48h: "Oi [nome]! Tudo bem? Queria saber se ficou satisfeita com o [servico]. Qualquer coisa estamos aqui!"
- Reativacao 30 dias: "Oi [nome]! Faz tempo que nao te vemos por aqui. Que tal agendar aquele [ultimo servico]? Estamos com horarios disponiveis essa semana!"
- Reativacao 60 dias: "Oi [nome]! Sentimos sua falta! Temos uma condicao especial para voce: [promocao]. Quer agendar?"

---

## PARTE 3: CRIAR PROMPTS PACER COMPLETOS

### Task 3.1 — Prompt do Router

**Criar em:** `data/prompts/router-prompt.md`

```markdown
# Router — System Prompt

## PERSONA
Voce e um classificador de intencoes. Voce NAO responde ao cliente. Voce apenas classifica a mensagem e retorna um JSON.

## ACTION
Classifique cada mensagem recebida em exatamente UMA categoria:
- `agendamento` — marcar, reagendar, cancelar, consultar horario, confirmar
- `faq` — perguntas sobre precos, endereco, horario, servicos, pagamento
- `vendas` — resposta a promocao, interesse em servico novo, pedir sugestao
- `reclamacao` — insatisfacao, problema com servico anterior, critica
- `humano` — pedido explicito por humano, situacao ambigua, xingamento, assunto pessoal

## CONTEXT
Considere as ultimas 5 mensagens da conversa para contexto. Se a conversa ja esta em andamento sobre agendamento e o cliente envia "14h", isso e agendamento, nao FAQ.

## EXAMPLES

Mensagem: "Quero marcar um horario pra cortar o cabelo"
→ {"intent": "agendamento", "confidence": 0.95}

Mensagem: "Quanto custa a progressiva?"
→ {"intent": "faq", "confidence": 0.92}

Mensagem: "Recebi a mensagem da promocao, me conta mais"
→ {"intent": "vendas", "confidence": 0.88}

Mensagem: "O corte ficou horrivel, quero meu dinheiro de volta"
→ {"intent": "reclamacao", "confidence": 0.90}

Mensagem: "Quero falar com a Carla"
→ {"intent": "humano", "confidence": 0.85}

Mensagem: "14h"
(contexto: ultima msg foi "Qual horario voce prefere?")
→ {"intent": "agendamento", "confidence": 0.93}

Mensagem: "kkkk bom dia"
→ {"intent": "faq", "confidence": 0.60}

## RESTRICTIONS
- SEMPRE retornar JSON valido com campos "intent" e "confidence"
- Se confidence < 0.65, classificar como "humano"
- NUNCA gerar texto de resposta ao cliente
- NUNCA inventar categorias alem das 5 listadas
```

### Task 3.2 — Prompt da Recepcionista

**Criar em:** `data/prompts/receptionist-prompt.md`

```markdown
# Recepcionista — System Prompt

## PERSONA
Voce e a {{NOME_AGENTE}}, assistente virtual do {{NOME_SALAO}}. Voce e simpatica, profissional e eficiente. Fala de forma informal mas educada, como uma recepcionista real que conhece os clientes pelo nome.

## ACTION
Sua funcao principal e gerenciar agendamentos:
1. **Agendar** — Perguntar servico, profissional (se nao especificado), data e horario. Verificar disponibilidade. Confirmar.
2. **Reagendar** — Identificar agendamento existente, propor novo horario.
3. **Cancelar** — Identificar agendamento, confirmar cancelamento, informar politica.
4. **Consultar** — Informar horarios disponiveis para servico/profissional.
5. **Confirmar** — Confirmar agendamento existente quando cliente perguntar.

## CONTEXT
{{KB_SERVICES}}
{{KB_PROFESSIONALS}}
{{KB_SCHEDULING_RULES}}
{{AVAILABLE_SLOTS}} (injetado em tempo real pelo n8n)

Historico da conversa: {{CONVERSATION_HISTORY}}

## EXAMPLES

Cliente: "Quero cortar o cabelo amanha"
Agente: "Que otimo! Temos horarios disponiveis amanha com a Ana (9h, 10h, 14h, 15h) e com o Marcos (10h, 11h, 16h). Qual horario fica melhor pra voce?"

Cliente: "Quero coloracao com a Carla na sexta"
Agente: "Perfeito! A Carla tem os seguintes horarios na sexta: 9h, 14h e 16h. A coloracao leva em media 1h30. Qual voce prefere?"

Cliente: "Preciso reagendar meu horario de amanha"
Agente: "Claro! Deixa eu verificar... Voce tem um corte feminino agendado amanha as 14h com a Ana. Pra quando voce gostaria de mudar?"

## RESTRICTIONS
- NUNCA inventar horarios disponiveis — use APENAS os dados de {{AVAILABLE_SLOTS}}
- NUNCA confirmar agendamento sem verificar disponibilidade
- NUNCA dar descontos ou alterar precos
- Se o servico nao existe no salao, informar educadamente
- Se todos os horarios estao ocupados, oferecer lista de espera
- Se o cliente pedir algo fora do seu escopo, dizer: "Vou verificar com a equipe e ja te retorno!"
- Maximo 3 mensagens de ida e volta para concluir um agendamento simples
- SEMPRE confirmar o resumo antes de finalizar: "Entao fica: [servico] com [profissional] no [dia] as [hora]. Confirma?"
```

### Task 3.3 — Prompt do FAQ

**Criar em:** `data/prompts/faq-prompt.md`

```markdown
# FAQ — System Prompt

## PERSONA
Mesma persona da recepcionista: {{NOME_AGENTE}} do {{NOME_SALAO}}.

## ACTION
Responder perguntas sobre o salao usando APENAS informacoes da base de conhecimento. Priorize respostas VERBATIM (exatamente como esta na KB) quando possivel.

## CONTEXT
{{KB_SALON_INFO}}
{{KB_SERVICES}}
{{KB_PROFESSIONALS}}
{{KB_FAQ}}

## EXAMPLES

Cliente: "Quanto custa cortar o cabelo?"
Agente: "O corte feminino e R$ 80 (45min) e o masculino R$ 45 (30min). Quer agendar?"

Cliente: "Voces abrem domingo?"
Agente: "Infelizmente nao abrimos aos domingos. Nosso horario e de segunda a sexta das 9h as 19h e sabado das 9h as 17h. Quer agendar pra outro dia?"

## RESTRICTIONS
- NUNCA inventar informacoes que nao estao na KB
- Se nao sabe a resposta: "Boa pergunta! Vou confirmar com a equipe e ja te retorno." (+ acionar human takeover)
- Sempre que responder sobre precos/servicos, oferecer agendamento no final
- Respostas curtas e diretas (maximo 3 frases)
```

### Task 3.4 — Prompt de Vendas

**Criar em:** `data/prompts/sales-prompt.md`

```markdown
# Vendas / Follow-up — System Prompt

## PERSONA
Mesma persona, porem com tom mais entusiasmado e proativo. Voce e a amiga que indica coisas legais, nao uma vendedora insistente.

## ACTION
1. **Follow-up pos-atendimento** (48h depois): Perguntar satisfacao, oferecer servico complementar
2. **Reativacao** (30/60 dias): Lembrar o cliente que faz tempo, oferecer agendamento
3. **Cross-sell**: Apos agendamento, sugerir servico complementar
4. **Promocao**: Comunicar promocoes ativas de forma natural
5. **Lembrete 24h**: Confirmar agendamento do dia seguinte

## CONTEXT
{{KB_SALES}}
{{CLIENT_HISTORY}} (ultimo servico, ultima visita, frequencia)
{{ACTIVE_PROMOTIONS}}

## EXAMPLES

Follow-up 48h:
"Oi Ana! Tudo bem? Queria saber se voce curtiu o corte de ontem com a Carla! Ficou lindo 💇‍♀️ Sabia que a hidratacao capilar fica incrivel depois da coloracao? Caso tenha interesse, e so me chamar!"

Reativacao 30 dias:
"Oi Mariana! Faz um tempinho que voce nao aparece por aqui, estamos com saudade! 😊 Que tal agendar aquela escova maravilhosa? Temos horarios essa semana. Me fala o melhor dia pra voce!"

Lembrete 24h:
"Oi Julia! Lembrando do seu horario amanha: Manicure + Pedicure as 14h com a Julia. Te esperamos! 💅 Se precisar mudar o horario, e so me avisar."

## RESTRICTIONS
- Maximo 1 mensagem proativa por semana por cliente
- Se cliente responder "nao quero" ou "para" → parar IMEDIATAMENTE, nao insistir
- NUNCA enviar mensagem marketing entre 20h e 8h
- Respeitar opt-out permanente
- Tom SEMPRE amigavel, NUNCA pressionar
- Usar emojis com moderacao (1-2 por mensagem)
- Mensagem marketing deve seguir formato de template aprovado pela Meta
```

---

## PARTE 4: CRIAR ESTRUTURA DE DADOS

### Task 4.1 — Schema do banco de dados

**Criar em:** `infra/schema.sql`

Tabelas necessarias (para o Postgres do n8n ou separado):

```sql
-- Clientes
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL, -- numero WhatsApp
  name VARCHAR(100),
  last_service VARCHAR(100),
  last_visit TIMESTAMP,
  visit_count INTEGER DEFAULT 0,
  opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agendamentos
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  service VARCHAR(100) NOT NULL,
  professional VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, cancelled, completed, no_show
  created_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP
);

-- Historico de conversas (para contexto do LLM)
CREATE TABLE conversation_history (
  id SERIAL PRIMARY KEY,
  client_phone VARCHAR(20) NOT NULL,
  role VARCHAR(10) NOT NULL, -- 'user' ou 'assistant'
  content TEXT NOT NULL,
  intent VARCHAR(20), -- agendamento, faq, vendas, reclamacao, humano
  agent VARCHAR(20), -- router, receptionist, faq, sales
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens proativas enviadas (controle de frequencia)
CREATE TABLE proactive_messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  type VARCHAR(20) NOT NULL, -- followup, reactivation, reminder, promotion
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent' -- sent, delivered, read, replied
);

-- Metricas (para KPI dashboard)
CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL,
  metric_value NUMERIC,
  measured_at TIMESTAMP DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_professional ON appointments(professional, date);
CREATE INDEX idx_conversation_phone ON conversation_history(client_phone, created_at DESC);
CREATE INDEX idx_proactive_client ON proactive_messages(client_id, sent_at DESC);
```

### Task 4.2 — Criar endpoint de disponibilidade

**Criar em:** `infra/check-availability.sql` (query que o n8n vai usar)

```sql
-- Dado: profissional, data, duracao do servico
-- Retorna: slots disponiveis

WITH professional_schedule AS (
  -- Horarios de trabalho do profissional (hardcoded ou de tabela config)
  SELECT generate_series(
    '{{DATA}}'::date + '{{HORA_INICIO}}'::time,
    '{{DATA}}'::date + '{{HORA_FIM}}'::time - interval '{{DURACAO}} minutes',
    interval '30 minutes'
  ) AS slot_start
),
booked_slots AS (
  SELECT time AS booked_start,
         time + (duration_minutes || ' minutes')::interval AS booked_end
  FROM appointments
  WHERE professional = '{{PROFISSIONAL}}'
    AND date = '{{DATA}}'
    AND status = 'confirmed'
)
SELECT slot_start::time AS available_time
FROM professional_schedule ps
WHERE NOT EXISTS (
  SELECT 1 FROM booked_slots bs
  WHERE ps.slot_start < bs.booked_end
    AND ps.slot_start + interval '{{DURACAO}} minutes' > bs.booked_start
)
ORDER BY slot_start;
```

---

## PARTE 5: CRIAR WORKFLOW N8N EXPORTAVEL (JSON)

### Task 5.1 — Estrutura dos workflows n8n

O agente deve criar os JSONs exportaveis dos workflows n8n. Como n8n usa JSON para import/export, criar:

**Criar em:** `n8n-workflows/`

```
n8n-workflows/
├── WF-01-router.json           # Webhook → classificacao → roteamento
├── WF-02-receptionist.json     # Agendamento (LLM + DB)
├── WF-03-faq.json              # RAG + resposta
├── WF-04-sales.json            # Vendas proativas
├── WF-05-human-takeover.json   # Escalacao para Chatwoot
├── WF-06-cron-jobs.json        # Lembretes, follow-up, reativacao
└── README.md                   # Instrucoes de import
```

**IMPORTANTE para o agente:** Os JSONs de workflow n8n sao complexos. O agente deve:

1. Pesquisar a estrutura JSON de workflows n8n v1.x (2026)
2. Criar workflows FUNCIONAIS, nao placeholders
3. Cada workflow deve ter:
   - Nodes corretos (Webhook, HTTP Request, Function, IF, Switch, Postgres, etc.)
   - Connections entre nodes
   - Credenciais referenciadas (Evolution API, Postgres, Anthropic/OpenAI)
   - Error handling (Error Trigger → notification)
4. O README deve explicar como importar e configurar credenciais

**Estrutura basica de cada workflow:**

#### WF-01 Router:
```
Webhook (Evolution API)
  → Function (parse mensagem)
  → Postgres (carregar historico)
  → HTTP Request (LLM classificar intencao)
  → Switch (intent)
    → Execute Workflow (WF-02/03/04/05)
```

#### WF-02 Recepcionista:
```
Input (msg + contexto)
  → Postgres (check availability query)
  → HTTP Request (LLM prompt PACER recepcionista)
  → Function (extrair acao: agendar/reagendar/cancelar)
  → IF (acao == agendar)
    → Postgres (INSERT appointment)
    → HTTP Request (Evolution API enviar confirmacao)
  → ELSE IF (acao == consultar)
    → HTTP Request (Evolution API enviar horarios)
  → Postgres (salvar conversa no historico)
```

#### WF-03 FAQ:
```
Input (msg + contexto)
  → Function (RAG: buscar na KB local)
  → HTTP Request (LLM prompt PACER FAQ com resultados RAG)
  → IF (confidence >= 0.7)
    → HTTP Request (Evolution API enviar resposta)
  → ELSE
    → Execute Workflow (WF-05 Human Takeover)
  → Postgres (salvar conversa)
```

#### WF-04 Vendas:
```
Input (msg + contexto)
  → Postgres (historico do cliente: ultimo servico, ultima visita)
  → Function (selecionar oferta relevante)
  → HTTP Request (LLM prompt PACER vendas)
  → HTTP Request (Evolution API enviar resposta)
  → Postgres (salvar conversa + log de mensagem proativa)
```

#### WF-05 Human Takeover:
```
Input (msg + contexto)
  → HTTP Request (Chatwoot API: criar/atualizar conversa)
  → HTTP Request (Evolution API: enviar msg "Vou chamar a [nome] pra te ajudar!")
  → Postgres (marcar conversa como human_takeover)
```

#### WF-06 Cron Jobs:
```
Schedule Trigger (diario 8h)
  → Postgres (query agendamentos de amanha → lembretes)
  → Loop (para cada agendamento)
    → Postgres (checar se ja enviou lembrete)
    → IF (nao enviou)
      → HTTP Request (Evolution API: enviar lembrete utility)
      → Postgres (log mensagem proativa)

Schedule Trigger (diario 10h)
  → Postgres (query atendimentos de 2 dias atras → follow-up)
  → Loop
    → Postgres (checar frequencia: max 1/semana)
    → IF (pode enviar)
      → HTTP Request (LLM: gerar msg personalizada)
      → HTTP Request (Evolution API: enviar marketing msg)
      → Postgres (log)

Schedule Trigger (semanal segunda 9h)
  → Postgres (query clientes inativos 30+ dias)
  → Loop
    → IF (nao fez opt-out E ultima msg proativa > 7 dias)
      → HTTP Request (LLM: gerar msg reativacao)
      → HTTP Request (Evolution API: enviar marketing msg)
      → Postgres (log)
```

---

## PARTE 6: DOCUMENTACAO DE DEPLOY

### Task 6.1 — Guia de deploy passo-a-passo

**Criar em:** `docs/guides/deploy-guide.md`

```markdown
# Guia de Deploy — Stack Salao WhatsApp

## Pre-requisitos
1. VPS com Ubuntu 22.04+ (minimo 4GB RAM, 2 vCPU)
   - Recomendado: Hetzner CX31 (~EUR 8/mes) ou DigitalOcean ($24/mes)
2. Dominio apontando para o IP da VPS
3. Conta no Meta Business Manager
4. WhatsApp Business Account criada
5. Numero de telefone verificado no Meta
6. Chave API da Anthropic ou OpenAI

## Passo 1: Preparar VPS
- Instalar Docker e Docker Compose
- Instalar Nginx
- Instalar Certbot (SSL)
- Configurar firewall (ufw: 80, 443, 22)

## Passo 2: Clonar repositorio
git clone [repo] && cd infra

## Passo 3: Configurar .env
cp .env.example .env
# Preencher TODAS as variaveis

## Passo 4: Deploy
./deploy.sh

## Passo 5: Configurar Meta
- Criar app no Meta Business Manager
- Gerar System User token (permanente)
- Configurar webhook URL
- Registrar numero

## Passo 6: Configurar Evolution API
- Acessar http://api.dominio.com
- Criar instancia com Cloud API mode
- Configurar webhook para n8n

## Passo 7: Importar workflows n8n
- Acessar http://n8n.dominio.com
- Importar JSONs de n8n-workflows/
- Configurar credenciais (Postgres, Evolution API, LLM)
- Ativar workflows

## Passo 8: Configurar Chatwoot
- Acessar http://chat.dominio.com
- Criar conta admin
- Criar inbox WhatsApp
- Configurar agentes

## Passo 9: Testar
- Enviar mensagem de teste para o numero
- Verificar fluxo completo: msg → n8n → LLM → resposta
- Testar human takeover
- Testar coexistencia (ver msg no App do celular)

## Passo 10: Go-live
- Conectar numero real do salao
- Ativar com 10% trafego (piloto)
- Monitorar 3 dias
- Escalar para 50% → 100%
```

---

## CHECKLIST DE ENTREGAVEIS

Ao finalizar este plano, o agente deve ter criado:

### Infraestrutura (`infra/`)
- [ ] `docker-compose.yml` — Stack completa (6 servicos)
- [ ] `init-databases.sql` — Script de criacao de bancos
- [ ] `.env.example` — Template de variaveis de ambiente
- [ ] `nginx/default.conf` — Reverse proxy com SSL
- [ ] `deploy.sh` — Script de deploy automatizado
- [ ] `schema.sql` — Schema do banco de dados (5 tabelas)
- [ ] `check-availability.sql` — Query de disponibilidade

### Knowledge Base (`data/kb/`)
- [ ] `salon-info.md` — Dados do salao (exemplo)
- [ ] `services.md` — Tabela de servicos (15-20)
- [ ] `professionals.md` — Tabela de profissionais (4)
- [ ] `scheduling-rules.md` — Regras de agendamento
- [ ] `faq.md` — 20 perguntas frequentes
- [ ] `sales.md` — Promocoes, cross-sell, templates

### Prompts PACER (`data/prompts/`)
- [ ] `router-prompt.md` — Classificador de intencoes
- [ ] `receptionist-prompt.md` — Agente recepcionista
- [ ] `faq-prompt.md` — Agente FAQ
- [ ] `sales-prompt.md` — Agente vendas/follow-up

### Workflows n8n (`n8n-workflows/`)
- [ ] `WF-01-router.json` — Router principal
- [ ] `WF-02-receptionist.json` — Recepcionista
- [ ] `WF-03-faq.json` — FAQ com RAG
- [ ] `WF-04-sales.json` — Vendas
- [ ] `WF-05-human-takeover.json` — Escalacao
- [ ] `WF-06-cron-jobs.json` — Jobs proativos
- [ ] `README.md` — Instrucoes de import

### Documentacao (`docs/guides/`)
- [ ] `deploy-guide.md` — Guia passo-a-passo

### Total: ~25 arquivos

---

## INSTRUCOES PARA O AGENTE EXECUTOR (CODEX)

1. **Leia PRIMEIRO** os arquivos de referencia listados no inicio deste plano
2. **Leia o squad** em `.aios-core/squads/salon-whatsapp/` para entender a estrutura ja criada
3. **Execute na ordem**: Parte 1 → 2 → 3 → 4 → 5 → 6
4. **Pesquise versoes atuais** de Docker images (fev 2026) antes de escrever o compose
5. **Workflows n8n**: Pesquise o formato JSON de export do n8n v1.x para criar JSONs validos e importaveis
6. **NAO invente dados do salao real** — a KB em `data/kb/` e de EXEMPLO para testes. Os dados reais virao da reuniao com a dona (Sprint 0)
7. **Teste mental** cada prompt: leia como se fosse o LLM recebendo, garanta que nao tem ambiguidade
8. **Priorize funcionalidade** sobre perfeicao — melhor um workflow simples que funciona do que um complexo que quebra

---

*Plano criado por Atlas (analyst) em 2026-02-24*
*Baseado em pesquisa de 30+ fontes, analise de 25+ documentos, e decisoes validadas por Victor Cruz*
