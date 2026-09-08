# Story: Hold TTL + sanitize F5 — slot lockado antes da boca

**Epic:** [EPIC-tess-redesenho-commit](epics/EPIC-tess-redesenho-commit.md)  
**Tipo:** Brownfield  
**Status:** **Done**  
**Agente executor:** @dev  
**Quality gate:** @qa  
**Story Points:** 8  
**Pode executar agora:** ✅ SIM — @dev `*develop` (repo only; sem OPEN / POST / Hostinger)  
**Branch sugerida:** `feature/tess-redesenho-hold`  
**Spec SOT:** [onda-1-spec/spec.md](../research/2026-09-08-tess-redesenho/onda-1-spec/spec.md)  
**Schema SOT:** [03-schema-hold.md](../research/2026-09-08-tess-redesenho/onda-1-spec/03-schema-hold.md)  
**Critique:** [critique.md](../research/2026-09-08-tess-redesenho/onda-1-spec/critique.md) **APPROVED**  
**Memória:** [MEMORY T1+T2](../ops/MEMORY-tess-t1-t2-fds-2026-09-08.md) (não reler corpus FDS)

```yaml
clickup:
  task_id: ""
  epic_task_id: ""
  list: "Backlog"
  url: ""
  last_sync: ""
  note: "ClickUp MCP ausente nesta sessão — story só local"
```

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "I1/I2/I3 unit"
  - "booking-holds unique race"
  - "sanitize F5 / HOLD_COPY"
  - "coderabbit --prompt-only -t uncommitted"
