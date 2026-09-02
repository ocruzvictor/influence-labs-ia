# Story: WhatsApp — ping de handoff + parser estreito no thread do dono

**Epic:** [EPIC-resume-ia-pos-handoff](epics/EPIC-resume-ia-pos-handoff.md)  
**Tipo:** Brownfield  
**Status:** Done  
**Agente executor:** @dev (Composer 2.5 Fast) · copy @ux-design-expert (já GO Uma) · gate @qa  
**Story Points:** 5  
**Pode executar agora:** ✅ SIM — desbloqueada: [resume-ia-2](salon-whatsapp-resume-ia-2-comando-api.md) Done (QA CONCERNS aceite). Paralelo com [resume-ia-4](salon-whatsapp-resume-ia-4-admin-dialog.md).  
**Branch sugerida:** `feature/resume-ia-pos-handoff`  
**Pedido / GO:** Victor / @aios-master 2026-09-01  
**Handoff:** [docs/handoffs/2026-09-01-plano-resume-ia-pos-handoff.md](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md) (rev. 3, GO)

## Contexto

`notifyTiagoHandoff` em `backend/server.js` (~L1946–1967) manda: *“Abre o WhatsApp do salao pra continuar com o cliente.”* Isso ensina o caminho errado: responder na thread da cliente pelo Business App → takeover (`origin !== cloud_api`) → silêncio de novo.

Story `salon-whatsapp-tiago-owner-access.md`: inbound do dono **não** entra em `human_handled` e **não** recebe slash-commands admin. Esta story é **exceção deliberada e mínima**: parser **estreito** só no PIN `isOwnerPhone`, **antes** de `processMessage` do dono.

GO #1 e #4: comando **só** no ping (thread do dono com o número do salão). **Nunca** parsear a thread da cliente. Recepção **não** comanda por WhatsApp.

Fonte da verdade: `resumeConversation(..., actor: 'whatsapp')` da story 2. WhatsApp só chama.

## IN / OUT

**IN**

- Copy nova do ping (Uma): telefone copiável, motivo, última msg, **como responder NESTE chat**, **não** “abre o WhatsApp do salão”.
- Parser: âncora `retomar|retoma|volta a ia|pode voltar` + nota (20–500 após a âncora / nome).
- Desambiguação 0 / 1 / N handoffs pendentes (`silenced_until > NOW()` e `silence_reason = 'handoff'`).
- Acks ao Tiago: enviado / window_closed / falta nota / ambíguo.
- Exemplo: `retomar Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.`

**OUT**

- Slash genérico (preço, KB, prompt).
- Parser na thread da cliente.
- Lista extra de operadores WhatsApp.
- Botões interativos no ping (V2).
- UI admin (story 4).
- Mutar `bot_whitelist`.

## Acceptance Criteria

- [x] **AC1:** Texto de `notifyTiagoHandoff` **não** contém instrução para abrir o WhatsApp do salão / chat da cliente. Inclui telefone da cliente (copiável), motivo, recorte da última msg, e instrução para retomar **neste** chat com nota (ex. `retomar <nome ou telefone>. <orientação 20–500>`).
- [x] **AC2:** No webhook inbound, se `isOwnerPhone(sessionPhone)`, o parser de resume roda **antes** de `processMessage`. Se **não** casar âncora, fluxo owner-access atual (TESS com `INTERLOCUTOR: TIAGO`) permanece.
- [x] **AC3:** Âncora case-insensitive: `retomar`, `retoma`, `volta a ia`, `pode voltar`. Sem `/resume` genérico nem outros slashes.
- [x] **AC4:** 0 handoffs pendentes → recusa em ack ao Tiago; **não** chama TESS resume. 1 pendente → phone implícito (mesmo se a msg citar nome). N pendentes → ack pede telefone/nome, **lista** pendentes, **não** chama TESS.
- [x] **AC5:** Comando na **thread da cliente** (sessionPhone ≠ owner) **não** é parseado como resume, mesmo que o texto seja `retomar …`.
- [x] **AC6:** Chamada ao **mesmo** `resumeConversation` com `actor: 'whatsapp'`. Nota extraída 20–500; se âncora sem nota suficiente → ack “falta nota”, **não** limpa silêncio.
- [x] **AC7:** Ack Kapso ao **Tiago** (não à cliente): mapeia `sent` / `window_closed` / erros 409/422/503 em texto curto. Ambíguo (N) e 0 pendentes cobertos em AC4.
- [x] **AC8:** Testes unitários do parser (âncoras, 0/1/N, thread cliente ignorada, nota curta). `npm test` da fatia passa.

