# Architecture: Studio Tirra Admin Dashboard MVP

**Status:** Ready (aprovado por Victor, 2026-05-26)
**Autor:** @architect Aria
**Epic:** [EPIC-studio-tirra-admin-dashboard.md](../stories/epics/EPIC-studio-tirra-admin-dashboard.md)

## Sumário executivo

Painel web em Next.js 15 servido em `admin.studiotirra.com.br`, reusa Postgres existente, autenticação via magic link (Resend) + JWT httponly com sessão 30 dias, polling 5s para realtime, e expõe métricas de Trinks via job de sync incremental local. Deploy no mesmo VPS via Docker Compose, atrás do nginx já configurado.

## 1. Stack final

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript | Stack moderna, RSC reduz JS no cliente, fácil deploy standalone |
| UI Kit | shadcn/ui + Tailwind CSS v4 | Componentes copy-paste (sem lock-in), acessibilidade nativa, alinhado com design system Studio Tirra |
| Charts | Recharts | Leve, declarativo, suficiente pro dashboard de métricas |
| Forms | React Hook Form + Zod | Validação compartilhada client/server |
| Backend API | Next.js Route Handlers + Express existente | API routes do Next pra auth/sessions/KB; Express atual continua dono de `/health`, `/webhook/kapso`, etc. |
| Auth | Magic link via Resend + JWT (jose lib) + httponly cookie | Sem senha, sessão longa, revogável server-side |
| DB | Postgres existente (`influence_labs_salon`) + novos schemas | Zero infra adicional |
| Cache leve | LRU em memória (lru-cache) | Métricas e listas de conversas com TTL 2s pra absorver polling |
| Runtime | Node.js 20 (Docker) | Mesmo do backend atual |
| Hosting | VPS Hostinger (`72.60.155.118`), subdomínio `admin.studiotirra.com.br` | nginx + SSL Let's Encrypt já configurados |

## 2. Decisões fechadas

| # | Decisão | Escolha | Racional |
|---|---------|---------|----------|
| 1 | Monorepo | `frontend/admin/` no repo atual | Single source of truth, deploy unificado |
| 2 | SMTP | Resend free tier (3k/mês) | 50x folga vs uso projetado, DX moderna |
| 3 | Session | JWT httponly + tabela `admin_sessions` | Revogação server-side sem Redis |
| 4 | Métricas Trinks | Job cron 15min → `trinks_appointments` local | Queries agregadas em <100ms, resiliente a outages Trinks |
| 5 | KB editor | Tabela `kb_items` + sync arquivos `.md` + spike TESS API | Versionamento + compatibilidade |

