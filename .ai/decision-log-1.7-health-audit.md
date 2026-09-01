# Decision Log — Story 1.7 (Saúde + Auditoria) — yolo mode

**Story:** docs/stories/admin-dashboard-story-1.7-health-audit-viewer.md
**Branch:** `feature/1.7-health-audit-viewer`
**Modo:** yolo (autônomo)
**Iniciado:** 2026-05-28
**Agente:** @dev Dex

## Decisões Fase 1 — backend /health enrichment

| # | Decisão | Por quê | Alternativas |
|---|---|---|---|
| F1.1 | Edit `db.js` adicionando `getPoolStats()` em vez de exportar `getPool()` | API mínima, encapsula shape `{total, idle, waiting}`; consumer não precisa conhecer pg.Pool | Exportar `pool` direto — vaza shape interno do pg; exportar `getPool()` — força consumer a saber chamar `.totalCount` etc |
| F1.2 | `globalLastOkAt` como `let` de módulo em `server.js` (não no `db.js`) | Mantém `db.js` puramente como camada de conexão; tracking de health é responsabilidade do `/health` handler | Colocar no `db.js` — pollutes single-purpose lib |
| F1.3 | `await db.query('SELECT 1')` dentro do `/health` em vez de wrappar `query()` | Zero overhead em queries reais (callTESS, persist conversation); custo é só no `/health` que é low-volume | Wrappar `query()` global — adiciona ms em cada hot-path query |
| F1.4 | Cache `pingTrinks` 60s em **sucesso E falha** | Evita martelar Trinks durante outage (cenário pior — bot já está sofrendo, não piora) | Cache só em sucesso — cada `/health` durante outage tenta de novo, derruba Trinks ainda mais |
| F1.5 | Endpoint do ping = `/servicos` | Já cached/consumido pelo bot em prod, light GET, sem efeito colateral (apenas leitura) | `/profissionais` (também light); `/agendamentos/profissionais/<date>` (mais pesado); endpoint dedicado de health (não existe na Trinks) |
| F1.6 | Handler `/health` virou `async` | Necessário pro `await db.query` e `await pingTrinks()`. Express aceita async handlers nativamente desde 4.x | Callback-style — código ilegível com 2 awaits sequenciais |

## Decisões Fase 2 — proxy /api/saude

| # | Decisão | Por quê | Alternativas |
|---|---|---|---|
| F2.1 | Cache em memória do processo (Map de módulo, não Redis) | Single-instance deploy atual; Redis seria over-engineering. CodeRabbit major flag documentado em comentário | Redis — overhead pra cenário 1 instância |
| F2.2 | Cache aplicado SÓ em sucesso | `degraded` response em backend unreachable não cacheia → próxima request retenta na hora | Cachear sempre — risco de "preso em degraded" por 5s |
| F2.3 | Timeout fetch 3s (mais curto que o internal 10s do fetchTrinks) | Polling 10s no client; >3s já é UX ruim. `AbortController` cancela cleanly | 10s — overhead em outage |
| F2.4 | Auth via `proxy.ts` (não `requireSession` manual) | Padrão existente no admin; handler fica limpo | requireSession — duplica camada |
| F2.5 | Header `X-Health-Cache: HIT\|MISS` | Debugging de cache em prod sem precisar instrumentação extra | Sem header — perde visibilidade |

## Decisões Fase 3-7 — UI

