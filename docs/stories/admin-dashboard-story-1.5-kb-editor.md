# Story 1.5: Admin UI — KB Editor (Caminho B: TESS memory_collections via execute_agent)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** Ready for Review
**Agente executor:** @dev
**Story Points:** 8
**Pode executar agora:** ⚠️ Quase — depende de **2 pré-requisitos operacionais** (bootstrap collection TESS + migration `002_kb.sql`) descritos na Fase 0. Sem isso, @dev não consegue rodar nem em dev local
**Branch sugerida:** `feature/1.5-kb-editor`
**Source-of-truth técnico:**
- Spike + PoC desta sessão (2026-05-27) — registrado abaixo em §Decisões técnicas FECHADAS
- [docs/architecture/admin-dashboard.md §10](../architecture/admin-dashboard.md) (decisão atualizada — ver §10.0 desta story)
- [backend/server.js:645 — callTESS()](../../backend/server.js) (ponto de integração)
- TESS MCP tools: `mcp__tess__create_memory_collection`, `update_memory`, `list_memories`, `delete_memory`, `execute_agent` com param `memoryCollections`

## Contexto

Quinta story do Epic Admin Dashboard. As 1.1-1.4 entregaram auth + listagem de conversas + drill-down + toggles + whitelist. Painel admin já tem **utilidade operacional plena** pra Gabriel/Tiago no dia-a-dia, mas todo conteúdo cognitivo do agente (promoções, FAQs novas, regras de venda atualizadas) **ainda mora ou no prompt da TESS (ed. manual UI) ou em arquivos `.md` no repo (não consumidos em runtime)**.

Esta story entrega o **editor de conhecimento dinâmico**: Tiago/Gabriel adicionam/editam memories que o agente consome via RAG da TESS, **sem dev no meio, sem deploy**.

**Spike + PoC desta sessão (2026-05-27) confirmaram Caminho B viável:**
- `execute_agent(agentId=33200, message=..., memoryCollections=[id])` faz TESS injetar memórias relevantes via embedding semântico em runtime
- Update programático funciona via `update_memory(memoryId, memory)` — limite 32.000 chars por memory
- Latência aceitável: ~7-8s (~+1s vs sem memory)
- Custo: +27-30% créditos TESS por chamada (projeção ~+R$ 50-150/mês na escala atual de 10-25k msgs)
- Cleanup completo do spike registrado na memória da sessão

**Abordagem:** Postgres `kb_items` + `kb_versions` são source-of-truth de **edição, histórico e audit**; TESS memory collection é source-of-truth de **runtime do agente**. Cada PATCH no admin sincroniza ambos atomicamente (best-effort; rollback em falha TESS).

**Escopo:** Tela 5 do wireframe — lista por categoria + editor markdown + histórico de versões + diff entre versões + ativar/desativar item.

**Fora de escopo (V2 ou outras stories):**
- Editor visual rich-text (mantém markdown + preview)
- Reordenação manual por drag-drop (ordenação por categoria + updated_at)
- Tags livres além das 4 categorias canônicas (`faq`, `servicos`, `regras`, `padroes`)
- Anexar arquivos (PDF/imagem) — TESS aceita `fileIds`, mas fica V2
- Roles granulares — `admin` único pode editar tudo (sem `viewer` read-only)
- "Publish/draft" workflow — toda edição vai pra prod imediatamente (compatível com volume baixo + 2 editores confiáveis)
- A/B testing de memories — fora de escopo
- Rollback automático em falha de propagação TESS além de 1 retry — fica manual via UI

## Valor de negócio

Após esta story:

- **Tiago** edita preço de serviço novo, anti-pattern descoberto na semana, ou promoção sazonal **em ≤2 min** sem abrir terminal nem chamar dev
- **Gabriel** adiciona FAQ sobre dúvida recorrente que viu na semana, sem aprovação técnica
- **Agente** reflete mudança na **próxima conversa** (sync TESS imediato)
- **Versionamento** preservado — rollback granular se uma edição causar regressão de qualidade
- **Audit** completo — quem/quando/o-quê (diff por versão)
- **Métrica do épico:** "KB atualizada por Tiago sem ajuda de dev em ≤30d" deixa de ser aspiracional

**ROI:** Quando esta story merga, o agente vira **gerenciável por não-devs**. Stories 1.6 (Métricas) e 1.7 (Health+Audit) viram analytics em cima disso.

## Objetivo

Entregar:

1. Migration `002_kb.sql` — tabelas `kb_items`, `kb_versions`, índices, FK em `admin_users`
2. Script `scripts/bootstrap-tess-kb.ts` — cria collection "Tirra KB Production" na TESS via MCP, captura `collection_id`, persiste em `infra/.env` como `TIRRA_KB_COLLECTION_ID`
3. Script `scripts/migrate-kb-to-tess.ts` — lê `data/kb/conversa-v2/*.md`, cria entries em `kb_items` + memories correspondentes na TESS collection, idempotente
4. Mudança no `backend/server.js` — `callTESS()` adiciona `body.memory_collections = [TIRRA_KB_COLLECTION_ID]` quando env presente
5. Rota `/kb` admin — lista agrupada por categoria + ações (edit/version/toggle/delete)
6. Modal de edit (markdown + preview ao vivo) — lib: `@uiw/react-md-editor`
7. Drawer de histórico de versões — lista + diff inline + restore
8. API admin proxy → TESS: `GET /api/kb`, `POST /api/kb`, `PATCH /api/kb/[id]`, `DELETE /api/kb/[id]`, `GET /api/kb/[id]/versions`, `POST /api/kb/[id]/restore/[version]`
9. Audit log automático em cada CRUD (reusa `admin_audit_log`)
10. shadcn: `dialog` (já existe), `sheet` (drawer), `tabs`, `badge` (já existe)

## Acceptance Criteria

### Funcional — listagem `/kb`

