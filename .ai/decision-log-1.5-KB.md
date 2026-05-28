# Decision Log — Story 1.5 KB editor (yolo mode)

**Branch:** `feature/1.5-kb-editor`
**Started:** 2026-05-27
**Mode:** yolo (autonomous)
**Agent:** @dev (Dex)

---

## Pre-implementation decisions (com Victor)

| # | Decisão | Valor | Origem |
|---|---|---|---|
| 1 | Token TESS prod tem permissão CRUD memory_collections | Mesmo token do backend Tirra (`TESS_API_TOKEN`) | Confirmação Victor — PoC desta sessão funcionou |
| 2 | Nome da collection prod | `Tirra KB Production` | Confirmação Victor |
| 3 | Modo de overhead custo | Kill switch via env opcional (`TIRRA_KB_COLLECTION_ID`) | Confirmação Victor — graceful degradation se unset |

---

## Implementation decisions (autônomas)

### D1 — Migration: 003 ao invés de 002

**Decisão:** Criar `003_kb_tess_sync.sql` apenas com colunas ALTER, não nova migration completa
**Razão:**
- Migration `001_admin_dashboard.sql` já contém schema completo de `kb_items` e `kb_versions` (linhas 212-262)
- Migration `002_seed_whitelist_from_env.sql` já existe — colide com nome `002_kb`
- Adicionar só as colunas faltantes pro Caminho B: `tess_memory_id`, `deleted_at`, `tess_sync_failed_at`, `tess_sync_error`
**Alternativas consideradas:** Rebuild de 001 (rejeitado — já em prod), usar 002 (rejeitado — slot ocupado)

### D2 — Categorias canônicas

**Decisão:** 5 categorias — `faq`, `servicos`, `regras`, `padroes`, `info`
**Razão:** Check constraint da migration 001 (linha 215) já inclui as 5. Story 1.5 previa só 4 mas o schema é fonte de verdade. Mapping dos arquivos `data/kb/conversa-v2/`:
- `faq-servicos.md` → `faq`
- `fichas-tecnicas-servicos.md` → `servicos`
- `sinonimos-servicos.md` → `servicos`
- `info-estatica.md` → `info`
- `regras-comerciais.md` → `regras`
- `padroes-fala.md` → `padroes`

### D3 — TESS API endpoint base

**Decisão:** Reutilizar `TESS_API_BASE` do backend (`https://api.tess.im`)
**Razão:**
- Backend `server.js:34` usa `api.tess.im`
- MCP PoC retornou path `https://tess.pareto.io/api/agents` — ambos parecem ser válidos
- Manter mesma base que backend = 1 source-of-truth
- Se memory_collections endpoint não existir em `api.tess.im`, fallback testar `tess.pareto.io/api/` em script bootstrap

### D4 — Sequência atomic Postgres + TESS

**Decisão:** Padrão "commit-then-tess-then-compensate" conforme story §Implementation Pattern
- COMMIT Postgres ANTES de chamar TESS (evita rollback de dados consistentes)
- Em falha TESS: marca `tess_sync_failed_at` + audit log `kb.tess_sync_failed` + retorna 502 informando que mudança foi local
- Compensação por handler conforme tabela (story Dev Notes)

### D5 — Não usar `withTx` do db.ts pra todos os handlers

**Decisão:** Usar SELECT FOR UPDATE + INSERT/UPDATE sequencial dentro de `withTx` apenas em PATCH (update) e POST restore, onde lock pessimistic é necessário. CREATE, DELETE, TOGGLE_ACTIVE usam transaction simples (autocommit do pool).
**Razão:** Outros endpoints não competem por mesma row, lock seria overkill.

### D6 — Soft delete em vez de hard delete

**Decisão:** DELETE marca `deleted_at = NOW()` em `kb_items`, mantém `kb_versions` (CASCADE não dispara — ON DELETE CASCADE deletaria histórico)
**Razão:**
- Histórico permanece auditável
- Tentar acessar item deletado: 404 transparente
- Hard delete em TESS via `delete_memory` (não há "soft delete" no TESS)
- V2 pode adicionar UI de "trash" pra restore

### D7 — Formato da memory enviada pro TESS

**Decisão:** `# {title}\n\n_Categoria: {category}_\n\n{content_md}`
**Razão:**
- Embedding semantic precisa contexto (título + categoria)
- Markdown header (`#`) aumenta peso semântico do título
- PoC validou que conteúdo similar dispara RAG

### D8 — Kill switch via env

**Decisão:** `TIRRA_KB_COLLECTION_ID` é env **opcional**. Quando unset:
- Backend `server.js` NÃO envia `memory_collections` em `callTESS()` (degradação graceful — bot opera sem KB)
- Admin route handlers retornam 503 "KB not configured" em mutations (GET ainda funciona — lista Postgres)
**Razão:** Cumpre AC37 (graceful degradation) + permite rollback sem alterar código

### D9 — Não criar test para TESS REST client em CI

**Decisão:** Tests unitários cobrem schema validation, slug normalizer, diff summary, audit log entries. **NÃO** cobrem chamadas reais ao TESS (mocked).
**Razão:** TESS API é externa, tests não devem depender de network. Smoke manual cobre integração real (AC53).

### D10 — Markdown editor

**Decisão:** `@uiw/react-md-editor` versão estável mais recente, modo `live` (split preview)
**Razão:** Lib recomendada pela arquitetura §10.2. Validar SSR-compatibilidade na Fase 5 antes de full implementation.

