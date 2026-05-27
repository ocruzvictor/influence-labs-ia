# EPIC: Studio Tirra Admin Dashboard MVP

**Status:** Ready (pronto pra Fase 2 — @architect)
**Criado em:** 2026-05-26
**Owner:** @pm Morgan → @architect → @ux-design-expert → @dev
**Handoff origem:** [docs/handoffs/2026-05-26-frente-b-admin-dashboard.md](../../handoffs/2026-05-26-frente-b-admin-dashboard.md)

## Objetivo

Entregar um painel administrativo web onde **Tiago (dono)** e **Gabriel (supervisor)** gerenciam o atendimento do agente Studio Tirra sem precisar de SSH, curl ou edição manual de `.env`. Substitui a operação fragmentada atual (Trinks + WhatsApp + supervisor TESS + backend opaco) por uma UI única.

## Personas

| Persona | Foco principal | Frequência de uso |
|---------|----------------|-------------------|
| **Tiago Rocha** (dono) | Métricas de negócio, KB editor, decisões macro | Diário (manhã) |
| **Gabriel** (supervisor) | Conversas live, intervenção humana, toggle bot | Diário (turno) |

Ambos entram **quase todos os dias** — login não pode atritar. Decisão de auth (abaixo) reflete isso.

## Decisões fechadas (Victor + @pm, 2026-05-26)

| Decisão | Escolha | Racional |
|---------|---------|----------|
| **Stack frontend** | Next.js 15 + shadcn/ui + Tailwind | Ecossistema, server components, escala pra V2 |
| **Auth** | Magic link via email **+ sessão persistente longa** (30 dias, cookie httponly) + opção "lembrar dispositivo" | Magic link evita gerenciar senhas; sessão longa elimina fricção diária. Fallback se SMTP der ruim: senha simples por env só pro dono. **Architect decide SMTP provider** (Resend free tier sugerido). |
| **Hosting** | VPS Hostinger, subdomínio `admin.studiotirra.com.br` | Reusa nginx + SSL existente, zero custo extra |
| **Realtime** | Polling 5s (MVP), evolução pra SSE em V2 se necessário | Simples, suficiente pra volume atual |
| **Escopo MVP1** | **6 stories completas** do handoff (auth + conversas + toggle + métricas + KB + health) | Victor quer entrega full pra fechar a frente, não fatiar em V1.1/V1.2 |
| **Persistência** | Reusa Postgres `influence_labs_salon` existente; adiciona schemas próprios do dashboard (sessions, audit_log, kb_items) | Sem nova infra de DB |
| **Data source conversas** | `conversation_history` (já existe e populada) | Zero migração |

## Decisões pendentes (pra @architect na Fase 2)

1. Estrutura de monorepo? `frontend/admin/` no repo atual ou repo separado?
2. SMTP provider para magic link (Resend, Postmark, SES?)
3. Estratégia de session storage (DB table vs Redis vs JWT signed cookie?)
4. Como expor métricas Trinks (proxy via backend ou job que sincroniza pra Postgres local?)
5. KB editor: edita arquivos `.md` em disco direto ou migra KB pra tabela `kb_items` com versionamento?

## Arquitetura resultante (esperada)

```
Tiago/Gabriel (browser)
    ↕ https://admin.studiotirra.com.br
nginx (VPS 72.60.155.118)
    ↓ proxy → admin-frontend:3002 (Next.js)
              ↓ API routes / fetch
              backend/server.js:3001 (já existe, expor /admin/*)
                  ↓
            Postgres influence_labs_salon
            (conversation_history, clients,
             + novas: admin_users, admin_sessions,
                      admin_audit_log, kb_items, bot_toggles)
                  ↓
            Trinks API (proxy via backend)
```

## Escopo MVP1

### IN

- Login magic link com sessão persistente 30 dias
- Lista de conversas live (filtro por status: ativa/encerrada/takeover, busca por telefone/nome)
- Drill-down de conversa: timeline de mensagens com metadata (agent, timestamps, tokens)
- Toggle global do bot (kill switch)
- Toggle por número (whitelist/blacklist gerenciada via UI)
- Dashboard de métricas: agendamentos criados/dia, cancelamentos, no-shows, takeovers humanos, mensagens/dia, taxa de sucesso do bot (% conversas com agendamento)
- KB editor: CRUD em items da KB (com versionamento básico — quem editou, quando)
- Health visual: status `whatsapp_window`, TESS agent, Postgres, Trinks (consome `/health` existente)
- Audit log: tabela quem-mexeu-em-quê (KB edits, toggles, whitelist changes)

### OUT (V2+)

- Editor visual de fluxo conversacional (drag-drop)
- White-label / multi-tenant
- Mobile app nativo (mas responsive web é IN)
- Remarcação direta pelo painel (Tiago usa Trinks separado)
- Notificações push / email de alertas
- Multi-idioma
- Roles granulares (MVP: só "admin" — Tiago e Gabriel têm mesmos poderes)

## Stories (a serem criadas por @sm)

Sugestão de breakdown — @sm finaliza estrutura no `*draft` de cada uma.

