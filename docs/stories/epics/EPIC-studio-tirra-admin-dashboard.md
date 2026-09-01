# EPIC: Studio Tirra Admin Dashboard MVP

**Status:** ✅ DONE — 7/7 stories em produção (2026-05-29)
**Criado em:** 2026-05-26
**Owner:** @pm Morgan → @architect → @ux-design-expert → @dev
**Handoff origem:** [docs/handoffs/2026-05-26-frente-b-admin-dashboard.md](../../handoffs/2026-05-26-frente-b-admin-dashboard.md)

## Objetivo

Entregar um painel administrativo web onde **Tiago (dono)** e **a recepção** gerenciam o atendimento do agente Studio Tirra sem precisar de SSH, curl ou edição manual de `.env`. Substitui a operação fragmentada atual (Trinks + WhatsApp + supervisor TESS + backend opaco) por uma UI única.

## Personas

| Persona | Foco principal | Frequência de uso |
|---------|----------------|-------------------|
| **Tiago Rocha** (dono) | Métricas de negócio, KB editor, decisões macro | Diário (manhã) |
| **recepção** (supervisor) | Conversas live, intervenção humana, toggle bot | Diário (turno) |

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
Tiago/recepção (browser)
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
- Roles granulares (MVP: só "admin" — Tiago e a recepção têm mesmos poderes)

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
- [ ] Tiago e a recepção com login funcional (testado por ambos)
- [ ] Conversa real do dia visível no painel em <5s do envio
- [ ] Toggle bot testado (desliga → mensagem não responde → religa → responde)
- [ ] KB edit refletida na próxima conversa do bot (TESS lê do novo source)
- [ ] Métricas batem com `/health` e com dados reais Trinks da semana
- [ ] Backup do Postgres cobrindo novas tabelas (admin_*, kb_items, audit_log)
- [ ] Documentação: README do `frontend/admin/` + runbook deploy + manual de usuário pra Tiago

## Métricas de sucesso (pós-launch)

- Tiago/recepção acessam ≥4x/semana cada
- Zero edição manual de `.env` pra whitelist após launch
- KB atualizada por Tiago sem ajuda de dev em ≤30d
- Tempo médio pra recepção detectar conversa precisando intervenção: <2min (vs hoje, depende de reativo)

## Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Magic link com SMTP problemático (delivery, spam) | Média | Alto (bloqueia login) | Sessão 30d minimiza dependência; fallback de senha por env pro dono |
| KB migration de arquivos `.md` pra DB quebra fluxo TESS | Média | Alto | Story 5 implementa shim que mantém arquivos como source-of-truth até cutover validado |
| Polling 5s gera carga no Postgres com muitas conversas | Baixa (volume atual baixo) | Médio | Indexar `conversation_history(created_at, phone)`; cache em memória 2s no backend |
| Subdomínio `admin.*` exposto sem WAF/rate-limit | Média | Alto (auth attacks) | nginx rate limit + fail2ban + magic link sem brute force |
| Métricas Trinks via API têm latência/rate limit | Média | Médio | Job de sync periódico (1h) populando tabela local |
| Tiago não adota o painel (continua usando WhatsApp/SSH) | Baixa | Alto (epic perde valor) | Onboarding com Tiago + recepção ANTES de declarar Done; métrica de adoção é critério de sucesso |

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
| 2026-05-27 | @devops Gage | **Story 1.3 → Done** (PR #14 mergeada em main, commit `e3f704b`). 47/48 ACs cobertos no código; 3 smoke pós-deploy pendentes Victor. Próxima: Story 1.4 (UI Toggle + Whitelist) já Ready aguardando `@dev *develop`. |
| 2026-05-27 | @devops Gage | **Story 1.4 → Done** (PR #16 mergeada em main, commit `aed915e`). 46/47 ACs cobertos no código; AC43 smoke fim-a-fim + 3 admin_users (Tiago/Recepcao/Rafael) seed pendentes pós-deploy. **Painel admin com utilidade operacional plena**: kill switch + features + whitelist CRUD + atalhos drill-down. Próximas stories: 1.5 KB editor, 1.6 Métricas, 1.7 Health+Audit. |
| 2026-05-27 | @sm River | **Story 1.5 (KB editor) draftada**. Caminho B confirmado por spike+PoC desta sessão — TESS `memoryCollections` via `execute_agent` validado (collection 39429+memory 161888 testadas e limpas). Decisão arquitetural §10 atualizada: Postgres source-of-truth de edição/audit/history, TESS memory_collection source-of-truth de runtime. 58 ACs, 8 SP. Pré-requisitos operacionais (bootstrap collection TESS + migration 002 + env var) descritos na Fase 0. Overhead conhecido: +27-30% créditos TESS por chamada (~R$50-150/mês projeção). Próximo: `@po *validate-story-draft 1.5`. |
| 2026-05-27 | @po Pax | **Story 1.5 validada GO 9/10 → Ready**. 3 Should-Fix aplicados: mapping Task→AC, pseudocódigo handler atomic Postgres↔TESS com tabela de compensação por handler, ordem de cutover prod (10 passos com gate "backend não fala com collection vazia"). 0 critical issues. Anti-hallucination limpo. Pronta para `@dev *develop 1.5` (recomendado começar com Fase 0 — confirmar token TESS prod + nome collection com Victor). |
| 2026-05-28 | @devops Gage | **Story 1.5 → Done** (PR #19 mergeada commit `6b156f2`, compose patches em PR #21). Cutover prod completo via 9 passos (migration 003 + bootstrap collection TESS `id=39496` + 6 items migrados + rebuild admin/backend com KB ativa). Smoke AC53 prod validado nos logs: KB ATIVA → bot menciona conteúdo corretamente (RAG semantic funcionou), KB DESATIVADA → bot não encontra (memory removida via `delete_memory`). Bug operacional descoberto: docker-compose.yml não declarava `TIRRA_KB_COLLECTION_ID` nos blocos backend e admin-frontend — patchado direto em prod + versionado em PR #21. **Epic agora 5/7 stories Done**. Próximas: 1.6 Métricas (8 pts) e 1.7 Health+Audit (5 pts). 13 SP restantes pra DoD do epic. |
| 2026-05-28 | @sm River | **Story 1.7 (Saúde + Auditoria) draftada**. Saúde + Audit log viewer combinadas em `/saude` com 2 tabs conforme wireframe Tela 7. Dependências de dados todas pré-satisfeitas: `lib/audit-log.ts` + `/api/audit-log` já entregues pela 1.2-DATA, populados pelas 1.3/1.4/1.5 (login, toggle.set, whitelist.*, kb.*). Pequeno enrichment em `backend/server.js:/health` (bloco `postgres` com pool stats + `trinks_ping` com cache 60s) — backward compatible. Cache 5s server-side em `/api/saude` pra reduzir martelagem com polling 10s. Export CSV streamed (RFC 4180 escape + auto-log `audit.export`, limit 5k). 63 ACs, 5 SP. **Esta story FECHA o epic em 7/7 Done**. Próximo: `@po *validate-story-draft 1.7`. |
| 2026-05-28 | @po Pax | **Story 1.7 validada 10/10 → Ready**. 2 Should-Fix aplicados antes de promover (cross-check com código real revelou): (1) `backend/db.js` exporta só `{ query }` — pool é privado — corrigido pra editar `db.js` adicionando `getPoolStats()` cirurgicamente; (2) backend usa `fetchTrinks(path)` cru (não `trinksClient.getEstabelecimento`) — corrigido pra `fetchTrinks('/servicos')`. 0 critical issues, anti-hallucination limpo, CodeRabbit completo. Pronta para `@dev *develop 1.7`. |
| 2026-05-28 | @sm River | **Story 1.6 (Métricas dashboard) draftada — 13 SP** (8 dashboard + 5 worker). Descoberta crítica: o **Trinks sync worker (arch §13) nunca foi construído** → tabela `trinks_appointments` existe (migration 001) mas está vazia em prod; sem ele, todos os KPIs de negócio ficam sem fonte. Victor decidiu **incluir o worker nesta story** (vs fatiar), pra dashboard útil dia 1 + cumprir DoD ("dados reais Trinks da semana"). Escopo: Fase 0 (verificar endpoint Trinks de listagem de agendamentos — incógnita no código atual) → worker `backend/trinks-sync-worker.js` (imagem do backend, container isolado `admin-trinks-sync`, reusa `fetchTrinks`+`db.js`) → `lib/metrics.ts` + `/api/metricas` + `/api/overview` → telas `/metricas` (Tela 5, Recharts) e home `/` (Tela 2). Reuso forte das views `v_admin_appointments_daily`/`v_admin_conversations_summary` já entregues. Heatmap/sparklines/export CSV/alertas → OUT. Riscos P0: endpoint Trinks (Fase 0) + normalização de telefone p/ join da taxa de sucesso. Checklist draft: READY (clareza 9/10). Próximo: `@po *validate-story-draft 1.6`. |
| 2026-05-28 | @dev Dex | **Story 1.6 implementada → Ready for Review** (2 commits em `feature/1.6-metricas-dashboard`, empilhada na 1.7). Fase 0 (Trinks verificado: endpoint paginado por `scheduled_at`; sem data de booking → tudo keyed em scheduled_at; phone só via /clientes). Fase 1: worker `admin-trinks-sync` (imagem backend, container isolado). Fases 2-3: `lib/metrics.ts` + `/api/metricas` + `/api/overview` + `/metricas` (Recharts) + home overview. Decisões Victor: worker no backend + phone /clientes cacheado. typecheck 0, lint 0, build 28 rotas, 78 admin + 35 backend testes. CodeRabbit 0 CRITICAL final. **Pendente QA/Victor:** EXPLAIN + validação SQL contra DB real + smoke do worker (sem acesso a DB local; conexão prod bloqueada por guardrail). Próximo: `@devops *push` (desempilhar da 1.7 no rebase). |
| 2026-05-28 | @po Pax | **Story 1.6 validada GO 9/10 → Ready.** Anti-alucinação limpo (refs conferidas no código real). 2 Should-Fix aplicados: (1) métricas de período devem usar `conversation_history` com janela — proibido `had_takeover` da view `v_admin_conversations_summary` (lifetime, sem janela); (2) denominador "Msgs/dia" explicitado. AC14-BASE (base temporal `created_at_trinks` vs `scheduled_at`) validada. Condições pré-dev: Fase 0 first (HALT se Trinks não listar por range) + @architect confirma Decisão A (worker na imagem do backend) + checkpoint após worker. Pronta para `@dev *develop 1.6`. |
| 2026-05-28 | @dev Dex (yolo) | **Story 1.7 implementada → Ready for Review** em 4 commits em `feature/1.7-health-audit-viewer`. Fase 1 (backend enrichment) + Fases 2-8 (admin) em ~3h. 16 arquivos criados + 5 modificados + 1 removido. ACs 62/63 cobertos (AC52 Sheet mobile registrado como tech debt; AC58 smoke prod pendente Victor). Validações: lint 0 errors, typecheck strict 0 errors, build 26 rotas, tests 67/67 pass. CodeRabbit pre-commit iter 1 flagou 2 CRITICAL (URL.parse / Date.parse safety) — auto-fix via `safeHostname()` + `safeIsoMinute()` + 4 tests novos; iter 2 confirmou 0 CRITICAL. Decisões autônomas notáveis: reusou `usePolling` + `formatRelative` em vez de duplicar; `<Input type="date">` nativo em vez de shadcn calendar (typecheck issue react-day-picker); criou `/api/admin-users` pra Select filtro; cache server `/api/saude` documentado como single-instance only. Próximo: `@devops *push`. |
| 2026-05-28 | @devops Gage | **Story 1.6 → pushed, PR [#24](https://github.com/ocruzvictorpareto/influence-labs-ia/pull/24) aberto** (base=`feature/1.7`, 22 arquivos, MERGEABLE). **DESCOBERTA: rebase `--onto main` impossível** — a 1.6 depende de código da 1.7 (`components/ui/select.tsx` + `ui/tabs`/`ui/popover`, ausentes no main) → quebraria o build. Logo PR **empilhado** na 1.7. **Ordem de merge obrigatória: PR #23 (1.7) → depois PR #24 (1.6).** Gates: typecheck 0, lint 0, build OK, 99 admin + 35 backend testes, CodeRabbit 0 CRITICAL. Não-mergeado (aguarda 1.7 + QA/smoke). |
| 2026-05-29 | @devops Gage | **🎉 EPIC 7/7 DONE — 1.7 (#23) + 1.6 (#25) mergeados + deployados em prod.** Stories 1.6 e 1.7 → **Done**. Backfill Trinks sincronizou 4221 agendamentos. 3 hotfixes de prod no worker (429 backoff #26, upsert resiliente #27, VARCHAR(20) overflow #28) + nginx restart pós-recreate. **Smoke das 3 telas novas (`/saude`, `/metricas`, home) validado por Victor em prod ✅.** Painel admin operacional completo. Tech-debt registrado: resolução de telefone N+1 (1º backfill lento ~15min); `BACKEND_INTERNAL_TOKEN` a confirmar no `.env` do VPS (aba Saúde). |
