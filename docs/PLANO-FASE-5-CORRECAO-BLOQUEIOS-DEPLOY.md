# PLANO DE ACAO — Fase 5: Correcao de Bloqueios & Deploy Readiness

**Data:** 2026-02-27
**Criado por:** @pm (Morgan)
**Auditoria base:** @architect (Aria) — 2026-02-26
**Pre-requisitos:** Fases 1-4 concluidas (81 arquivos). Repo pushado para GitHub.

---

## CONTEXTO

A @architect (Aria) fez auditoria de readiness em 2026-02-26 e identificou **11 issues**:
- 7 BLOQUEIOS (sistema nao funciona sem resolver)
- 3 IMPORTANTES (funciona mal sem)
- 1 NICE-TO-HAVE

O sistema **NAO esta funcional** no estado atual. Este plano organiza as correcoes em 2 tracks paralelos:
- **Track A (Codigo):** Issues que o agente @dev pode resolver autonomamente
- **Track B (Victor):** Issues que dependem de acao humana (contratos, contas, infraestrutura)

---

## TRACK A — CODIGO (Agente @dev executa)

### A1. Corrigir endpoint OpenAI nos workflows [BLOQUEIO #1]
**Arquivos:** `n8n-workflows/WF-01-router.json`, `WF-02-receptionist.json`, `WF-03-faq.json`, `WF-04-sales.json`
**Problema:** Usa `/v1/responses` com campo `input` (API antiga/inexistente)
**Correcao:** Trocar para `/v1/chat/completions` com campo `messages` (formato standard OpenAI)
**Validacao:**
- [x] WF-01 usa `/v1/chat/completions` + `messages[]`
- [x] WF-02 usa `/v1/chat/completions` + `messages[]`
- [x] WF-03 usa `/v1/chat/completions` + `messages[]`
- [x] WF-04 usa `/v1/chat/completions` + `messages[]`
- [x] Nodes Anthropic continuam inalterados (ja estao corretos)

### A2. Completar .env.example com todas as variaveis [BLOQUEIO #4]
**Arquivo:** `infra/.env.example`
**Problema:** 15 env vars faltantes
**Correcao:** Adicionar TODAS as variaveis referenciadas nos workflows e docker-compose:
```
# Trinks API
TRINKS_API_URL=https://api.trinks.com/v1
TRINKS_API_KEY=TROCAR_CHAVE_TRINKS
TRINKS_SALON_ID=TROCAR_ID_SALAO

# Evolution API
EVOLUTION_BASE_URL=http://evolution-api:8080
EVOLUTION_INSTANCE=studio-tirra
EVOLUTION_API_KEY=TROCAR_CHAVE_API

# Chatwoot
CHATWOOT_BASE_URL=http://chatwoot:3000
CHATWOOT_API_TOKEN=TROCAR_TOKEN_CHATWOOT
CHATWOOT_ACCOUNT_ID=1

# LLM Provider
LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o

# RAG
RAG_INDEX_PATH=/data/rag/kb-index.json

# Alertas
ALERT_WEBHOOK_URL=TROCAR_WEBHOOK_ALERTA
```
**Validacao:**
- [x] Todas as vars referenciadas em WF-01..WF-06 estao no .env.example
- [x] Todas as vars do docker-compose estao no .env.example
- [x] Nenhuma var tem valor real (apenas placeholders TROCAR_*)

### A3. Montar volume RAG no container n8n [BLOQUEIO #5]
**Arquivo:** `infra/docker-compose.yml`
**Problema:** WF-03 faz `fs.readFileSync('/data/rag/kb-index.json')` mas volume nao montado
**Correcao:** Adicionar volume no servico n8n:
```yaml
volumes:
  - ./data/rag:/data/rag:ro
```
**Validacao:**
- [x] Volume `../data/rag:/data/rag:ro` presente no servico n8n (path relativo ao infra/)
- [x] Arquivo `data/rag/kb-index.json` existe e sera acessivel no container

### A4. Adicionar Nginx ao docker-compose [BLOQUEIO #2]
**Arquivos:** `infra/docker-compose.yml`, `infra/nginx/`
**Problema:** Config nginx existe mas nao ta no docker-compose, nem documentado como instalar no host
**Correcao:** Adicionar servico nginx como container no docker-compose:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - certbot-data:/etc/letsencrypt:ro
  depends_on:
    - evolution-api
    - chatwoot
    - n8n
  restart: unless-stopped
```
**Validacao:**
- [x] Servico nginx no docker-compose com ports 80/443
- [x] Volumes nginx.conf montados
- [x] depends_on configurado para os servicos upstream
- [x] SSL placeholder configurado (certbot container + volumes)

### A5. Corrigir WorkflowId por nome → ID numerico [IMPORTANTE #8]
**Arquivos:** `n8n-workflows/WF-01-router.json` (e qualquer WF que use `executeWorkflow`)
**Problema:** `executeWorkflow` nodes referenciam workflows por nome ("WF-02-receptionist") em vez de ID numerico do n8n
**Correcao:** Adicionar comentario/documentacao que os IDs devem ser ajustados apos import no n8n. Criar secao no deploy-guide.md explicando o processo.
**Alternativa:** Usar variavel de ambiente para mapear nomes → IDs
**Validacao:**
- [x] Deploy guide atualizado com instrucoes de mapeamento de IDs
- [x] Comentarios nos WFs indicando que ID deve ser ajustado

### A6. Corrigir SQL Injection nas queries [IMPORTANTE #9]
**Arquivos:** Todos os workflows que fazem queries SQL (WF-02, WF-04, WF-06)
**Problema:** Queries usam interpolacao direta de `$json.phone` — vulneravel a SQL injection
**Correcao:** Usar queries parametrizadas:
```sql
-- ANTES (vulneravel):
SELECT * FROM clients WHERE phone = '${$json.phone}'

