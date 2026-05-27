# Admin Dashboard — Deploy Runbook (VPS)

> Criado por @devops (Gage) para Story 1.1 (admin-dashboard-story-1.1-auth-scaffold).
> Referência: `docs/architecture/admin-dashboard.md` §14.
>
> **Tempo estimado total:** 35-50 min (DNS pode somar até 4h de espera de propagação — paralelizar com outras tarefas).
>
> **Pré-requisito de código:** Story 1.1 implementada e mergeada em `main` (cria `frontend/admin/` + Dockerfile).

---

## Pré-requisitos

| Item | Owner | Status |
|------|-------|--------|
| DNS A record `admin.studiotirra.com.br` → `72.60.155.118` | Victor (painel do registro) | ⏳ pendente |
| Migration `infra/migrations/001_admin_dashboard.sql` aplicável | @data-engineer (já entregue) | ✅ |
| Conta Resend criada + domínio `studiotirra.com.br` verificado (SPF/DKIM) | Victor | ⏳ pendente |
| Story 1.1 mergeada em `main` | @dev / @devops | ⏳ aguardando |
| SSH `deploy@72.60.155.118` ativo, workdir `/opt/influence-labs/infra` | Victor | ✅ |

**Decisão bloqueante:** o cert SSL `admin.studiotirra.com.br` só pode ser emitido **depois** do DNS A propagar. Criar o DNS record **agora** (mesmo antes da Story 1.1 estar pronta) — propagação leva 15min-4h.

---

## Passo 1 — Aplicar migration no Postgres

A migration cria 10 tabelas novas + seed (3 toggles, 1 row sync state).

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git pull origin main

# Aplica migration (idempotente — usa CREATE TABLE IF NOT EXISTS + ON CONFLICT)
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < migrations/001_admin_dashboard.sql
```

### Smoke checks

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT
    (SELECT COUNT(*) FROM bot_toggles)             AS toggles,
    (SELECT COUNT(*) FROM trinks_sync_state)       AS sync_state,
    (SELECT COUNT(*) FROM admin_users)             AS users,
    (SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name IN
           ('admin_users','admin_sessions','admin_audit_log',
            'magic_link_tokens','bot_toggles','bot_whitelist',
            'kb_items','kb_versions','trinks_appointments','trinks_sync_state')
    ) AS admin_tables;
"
```

**Esperado:**
- `toggles = 3` (global, feature:audio, feature:supervisor)
- `sync_state = 1` (singleton id=1)
- `users = 0` (seed do admin é o Passo 5)
- `admin_tables = 10`

Se algum valor divergir → abortar deploy, investigar antes.

---

## Passo 2 — Emitir cert SSL Let's Encrypt

⚠️ **Dívida técnica conhecida** (vide `MEMORY.md`): o container `certbot` foi removido do compose (loop quebrado por mismatch de mount). A renovação agora roda via **cron de host**: `infra/scripts/renew-certs.sh`. Para emissão inicial precisamos rodar `certbot` manualmente.

### Opção A — Webroot (preferida, não derruba nginx)

Funciona porque o nginx no Passo 1 já serve `/.well-known/acme-challenge/` do volume `certbot_webroot` (vide bloco `server { listen 80; }` no `infra/nginx/conf.d/admin.conf`).

**Pré-condição:** o arquivo `admin.conf` precisa estar **dentro do container nginx** (após Passo 3). Logo, executar este passo **depois do Passo 3**.

```bash
# Garantir que o webroot existe e nginx serve o challenge
sudo docker run --rm -it \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v infra_certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d admin.studiotirra.com.br \
    --email victor@influencelabs.com.br \
    --agree-tos --no-eff-email --non-interactive
```

### Opção B — Standalone (fallback se Opção A falhar)

Derruba nginx por ~30s. Use só se a Opção A reclamar de challenge não atingível.

```bash
docker compose stop nginx
sudo docker run --rm -it \
  -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly \
    --standalone \
    -d admin.studiotirra.com.br \
    --email victor@influencelabs.com.br \
    --agree-tos --no-eff-email --non-interactive
docker compose start nginx
```

### Validação

```bash
sudo ls /etc/letsencrypt/live/admin.studiotirra.com.br/
# Esperado: cert.pem  chain.pem  fullchain.pem  privkey.pem  README

# Validar expiry
sudo openssl x509 -in /etc/letsencrypt/live/admin.studiotirra.com.br/fullchain.pem -noout -dates
```