| # | Story | Dependências | Story Points (estimativa) |
|---|-------|--------------|---------------------------|
| 1 | **Auth + base scaffold** (Next.js, shadcn, magic link, sessão 30d, layout shell) — [story 1.1](../admin-dashboard-story-1.1-auth-scaffold.md) · ✅ Ready | — | 8 |
| 2 | **Conversas live** (lista, filtros, drill-down timeline, polling 5s) | #1 | 8 |
| 3 | **Toggle bot** (global + por número, endpoints backend, audit log básico) | #1 | 5 |
| 4 | **Métricas dashboard** (4-6 KPIs, queries Postgres, gráficos simples) | #1 | 8 |
| 5 | **KB editor** (CRUD items com versionamento, migração de `data/kb/conversa-v2/*.md` pra tabela `kb_items`) | #1 | 8 |
| 6 | **Health visual + audit log viewer** (consome `/health`, tela audit) | #1, #3 | 5 |

**Total estimado:** ~42 pontos. Em ritmo de 1 story/semana, ~6 semanas. Paraleliza 2 e 3 após 1 mergeada.

## Critério de Pronto (Definition of Done — Epic)

- [ ] 6 stories Done (QA gate PASS)
- [ ] `admin.studiotirra.com.br` no ar com SSL Let's Encrypt
- [ ] Tiago e Gabriel com login funcional (testado por ambos)
- [ ] Conversa real do dia visível no painel em <5s do envio
- [ ] Toggle bot testado (desliga → mensagem não responde → religa → responde)
- [ ] KB edit refletida na próxima conversa do bot (TESS lê do novo source)
- [ ] Métricas batem com `/health` e com dados reais Trinks da semana
- [ ] Backup do Postgres cobrindo novas tabelas (admin_*, kb_items, audit_log)
- [ ] Documentação: README do `frontend/admin/` + runbook deploy + manual de usuário pra Tiago

## Métricas de sucesso (pós-launch)

- Tiago/Gabriel acessam ≥4x/semana cada
- Zero edição manual de `.env` pra whitelist após launch
- KB atualizada por Tiago sem ajuda de dev em ≤30d
- Tempo médio pra Gabriel detectar conversa precisando intervenção: <2min (vs hoje, depende de reativo)

## Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Magic link com SMTP problemático (delivery, spam) | Média | Alto (bloqueia login) | Sessão 30d minimiza dependência; fallback de senha por env pro dono |
| KB migration de arquivos `.md` pra DB quebra fluxo TESS | Média | Alto | Story 5 implementa shim que mantém arquivos como source-of-truth até cutover validado |
| Polling 5s gera carga no Postgres com muitas conversas | Baixa (volume atual baixo) | Médio | Indexar `conversation_history(created_at, phone)`; cache em memória 2s no backend |
| Subdomínio `admin.*` exposto sem WAF/rate-limit | Média | Alto (auth attacks) | nginx rate limit + fail2ban + magic link sem brute force |
| Métricas Trinks via API têm latência/rate limit | Média | Médio | Job de sync periódico (1h) populando tabela local |
| Tiago não adota o painel (continua usando WhatsApp/SSH) | Baixa | Alto (epic perde valor) | Onboarding com Tiago + Gabriel ANTES de declarar Done; métrica de adoção é critério de sucesso |

## Recursos relevantes (input pra @architect e @dev)

- `backend/server.js` — endpoints existentes (`/health`, `/admin/*`), ponto de extensão
- `infra/docker-compose.yml` — adicionar serviço `admin-frontend`
- `infra/nginx/conf.d/` — config nginx pra subdomínio admin
- `design-system/` — tokens visuais Studio Tirra (paleta, tipografia)
- `frontend/demo-chat.html` — reference pattern (chat widget atual)
- `data/kb/conversa-v2/*.md` — KB atual (source pra migração na story 5)
- Schema Postgres: `conversation_history`, `clients` (já existem)

## Próximo passo

```
@architect
*chat sobre tech design do EPIC studio-tirra-admin-dashboard.md — fechar as 5 decisões pendentes
```

Depois:
```
@ux-design-expert
*chat wireframes das 6 telas
```

Depois:
```
@sm
*draft (story 1: Auth + base scaffold)
```

## Change Log

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-26 | @pm Morgan | Epic criado com 5 decisões fechadas, 6 stories sugeridas, escopo MVP1 = tudo |
| 2026-05-26 | @architect Aria | Tech design completo em `docs/architecture/admin-dashboard.md` — 5 decisões pendentes resolvidas |
| 2026-05-26 | @data-engineer Dara | Migration `001_admin_dashboard.sql` + rollback + README criados em `infra/migrations/` |
| 2026-05-26 | @ux-design-expert Uma | Wireframes low-fi das 6 telas em `docs/design/admin-dashboard/wireframes.md` |
| 2026-05-26 | @sm River | Story 1.1 (Auth + scaffold) draftada |
| 2026-05-26 | @po Pax | Story 1.1 validada 9/10 GO → Ready |
| 2026-05-27 | @sm River | Stories 1.3 (UI conversas live) e 1.4 (UI toggle+whitelist) draftadas — consomem API entregue pela 1.2-DATA. Stubs do drill-down ficam disabled em 1.3 e são ativados em 1.4. Atalhos teclado movidos pra story polish futura. |