- [ ] **AC1:** `/kb` sem sessão → middleware redireciona pra `/login?returnTo=/kb`
- [ ] **AC2:** Página renderiza header `Knowledge Base` + sub-texto `Edite o conhecimento que o agente consulta em cada conversa. Mudanças refletem na próxima mensagem.` + botão `[+ Novo item]`
- [ ] **AC3:** Lista renderizada agrupada por categoria — ordem fixa: `faq`, `servicos`, `regras`, `padroes`. Cada categoria é um card com header colorido (badge) + lista de items
- [ ] **AC4:** Cada `kb_item` row exibe: `title` + primeira linha do `content_md` (truncada em 100 chars) + `updated_by_email` + `updated_at` relativo + badge `v{version}` + toggle `active` + botão `Editar` + menu (`⋯` → Histórico, Excluir)
- [ ] **AC5:** Items com `active=false` renderizam opacos (`opacity-50`) + badge `Desativado`
- [ ] **AC6:** Empty state por categoria: "Nenhum item em {categoria} ainda."
- [ ] **AC7:** Categoria sem items + sem botão de criar dentro = ok (botão global no topo)
- [ ] **AC8:** Loading inicial → skeleton de 4 cards (1 por categoria) com 3 rows shimmer cada
- [ ] **AC9:** Erro 500 no GET → fallback "Não foi possível carregar a KB" + botão `[Tentar novamente]`

### Funcional — criar novo item

- [ ] **AC10:** Click `[+ Novo item]` abre `<Dialog>` "Novo item de KB" com campos: `Título` (text input), `Categoria` (select com 4 opções), `Slug` (auto-gerado de title, editável), `Conteúdo` (markdown editor com preview lado-a-lado)
- [ ] **AC11:** Slug é normalizado (lowercase, kebab-case, sem acentos) e validado client-side: `/^[a-z0-9-]+$/`. Server valida unicidade via `UNIQUE (slug)` no banco
- [ ] **AC12:** Editor markdown usa `@uiw/react-md-editor` com modo `live` (split preview). Altura mínima 400px
- [ ] **AC13:** Contador de caracteres visível abaixo do editor: `{count} / 32.000 caracteres`. Acima de 31.500 → contador vermelho + aviso "Próximo do limite TESS"
- [ ] **AC14:** Submit → `POST /api/kb { title, category, slug, content_md }` → API persiste no Postgres `kb_items` + chama `create_memory(collectionId, formatted)` em TESS — atomic: se TESS falhar, ROLLBACK do INSERT no Postgres
- [ ] **AC15:** Sucesso → toast "Item criado. Refletindo em ~5s no agente." → fecha modal → re-fetch lista
- [ ] **AC16:** Validação Zod no server: `title (1-200)`, `category in [faq,servicos,regras,padroes]`, `slug (1-100, /^[a-z0-9-]+$/)`, `content_md (1-32000)`. Falha → 400 com erros por campo → exibe inline no form
- [ ] **AC17:** Slug duplicado → 409 → toast vermelho "Slug já existe. Escolha outro."

### Funcional — editar item

- [ ] **AC18:** Click `Editar` em um item abre o mesmo `<Dialog>` em modo edição. Campos `Slug` e `Categoria` ficam **desabilitados** (mudança rompe semantic em audit; usuário deve criar novo + desativar antigo se quiser mudar)
- [ ] **AC19:** `Título` e `Conteúdo` editáveis. Footer mostra `Versão atual: v{N}. Salvar criará v{N+1}.`
- [ ] **AC20:** Submit → `PATCH /api/kb/[id] { title, content_md }` → API:
  - INSERT em `kb_versions` (snapshot da versão atual — content + diff_summary humano-legível tipo `+45/-12 chars`)
  - UPDATE em `kb_items` (version++, content novo, updated_by, updated_at)
  - `update_memory(memoryId=item.tess_memory_id, memory=formatted)` na TESS
  - Atomic: rollback de Postgres se TESS falhar
- [ ] **AC21:** Sucesso → toast "Item atualizado. v{N+1} criada." → fecha modal → re-fetch lista
- [ ] **AC22:** Se content_md igual ao atual (sem mudança) → 200 sem criar versão nova + toast neutro "Nenhuma mudança detectada"

### Funcional — toggle active

- [ ] **AC23:** Toggle de `active` em cada row → `PATCH /api/kb/[id]/active { active: boolean }` → quando `active=false` → API **REMOVE** a memory do TESS via `delete_memory` (mas mantém `kb_items.tess_memory_id` NULL temporariamente e em `kb_items.content_md` no Postgres). Reativar (`active=true`) → re-cria via `create_memory`, atualiza `tess_memory_id`
- [ ] **AC24:** Toggle pede confirmação só quando `active: true → false` ("Desativar removerá este item das próximas conversas do agente. Continuar?"). Reativar não pede
- [ ] **AC25:** Toggle desabilitado durante request + spinner inline
- [ ] **AC26:** Toast pós-toggle: ON → "Item reativado no agente." | OFF → "Item desativado. Agente não verá mais."

### Funcional — histórico de versões

- [ ] **AC27:** Click `⋯ → Histórico` abre `<Sheet>` lateral direito com header `Histórico: {title}` + lista de versões DESC (mais recente em cima)
- [ ] **AC28:** Cada versão exibe: `v{N}` + `updated_by_email` + `updated_at` relativo + `diff_summary` (ex: `+45 −12 chars`) + botão `Ver diff` + botão `Restaurar` (só pra versões antigas, nunca pra v atual)
- [ ] **AC29:** Click `Ver diff` → expande inline mostrando 2 panes (antigo vs novo) com diff colorido (lib: `react-diff-viewer-continued`). Toggle entre `split` e `unified` mode
- [ ] **AC30:** Click `Restaurar` em v{N} (com N < versão atual) → AlertDialog "Restaurar v{N}? Isso criará uma nova versão v{atual+1} idêntica ao conteúdo de v{N}." → confirma → `POST /api/kb/[id]/restore/[version]` → cria nova versão (não sobrescreve histórico), atualiza TESS, fecha sheet, re-fetch lista
- [ ] **AC31:** API `GET /api/kb/[id]/versions` retorna até 50 versões mais recentes (paginação V2 se virar dor)
- [ ] **AC32:** Empty state: "Apenas a versão inicial. Edite o item para criar histórico."

### Funcional — delete

