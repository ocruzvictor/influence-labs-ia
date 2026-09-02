# Story: Admin — diálogo **Retomar IA** na ClientSidebar

**Epic:** [EPIC-resume-ia-pos-handoff](epics/EPIC-resume-ia-pos-handoff.md)  
**Tipo:** Brownfield  
**Status:** Done  
**Agente executor:** @dev (Composer 2.5 Fast) · UX GO Uma · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — desbloqueada: [resume-ia-2](salon-whatsapp-resume-ia-2-comando-api.md) Done (QA CONCERNS aceite). Paralelo com [resume-ia-3](salon-whatsapp-resume-ia-3-whatsapp-parser.md).  
**Branch sugerida:** `feature/resume-ia-pos-handoff`  
**Pedido / GO:** Victor / @aios-master 2026-09-01  
**Handoff:** [docs/handoffs/2026-09-01-plano-resume-ia-pos-handoff.md](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md) (rev. 3, GO)

## Contexto

Drill-down `/conversas/[phone]`: `frontend/admin/components/conversas/client-sidebar.tsx`. Ações atuais:

- Pausar bot → `POST /api/whitelist` `human_only`
- Bloquear → `block` (AlertDialog)
- **Adicionar nota** → `DisabledStubButton` (schema `notes` não existe; **permanece stub**)

GO #7: **adicionar** botão novo **Retomar IA**. Não substituir o stub. Não virar CRM de notas livres.

Auth de páginas: `frontend/admin/proxy.ts` — sem sessão → redirect `/login`. BFF não deve expor `ADMIN_TOKEN` no browser. Padrão interno: `BACKEND_INTERNAL_TOKEN` via `frontend/admin/lib/env.ts` (não ler `process.env` fora desse módulo). `saude/route.ts` hoje usa `Authorization: Bearer`; o Express resume da story 2 usa `X-Admin-Token`. BFF mapeia sessão → header que o backend aceita. `[AUTO-DECISION]` BFF envia `X-Admin-Token: env.BACKEND_INTERNAL_TOKEN` (ops alinha o valor com `ADMIN_TOKEN` no compose). Não usar Bearer se a rota Express só lê `x-admin-token`.

Toasts: `sonner` (`toast` em hooks existentes, ex. `use-kb.ts`).

## IN / OUT

**IN**

- BFF `frontend/admin/app/api/conversas/[phone]/resume/route.ts` — sessão obrigatória → POST upstream.
- Componente `ResumeIaDialog` na ClientSidebar: textarea 20–500, CTAs **Cancelar** / **Retomar IA**.
- Toasts: `sent` / `window_closed` / `already_active` / `human_spoke` (409) / 5xx.
- Pausar / bloquear / stub Adicionar nota **intactos**.

**OUT**

- Implementar CRM “Adicionar nota”.
- `ADMIN_TOKEN` no client bundle.
- Auto-clear whitelist.
- Parser WhatsApp (story 3).
- Mudar `proxy.ts` além do necessário (rotas `/conversas/*` já exigem sessão).

## Acceptance Criteria

- [x] **AC1:** `POST /api/conversas/[phone]/resume` (App Router) valida phone (`z.string().regex(/^\d{10,15}$/)`, mesmo padrão de `app/api/conversas/[phone]/route.ts`). Sem `getCurrentUser()` → 401 JSON (chamadas API) ; páginas `/conversas/...` sem cookie já redirecionam login via `proxy.ts`.
- [x] **AC2:** BFF encaminha `{ note, actor: "admin" }` para `${BACKEND_INTERNAL_URL}/admin/conversations/:phone/resume` com `X-Admin-Token`. Não loga a nota completa no client.
- [x] **AC3:** ClientSidebar ganha botão **Retomar IA** que abre diálogo. Stub **Adicionar nota** permanece disabled no mesmo bloco de Ações.
- [x] **AC4:** Textarea 20–500; submit desabilitado fora da faixa; CTA Cancelar fecha sem POST; **Retomar IA** dispara o BFF.
- [x] **AC5:** Toasts: `sent` sucesso; `window_closed` aviso (nota guardada); `already_active` info; 409 `human_spoke_recently` / `human_only` / `blocked` mensagem específica; 422/503 → erro 5xx-style. Não inventar status fora do contrato story 2.
- [x] **AC6:** Pausar bot e Bloquear número inalterados (mesmos handlers whitelist).
- [x] **AC7:** Testes do route BFF (401, validação nota, header token, mapeamento de status upstream). `npm test` da fatia admin (`node --test` em `frontend/admin/tests/api/`) passa.

## Tasks / Subtasks

- [x] **T1 (AC1, AC2, AC7):** `resume/route.ts` + teste em `frontend/admin/tests/api/` (espelhar `conversas` / `whitelist`).
- [x] **T2 (AC3–AC6):** `ResumeIaDialog` (+ opcional `resume-ia-dialog.tsx`). Wire na sidebar. Dialog pattern: já usam `@/components/ui/alert-dialog` — pode ser Dialog/AlertDialog do mesmo DS.
- [x] **T3:** Toasts sonner por `status` / HTTP.
- [x] **T4:** CodeRabbit a11y: label no textarea, focus no Cancelar coerente com dialog de bloqueio.

## Dev Notes

**Touch points**

- `frontend/admin/components/conversas/client-sidebar.tsx` — ADD botão, não remover `DisabledStubButton`.
- `frontend/admin/app/api/conversas/[phone]/route.ts` — GET timeline; novo sibling `resume/route.ts`.
- `frontend/admin/lib/env.ts` — `BACKEND_INTERNAL_TOKEN`, `BACKEND_INTERNAL_URL`.
- `frontend/admin/proxy.ts` — sessão.
- `frontend/admin/lib/session.ts` — `getCurrentUser`.
- `frontend/admin/lib/audit.ts` — audit principal no **backend** (story 2); BFF não precisa duplicar se o Express já grava `conversation.resume`. `[AUTO-DECISION]` não duplicar audit no Next se o upstream já audita; 401 local não precisa audit.

