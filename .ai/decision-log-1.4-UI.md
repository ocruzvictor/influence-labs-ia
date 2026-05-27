# Decision Log — Story 1.4 UI Toggle + Whitelist

**Story:** [admin-dashboard-story-1.4-ui-toggle-whitelist.md](../docs/stories/admin-dashboard-story-1.4-ui-toggle-whitelist.md)
**Agente:** @dev Dex
**Branch:** `feature/1.4-ui-toggle-whitelist`
**Modo:** YOLO autônomo
**Pre-Flight:** 2026-05-27

## Pré-condições (validadas)

| Item | Status |
|---|---|
| Story 1.3 mergeada em main (`e3f704b`) | ✅ |
| Helpers compartilhados disponíveis (lib/format/phone, lib/format/date, hooks) | ✅ |
| Backend API em produção (`/api/toggles`, `/api/whitelist`) | ✅ desde PR #8 |
| ACs 29-31 (drill-down stubs) AGORA no escopo | ✅ (1.3 mergeada) |

## Decisões fechadas (segue padrões da 1.3 + story doc Dev Notes)

| # | Decisão | Valor | Origem |
|---|---|---|---|
| D1 | Server/Client component split | Page `/toggles` = Server Component shell (com getCurrentUser via layout); cards e dialogs = Client Components | Padrão 1.3 |
| D2 | Fetching strategy | `fetch()` nativo + hooks custom, sem SWR/react-query | Padrão 1.3 + story Dev Notes |
| D3 | Confirmação no kill switch global | `<AlertDialog>` obrigatório com autoFocus em Cancelar (AC5, AC34) | Story doc |
| D4 | Confirmação em features | Sem AlertDialog — apenas toast pós-ação (UX rápida) | Story doc + Wireframe §327 |
| D5 | Confirmação em remove whitelist | `<AlertDialog>` obrigatório (ação destrutiva) | Story doc |
| D6 | Phone input behavior | Reusar `digitsOnly()` + `isValidPhone()` de `lib/format/phone.ts` (Story 1.3) | Reuse |
| D7 | "Pausar bot 1h" sem expiração real | `mode='human_only'` permanente — Tiago remove manualmente. Schema não tem `expires_at` | Story doc D5 |
| D8 | Optimistic update | Toggle UI vira imediatamente; revert em erro via toast + re-fetch | Story doc Riscos + boa UX |
| D9 | Toggle metadata mapping | `lib/toggles-meta.ts` com fallback safe quando key não está no mapping | Story doc D8 (defensive coding) |
| D10 | shadcn components a instalar | switch, radio-group, textarea, alert-dialog (dialog já existe da 1.3) | Story doc Fase 1 |

## Sequência de commits

1. **Pre-Flight + setup**: decision log + shadcn add + lib/toggles-meta.ts + lib/hooks/use-toggle-mutation.ts + lib/hooks/use-whitelist.ts
2. **Página /toggles** (kill-switch + features): page.tsx + kill-switch-card + features-card + toggle-row
3. **Whitelist CRUD**: whitelist-card + whitelist-table + whitelist-row + mode-badge + whitelist-add-dialog
4. **Wire-up drill-down (ACs 29-31)**: modificar client-sidebar.tsx pra ativar "Pausar bot 1h" + "Bloquear número" (note continua disabled)
5. **Tests + nav-link flip + commit final**

## Lições aprendidas Story 1.3 (aplicar preventivamente)

- React 19: NÃO `ref.current = value` no body de render → mover pra useEffect
- React 19: NÃO setState síncrono em effect body → defer via setTimeout(0) ou usar evento callback
- JSDoc com `*/` literal fecha bloco prematuramente — evitar mencionar tokens de JSX comment dentro de JSDoc
- Build precisa env stubs locais
- shadcn 4 instala em `components/ui/` automaticamente
- API guard (`isXxxResponse`) antes do cast — descoberto via CodeRabbit MAJOR na 1.3, aplico desde o início aqui

## Atenção máxima

**`frontend/admin/AGENTS.md`**: "NOT the Next.js you know" — Next 16 + React 19 + Tailwind 4. APIs divergem do training data. Helpers da 1.3 já lidaram com isso, reuso minimiza risco.