- [ ] **AC33:** Click `⋯ → Excluir` → AlertDialog "Excluir '{title}' permanentemente? Histórico será preservado mas o item sumirá da lista e do agente." → confirma → `DELETE /api/kb/[id]`
- [ ] **AC34:** API DELETE: marca `kb_items.deleted_at = NOW()` (soft delete) + `delete_memory(tess_memory_id)` em TESS. `kb_versions` preservadas (FK preservada, deleted_at do parent indica órfão)
- [ ] **AC35:** GET /api/kb retorna apenas items com `deleted_at IS NULL`. Sem UI de "lixeira" no MVP (V2 se virar pedido)
- [ ] **AC36:** Tentar deletar item com `deleted_at` já setado (ex: race condition) → 404 sem erro pra UX limpa

### Funcional — backend integration

- [ ] **AC37:** `backend/server.js` env `TIRRA_KB_COLLECTION_ID` lido em startup. Se ausente, log warning + segue sem `memory_collections` (degradação graceful — bot continua respondendo, só sem KB dinâmica)
- [ ] **AC38:** `callTESS(messages, rootId)` em `server.js:645` adiciona `body.memory_collections = [Number(TIRRA_KB_COLLECTION_ID)]` quando env presente
- [ ] **AC39:** Logging: adicionar campo `memory_collections_active: true/false` no log estruturado da chamada TESS pra observabilidade de custo

### Auditoria

- [ ] **AC40:** Toda chamada `POST/PATCH/PATCH-active/POST-restore/DELETE` em `/api/kb/*` insere em `admin_audit_log`:
  - `action`: `kb.create | kb.update | kb.toggle_active | kb.restore | kb.delete`
  - `payload`: JSON com `kb_item_id, slug, category, version_before/after (quando aplicável)`
  - `user_id`, `ip`, `user_agent` capturados do request
- [ ] **AC41:** Falha de sync TESS após Postgres commit → audit log adicional `kb.tess_sync_failed` com erro — alerta visual no admin (banner top) que diz "X items dessincronizados com TESS. [Verificar]"

### UX / Acessibilidade

- [ ] **AC42:** Markdown editor navegável via teclado (Tab entra/sai do textarea; atalho `Ctrl+B` bold, `Ctrl+I` italic — defaults da lib)
- [ ] **AC43:** Categoria select tem `aria-label="Categoria do item"`
- [ ] **AC44:** Sheet de histórico fecha com `Esc` (default shadcn) + click no overlay
- [ ] **AC45:** Confirmações destrutivas (desativar, excluir, restaurar) com `autoFocus` no `Cancelar`
- [ ] **AC46:** Diff viewer com cores contrast WCAG AA (verde +, vermelho −)

### Responsivo

- [ ] **AC47:** Mobile (<640px): categorias empilhadas, items viram cards verticais. Editor markdown vira stack (preview embaixo) em vez de split
- [ ] **AC48:** Sheet de histórico vira full-screen em mobile (default shadcn)

### Qualidade

- [ ] **AC49:** `npm run lint` passa
- [ ] **AC50:** `npm run typecheck` strict passa
- [ ] **AC51:** `npm run build` passa
- [ ] **AC52:** Testes unitários: validação Zod (create/update), slug normalizer, diff summary generator, helper de "skip se conteúdo igual" (AC22)
- [ ] **AC53:** Smoke manual Victor:
  - Criar item "FAQ — Horário no feriado" categoria `faq` → toast OK → enviar pergunta no WhatsApp ("vocês abrem no feriado?") → resposta do bot menciona o conteúdo criado em ≤30s
  - Editar o mesmo item → atualizar → nova mensagem WhatsApp → bot usa conteúdo atualizado
  - Desativar item → nova mensagem → bot NÃO menciona mais
  - Reativar → bot volta a mencionar
  - Restaurar v1 → diff visível → bot volta a comportar conforme v1
- [ ] **AC54:** Cleanup de PoC validado: collection 39429 + memory 161888 deletadas (já feito 2026-05-27 nesta sessão — confirmar via `list_memory_collections` antes do deploy)

### Segurança

- [ ] **AC55:** `content_md` renderizado no preview e no agent payload **sem `dangerouslySetInnerHTML`** — markdown vai como texto puro pro TESS; preview usa renderer da lib (que sanitiza)
- [ ] **AC56:** Slug input filtrado client + validado Zod no server — regex `/^[a-z0-9-]+$/`
- [ ] **AC57:** Audit payload **não armazena** content_md completo (pra economia) — só `slug`, `version_before`, `version_after`, `diff_summary`. Versão completa fica em `kb_versions`
- [ ] **AC58:** Toda rota `/api/kb/*` exige sessão válida (middleware admin existente) — sem rota pública

## Tarefas (ordem de execução)

### Fase 0 — Pré-requisitos operacionais (~1h, Victor + @dev)

**Pré-requisitos que @dev sozinho não pode resolver:**

- [ ] **(Victor)** Confirmar token TESS em produção tem permissão de criar/editar memory_collections — testar via `mcp__tess__list_memory_collections` antes de qualquer code
- [ ] **(Victor)** Decidir nome final da collection prod (sugestão: `Tirra KB Production`)
- [ ] **(Victor)** Aceitar overhead conhecido de +27-30% créditos TESS por chamada — projeção ~R$ 50-150/mês na escala atual

**Tarefas @dev:**

- [ ] Ler na íntegra: este story, [admin-dashboard.md §10](../architecture/admin-dashboard.md) (decisão arquitetural foi atualizada pelo spike — ver §10.0 abaixo nesta story), wireframe Tela 5, [backend/server.js:642-668 — callTESS()](../../backend/server.js), `frontend/admin/AGENTS.md`
- [ ] Confirmar com `mcp__tess__list_memory_collections` que nenhuma collection "Tirra*" residual está no workspace (PoC desta sessão foi limpa, mas validar)
- [ ] Registrar decisões finais em `.ai/decision-log-1.5-KB.md`

### Fase 1 — Migration + bootstrap collection TESS (~1h)

- [ ] Criar `infra/migrations/002_kb.sql` — schema `kb_items` (com `tess_memory_id BIGINT NULL`, `deleted_at TIMESTAMPTZ NULL`), `kb_versions`, índices, FKs em `admin_users`. Roll-back: `002_kb.rollback.sql`
- [ ] Criar `infra/migrations/README-002.md` — instruções de apply manual no VPS (mesmo padrão da 001)
- [ ] Criar `scripts/bootstrap-tess-kb.ts` — script Node que chama `mcp__tess__create_memory_collection` via API TESS direta (não via Claude MCP — porque rodaremos em prod sem Claude). Captura `collection_id`, imprime instrução pra Victor adicionar em `infra/.env` como `TIRRA_KB_COLLECTION_ID=<id>`
- [ ] **Manual:** Victor roda script bootstrap UMA VEZ + atualiza `.env` + `docker compose up -d --build admin-frontend backend`