**Contrato upstream:** [resume-ia-2](salon-whatsapp-resume-ia-2-comando-api.md) tabela HTTP.

**Fonte:** handoff §Admin; GO #7; epic IN botão.

## File List (previsto)

| A/M | Path |
|-----|------|
| A | `frontend/admin/app/api/conversas/[phone]/resume/route.ts` |
| A | `frontend/admin/tests/api/conversas-resume.test.ts` |
| A | `frontend/admin/components/conversas/resume-ia-dialog.tsx` |
| M | `frontend/admin/components/conversas/client-sidebar.tsx` |
| M | `docs/stories/salon-whatsapp-resume-ia-4-admin-dialog.md` |

## Testing

- Unit/API: BFF 401, Zod 20–500, proxy header.
- Component: stub Adicionar nota ainda presente; Pausar/Bloquear não quebram.
- Sem browser E2E obrigatório nesta story (smoke visual = story 5 / @qa). Se houver Playwright no repo, um teste de render do botão é opcional.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Frontend
- Secondary: API (BFF), Security (token só server-side)
- Complexity: Medium

**Specialized Agent Assignment**

- Primary: @dev, @ux-design-expert
- Supporting: @qa

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): `coderabbit --prompt-only --base main`

**CodeRabbit Focus Areas**

- Primary: stub Adicionar nota intacto; token não no browser; textarea 20–500.
- Secondary: toasts cobrindo contrato; Pausar/Bloquear.

**Predict files:** `resume/route.ts`, `resume-ia-dialog.tsx`, `client-sidebar.tsx`, teste API.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## Dev Agent Record

- **Status:** InReview
- **Start:** 2026-09-01
- **End:** 2026-09-01
- **Agent:** @dev (Dex, YOLO)
- **IDS:** REUSE phone Zod de `conversas/[phone]/route.ts`; REUSE Dialog DS + sonner toasts; CREATE `resume/route.ts`, `resume-ia-dialog.tsx`, testes BFF.
- **Validation:** `npm run lint` OK (warnings pré-existentes); `npm run typecheck` OK; `npm test` 89 pass / 0 fail (10 conversas-resume + suite).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-01 | 0.0.1 | Created. Botão Retomar IA + BFF. Stub Adicionar nota permanece. | @sm |
| 2026-09-01 | 0.1.0 | Validated GO (8/10) — Status: Draft → Ready | @po |
| 2026-09-01 | 0.2.0 | Development complete (YOLO) — BFF resume + ResumeIaDialog + testes — Status: Ready → InReview | @dev |
| 2026-09-02 | 0.3.0 | QA Gate PASS — Status: InReview → Done | @qa |
| 2026-09-02 | 0.3.1 | close-story bookkeeping — epic index; Status Done intacto (QA PASS) `[closure-key: resume-ia.4:digest:working-tree:route@0693b1e6,dialog@dc0d858a,sidebar@e99d1680,test@918d0fdf,HEAD:468391d7]` | @po |

## QA Results

### Review Date: 2026-09-02

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:route@0693b1e6,dialog@dc0d858a,sidebar@e99d1680,test@918d0fdf,HEAD:468391d7

### Code Quality Assessment

Fatia admin fecha o IN: BFF `POST /api/conversas/[phone]/resume` exige sessão, valida phone (`^\d{10,15}$`) e nota 20–500, encaminha `{ note, actor: "admin" }` com `X-Admin-Token` a partir de `env.BACKEND_INTERNAL_TOKEN` (sem Bearer). ClientSidebar **adiciona** Retomar IA e mantém `DisabledStubButton` “Adicionar nota”. Pausar (`human_only`) e Bloquear (AlertDialog + `block`) não mudaram de handler. Toasts cobrem `sent` / `window_closed` / `already_active` / 409 (`human_spoke_recently`, `human_only`, `blocked`) / 422+5xx sem inventar status fora do contrato da story 2. Label no textarea e `autoFocus` em Cancelar atendem T4.

### Refactoring Performed

Nenhum. [AUTO-DECISION] missão: NÃO implemente — review only.

### Compliance Check

- Coding Standards: ✓ env só via `@/lib/env`; runtime nodejs no BFF
- Project Structure: ✓ sibling `resume/route.ts` + dialog extraído
- Testing Strategy: ✓ BFF unitário; E2E visual fora (story 5)
- All ACs Met: ✓ AC1–AC7 verificados no código

### Improvements Checklist

- [x] Review manual BFF + dialog + sidebar + testes
- [x] `npm test` em `frontend/admin` (89 pass / 0 fail; 10 conversas-resume)
- [ ] (futuro) Importar schemas exportados da route nos testes em vez de Zod duplicado
- [ ] (futuro) Teste de componente para matriz de toasts, se houver harness

### Security Review

Token interno não aparece no client bundle (`resume-ia-dialog` só faz `fetch` same-origin com cookie). Sem `NEXT_PUBLIC_*` para admin token. Nota não é logada no BFF nem no client.

### Performance Considerations

Um POST por submit; `maxLength={500}` no textarea. Sem regressão na timeline.

### Files Modified During Review

Nenhum source. Artefato: `docs/qa/gates/resume-ia.4-admin-dialog.yml`.

### Gate Status

Gate: PASS → docs/qa/gates/resume-ia.4-admin-dialog.yml

### Lifecycle Transition

PASS: InReview → Done
(QA applies this transition in Status and Change Log before handoff.)
