# Briefing Tecnico — Pendencias de Infraestrutura para Deploy
**Projeto:** Influence Labs — Agente WhatsApp para Studio Tirra (beta)
**Data:** 2026-02-27
**Preparado por:** @pm (Morgan)
**Para:** Reuniao com time tech

---

## 1. RESUMO DO PROJETO

### O que e
Um agente inteligente de WhatsApp para saloes de beleza. O bot recebe mensagens dos clientes via WhatsApp e:
- **Classifica a intencao** (agendamento, FAQ, vendas, reclamacao, humano)
- **Agenda servicos** automaticamente via integracao com o sistema Trinks (sistema de gestao de saloes)
- **Responde perguntas** usando base de conhecimento do salao (precos, horarios, servicos)
- **Envia mensagens proativas** (lembretes 24h, follow-up 48h, reativacao de clientes inativos)
- **Escala para humano** quando necessario, abrindo conversa no Chatwoot

### Cliente beta
**Studio Tirra** — salao em Sao Caetano do Sul/SP, dono Tiago Rocha. 8 profissionais, 123 servicos catalogados.

### Stack tecnica (ja implementada)
| Componente | Funcao | Status |
|-----------|--------|--------|
| **Evolution API** | Gateway WhatsApp (Cloud API oficial da Meta) | Config pronta |
| **n8n** | Orquestrador de workflows (6 workflows prontos) | Config pronta |
| **Chatwoot** | Atendimento humano (quando bot escala) | Config pronta |
| **PostgreSQL** | Database (historico, clientes, metricas) | Schema pronto |
| **Redis** | Cache e filas | Config pronta |
| **Nginx** | Reverse proxy + SSL | Config pronta |
| **Claude/GPT** | LLM para classificacao e respostas | Integrado nos workflows |
| **Typebot** | Chatbot visual (em avaliacao — pode ser removido) | Incluido, nao utilizado |

### Estado atual
- **Codigo:** 100% pronto (5 fases completas, 90+ arquivos, 7 fixes de bloqueio aplicados e pushados)
- **Infra:** 0% — nenhum servidor contratado, nenhuma conta externa criada
- **Deploy:** Bloqueado pelas 5 pendencias descritas abaixo

---

## 2. PENDENCIAS DETALHADAS

---

### 2.1 VPS (Servidor Virtual Privado)

**O que e:**
Um servidor Linux na nuvem onde toda a stack vai rodar. Todos os containers Docker (Evolution API, n8n, Chatwoot, PostgreSQL, Redis, Nginx) sobem nessa maquina.

**Por que importa:**
Sem servidor, nada roda. E o alicerce de tudo.

**Onde impacta no projeto:**
- Docker Compose esta pronto (`infra/docker-compose.yml`) — so precisa de uma maquina para executar
- Nginx precisa de IP publico para receber trafego
- DNS dos subdominios aponta para o IP desse servidor

**Requisitos tecnicos:**
| Requisito | Minimo | Recomendado |
|-----------|--------|-------------|
| vCPU | 2 | 4 |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| Sistema | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| Rede | IPv4 publico fixo | + IPv6 |
| Trafego | 5 TB/mes | Ilimitado |

**Detalhamento do consumo de RAM estimado:**
| Container | RAM estimada |
|-----------|-------------|
| Evolution API | ~300 MB |
| n8n | ~500 MB |
| Chatwoot + Worker | ~1.5 GB |
| PostgreSQL | ~500 MB |
| Redis | ~100 MB |
| Nginx | ~50 MB |
| Typebot (se mantiver) | ~200 MB |
| **Total** | **~3.2 GB** (sem Typebot: ~3 GB) |

Com 8 GB de RAM, sobra margem para picos e OS.

**Opcoes de provedor e custos:**

| Provedor | Plano | vCPU | RAM | Disco | Custo/mes | Observacao |
|----------|-------|------|-----|-------|-----------|------------|
| **Hetzner** CX31 | Cloud | 4 | 8 GB | 80 GB | ~EUR 8 (~R$ 48) | Melhor custo-beneficio, datacenter na Europa |
| **Hetzner** CX41 | Cloud | 4 | 16 GB | 160 GB | ~EUR 15 (~R$ 90) | Margem extra se escalar |
| **DigitalOcean** | Droplet | 4 | 8 GB | 160 GB | USD 48 (~R$ 290) | Datacenter em NY/SF, mais caro |
| **Contabo** | VPS M | 6 | 16 GB | 400 GB | EUR 8 (~R$ 48) | Barato, boa spec, suporte fraco |
| **Vultr** | Cloud Compute | 4 | 8 GB | 100 GB | USD 48 (~R$ 290) | Datacenter em SP (baixa latencia) |
| **AWS Lightsail** | 8GB | 2 | 8 GB | 160 GB | USD 40 (~R$ 240) | Ecossistema AWS, mais complexo |