Após emitir, **adicionar o domínio ao `renew-certs.sh`** se já existir, ou registrar dívida técnica nova.

---

## Passo 3 — Configurar nginx (mount conf.d/admin.conf)

A Story 1.1 mergeada já adiciona o service `admin-frontend` no `infra/docker-compose.yml` e cria `infra/nginx/conf.d/admin.conf`. Validar que o mount está presente:

```bash
grep -A 2 "nginx/conf.d/admin.conf" /opt/influence-labs/infra/docker-compose.yml
# Esperado: linha "- ./nginx/conf.d/admin.conf:/etc/nginx/conf.d/admin.conf:ro"
```

Se faltar, abortar — o PR da Story 1.1 não deveria ter sido mergeado.

**IMPORTANTE — ordem de subida do nginx vs cert:**
1. O `admin.conf` referencia `/etc/letsencrypt/live/admin.studiotirra.com.br/` que **ainda não existe** pré-Passo 2.
2. Nginx falha ao iniciar se cert SSL não existir.
3. **Workaround inicial:** subir nginx primeiro com apenas o bloco `listen 80;` (comentar o `server { listen 443; }`), emitir cert (Passo 2 Opção A), descomentar o bloco 443, recarregar nginx.

```bash
# Opção pragmática: comentar bloco 443 temporariamente
sudo sed -i.bak '/listen 443 ssl http2;/,/^}$/ s/^/#/' \
  /opt/influence-labs/infra/nginx/conf.d/admin.conf
docker compose up -d nginx          # nginx sobe (só listen 80)
# Roda Passo 2 Opção A (webroot) → cert emitido
sudo mv /opt/influence-labs/infra/nginx/conf.d/admin.conf.bak \
        /opt/influence-labs/infra/nginx/conf.d/admin.conf
docker compose exec nginx nginx -t   # valida config
docker compose exec nginx nginx -s reload
```

---

## Passo 4 — Configurar env vars no VPS

Adicionar em `/opt/influence-labs/infra/.env`:

```bash
# === ADMIN DASHBOARD ===
# Gerar localmente: openssl rand -base64 64 | tr -d '\n'
ADMIN_JWT_SECRET=<cole_o_resultado_64_chars>

# Pegar em https://resend.com/api-keys (criar key nova; nunca commitar)
RESEND_API_KEY=re_<...>

RESEND_FROM_EMAIL=auth@studiotirra.com.br
ADMIN_PUBLIC_URL=https://admin.studiotirra.com.br

# Para chamadas internas Next → Express. Gerar: openssl rand -hex 32
BACKEND_INTERNAL_TOKEN=<cole_o_resultado>
BACKEND_INTERNAL_URL=http://backend:3001
```

**Hardening:**
- `chmod 600 /opt/influence-labs/infra/.env`
- Nunca dar `cat .env` por SSH com observador em call

---

## Passo 5 — Seed do primeiro admin user

Após Passo 6 (build do container) — porque o script vive em `frontend/admin/scripts/seed-admin-user.ts` e roda dentro da image.

```bash
docker compose exec admin-frontend \
  npx tsx scripts/seed-admin-user.ts tiago@studiotirra.com.br "Tiago Rocha"
```

Validar:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c \
  "SELECT email, name, active, created_at FROM admin_users;"
```

---

## Passo 6 — Deploy do admin-frontend

```bash
cd /opt/influence-labs/infra
git pull origin main
docker compose build admin-frontend admin-trinks-sync
docker compose up -d admin-frontend admin-trinks-sync

# Acompanhar logs primeiros 30s
docker compose logs -f --tail=50 admin-frontend
```

**O que esperar nos logs:**
- `Listening on http://0.0.0.0:3002`
- Sem `ZodError` (validação de env vars do Story 1.1 `lib/env.ts`)
- Sem `ECONNREFUSED` no Postgres

---

## Passo 7 — Smoke test pós-deploy