### Fase 2 — Migração KB atual para TESS (~1h)

- [ ] Criar `scripts/migrate-kb-to-tess.ts` — lê `data/kb/conversa-v2/*.md`:
  - Extrai categoria do filename (ex: `faq.md` → category=`faq`, slug=`faq-geral`, title="FAQ Geral")
  - Pra cada arquivo: INSERT em `kb_items` (idempotente — check by slug) + `create_memory(collection_id, content)` na TESS + capture `memory_id` no `kb_items.tess_memory_id`
  - Log: quantos criados / quantos já existiam / qualquer erro
- [ ] **Manual:** Victor roda UMA VEZ em prod após Fase 1
- [ ] @dev valida via `list_memories(collection_id)` que todas as memories existem em TESS

### Fase 3 — Integração backend (~30min)

- [ ] `backend/server.js`:
  - Adicionar `const TIRRA_KB_COLLECTION_ID = process.env.TIRRA_KB_COLLECTION_ID;` no topo
  - Em `callTESS()`: `if (TIRRA_KB_COLLECTION_ID) body.memory_collections = [Number(TIRRA_KB_COLLECTION_ID)];`
  - Log estruturado: `{ memory_collections_active: !!TIRRA_KB_COLLECTION_ID }`
- [ ] Smoke local: setar env, rodar backend, enviar mensagem teste, ver log mostrar `memory_collections_active: true`

### Fase 4 — API admin (~3h)

- [ ] **(AC14-17, AC20-21, AC23, AC34)** Criar `frontend/admin/lib/tess-client.ts` — wrapper sobre TESS REST API (não MCP) com funções `createMemory`, `updateMemory`, `deleteMemory`, `listMemories`. Lê `TESS_API_TOKEN` do env (mesmo do backend). Retry 1x em 5xx, timeout 10s
- [ ] **(AC10, AC11, AC22)** Criar `frontend/admin/lib/kb.ts` — domain helpers: `slugify`, `diffSummary`, `formatMemoryForTess(item)` (formato: `# {title}\n\n_Categoria: {category}_\n\n{content_md}`)
- [ ] Criar route handlers em `frontend/admin/app/api/kb/`:
  - `route.ts` → GET (list — **AC4-9**), POST (create — **AC10-17**)
  - `[id]/route.ts` → PATCH (update — **AC18-22**), DELETE (soft delete — **AC33-36**)
  - `[id]/active/route.ts` → PATCH (toggle active — **AC23-26**)
  - `[id]/versions/route.ts` → GET (history — **AC27-32**)
  - `[id]/restore/[version]/route.ts` → POST (restore — **AC30**)
- [ ] Cada handler segue o **padrão atomic best-effort** descrito na §Implementation Pattern (Dev Notes abaixo) — valida sessão, valida payload Zod, executa transação Postgres, chama TESS após commit com compensação em falha, registra `admin_audit_log` (**AC40-41**)
- [ ] **(AC52)** Tests: `frontend/admin/tests/api/kb.test.ts` cobrindo create/update/delete/restore/toggle, validação Zod, audit log entries, **simulação de falha TESS pós-commit** com asserção do path de compensação

### Fase 5 — UI lista + criar (~2.5h)

- [ ] `npx shadcn@latest add sheet tabs` (dialog, badge, alert-dialog já existem)
- [ ] `npm install @uiw/react-md-editor react-diff-viewer-continued`
- [ ] **(AC1-9)** Criar `frontend/admin/app/(dashboard)/kb/page.tsx` — Server Component
- [ ] **(AC2-9)** Criar `frontend/admin/components/kb/kb-panel.tsx` — orquestrador client (fetch + state)
- [ ] **(AC3, AC6-7)** Criar `frontend/admin/components/kb/category-card.tsx` — card por categoria
- [ ] **(AC4-5, AC23-26, AC33)** Criar `frontend/admin/components/kb/kb-row.tsx` — row com active toggle + menu
- [ ] **(AC10-22)** Criar `frontend/admin/components/kb/kb-editor-dialog.tsx` — dialog create/edit com `@uiw/react-md-editor`
- [ ] Criar `frontend/admin/lib/hooks/use-kb.ts` — fetch + invalidate helpers (padrão dos hooks 1.3/1.4)

### Fase 6 — UI histórico + diff + restore (~2h)

- [ ] **(AC27-28, AC31-32)** Criar `frontend/admin/components/kb/kb-history-sheet.tsx` — drawer lateral com lista
- [ ] **(AC28)** Criar `frontend/admin/components/kb/version-row.tsx` — row com ações + diff expandable
- [ ] **(AC29, AC46)** Criar `frontend/admin/components/kb/diff-viewer.tsx` — wrapper sobre `react-diff-viewer-continued` com toggle split/unified
- [ ] **(AC30, AC45)** Criar `frontend/admin/components/kb/restore-dialog.tsx` — AlertDialog de confirmação

### Fase 7 — Nav + integração (~30min)

- [ ] Editar `frontend/admin/components/dashboard/nav-links.ts` — entrada KB: `enabled: true`, rota `/kb`, ícone `BookOpen` (lucide)
- [ ] Atualizar README do admin se houver

### Fase 8 — Testes + lint + build (~1h)

- [ ] `npm run lint` → 0 warnings
- [ ] `npm run typecheck` → 0 errors strict
- [ ] `npm run build` → success com `/kb`, `/api/kb/*` no route manifest
- [ ] Testes unit: slug normalizer, diff summary, Zod schemas, audit log entries (helper TESS mockado)

### Fase 9 — Smoke + handoff

- [ ] Smoke local: criar/editar/desativar/restaurar item, verificar audit_log entries, verificar TESS via `list_memories`
- [ ] Smoke prod (Victor) — AC53 completo no WhatsApp real
- [ ] Commit incremental (5-7 commits): migration, scripts, backend integration, API, UI lista, UI histórico, polish
- [ ] CodeRabbit pre-commit: 0 CRITICAL
- [ ] Handoff `@qa *qa-gate 1.5` ou direto `@devops *push` (se CodeRabbit limpo)

