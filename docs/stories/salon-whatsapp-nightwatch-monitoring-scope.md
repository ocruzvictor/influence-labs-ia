# Story: Nightwatch confiável por timeout e escopo de cliente

**Epic:** Follow-up brownfield de [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield · confiabilidade operacional  
**Status:** **Done · @qa PASS**  
**Prioridade:** **P0 — confiabilidade**  
**Branch atual:** `feature/tess-commit-honesty`  
**Executor:** @dev  
**Quality Gate:** @qa — PASS

## Referências

- Diagnóstico @architect/Aria fornecido para esta story — fonte normativa do escopo e dos ACs.
- [CodeRabbit runtime `a413e16` — M2/M3](../qa/coderabbit-reports/epic-tess-commit-honesty-runtime-a413e16-2026-09-03.jsonl) — colisão de last4 e evidência de mutação sem escopo de cliente.
- [Epic Tess commit honesty — Objetivo](epics/EPIC-tess-commit-honesty.md#objetivo) — I1: fala de sucesso deve corresponder ao commit real.
- [Story 12 — Contexto e causa](salon-whatsapp-tess-commit-12-cancel-timeout-fallback.md#contexto-e-causa) — origem do evento `tess.timeout`.
- [Booking Confirmation Flow — decisão recomendada](../architecture/booking-confirmation-flow.md#5-decisão-recomendada) — confirmação somente depois do sucesso Trinks.
- `backend/lib/nightwatch-ops.js` — implementação brownfield de patrol, órfãos e verificação.
- `backend/lib/trinks-api.js`, `backend/lib/trinks-usage.js` e `infra/migrations/007_trinks_local_snapshots.sql` — ledger existente e coluna `metadata JSONB`.

> **Accumulated context:** não existe `accumulated-context.md` neste repositório na preparação desta story. Para coerência entre stories, foi usado o epic e a Story 12 acima; nenhuma exigência foi inferida de um artefato ausente.

## Story

**As a** operador do Nightwatch,  
**I want** sinais P0 e provas de commit vinculados ao cliente correto,  
**so that** o supervisor não ignore timeouts nem atribua a um cliente o outcome ou a mutação de outro.

## Contexto e causa

O Nightwatch tem três falhas de confiabilidade:

1. `patrolLive` observa `tess.empty` em `p0_leaks`, mas não transforma `tess.timeout` em sinal P0 próprio; assim, um timeout pode não acionar o peer.
2. `verifyCommit(last4)` lê mutações `agent_mutation` globais da janela. Um 2xx de outro cliente pode provar incorretamente o commit consultado. Além disso, last4 não identifica um cliente quando há colisão.
3. `listOrphans` correlaciona `tags.parsed` e outcomes por last4. Telefones completos diferentes com os mesmos quatro dígitos podem esconder um órfão. `booking.rescheduled` também não integra `OUTCOME_EVENTS`, então uma remarcação válida pode ser reportada como órfã.

O ledger `trinks_api_requests` já possui `metadata JSONB`; a correção deve usar essa coluna existente, sem migration. O telefone completo é dado interno de correlação. As saídas públicas do Nightwatch continuam expondo somente last4 e snippets redigidos.

## IN

- Monitorar `tess.timeout` como sinal P0 separado, `p0_timeout`.
- Fazer `next_action='activate-peer'` reagir a timeout.
- Manter `patrolLive` global e tornar somente `verifyCommit` client-scoped.
- Resolver last4 para um único telefone completo interno antes de provar commit.
- Retornar `CONCERNS` com razão/código `ambiguous_last4` quando houver colisão, sem misturar evidências.
- Correlacionar órfãos por telefone completo interno.
- Incluir `booking.rescheduled` em `OUTCOME_EVENTS`.
- Persistir metadata mínima e whitelisted em chamadas `agent_mutation`: `client_phone` normalizado e, opcionalmente, `kapso_conversation_id`.
- Preservar a superfície pública LGPD-safe e o caráter read-only do Nightwatch.
- Adicionar testes de unidade e regressão para todos os casos acima.

## OUT

- `tess.context_bytes`.
- Alterações de display em `getThread` ou `listStuckThreads`.
- Migration ou alteração de schema.
- Nova ferramenta MCP ou nova rota.
- POST/PATCH Trinks real ou qualquer nova operação mutável.
- Alteração de prompt.
- Alteração de allowlist/whitelist operacional de clientes.
- Deploy, Hostinger, `rsync` ou abertura customer-wide.
- Mudança do escopo global de `patrolLive`.

## Acceptance Criteria

1. **Timeout P0 separado:** dado ao menos um evento `tess.timeout` na janela de `patrolLive`, a saída contém `signals.p0_timeout` com a contagem correta e `next_action='activate-peer'`. Esse evento não incrementa `signals.p0_leaks`; a regra existente de `p0_leaks` não é ampliada para absorver timeout.
2. **Patrol global preservado:** `patrolLive` continua agregando eventos e mutações de todos os clientes na janela, sem exigir `clientPhone` e sem aplicar o filtro client-scoped de `verifyCommit`.
3. **Resolução segura de last4:** antes de consultar thread, eventos ou mutações como prova de `verifyCommit(last4)`, o Nightwatch resolve internamente os quatro dígitos para exatamente um `client_phone` normalizado. Com zero correspondências, não usa evidência global; com mais de um telefone completo distinto, retorna `verdict='CONCERNS'` e razão/código `ambiguous_last4`.
4. **Colisão não mistura evidência:** dados dois clientes com o mesmo last4, ainda que um possua `booking.created` ou mutação 2xx, `verifyCommit` não retorna PASS para o outro e não devolve nenhum telefone completo na resposta pública.
5. **Commit client-scoped:** para last4 com resolução única, eventos, último texto de assistant e mutações usados por `verifyCommit` pertencem ao mesmo telefone completo normalizado. Mutação 2xx ou falha de outro cliente na mesma janela não altera o verdict.
6. **Metadata mínima com whitelist:** chamadas cujo `origin` começa por `agent_mutation_` registram em `trinks_api_requests.metadata` somente `client_phone` normalizado e, quando disponível, `kapso_conversation_id`. Campos arbitrários, payload Trinks, nome, texto, telefone formatado e demais PII não são persistidos nesse metadata; chamadas não `agent_mutation` preservam o comportamento atual.
7. **Sem migration:** a implementação usa exclusivamente a coluna `trinks_api_requests.metadata JSONB` existente e não cria nem altera migration/schema.
8. **Órfão correlacionado por telefone completo:** `listOrphans` compara `tags.parsed` e `OUTCOME_EVENTS` pelo telefone completo normalizado interno. Um outcome de outro telefone com o mesmo last4 não suprime o órfão; a saída continua contendo somente last4 e campos redigidos já autorizados.
9. **Remarcação é outcome:** `booking.rescheduled` pertence a `OUTCOME_EVENTS`; um `tags.parsed` com `reschedules > 0` seguido de `booking.rescheduled` do mesmo telefone dentro da janela de ±2 minutos não é listado como órfão.
10. **LGPD na saída:** nenhuma resposta de `patrolLive`, `verifyCommit`, `listOrphans`, `getThread` ou `listStuckThreads` expõe telefone completo, `client_phone` de metadata ou conteúdo não redigido. Testes inspecionam o objeto serializado para provar a ausência.
11. **Read-only e escopo negativo:** a correção não adiciona rota/MCP, não executa POST/PATCH Trinks, não altera prompt, allowlist, deploy, `getThread` display ou `listStuckThreads` display. As operações Nightwatch permanecem consultas ao banco e classificação em memória.
12. **Regressão e gates:** testes cobrem timeout isolado, patrol global, resolução única, last4 ambíguo, mutação cross-client 2xx/erro, órfão cross-phone, `booking.rescheduled`, whitelist de metadata e redaction. Os testes focados, a suíte backend e os comandos `npm run lint`, `npm run typecheck` e `npm test` passam.

## Tasks / Subtasks

- [x] **A — Sinalizar timeout no patrol** (AC: 1, 2, 10)
  - [x] Incluir `tess.timeout` nos eventos observáveis sem agregá-lo a `p0_leaks`.
  - [x] Calcular `signals.p0_timeout` separadamente.
  - [x] Incluir `p0_timeout > 0` na decisão de `activate-peer`.
  - [x] Testar timeout isolado, coexistência com leaks e preservação do patrol global.

- [x] **C — Corrigir correlação de órfãos** (AC: 8, 9, 10)
  - [x] Adicionar `booking.rescheduled` a `OUTCOME_EVENTS`.
  - [x] Alterar a correlação SQL de `listOrphans` para telefone completo normalizado interno.
  - [x] Manter somente last4 e conteúdo redigido na projeção pública.
  - [x] Testar colisão cross-phone e remarcação válida na janela de ±2 minutos.

- [x] **B — Gravar metadata mínima e escopar verify** (AC: 3–7, 10, 11)
  - [x] Definir whitelist explícita de metadata para `agent_mutation_*`.
  - [x] Propagar `client_phone` normalizado e, se disponível, `kapso_conversation_id` pelas chamadas agent mutation.
  - [x] Garantir que reserve/finalize do ledger não persistam chaves fora da whitelist em agent mutation.
  - [x] Resolver last4 para telefone único; retornar `CONCERNS/ambiguous_last4` em colisão.
  - [x] Filtrar thread, eventos e mutações de `verifyCommit` pelo mesmo telefone completo interno.
  - [x] Garantir que telefone completo/metadata não atravessem a resposta pública.
  - [x] Testar evidência 2xx e falha de outro cliente na mesma janela.

- [x] **Testes e quality gates** (AC: 10–12)
  - [x] Ampliar os testes unitários do Nightwatch e do wrapper/ledger Trinks.
  - [x] Executar testes focados de Nightwatch e Trinks API.
  - [x] Executar a suíte backend.
  - [x] Executar `npm run lint` e `npm run typecheck`.
  - [x] Executar `npm test` (suíte raiz).
  - [x] Executar CodeRabbit pre-commit; 0 findings.
  - [x] Confirmar por diff que não há migration, prompt, rota/MCP, whitelist operacional ou deploy.

## Dev Notes

- A separação é intencional: `patrolLive` responde “o sistema teve falhas na janela?” globalmente; `verifyCommit` responde “há prova para este cliente?” com escopo estrito.
- Stack já existente: Node.js/CommonJS, PostgreSQL/JSONB e SQL parametrizado; não introduzir biblioteca ou tecnologia nova.
- Normalização de telefone segue o padrão brownfield de remoção de caracteres não numéricos. O telefone completo pode existir apenas no processamento/SQL interno.
- `trinks_api_requests.metadata` já existe e tem default `{}`; não há necessidade de migration.
- Variáveis de ambiente novas: nenhuma.
- A whitelist desta story é de **campos de metadata do ledger**, não de clientes autorizados. Não alterar allowlist operacional.
- Em colisão de last4, fail-closed: `CONCERNS/ambiguous_last4`. Não escolher `list[0]`, não combinar threads e não combinar eventos/mutações.
- `tess.context_bytes` e mudanças de display de `getThread`/`listStuckThreads` são follow-ups explícitos e não devem entrar nesta implementação.
- `[AUTO-DECISION] ClickUp não foi usado → a solicitação exige somente a story local e fornece caminho/status/escopo completos.`
- `[AUTO-DECISION] Code intelligence e accumulated-context.md ausentes → duplicate scan manual pelo path; coerência baseada no epic e na Story 12.`

## Testing

- Framework: `node:test` e `node:assert/strict`, seguindo `backend/test/nightwatch-ops.test.js` e `backend/test/trinks-api.test.js`.
- Testes focados esperados: `node --test backend/test/nightwatch-ops.test.js backend/test/trinks-api.test.js`.
- Suíte backend: executar o comando adotado pelo repositório para `backend/test/*.test.js`.
- Gates de raiz: `npm run lint`, `npm run typecheck`, `npm test`.
- Não usar live mutation como evidência desta story.

## Expected File List

> Planejamento somente. Esta lista não declara arquivos já alterados e deve ser ajustada pelo @dev ao diff real.

- `backend/lib/nightwatch-ops.js`
- `backend/lib/trinks-api.js`
- `backend/server.js`
- `backend/test/nightwatch-ops.test.js`
- `backend/test/trinks-api.test.js`
- `docs/stories/salon-whatsapp-nightwatch-monitoring-scope.md`

## 🤖 CodeRabbit Integration

**Story Type Analysis:** API/observabilidade brownfield, com integração de ledger; complexidade alta por correlação, LGPD e risco de falso PASS.

**Primary Agents:** @dev  
**Quality Gate:** @qa

**Quality Gate Tasks:**

- [ ] Pre-Commit (@dev): revisar diff não commitado.
- [ ] Pre-PR (@devops): revisar integração e backward compatibility, se houver PR.
- [ ] Pre-Deployment: N/A — deploy está fora desta story.

**Focus Areas:**

- Isolamento de evidência por cliente e comportamento fail-closed.
- Redação/LGPD e whitelist mínima de metadata.
- SQL de correlação de órfãos e regressão de patrol global.
- Ausência de mutações Trinks e de ampliação de escopo.

**Self-Healing:** @dev light mode; máximo 2 iterações/15 minutos; CRITICAL auto-fix, HIGH document-only.

## Change Log

- 2026-09-03 — @sm/River: story brownfield criada a partir do diagnóstico Aria e dos findings CodeRabbit M2/M3; status Ready for Dev; sem implementação.
- 2026-09-03 — @dev/Dex: implementação AC1–AC12 (timeout P0, verify client-scoped, órfãos por telefone completo, metadata whitelist, testes); Quality Gate @qa pending.
- 2026-09-03 — @dev/Dex: correções pós-reprovação @qa — janela temporal em `resolveLast4ToPhone`/`getThread`; `verifyCommit` ignora `assistantText` externo; metadata de erro sem PII em `agent_mutation_*`; testes SQL-aware reforçados.
- 2026-09-03 — @qa/Quinn: gate final PASS — 39/39 focados, 531/531 backend, 79/79 raiz, lint/typecheck PASS, CodeRabbit 0 findings; AC1–AC12 aprovados.
- 2026-09-03 — @devops/Gage: publicação `07f59cb` no worktree VPS; health HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589; allowlist `0007`-only preservada; sem smoke WhatsApp nesta execução.

## Dev Agent Record

**Agent Model Used:** claude-sonnet-4-6 (Composer subagent aiox-dev)

**Debug Log References:** `node --test backend/test/nightwatch-ops.test.js backend/test/trinks-api.test.js` — 39/39 pass; `npm test --prefix backend` — 531/531 pass; `npm test` — 79/79 pass; `npm run lint`, `npm run typecheck`, `node --check` e CodeRabbit CLI 0 findings.

**Completion Notes:** Correções QA: (1) `resolveLast4ToPhone(db, last4, { minutes })` filtra `conversation_history.created_at`, `bot_operational_events.received_at` e `trinks_api_requests.requested_at` pela janela de `verifyCommit`; `getThread` com `minutes` limita assistant ao mesmo lookback. (2) `verifyCommit` classifica só texto do último assistant da thread escopada — parâmetro `assistantText` mantido por compatibilidade, mas não gera PASS/FAIL cruzado. (3) Erro de transporte em `agent_mutation_*` persiste metadata whitelisted sem campo `error`/PII; non-agent mantém `{ page, error }`. Testes reforçados: cross-client 2xx/fail, resolução temporal, órfãos por telefone completo, timeout isolado, redaction em `getThread`/`listStuckThreads`, metadata de erro. Patrol global, read-only e LGPD preservados.

**Actual File List:**
- `backend/lib/nightwatch-ops.js` (modified)
- `backend/server.js` (modified)
- `backend/lib/trinks-api.js` (modified)
- `backend/test/nightwatch-ops.test.js` (modified)
- `backend/test/trinks-api.test.js` (modified)
- `docs/stories/salon-whatsapp-nightwatch-monitoring-scope.md` (modified)
- `docs/qa/gates/tess-commit.13-nightwatch-monitoring-scope.yml` (added)
- `docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md` (modified)
- `docs/ops/nightwatch-log.md` (modified)
- `docs/stories/epics/EPIC-tess-commit-honesty.md` (modified)

## Quality Gate

- [x] Review @qa — PASS
- [x] Testes focados
- [x] Suíte backend
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] CodeRabbit sem findings
- [x] Confirmação de escopo negativo/read-only

**Resultado:** **PASS** — AC1–AC12 atendidos; 39/39 focados, 531/531 backend, 79/79 raiz, lint/typecheck PASS e CodeRabbit 0 findings. Publicado em `07f59cb` (2026-09-03 ~19:04 UTC); abertura customer-wide permanece fora desta story.
