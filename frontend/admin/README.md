# Studio Tirra · Admin Dashboard

Painel admin interno do Studio Tirra. Next.js 16 (App Router, React 19,
TypeScript estrito), Tailwind v4, shadcn/ui, autenticação por magic link
(Resend) com sessão JWT 30 dias persistida em Postgres.

> **Story 1.1 — Auth + Base Scaffold.** Esta entrega cobre apenas login,
> layout shell e a fundação de auth. Telas de produto (Conversas, Toggles,
> Métricas, KB, Saúde) chegam nas stories 1.2–1.6.

## Stack

| Camada     | Escolha                                    |
| ---------- | ------------------------------------------ |
| Framework  | Next.js 16 (App Router, Turbopack default) |
| UI         | React 19 + Tailwind v4 + shadcn/ui         |
| Auth       | Magic link (Resend) + JWT HS256 + sessão server-side |
| Banco      | Postgres existente (`influence_labs_salon`) via `pg` |
| Email      | Resend (transactional)                     |
| Validação  | Zod (env fail-fast e bodies)               |
| Runtime    | Node.js (proxy + routes — NÃO Edge)        |

## Diferenças em relação ao Next 15

Esta é a versão **Next 16**, não 15. Diferenças que pegam de surpresa:

- `middleware.ts` foi renomeado para `proxy.ts` (mesma API).
- `searchParams` em pages é `Promise<…>` — precisa `await`.
- Cookies via `cookies()` retornam `Promise` — `await cookies()`.
- Documentação oficial reside em `node_modules/next/dist/docs/` — consultar
  antes de copiar padrões antigos.

## Pré-requisitos

- Node.js 20+ e npm 10+
- Postgres rodando local OU acesso ao VPS Postgres
- Migration `infra/migrations/001_admin_dashboard.sql` aplicada no banco
- Conta Resend ativa (free tier basta para dev) — chave em
  [resend.com/api-keys](https://resend.com/api-keys)

## Setup local

```bash
cd frontend/admin
cp .env.example .env.local
```

Edite `.env.local`:

1. **DATABASE_URL** — aponte para Postgres com a migration 001 aplicada.
2. **ADMIN_JWT_SECRET** — gere e cole:
   ```bash
   openssl rand -base64 64 | tr -d '\n'
   ```
   Trocar este valor invalida todas as sessões ativas; só rotacione em
   janelas planejadas.
3. **RESEND_API_KEY** + **RESEND_FROM_EMAIL** — sender precisa estar em
   domínio verificado no Resend (em dev sem verificação, Resend só envia
   para o email da própria conta).
4. **ADMIN_PUBLIC_URL** — `http://localhost:3002` em dev,
   `https://admin.studiotirra.com.br` em prod. Usado para montar o link do
   email.

Aplique a migration (uma vez):

```bash
docker exec -i <postgres_container> psql -U postgres -d influence_labs_salon \
  < ../../infra/migrations/001_admin_dashboard.sql
```

Crie o primeiro admin user:

```bash
npm install
npm run seed:admin -- seu-email@studiotirra.com.br "Seu Nome"
```

Suba o dev server:

```bash
npm run dev
# → http://localhost:3002/login
```

## Comandos

| Comando                  | O que faz                                              |
| ------------------------ | ------------------------------------------------------ |
| `npm run dev`            | Next dev server na porta 3002 (Turbopack)              |
| `npm run build`          | Build de produção (`output: standalone`)               |
| `npm run start`          | Servir build de produção na porta 3002                 |
| `npm run lint`           | ESLint (`eslint-config-next`)                          |
| `npm run typecheck`      | `tsc --noEmit` — TypeScript estrito                    |
| `npm test`               | Unit tests com node:test + tsx                         |
| `npm run seed:admin`     | CLI idempotente para criar/reativar admin user         |

## Estrutura

```
app/
  (auth)/              # Rotas públicas (login, verify)
    login/page.tsx
    verify/page.tsx
    layout.tsx
  (dashboard)/         # Rotas autenticadas (placeholder em 1.1)
    page.tsx
    layout.tsx
  api/auth/            # Magic link, verify, logout
  layout.tsx           # Root + Sonner Toaster
  globals.css          # Tailwind v4 + tokens shadcn
components/
  ui/                  # shadcn primitives
  auth/                # Login form + error banner
  dashboard/           # Top nav, user menu, links
lib/
  env.ts               # Zod env validation (fail-fast)
  db.ts                # pg.Pool singleton + query() + withTx()
  auth.ts              # JWT + session lifecycle + magic-link tokens
  session.ts           # getCurrentUser() para Server Components
  audit.ts             # Fail-silent audit log
  rate-limit.ts        # In-memory LRU (3 req/min/email)
  emails/
    magic-link.ts      # Template HTML do magic link
proxy.ts               # Next 16 proxy — gate de auth (NÃO Edge runtime)
scripts/
  seed-admin-user.ts   # CLI: npm run seed:admin -- email "Nome"
tests/
  auth.test.ts         # JWT + hash unit tests
  setup.ts             # Preload de env stubs
infra/                 # Fora deste dir — Dockerfile, nginx, docker-compose
```

## Segurança

- **JWT secret** — mínimo 64 chars, validado em startup por Zod.
- **Magic link tokens** — 32 bytes random base64url, armazenados como
  sha256 hex no banco (plaintext nunca persistido).
- **Cookies** — `HttpOnly`, `SameSite=Lax`, `Secure` em prod, `Path=/`,
  `Max-Age=2592000` (30 dias).
- **Rate limit** — 3 magic-link/min/email (LRU em memória; migrar para
  Redis quando admin escalar >10 users).
- **Timing attacks** — email não cadastrado recebe delay artificial e
  retorno genérico `{ ok: true }`.
- **CSP / X-Frame-Options / X-Content-Type-Options** configurados em
  `next.config.ts`.

## Deploy

Multi-stage Dockerfile produz imagem com `node server.js` standalone (sem
node_modules em runtime, apenas o necessário). Service `admin-frontend` já
adicionado em `infra/docker-compose.yml`.

Runbook completo: [docs/ops/admin-dashboard-deploy.md](../../docs/ops/admin-dashboard-deploy.md).

Resumo dos passos no VPS:

1. `git pull` na branch
2. `docker compose up -d --build admin-frontend`
3. Aplicar migration 001 se ainda não aplicada
4. Validar `https://admin.studiotirra.com.br/login` carrega
5. `npm run seed:admin` dentro do container (ou via host com env apontando
   para Postgres do VPS) para Tiago/recepção

## Notas para a próxima story

- `lib/session.ts` (`getCurrentUser`) já existe e está pronto para ser
  reutilizado em qualquer Server Component das stories 1.2+.
- Use `await getCurrentUser()` no topo de layouts/pages autenticados como
  defense-in-depth — o proxy já protege, mas é um custo barato.
- Links de navegação em `components/dashboard/nav-links.ts` — habilite o
  `enabled: true` quando a story da rota correspondente shipar.

## Referências internas

- Arquitetura: [docs/architecture/admin-dashboard.md](../../docs/architecture/admin-dashboard.md)
- Wireframes: [docs/design/admin-dashboard/wireframes.md](../../docs/design/admin-dashboard/wireframes.md)
- Story: [docs/stories/admin-dashboard-story-1.1-auth-scaffold.md](../../docs/stories/admin-dashboard-story-1.1-auth-scaffold.md)
- Deploy runbook: [docs/ops/admin-dashboard-deploy.md](../../docs/ops/admin-dashboard-deploy.md)