| # | Decisão | Por quê | Alternativas |
|---|---|---|---|
| F3.1 | Reusar `lib/format/date.ts` (`formatRelative`) | Já usa `date-fns` + locale `ptBR`, já produzia "há 4 minutos" etc; criar relative-time.ts duplicaria | Criar helper novo — duplicação sem ganho |
| F3.2 | Reusar `lib/hooks/use-polling.ts` (não criar `use-health-poll.ts`) | Hook existente já implementa pause-on-hidden, ref-based callback latest, sem overlap, cleanup robusto | Criar novo — duplica lógica testada |
| F3.3 | `LastCheckedCounter` como componente irmão (não pai dos cards) | Counter re-renderiza a cada 1s; isolá-lo evita re-render dos `<HealthCard>` (4 nodes pesados) | Counter no pai — performance ruim |
| F3.4 | `useState<number \| null>(null)` + `setTimeout` no useEffect | Escapa de `react-hooks/purity` (Date.now() impure no render) e `react-hooks/set-state-in-effect` (Next 16/React 19) | useState(Date.now()) — lint error |
| F4.1 | `<Input type="date">` nativo (não shadcn calendar) | shadcn calendar puxa react-day-picker que tem typecheck error no Next 16. Browser date picker é suficiente pro MVP (Tiago/recepção usam Chrome) | shadcn calendar — erro de tipos |
| F4.2 | URL `?tab=` como source-of-truth (router.replace) | Permite deep-link via avatar dropdown ("Auditoria" → `/saude?tab=auditoria`) sem flash visual | useState local — perde deep-link |
| F5.1 | `/api/admin-users` novo endpoint trivial | Filtro Select user precisa de lista de admins; usar primeira página de audit_log limitaria a quem já apareceu em log | Sem filtro user — pior UX |
| F5.2 | `ALL_USERS_SENTINEL = "__all__"` (shadcn Select não aceita value="") | Implementação de Select Radix — value="" não dispara onChange | Limpar via undefined — Select não suporta |
| F5.3 | IP mascarado por default + toggle | LGPD light + screenshot safety (AC62) | Sempre mostrar — leak risk |
| F5.4 | Action badge color via mapping inline em `audit-tab.tsx` | UI-only, ligado à paleta admin; não vale generalizar | Lib helper — over-engineering |
| F5.5 | `setTimeout(fn, 0)` em useEffect inicial pra fetchPage | Padrão da Story 1.5 pra `react-hooks/set-state-in-effect` | useReducer/dispatch — não muda diagnóstico |
| F5.6 | `useState(initialValues)` sem sync useEffect | "You might not need an effect" — initialValues é "default no mount" não "controlled prop" | useEffect sync — lint error |
| F6.1 | Streaming via single `new Response(body)` (não ReadableStream linha-a-linha) | 5k rows × ~200 bytes = ~1MB; cabe em memória sem problema. ReadableStream traria complexidade desnecessária | ReadableStream — complexity sem ganho |
| F6.2 | Auto-log `audit.export` ANTES de streamar | Garante registro mesmo se download falhar/usuário fechar a aba mid-stream | Após stream — perde events em falha |
| F6.3 | `window.location.href = url` pro download (não fetch+blob) | Browser segue cookie httponly nativamente; fetch+blob teria mais código sem ganho | fetch+blob — mais código |
| F6.4 | Limit hardcoded 5k (não env var) | Decisão de produto fixa; mudar precisa code review | Env — sobrecomplica |
| F7.1 | DropdownMenuItem com `asChild` + `<Link>` | Próprio padrão shadcn pra prefetch + accessible navigation | onSelect + router.push — perde prefetch |

## Decisões Fase 8 — qualidade

| # | Decisão | Por quê | Alternativas |
|---|---|---|---|
| F8.1 | Remover `components/ui/calendar.tsx` | Não usado, typecheck error com react-day-picker v10 | Manter + ts-expect-error — esconde dívida |
| F8.2 | Testar internals via `__internal` export | Mantém API pública limpa, permite test surface granular | Export tudo — pollutes module API |
| F8.3 | `setTimeout(initial, 0) + setInterval` no LastCheckedCounter | Padrão duplo pro lint puro + intervals contínuo | useReducer + useDeferredValue — over |

## Decisões pós Self-Healing (iteration 1)

| # | Decisão | Por quê | Alternativas |
|---|---|---|---|
| SH1 | `safeHostname()` retorna fallback "URL inválida" pra inputs malformados | CodeRabbit CRITICAL: `new URL()` throw em strings inválidas. Helper centralizado evita repetição | Inline try/catch — duplica |
| SH2 | `safeIsoMinute()` valida via `isNaN(getTime())` antes de toISOString | CodeRabbit CRITICAL: `new Date(invalid).toISOString()` throw "RangeError: Invalid time value" | Inline check — duplica |
| SH3 | Tests adicionais (4 cenários) pros safe helpers | Garantir que o fix não regrida em refactor futuro | Sem tests — risco |
| SH4 | Remover `react-day-picker` do package.json | Dependência órfã (instalada pelo shadcn add calendar mas calendar.tsx foi deletado) | Manter — bundle bloat |
| SH5 | Cache `/api/saude` documentado com comentário de limitação | CodeRabbit major: cache não-shared entre instâncias. Decisão arquitetural consciente pra single-instance | Implementar Redis — over-engineering |
| SH6 | Ignorar minor TTL edge case (CodeRabbit findings finais) | LOW severity por config self-healing; impact desprezível (TTL ~4.8s em vez de 5s no pior caso) | Fixar — perfeccionismo sem ganho |

## Verificações finais

| Check | Resultado |
|---|---|
| `npm run lint` | 0 errors (1 warning pre-existente em `lib/kb.ts` Story 1.5) |
| `npm run typecheck` | 0 errors strict |
| `npm run build` | Success, 26 rotas no manifest |
| `npm test` | 67/67 pass + 22 skipped pre-existentes |
| CodeRabbit `-t committed --base main` | 0 CRITICAL após self-healing iter 1 |
| Smoke `curl /health` backend local | OK shape correto + Trinks real 1.1s + pool null graceful |
| Smoke `/saude` em browser dev | **PENDENTE Victor** — só build/typecheck/lint validados estaticamente |
| Smoke prod AC58 (6 sub-cenários) | **PENDENTE Victor** |

## Métricas

- **Tempo total:** ~3h em yolo
- **Tempo Fase 1 (backend):** ~25min
- **Tempo Fases 2-8 (admin):** ~2h
- **Tempo CodeRabbit + self-healing:** ~15min
- **Tempo doc/changelog/decision-log:** ~20min
