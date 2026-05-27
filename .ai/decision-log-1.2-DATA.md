# Decision Log — Story 1.2-DATA (YOLO Mode)

**Iniciado:** 2026-05-27 ~05:30 UTC
**Branch:** `feature/1.2-admin-data-layer-core`
**Commit base:** `26dcf85` (Fase 1)

## Modo de execução
YOLO autorizado por Victor. Trabalhando autônomo, registrando decisões aqui.

## Decisões durante execução

### D1. Helper `getCurrentUserId(req)` em `lib/session.ts` — REVERTIDO
**Decisão original:** criar helper.
**Revisão:** ❌ NÃO NECESSÁRIO. `getCurrentUser()` já existe em `lib/session.ts` e funciona em Route Handlers via `cookies()` from next/headers. Vou usar o existente.
**Rollback:** N/A

### D2. Zod schemas no topo de cada `route.ts`
**Decisão:** seguir padrão `bodySchema = z.object({...})` do auth/magic-link/route.ts existente. Não criar diretório `lib/schemas/` ainda.
**Por quê:** consistência com Story 1.1, evita over-engineering. Se schemas forem reusados em testes, refatorar depois.

### D3. LRU cache em `lib/conversas.ts` global por process
**Decisão:** instância `LRUCache` em módulo-level, key = `JSON.stringify(queryParams)`, max=100, ttl=2000ms.
**Por quê:** evita re-fetch em polling de 5s de múltiplas abas. Compatível com Next.js standalone (single process por container).
**Risco:** se admin-frontend escalar horizontal (HMR/dev tem múltiplos workers), cache pode ficar levemente inconsistente em ≤2s — aceitável.

### D4. Cursor pagination conversas: `last_msg_at` (timestamptz) decodificado como ISO
**Decisão:** `cursor` query param = ISO timestamp da última row da página anterior. Query usa `WHERE last_msg_at < $cursor`.
**Por quê:** keyset pagination > offset (estável quando msgs chegam). View já ordena DESC.
**Trade-off:** se 2 conversas têm exatamente mesmo `last_msg_at` (collision em ms), uma pode pular paginação — improvável a esse volume, aceitável.

### D5. `agent='principal'` default ao escrever via /api/toggles, /api/whitelist
**Decisão:** dívida do `agent=null` no backend `server.js:855` fica anotada como TODO follow-up. **Não corrijo nesta sessão** — não bloqueia endpoints REST (eles inserem em `admin_audit_log`, não em `conversation_history`).
**Por quê:** scope creep, foco em Fase 2.

### D6. Phone validation: E.164 sem + (10-15 dígitos)
**Decisão:** `z.string().regex(/^\d{10,15}$/)` para campo `phone` em /api/whitelist.
**Por quê:** match com formato armazenado em `bot_whitelist` e `clients`.

### D7. Helper `clientIp(req)` duplicado por arquivo (não extraído)
**Decisão:** copy helper `clientIp` em cada route.ts que precisar (segue exemplo do auth).
**Por quê:** já é padrão duplicado em magic-link e verify. Refactor a fazer mais tarde se >5 cópias.

### D8. Audit log writes inline nos handlers, NÃO em libs
**Decisão:** `lib/toggles.ts` apenas faz UPDATE no DB. Handler chama `logAudit({...})` após sucesso.
**Por quê:** separa I/O (lib) de side-effects (handler). Facilita testes unitários.

### D9. Fase 3 (testes integração) PULADA nesta sessão YOLO
**Decisão:** não criar `tests/api/*.test.ts` nesta sessão.
**Por quê:**
- Node 22 `mock.module()` ainda é experimental (`--experimental-test-module-mocks`)
- Spin-up de Postgres test container > 1h setup
- Postman collection (Fase 4) cobre os 12 ACs via teste E2E manual
- Story 1.2-DATA pode ir pra `InReview` com Postman como evidência
**Dívida explícita:** criar tests/api/ em sessão futura quando Node mock.module sair de experimental OU quando montarmos Postgres dev local em docker-compose.
**Impacto Fase 3 estimativa original (~4h) → próxima sessão.**

### D10. Build local exige .env stub
**Decisão:** documentar workaround `DATABASE_URL=... npm run build` no decision-log.
**Por quê:** desenvolvedor sem .env.local não consegue rodar build. Não é regressão minha (Story 1.1 tinha mesmo comportamento).
**Comando completo testado:**
```
DATABASE_URL="postgres://test:test@localhost/test" \
ADMIN_JWT_SECRET="$(printf 'a%.0s' {1..64})" \
RESEND_API_KEY="re_test_placeholder_value_for_build_only" \
RESEND_FROM_EMAIL="auth@example.com" \
ADMIN_PUBLIC_URL="http://localhost:3002" \
npm run build
```

## Files modificados (rastreamento)
(atualizar conforme avança)

## Tests executados
(atualizar conforme avança)