**Recomendacao:** Hetzner CX31 para beta (EUR 8/mes). Se precisar de datacenter no Brasil, Vultr em SP.

**Tempo para provisionar:** 5-15 minutos apos contratacao.

**Acoes pos-contratacao:**
1. Anotar IP publico
2. Configurar acesso SSH com chave (nao senha)
3. Instalar Docker e Docker Compose
4. Clonar repositorio no servidor

---

### 2.2 Dominio + Subdominios + DNS

**O que e:**
Um dominio de internet (ex: `influencelabs.com.br`) com 4 subdominios, cada um apontando para um servico diferente na mesma VPS.

**Por que importa:**
- Sem dominio, os servicos so sao acessiveis por IP:porta (ex: `123.45.67.89:8080`) — inseguro e inviavel para producao
- SSL (HTTPS) requer dominio — o WhatsApp Cloud API exige conexao segura
- Evolution API precisa de URL publica para receber webhooks da Meta

**Onde impacta no projeto:**
- `infra/nginx/default.conf` ja esta configurado com placeholders `seudominio.com.br`
- `infra/.env.example` tem `BASE_DOMAIN=seudominio.com.br` que precisa ser trocado
- Certbot (container ja configurado) gera SSL automaticamente via Let's Encrypt

**Subdominios necessarios:**

| Subdominio | Servico | Porta interna | Uso |
|-----------|---------|--------------|-----|
| `api.seudominio.com.br` | Evolution API | 8080 | Webhook WhatsApp, API de envio |
| `n8n.seudominio.com.br` | n8n | 5678 | Painel de workflows (acesso admin) |
| `chat.seudominio.com.br` | Chatwoot | 3000 | Painel de atendimento humano |
| `bot.seudominio.com.br` | Typebot | 3002 | Chatbot visual (se mantiver) |

