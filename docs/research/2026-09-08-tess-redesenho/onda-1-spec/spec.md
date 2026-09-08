# Spec — Onda 1: lock + Martelo (sem implementação)

**ID:** `onda-1-redesenho-commit`  
**Status:** spec · **não** é story · **não** é autorização de código  
**Personas:** @architect · @pedro-valerio · @data-engineer · @ux-design-expert · @qa  
**Invariantes:** I1 · I2 · I3 · 2-phase · guards CREATE — afrouxar = BLOCK  

Anexos: [01-architect](./01-architect-contrato.md) · [02-pedro](./02-pedro-veto-fingerprint.md) · [03-schema](./03-schema-hold.md) · [04-ux](./04-ux-martelo.md)

---

## 1. Overview

T1/T2 falharam porque a boca promete compromisso **antes** do eixo commit e **sem** lock de inventário. O 2-phase (`selectOutboundBlocks`) **permanece**. Esta spec adiciona:

1. **Máquina de estados** persistida por worker (não pelo LLM).
2. **Hold TTL** local (Postgres) no par `(profissional_id, slot_start)` **antes** de copy que trate o slot como “o seu”.
3. **Sanitize F5** que cobre promessa de *processo* (“Já estou confirmando na agenda”) — a `HOLD_COPY` atual é **proibida**.
4. **Martelo:** recepção no fio **não** mata o hold; aceite/negação **nomeados** com receipt.

Hold local **não** é lock Trinks (NFR-3). Walk-in pela agenda humana ainda pode ganhar; COMMITTING usa guards `ocupado` e falha honesta.

---

## 2. Requirements

Ver `requirements.json`. P0: FR-1…FR-7. P1: FR-8…FR-10. NFR-1…NFR-6.

Fora de escopo: OPEN, colar 46589, split de agente, Cowork auditor, modelo/Hermes, generate Forge.

---

## 3. Approach

### 3.1 Máquina de estados (FR-1)

Estado **derivado + persistido** em `booking_holds` / `booking_handoff_receipts`. Campo escrito por LLM = BLOCK (Pedro / blueprint).

```
DISCOVERY → PROPOSED → HELD → COMMITTING → CONFIRMED
                ↓         ↓         ↓
            DISCOVERY   EXPIRED   FAILED
                          ↓
                       REJECTED (Martelo)
```

| Estado | Quem escreve | Condição de entrada |
|---|---|---|
| DISCOVERY | intent regex | inbound booking sem slot escolhido |
| PROPOSED | worker após snapshot | 1–2 slots oferecidos; copy **condicional** |
| HELD | worker `INSERT` hold | unique venceu; TTL ativo |
| COMMITTING | worker após tag+guards | Martelo approved **ou** auto-commit se receipt não exigido neste turno |
| CONFIRMED | worker após Trinks 2xx | I1 |
| FAILED | worker | guard/HTTP fail |
| EXPIRED | worker/cron | `now() > expires_at` e status held |
| REJECTED | Martelo | receipt.rejected |

**Auto-commit vs Martelo:** turno em que o cliente confirma e **não** há staff no fio → COMMITTING direto (story 1). Staff no fio **ou** tag `HANDOFF_HUMAN` → exige receipt (story 2). Story 1 **não** implementa a UI; story 2 liga FR-6/7.

**Combo:** story 1 = **single-SKU**. Dois serviços em sequência continuam no guard `combo_overlap` (CRIT-3). Sem segundo hold no mesmo `slot_start`.

### 3.2 Hold (FR-2, FR-5, FR-9, NFR-1, NFR-2, NFR-5, NFR-6)

- Tabela `booking_holds` — spec em `03-schema-hold.md`. **0 migration nesta sessão.**
- Unique parcial: um hold ativo por `(profissional_id, slot_start)`.
- TTL default **180s** (config 120–300).
- Insert **antes** de copy HELD. Insert fail (unique) → copy ocupado.
- Postgres down → NFR-6 fail-closed na oferta de slot.
- **Não** POST Trinks no hold.