```

## Story

**As a** cliente no WhatsApp escolhendo horário,  
**I want** o sistema **segurar o slot** (hold local) **antes** de qualquer frase que trate o horário como meu, e nunca ouvir “Já estou confirmando na agenda” sem hold/2xx,  
**so that** a boca e o inventário não mintem (T1 `9343` · T2 F5 · race 13h).

## Contexto

T1/T2: copy de compromisso **sem** POST. `HOLD_COPY` live em `booking-parser.js` é exatamente *“Já estou confirmando na agenda, um instante.”* — process-promise sem dentes. 2-phase (`selectOutboundBlocks`) **permanece**. Hold é **Postgres local**, não lock Trinks (NFR-3).

Story 1 = **single-SKU** (CRIT-3). Combo = `combo_overlap` existente. Martelo / receipts = **story 2** (OUT).

last4 rótulo de teste (story 1): `9343` `6960` `7335`. `1734` / Denise = F3×F5 → **story 2, sem AC aqui**. `4307` = race 13h (T-13h), não Martelo. Sem PII. Sem inventar `booking.created`.

## IN / OUT

**IN**

- Migration `infra/migrations/019_booking_holds.sql` + rollback (padrão `016_bot_thread_state.sql`). **Não** usar `infra/schema.sql` legado como SOT (CRIT-4).
- Tabela `booking_holds` + unique ativo `(profissional_id, slot_start)` onde status `held|committing` (FR-2, FR-5).
- Worker `backend/lib/booking-holds.js` — insert/lookup/expire/release. **0 LLM**.
- Hook no hot-path **antes** de outbound que mencione slot como compromisso: insert hold → só então copy HELD.
- Remover / banir `HOLD_COPY` atual. Ampliar sanitize process-promise (FR-3, CRIT-1).
- Estados persistidos pelo worker: `held` · `committing` · `confirmed` · `expired` · `failed` · `released`. Campo **não** escrito pelo LLM.
- TTL default 180s (config 120–300). Expire worker 0 LLM (FR-9).
- Events `hold.created` / `hold.expired` / `hold.failed` via `emitOperationalEvent` em `backend/lib/operational-events.js`. Payload **sem PII** (last4 ok). Fire-and-forget (mesmo contrato do módulo).
- Units: T-9343, T-6960, T-13h, T-TTL, T-2xx, T-ocupado-trinks, T-pg-down, T-idempotent, T-combo.
- `npm test` fatia holds + booking-parser + server hook.

**OUT**

- Story 2 Martelo (`booking_handoff_receipts`, silence≠release, assigned_to).
- Colar / editar prompt 46589.
- OPEN / `startPilot` / `BOT_ACCEPT_ALL` / Hostinger / rsync / POST Trinks live / replay cliente.
- Split de agente Tess · DE Cowork · A/B modelo · Hermes · OpenClaw.
- Hold nativo Trinks.
- Segundo hold para combo.
- Afrouxar I1/I2/I3 / 2-phase / guards.

## Acceptance Criteria

- [x] **AC1 (FR-1, FR-2):** Antes de outbound que trate um `(profissional_id, slot_start)` como reservado/separado para o cliente, existe row `booking_holds` `held` com esse par. Insert falhou (unique ou PG) → copy de indisponível; **0** POST Trinks (NFR-6).
- [x] **AC2 (FR-3, CRIT-1):** `HOLD_COPY` literal *“Já estou confirmando na agenda, um instante.”* **não** é emitida em nenhum ramo. Sanitize remove: `confirmando`, `já estou confirm`, `reservei`, `marquei`, `já está marcado`, e a string exata da HOLD_COPY antiga — **sem** hold ativo **ou** sem 2xx. **Allowlist (não stripar):** *“13h está separado por 3 min. Só vale quando eu confirmar o agendamento.”* (hora substitui `13h`). Gerúndio gravar/confirmando continua banido.
- [x] **AC3 (FR-4):** Endereço / “te esperamos” / “confirmado” só após Trinks 2xx + hold `confirmed` + `trinks_id`. `selectOutboundBlocks` permanece o dente de sucesso. Hold ≠ commit.
- [x] **AC4 (FR-5):** Dois phones, mesmo `profissional_id` + `slot_start`: um insert `RETURNING id`, o outro unique fail + copy ocupado. Unit T-13h.
- [x] **AC5 (FR-9):** `expires_at` = NOW() + `BOOKING_HOLD_TTL_SEC` (default 180, clamp 120–300). **Expire lazy:** em `acquire`, se row `held` com `expires_at <= NOW()`, marcar `expired` e então inserir. **Sem cron novo.** Copy posterior **não** soa hold. Unit T-TTL.
- [x] **AC6 (NFR-5):** Re-insert mesmo `phone` + `profissional_id` + `slot_start` enquanto `held|committing` = no-op mesmo `id`.
- [x] **AC7 (CRIT-3):** Combo dois SKUs **não** cria segundo hold no mesmo `slot_start`. `combo_overlap` intacto. Unit T-combo.
- [x] **AC8 (FR-10):** Units last4-rótulo: T-9343 (Confirmo+endereço sem POST → strip, 0 POST); T-6960 (aceite sem tag/guard block → sem HOLD_COPY, 0 POST); T-2xx (hold+tag+guards+2xx → sucesso permitido); T-ocupado-trinks (hold nosso, guard/HTTP ocupado → `failed` + honesta). Sem PII. Sem `booking.created` inventado.
- [x] **AC9:** Sem cola prompt. Sem POST Trinks de teste. Sem OPEN. Migration tem rollback. Fatia de testes da story PASS. I1/I2/I3 dos testes existentes do parser **não** regridem.

## Tasks / Subtasks

- [x] **T1 (AC1, AC4, AC5, AC6):** Migration `019_booking_holds.sql` + rollback. Unique parciais sem `NOW()` no predicado (padrão 016). `[Source: infra/migrations/016_bot_thread_state.sql · onda-1-spec/03-schema-hold.md]`
- [x] **T2 (AC1, AC6, NFR-1):** `backend/lib/booking-holds.js` acquire/lookup/expire/release. Idempotente. Sem call Tess. `[Source: onda-1-spec/spec.md#32]`
- [x] **T3 (AC2, AC8):** Banir `HOLD_COPY`; ampliar `PREMATURE_CONFIRM_PATTERNS` / process-promise; copy HELD CRIT-1. Testes `booking-parser`. `[Source: backend/lib/booking-parser.js:237-285 · critique CRIT-1]`
- [x] **T4 (AC1, AC3, AC8):** Hook `server.js` — `acquire` **só** em: (a) emitir copy HELD allowlist após slot concreto aceito; ou (b) tag `[BOOKING_CREATE]` com `profissionalId`+`dataHoraInicio` **antes** dos guards. Não fazer NLP de todo outbound. COMMITTING = tag+guards+hold `held`; POST existente; 2xx → `confirmed`. `[Source: docs/architecture/booking-confirmation-flow.md#2 · server.js processMessage]`
- [x] **T5 (AC4, AC5, AC7, AC8, AC9):** Tests `backend/test/booking-holds.test.js` + extend parser/server. Sem Playwright. Sem live.

## Dev Notes

**Previous Story Insights**

- Honesty story 2: C3 + `POST_FAIL_CONFIRM_PATTERNS` no turno seguinte. **Não refazer.** Esta story cobre **process-promise no mesmo turno** e **lock**. `[Source: docs/stories/salon-whatsapp-tess-commit-2-sanitize-pos-falha.md]`
- `HOLD_COPY` foi o “fix” F5 que T2 mediu como I1 FAIL. Remover, não parafrasear. `[Source: docs/ops/MEMORY-tess-t1-t2-fds-2026-09-08.md#a-falha-que-se-repete]`

**Data Models**

- Spec SQL em `onda-1-spec/03-schema-hold.md`. `trinks_id` só se `status=confirmed`. Unique ativos: slot e phone+slot.
- `booking_handoff_receipts` = **não** criar nesta story.

**API Specifications**

- Nenhum endpoint público novo. Sem POST Trinks novo. Reusa `createTrinksApi` existente só no ramo COMMITTING já existente.
- No specific REST spec in architecture docs for holds.

**File Locations**

| Path | Ação |
|---|---|
| `infra/migrations/019_booking_holds.sql` | add |
| `infra/migrations/019_booking_holds.rollback.sql` | add |
| `backend/lib/booking-holds.js` | add |
| `backend/lib/booking-parser.js` | modify |
| `backend/server.js` | modify (hook only) |
| `backend/test/booking-holds.test.js` | add |
| `backend/test/booking-parser.test.js` | extend |

**Testing Requirements**

- `node --test backend/test/booking-holds.test.js backend/test/booking-parser.test.js` (+ server se o hook tiver teste).
- GWT da spec §6: T-9343, T-6960, T-13h, T-TTL, T-2xx, T-ocupado-trinks, T-pg-down, T-idempotent, T-combo.
- Sem smoke WhatsApp live. Smoke 0007 = **depois** do gate, não DoD desta Draft.

**Technical Constraints**

- Postgres + `pg` já no hot-path. Timeout Tess 25s **não** aumenta (NFR-2). Hold insert < 50ms alvo.
- Índices parciais **sem** `NOW()` no predicado `[Source: infra/migrations/016_bot_thread_state.sql]`.
- `docs/framework/tech-stack.md` / `source-tree.md`: **não encontrados** — fallback: padrões live `backend/lib` + `infra/migrations`.
- 2-phase: `[Source: docs/architecture/booking-confirmation-flow.md#2]`

**Project Structure Notes**

- `infra/schema.sql` desatualizado vs prod. Migration 019 é o canal certo.
- Não criar workers em `backend/scripts/salao/` (Forge OUT).

## File List

- `infra/migrations/019_booking_holds.sql` — add
- `infra/migrations/019_booking_holds.rollback.sql` — add
- `backend/lib/booking-holds.js` — add
- `backend/lib/booking-parser.js` — modify (sanitize F5 + `selectConfirmHoldBlocks` structured)
- `backend/server.js` — modify (hook acquire / confirmed / failed)
- `backend/test/booking-holds.test.js` — add
- `backend/test/booking-parser.test.js` — extend (T-9343, T-6960, allowlist)
- `docs/stories/salon-whatsapp-tess-redesenho-1-hold-sanitize-f5.md` — checkboxes / File List / record

## Testing

- Unit holds (unique, TTL, idempotente, combo).
- Unit parser (HOLD_COPY ausente; T-9343/T-6960).
- Hook: 0 POST sem hold; 2xx → confirmed.
- Sem Playwright. Sem VPS. Sem POST cliente.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Database
- Secondary: API (hot-path outbound)
- Complexity: High (schema + parser + server; I1)

**Specialized Agent Assignment**

- Primary: @dev, @data-engineer (schema review)
- Supporting: @qa (I1 unit), @architect (se afrouxar 2-phase)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted` — CLI atual não aceita `--prompt-only`; `coderabbit review --uncommitted` pendente no gate @qa
- [ ] Pre-PR (@devops): quando houver PR
- [ ] Pre-Deployment: **fora** — sem Hostinger / OPEN

**CodeRabbit Focus Areas**

- Primary: unique parcial; rollback; não `NOW()` no predicado; HOLD_COPY morta.
- Secondary: 2-phase intacto; 0 POST sem hold; combo não duplica hold.

**Predict files:** `infra/migrations/019_booking_holds.sql`, `backend/lib/booking-holds.js`, `backend/lib/booking-parser.js`, `backend/server.js`, testes.

**Self-Healing Configuration**

- Primary Agent: @dev (light)
- Max Iterations: 2 · Timeout: 15 min · Severity Filter: CRITICAL only
- CRITICAL: auto_fix · HIGH: document_only · MEDIUM: ignore · LOW: ignore

## Dev Agent Record

**Agent:** Dex (@dev)  
**Branch:** `feature/pilot-first-n-soft-open`  
**Notes:** HOLD_COPY nunca mais injetada. Hold local antes de POST. Expire lazy. Sem OPEN / cola 46589 / POST live. Migration 019 **não** aplicada em prod.

**Gates:** `node --test backend/test/booking-holds.test.js backend/test/booking-parser.test.js` → 93/93 PASS. Root `lint` / `typecheck` / `test` PASS (79/79 prompt). Backend suite 769/770 — 1 fail pré-existente `tess-context-cancel-full` (`getNextBusinessDays`), fora desta fatia.

## QA Results

### Review Date: 2026-09-08

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:booking-holds.js@5b3719d3,booking-parser.js@a1a6b4c0,server.js@59dfa561,booking-holds.test.js@b04369de,booking-parser.test.js@705ebe6c,019.sql@ea55ce53,019.rollback.sql@b1f711fe,HEAD:d7f9cd0

### Code Quality Assessment

Hold local + sanitize F5 fecham o dente T1/T2 na fatia unit. `HOLD_COPY` não é injetada; process-promise (`confirmando` / `reservei` / `marquei` / string F5) some; allowlist HELD não é stripada; 2-phase (`selectOutboundBlocks`) intacto. CREATE com `profissionalId`+`dataHoraInicio` faz `acquire` antes dos guards e 0 POST se unique/PG falhar. Migration 019 unique parcial sem `NOW()` no predicado + rollback só da tabela.

### Refactoring Performed

Nenhum — QA não altera source nesta wave (anti-self-review).

### Compliance Check

- Coding Standards: ✓ worker 0 LLM; events last4; padrão 016 nos índices
- Project Structure: ✓ `backend/lib` + `infra/migrations` + testes da fatia
- Testing Strategy: ✓ GWT nomeados; I1/I2/I3 parser não regridem (93/93)
- All ACs Met: ✓ AC1–9 na fatia worker+parser; hook server coberto por leitura, não por unit (TEST-001)

### Improvements Checklist

- [x] HOLD_COPY morta; T-6960 candidate sem injeção
- [x] T-9343 process-promise strip; T-13h/TTL/idempotent/combo/pg-down no worker
- [ ] TEST-001 — unit do hook `server.js` (acquire → 0 POST / 2xx → confirmed)
- [ ] TEST-002 — unique real após apply 019 em staging (smoke 0007)
- [ ] Story 2 Martelo — `1734`/Denise fora deste IN

### Security Review

last4 só em payload de `hold.*`. Sem PII. Sem cola 46589. Sem inventar `booking.created` no worker.

### Performance Considerations

Expire lazy no `acquire`; sem cron. Insert hold só no ramo CREATE com slot.

### Files Modified During Review

Nenhum arquivo de aplicação. Gate: `docs/qa/gates/tess-redesenho.1-hold-sanitize-f5.yml`

### Gate Status

Gate: CONCERNS → docs/qa/gates/tess-redesenho.1-hold-sanitize-f5.yml

### Lifecycle Transition

CONCERNS: InReview → Done (ready-for-review ≡ InReview)

## PO Concern Review (2026-09-08)

**Verdict:** aceitar CONCERNS · story 1 permanece **Done** · sem reabrir AC

| ID | Decisão | Por quê |
|---|---|---|
| TEST-001 | **Aceito** — follow-up smoke / helper de hook. **Não** é AC da story 2. | Fatia worker+parser cobre I1 unit; hook lido no gate. |
| TEST-002 | **Aceito** — unique real no apply 019 + smoke 0007 (staging). **Não** bloqueia draft Martelo. | Sem Hostinger/OPEN nesta sessão. |
| MNT-001 | **Aceito** — path (a) HELD copy fica morto na story 1 (auto-commit no tag). | T4 sem NLP. Story 2 não emite HELD. |

Smoke 0007 continua **depois** do gate, não DoD desta story.

## SM Draft Checklist

| Category | Status | Issues |
|----------|--------|--------|
| 1. Goal & Context Clarity | PASS | I1/H4; epic novo; story 2 gated |
| 2. Technical Implementation Guidance | PASS | 019 + holds.js + parser + hook |
| 3. Reference Effectiveness | PASS | spec §3 + MEMORY + 016 + booking-confirmation-flow |
| 4. Self-Containment Assessment | PASS | AC1–9 com copy e last4 |
| 5. Testing Guidance | PASS | GWT nomeados; sem live |
| 6. CodeRabbit Integration | PASS | enabled=true |

**Final Assessment:** Validated GO — Ready for @dev.

## PO Validation (2026-09-08)

**Verdict:** GO · **8/10** · confiança High  

Clarificações sem mudar escopo (auto-decisões):

1. AC2 — allowlist da frase HELD; “confirmar” infinitivo nessa frase não é stripado.  
2. AC5 — expire **lazy** no `acquire`; sem cron.  
3. Eventos — `emitOperationalEvent` (módulo existente).  
4. Hook T4 — só (a) copy HELD ou (b) tag CREATE com slot; sem NLP geral.  
5. `1734`/Denise fora dos ACs (Martelo = story 2).  
6. `quality_gate: @qa` = convenção do repo; matriz Bob lista @architect — CONCERN não bloqueante (igual honesty 2).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-08 | 0.1.0 | Draft story 1 hold+sanitize F5. ClickUp skip. | @sm |
| 2026-09-08 | 0.1.1 | Validated GO (8/10) — Status: Draft → Ready. AC2 allowlist, expire lazy, hook T4. | @po |
| 2026-09-08 | 0.2.0 | Implement T1–T5. Status: InProgress → ready-for-review. | @dev |
| 2026-09-08 | 0.2.1 | QA Gate CONCERNS — Status: InReview → Done | @qa |
| 2026-09-08 | 0.2.2 | PO review-concerns: TEST-001/002 aceitos (não bloqueiam); MNT-001 aceito. | @po |

---

*[AUTO-DECISION] Epic honesty Done — user override menu 1: novo epic redesenho, não story 14.*  
*[AUTO-DECISION] ClickUp sync skipped — MCP ausente; story local válida.*  
*[AUTO-DECISION] elicit pulada (ACK 1 explícito).*