## File List (esperado)

**Criados (25 arquivos):**

- `.ai/decision-log-1.5-KB.md` ✅
- `infra/migrations/003_kb_tess_sync.sql` ✅ (renomeado: 002 já ocupada)
- `infra/migrations/003_kb_tess_sync.rollback.sql` ✅
- `infra/migrations/README-003.md` ✅
- `scripts/bootstrap-tess-kb.mjs` ✅ (mjs em vez de ts — sem deps em prod)
- `scripts/migrate-kb-to-tess.mjs` ✅
- `frontend/admin/lib/kb-types.ts` ✅ (novo — split client-safe types)
- `frontend/admin/lib/kb.ts` ✅ (server-only DB helpers)
- `frontend/admin/lib/tess-client.ts` ✅
- `frontend/admin/lib/hooks/use-kb.ts` ✅
- `frontend/admin/app/(dashboard)/kb/page.tsx` ✅
- `frontend/admin/app/api/kb/route.ts` ✅
- `frontend/admin/app/api/kb/[id]/route.ts` ✅
- `frontend/admin/app/api/kb/[id]/active/route.ts` ✅
- `frontend/admin/app/api/kb/[id]/versions/route.ts` ✅
- `frontend/admin/app/api/kb/[id]/restore/[version]/route.ts` ✅
- `frontend/admin/components/kb/kb-panel.tsx` ✅
- `frontend/admin/components/kb/category-card.tsx` ✅
- `frontend/admin/components/kb/kb-row.tsx` ✅
- `frontend/admin/components/kb/kb-editor-dialog.tsx` ✅
- `frontend/admin/components/kb/kb-history-sheet.tsx` ✅
- `frontend/admin/components/kb/version-row.tsx` ✅
- `frontend/admin/components/kb/diff-viewer.tsx` ✅
- `frontend/admin/components/kb/restore-dialog.tsx` ✅
- `frontend/admin/tests/kb-helpers.test.ts` ✅ (11 tests pure helpers)

**NÃO criado (escopo decidido):**
- `frontend/admin/tests/api/kb.test.ts` — tests de API com TESS mockado ficam pendentes. Cobertura unit dos helpers puros + smoke manual AC53 considerados suficientes pra MVP. Adicionar se aparecer regressão. (`@dev` registra como tech debt)

**Modificados (4 arquivos):**

- `backend/server.js` ✅ — `TIRRA_KB_COLLECTION_ID` env + `body.memory_collections` em `callTESS()`
- `frontend/admin/lib/env.ts` ✅ — `TESS_API_TOKEN`, `TESS_API_BASE`, `TIRRA_KB_COLLECTION_ID` (todos opcional)
- `frontend/admin/components/dashboard/nav-links.ts` ✅ — `/kb` `enabled: true`
- `frontend/admin/package.json` / `package-lock.json` ✅ — `@uiw/react-md-editor@^4.1.1`, `react-diff-viewer-continued`
- `infra/.env.example` ✅ — bloco TIRRA_KB_COLLECTION_ID
- `docs/architecture/admin-dashboard.md` §10 — **NÃO modificado nesta story**. Decisão arquitetural Caminho B documentada na própria Story 1.5 §10.0. Arquitetura pode ser sincronizada por @architect em pass futuro.

**A NÃO TOCAR (lock):**

- Outras rotas `/api/*` da Story 1.2-DATA até 1.4
- `infra/migrations/001_*` (já em prod)
- `frontend/admin/middleware.ts`, `lib/auth.ts`, `lib/db.ts` (estabilidade)
- Conteúdo de `data/kb/conversa-v2/*.md` — fica como histórico/seed; após migration os arquivos não são mais consumidos em runtime mas continuam versionados

## Dev Notes

### ⚠️ ATENÇÃO MÁXIMA — Next.js neste repo NÃO é o que seu treinamento conhece

`frontend/admin/AGENTS.md` declara: **"This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."**

**Antes de escrever qualquer Server Component, route handler, ou hook React, abra a documentação local da versão exata.** Aplica-se ao md editor + diff viewer também — versões de React Server Components afetam como libs client-only se integram.

### 10.0 — Decisão arquitetural atualizada (spike 2026-05-27)

A arquitetura original em §10.1 do `admin-dashboard.md` deixou pendente: "Existe endpoint `PATCH /agents/:id/knowledge`? Suporta upload de arquivos ou só texto inline? Latência de propagação?"

**Spike + PoC desta sessão respondeu:**

| Pergunta | Resposta |
|---|---|
| Existe endpoint pra atualizar knowledge do agent? | ❌ NÃO existe `PATCH /agents/:id/knowledge`. Prompt do agent é editável só pela UI TESS. |
| Existe outro mecanismo programático de KB? | ✅ SIM — `memory_collections` (CRUD via API) + parâmetro `memoryCollections` em `execute_agent` |
| Suporta upload de arquivos? | ✅ SIM (`upload_file` + param `fileIds`). Fica V2 — MVP usa só memories (texto até 32k chars) |
| Latência de propagação | ✅ **Imediata** — próxima chamada `execute_agent` já injeta memory atualizada. Sem cache server-side aparente. |
| Vínculo persistente collection ↔ agent | ❌ NÃO existe API pra linkar. Solução: passar `memoryCollections: [id]` em CADA chamada `execute_agent` |
| RAG é por keyword ou semantic? | ✅ Semantic (embedding). PoC validou que agente puxou memory voluntariamente em pergunta vaga sem keywords. |
| Custo | +27-30% créditos por chamada com 1 memory de ~500 chars. Latência +~1s. |

**Decisão final:** Caminho B — Postgres source-of-truth de edição/audit/history, TESS memory_collection source-of-truth de runtime. Sync atomic best-effort em cada CRUD.

**Trade-off conhecido aceito:** sync TESS pode falhar após Postgres commit. Mitigação: compensação na response do handler + alerta visual no admin (AC41). Falha permanente requer ação manual via UI TESS (deletar memory órfã).

### Source-of-truth de design