**Custos:**
| Item | Custo | Frequencia |
|------|-------|-----------|
| Dominio `.com.br` | R$ 40-50 | Anual |
| Dominio `.com` | R$ 50-70 | Anual |
| SSL (Let's Encrypt) | Gratis | Auto-renova a cada 90 dias |
| DNS (Cloudflare) | Gratis | — |

**Configuracao tecnica:**
1. Registrar dominio (ou usar existente)
2. Apontar nameservers para Cloudflare (gratis, otimo para DNS + proteção)
3. Criar 4 registros DNS tipo `A` apontando para o IP da VPS:
   ```
   api.seudominio.com.br  →  A  →  IP_DA_VPS
   n8n.seudominio.com.br  →  A  →  IP_DA_VPS
   chat.seudominio.com.br →  A  →  IP_DA_VPS
   bot.seudominio.com.br  →  A  →  IP_DA_VPS
   ```
4. SSL e gerado automaticamente pelo container Certbot no primeiro `docker-compose up`

**Tempo:** 15 min para DNS + 1-48h para propagacao (geralmente <1h).

**Dependencia:** Precisa do IP da VPS (item 2.1) antes de configurar DNS.

---

### 2.3 Meta Business Manager + WhatsApp Business API

**O que e:**
Conta empresarial na Meta (Facebook/Instagram) que da acesso a API oficial do WhatsApp Business. Sem isso, o bot nao pode enviar nem receber mensagens.

**Por que importa:**
E o canal de comunicacao do bot. Sem WhatsApp Business API, o projeto simplesmente nao funciona — nao existe alternativa.

**Onde impacta no projeto:**
- Evolution API precisa das credenciais Meta para conectar ao WhatsApp
- `infra/.env.example` tem 5 variaveis Meta: `META_APP_ID`, `META_APP_SECRET`, `META_PHONE_NUMBER_ID`, `META_BUSINESS_ACCOUNT_ID`, `META_ACCESS_TOKEN`
- O webhook da Meta envia mensagens recebidas para `https://api.seudominio.com.br/webhook/...`

**Passo a passo tecnico:**

| Etapa | O que fazer | Tempo |
|-------|-----------|-------|
| 1 | Criar conta em [business.facebook.com](https://business.facebook.com) | 10 min |
| 2 | Criar um App no [developers.facebook.com](https://developers.facebook.com) | 10 min |
| 3 | Adicionar produto "WhatsApp" ao App | 5 min |
| 4 | Criar WhatsApp Business Account (WABA) | 5 min |
| 5 | Verificar negocio (upload de documentos: CNPJ, contrato social) | 10 min + **1-5 dias uteis** de espera |
| 6 | Obter numero de telefone dedicado | Apos verificacao |
| 7 | Gerar token de acesso permanente (System User Token) | 10 min |

**ALERTA DE LEAD TIME:** A verificacao do negocio (etapa 5) e o gargalo. Pode levar de 1 a 5 dias uteis. Por isso deve ser iniciada o mais cedo possivel.

**Custos:**

| Item | Custo |
|------|-------|
| Meta Business Manager | Gratis |
| WhatsApp Business API | Gratis (ate 1.000 conversas/mes no tier gratuito) |
| Conversas excedentes | ~USD 0.05-0.08 por conversa (varia por pais) |
| Numero de telefone | Precisa de um chip dedicado (nao pode ser o pessoal) |

**Modelo de cobranca da Meta:**
- **1.000 conversas/mes gratis** (conversas iniciadas pelo negocio + pelo usuario)
- Apos isso, cobra por conversa:
  - Marketing: ~USD 0.0625/conversa
  - Utilidade (lembretes, atualizacoes): ~USD 0.0188/conversa
  - Servico (atendimento reativo): Gratis (24h apos usuario iniciar)

**Para o beta (1 salao):** O tier gratuito provavelmente cobre.

**Documentos necessarios para verificacao:**
- CNPJ ativo
- Contrato social ou documento de constituicao
- Nome do negocio consistente com CNPJ

---

### 2.4 API do Trinks

**O que e:**
O Trinks e o sistema de gestao do Studio Tirra (e de muitos saloes). A API do Trinks permite que o bot consulte agenda, marque, reagende e cancele agendamentos automaticamente.

**Por que importa:**
Sem a API Trinks, o bot nao consegue verificar disponibilidade nem fazer agendamentos. O sistema degrada para modo "sem agenda automatica" — o bot responde perguntas e escala para humano quando o cliente quer agendar.

**Onde impacta no projeto:**
- WF-02 (Receptionist) consulta e cria agendamentos via Trinks
- WF-04 (Sales) consulta historico do cliente via Trinks
- WF-06 (Cron Jobs) consulta agendamentos de amanha e de 2 dias atras via Trinks
- `infra/.env.example` tem: `TRINKS_API_BASE_URL`, `TRINKS_API_KEY`

**Situacao tecnica:**
- Os workflows ja estao integrados com endpoints Trinks (GET /appointments, POST /appointments, etc.)
- **Porem:** A API do Trinks NAO e publica. Requer habilitacao de modulo pelo suporte do Trinks.
- Nao ha documentacao publica da API — precisamos obter do suporte

**Acoes necessarias:**
1. Abrir chamado/contato com suporte Trinks
2. Informar que somos parceiro tech do Studio Tirra (Tiago Rocha)
3. Solicitar ativacao do modulo API para o salao
4. Obter: API Key, Salon ID, documentacao dos endpoints
5. Validar se os endpoints que usamos nos workflows existem (podem diferir)

**Custos:**
- Desconhecido — pode ser incluso no plano do salao ou ter custo adicional
- Verificar com Trinks no chamado

**Lead time:** Incerto — pode ser dias ou semanas. Depende do Trinks.

**Plano de contingencia:**
O sistema funciona sem Trinks com degradacao graceful:
- Bot responde FAQs normalmente
- Para agendamentos, responde "Vou verificar com a equipe e ja te retorno" e escala para Chatwoot
- Cron jobs de lembrete/follow-up ficam inativos (sem dados de agendamento)

---

### 2.5 Decisao: Typebot

**O que e:**
Typebot e uma ferramenta de chatbot visual (drag-and-drop). Esta incluido no docker-compose com 2 containers (builder + viewer) mas **nenhum workflow faz referencia a ele**.

**Por que importa:**
- Ocupa ~200 MB de RAM na VPS (recurso limitado no beta)
- Adiciona complexidade de manutencao (mais um servico para monitorar, atualizar)
- Nao tem integracao com nenhum workflow atual

**Opcoes:**

| Opcao | Prós | Contras |
|-------|-----|---------|
| **Remover** | -200 MB RAM, stack mais simples, menos surface de ataque | Precisa reconfigurar se quiser no futuro |
| **Manter** | Pronto para usar se surgir necessidade, pode servir para landing pages interativas | Gasta RAM, manutencao de container nao usado |

**Impacto da remocao:**
- Remover 2 servicos do docker-compose (~20 linhas)
- Remover 4 env vars do .env.example
- Remover upstream `typebot_upstream` do nginx
- Remover subdominio `bot.seudominio.com.br`
- **Zero impacto funcional** — nenhum workflow usa Typebot

**Recomendacao:** Remover para o beta. Pode ser re-adicionado em 5 minutos no futuro se necessario.

---

## 3. MAPA DE DEPENDENCIAS

```
                    ┌─────────────┐
                    │  B3. Meta   │ ← INICIAR DIA 1 (lead time 1-5 dias)
                    │  Business   │
                    └──────┬──────┘
                           │ (token + numero)
                           ▼
┌──────────┐     ┌─────────────────┐     ┌──────────────┐
│ B1. VPS  │────►│ B2. Dominio     │────►│   DEPLOY     │
│ (30 min) │ IP  │ + DNS (1-2h)    │     │docker-compose│
└──────────┘     └─────────────────┘     │   up -d      │
                                         └──────┬───────┘
                                                │
                    ┌─────────────┐              │
                    │ B4. Trinks  │ ← PARALELO   │
                    │ (semanas?)  │   sistema     │
                    └─────────────┘   funciona    ▼
                                      sem      ┌──────────────┐
                    ┌─────────────┐            │  TESTE E2E   │
                    │ B5. Typebot │ ← DECISAO  │  WhatsApp →  │
                    │ (2 min)     │   RAPIDA    │  Bot responde│
                    └─────────────┘            └──────────────┘
```

**Caminho critico:** B1 → B2 → Deploy → Teste
**Paralelo:** B3 (iniciar dia 1), B4 (iniciar dia 1)
**Decisao rapida:** B5

---

## 4. CRONOGRAMA SUGERIDO

| Dia | Acao | Quem | Resultado esperado |
|-----|------|------|--------------------|
| **Dia 1** | Decidir Typebot (B5) | Victor | Sim/Nao em 2 min |
| **Dia 1** | Contratar VPS (B1) | Time tech | IP publico em maos |
| **Dia 1** | Iniciar Meta Business (B3) | Victor | Conta criada, verificacao submetida |
| **Dia 1** | Abrir chamado Trinks (B4) | Victor/Tiago | Chamado aberto |
| **Dia 2** | Configurar dominio + DNS (B2) | Time tech | 4 subdominios apontando para VPS |
| **Dia 2** | Setup VPS (Docker, clone repo) | Time tech | Servidor pronto para deploy |
| **Dia 3-5** | Aguardar verificacao Meta (B3) | — | Token e numero disponiveis |
| **Dia 3-5** | Deploy + teste (apos Meta) | Time tech | `docker-compose up -d` + teste e2e |

**Melhor caso:** Deploy funcional em 3 dias (se Meta verificar rapido)
**Caso tipico:** 5 dias uteis
**Pior caso:** 7-10 dias (se Meta demorar ou DNS propagar lento)

---

## 5. CUSTOS MENSAIS ESTIMADOS (BETA)

| Item | Custo/mes | Notas |
|------|-----------|-------|
| VPS (Hetzner CX31) | ~R$ 48 | 4 vCPU, 8 GB RAM |
| Dominio | ~R$ 4 | R$ 45/ano rateado |
| SSL | R$ 0 | Let's Encrypt gratis |
| WhatsApp API | R$ 0 | Tier gratuito (1.000 conversas) |
| LLM (Claude/GPT) | R$ 25-100 | Depende do volume de mensagens |
| Trinks API | A verificar | Pode ser incluso no plano |
| **TOTAL ESTIMADO** | **R$ 77-152/mes** | Para 1 salao beta |

---

## 6. RISCOS E MITIGACOES

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Meta demora >5 dias para verificar | Media | Alto (bloqueia tudo) | Iniciar dia 1, ter docs prontos |
| Trinks nao libera API | Media | Medio (degrada graceful) | Sistema funciona sem, escala para humano |
| API Trinks difere dos endpoints implementados | Alta | Medio | Ter dev disponivel para ajustar workflows |
| Volume de mensagens excede tier gratuito | Baixa (beta) | Baixo | Monitorar, R$ 3-5/1000 msg excedentes |
| VPS com RAM insuficiente | Baixa | Alto | Monitorar `docker stats`, upgrade facil |

---

*Documento preparado por @pm (Morgan) | Projeto Influence Labs | 2026-02-27*