### 3.3 Copy matrix + sanitize F5 (FR-3, FR-4)

`HOLD_COPY` live (`Já estou confirmando na agenda, um instante.`) = **veto**. Não substituir por sinônimo.

| Estado | Permitido | Proibido |
|---|---|---|
| DISCOVERY | pedir dia/serviço/prof | confirmar, marcar, reservar |
| PROPOSED | “tenho 13h **disponível**” | “seu horário”, “já está”, endereço |
| HELD | “13h está separado por 3 min. Só vale quando eu confirmar o agendamento.” | “confirmando”, “já estou confirmando”, “confirmado”, “te esperamos”, endereço, “enquanto gravo” |
| COMMITTING | silêncio ou “gravando agora” **sem** sucesso | “confirmado”, endereço |
| CONFIRMED | sucesso + endereço | — |
| FAILED / EXPIRED / REJECTED | honesta / outro horário | qualquer sucesso |

Ampliar `PREMATURE_CONFIRM_PATTERNS` + `POST_FAIL_CONFIRM_PATTERNS` com: `confirmando`, `já estou confirm`, `reservei`, `marquei`, `tá marcado`, `ja confirmo`, e a string exata da `HOLD_COPY`.

`selectOutboundBlocks` continua sendo o dente de sucesso. Novo dente: **process-promise** sem `hold_id` ativo = strip.

### 3.4 2-phase e guards (FR-4)

Ordem COMMITTING (inalterada + hold):

1. Tag `[BOOKING_CREATE]` presente  
2. Hold row deste phone + slot ainda `held`  
3. Guards existentes (consultivo / preço / incompatível / expediente / janela / ocupado / idempotência)  
4. POST Trinks  
5. 2xx → hold `confirmed` + `trinks_id` · senão `failed` + release unique  
6. `selectOutboundBlocks` libera sucesso **só** no 2xx  

### 3.5 Martelo (FR-6, FR-7, FR-8, NFR-4)

Hoje: staff no fio → `silenced_until` → Tess cala → hold (inexistente) e 2-phase morrem (F3×F5).

Alvo:

- Silêncio do bot **permanece** (F3).
- Hold/PROPOSED **não** são apagados pelo silêncio (FR-6).
- Receipt obrigatório para avançar a COMMITTING quando staff está no fio (FR-7).
- Superfície v1: evento `handoff.receipt` + Nightwatch P0 + ação `approve|reject` em API interna já autenticada (admin). **Sem frontend novo.** Wireframe em `04-ux-martelo.md`.

`assigned_to` = cargo+nome ou user id interno. String `"recepção"` = veto Pedro.

### 3.6 Residual risk (NFR-3)

Hold Tess-Tess. Trinks UI / telefone / walk-in pode ocupar o mesmo slot. Guards `ocupado` no COMMITTING são o dente. Não inventar hold Trinks.

---

## 4. Dependencies

| Dependência | Já existe? | Versão / nota |
|---|---|---|
| Postgres | sim | hot-path Express + `pg` |
| `booking-parser.js` 2-phase | sim | `sanitizePrematureConfirm`, `selectOutboundBlocks`, `HOLD_COPY` |
| `booking-guards.js` | sim | `ocupado` / janela / combo |
| `bot_thread_state` | sim | silence + `last_staff_outbound_at` |
| `trinks_api_requests` ledger | sim | I1 |
| `bot_operational_events` | sim | Nightwatch |
| Trinks hold API | **não evidenciado** | **não usar** |
| Tess Cowork DE | fora Onda 1 | Onda 2 |
| UI admin nova | não | NFR-4 proíbe na story 1–2 v1 |

---

## 5. Files (quando @dev — não agora)