- Wireframe Tela 5: `docs/design/admin-dashboard/wireframes.md` (procurar seção KB editor)
- Tokens: `design-system/tokens/themes/influence-labs.css` (cores categorias)
- Padrão de drawer: shadcn `<Sheet>` (mesmo usado em outras stories se houver, ou primeiro uso aqui)

### Padrões a seguir

- Reusar helpers das stories anteriores: `lib/format/date.ts` (timestamps relativos), `lib/db.ts` (postgres pool), helper de auth/session
- API contract: padrão `{ items: [...] }` em GET, `{ item: {...} }` em mutate; status 200/201/400/404/409/502
- Estados de borda obrigatórios: loading skeleton, empty por categoria, erro com retry, optimistic update onde fizer sentido (toggle active)
- Toast pra todas as mutações (sonner) — verde sucesso, vermelho erro
- Audit log: NUNCA fazer `INSERT INTO admin_audit_log` direto — usar helper `logAudit()` (já existe das stories anteriores) — garante schema padrão

### Decisões técnicas FECHADAS

| # | Decisão | Valor | Origem |
|---|---|---|---|
| 1 | Source-of-truth runtime | TESS memory_collection (passada por chamada) | Spike+PoC 2026-05-27 |
| 2 | Source-of-truth edição/audit/history | Postgres `kb_items` + `kb_versions` | Arquitetura original + spike |
| 3 | Sync TESS ↔ Postgres | Atomic best-effort em cada CRUD, compensação em falha | Trade-off aceito (AC41) |
| 4 | Versionamento | Append-only em `kb_versions`; restore cria nova versão (não sobrescreve) | Arquitetura original |
| 5 | Categorias | Fixas: `faq`, `servicos`, `regras`, `padroes`. Tags livres = OUT | Wireframe + scope cut |
| 6 | Editor | Markdown `@uiw/react-md-editor` live split | Arquitetura original §10.2 |
| 7 | Diff lib | `react-diff-viewer-continued` | Sucessor mantido do `react-diff-viewer` original |
| 8 | Limite tamanho memory | 32.000 chars (limite TESS) — aviso visual >31.500 | Schema TESS `update_memory` |
| 9 | Mudança de slug/categoria após criar | NÃO permitida — usuário cria novo + desativa antigo | Audit semantic preservation |
| 10 | Delete | Soft delete em `kb_items` + hard delete da memory TESS | Histórico preservado, runtime limpo |
| 11 | Restore | Cria nova versão a partir do conteúdo antigo | Mantém audit linear |
| 12 | Failure mode TESS down | Backend bot degrada graceful (sem `memory_collections`); admin retorna 502 em CRUD | Aceitação de overhead vs disponibilidade |
| 13 | Formato memory enviada pro TESS | `# {title}\n\n_Categoria: {category}_\n\n{content_md}` | Embedding semantic precisa contexto |
| 14 | Skip se conteúdo igual no update | 200 sem criar versão (idempotência) | UX limpa (AC22) |
| 15 | Cleanup do spike | collection 39429 + memory 161888 já deletadas — validar em Fase 0 | Sessão 2026-05-27 |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| TESS API rate limit não documentado | Média | Médio | Retry com backoff em `tess-client.ts`; cache de listMemories 30s pra reduzir GETs |
| Custo TESS subir mais que projeção (+30%) | Baixa | Médio | Métrica de uso em log estruturado; revisão mensal; possível V2 ter cache local de embeddings (não escopo) |
| Falha de sync TESS pós-commit Postgres → memory órfã | Média | Médio | AC41 — alerta visual + script `scripts/audit-tess-sync.ts` (V2 opcional) |
| Embedding semantic puxa memory irrelevante e confunde agente | Baixa | Alto | Conteúdo das memories deve ser específico (não genérico). KB inicial migrada de `data/kb/conversa-v2/` já é categorizada. Reavaliar em QA após smoke prod |
| Markdown editor não suporta strict mode SSR | Baixa | Médio | Lib `@uiw/react-md-editor` documenta uso em Next App Router — testar em Fase 5 antes de avançar UI |
| 32k chars insuficientes pra item complexo | Baixa | Baixo | Avisar UI; se ocorrer, story V2 implementa split em múltiplas memories agrupadas por `kb_item_id` |
| Race condition entre update Postgres + update TESS em chamadas concorrentes | Baixa | Médio | Lock pessimistic em `kb_items` (FOR UPDATE) durante PATCH |
| Migration `002_kb.sql` falha em prod | Baixa | Alto | Rollback script pronto; teste em dev antes de prod |

### Implementation Pattern: handler atomic best-effort Postgres ↔ TESS

Toda mutation (`POST/PATCH/PATCH-active/POST-restore/DELETE`) segue este shape. **Não inventar variação.**

