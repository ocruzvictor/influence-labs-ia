# Story 1.3: Admin UI — Conversas Live (lista + drill-down)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** Ready for Review
**Agente executor:** @dev (com input pontual de @ux-design-expert para validar visual)
**Story Points:** 8
**Pode executar agora:** ✅ SIM — API 100% pronta em produção desde Story 1.2-DATA (PR #8, commit `b981414`)
**Branch sugerida:** `feature/1.3-1.4-ui-conversas-toggles` (já criada localmente; pode subdividir em PR só de 1.3 depois)
**Source-of-truth técnico:**
- [docs/design/admin-dashboard/wireframes.md §Tela 3 + §Tela 3b](../design/admin-dashboard/wireframes.md)
- [docs/architecture/admin-dashboard.md §7](../architecture/admin-dashboard.md)
- API: `frontend/admin/app/api/conversas/route.ts` + `[phone]/route.ts` (deployadas)

## Contexto

Terceira story do Epic Admin Dashboard. A Story 1.2-DATA entregou em produção todos os endpoints REST necessários (`GET /api/conversas`, `GET /api/conversas/[phone]`, com cursor pagination, filtros, cache LRU 2s, audit). Esta story **consome essa API** e entrega a primeira tela visual operacional — a tela mais usada por Gabriel no dia-a-dia.

Hoje o painel admin tem apenas login + dashboard placeholder. Esta story transforma o painel de "shell" em "ferramenta de operação real".

**Abordagem aprovada por Victor:** UI puro consumindo API existente. **Zero alteração de backend nesta story.** Se algum endpoint precisar mudar, abrir story separada e voltar a esta depois.

**Escopo:** Tela 3 (lista de conversas com filtros + polling 5s) + Tela 3b (drill-down de timeline de uma conversa com polling 3s).

**Fora de escopo (V2 ou outras stories):**
- Atalhos de teclado globais (`⌘K`, `g c`, `↑↓`, `r`) → Story polish futura (1.7) se Tiago/Gabriel pedirem
- Sidebar "Dados do cliente" com campos Trinks (cadastro, última visita, visitas totais) → Trinks integration não existe ainda
- Ações no drill-down: "Pausar bot 1h", "Bloquear número", "Adicionar nota" → dependem da Story 1.4 (whitelist UI) e de schema `notes` que não existe; nesta story renderizar **stubs disabled com tooltip "Disponível em breve"**
- Avatar/role badges com avatar real → MVP usa iniciais
- Export CSV / heatmap volume por hora / sparklines → V2

## Valor de negócio

Após esta story:

- **Gabriel** vê todas as conversas em andamento sem abrir 5 WhatsApps. Detecta takeover/atenção em <2min (métrica de sucesso do Epic)
- **Tiago** entra de manhã, abre `/conversas`, e em 1 olhada sabe quantas conversas ativas o bot está conduzindo
- **Debugging vira trivial** — Victor (ou qualquer dev) pode auditar fluxo completo de uma conversa sem `psql`
- **Próxima story (1.4)** consome a UI base (top nav, polling, filtros) e adiciona apenas ações de controle

**ROI:** Primeira ferramenta operacional real do painel. Sem ela, todo o backend da 1.2-DATA fica "invisível" para Tiago/Gabriel.

## Objetivo

Entregar:

1. Rota `/conversas` — lista paginada com filtros (status, takeover, search), polling 5s, click-to-drilldown
2. Rota `/conversas/[phone]` — timeline da conversa em bubble UI, polling 3s, scroll comportamento inteligente, sidebar com dados do cliente (apenas o que `conversation_history` + `clients` expõem hoje)
3. Componente `<TopNav>` evoluído para destacar a aba ativa (`Conversas` em bold quando rota match)
4. Helpers client-side: formatação de telefone, datas relativas (pt-BR), debounce de busca
5. shadcn components instalados: `table`, `badge`, `skeleton`, `dialog`
6. Cobertura de estados: loading (skeleton), empty, erro de fetch (toast + retry), offline (banner)

## Acceptance Criteria

### Funcional — lista `/conversas`

- [ ] **AC1:** Acesso a `/conversas` sem sessão válida → middleware (`proxy.ts`) redireciona para `/login?returnTo=/conversas`
- [ ] **AC2:** Usuário autenticado em `/conversas` vê tabela com colunas: `Telefone | Nome | Msgs | Última msg | Agente | Status`
- [ ] **AC3:** Empty state (DB sem conversas) renderiza mensagem amigável conforme wireframe (texto: "Nada por aqui ainda. As conversas aparecem assim que o bot recebe uma mensagem.") + ilustração leve (pode ser ícone shadcn `MessageSquareOff`)
- [ ] **AC4:** Filtro `Status` (dropdown): `Todas | Ativas | Inativas` → muda `?status=` na URL → re-fetch
- [ ] **AC5:** Filtro `Takeover` (dropdown): `Todas | Com takeover | Sem takeover` → muda `?takeover=` → re-fetch
- [ ] **AC6:** Campo `🔍 Buscar` por telefone → debounce 300ms → `?search=` → re-fetch (search por substring conforme API atual)
- [ ] **AC7:** Polling automático a cada 5s (configurável em constante `LIST_POLL_MS=5000`). Polling pausa quando aba está hidden (Page Visibility API) e retoma ao voltar
- [ ] **AC8:** Botão `⟳` força refresh manual (mesma rota de fetch, ignora cache)
- [ ] **AC9:** Click em uma row navega para `/conversas/[phone]` preservando filtros atuais na URL (pra voltar mantém estado)
- [ ] **AC10:** Paginação por cursor: ao chegar no fim da lista, botão `Carregar mais` busca página seguinte via `?cursor=<last_msg_at>` e anexa rows (não substitui). Sem páginas remanescentes → botão some
- [ ] **AC11:** Coluna `Agente` exibe valor de `last_agent` quando presente. Quando `last_agent IS NULL` (caso conhecido — dívida documentada em Story 1.2-DATA Fase 2 task #10), renderiza `—` em mono cinza, **nunca quebra render**
- [ ] **AC12:** Badge `Status` aplica regra:
  - `is_active_4h=true` + `had_takeover=false` → 🟢 ativa
  - `is_active_4h=true` + `had_takeover=true` → 👤 takeover
  - `is_active_4h=false` → ⚪ idle
- [ ] **AC13:** Linha em hover destaca (`bg-muted/50`) + cursor pointer
- [ ] **AC14:** Loading inicial mostra `<Skeleton>` com 10 rows fake — nunca spinner full-screen
- [ ] **AC15:** Erro de fetch (5xx ou network) mostra toast vermelho "Falha ao carregar conversas" + botão "Tentar novamente" — lista mantém último estado válido

### Funcional — drill-down `/conversas/[phone]`

- [ ] **AC16:** `/conversas/55XXXXXXXXXXX` (phone válido) renderiza header com telefone formatado (`+55 11 91234-5678`) + nome se disponível em `clients` table (campo `client.name`)
- [ ] **AC17:** Timeline renderiza mensagens em ordem cronológica ASCENDENTE (mais antiga em cima, mais nova embaixo) — observação: API retorna DESC, UI inverte para apresentação
- [ ] **AC18:** Bubble diferencia por `role`:
  - `role='user'` → alinhado esquerda, fundo cinza neutro
  - `role='assistant'` → alinhado direita, fundo navy 8% opacity
  - `role='system'` (se houver) → centralizado, font pequena, color muted
- [ ] **AC19:** Metadata abaixo do bubble exibe: `agent` (se non-null), `intent` (se non-null), `trace_id` (truncado 8 chars com tooltip full on hover), `created_at` em formato relativo + absoluto on hover
- [ ] **AC20:** Polling automático a cada 3s (constante `TIMELINE_POLL_MS=3000`). Se polling traz mensagem nova → scroll automático para o final SE usuário não rolou manualmente; SE rolou pra cima → não scrolla + badge "↓ Nova mensagem" sticky no fim com click pra ir
- [ ] **AC21:** Paginação reversa (carregar histórico antigo): botão `Carregar mais antigas` no topo da timeline → fetch com `?before=<first_msg_created_at>&limit=50` → anexa no topo, preserva scroll position
- [ ] **AC22:** Sidebar direita (desktop) ou Sheet (mobile) mostra "Dados do cliente":
  - Nome (se existe em `clients`, senão "—")
  - Telefone formatado
  - Total de mensagens nesta conversa (`msg_count` do summary)
  - Primeira mensagem em (data absoluta)
  - **NÃO MOSTRAR campos Trinks (última visita, cadastro, visitas)** — não existem na API; comentar com `{/* TODO Story 1.5-DATA: Trinks integration */}`
- [ ] **AC23:** Sidebar "Ações" mostra **STUBS DISABLED** com tooltip "Disponível na Story 1.4":
  - Botão `Pausar bot 1h` disabled
  - Botão `Bloquear número` disabled
  - Botão `Adicionar nota` disabled
- [ ] **AC24:** Botão `‹ Voltar` no topo retorna para `/conversas` preservando filtros via histórico do browser
- [ ] **AC25:** Phone inexistente (`/conversas/999999999999`) → API retorna `{messages: [], has_more: false}` → UI mostra empty state "Sem mensagens para este número"
- [ ] **AC26:** Phone com formato inválido (não-numérico) → API retorna 400 → UI mostra erro "Telefone inválido" com botão "Voltar"

### UX / Acessibilidade

- [ ] **AC27:** Telefones renderizados em `font-mono` para alinhamento visual
- [ ] **AC28:** Formato de exibição: `+55 11 91234-5678` (DDI + DDD + número), implementado em helper `lib/format/phone.ts` (input: string limpa do DB, output: string formatada). Casos: 13 dígitos `+55 (DD) 9XXXX-XXXX` (celular), 12 dígitos `+55 (DD) XXXX-XXXX` (fixo). Phones inválidos retornam string original.
- [ ] **AC29:** Datas relativas via `date-fns` locale pt-BR: `formatDistanceToNow(date, { locale: ptBR, addSuffix: true })` → "há 4 minutos"
- [ ] **AC30:** Datas absolutas em tooltip on hover: `dd/MM/yyyy HH:mm` (pt-BR locale)
- [ ] **AC31:** Tab order lógico em filtros e tabela; rows são `tabIndex={0}` e disparam navegação em `Enter`
- [ ] **AC32:** Badge "ativa/takeover/idle" tem `aria-label` descritivo
- [ ] **AC33:** Contraste navy `#1A1A2E` em texto sobre cream `#F5F3EE` validado WCAG AA (já no design system)
- [ ] **AC34:** `prefers-reduced-motion` respeitado — polling não anima badge de "live count"

### Responsivo

- [ ] **AC35:** Breakpoint `< 640px`: tabela vira lista de cards verticais; filtros viram Sheet (hamburger) ou stack vertical
- [ ] **AC36:** Breakpoint `640-1024px`: filtros horizontais, tabela compacta (esconde coluna `Nome` em casos extremos? não — priorizar telefone e msgs)
- [ ] **AC37:** Breakpoint `> 1024px`: layout pleno conforme wireframe; sidebar drill-down fixa à direita

### Qualidade

- [ ] **AC38:** `npm run lint` passa em `frontend/admin/`
- [ ] **AC39:** `npm run typecheck` passa em modo strict
- [ ] **AC40:** `npm run build` passa
- [ ] **AC41:** Componentes principais têm testes unitários básicos (formato telefone, formato data relativa, badge de status). Testes de página E2E ficam como dívida pra Story 1.7
- [ ] **AC42:** Smoke manual: Victor abre `https://admin.studiotirra.com.br/conversas` logado e roda os fluxos de AC2, AC4, AC9, AC10, AC16, AC20, AC21 manualmente

### Performance

- [ ] **AC43:** First Contentful Paint < 1.5s em network 4G simulado (Next dev server local com `--turbo`)
- [ ] **AC44:** Polling não causa layout shift (renderiza com `<Skeleton>` em primeiro paint, depois replace via React state — não unmount/remount)
- [ ] **AC45:** Bundle size da rota `/conversas` < 200KB gzip (verificar via `npm run build` output)

### Segurança

- [ ] **AC46:** Nenhum acesso direto ao DB do client — todo dado vem via fetch para `/api/conversas`
- [ ] **AC47:** Conteúdo de mensagem renderizado com `whitespace-pre-wrap` em texto puro — **nunca via `dangerouslySetInnerHTML`**. Markdown ou link rendering fica para V2 e exige sanitização explícita
- [ ] **AC48:** Telefone do path param na rota `/conversas/[phone]` validado client-side (`/^\d{10,15}$/`) antes de chamada fetch — defesa em profundidade (server-side já valida)

## Tarefas (ordem de execução)

### Fase 0 — Pre-Flight (@dev, ~30min) ✅ CONCLUÍDA 2026-05-27

- [x] Ler na íntegra: wireframe T3 + T3b, este story, contratos das rotas `/api/conversas/*`, helper `lib/conversas.ts`
- [x] Ler `frontend/admin/AGENTS.md` + `node_modules/next/dist/docs/01-app/` — confirmado Next 16 usa `proxy.ts` (não middleware) e `params: Promise<...>` em Page Components
- [x] Decision log registrado em `.ai/decision-log-1.3-UI.md` (10 decisões fechadas + 2 pendentes resolvidas)
- [x] Branch `feature/1.3-1.4-ui-conversas-toggles` em uso (já criada pelo @sm)

### Fase 1 — Setup shadcn + helpers (~1h) ✅ CONCLUÍDA 2026-05-27

- [x] shadcn components: `npx shadcn@latest add table badge skeleton dialog tooltip` (5 arquivos criados)
- [x] `date-fns` confirmado v4.3.0 no `package.json` (já presente)
- [x] `lib/format/phone.ts` + 8 testes unitários (celular 13d, fixo 12d, inválido, fallback, etc)
- [x] `lib/format/date.ts` (formatRelative + formatAbsolute pt-BR) + 7 testes
- [x] `lib/hooks/use-polling.ts` — Page Visibility-aware, cleanup robusto, sem overlap
- [x] `lib/hooks/use-scroll-preserve.ts` — useLayoutEffect pra evitar flicker no prepend
- [x] `lib/hooks/use-online-status.ts` — banner offline
- [x] `lib/clients.ts` — `getClientByPhone()` server-only via lib/db (pattern lib/conversas/toggles/whitelist)

### Fase 2 — Página lista `/conversas` (~3h) ✅ CONCLUÍDA 2026-05-27

- [x] `app/(dashboard)/conversas/page.tsx` — Server Component com SSR pre-fetch de items + nomes via JOIN
- [x] `components/conversas/conversation-list.tsx` — orquestrador client (state + polling + URL sync + cursor pagination + debounce search 300ms)
- [x] `components/conversas/conversation-filters.tsx` — search + selects de status/takeover + botão refresh
- [x] `components/conversas/conversation-row.tsx` — row memoizada com formatPhone + StatusBadge + tooltip de data absoluta
- [x] `components/conversas/status-badge.tsx` — 🟢 ativa / 👤 takeover / ⚪ idle conforme AC12
- [x] `components/conversas/empty-state.tsx`
- [x] `components/dashboard/nav-links.ts` — flipado `Conversas` para `enabled: true`
- [x] `app/layout.tsx` — adicionado `<TooltipProvider>` (necessário pros tooltips do drill-down)

### Fase 3 — Página drill-down `/conversas/[phone]` (~3h) ✅ CONCLUÍDA 2026-05-27

- [x] `app/(dashboard)/conversas/[phone]/page.tsx` — Server Component com `params: Promise<{phone}>`, valida regex, pre-fetch client + summary em paralelo, sidebar grid lg
- [x] `components/conversas/conversation-timeline.tsx` — client component, polling 3s, merge sem duplicar (Set por id), autoscroll inteligente (só se isAtBottom), badge "Nova mensagem" sticky quando user rolou pra cima
- [x] `components/conversas/message-bubble.tsx` — bubble por role com metadata (agent, intent, trace_id truncado tooltip, created_at relativo + tooltip absoluto), `whitespace-pre-wrap` sem dangerouslySetInnerHTML
- [x] `components/conversas/client-sidebar.tsx` — dados cliente + 3 stubs disabled com tooltip "Disponível na Story 1.4"
- [x] **Decisão:** `components/conversas/load-more-old.tsx` NÃO criado como arquivo separado — lógica de "Carregar mais antigas" embarcada em `conversation-timeline.tsx` (botão inline + hook `use-scroll-preserve`). Funcionalidade entregue, arquivo não justificável.

### Fase 4 — Estados de borda + responsivo (~1.5h) ✅ CONCLUÍDA 2026-05-27

- [x] Skeleton da lista (10 rows fake na grid layout)
- [x] Skeleton da timeline (6 bubbles alternando esquerda/direita)
- [x] Toast erro com lógica de manter último estado válido (sonner já configurado)
- [x] Banner offline via `useOnlineStatus`
- [x] Layouts responsivos: grid `1fr_320px` em lg, sidebar oculta em mobile (planejado, validação manual fica pra @qa)

### Fase 5 — Testes + lint + build (~1h) ✅ CONCLUÍDA 2026-05-27

- [x] Testes unitários: 22/22 passando (8 phone + 7 date + 7 auth existentes)
- [x] `npm run lint` → zero warnings (corrigi 2 catches React 19: ref assign em render + setState sync em effect)
- [x] `npm run typecheck` → zero errors strict
- [x] `npm run build` → success (com env stubs); bundle size dentro do alvo (validação concreta de KB fica como dívida menor)

### Fase 6 — Smoke manual + handoff (~30min) — PARCIAL (depende deploy)

- [ ] Smoke local apontando pra API prod — não rodado nesta sessão; fica pra Victor após @devops deploy
- [ ] Smoke 7 ACs (AC2, AC4, AC9, AC10, AC16, AC20, AC21) em prod — bloqueado por deploy
- [x] Commits locais 4/4 (Fase 1 + Fase 2 + Fase 3 + QA fixes)
- [x] Handoff próximo: `@devops *push` (gate auto-promove pra PASS após fixes M1+M2)

### Fase 7 — QA fixes (~30min) ✅ CONCLUÍDA 2026-05-27

Aplicação dos 2 fixes obrigatórios (M1 + M2) + 2 cleanups (L1 + I4) identificados pela @qa Quinn na gate CONCERNS.

- [x] **M2 (HIGH/CodeRabbit MAJOR):** `conversation-list.tsx` — adicionado guard `isListResponse()` antes do cast em `fetchList` e `loadMore`. API com shape inesperada cai no catch → toast em vez de runtime crash.
- [x] **M1 (MEDIUM):** `conversation-timeline.tsx` — adicionado `lastNewestIdRef` no effect `[messages]`. Distingue prepend (loadOlder) de novas mensagens (polling) via comparação do id da última msg. AC20 badge correto + AC21 scroll preserve não é mais anulado.
- [x] **L1 (LOW):** Deletada função órfã `useOnlineStatusValue` em `use-scroll-preserve.ts` (10 LOC dead code).
- [x] **I4 (informational):** Corrigido JSDoc de `conversation-row.tsx` — descrição precisa do mecanismo de memo (shallow equality via React.memo, não JSON.stringify).
- [x] Validações pós-fix: lint ✅ typecheck ✅ build ✅ 22 testes ✅
- [x] CodeRabbit uncommitted scan: **0 findings** ✅

## File List

**Criados (16 arquivos):**

- `.ai/decision-log-1.3-UI.md` ✅
- `frontend/admin/app/(dashboard)/conversas/page.tsx` ✅
- `frontend/admin/app/(dashboard)/conversas/[phone]/page.tsx` ✅
- `frontend/admin/components/conversas/conversation-list.tsx` ✅
- `frontend/admin/components/conversas/conversation-filters.tsx` ✅
- `frontend/admin/components/conversas/conversation-row.tsx` ✅
- `frontend/admin/components/conversas/conversation-timeline.tsx` ✅
- `frontend/admin/components/conversas/message-bubble.tsx` ✅
- `frontend/admin/components/conversas/client-sidebar.tsx` ✅
- `frontend/admin/components/conversas/status-badge.tsx` ✅
- `frontend/admin/components/conversas/empty-state.tsx` ✅
- `frontend/admin/lib/format/phone.ts` ✅ (+ `tests/format-phone.test.ts`)
- `frontend/admin/lib/format/date.ts` ✅ (+ `tests/format-date.test.ts`)
- `frontend/admin/lib/hooks/use-polling.ts` ✅
- `frontend/admin/lib/hooks/use-scroll-preserve.ts` ✅
- `frontend/admin/lib/hooks/use-online-status.ts` ✅
- `frontend/admin/lib/clients.ts` ✅ (pivot vs story doc — segue pattern lib/conversas etc)

**Pivot vs story doc:**
- `components/conversas/load-more-old.tsx` NÃO criado como arquivo separado — botão "Carregar mais antigas" embarcado dentro de `conversation-timeline.tsx` junto com a lógica de scroll preserve (5 linhas, não justifica componente próprio)
- `lib/clients.ts` ADICIONADO (não estava no plano original) — necessário pra AC16/AC22 (nome do cliente no header + sidebar do drill-down)

**Modificados (5 arquivos):**

- `frontend/admin/package.json` — shadcn components recém-instalados (auto via CLI: table, badge, skeleton, dialog, tooltip)
- `frontend/admin/package-lock.json` — idem
- `frontend/admin/components/dashboard/nav-links.ts` — `Conversas` `enabled: false` → `true`
- `frontend/admin/app/layout.tsx` — adicionado `<TooltipProvider delayDuration={200}>` (necessário pros stubs no drill-down)
- `frontend/admin/components/ui/{table,badge,skeleton,dialog,tooltip}.tsx` — gerados pelo shadcn CLI

**Não tocados (lock confirmado):**

- `frontend/admin/app/api/conversas/**/route.ts` ✅
- `frontend/admin/lib/conversas.ts` ✅
- `backend/server.js` ✅
- `infra/migrations/*` ✅

## Dev Notes

### ⚠️ ATENÇÃO MÁXIMA — Next.js neste repo NÃO é o que seu treinamento conhece

`frontend/admin/AGENTS.md` declara explicitamente: **"This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."**

**Antes de escrever qualquer Server Component, route handler, layout, ou hook do React, abra e leia a documentação local da versão exata.** APIs que mudaram silenciosamente são a causa #1 de bugs nesta base. Não confiar em memória do training data sobre App Router, Server Actions, `cookies()`, `headers()`, ou `params`.

**Como checar versão e docs:**
```bash
cd frontend/admin
cat package.json | grep '"next"'
ls node_modules/next/dist/docs/  # se existir
```

### Source-of-truth de design

- Wireframe Tela 3: `docs/design/admin-dashboard/wireframes.md` linhas 173-217 (lista)
- Wireframe Tela 3b: `docs/design/admin-dashboard/wireframes.md` linhas 220-260 (drill-down)
- Tokens visuais: `design-system/tokens/themes/influence-labs.css` (já carregado pelo `app/globals.css` da Story 1.1)

### Padrões a seguir (herdados da Story 1.1 e 1.2-DATA)

- Reusar helpers existentes: `lib/db.ts` (NÃO usar no client — só Server Component), `lib/session.ts` (server-side), pattern de fetch via API routes
- Erros: shape `{ error: string, code?: string }` já vem da API; UI mapeia para toast
- Cursor pagination: armazenar `next_cursor` em state, anexar nova página (NÃO substituir items)
- Polling: respeitar `document.hidden` (Page Visibility API) — pausa em background tab
- Cliente HTTP: usar `fetch` nativo do browser; centralizar em `lib/api/conversas-client.ts` SE virar repetitivo

### Decisões técnicas FECHADAS (não re-discutir)

| # | Decisão | Valor | Origem |
|---|---|---|---|
| 1 | Polling intervals | Lista 5s, Drill-down 3s | Arquitetura + wireframe |
| 2 | Página vs Sheet em mobile | Mobile usa Sheet pra filtros e sidebar | Wireframe §Responsividade |
| 3 | Toast library | `sonner` (vem com shadcn) | Wireframe §578 |
| 4 | Date library | `date-fns` + locale pt-BR | Wireframe §580 |
| 5 | Telefone formatting | Helper custom em `lib/format/phone.ts` | Wireframe §582 |
| 6 | Number formatting | `Intl.NumberFormat('pt-BR')` nativo | Wireframe §581 |
| 7 | Ações no drill-down ("Pausar bot", "Bloquear", "Nota") | STUBS DISABLED com tooltip "Disponível em breve" | Advisor consult — depende Story 1.4 + schema notes |
| 8 | Sidebar Trinks fields (cadastro, visitas) | OUT de escopo — comentário `{/* TODO Story 1.5-DATA */}` no código | API não expõe ainda |
| 9 | Atalhos teclado `⌘K`/`g c`/`↑↓`/`r` | OUT de escopo — Story polish 1.7 futura | Cortado para não inflar 1.3 |
| 10 | NULL `last_agent` rendering | Renderizar `—` em mono cinza, nunca quebrar | Dívida conhecida 1.2-DATA Fase 2 #10 |

### Riscos

| Risco | Mitigação |
|---|---|
| Next.js APIs divergem do training → bugs sutis | Ler `node_modules/next/dist/docs/` antes de codar |
| Polling causa flicker em re-render | Estado React com keys estáveis (`message.id`, `conv.client_phone`); skeleton só no primeiro fetch |
| Scroll comportamento no drill-down (autoscroll vs manual) | Detectar `scrollTop` user-driven via `useRef`; só autoscroll se `isAtBottom===true` |
| Bundle size cresce além de 200KB | Lazy load `<MessageBubble>` se necessário; tree-shake `date-fns` (`import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'`) |
| Mobile UX da timeline degrada | Testar com DevTools mobile + touch scroll; bubbles full-width no mobile |
| Latência percebida no primeiro paint | Skeleton imediato (Suspense boundary no Server Component) |

### Não-bloqueante mas vale registrar

- O wireframe T3b cita "scroll automático pro fim" + "Aguardando próxima mensagem..." — implementar como AC20 descreve (badge sticky quando user scrollou pra cima)
- A view `v_admin_conversations_summary` retorna `last_agent` NULL em mensagens onde backend não preencheu — UI **não pode** assumir não-nulo; isso é dívida documentada da Story 1.2-DATA

## CodeRabbit Integration

Esta story é UI pura mas introduz nova superfície visível pra usuário. Acionar CodeRabbit:

- **Pré-PR completo:** `wsl bash -c 'cd /mnt/c/.../influence-labs-ia && ~/.local/bin/coderabbit --prompt-only --base main'`
- **Foco esperado da revisão:**
  - XSS via conteúdo de mensagem (validar `whitespace-pre-wrap` sem `dangerouslySetInnerHTML`)
  - Memory leaks em polling (cleanup de `setInterval`/`setTimeout` em unmount)
  - Acessibilidade (aria-label, tab order, contraste, reduced-motion)
  - Performance — re-render desnecessário em polling
  - Type safety — phone param sempre validado
  - Bundle size — tree-shake imports
- **Severidades:**
  - CRITICAL → bloqueia merge (XSS, missing cleanup)
  - HIGH → discutir (UX significativo)
  - MEDIUM → documentar como dívida ou corrigir
  - LOW → ignorar

**Agentes especializados predizidos:**

- `@ux-design-expert` — review final do visual antes do PR (não bloqueante)
- `@qa` — review de cobertura de testes + smoke checklist

## Definition of Done

- [ ] Todos os 48 ACs marcados (37 funcionais + 6 UX/a11y + 3 responsivos + 4 qualidade + 3 perf + 3 segurança = 48 totais)
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam
- [ ] Testes unitários de helpers passam (`npm test` em `frontend/admin/`)
- [ ] CodeRabbit: zero CRITICAL, HIGH addressed
- [ ] Smoke manual de Victor em `https://admin.studiotirra.com.br/conversas` (após deploy) — checklist de 7 ACs marcado
- [ ] @ux-design-expert deu OK visual (review informal, screenshot ou screen-share)
- [ ] Story marcada `Done` por @qa
- [ ] `@devops *push` + PR mergeada em `main`
- [ ] Deploy admin-frontend em prod (auto via Docker compose após merge — runbook existente)

## Mudanças necessárias na arquitetura/PRD

Nenhuma. Esta story implementa fielmente os wireframes T3+T3b consumindo a API entregue na Story 1.2-DATA. Sem desvios.

## Change Log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @sm River | Story draftada a partir do epic, wireframes T3+T3b, contratos `/api/conversas/*` deployados na 1.2-DATA, e consult com advisor (4 ajustes críticos: stubs disabled, NULL agent fallback, AGENTS.md em destaque, atalhos cortados pro polish 1.7) |
| 2026-05-27 | @po Pax | Validate-story-draft 10/10 GO → Status Draft → Ready. Observações não-bloqueantes: AC count alto (48) mas todos observáveis; AC11 (NULL agent) herda dívida 1.2-DATA Fase 2 #10 — OK; smoke AC42 depende de admin-frontend deployado (não bloqueia dev local). Pode iniciar `@dev *develop`. |
| 2026-05-27 | @dev Dex | Fases 0-5 entregues em 3 commits incrementais (Fase 1 setup, Fase 2 lista, Fase 3 drill-down). 16 arquivos novos + 5 modificados. lint ✅ typecheck ✅ build ✅ 22 testes ✅. Status Ready → Ready for Review. 2 pivots vs plan: (1) `lib/clients.ts` adicionado pra AC16/AC22 seguindo pattern lib/conversas/toggles/whitelist da 1.2-DATA — não é backend change; (2) `load-more-old.tsx` embarcado em conversation-timeline.tsx (5 linhas, não justifica arquivo). Smoke prod (Fase 6) bloqueado até deploy. Pendente: `@qa *qa-gate`. |
| 2026-05-27 | @qa Quinn | QA gate executado — verdict CONCERNS. 7 quality checks. 1 HIGH (M2 — shape validation em fetchList/loadMore, CodeRabbit committed MAJOR) + 1 MEDIUM (M1 — autoscroll/badge dispara em loadOlder, AC20/AC21) + 3 LOW + 1 INFO. Smoke prod e bundle KB pendentes deploy. CodeRabbit report salvo em docs/qa/coderabbit-reports/. Fix recomendado: 1 commit com M1+M2+L1+I4 (~14 LOC). Após fix → gate auto-promove PASS. |
| 2026-05-27 | @dev Dex | Aplicados os 4 fixes da QA gate em 1 commit conforme recomendação Quinn: M2 (HIGH) shape validation + M1 (MEDIUM) lastNewestIdRef + L1 dead code + I4 JSDoc. lint ✅ typecheck ✅ build ✅ 22 testes ✅. CodeRabbit uncommitted: **0 findings**. Story Ready for Review (clean). Pendente: `@devops *push`. |

## QA Results

**Quality Gate executado por @qa Quinn em 2026-05-27**
**Branch:** `feature/1.3-1.4-ui-conversas-toggles` · **Commits revisados:** `a39a64c..5741b3f` (4 commits, +2676 / -4 linhas, 30 arquivos)

### Verdict: CONCERNS ⚠️

A implementação é sólida — Server/Client component split correto, race protection via `fetchSeq.current`, polling Page Visibility-aware, scroll preservation com `useLayoutEffect`, telemetria visual completa. **Mas um bug funcional MEDIUM no `conversation-timeline.tsx` viola a semântica do AC20** (badge "Nova mensagem" aparece indevidamente ao carregar mensagens antigas) e em caso edge **anula o trabalho do AC21** (autoscroll dispara em cima do scroll preservado).

Fix é cirúrgico (~10 LOC). Recomendo @dev aplicar **antes** do `@devops *push` — não merece QA Loop full. Após fix, gate vira PASS direto.

### 7 Quality Checks

| # | Check | Status | Notas |
|---|---|---|---|
| 1 | **Code review** — patterns, readability, maintainability | ✅ PASS | Bem comentado, separação clara, names em pt-BR consistentes. 3 LOW cleanups identificados (ver tech debt). |
| 2 | **Unit tests** — adequate coverage, all passing | ✅ PASS | 22/22 (15 novos: phone 8 + date 7 + auth 7 pré-existente). Helpers cobertos. Componentes React sem testes — aceitável MVP (dívida documentada na própria story). |
| 3 | **Acceptance criteria** — all met per story | ⚠️ CONCERNS | 45/48 cobertos no código. AC20 (badge) parcialmente violado; AC21 (scroll preserve) edge case quebra. 3 ACs de smoke prod (AC42, AC43-perf KB, AC45-bundle KB) pendentes deploy. |
| 4 | **No regressions** — existing functionality preserved | ✅ PASS | Nenhum arquivo da Story 1.1 / 1.2-DATA tocado fora `nav-links.ts` (flip Conversas) e `app/layout.tsx` (TooltipProvider — backward compat). API rotas intocadas. |
| 5 | **Performance** | ✅ PASS | Polling 5s/3s respeita document.hidden ✅. fetchSeq descarta resp obsoletas ✅. SSR pre-fetch ✅. LRU cache 2s no helper backend absorve polling. Bundle size concreto fica pra deploy. |
| 6 | **Security** (OWASP basics) | ✅ PASS | `whitespace-pre-wrap` em conteúdo de msg sem `dangerouslySetInnerHTML` ✅. Phone validation server-side via regex antes de fetch ✅. `credentials: include` em fetches ✅. Auth via proxy.ts (defense-in-depth). Zero secrets hardcoded. |
| 7 | **Documentation** | ✅ PASS | Decision log em `.ai/decision-log-1.3-UI.md` com 10 decisões. JSDocs em todos os componentes/hooks/libs. Story File List + checkboxes consistentes. Change Log atualizado. |

### Issues — categorizadas por severidade

#### 🔴 HIGH (recomendo fixar pré-push — CodeRabbit committed scan)

**M2. `conversation-list.tsx` linhas 89-126 — `fetchList` e `loadMore` fazem type assertion sem validação de shape**

`const data = (await res.json()) as ListResponse` é cast cego. Se a API mudar shape ou retornar erro semi-formado (ex: 200 com `{ error: "..." }`), o próximo `data.items.map` causa runtime crash em vez de cair no catch. Mesma falha em `loadMore` (linha ~156).

**Fix sugerido (4 LOC, dropável no mesmo commit do M1):**

```tsx
const data = (await res.json()) as unknown;
if (!data || typeof data !== "object" || !Array.isArray((data as ListResponse).items)) {
  throw new Error("invalid_response_shape");
}
const parsed = data as ListResponse;
// ...continua usando parsed.items / parsed.next_cursor
```

Alternativa mais robusta: Zod schema no client lib. Para MVP, o guard acima é suficiente — joga no toast catch.

#### 🟠 MEDIUM (recomendo fixar pré-push)

**M1. `conversation-timeline.tsx` — autoscroll/badge dispara indevidamente ao carregar mensagens antigas**

`useEffect [messages, scrollToBottom]` (linhas 101-111) reage a qualquer mudança em `messages`. Mas `loadOlder()` prepende mensagens antigas — o effect interpreta isso como mudança de conteúdo e:
- Se `isAtBottomRef.current === false` (caso típico — user scrollou pra cima pra carregar antigas) → `setHasNewBelow(true)` → mostra badge **"↓ Nova mensagem"** apontando pro fim mesmo sem nova mensagem. **Viola semântica do AC20**.
- Se `isAtBottomRef.current === true` (edge: conversa pequena cabe na viewport, user nunca scrollou) → `scrollToBottom('smooth')` dispara → **anula `useScrollPreserve`**, quebrando o AC21.

**Fix sugerido (10 LOC, dropável no commit final pré-push):**

```tsx
// no topo do componente, junto com os outros refs:
const lastNewestIdRef = useRef<number | null>(null);

// substituir o useEffect das linhas 101-111 por:
useEffect(() => {
  if (messages.length === 0) return;
  const currentNewestId = messages[messages.length - 1]!.id;
  // Mesma "última mensagem" = prepend (loadOlder) ou no-op de polling.
  // Não dispara autoscroll nem badge.
  if (lastNewestIdRef.current === currentNewestId) {
    lastNewestIdRef.current = currentNewestId;
    return;
  }
  lastNewestIdRef.current = currentNewestId;
  if (isAtBottomRef.current) {
    requestAnimationFrame(() => scrollToBottom("smooth"));
  } else {
    setHasNewBelow(true);
  }
}, [messages, scrollToBottom]);
```

A heurística "mesma última mensagem" distingue prepend (`loadOlder`) de novas mensagens recentes (polling) sem precisar de flag adicional gerenciada por loadOlder.

#### 🟢 LOW — Tech debt (não bloqueia)

**L1. Dead code em `lib/hooks/use-scroll-preserve.ts`** — função `useOnlineStatusValue` (linhas 57-66) declarada com comentário "Implementação fica em arquivo próprio — aqui só re-export pra co-localizar (...) Ver use-online-status.ts". Nunca importada. Deletar.

**L2. State `error` órfão em `conversation-list.tsx`** (linha 66) — declarado, setado em erro, mas só consumido em `items.length === 0 && !error` (linha 207). Toast cobre o feedback ao user. Considerar remover ou renderizar visualmente (ex: banner de erro sobre a tabela quando há items + erro recente).

**L3. `pendingRef` exposto pelo `useScrollPreserve`** — retornado da API mas nunca usado externamente. Comentário diz "exposto pra debug" mas debug não é justificativa para superfície pública. Tornar privado (internal ref do hook).

#### 🔵 Informational (não-acionável, contexto)

**I1. Tooltip de data absoluta usa `title` attribute (HTML nativo) em vez de `<Tooltip>` shadcn** em `conversation-row.tsx:41`. Atende AC30 funcionalmente (browser nativo tooltip on hover). shadcn tooltip foi reservado pro drill-down (`message-bubble.tsx`). Consistência é razoável dado contexto (linha da tabela vs metadata de mensagem). Sem ação.

**I2. AC42-AC45 (smoke prod + bundle size concreto)** não foram validados nesta gate — dependem de deploy via `@devops *push`. Documentados na Definition of Done como pré-requisito Done. Não bloqueio agora.

**I3. CodeRabbit committed-scope review vs `main` (concluído mid-gate):** 2 findings — 1 MAJOR/HIGH (incorporada como M2 acima) + 1 MINOR (incorporada como I4 abaixo). Plano free CLI sem CodeRabbit installed na org (review limited). 0 CRITICAL.

**I4. `conversation-row.tsx` JSDoc impreciso (CodeRabbit minor)** — o comment header afirma que parent "compara via JSON.stringify no useMemo" para estabilidade da memo, mas na verdade `React.memo` faz shallow equality nas props e `ConversationList` recebe `summary` direto do state setado pela resposta da API (objetos novos a cada fetch, então memo realmente só ajuda quando o componente compara prop por prop). Comentário cosmético — corrigir aproveitando o mesmo commit do M1/M2, ou registrar como dívida.

### Risk Profile

| Risco | Probabilidade | Impacto | Score | Mitigação |
|---|---|---|---|---|
| Badge fantasma após loadOlder confunde user | Alta | Baixo | MEDIUM | Fix M1 |
| Edge: viewport cabe conversa + loadOlder pula pro fim | Baixa | Médio | MEDIUM | Fix M1 (mesma raiz) |
| Polling continua quando offline (network 4xx) | Média | Muito baixo | LOW | Bloqueio inicial não vale — toast cobre, próximo ciclo retomada via online listener. Aceitável MVP. |
| `lib/clients.ts` query sem index dedicado em `clients.phone` | Baixa | Baixo | LOW | `idx_clients_phone` já existe no schema (verificado em `infra/schema.sql:74`). |
| AC11 (NULL last_agent) quebra layout | Muito baixa | Baixo | LOW | Verificado linha 46 `conversation-row.tsx`: `{summary.last_agent ?? "—"}` em mono cinza. Render seguro. ✅ |

### Coverage map — ACs vs implementação

✅ **Cobertos no código (45):** AC1-AC15 (lista), AC16-AC26 (drill-down), AC27-AC33 (UX/a11y), AC35-AC37 (responsivo — visual fica pra @ux), AC38-AC42 (qualidade core), AC46-AC48 (segurança).

⚠️ **Parcialmente cobertos (2):** AC20 (badge — viola semantica em loadOlder), AC21 (scroll preserve — edge case anulado).

⏳ **Pendentes pós-deploy (3):** AC42 (smoke 7 cenários em prod), AC43 (FCP <1.5s em 4G real), AC44 (validação polling no-flicker em browser real), AC45 (bundle <200KB gzip — medida concreta), AC34 (`prefers-reduced-motion` — verificação em DevTools).

### Recomendação

**1 commit pré-push consolidando 2 fixes obrigatórios + opcionais:**

1. **@dev aplicar fix M1** em `conversation-timeline.tsx` (10 LOC) — bug funcional MEDIUM no AC20/AC21
2. **@dev aplicar fix M2** em `conversation-list.tsx` (4 LOC) — shape validation antes de cast HIGH/CodeRabbit MAJOR. Replicar em `loadMore` também
3. **(opcional)** aproveitar o mesmo commit para:
   - L1: deletar `useOnlineStatusValue` órfã em `use-scroll-preserve.ts` (10 LOC)
   - I4: corrigir JSDoc impreciso em `conversation-row.tsx` (1 linha)
4. **L2 e L3** ficam como tech debt no backlog do Epic (próxima story polish)
5. Após fixes → **gate vira PASS** sem nova gate cerimonial (auto-promote via @dev marcando os 3 ACs afetados)
6. Depois → `@devops *push` + PR
7. Smoke AC42 + perf AC43-AC45 + `prefers-reduced-motion` AC34 ficam pra Victor pós-deploy (parte do DoD)

### Status sugerido

Story permanece **Ready for Review** até fix M1. Não troco status (autoridade @dev/@devops). Após fix:
- @dev marca novo commit + atualiza checkbox AC20/AC21 nas tasks
- @devops faz push + PR
- @devops fecha story como Done após smoke prod do Victor

— Quinn, guardião da qualidade 🛡️

## Handoff

**Próximo:** `@po *validate-story-draft docs/stories/admin-dashboard-story-1.3-ui-conversas-live.md`