### D11 — Diff viewer

**Decisão:** `react-diff-viewer-continued` (fork mantido do original abandonado)
**Razão:** Lib referenciada na story. Confirmado ativo no npm (atualizações recentes).

### D12 — Confirmação no /kb antes de DELETE

**Decisão:** AlertDialog com autoFocus em Cancelar (mesma defesa que kill switch da Story 1.4).

---

## Files created/modified (running log)

### Criados (24 arquivos)
- `.ai/decision-log-1.5-KB.md`
- `infra/migrations/003_kb_tess_sync.sql`
- `infra/migrations/003_kb_tess_sync.rollback.sql`
- `infra/migrations/README-003.md`
- `scripts/bootstrap-tess-kb.mjs`
- `scripts/migrate-kb-to-tess.mjs`
- `frontend/admin/lib/kb-types.ts` (client-safe types + pure helpers)
- `frontend/admin/lib/kb.ts` (server-only DB helpers)
- `frontend/admin/lib/tess-client.ts`
- `frontend/admin/lib/hooks/use-kb.ts`
- `frontend/admin/app/(dashboard)/kb/page.tsx`
- `frontend/admin/app/api/kb/route.ts`
- `frontend/admin/app/api/kb/[id]/route.ts`
- `frontend/admin/app/api/kb/[id]/active/route.ts`
- `frontend/admin/app/api/kb/[id]/versions/route.ts`
- `frontend/admin/app/api/kb/[id]/restore/[version]/route.ts`
- `frontend/admin/components/kb/kb-panel.tsx`
- `frontend/admin/components/kb/category-card.tsx`
- `frontend/admin/components/kb/kb-row.tsx`
- `frontend/admin/components/kb/kb-editor-dialog.tsx`
- `frontend/admin/components/kb/kb-history-sheet.tsx`
- `frontend/admin/components/kb/version-row.tsx`
- `frontend/admin/components/kb/diff-viewer.tsx`
- `frontend/admin/components/kb/restore-dialog.tsx`
- `frontend/admin/tests/kb-helpers.test.ts`

### Modificados (4 arquivos)
- `backend/server.js` — TIRRA_KB_COLLECTION_ID + propagação memory_collections
- `frontend/admin/lib/env.ts` — TESS_API_TOKEN, TESS_API_BASE, TIRRA_KB_COLLECTION_ID
- `frontend/admin/components/dashboard/nav-links.ts` — `/kb` enabled
- `frontend/admin/package.json` — `@uiw/react-md-editor`, `react-diff-viewer-continued`
- `infra/.env.example` — bloco TIRRA_KB_COLLECTION_ID

### Local dev (não commitado)
- `frontend/admin/.env.local` (.gitignored — placeholders pra build local)

---

## Decisões adicionais (D13-D16)

### D13 — Split `lib/kb.ts` → `lib/kb-types.ts` + `lib/kb.ts`

**Decisão:** Separar types/pure helpers (client-safe) de DB helpers (server-only)
**Razão:** Next.js bundler tentou bundlear `pg` pro browser quando client component importava do `lib/kb.ts`. Solução clean: `lib/kb-types.ts` (sem `pg`) + `lib/kb.ts` com `import "server-only"`.
**Trade-off:** 1 arquivo extra mantido, mas clientes ficam isolados de Node-only deps.

### D14 — Inner-keyed pattern pra reset state em Dialogs/Sheets

**Decisão:** Em `kb-editor-dialog.tsx` e `kb-history-sheet.tsx`, encapsular state em inner component remountado via `key={item.id || formKey}`.
**Razão:** ESLint regra `react-hooks/set-state-in-effect` (React 19) bloqueia setState dentro de useEffect. Solução idiomatic: remount = reset.
**Alternativas rejeitadas:** ref-based state, prop drilling (poluem API).

### D15 — Scripts `.mjs` ao invés de `.ts`

**Decisão:** `scripts/bootstrap-tess-kb.mjs` e `migrate-kb-to-tess.mjs` em JavaScript puro (ES modules)
**Razão:** Scripts são one-shot setup em prod. Evita dependência de tsx no VPS. Node 18+ nativamente suporta `.mjs` + fetch.

### D16 — TESS endpoint base default `tess.pareto.io` (não `api.tess.im`)

**Decisão:** Scripts e admin TESS client usam `https://tess.pareto.io` como default. Backend `server.js` mantém `api.tess.im` (intocado pra evitar regressão).
**Razão:** PoC MCP desta sessão usou `tess.pareto.io/api/...` com sucesso. Endpoint REST `api.tess.im` pode ter shape diferente — não validado pra memory_collections.
**Trade-off:** 2 hosts diferentes em runtime. `TESS_API_BASE` env override permite alinhar quando confirmado.

---

## Tests executed (running log)

- ✅ `npm run typecheck` (admin) → 0 errors
- ✅ `npm run lint` (admin) → 0 errors after 2 iterations of refactor pra ESLint react-hooks rule
- ✅ `npm run build` (admin) → 22 rotas no manifest (incluindo `/kb`, `/api/kb/*`)
- ✅ `npm test` (admin) → 40 pass / 0 fail / 22 skipped (pré-existentes; sem DB)
  - 11 novos tests em `tests/kb-helpers.test.ts` (slugify, diffSummary, formatMemoryForTess, KB_CATEGORIES)

---

## Git commit hash before execution

(capturado antes do commit final — abaixo)