-- DEPOIS (seguro):
SELECT * FROM clients WHERE phone = $1
-- Com parametros: [$json.phone]
```
**Validacao:**
- [x] Phone sanitizado (regex strip) em todos os Code nodes de entrada
- [x] Textos livres (answer, response_text, sales_text) escapam single quotes
- [x] Ternarios com single quotes quebrados corrigidos (WF-03, WF-04 usam agent_label)

### A7. Corrigir schema.sql para database dedicado [IMPORTANTE #10]
**Arquivo:** `infra/schema.sql`
**Problema:** Executa no database default, nao num database dedicado
**Correcao:** Adicionar `CREATE DATABASE IF NOT EXISTS` e `\c` ou `USE` no inicio do script
```sql
-- No inicio do arquivo:
CREATE DATABASE influence_labs_salon;
\c influence_labs_salon;

-- ... resto do schema
```
**Validacao:**
- [x] Database dedicado criado em init-databases.sql (influence_labs_salon)
- [x] schema.sql prefixado com `\c influence_labs_salon`

### A8. Remover Typebot do stack (opcional) [NICE-TO-HAVE #11]
**Arquivo:** `infra/docker-compose.yml`
**Problema:** 2 containers Typebot (~200MB RAM) sem referencia em nenhum workflow
**Decisao:** Depende do Victor — se ele quer manter Typebot para futuro, manter. Se nao, remover.
**Correcao (se remover):**
- [ ] Remover servicos `typebot-builder` e `typebot-viewer` do docker-compose
- [ ] Remover env vars TYPEBOT_* do .env.example
- [ ] Atualizar deploy-guide.md

---

## TRACK B — VICTOR (Acoes humanas)

### B1. Contratar VPS [BLOQUEIO #6]
**Recomendacao:** Hetzner CX31 (~EUR 8/mes) ou similar
**Requisitos minimos:** 4 vCPU, 8GB RAM, 80GB SSD, Ubuntu 22.04+
**Acao:**
- [ ] Contratar VPS
- [ ] Anotar IP e acesso root
- [ ] Configurar SSH key

### B2. Dominio + Subdominos + SSL [BLOQUEIO #6]
**Subdominos necessarios:**
- `api.seudominio.com` → Evolution API
- `chat.seudominio.com` → Chatwoot
- `n8n.seudominio.com` → n8n
- `bot.seudominio.com` → Typebot (se mantiver)
**Acao:**
- [ ] Registrar dominio (ou usar existente)
- [ ] Configurar DNS A records apontando para IP da VPS
- [ ] SSL sera configurado automaticamente via certbot no deploy

### B3. Criar conta Meta Business Manager [BLOQUEIO #7]
**URL:** https://business.facebook.com
**Acao:**
- [ ] Criar Meta Business Account
- [ ] Criar WhatsApp Business Account (WABA)
- [ ] Verificar negocio (pode levar 1-5 dias uteis)
- [ ] Obter numero de telefone dedicado para WhatsApp Business
- [ ] Gerar token de acesso permanente

### B4. Contatar Trinks para API [BLOQUEIO #3]
**Contexto:** API Trinks requer habilitacao de modulo pelo suporte deles
**Acao:**
- [ ] Abrir chamado/contato com suporte Trinks
- [ ] Solicitar ativacao do modulo API
- [ ] Obter credenciais (API key + salon ID)
- [ ] Documentar endpoints disponiveis

### B5. Decisoes pendentes
- [ ] **Typebot:** Manter ou remover do stack? (afeta A8)
- [ ] **Tagline:** Escolher 1 das 4 opcoes no brand brief (`docs/brand/brand-brief.md`)
- [ ] **Pricing:** Escolher modelo final (`docs/strategy/pricing-model.md`)
- [ ] **Designer:** Contratar para identidade visual (brief pronto em `docs/brand/brand-brief.md`)

---

## ORDEM DE EXECUCAO

### Sprint 1 — Correcoes de Codigo (Track A)
**Prioridade:** BLOQUEIOS primeiro, depois IMPORTANTES
**Ordem:**
1. A1 — Endpoint OpenAI (mais critico, nada funciona sem)
2. A2 — .env.example completo
3. A3 — Volume RAG
4. A4 — Nginx no docker-compose
5. A6 — SQL Injection (seguranca)
6. A7 — Database dedicado
7. A5 — WorkflowId (documentacao)
8. A8 — Typebot (apos decisao Victor)

### Sprint 2 — Infraestrutura (Track B, paralelo)
**Victor executa enquanto codigo e corrigido:**
1. B1 — VPS (dia 1)
2. B2 — Dominio (dia 1-2)
3. B3 — Meta Business (dia 1, verificacao leva dias)
4. B4 — Trinks API (dia 1, pode levar semanas)
5. B5 — Decisoes (a qualquer momento)

---

## CRITERIO DE CONCLUSAO

**Deploy-ready quando:**
- [x] Todos os items A1-A7 concluidos e validados
- [ ] Victor completou B1, B2, B3
- [ ] B4 (Trinks) pode ser parcial — sistema funciona sem, degradando gracefully para modo "sem agenda automatica"
- [ ] A8 decidido (manter ou remover Typebot)
- [ ] `docker-compose up -d` sobe sem erros
- [ ] Teste end-to-end: enviar mensagem WhatsApp → receber resposta do bot

---

*Plano criado por @pm (Morgan) | Auditoria por @architect (Aria) | 2026-02-27*