| Path | Ação | Story |
|---|---|---|
| `infra/` migration `booking_holds` + `booking_handoff_receipts` | add | 1 (+ 2 receipts) |
| `backend/lib/booking-holds.js` | add | 1 |
| `backend/lib/booking-parser.js` | modify sanitize + remover `HOLD_COPY` atual | 1 |
| `backend/server.js` | hook hold antes de outbound de slot | 1 |
| `backend/lib/bot-thread-state.js` | silence não release hold | 2 |
| `backend/lib/booking-handoff-receipts.js` | add | 2 |
| `backend/test/booking-holds.test.js` | add | 1 |
| `backend/test/booking-parser*.js` | extend F5 patterns | 1 |
| `backend/test/handoff-martelo.test.js` | add | 2 |

Prompt 46589: **não colar**. Copy matrix é enforce no worker; prompt só pode ser story futura se smoke exigir.

---

## 6. Testing (Given-When-Then)

| ID | FR | Cenário |
|---|---|---|
| T-9343 | FR-3, FR-4 | **Given** fio T1 sem POST **When** modelo emite “Confirmo” + endereço **Then** sanitize remove; outbound sem endereço; 0 POST |
| T-1734 | FR-3, FR-6 | **Given** F5 hold copy e recepção no fio **When** staff outbound **Then** bot cala; hold (se existia) permanece; sem “Já estou confirmando” |
| T-6960 | FR-2, FR-3 | **Given** cliente aceita slot **When** sem tag ou guard block **Then** sem HOLD_COPY; copy honesta; 0 POST |
| T-Denise | FR-6, FR-7 | **Given** walk-in após promessa **When** staff no fio sem receipt **Then** estado ≠ CONFIRMED; receipt pending; copy cliente não diz confirmado |
| T-13h | FR-5 | **Given** dois phones no mesmo prof+13h **When** ambos tentam hold **Then** um `held`, outro ocupado |
| T-TTL | FR-9 | **Given** hold 180s **When** expira **Then** status EXPIRED; unique livre; copy não soa hold |
| T-2xx | FR-4 | **Given** hold + tag + guards OK + Trinks 2xx **When** outbound **Then** sucesso + endereço permitido |
| T-ocupado-trinks | NFR-3 | **Given** hold nosso, slot pego na Trinks **When** POST/guard ocupado **Then** FAILED + copy honesta |
| T-pg-down | NFR-6 | **Given** insert hold falha infra **When** oferta de slot **Then** não HELD; 0 POST |
| T-idempotent | NFR-5 | **Given** hold ativo mesmo phone+slot **When** re-insert **Then** no-op mesmo `id` |
| T-SLA | FR-8 | **Given** receipt pending **When** `sla_until` passa **Then** `action=timeout` + evento + hold permanece `held` até `expires_at` |
| T-combo | CRIT-3 | **Given** combo dois SKUs **When** story 1 **Then** segundo SKU **não** cria segundo hold; `combo_overlap` guard permanece SOT |

Smoke 0007 (quando existir implementação): replay destes GWT **sem** OPEN, **sem** POST de teste em produção.

---

## 7. Risks

| Risco | Mitigação |
|---|---|
| Hold local não impede Trinks UI | NFR-3 explícito; guards ocupado |
| TTL 3 min curto no WhatsApp | Copy HELD declara o minuto; re-offer após EXPIRED |
| Martelo sem UI = SLA furado | NFR-4 + evento Nightwatch; story 2 |
| Ampliar sanitize come copy legítima | Lista lexical + testes; CONFIRMED isento |
| Scope creep squad/DE/modelo | Fora de escopo nesta spec |
| Afrouxar 2-phase “pra parecer rápido” | BLOCK |

---

## 8. Story gate (não executar agora)

1. QA `*critique-spec` desta pasta → APPROVED  
2. @sm `*draft` story `hold-sanitize-f5`  
3. @po validate  
4. @dev **só** story 1  
5. Smoke 0007  
6. Só então story Martelo  

---

*Spec Onda 1 · 2026-09-08 · sem go-live*