## 3. Diagrama de arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Tiago / recepção (browser desktop + mobile responsive)      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  nginx (VPS) — admin.studiotirra.com.br                     │
│  • Let's Encrypt SSL                                        │
│  • Rate limit: 60 req/min/IP                                │
│  • fail2ban no /api/auth/* (5 tentativas/5min)              │
└────────────────────────┬────────────────────────────────────┘
                         │ proxy_pass
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  admin-frontend (Docker, porta 3002)                        │
│  Next.js 15 standalone                                      │
│  • App Router (RSC + Client Components)                     │
│  • Route Handlers em /app/api/*                             │
│  • Middleware: JWT validation + session check               │
└──────┬──────────────────────────────────┬───────────────────┘
       │                                  │
       │ fetch interno (admin → backend)  │ pg client
       │ via Docker network               │
       ▼                                  ▼
┌──────────────────┐              ┌──────────────────────────┐
│  backend:3001    │              │  Postgres                │
│  (Express, já    │              │  influence_labs_salon    │
│   existe)        │              │                          │
│                  │              │  Schemas existentes:     │
│  Novos endpoints │              │  • conversation_history  │
│  expostos via    │              │  • clients               │
│  /admin/api/v1/*:│              │                          │
│  • toggles       │              │  Novos schemas:          │
│  • metrics-raw   │              │  • admin_users           │
│  • health-full   │              │  • admin_sessions        │
│                  │              │  • admin_audit_log       │
│  Internal calls: │              │  • bot_toggles           │
│  TESS, Trinks,   │              │  • bot_whitelist         │
│  Kapso           │              │  • kb_items              │
└──────────────────┘              │  • kb_versions           │
                                  │  • trinks_appointments   │
                                  │  • magic_link_tokens     │
                                  └──────────────────────────┘
       ▲
       │ cron 15min
       │
┌──────┴───────────────────────────────────────────────────────┐
│  trinks-sync worker (Docker, mesma image do backend)         │
│  • GET /agendamentos?updated_since={last_sync}               │
│  • UPSERT em trinks_appointments                             │
│  • Job table pra retry exponencial                           │
└──────────────────────────────────────────────────────────────┘
       ▲
       │ SMTP
       │
┌──────┴────────────┐
│  Resend API       │
│  (magic links)    │
└───────────────────┘
```

## 4. Estrutura de pastas

```
frontend/admin/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              # form magic link
│   │   └── verify/page.tsx             # consome token
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # shell + nav
│   │   ├── page.tsx                    # overview
│   │   ├── conversas/
│   │   │   ├── page.tsx                # lista
│   │   │   └── [phone]/page.tsx        # drill-down
│   │   ├── toggles/page.tsx
│   │   ├── metricas/page.tsx
│   │   ├── kb/
│   │   │   ├── page.tsx                # lista items
│   │   │   ├── [slug]/page.tsx         # editor
│   │   │   └── historico/page.tsx
│   │   ├── saude/page.tsx
│   │   └── auditoria/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── magic-link/route.ts     # POST envia link
│       │   ├── verify/route.ts         # GET valida token, set cookie
│       │   └── logout/route.ts
│       ├── conversas/route.ts
│       ├── conversas/[phone]/route.ts
│       ├── toggles/route.ts
│       ├── metricas/route.ts
│       ├── kb/route.ts
│       ├── kb/[slug]/route.ts
│       └── saude/route.ts              # proxy /health do backend
├── components/
│   ├── ui/                              # shadcn copy-paste
│   ├── conversas/
│   ├── metricas/
│   ├── kb/
│   └── shared/
├── lib/
│   ├── db.ts                            # pg pool
│   ├── auth.ts                          # JWT sign/verify, session check
│   ├── audit.ts                         # log helper
│   ├── trinks-sync.ts                   # sync job entrypoint
│   └── env.ts                           # zod validation env vars
├── middleware.ts                        # JWT + session middleware
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 5. Schema do banco (delegado a @data-engineer pra refinar)

```sql
-- Usuários do painel
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- MVP: só 'admin'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Magic link tokens (single-use, 15min TTL)
CREATE TABLE magic_link_tokens (
  token_hash TEXT PRIMARY KEY,       -- sha256 do token (nunca armazenar plaintext)
  user_id UUID NOT NULL REFERENCES admin_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX idx_magic_link_expires ON magic_link_tokens(expires_at);

-- Sessions ativas (JWT jti tracking pra revogar)
CREATE TABLE admin_sessions (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,    -- created + 30d
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  device_label TEXT,                  -- ex: "Chrome on Mac"
  ip_address INET
);
CREATE INDEX idx_admin_sessions_user_active ON admin_sessions(user_id) WHERE revoked_at IS NULL;

-- Audit log (append-only)
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,               -- kb.update, toggle.set, whitelist.add, login, logout
  target_type TEXT,                   -- kb_item, bot_toggle, etc
  target_id TEXT,
  payload JSONB,                      -- diff ou estado
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user_time ON admin_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action_time ON admin_audit_log(action, created_at DESC);

-- Toggles do bot
CREATE TABLE bot_toggles (
  key TEXT PRIMARY KEY,               -- ex: "global", "feature:audio"
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Whitelist/blacklist por número
CREATE TABLE bot_whitelist (
  phone TEXT PRIMARY KEY,             -- formato E.164 +5511...
  mode TEXT NOT NULL,                 -- 'allow' | 'block' | 'human_only'
  reason TEXT,
  added_by UUID REFERENCES admin_users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KB items (substitui leitura direta de data/kb/*.md no futuro)
CREATE TABLE kb_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- ex: "faq-servicos"
  category TEXT NOT NULL,             -- 'faq' | 'servicos' | 'regras' | 'padroes'
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kb_active_category ON kb_items(category) WHERE active = true;

-- KB versions (histórico append-only)
CREATE TABLE kb_versions (
  id BIGSERIAL PRIMARY KEY,
  kb_item_id UUID NOT NULL REFERENCES kb_items(id),
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  diff_summary TEXT,                  -- "+45 -12 chars" ou descrição humana
  updated_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kb_item_id, version)
);

-- Trinks appointments (sync local)
CREATE TABLE trinks_appointments (
  trinks_id BIGINT PRIMARY KEY,
  client_id BIGINT,
  client_phone TEXT,
  client_name TEXT,
  professional_id BIGINT,
  professional_name TEXT,
  service_id BIGINT,
  service_name TEXT,
  status TEXT NOT NULL,               -- 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER,
  price_cents INTEGER,
  created_at_trinks TIMESTAMPTZ,
  updated_at_trinks TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  raw JSONB,                          -- payload completo pra debug
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trinks_scheduled ON trinks_appointments(scheduled_at DESC);
CREATE INDEX idx_trinks_status_scheduled ON trinks_appointments(status, scheduled_at DESC);
CREATE INDEX idx_trinks_phone ON trinks_appointments(client_phone);

-- Sync state (track última pull)
CREATE TABLE trinks_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  last_sync_at TIMESTAMPTZ NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);
```

> @data-engineer Dara revisa migrations + valida índices + escreve scripts de seed/migration.

## 6. Auth flow detalhado

### 6.1 Login (magic link)

```
1. Tiago acessa admin.studiotirra.com.br/login
2. Digita email tiago@studiotirra.com.br
3. POST /api/auth/magic-link { email }
   - Verifica email existe em admin_users e active=true
   - Gera token random 32 bytes (base64url)
   - Armazena sha256(token) em magic_link_tokens com TTL 15min
   - Envia email via Resend com link:
     https://admin.studiotirra.com.br/verify?t={token}
   - Sempre retorna 200 (não vaza existência de email)
4. Tiago clica no link no email
5. GET /api/auth/verify?t={token}
   - sha256(token) → lookup em magic_link_tokens
   - Valida: !consumed_at AND expires_at > NOW()
   - Marca consumed_at = NOW()
   - Cria session: INSERT admin_sessions com jti=uuid, expires=NOW+30d
   - Atualiza admin_users.last_login_at
   - Audit log: action='login'
   - Gera JWT { sub: user_id, jti, exp: 30d, iat }
   - Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/
   - Redirect → /
```

### 6.2 Middleware (toda request autenticada)

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return NextResponse.redirect('/login');

  const payload = await verifyJWT(token); // jose lib
  if (!payload) return NextResponse.redirect('/login');

  // Check session not revoked (1 indexed query, ~1ms)
  const valid = await checkSession(payload.jti);
  if (!valid) return NextResponse.redirect('/login');

  // Update last_seen_at async (fire-and-forget)
  updateLastSeen(payload.jti).catch(noop);

  return NextResponse.next();
}
```

### 6.3 Logout

```
POST /api/auth/logout
  - UPDATE admin_sessions SET revoked_at = NOW() WHERE jti = current
  - Clear cookie
  - Audit log
```

### 6.4 Hardening

- Rate limit em `/api/auth/magic-link`: 3 req/min/email
- nginx rate limit + fail2ban no path `/api/auth/*`
- JWT signed com HS256, secret 64 bytes em `.env` (`ADMIN_JWT_SECRET`)
- Cookies `HttpOnly` (XSS proof), `Secure` (HTTPS only), `SameSite=Lax` (CSRF protection razoável)
- CSP header restritivo (sem `unsafe-inline`, sem CDN externo)
- Resend webhook verifica delivery (opcional V2)

## 7. Conversas live

### 7.1 API

`GET /api/conversas?status=active&search=&cursor=`
- Query: `SELECT phone, MAX(created_at) as last_msg_at, COUNT(*) as msg_count, MAX(CASE WHEN role='assistant' THEN agent END) as last_agent FROM conversation_history GROUP BY phone ORDER BY last_msg_at DESC LIMIT 50`
- Cache LRU 2s
- Filtro `status` derivado de janela temporal (active = msgs últimas 4h)

`GET /api/conversas/:phone?cursor=`
- Timeline paginada da conversa
- Inclui metadata: tokens consumidos, latência TESS, indicador de takeover

### 7.2 Polling

- Cliente faz `setInterval(fetch, 5000)` na tela de lista
- Drill-down: polling 3s
- Indicador "live" pulsa quando há mensagem nova desde último fetch

### 7.3 Otimização

- Index novo: `CREATE INDEX idx_conv_phone_time ON conversation_history(phone, created_at DESC)`
- Verificar se index `(created_at DESC)` standalone já existe

## 8. Toggles do bot

### 8.1 API backend

Backend Express expõe novos endpoints (apenas chamados pelo Next admin):
- `GET /admin/api/v1/toggles` → estado atual
- `PATCH /admin/api/v1/toggles { key, enabled }` → atualiza
- `GET /admin/api/v1/whitelist`
- `POST /admin/api/v1/whitelist { phone, mode, reason }`
- `DELETE /admin/api/v1/whitelist/:phone`

**Autenticação interna:** Next chama backend com header `X-Admin-Internal-Token` (shared secret no `.env`). Backend rejeita se header faltar/incorreto. Não exposto via nginx externo.

### 8.2 Integração com fluxo do bot

`backend/server.js` lê toggles **antes** de cada resposta:
```javascript
const globalEnabled = await getToggle('global'); // cached 5s
if (!globalEnabled) return; // silencia
const whitelistEntry = await getWhitelist(phone);
if (whitelistEntry?.mode === 'block') return;
if (whitelistEntry?.mode === 'human_only') return;
```

Cache em memória 5s pra reduzir queries (Tiago muda toggle → propaga em ≤5s).

## 9. Métricas dashboard

### 9.1 KPIs MVP1

| KPI | Fonte | Query típica |
|-----|-------|--------------|
| Agendamentos criados (7d/30d) | `trinks_appointments` | `COUNT(*) WHERE created_at_trinks > NOW() - 7d` |
| Taxa de no-show | `trinks_appointments` | `no_show / completed` |
| Cancelamentos (7d/30d) | `trinks_appointments` | `COUNT(*) WHERE cancelled_at > ...` |
| Conversas atendidas/dia | `conversation_history` | `COUNT(DISTINCT phone) WHERE created_at::date = ...` |
| Mensagens/dia | `conversation_history` | `COUNT(*) WHERE ...` |
| Takeovers humanos | `conversation_history` | `COUNT(DISTINCT phone) WHERE agent='human'` |
| Taxa de sucesso bot | join `conversation_history` × `trinks_appointments` | conversas que terminam com agendamento criado |

### 9.2 Cache

LRU 60s por KPI agregado. Refresh manual via botão.

### 9.3 Visualização

- Cards numéricos pros KPIs principais
- Gráfico de linha (Recharts) pra evolução 30d
- Tabela top 10 profissionais por agendamento
- Heatmap dia × hora pros agendamentos (V1.1 se sobrar tempo)

## 10. KB editor

### 10.1 Spike obrigatório (Story 5, antes do code)

Verificar com TESS API:
1. Existe endpoint `PATCH /agents/:id/knowledge`?
2. Suporta upload de arquivos ou só texto inline?
3. Latência de propagação após update (next conversation pega novo conteúdo)?

**Resultado do spike define caminho:**
- **Se TESS API suporta:** dashboard salva → API call sincroniza TESS → arquivo `.md` regenerado no repo (commit opcional)
- **Se TESS API não suporta:** dashboard salva → arquivo `.md` regenerado → botão "Copy to clipboard" com instrução "Cole no TESS dashboard"

### 10.2 UI editor

- Lista de items agrupada por categoria (faq, serviços, regras, padrões)
- Editor markdown com preview (lib: `@uiw/react-md-editor`)
- Histórico de versões na sidebar (clique restaura versão)
- Diff entre versões
- Save → cria `kb_versions` antes de update em `kb_items`

### 10.3 Migração inicial

Job único: lê todos os `data/kb/conversa-v2/*.md` → cria entries em `kb_items` (slug = filename, category derivada do nome). Executado na primeira deploy.

## 11. Health visual

- Consome `/health` do backend (já existe)
- Renderiza: status WhatsApp window (badge verde/amarelo/vermelho), TESS reachability, Postgres uptime, Trinks API latency
- Componente `<HealthBadge>` reutilizável

Polling 10s.

## 12. Audit log viewer

- Lista paginada `admin_audit_log` ordenada DESC
- Filtros: usuário, action, range de data
- Drill-down em payload JSON pra ver diff

## 13. Trinks sync worker

### 13.1 Implementação

```javascript
// frontend/admin/lib/trinks-sync.ts
// Executado por cron interno (node-cron) OU job separado no compose
import cron from 'node-cron';

cron.schedule('*/15 * * * *', async () => {
  const state = await db.query('SELECT * FROM trinks_sync_state WHERE id=1');
  const since = state.rows[0]?.last_sync_at ?? '2026-01-01';
  try {
    const updates = await trinks.getAgendamentosUpdated(since);
    for (const apt of updates) {
      await upsertAppointment(apt);
    }
    await db.query(`
      UPDATE trinks_sync_state
      SET last_sync_at = NOW(), last_success_at = NOW(),
          consecutive_failures = 0, last_error = NULL
      WHERE id = 1
    `);
  } catch (err) {
    await db.query(`
      UPDATE trinks_sync_state
      SET consecutive_failures = consecutive_failures + 1,
          last_error = $1
      WHERE id = 1
    `, [err.message]);
    if (state.rows[0].consecutive_failures >= 3) {
      // Alert via /admin/api/v1/alerts (V1.1)
    }
  }
});
```

### 13.2 Onde rodar

Opção escolhida: serviço Docker separado `admin-trinks-sync` (mesma image que `admin-frontend`, command override `node lib/trinks-sync-worker.js`). Razão: isola crash do sync da UI.

## 14. Deployment

### 14.1 docker-compose addition

```yaml
services:
  admin-frontend:
    build:
      context: ./frontend/admin
      dockerfile: Dockerfile
    container_name: admin-frontend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://...
      ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      RESEND_FROM_EMAIL: auth@studiotirra.com.br
      BACKEND_INTERNAL_URL: http://backend:3001
      BACKEND_INTERNAL_TOKEN: ${BACKEND_INTERNAL_TOKEN}
      ADMIN_PUBLIC_URL: https://admin.studiotirra.com.br
    networks:
      - app
    depends_on:
      postgres:
        condition: service_healthy

  admin-trinks-sync:
    build:
      context: ./frontend/admin
      dockerfile: Dockerfile
    container_name: admin-trinks-sync
    restart: unless-stopped
    command: ["node", "dist/lib/trinks-sync-worker.js"]
    environment:
      DATABASE_URL: postgres://...
      TRINKS_API_KEY: ${TRINKS_API_KEY}
      TRINKS_ESTABELECIMENTO_ID: 243868
    networks:
      - app
    depends_on:
      postgres:
        condition: service_healthy