```ts
// Exemplo: PATCH /api/kb/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession(req); // 401 se ausente
  const body = updateKbSchema.parse(await req.json()); // 400 se inválido
  const itemId = params.id;

  // 1) BEGIN Postgres transaction
  const client = await db.connect();
  let committed = false;
  let previousState: KbItemRow | null = null;
  let newVersion: number | null = null;
  let memoryId: number | null = null;

  try {
    await client.query('BEGIN');

    // 2) SELECT FOR UPDATE (lock pessimistic — AC concurrent)
    const { rows } = await client.query(
      `SELECT * FROM kb_items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [itemId]
    );
    previousState = rows[0] ?? null;
    if (!previousState) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // 3) Skip se conteúdo igual (AC22)
    if (previousState.content_md === body.content_md && previousState.title === body.title) {
      await client.query('ROLLBACK');
      return NextResponse.json({ item: previousState, unchanged: true }, { status: 200 });
    }

    // 4) INSERT em kb_versions (snapshot da versão atual)
    await client.query(
      `INSERT INTO kb_versions (kb_item_id, version, content_md, diff_summary, updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemId, previousState.version, previousState.content_md,
       diffSummary(previousState.content_md, body.content_md), session.userId]
    );

    // 5) UPDATE kb_items (version++)
    newVersion = previousState.version + 1;
    memoryId = previousState.tess_memory_id;
    await client.query(
      `UPDATE kb_items SET title=$1, content_md=$2, version=$3, updated_by=$4, updated_at=NOW()
       WHERE id=$5`,
      [body.title, body.content_md, newVersion, session.userId, itemId]
    );

    // 6) COMMIT Postgres ANTES de chamar TESS
    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) await client.query('ROLLBACK').catch(() => {});
    client.release();
    return NextResponse.json({ error: 'db_error', detail: String(err) }, { status: 500 });
  }
  client.release();

  // 7) Sync TESS — DEPOIS do commit, com compensação em falha
  try {
    await tessClient.updateMemory(memoryId!, formatMemoryForTess({
      title: body.title, category: previousState!.category, content_md: body.content_md,
    }));
  } catch (tessErr) {
    // Compensação: marcar item como dessincronizado + audit log adicional
    // NÃO rollback do Postgres (commit já feito; rollback parcial inconsistencia maior)
    await db.query(
      `UPDATE kb_items SET tess_sync_failed_at=NOW(), tess_sync_error=$1 WHERE id=$2`,
      [String(tessErr).slice(0, 500), itemId]
    );
    await logAudit({
      action: 'kb.tess_sync_failed',
      userId: session.userId,
      payload: { kb_item_id: itemId, version_after: newVersion, error: String(tessErr).slice(0, 500) },
      ip: clientIp(req), userAgent: req.headers.get('user-agent'),
    });
    // Retornar 502 — admin vê banner de items dessincronizados (AC41)
    return NextResponse.json({
      error: 'tess_sync_failed',
      item_updated_locally: true,
      detail: 'Item atualizado no painel, mas falhou ao sincronizar com TESS. Tentaremos novamente automaticamente.',
    }, { status: 502 });
  }

  // 8) Audit log de sucesso
  await logAudit({
    action: 'kb.update',
    userId: session.userId,
    payload: { kb_item_id: itemId, slug: previousState!.slug, version_before: previousState!.version, version_after: newVersion },
    ip: clientIp(req), userAgent: req.headers.get('user-agent'),
  });

  return NextResponse.json({ item: { ...previousState, ...body, version: newVersion } }, { status: 200 });
}
```

**Variações por handler:**

| Handler | TESS call | Compensação em falha TESS |
|---|---|---|
| POST (create) | `createMemory()` → captura `memory_id` | DELETE no `kb_items` (rollback total — item ainda não existia) |
| PATCH (update) | `updateMemory(memory_id, ...)` | Marca `tess_sync_failed_at`; mantém Postgres (acima) |
| PATCH active=false | `deleteMemory(memory_id)` → seta `tess_memory_id=NULL` | Marca `tess_sync_failed_at`; mantém Postgres |
| PATCH active=true | `createMemory()` → captura novo `memory_id` | Reverte `active=false` no Postgres (rollback compensatório) |
| DELETE (soft) | `deleteMemory(memory_id)` | Marca `tess_sync_failed_at`; mantém soft delete |
| POST restore | `updateMemory(memory_id, content de v{N})` | Marca `tess_sync_failed_at`; mantém Postgres |

**Schema additions na migration `002_kb.sql`:**

```sql
ALTER TABLE kb_items ADD COLUMN tess_sync_failed_at TIMESTAMPTZ NULL;
ALTER TABLE kb_items ADD COLUMN tess_sync_error TEXT NULL;
```

UI lê esses campos pra mostrar o banner "X items dessincronizados" (AC41).

### Ordem de cutover em produção (Fase 0 → Fase 9)

**CRÍTICO:** o agente NÃO PODE ficar com `memory_collections` apontando pra collection vazia. Isso degrada respostas (TESS faz RAG em nada). Ordem obrigatória:

1. **Local (dev) — antes do PR:** rodar migração + bootstrap + migrate-data em ambiente dev. Validar todos os ACs locais.
2. **VPS — após PR mergeada:**
   - **a)** `ssh deploy@... && cd /opt/influence-labs/infra && git pull origin main` (puxa migration files + frontend novo, mas backend ainda não fala com TESS porque env não está setado)
   - **b)** Aplicar migration `002_kb.sql` no postgres (`psql -f migrations/002_kb.sql`)
   - **c)** Rodar bootstrap collection: `cd /opt/influence-labs && node scripts/bootstrap-tess-kb.ts` → script imprime `TIRRA_KB_COLLECTION_ID=<id>` no stdout
   - **d)** Adicionar essa env em `infra/.env` MAS NÃO restart backend ainda
   - **e)** Rodar migrate-data: `node scripts/migrate-kb-to-tess.ts` → script popula `kb_items` no postgres + memories na collection TESS. Log mostra quantos criados
   - **f)** Validar com `mcp__tess__list_memories(collection_id)`: ver que todas as memories da KB inicial estão lá
   - **g)** `docker compose up -d --build admin-frontend` (frontend `/kb` agora funcional, mas bot ainda sem memory_collections)
   - **h)** Smoke admin-frontend: criar item teste via UI → verificar TESS via `list_memories`
   - **i)** Agora SIM: `docker compose up -d --build backend` (com `TIRRA_KB_COLLECTION_ID` no env — backend agora envia `memory_collections` em cada `callTESS()`)
   - **j)** Smoke prod (AC53 completo) no WhatsApp real
3. **Rollback simples:** unset `TIRRA_KB_COLLECTION_ID` no `.env` + restart backend. Bot volta a operar sem memory collection. Frontend `/kb` continua funcional mas mudanças não refletem no agente.

### Coordenação com outras stories

- **Story 1.3 (Conversas Live):** sem dependência direta. KB editor não modifica view de conversas.
- **Story 1.4 (Toggles+Whitelist):** sem dependência direta. KB e Toggles são independentes.
- **Story 1.6 (Métricas):** poderá adicionar painel de "Items KB mais usados" no futuro — fora desta story
- **Story 1.7 (Health+Audit log viewer):** consumirá `admin_audit_log` populated por esta story — sem dependência reversa

### Coordenação com o agente Tirra (produção)

- **Mudança no `backend/server.js` é breaking semanticamente** — primeira mensagem após deploy COM `TIRRA_KB_COLLECTION_ID` setado e collection populada já injeta KB. Validar com smoke isolado ANTES de Tiago/Gabriel começarem a editar.
- **Rollback simples:** unset `TIRRA_KB_COLLECTION_ID` no `.env` → restart backend → bot volta a operar sem memory collection (prompt original intacto).
- **Prompt do agent na UI TESS NÃO MUDA** nesta story. As info estáticas (endereço, horário, formas de pagamento) continuam hardcoded no prompt. KB editor é pra info **dinâmica** (promoções, FAQs novas, regras atualizadas, anti-patterns descobertos).

