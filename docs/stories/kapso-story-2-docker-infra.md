# Story 2: Dockerize Backend + nginx api.studiotirra.com.br

**Epic:** EPIC-kapso-vps-migration
**Status:** Ready
**Agente executor:** @dev / @devops
**Pode executar agora:** ✅ SIM (código, não requer QR code — deploy só no final)

## Objetivo

Empacotar o `backend/server.js` em Docker e integrá-lo ao `docker-compose.yml` do VPS, expondo via nginx em `https://api.studiotirra.com.br`.

## Acceptance Criteria

- [ ] `backend/Dockerfile` criado — build limpo, sem dev dependencies
- [ ] Serviço `backend` adicionado ao `infra/docker-compose.yml`
- [ ] nginx roteia `api.studiotirra.com.br` → `backend:3001`
- [ ] `proxy_read_timeout 35s` configurado (TESS pode demorar)
- [ ] SSL incluído no server block (certificado SAN já cobre `api.studiotirra.com.br`)
- [ ] `/health` endpoint respondendo via `https://api.studiotirra.com.br/health`
- [ ] Backend não expõe porta 3001 diretamente (só via nginx)

## Tarefas

### backend/Dockerfile

- [ ] Criar `backend/Dockerfile`:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY server.js ./
  EXPOSE 3001
  CMD ["node", "server.js"]
  ```
- [ ] Verificar que `package.json` tem `"start": "node server.js"` (ou usar CMD direto)
- [ ] Confirmar que todas as dependências estão no `dependencies` (não só `devDependencies`)

### infra/docker-compose.yml — adicionar serviço backend

- [ ] Adicionar serviço `backend` após os serviços existentes:
  ```yaml
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: backend
    restart: unless-stopped
    environment:
      - PORT=3001
      - TESS_API_BASE=${TESS_API_BASE}
      - TESS_API_TOKEN=${TESS_API_TOKEN}
      - TESS_AGENT_ID=${TESS_AGENT_ID}
      - TRINKS_API_BASE=${TRINKS_API_BASE}
      - TRINKS_API_KEY=${TRINKS_API_KEY}
      - TRINKS_ESTABELECIMENTO_ID=${TRINKS_ESTABELECIMENTO_ID}
      - KAPSO_WEBHOOK_SECRET=${KAPSO_WEBHOOK_SECRET}
    networks:
      - influence_net
    # Sem ports: — não expõe porta diretamente, apenas via nginx
  ```
- [ ] Confirmar que `influence_net` (ou o nome da network usada) já existe no compose

### infra/nginx/default.conf — server block api.studiotirra.com.br

- [ ] Adicionar upstream:
  ```nginx
  upstream backend_upstream {
    server backend:3001;
  }
  ```
- [ ] Adicionar server block HTTP (redirect):
  ```nginx
  server {
    listen 80;
    server_name api.studiotirra.com.br;
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }
    location / {
      return 301 https://$host$request_uri;
    }
  }
  ```
- [ ] Adicionar server block HTTPS:
  ```nginx
  server {
    listen 443 ssl http2;
    server_name api.studiotirra.com.br;

    ssl_certificate /etc/letsencrypt/live/n8n.studiotirra.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.studiotirra.com.br/privkey.pem;

    location / {
      proxy_pass http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 35s;
      proxy_connect_timeout 10s;
    }
  }
  ```

### infra/.env.example — variáveis do backend

- [ ] Adicionar seção:
  ```env
  # --- Backend ---
  TESS_API_BASE=https://api.tess.im
  TESS_API_TOKEN=
  TESS_AGENT_ID=33200
  TRINKS_API_BASE=https://api.trinks.com
  TRINKS_API_KEY=
  TRINKS_ESTABELECIMENTO_ID=243868
  KAPSO_WEBHOOK_SECRET=
  ```

## File List

- `backend/Dockerfile` — CRIAR
- `infra/docker-compose.yml` — adicionar serviço backend
- `infra/nginx/default.conf` — upstream + server blocks api.studiotirra.com.br
- `infra/.env.example` — vars do backend

## Notas

- O certificado SSL (SAN) já inclui `api.studiotirra.com.br` — confirmado no provisionamento do VPS
- `proxy_read_timeout 35s` é necessário porque TESS pode levar 20-30s em respostas longas
- O backend não precisa de volume persistido (sessões em memória — Render já funcionava assim)
- Se quiser persistência de sessão no futuro: adicionar Redis/Upstash (fora do escopo desta story)