## Tasks / Subtasks

- [x] **T1 (AC1):** Reescrever template `notifyTiagoHandoff`. Copy Uma: [handoff §WhatsApp](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md). `[AUTO-DECISION]` não inventar botões; texto puro Kapso como hoje.
- [x] **T2 (AC2–AC6):** `backend/lib/owner-resume-parser.js` (ou similar). Hook no handler Kapso **antes** de `processMessage` quando `isOwnerPhone`. Query pendentes via `bot_thread_state`.
- [x] **T3 (AC7):** Acks via `sendKapsoMessage(TIAGO_NOTIFICATION_PHONE, …)` — mesmo `phoneNumberId` do ping.
- [x] **T4 (AC8):** `backend/test/owner-resume-parser.test.js`.
- [x] **T5:** CodeRabbit. Confirmar: `processMessage` da **cliente** intocado pelo parser.

## Dev Notes

**Exceção à owner-access:** a story do dono proíbe admin-via-WhatsApp. Resume é o **único** comando permitido, âncora fechada, PIN only.

**Pendentes:** rows com `silence_reason = 'handoff'` e `silenced_until > NOW()`. Takeover `business_app` **não** entra na lista implícita (operador retomaria via admin/CLI se quiser — GO: comando WhatsApp é pós-ping de handoff).

**Match N:** se a msg contém um phone de 10–15 dígitos que está na lista, pode desambiguar. Se contém nome que casa `clients.name` de um único pendente, ok. Senão pede clarificação. `[AUTO-DECISION]` matching de nome: case-insensitive contains; 0 ou >1 hits → ambíguo.

**Touch points**

- `backend/server.js` — `notifyTiagoHandoff`; inbound Kapso ~L2248–2300 (`isHumanHandled` / `processMessage`); `isOwnerPhone`.
- `backend/lib/owner-access.js` — PIN.
- `backend/lib/resume-conversation.js` (story 2) — **não** duplicar lógica HTTP.

**Fonte:** GO #1, #4; handoff §Superfícies WhatsApp; epic IN parser.

## File List (previsto)

| A/M | Path |
|-----|------|
| A | `backend/lib/owner-resume-parser.js` |
| A | `backend/test/owner-resume-parser.test.js` |
| M | `backend/server.js` (`notifyTiagoHandoff` + hook inbound dono) |
| M | `docs/stories/salon-whatsapp-resume-ia-3-whatsapp-parser.md` |

## Testing

- Unit parser + desambiguação.
- Não exige smoke com Tiago real nesta story (story 5).
- Negativo obrigatório: texto `retomar …` no sessionPhone da cliente → `processMessage` normal, zero `resumeConversation`.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Integration
- Secondary: Security (comando só no PIN)
- Complexity: Medium

**Specialized Agent Assignment**

- Primary: @dev
- Supporting: @ux-design-expert (copy), @qa

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops): `coderabbit --prompt-only --base main`

**CodeRabbit Focus Areas**

- Primary: parser só `isOwnerPhone`; thread cliente ignorada; sem slash genérico.
- Secondary: ack nunca para o número da cliente; chama o mesmo módulo resume.

**Predict files:** `backend/lib/owner-resume-parser.js`, `backend/test/owner-resume-parser.test.js`, `backend/server.js`.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## Dev Agent Record

