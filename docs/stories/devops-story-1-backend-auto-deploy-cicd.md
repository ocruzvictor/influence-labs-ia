# Story — Backend Auto-Deploy CI/CD (GitHub Actions + GHCR)

**Status:** Draft
**Owner:** @devops (Gage)
**Data:** 2026-05-27
**Branch:** `feature/devops-auto-deploy-backend` (criada a partir de `main` @ `9f3a435`)
**Origem:** Investigação do vazamento `<break>` (sessão 2026-05-27) — diagnóstico: drift entre `main` e binário em prod
**Issue raiz:** [#10](https://github.com/ocruzvictorpareto/influence-labs-ia/issues/10)
**Sub-issues bloqueantes (pré-reqs):**
- A — `commit_sha` em `GET /health` (não criada — bloqueada por classifier, pendente)
- B — Decisão canal notificação falha (idem)
- C — Validar SIGTERM graceful shutdown (idem)

---

## Contexto

Em **2026-05-27 09:28:30 BRT**, o bot Studio Tirra enviou uma mensagem ao Victor com `<break>` literal vazado (separador interno do multi-bubble splitter da Conversa v3). Investigação completa em `docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md` validou que **o código está correto** — splitter funciona perfeitamente isolado.

**Causa raiz:** o PR #6 (splitter, commit `dc10a57`) foi mergeado na `main` há ~1 dia, mas o container backend no VPS **não foi rebuildado** naquele momento. O splitter só entrou efetivamente em prod hoje às 12:37 UTC, quando o deploy do PR #8 (admin-data-layer) forçou `docker compose up -d --build backend` e levou o splitter "de carona".

**Janela de drift:** ~24h em que `main` divergia do binário rodando em prod. Bugs visíveis ao cliente. Time perde tempo investigando "bug" que é deploy não aplicado.

Esta story elimina a janela: **toda mudança mergeada na `main` que toque o backend dispara rebuild + restart automático em prod, com smoke test de versão e notificação de falha.**

## Acceptance Criteria

### Funcional

- [ ] Workflow `.github/workflows/deploy-backend.yml` criado
- [ ] Trigger: `push` em `main` com paths `backend/**`, `infra/docker-compose.yml`, `data/kb/**`, ou o próprio workflow
- [ ] Build de imagem Docker na GitHub Actions runner (não no VPS) — preserva RAM do VPS
- [ ] Push pra GitHub Container Registry (`ghcr.io/ocruzvictorpareto/influence-labs-backend:{sha}` + `:latest`)
- [ ] VPS faz `docker compose pull` + `docker compose up -d` (sem build local) — zero downtime perceptível
- [ ] Smoke test pós-deploy: `curl https://api.studiotirra.com.br/health` → assert `200 OK` E `commit_sha == ${{ github.sha }}`
- [ ] Falha em qualquer etapa dispara notificação (canal decidido em sub-issue B)
- [ ] Concorrência: `concurrency: { group: deploy-backend, cancel-in-progress: false }` — múltiplos merges entram em fila, não em race

### Não-funcional

- [ ] Secret `VPS_SSH_KEY` configurado no GitHub Actions (chave deploy dedicada, não a do Victor)
- [ ] Secret `GHCR_PAT` ou usar `GITHUB_TOKEN` nativo pra push de imagem
- [ ] Tempo total runner → smoke pass: **< 5 min** (target; aceitável até 8 min)
- [ ] Pipeline tem kill-switch (env var `DEPLOY_PAUSED=true` ou disable workflow no painel) documentado
- [ ] Tag de rollback: última imagem que passou smoke é taggeada `:last-good` — `docker compose up -d` com essa tag = rollback em ~30s

### Documentação

- [ ] `docs/ops/auto-deploy-runbook.md` cobrindo: como pipeline opera, como pausar, como fazer rollback manual, como ler logs de falha
- [ ] Story `salon-whatsapp-conversa-v3-splitter-backend.md` recebe nota no Change Log linkando esta story (encerra dívida operacional do smoke pendente)
- [ ] README do repo menciona o deploy automático

## Pré-requisitos (sub-issues filhas — não criadas ainda)

| Sub-issue | Bloqueia AC | Esforço | Status |
|---|---|---|---|
| A — `commit_sha` em `/health` | smoke versionado | ~30min | Pendente (classifier bloqueou) |
| B — canal notificação | failure alerting | 15min decisão + 30min impl | Pendente |
| C — SIGTERM graceful | zero req perdido em restart | 30-60min validar | Pendente |

**Esta story só pode entrar em InProgress depois que A, B, C estejam Done ou Waived.**

## Implementação sugerida

### Estrutura do workflow

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'infra/docker-compose.yml'
      - 'data/kb/**'
      - '.github/workflows/deploy-backend.yml'

concurrency:
  group: deploy-backend
  cancel-in-progress: false

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: echo "tag=${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ghcr.io/ocruzvictorpareto/influence-labs-backend:${{ github.sha }}
            ghcr.io/ocruzvictorpareto/influence-labs-backend:latest
          build-args: |
            COMMIT_SHA=${{ github.sha }}
            BUILD_TIME=${{ github.event.repository.updated_at }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}
      - run: |
          ssh -o StrictHostKeyChecking=no deploy@72.60.155.118 << 'EOF'
            cd /opt/influence-labs/infra
            export BACKEND_IMAGE_TAG=${{ needs.build-and-push.outputs.image_tag }}
            docker compose pull backend
            docker compose up -d backend
          EOF
      - name: Smoke test
        run: |
          for i in 1 2 3 4 5; do
            sleep 5
            response=$(curl -sf https://api.studiotirra.com.br/health) || continue
            sha=$(echo "$response" | jq -r .commit_sha)
            if [ "$sha" = "${{ github.sha }}" ]; then
              echo "✓ Smoke PASS — commit_sha=$sha"
              exit 0
            fi
          done
          echo "✗ Smoke FAIL — /health não reporta SHA esperado ${{ github.sha }}"
          exit 1
      - name: Tag last-good on success
        if: success()
        run: |
          ssh deploy@72.60.155.118 \
            "docker tag ghcr.io/ocruzvictorpareto/influence-labs-backend:${{ github.sha }} \
             ghcr.io/ocruzvictorpareto/influence-labs-backend:last-good"
      - name: Notify on failure
        if: failure()
        run: |
          # Implementação depende da sub-issue B
          echo "DEPLOY FAILED — implementar canal de notificação"
          exit 1
```

### Mudanças adjacentes necessárias

1. **`backend/Dockerfile`** — adicionar build args + envs (sub-issue A)
2. **`infra/docker-compose.yml`** — campo `image:` ao invés de `build:` no service backend, lendo `BACKEND_IMAGE_TAG` env. Manter `build:` em fallback dev local
3. **`backend/server.js`** — `/health` retorna `commit_sha` + `build_time` (sub-issue A)
4. **VPS** — gerar par de chaves SSH dedicada pro deploy (user `deploy`), adicionar pub key em `~/.ssh/authorized_keys`, private key como `VPS_SSH_KEY` secret

## Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Push de imagem inflada (node_modules dev) | Média | Multi-stage Dockerfile com `npm ci --production` no estágio final |
| SSH key vaza via log | Alta | Usar `webfactory/ssh-agent` (não imprime), nunca `echo $VPS_SSH_KEY` |
| Smoke falsamente PASS (cache CloudFlare/nginx) | Média | `/health` é dynamic, `Cache-Control: no-store` no response |
| GHCR rate limit | Baixa | Pull com `GITHUB_TOKEN` no VPS — não anônimo |
| Concorrência com migration | Alta | **Migrations FORA do escopo desta story** — manter manual com aviso no Change Log |
| Rebuild backend mata conversa em vôo | Média | Sub-issue C (SIGTERM graceful) é bloqueante |

## Out of Scope

- Auto-deploy de `admin-frontend` (story separada — estrutura é Next.js, diferente pipeline)
- Auto-deploy de containers terceiros (postgres, redis, nginx, chatwoot)
- Auto-aplicação de migrations DB (manter manual — risco maior, deciders Tiago/Victor)
- Rollback automático em failure (apenas tag `:last-good` + comando manual — auto-rollback é P2)
- Multi-environment (staging) — só prod nesta iteração

## Métricas de sucesso

- **Lead time merge → prod ativo:** baseline atual ~indeterminado (manual). Target pós-story: <5 min.
- **Drift detectado em incidentes:** baseline 1 (este caso). Target: 0 por 90 dias.
- **Deploys revertidos via `:last-good`:** registrar histórico, esperado <1/mês.

## Change Log

- **2026-05-27** — Draft criada por @devops (Gage) durante sessão de investigação do `<break>` leak. Branch `feature/devops-auto-deploy-backend` aberta a partir de `main@9f3a435`.

## Notas pro @po (validação)

- Story tem 3 sub-issues pré-req **ainda não criadas** (classifier bloqueou em YOLO). Sem elas, AC#1 (`commit_sha`), AC#6 (notificação) e validação de graceful shutdown ficam sem âncora.
- Recomendo conditional GO: aprovar story estruturalmente mas marcar "InProgress só após sub-issues A/B/C abertas e priorizadas".
- Opção alternativa: fundir A e C na própria story (são pequenos), manter B como decisão de produto separada.