```

### 14.2 nginx config

```nginx
# infra/nginx/conf.d/admin.conf
server {
    listen 443 ssl http2;
    server_name admin.studiotirra.com.br;

    ssl_certificate     /etc/letsencrypt/live/admin.studiotirra.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.studiotirra.com.br/privkey.pem;

    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=60r/m;
    limit_req zone=admin_limit burst=20 nodelay;

    location /api/auth/ {
        limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://admin-frontend:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://admin-frontend:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin.studiotirra.com.br;
    return 301 https://$host$request_uri;
}
```

### 14.3 Cert renewal

Adicionar `admin.studiotirra.com.br` ao certbot:
```bash
certbot certonly --webroot -w /var/www/certbot -d admin.studiotirra.com.br
```

⚠️ **Dívida técnica conhecida (memory):** container certbot morto, renovação automática quebrada. Resolver antes do launch do admin OU rodar manualmente até fix.

## 15. Observabilidade

- Logs estruturados (pino) em todos os endpoints
- `/api/health` próprio do admin (DB ping + uptime)
- Métricas Prometheus opcionais V2

## 16. Segurança — checklist

- [x] JWT signed (HS256), secret 64 bytes
- [x] Cookies HttpOnly + Secure + SameSite=Lax
- [x] CSP header restrito
- [x] Rate limit auth endpoints
- [x] fail2ban no nginx
- [x] Magic link single-use, sha256 storage
- [x] Audit log de toda mutação
- [x] Backend internal endpoints com shared secret (não expostos publicamente)
- [x] Input validation com Zod em todos os route handlers
- [x] Sem secrets em código (tudo `.env` + zod validation)
- [ ] Backup do Postgres cobrindo novas tabelas (já existe backup script, validar inclui novos schemas)

## 17. Performance — targets

| Página | TTI target | Estratégia |
|--------|-----------|-----------|
| Login | <500ms | RSC, sem JS pesado |
| Dashboard overview | <800ms | Cache LRU 60s nas métricas |
| Lista conversas | <600ms | Cache 2s, index em phone+time |
| Drill-down conversa | <500ms | Pagination 50 msgs |
| KB editor | <800ms | Lazy load do markdown editor |

## 18. Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| TESS API não suporta update KB programático | Média | Médio | Spike na Story 5 antes de codar editor. Fallback clipboard. |
| Trinks API rate limit hit no sync inicial | Baixa | Médio | Sync inicial em janelas de 7d com sleep entre páginas |
| Postgres carga aumentar com queries do dashboard | Baixa | Médio | Índices novos + cache LRU + EXPLAIN ANALYZE durante QA |
| Resend free tier estourar (improvável) | Muito baixa | Baixo | Monitorar; upgrade $20/mês resolve |
| Cert Let's Encrypt não renovar | Média | Alto | Fix do container certbot é pré-req (dívida técnica conhecida) |
| Magic link em spam folder | Média | Médio | SPF/DKIM via Resend + domínio próprio + usar header `X-Priority` |

## 19. Handoffs

**Próximos:**

| Agente | Comando | Ação |
|--------|---------|------|
| @data-engineer | `*draft` migration | Refinar schemas seção 5, criar migration SQL |
| @ux-design-expert | `*chat wireframes` | Wireframes 6 telas com base nesta arquitetura |
| @sm | `*draft` (1.1) | Story Auth + scaffold |
| @devops | (após deploy) | Setup subdomínio, cert, nginx config |

**Pré-requisitos do Architect (fechados):**
- [x] Stack confirmada
- [x] Schema esboçado
- [x] Auth flow detalhado
- [x] Deploy strategy
- [x] 5 decisões pendentes resolvidas

## 20. Change Log

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-26 | @architect Aria | Arquitetura inicial completa, 5 decisões fechadas, schema esboçado, deploy strategy definida |