- **Status:** InReview
- **Start:** 2026-09-01
- **End:** 2026-09-01
- **Agent Model Used:** Composer 2.5 Fast
- **Completion Notes:**
  - `[AUTO-DECISION]` matching nome: case-insensitive contains; 0 ou >1 hits → ambíguo (story Dev Notes).
  - `[AUTO-DECISION]` strip prefixo `Nome.` / `telefone.` antes de validar nota 20–500.
  - CodeRabbit CLI não disponível no ambiente — review manual; grep confirma parser só via `shouldAttemptOwnerResume(isOwnerPhone)`.
- **File List:**
  - A `backend/lib/owner-resume-parser.js`
  - A `backend/test/owner-resume-parser.test.js`
  - M `backend/server.js` (`notifyTiagoHandoff` + hook inbound dono)
  - M `docs/stories/salon-whatsapp-resume-ia-3-whatsapp-parser.md`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-01 | 0.1.0 | Created. Ping Uma + parser PIN-only. Sem UI admin. | @sm |
| 2026-09-01 | 0.1.1 | Validated GO (8/10) — Status: Draft → Ready | @po |
| 2026-09-01 | 0.2.0 | Development complete — Status: Ready → InReview | @dev |
| 2026-09-02 | 0.3.0 | QA gate PASS — Status: InReview → Done | Quinn (@qa) |
| 2026-09-02 | 0.3.1 | close-story bookkeeping — epic index; Status Done intacto (QA PASS) `[closure-key: resume-ia.3:digest:working-tree:parser@a9864037,test@94423f68,server@1ec6066f,story@69b49061,HEAD:468391d7]` | @po |

## QA Results

### Review Date: 2026-09-02

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:parser@a9864037,test@94423f68,server@1ec6066f,story@69b49061,HEAD:468391d7

### Code Quality Assessment

Parser estreito bem isolado (`owner-resume-parser.js`) e hook inbound correto: `shouldAttemptOwnerResume(isOwnerPhone(sessionPhone), messageText)` **antes** de `processMessage`, com `return` no ramo dono. `notifyTiagoHandoff` pede resposta **neste chat** (`retomar <nome>. <orientação>`), telefone em dígitos, motivo e recorte da última msg — sem “abre o WhatsApp do salão”. `resumeConversation(..., actor: 'whatsapp')` é o SOT; acks vão para `TIAGO_NOTIFICATION_PHONE`. Fatia `node --test backend/test/owner-resume-parser.test.js`: 12/12 pass.

### Refactoring Performed

Nenhum. `[AUTO-DECISION]` pedido explícito: NÃO implemente.

### Compliance Check

- Coding Standards: ✓
- Project Structure: ✓ módulo em `backend/lib/` + testes em `backend/test/`
- Testing Strategy: ✓ unitário da fatia (AC8); smoke Tiago real fica na story 5
- All ACs Met: ✓ AC1–AC8

### Improvements Checklist

- [x] Verificação AC1 copy ping (código, não só story)
- [x] Verificação parser só PIN + thread cliente
- [x] Testes da fatia 12/12
- [ ] (opcional, story futura) teste handle N + ack 422/503
- [ ] (opcional) matching de nome por token se colidir Ana/Diana

### Security Review

Comando só no PIN. Thread da cliente com texto `retomar …` não entra no parser (`shouldAttemptOwnerResume(false)`). Ack nunca usa o `sessionPhone` da cliente.

### Performance Considerations

Query de pendentes só no ramo âncora+owner. Sem issue.

### Files Modified During Review

- `docs/qa/gates/resume-ia.3-whatsapp-parser.yml` (novo)
- `docs/stories/salon-whatsapp-resume-ia-3-whatsapp-parser.md` (QA Results + Status/Change Log)

### Gate Status

Gate: PASS → docs/qa/gates/resume-ia.3-whatsapp-parser.yml

### Lifecycle Transition

PASS: InReview → Done

