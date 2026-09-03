# Story: CANCEL não pode carregar FULL nem deixar o cliente em silêncio após timeout

**Epic:** [EPIC-tess-commit-honesty](epics/EPIC-tess-commit-honesty.md)  
**Tipo:** Brownfield  
**Status:** **Deployed (unit PASS) · smoke live pending**  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Prioridade:** P0  
**Branch:** `feature/tess-commit-honesty`

## Handoff SOT

[2026-09-03-orion-smoke-0007-bugs](../handoffs/2026-09-03-orion-smoke-0007-bugs.md) · smoke restrito `0007`, 16:09 UTC.

## Story

**As a** cliente que pede para cancelar um agendamento,  
**I want** o backend usar contexto enxuto e responder honestamente quando a TESS expirar,  
**so that** um cancelamento não vire silêncio aparente nem deixe a agenda sem uma resposta clara.

## Contexto e causa

No smoke `0007`, “Pode cancelar esse também” foi classificado corretamente como `CANCEL`, mas `TESS_CONTEXT_MODE=full` fez o assembler carregar a grade completa, catálogo e profissionais. O payload chegou a aproximadamente 91 mil caracteres / 22 mil tokens. `callTESS` abortou em 25 segundos antes de devolver tags. Como o webhook já havia respondido ACK e o `catch` externo apenas registrava a exceção, o cliente não recebeu mensagem, não houve `tags.parsed` e nenhum PATCH Trinks foi executado.

O silêncio não foi `silenced_until` nem bloqueio da allowlist. Foi uma falha de resposta após timeout da TESS.

## IN

- `CANCEL` de alta confiança deve usar o perfil CANCEL mesmo quando o modo efetivo é `full`.
- CANCEL deve buscar reservas futuras do cliente, sem carregar slots, catálogo, profissionais ou habilitação.
- Timeout/abort da chamada TESS deve gerar evento operacional `tess.timeout` e resposta honesta ao cliente.
- Timeout não pode afirmar cancelamento, executar POST/PATCH Trinks ou marcar a thread como `human-handled`.
- Preservar `FULL` para `SCHEDULING`/`UNCERTAIN` e preservar B1–B4.
- Cobrir o comportamento com testes unitários/regressão e registrar os gates.

## OUT

- Não alterar o prompt da TESS 46589.
- Não aumentar timeout de nginx/Kapso como solução.
- Não desligar globalmente o contexto FULL para agendamentos incertos.
- Não executar POST/PATCH Trinks real, replay `0101`, Hostinger ou `rsync`.
- Não abrir `BOT_ACCEPT_ALL=true`; smoke continua exclusivo no allowlist `0007`.

## Acceptance Criteria

- [x] **AC1:** `buildContextProfile({ intent: CANCEL, confidence: high }, { effectiveMode: full })` retorna `PROFILES.CANCEL`, com `fetchSlots=false`, `fetchCatalog=false`, `fetchProfessionals=false` e `fetchFutureBookings=true`.
- [x] **AC2:** `assembleTessContext` para CANCEL em modo FULL não chama `getSlots`, `getSlotsGrouped`, `getServicesText` ou `getProfessionals`; carrega apenas `loadClientFutureBookings` quando houver telefone e produz contexto sem grade.
- [x] **AC3:** `SCHEDULING`/`UNCERTAIN` em modo FULL mantém o comportamento FULL existente, incluindo grade quando aplicável.
- [x] **AC4:** Abort/timeout da chamada TESS produz fallback não vazio e evento `tess.timeout`; o fallback informa que a operação não foi concluída e não afirma cancelamento.
- [x] **AC5:** No caminho de timeout não há `tags.parsed` de sucesso, `booking.cancelled` de sucesso, POST/PATCH Trinks ou `markHumanHandled` automático.
- [x] **AC6:** O timeout não deixa a exceção escapar para o handler do webhook como silêncio; o handler consegue enviar o fallback pela Kapso.
- [x] **AC7:** B1, B2, B3 e B4, `tess.empty` com créditos zero, C1/C2/C3 e os gates existentes continuam passando.
- [x] **AC8:** Testes, lint, typecheck e CodeRabbit passam sem finding crítico. Sem live mutation, `0101`, 03/09 10:30 André, Hostinger ou `rsync`.

## Tasks / Subtasks

- [x] **T1:** Priorizar o perfil CANCEL de alta confiança antes do fallback FULL.
- [x] **T2:** Adicionar tratamento explícito de timeout/abort com evento e fallback honesto, sem mutação ou silêncio automático.
- [x] **T3:** Adicionar testes de perfil, assembler e timeout; manter regressões B1–B4.
- [x] **T4:** Executar gates automatizados e atualizar este registro, o epic e o handoff.
- [ ] **T5:** Repetir smoke restrito no `0007` em outro slot e completar B3 escolhendo um horário oferecido; cliente-wide permanece bloqueado até o veredito.

## File List

- `backend/lib/tess-context-profiles.js`
- `backend/server.js`
- `backend/supervisor.js`
- `backend/lib/tess-timeout.js`
- `backend/test/tess-context-profiles.test.js`
- `backend/test/tess-context-cancel-full.test.js`
- `backend/test/tess-timeout.test.js`
- `backend/test/server-tess-timeout.test.js`
- `docs/stories/epics/EPIC-tess-commit-honesty.md`
- `docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md`
- `docs/ops/nightwatch-log.md`
- `docs/qa/gates/tess-commit.12-cancel-timeout-fallback.yml`
- `docs/qa/coderabbit-reports/epic-tess-commit-honesty-timeout-2026-09-03.jsonl`

## Dev Agent Record

**Agent Model Used:** Composer 2.5 Fast (@dev)

**Completion Notes:**

- `CANCEL` high agora usa perfil enxuto mesmo com `TESS_CONTEXT_MODE=full`; o fixture de `processMessage` mediu aproximadamente 496 tokens.
- Timeout/abort TESS retorna copy honesta, persiste user+assistant, atualiza a sessão, emite `tess.timeout` e não chama Trinks nem `markHumanHandled`.
- Quinn: gate unitário **PASS**; 103/103 focados, 512/512 backend, 79/79 prompts; lint/typecheck/sintaxe/whitespace PASS.
- CodeRabbit CLI 0.7.5: doctor 9/9 e review final 0 findings; relatório versionado no repositório.
- Revisão `0b39035` publicada no VPS pelo @devops; health interno/público HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589 e allowlist exclusivo `0007` confirmados. Smoke live ainda pendente.

## Quality Gate

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 79/79 prompts
- [x] backend tests — 512/512
- [x] CodeRabbit sem critical — 0 findings
- [ ] smoke restrito `0007`