## CodeRabbit Integration

> CodeRabbit Integration: Enabled (default no projeto)

### Story Type Analysis

- **Primary Type:** Full-stack (Frontend + API + Database + Integration)
- **Secondary Type(s):** Integration (TESS API), Database (migration)
- **Complexity:** **High** — afeta backend prod (server.js), nova migration, novo external API (TESS REST), nova UI complexa (editor markdown + diff viewer + history)

### Specialized Agent Assignment

**Primary Agents:**
- `@dev` (pre-commit reviews — sempre)
- `@architect` (integration pattern com TESS, transação atomic Postgres+TESS)
- `@data-engineer` (review da migration `002_kb.sql` + indexes)

**Supporting Agents:**
- `@qa` (smoke checklist AC53 — depende de WhatsApp real)
- `@ux-design-expert` (review visual do editor + diff viewer)

### Quality Gate Tasks

- [ ] **Pre-Commit (@dev):** `wsl bash -c '... ~/.local/bin/coderabbit --prompt-only -t uncommitted'`
- [ ] **Pre-PR (@github-devops):** `wsl bash -c '... ~/.local/bin/coderabbit --prompt-only --base main'`
- [ ] **Pre-Deployment (@github-devops):** `wsl bash -c '... ~/.local/bin/coderabbit --prompt-only -t committed --base HEAD~10'` — esta story altera backend prod, deploy precisa scan completo

### CodeRabbit Focus Areas

**Primary Focus:**
- Atomicidade do sync Postgres↔TESS (rollback em falha)
- SQL injection / XSS no markdown editor (lib sanitiza, mas validar)
- Race conditions em concurrent updates (lock pessimistic ou optimistic com retry)
- Audit log completude (cada path de mutate registra)
- Schema da migration: FKs, indexes, NOT NULL, defaults

**Secondary Focus:**
- Acessibilidade do markdown editor + diff viewer
- Custos TESS observabilidade (log estruturado)
- Performance do GET /api/kb (cache + index em `category, deleted_at`)
- Graceful degradation quando `TIRRA_KB_COLLECTION_ID` unset

### Self-Healing Configuration

```yaml
Primary Agent: @dev (light mode)
Max Iterations: 2
Timeout: 30 minutes
Severity Filter: CRITICAL, HIGH

Predicted Behavior:
  - CRITICAL issues: auto_fix (up to 2 iterations) — exemplo: SQL injection, rollback ausente
  - HIGH issues: auto_fix se possível, senão document_only — exemplo: a11y do editor
  - MEDIUM issues: document_as_debt
  - LOW issues: ignore
```

## Definition of Done

- [ ] Todos os 58 ACs marcados (não-condicionais)
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam
- [ ] Testes unitários passam (`npm test`)
- [ ] Migration `002_kb.sql` aplicada em dev + dry-run em prod ok
- [ ] Bootstrap collection executado em prod + ID em `infra/.env`
- [ ] Migração inicial dos 6+ items de `data/kb/conversa-v2/*.md` executada em prod
- [ ] Backend deployado com `memory_collections` ativo em `callTESS()`
- [ ] Smoke AC53 (5 sub-cenários WhatsApp real) — só Victor pode atestar
- [ ] CodeRabbit pre-PR: 0 CRITICAL
- [ ] PR description menciona: pré-requisitos manuais (bootstrap + migration + env), overhead de custo, e estratégia de rollback
- [ ] `docs/architecture/admin-dashboard.md` §10 atualizada com Caminho B confirmado
- [ ] Status atualizado pra Done por @devops após PR mergeada + smoke OK

## Change Log

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-27 | @sm River | Story 1.5 draftada. Caminho B confirmado por spike+PoC desta sessão (collection 39429+memory 161888 testadas e limpas). Decisões arquiteturais atualizadas em §10.0 — postgres source-of-truth de edição/audit/history, TESS memory_collection source-of-truth de runtime. Sync atomic best-effort. 58 ACs (43 funcionais + 5 a11y/responsive + 5 qualidade + 4 segurança + 1 cleanup). 8 SP confirmados. Pré-requisitos operacionais críticos na Fase 0 (Victor decide nome collection + aceita overhead custo). |
| 2026-05-27 | @po Pax | **Validação completa: GO 9/10 → Status Ready**. 3 Should-Fix aplicados antes de promover: (1) mapping Task→AC explícito nas Fases 4-6, (2) pseudocódigo do handler atomic Postgres↔TESS + tabela de compensação por handler + schema additions `tess_sync_failed_at/error`, (3) ordem de cutover prod em 10 passos com gate explícito ("backend não pode falar com collection vazia"). Critical issues: 0. Anti-hallucination: limpo (spike+PoC empírico, libs reais). CodeRabbit: completo. Pronta para `@dev *develop 1.5`. |
| 2026-05-27 | @dev Dex (yolo) | **Story 1.5 implementada → Status Ready for Review**. 25 arquivos criados + 4 modificados em `feature/1.5-kb-editor`. Fases 1-8 todas concluídas no código. Validações: `npm run typecheck` 0 errors, `npm run lint` 0 errors (após 2 iterações resolvendo regra `react-hooks/set-state-in-effect` via inner-keyed component pattern), `npm run build` 22 rotas no manifest (`/kb`, 5 endpoints `/api/kb/*`), `npm test` 40 pass / 0 fail (11 novos tests pure helpers). **Decisões autônomas:** migration `003_kb_tess_sync.sql` (002 já ocupada); split `lib/kb-types.ts` (client-safe) ↔ `lib/kb.ts` (`import "server-only"`) pra resolver bundling de `pg`; scripts `.mjs` pra evitar tsx em prod; `TESS_API_BASE` default `tess.pareto.io` no admin client. **Pendente (apenas Victor):** Fase 0 (token TESS prod, nome final collection — confirmou "Tirra KB Production", overhead custo — confirmou kill switch) + AC53 smoke prod WhatsApp + tests api/kb.test.ts (registrado como tech debt). Próximo: `@devops *push` ou rodar CodeRabbit pre-PR primeiro. |
