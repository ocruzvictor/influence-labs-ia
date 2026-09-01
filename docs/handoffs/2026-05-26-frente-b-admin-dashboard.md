# Handoff — Frente B: Painel Admin / Dashboard Gerencial

**Data:** 2026-05-26
**Status:** Ready to start
**Owner inicial:** @pm → @architect → @ux-design-expert → @dev

## Contexto

Studio Tirra precisa de uma interface web pra Tiago (dono) e a recepção (supervisor) gerenciarem o atendimento sem precisar de SSH/curl/Trinks-painel-cru. Hoje a operação é fragmentada:

- **Trinks** (sistema de agendamento): painel próprio, fora do nosso controle
- **WhatsApp Business** (Kapso): inbox da recepção, sem analytics próprios do bot
- **Supervisor matinal** (TESS 46590): manda resumo via WhatsApp, mas não tem UI
- **Backend** (`/health`, `/admin/*`): só endpoints, sem UI
- **Postgres `influence_labs_salon`**: tem `conversation_history`, `clients`, dados de uso — mas nada visualizado

A frente B unifica isso num painel administrativo.

## Goal

MVP de dashboard web onde Tiago e a recepção podem:

1. **Ver conversas em tempo real** — todas as conversas ativas, com filtro/busca
2. **Toggle bot on/off** — global ou por número (whitelist mgmt sem editar `.env`)
3. **Editar KB** — adicionar/remover info estática, FAQ, preços, etc. (hoje vive em `data/kb/conversa-v2/`)
4. **Ver métricas** — agendamentos criados, cancelamentos, no-shows, conversas atendidas, takeovers humanos, mensagens/dia, % de sucesso do bot
5. **Acompanhar saúde técnica** — `/health` mas visual (whatsapp_window, TESS agent, postgres uptime)
6. **Logs de auditoria** — quem mexeu em quê (KB, whitelist, toggles)

## Não é o escopo do MVP

- Editor visual de fluxo conversacional (drag-drop) — V2+
- White-label / multi-tenant pra outros salões — V2+
- Mobile app nativo — V2+ (mas responsive web sim)
- Integração direta com Trinks pra remarcação manual pelo painel — V2+ (Tiago usa Trinks separadamente)

## Workflow sugerido

### Fase 1 — Requirements (@pm Morgan)

1. `*create-epic` Studio Tirra Admin Dashboard MVP
2. Quebra em stories (sugestão de 6 stories alinhadas com os goals acima)
3. Define prioridades (MVP1 = quais features bloqueiam launch interno; MVP2 = quais ficam pra depois)
4. Documenta personas: Tiago (dono, foco em métricas + KB) vs recepção (operador, foco em conversas + intervenção)

### Fase 2 — Tech design (@architect Aria)

1. Decisão: app web standalone? Adicionar rota `/admin` no backend Express atual?
2. Stack frontend: Next.js? Vite + React puro? HTML+Alpine pra MVP rápido?
3. Auth: simples (basic auth via env), Magic link (email), OAuth Google? — Tiago/recepção são poucos usuários
4. Persistência: usa o Postgres existente (`influence_labs_salon`) ou adiciona schema próprio?
5. Realtime: SSE / WebSocket / polling 5s?
6. Hosting: mesma VPS (subdomínio `admin.studiotirra.com.br`)?

### Fase 3 — UI/UX (@ux-design-expert Uma)

1. Wireframes das 5-6 telas principais (Conversas, Métricas, KB Editor, Saúde, Toggles, Auditoria)
2. Sistema de design — pode reaproveitar o do Studio Tirra (`design-system/`) ou usar shadcn/ui
3. Mobile-first responsive
4. Acessibilidade básica

### Fase 4 — Implementação (@dev Dex)

Story-driven. Implementar em ordem:

1. **Auth** — login mínimo viável
2. **Conversas live** — lista + drill-down em uma conversa específica
3. **Toggle bot** — global + por número
4. **Métricas básicas** — agendamentos/dia, cancelamentos, no-shows, conversas
5. **KB editor** — CRUD em `data/kb/conversa-v2/*.md` ou tabela DB
6. **Health visual** — `/health` em UI bonita

### Fase 5 — Deploy

Pipeline standard via @devops:
1. `git push origin feature/admin-dashboard-mvp`
2. `gh pr create`
3. QA gate @qa
4. Merge + deploy VPS

## Decisões pendentes (precisam Victor antes da Fase 2)

1. **Stack frontend** — qual?
2. **Auth** — qual?
3. **Hosting** — mesma VPS subdomínio admin? Vercel separado?
4. **Realtime** — necessário no MVP ou polling 5s já resolve?
5. **Quais métricas no MVP1** — qual subset cobre 80% do valor?

Sugiro Victor + @pm fechar essas 5 decisões antes de invocar @architect.

## Dados disponíveis hoje (input pro dashboard)

Schema atual em Postgres `influence_labs_salon`:

- `conversation_history (id, phone, role, content, agent, created_at)` — todas as msgs (incluindo passive logging)
- `clients (id, phone, name, ...)` — cadastro extraído via TESS
- Trinks API — agendamentos, profissionais, serviços (não está no DB local)
- Backend in-memory — `humanHandledUntil`, `lastTiagoInboundAt`, `sessionState`

Backend já tem endpoints admin parciais (`/health`, `/admin/...`) — verificar antes de duplicar.

## Inputs esperados de Victor

Antes de chamar @pm:

- [ ] Lista priorizada das funções mais críticas pro MVP1 (ranking)
- [ ] Decidir stack frontend (sugiro shadcn/ui + Next.js pelo ecossistema, mas Vite+React é mais leve)
- [ ] Decidir auth (sugiro magic link pela simplicidade)
- [ ] Decidir hosting (sugiro mesma VPS, subdomínio `admin.studiotirra.com.br`, behind nginx que já existe)
- [ ] Quais métricas você quer ver primeiro?

## Comando pra começar

```
@pm
*create-epic Studio Tirra Admin Dashboard MVP
```

Ou se preferir começar discutindo o escopo informalmente antes do epic:

```
@analyst
*chat sobre painel admin Studio Tirra — quero ranquear features pro MVP1
```

## Recursos relevantes

- `backend/server.js` — endpoints existentes, ponto de extensão
- `infra/docker-compose.yml` — pra adicionar serviço admin se for separado
- `infra/nginx/conf.d/` — config nginx pra adicionar subdomínio
- `design-system/` — tokens visuais existentes do Studio Tirra
- Reference patterns: `frontend/demo-chat.html` (chat widget atual)
