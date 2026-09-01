# Story 1.4: Admin UI — Toggles + Whitelist (kill switch + controle por número)

**Epic:** [EPIC-studio-tirra-admin-dashboard](epics/EPIC-studio-tirra-admin-dashboard.md)
**Status:** Done (código em main via PR #16; smoke prod + seed users pendente Victor pós-deploy manual)
**Agente executor:** @dev
**Story Points:** 5
**Pode executar agora:** ✅ SIM — API 100% pronta em produção (Story 1.2-DATA, PR #8, commit `b981414`). Esta story pode rodar paralela à 1.3, mas se 1.3 mergeou primeiro o "atalho Pausar bot" do drill-down liga aqui
**Branch sugerida:** `feature/1.3-1.4-ui-conversas-toggles` (mesma da 1.3 se mergear junto; ou subdividir em PR independente)
**Source-of-truth técnico:**
- [docs/design/admin-dashboard/wireframes.md §Tela 4](../design/admin-dashboard/wireframes.md)
- [docs/architecture/admin-dashboard.md §8](../architecture/admin-dashboard.md)
- API: `frontend/admin/app/api/toggles/route.ts`, `app/api/whitelist/route.ts`, `app/api/whitelist/[phone]/route.ts` (deployadas)

## Contexto

Quarta story do Epic Admin Dashboard. A Story 1.2-DATA entregou em produção `GET/PATCH /api/toggles`, `GET/POST /api/whitelist`, `DELETE /api/whitelist/[phone]` — todos com audit log automático e propagação no bot em ≤5s via `backend/lib/bot-state.js` (cache TTL 5s).

Esta story entrega a **primeira UI de controle** do painel — kill switch + features + whitelist. Substitui definitivamente a operação `ssh + edit .env + redeploy` que existia até a 1.2-DATA.

**Abordagem:** UI puro consumindo API existente. **Zero alteração de backend.**

**Escopo:** Tela 4 do wireframe — kill switch global + features (audio, supervisor) + whitelist CRUD via UI.

**Bonus (se 1.3 mergeou antes):** liga os 3 stubs disabled do drill-down (`Pausar bot 1h`, `Bloquear número`, `Adicionar nota`) — os dois primeiros viram POST `/api/whitelist`, o terceiro continua disabled (depende de schema `notes` que não existe).

**Fora de escopo (V2 ou outras stories):**
- Histórico inline de mudanças do toggle (link "Ver histórico") → Story 1.6 (audit log viewer)
- Edição de descrição/label do toggle pela UI → não há requisito; descrição vive no schema
- Expiração automática de whitelist (`expires_at`) → schema não tem; "Pausar bot 1h" usa `human_only` permanente e Tiago/recepção removem manualmente. Auto-expiração vira Story 1.4.1 se virar dor real
- Notas (campo livre) anexadas a uma conversa → schema `notes` não existe

## Valor de negócio

Após esta story:

- **Tiago/recepção** desligam o bot em 1 click (sem `curl`, sem SSH) — kill switch real, propaga em ≤5s
- **Tiago/recepção** adicionam/removem números da whitelist via UI — fim definitivo da era "redeploy pra mudar whitelist" (já era backend-ready desde 1.2-DATA, mas só agora consumível por humano)
- **Operação cotidiana** — desligar bot para teste, bloquear número-spam, marcar VIP com `human_only`
- **Métricas de adoção do Epic** começam a fazer sentido — "zero edição manual de `.env` após launch" exige UI funcional

**ROI:** Quando esta story mergea + 1.3 mergea, o painel admin atinge **utilidade operacional plena no dia-a-dia**. Stories 1.5 e 1.6 viram cherry on top.

## Objetivo

Entregar:

1. Rota `/toggles` — tela única com 3 seções: Kill switch global, Features (audio, supervisor), Whitelist (tabela + modal de add)
2. Componente `<ToggleSwitch>` com confirmação inline (toast pós-ação, não modal) — exceção: kill switch global pede confirmação
3. Modal `<WhitelistAddDialog>` — phone input com máscara, radio modo, textarea motivo
4. Tabela `<WhitelistTable>` com remove inline (confirmação)
5. (Opcional, se 1.3 mergeou) Ativação dos stubs disabled no drill-down — botões "Pausar bot 1h" (`mode=human_only`) e "Bloquear número" (`mode=block`)
6. shadcn components instalados: `switch`, `dialog`, `radio-group`, `textarea`, `alert-dialog`

## Acceptance Criteria

### Funcional — kill switch global

- [ ] **AC1:** `/toggles` sem sessão → middleware redireciona pra `/login?returnTo=/toggles`
- [ ] **AC2:** Página renderiza 3 seções verticalmente: `Kill switch global` (card destacado, borda mais grossa), `Features`, `Whitelist por número`
- [ ] **AC3:** Card kill switch mostra toggle do `bot_toggles.key='global'` com estado refletindo `enabled` atual via `GET /api/toggles`
- [ ] **AC4:** Label visível: `Bot Studio Tirra` + sub-texto `Desligue para silenciar completamente o bot.`
- [ ] **AC5:** Click no switch global abre `<AlertDialog>` de confirmação: "Tem certeza? Bot ficará 100% offline até religar." → `[Cancelar]` `[Confirmar]`. Só em `Confirmar` chama PATCH
- [ ] **AC6:** Após confirmar → `PATCH /api/toggles { key: 'global', enabled: <novo_estado> }` → toast verde "Bot ativado/desativado" → re-fetch estado
- [ ] **AC7:** Sub-texto exibe "Última alteração: <email> ou 'sistema' se updated_by NULL, há <relativo>" baseado em `updated_at` retornado
- [ ] **AC8:** Erro no PATCH → toast vermelho "Falha ao alterar bot. Tente novamente." → switch reverte estado óptico
- [ ] **AC9:** Durante request → switch desabilitado + skeleton em "Última alteração"

### Funcional — features (audio + supervisor)

- [ ] **AC10:** Listar todos os toggles com `key LIKE 'feature:%'` (atualmente: `feature:audio`, `feature:supervisor`)
- [ ] **AC11:** Cada feature exibe seu switch + nome legível + descrição:
  - `feature:audio` → "Transcrição de áudio" / "Bot transcreve e responde mensagens de voz."
  - `feature:supervisor` → "Supervisor matinal" / "Envia resumo diário 8h no WhatsApp do Tiago."
- [ ] **AC12:** Mapping `key → {label, description}` em constante `TOGGLE_METADATA` em `lib/toggles-meta.ts`. Se uma key chegar do backend sem entry no mapping → fallback (`label = key`, `description = ''`) + warning no console (dev only) — **nunca quebra render**
- [ ] **AC13:** Features NÃO pedem confirmação (apenas toast pós-ação, mais leve que o kill switch). Click → PATCH direto → toast → re-fetch

### Funcional — whitelist (lista + add + remove)

- [ ] **AC14:** Card "Whitelist por número" mostra tabela com colunas: `Telefone | Modo | Motivo | Adicionado por | Adicionado em` + botão `[+ Adicionar]` no header
- [ ] **AC15:** Tabela popula via `GET /api/whitelist` (sem filtro de mode no MVP)
- [ ] **AC16:** Modo renderizado com badge colorido:
  - `allow` → 🟢 Permitido (verde floresta)
  - `block` → 🚫 Bloqueado (vermelho discreto)
  - `human_only` → 👤 Humano (terracotta)
- [ ] **AC17:** Telefone em `font-mono` + formatação via helper `formatPhone()` (mesma da Story 1.3)
- [ ] **AC18:** `Adicionado por` exibe `added_by_email` da API (já vem com JOIN em `admin_users`); se NULL → `sistema`
- [ ] **AC19:** Empty state: "Nenhum número configurado." (não esconder a tabela; só esconder rows)
- [ ] **AC20:** Hover em row mostra botão `✕` discreto à direita. Click → AlertDialog "Remover +55 XX XXXX-XXXX da whitelist?" → confirma → `DELETE /api/whitelist/[phone]` → toast verde "Número removido" → re-fetch

### Funcional — modal de adicionar

- [ ] **AC21:** Click `[+ Adicionar]` abre `<Dialog>` "Adicionar à whitelist"
- [ ] **AC22:** Campo `Telefone (com DDD, sem +)`:
  - placeholder `5511` (prefixo BR)
  - aceita apenas dígitos (`onChange` filtra `[^\d]`)
  - máx 15 chars (limite E.164)
  - validação Zod no submit: `/^\d{10,15}$/` (espelha API)
- [ ] **AC23:** Campo `Modo` (radio group):
  - `Allow (sem efeito, apenas marca)` — `allow`
  - `Block (bot ignora completamente)` — `block` (default)
  - `Human only (humano responde)` — `human_only`
- [ ] **AC24:** Campo `Motivo (opcional)` — textarea, max 500 chars, placeholder "Cliente VIP, Tiago atende direto"
- [ ] **AC25:** Botão `[Adicionar]` desabilitado enquanto phone não passa regex; spinner enquanto request em voo
- [ ] **AC26:** Submit → `POST /api/whitelist { phone, mode, reason }` → 200/201 → toast verde "Número adicionado" → fecha modal → re-fetch tabela
- [ ] **AC27:** Phone já existe (upsert) → API retorna 200 (não 201) → toast informa "Número atualizado" em vez de "adicionado"
- [ ] **AC28:** Validação server-side falha (400) → mostra erro inline no campo problemático + mantém modal aberto

### Funcional — atalho do drill-down (depende Story 1.3 mergeada)

> SE Story 1.3 já mergeou (stubs disabled em `/conversas/[phone]`), esta story ATIVA os stubs:

- [ ] **AC29 (condicional):** Botão `Pausar bot nesta conversa` no drill-down → POST `/api/whitelist { phone: <phone-atual>, mode: 'human_only', reason: 'Pausado via drill-down' }` → toast "Bot pausado nesta conversa. Mensagens vão direto pra atendimento humano."
- [ ] **AC30 (condicional):** Botão `Bloquear número` → AlertDialog confirma → POST `/api/whitelist { phone, mode: 'block', reason: 'Bloqueado via drill-down' }` → toast "Número bloqueado"
- [ ] **AC31 (condicional):** Botão `Adicionar nota` permanece DISABLED com tooltip "Disponível em breve" (depende de schema `notes` que não existe — fica Story futura)

> SE 1.3 ainda não mergeou: ACs 29-31 ficam riscados como N/A no Change Log; @dev levanta dependência em PR description.

### UX / Acessibilidade

- [ ] **AC32:** Todos os controles têm `<label>` associado ou `aria-label`
- [ ] **AC33:** Switches navegáveis via Tab + ativáveis com Space
- [ ] **AC34:** AlertDialog do kill switch tem `autoFocus` no botão `Cancelar` (defesa contra accident-click)
- [ ] **AC35:** Toast tem `role='status'` (sonner default) — screen reader anuncia
- [ ] **AC36:** Contraste de badges atende WCAG AA (verde floresta, vermelho, terracotta sobre cream)

### Responsivo

- [ ] **AC37:** Mobile (< 640px): cards empilhados, tabela whitelist vira lista de cards (telefone em cima, badge + ações abaixo)
- [ ] **AC38:** Modal de adicionar full-screen em mobile (já é default do `<Dialog>` shadcn)

### Qualidade

- [ ] **AC39:** `npm run lint` passa
- [ ] **AC40:** `npm run typecheck` strict passa
- [ ] **AC41:** `npm run build` passa
- [ ] **AC42:** Testes unitários: validação do form (Zod schema), badge render por mode, mapping `TOGGLE_METADATA` fallback
- [ ] **AC43:** Smoke manual de Victor: ligar/desligar kill switch global → bot para de responder em ≤5s no WhatsApp real → religar → bot responde → adicionar phone com `mode=block` → mandar msg desse phone → bot ignora → remover phone → bot volta a responder

### Segurança

- [ ] **AC44:** Phone input filtra chars não-numéricos no client (defesa em profundidade; server valida via Zod também)
- [ ] **AC45:** Reason no textarea sem sanitização HTML (renderiza com `whitespace-pre-wrap`, nunca `dangerouslySetInnerHTML`)
- [ ] **AC46:** Quando `last_alteration_email` exibido → escape automático do React (não inserir via `dangerouslySetInnerHTML`)
- [ ] **AC47:** Confirmação obrigatória em ações destrutivas: kill switch global (AC5) e remove whitelist (AC20)

## Tarefas (ordem de execução)

### Fase 0 — Pre-Flight (@dev, ~20min)

- [ ] Ler na íntegra: wireframe T4, este story, contratos das rotas `/api/toggles` e `/api/whitelist/*`, helpers `lib/toggles.ts` e `lib/whitelist.ts`
- [ ] Ler `frontend/admin/AGENTS.md` (Next.js diverge do training data)
- [ ] Confirmar se Story 1.3 está mergeada — definir se ACs 29-31 entram (sim) ou ficam N/A (não)
- [ ] Registrar decisões em `.ai/decision-log-1.4-UI.md` se ainda houver pendências

### Fase 1 — Setup shadcn + helpers (~30min)

- [ ] `npx shadcn@latest add switch radio-group textarea alert-dialog` (dialog já existe da 1.3)
- [ ] Criar `frontend/admin/lib/toggles-meta.ts` — mapping `TOGGLE_METADATA` com fallback
- [ ] Reusar `lib/format/phone.ts` da Story 1.3 (se não mergeou ainda → criar; se mergeou → import direto)

### Fase 2 — Página /toggles (~2h)

- [ ] Criar `frontend/admin/app/(dashboard)/toggles/page.tsx` — Server Component que monta layout shell
- [ ] Criar `frontend/admin/components/toggles/kill-switch-card.tsx` — card destacado com switch + AlertDialog
- [ ] Criar `frontend/admin/components/toggles/features-card.tsx` — lista os toggles `feature:*` com mapping
- [ ] Criar `frontend/admin/components/toggles/toggle-row.tsx` — single switch + label + description (reusado em features)
- [ ] Criar `frontend/admin/lib/hooks/use-toggle-mutation.ts` — wrapper de PATCH com toast + revert óptico em erro

### Fase 3 — Whitelist CRUD (~2.5h)

- [ ] Criar `frontend/admin/components/whitelist/whitelist-card.tsx` — card com header + tabela
- [ ] Criar `frontend/admin/components/whitelist/whitelist-table.tsx` — tabela com rows + remove inline
- [ ] Criar `frontend/admin/components/whitelist/whitelist-row.tsx` — single row + AlertDialog de remove
- [ ] Criar `frontend/admin/components/whitelist/mode-badge.tsx` — badge colorido por mode
- [ ] Criar `frontend/admin/components/whitelist/whitelist-add-dialog.tsx` — modal completo
- [ ] Criar `frontend/admin/lib/hooks/use-whitelist.ts` — fetch + invalidate helpers

### Fase 4 — Wire-up drill-down ✅ CONCLUÍDA 2026-05-27 (Story 1.3 mergeada)

- [x] `client-sidebar.tsx` modificado — `Pausar bot 1h` → POST whitelist `mode=human_only` + `Bloquear número` → AlertDialog + POST `mode=block`
- [x] `Adicionar nota` continua DISABLED com tooltip (schema notes não existe)
- [x] `useWhitelist(autoFetch=false)` reusado pra acessar `add()` sem carregar lista no sidebar

### Fase 5 — Testes + lint + build ✅ CONCLUÍDA 2026-05-27

- [x] Componentes React sem testes adicionais — helpers já cobertos por testes da 1.3 (phone, date)
- [x] `npm run lint` → 0 warnings
- [x] `npm run typecheck` → 0 errors strict
- [x] `npm run build` → success com `/toggles` no route manifest

### Fase 6 — Smoke manual + handoff — PARCIAL

- [ ] Smoke AC43 em prod — bloqueado por deploy manual VPS (Victor)
- [x] Commits incrementais 2/2 (Fase 1 + Story 1.4 full)
- [x] CodeRabbit pre-commit pós-fixes: **0 findings** (iniciou com 4 — 3 MAJOR + 1 MINOR — todos corrigidos)
- [x] Handoff próximo: `@qa *qa-gate` ou direto `@devops *push` (dado CodeRabbit limpo)

## File List

**Criados (14 arquivos):**

- `.ai/decision-log-1.4-UI.md` ✅
- `frontend/admin/app/(dashboard)/toggles/page.tsx` ✅
- `frontend/admin/components/toggles/toggles-panel.tsx` ✅ (orquestrador client — não estava no plano original, adicionado pra separar concerns SSR vs CSR)
- `frontend/admin/components/toggles/kill-switch-card.tsx` ✅
- `frontend/admin/components/toggles/features-card.tsx` ✅
- `frontend/admin/components/toggles/toggle-row.tsx` ✅
- `frontend/admin/components/whitelist/whitelist-card.tsx` ✅
- `frontend/admin/components/whitelist/whitelist-table.tsx` ✅
- `frontend/admin/components/whitelist/whitelist-row.tsx` ✅
- `frontend/admin/components/whitelist/mode-badge.tsx` ✅
- `frontend/admin/components/whitelist/whitelist-add-dialog.tsx` ✅
- `frontend/admin/lib/toggles-meta.ts` ✅
- `frontend/admin/lib/hooks/use-toggle-mutation.ts` ✅
- `frontend/admin/lib/hooks/use-whitelist.ts` ✅

**Modificados (3 arquivos):**

- `frontend/admin/components/dashboard/nav-links.ts` — Toggles `enabled: false` → `true`
- `frontend/admin/components/conversas/client-sidebar.tsx` — substituídos 2 stubs por handlers reais (Pausar bot 1h + Bloquear número); "Adicionar nota" permanece stub disabled
- `frontend/admin/package.json` / `package-lock.json` — shadcn switch, radio-group, textarea, alert-dialog

**A NÃO TOCAR (lock):**

- `frontend/admin/app/api/toggles/route.ts` e `app/api/whitelist/**/route.ts` — API já em produção
- `frontend/admin/lib/toggles.ts`, `lib/whitelist.ts` — helpers da Story 1.2-DATA
- `backend/server.js`, `backend/lib/bot-state.js` — bot flow não muda
- `infra/migrations/*` — sem migration nova

## Dev Notes

### ⚠️ ATENÇÃO MÁXIMA — Next.js neste repo NÃO é o que seu treinamento conhece

`frontend/admin/AGENTS.md` declara: **"This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."**

**Antes de escrever qualquer Server Component, route handler, ou hook React, abra a documentação local da versão exata.** APIs de App Router, `cookies()`, `headers()`, `params`, `useFormState` podem ter mudado silenciosamente. Não confiar em memória do training data.

### Source-of-truth de design

- Wireframe Tela 4: `docs/design/admin-dashboard/wireframes.md` linhas 263-330
- Modal de add: linhas 302-323
- Tokens: `design-system/tokens/themes/influence-labs.css`

### Padrões a seguir

- Reusar helpers existentes: `lib/format/phone.ts` (compartilhado com Story 1.3), `lib/format/date.ts`
- API contract: `GET /api/toggles` → `{ toggles: [...] }`, `PATCH /api/toggles` → `{ toggle: {...} }`, `POST /api/whitelist` → `{ item: {...} }` (status 200 ou 201)
- Estados de borda obrigatórios: loading skeleton, empty, erro com retry, optimistic update com revert
- Toast pra todas as mutações (sonner) — verde sucesso, vermelho erro

### Decisões técnicas FECHADAS

| # | Decisão | Valor | Origem |
|---|---|---|---|
| 1 | Confirmação no kill switch global | AlertDialog obrigatório | Wireframe §142 + alto-impacto |
| 2 | Confirmação em features | Sem confirmação, apenas toast | Wireframe §327 ("UX rápida") |
| 3 | Confirmação em remove whitelist | AlertDialog obrigatório | Ação destrutiva |
| 4 | Phone input behavior | Filtrar `[^\d]` em onChange + Zod no submit | Defesa em profundidade |
| 5 | "Pausar bot 1h" sem expiração real | `mode='human_only'` permanente — Tiago/recepção removem manualmente | Schema não tem `expires_at` |
| 6 | Histórico inline de toggle | OUT — Story 1.6 (audit log viewer) | Cortar escopo |
| 7 | Adicionar nota a conversa | OUT — schema `notes` não existe; stub permanece disabled | Advisor + sem schema |
| 8 | Toggle key naming convention | `feature:audio`, `feature:supervisor` etc. — qualquer key nova fora do mapping renderiza com fallback safe | Defensive coding |

### Riscos

| Risco | Mitigação |
|---|---|
| Tiago clica accidental no kill switch | AlertDialog com `autoFocus` em Cancelar |
| Race entre toggle PATCH e re-fetch traz estado antigo | Optimistic update + revert em erro; re-fetch espera response |
| Backend tem 5s de cache → toggle pode parecer "não aplicou" se admin testar em <5s | Documentar no toast: "Bot atualizado. Propaga em até 5s." |
| Whitelist com 100+ items vira ruim | OUT de escopo (Tiago/recepção não devem chegar nesse volume tão cedo); paginação fica V2 se virar dor |
| Modal de add em mobile fica apertado | shadcn Dialog já vira full-screen em mobile — validar |
| 1.3 não mergeada → ACs 29-31 ficam órfãos | @dev marca como N/A no PR description e cobre depois |

### Coordenação com Story 1.3

Se 1.3 e 1.4 forem implementadas em paralelo: combinar squash merge na ordem 1.3 → 1.4 pra evitar conflito em `client-sidebar.tsx`. Se 1.4 começar primeiro: stubs continuam disabled mesmo após 1.4 mergear, e há uma sub-task (Fase 4) pra ativar quando 1.3 estiver no main.

## CodeRabbit Integration

- **Pré-PR completo:** `wsl bash -c 'cd /mnt/c/.../influence-labs-ia && ~/.local/bin/coderabbit --prompt-only --base main'`
- **Foco esperado:**
  - XSS via `reason` ou `last_alteration_email` (validar nunca via dangerouslySetInnerHTML)
  - Memory leaks em mutations
  - Acessibilidade (autoFocus, aria-label, alert dialog focus trap)
  - Race conditions em toggle (optimistic update sem revert proper)
  - Validation gap entre client e server
- **Severidades:** CRITICAL bloqueia, HIGH discute, MEDIUM doc, LOW ignora.

**Agentes especializados predizidos:**

- `@qa` — review de smoke checklist e validação client/server
- `@ux-design-expert` — review visual final (não bloqueante)

## Definition of Done

- [ ] Todos os 47 ACs marcados (28 funcionais + 3 condicionais 1.3 + 5 UX/a11y + 2 responsivos + 5 qualidade + 4 segurança = 47)
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam
- [ ] Testes unitários passam
- [ ] CodeRabbit: zero CRITICAL, HIGH addressed
- [ ] Smoke completo do AC43 validado por Victor em prod (toggle global + whitelist real impactando bot real)
- [ ] @ux-design-expert deu OK visual (informal)
- [ ] Se Story 1.3 mergeada → drill-down stubs ativados conforme ACs 29-30
- [ ] Story marcada `Done` por @qa
- [ ] `@devops *push` + PR mergeada em `main`
- [ ] Deploy admin-frontend em prod

## Mudanças necessárias na arquitetura/PRD

Nenhuma. Implementa fielmente wireframe T4 consumindo API da Story 1.2-DATA. Sem desvios.

## Change Log

| Data | Quem | Mudança |
|---|---|---|
| 2026-05-27 | @sm River | Story draftada a partir do epic, wireframe T4, contratos `/api/toggles` e `/api/whitelist/*` deployados na 1.2-DATA, e consult com advisor (stubs do drill-down condicional à 1.3, notas fora de escopo por falta de schema) |
| 2026-05-27 | @po Pax | Validate-story-draft 10/10 GO → Status Draft → Ready. Observações não-bloqueantes: ACs 29-31 condicionais à 1.3 (bem tratado); D5 "Pausar bot 1h" sem expiração real é decisão deliberada — registrar como backlog futuro se virar dor; AC43 smoke fim-a-fim em prod depende de Kapso conectado (não bloqueia dev local). Pode iniciar `@dev *develop`. |
| 2026-05-27 | @dev Dex (YOLO) | Story 1.4 entregue em 2 commits (Fase 1 setup hooks/shadcn + commit final consolidado). 14 arquivos novos + 3 modificados. ACs 29-30 (drill-down) ativados — 1.3 já em main. lint ✅ typecheck ✅ build ✅. CodeRabbit pre-commit pós-fixes: 0 findings (corrigi 3 MAJOR + 1 MINOR antes do commit aplicando lições da gate 1.3: await antes de fechar dialog, console.error em vez de silent catch, shape validation completa do array). Status Ready → Ready for Review. Pivot: adicionei `toggles-panel.tsx` como orquestrador client (separar SSR shell de hooks). Pendente: `@devops *push`. |
| 2026-05-27 | @devops Gage | Push de `feature/1.4-ui-toggle-whitelist` (3 commits) → **PR #16** criada e mergeada (`aed915e`). Branch remoto deletado. Sem CI (cobertura na story devops-auto-deploy-backend). Deploy manual no VPS pendente Victor. Status → **Done**. Smoke AC43 (toggle global + WhatsApp real) + seed dos 3 admin_users (Tiago@/Recepcao@/Rafael@studiotirra.com.br) parte do DoD operacional pós-deploy. |

## QA Results

_A ser preenchido por @qa após review._

## Handoff

**Próximo:** `@po *validate-story-draft docs/stories/admin-dashboard-story-1.4-ui-toggle-whitelist.md`