```bash
# 1. Login carrega 200
curl -I https://admin.studiotirra.com.br/login
# Esperado: HTTP/2 200, content-type: text/html

# 2. Asset estático carrega (verifica build standalone funcionou)
curl -I https://admin.studiotirra.com.br/_next/static/css/  # ou um asset real do build
# Esperado: 200 ou 304

# 3. Magic link endpoint responde
curl -i -X POST https://admin.studiotirra.com.br/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"naoexiste@example.com"}'
# Esperado: HTTP/2 200, body {"ok":true} (nao vaza existencia)

# 4. Rate limit auth funciona
for i in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://admin.studiotirra.com.br/api/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"x@y.com"}'
done
# Esperado: 200 200 200 200 200 429 429 (5/min)

# 5. Fluxo completo magic link → verify → cookie
# Manual: pedir magic link com email do Tiago, abrir link no navegador,
# inspecionar DevTools → Application → Cookies:
# - session: HttpOnly ✅, Secure ✅, SameSite=Lax ✅, Max-Age ~2592000
```

---

## Troubleshooting

### "cert não emitido / nginx falha ao subir"
- Checar `sudo ls /etc/letsencrypt/live/admin.studiotirra.com.br/`
- Se faltar: rodar Passo 2 Opção A. Se challenge falhar, DNS não propagou — usar `dig admin.studiotirra.com.br +short` e esperar até retornar `72.60.155.118`.

### "DNS não propagado"
- `dig admin.studiotirra.com.br @8.8.8.8 +short` → deve retornar `72.60.155.118`
- Pode levar até 4h. Adiar Passos 2/3 até propagar.

### "Migration não aplicada / tabelas faltando"
- Re-rodar Passo 1 (idempotente)
- Verificar no log: `docker exec -i postgres psql -U postgres -d influence_labs_salon -c "\dt admin_*"`

### "Env var faltando / app crash em loop"
- `docker compose logs admin-frontend | grep -i 'zod\|env'`
- Comparar `.env` do VPS com `infra/.env.example` (seção ADMIN DASHBOARD)
- ZodError com path `ADMIN_JWT_SECRET` → secret < 64 chars

### "Resend não envia email / domínio não verificado"
- Resend dashboard → Domains → `studiotirra.com.br` precisa estar **Verified**
- Adicionar SPF/DKIM no DNS (Resend mostra os records exatos)
- Em modo dev (domínio não verificado), Resend só envia pro email do dono da conta — bloqueia teste com Tiago

### "admin-trinks-sync em restart loop"
- Provavelmente o `dist/lib/trinks-sync-worker.js` não foi gerado no build (Story 1.1 pode não ter incluído transpilação do worker)
- Workaround: `docker compose stop admin-trinks-sync` até Story 1.4/Métricas implementar o sync. UI funciona sem ele.

---

## Rollback

Se algo der errado em produção:

```bash
# 1. Parar admin services (UI fica fora, resto do salão continua)
docker compose stop admin-frontend admin-trinks-sync

# 2. Reverter nginx (remove o mount admin.conf temporariamente)
sudo cp /opt/influence-labs/infra/nginx/conf.d/admin.conf{,.disabled}
sudo rm /opt/influence-labs/infra/nginx/conf.d/admin.conf
docker compose restart nginx

# 3. Rollback SQL (drop das tabelas novas)
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < /opt/influence-labs/infra/migrations/001_admin_dashboard.rollback.sql

# 4. Confirmar bot do salão continua respondendo
curl https://api.studiotirra.com.br/health
```

**Cert SSL:** não precisa revogar — fica idle, sem custo. Pode usar no próximo retry.

---

## Pós-deploy — checklist final

- [ ] DNS `admin.studiotirra.com.br` resolve `72.60.155.118`
- [ ] `https://admin.studiotirra.com.br/login` retorna 200 + UI carrega
- [ ] Magic link chega no inbox do Tiago (não em spam)
- [ ] Click no link cria session + redirect `/`
- [ ] Logout limpa cookie e revoga session no DB
- [ ] `admin_audit_log` registra `login`, `magic_link.sent`, `logout`
- [ ] `docker compose ps` mostra `admin-frontend` healthy, sem restart loop
- [ ] Cert SSL expira > 60d (`sudo openssl x509 -in /etc/letsencrypt/live/admin.studiotirra.com.br/fullchain.pem -noout -enddate`)
- [ ] `infra/scripts/renew-certs.sh` cobre `admin.studiotirra.com.br` (editar lista de domínios)

Após tudo verde → marcar Story 1.1 como **Done** + atualizar `MEMORY.md`.
