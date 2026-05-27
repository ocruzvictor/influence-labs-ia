# Decision Log — Story 1.3 UI Conversas Live

**Story:** [admin-dashboard-story-1.3-ui-conversas-live.md](../docs/stories/admin-dashboard-story-1.3-ui-conversas-live.md)
**Agente:** @dev Dex
**Branch:** `feature/1.3-1.4-ui-conversas-toggles`
**Pre-Flight executado:** 2026-05-27

## Stack confirmada (Pre-Flight Fase 0)

| Item | Valor | Onde validei |
|---|---|---|
| Next.js | **16.2.6** | `frontend/admin/package.json` |
| React | **19.2.4** | idem |
| Tailwind | **4** (CSS-first) | `globals.css` `@import "tailwindcss"` |
| shadcn | **4.8.1** | idem |
| date-fns | **4.3.0** | idem (já presente, não preciso instalar) |
| lru-cache | **11.5.0** | idem (já em uso pela 1.2-DATA) |
| Lucide | **1.16.0** | idem |
| Test runner | `node --import tsx --test tests/*.test.ts` | `package.json` scripts.test |
| Middleware → Proxy | `proxy.ts` (não `middleware.ts`) | Next 16 rename, já no codebase |
| Route handler params | `Promise<{phone: string}>` (async) | `app/api/conversas/[phone]/route.ts` |
| Page Server Component params | A confirmar via `node_modules/next/dist/docs` antes de codar drill-down | — |
| Cores hardcoded | navy `#1A1A2E`, cream `#F5F3EE` | `layout.tsx`, `top-nav.tsx`, `page.tsx` |

## Decisões fechadas

| # | Decisão | Valor | Racional |
|---|---|---|---|
| D1 | Server Component vs Client | Page route = Server Component shell; lista/timeline = Client Component | Pattern já estabelecido pelo `(dashboard)/page.tsx` e `(dashboard)/layout.tsx` |
| D2 | Nome do cliente no drill-down (AC16/AC22) | Helper `lib/clients.ts` lê `clients` table via `lib/db.ts` (Server Component) — **NÃO** é backend change, segue pattern de `lib/conversas.ts`, `lib/toggles.ts`, `lib/whitelist.ts` da 1.2-DATA | Advisor levantou que `v_admin_conversations_summary` não tem JOIN com `clients`; alternativa de cortar nome do escopo é over-conservadora dado o pattern já existente |
| D3 | Fetching strategy | `fetch()` nativo + `usePolling` hook custom — **NÃO** SWR, NÃO react-query | Manter consistência com base atual; LRU 2s já no backend absorve polling |
| D4 | Scroll preservation no `Carregar mais antigas` (AC21) | Hook dedicado `use-scroll-preserve.ts` com `useLayoutEffect` (sincronizado pré-paint) | Advisor: improvising scroll preservation gera flicker; pattern conhecido funciona |
| D5 | Polling com Page Visibility API (AC7) | `usePolling(fn, intervalMs, { pauseOnHidden: true })` — checa `document.hidden` em cada tick | Reduz carga de backend quando aba em background |
| D6 | Phone formatting | Helper `lib/format/phone.ts` — celular 13d → `+55 (DD) 9XXXX-XXXX`, fixo 12d → `+55 (DD) XXXX-XXXX`, inválido → string raw | Wireframe §582 + AC28 |
| D7 | Date formatting | Helper `lib/format/date.ts` wrappers de `date-fns` com locale pt-BR — `formatRelative()` e `formatAbsolute(dd/MM/yyyy HH:mm)` | AC29/AC30 |
| D8 | Tests location | `tests/` (não co-located, não `tests/api/*`) seguindo `tests/auth.test.ts` existente | Pattern existente do repo admin |
| D9 | Cores em código | Hardcoded `#1A1A2E` / `#F5F3EE` igual ao codebase atual | Não tem mapping `--color-primary` pra brand Studio Tirra ainda; padronizar com top-nav.tsx |
| D10 | shadcn components | table, badge, skeleton, dialog, tooltip instalados via `npx shadcn@latest add` | Conforme story + wireframe |

## Decisões pendentes (não bloqueantes)

| # | Item | Resolução prevista |
|---|---|---|
| P1 | Page Component params em Next 16 (signature exato) | Ler `node_modules/next/dist/docs/01-app/` antes da Fase 3 (drill-down) |
| P2 | shadcn `<TooltipProvider>` no `app/layout.tsx` | Adicionar antes de usar tooltip nos stubs disabled |

## Sequência de commits (acordo com advisor)

1. **Pre-Flight setup** (este commit) — decision log + shadcn install + helpers (phone, date, use-polling, use-scroll-preserve, lib/clients) + tests unitários
2. **Lista `/conversas`** — page + list + filters + row + status-badge + empty-state
3. **Drill-down `/conversas/[phone]`** — page + timeline + bubble + sidebar + load-more-old
4. **Nav-links flip + final polish** — flip `enabled: true` em conversas; estados borda; lint/typecheck/build verde

## Riscos identificados na Pre-Flight (atualiza tabela da story)

| Risco | Mitigação no código |
|---|---|
| Next 16 page params signature diverge do training data | Ler docs locais antes de Fase 3; usar pattern do route handler como cola |
| `clients.name` NULL frequente → sidebar sempre `—` | Aceitar como expected behavior; AC já diz "se disponível" — não é UI quebrada |
| Polling re-render causa flicker | Skeleton só no primeiro fetch; React state com keys estáveis (`client_phone`, `message.id`) |
| Scroll preservation no prepend | `useLayoutEffect` + hook dedicado desde o início |
