# Story 3: A cauda da semana deixa de entrar sem intent

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Draft  
**Executor:** @architect → @dev · métrica @data-engineer  
**Quality gate:** @qa  
**Story points:** 8  
**Fonte:** Onda 1 (383 long miss / 383 intent null) · catálogo seed v0.1.0 · **não** fecha 80% por chute

## Story

**As a** operação que lê o banco,  
**I want** landing, dia-parte, nome de profissional e FAQ gravados como intent,  
**so that** a Tess não trate “vim pelo Studio Tirra / sexta final do dia / com o André” como vazio.

## Contexto

Onda 2 Fase A cobriu cinco stems Mira. O denominador 383 é outra coisa: encaixe + nome + ruído de landing. Intent null em 383/511 turnos user. Não inventar SKU. Não copiar KB de sinônimos para preencher `sku_id`.

## IN

- Classes da semana: ChannelPattern landing; `time` daypart; `pro` named; FAQ ops (PIX/endereço já no FILTER de outro caminho).
- Persistir intent ≠ null nessas classes. Profile continua MIN quando não há SKU (não reabrir FULL).
- Métrica: % intent null na janela 01–04/09 **replay local** (dump corpus), não promete 13,5 cr.
- Sem paste 46589. Sem smoke `0007`.

## OUT

- “Classificar as 383”. Stems já live. Caps P-BUDGET. Funil CRM.

## Acceptance Criteria

- [x] **AC1:** Aria: quais regex/estado entram; denylist do que continua null (áudio, mídia, lero). → `docs/analysis/2026-09-04-aria-chao-3-intent-tetos.md`
- [x] **AC2:** Fixture landing “vim pelo Studio Tirra. Quero agendar” → intent SCHEDULING (ou rótulo já existente), profile MIN, sem dump FULL.
- [x] **AC3:** Fixture daypart “sexta final do dia” + named “com o André” não ficam null.
- [x] **AC4:** Replay do dump da semana: intent null **cai** vs baseline 383/511. Sem meta inventada de 80%. Drop-happened: `would_fill=626`. **Não** 383-closed. `replay_null=−243`.
- [x] **AC5:** Quinn. Sem WhatsApp.

## Tasks

- [x] T1: tetos Aria → `docs/analysis/2026-09-04-aria-chao-3-intent-tetos.md`  
- [x] T2: Dex no classificador + persist  
- [x] T3: Dara número do replay — `baseline_null=383` · `user_n=1170` · `would_fill=626` · `replay_null=−243` (`drop=626`). Grain user bruto `--no-dedup`. 383 intacto.
- [x] T4: Quinn  

## File List

- `docs/analysis/2026-09-04-aria-chao-3-intent-tetos.md` — tetos Aria (AC1): labels existentes, denylist, persist passivo, MIN sem SKU, replay sem 80%
- `backend/lib/tess-context-intent.js` — `intentToPersist`, denylist, `isLeroUtterance`, `PASSIVE_PERSIST_INTENTS`
- `backend/lib/tess-context-profiles.js` — MIN override SCHEDULING/RESCHEDULE sem SKU
- `backend/lib/tess-context-assembler.js` — `hasServiceSignal` + `keepBookingWithoutSku` em `buildContextProfile`
- `backend/server.js` — passive Kapso + bot path persist via `intentToPersist`
- `backend/lib/salao-cli-ops.js` — `replayIntentNullDrop` (puro, zero write)
- `backend/scripts/salao/contexto/replay_intent_null.js` — CLI replay local
- `backend/test/tess-context-intent.test.js` — §8.1–8.2 fixtures + denylist
- `backend/test/tess-context-profiles.test.js` — §8.3 G1–G6
- `backend/test/tess-context-assembler.test.js` — G7 landing MIN + G8 in-progress BOOKING
- `backend/test/conversation-history.test.js` — passive SCHEDULING / media null
- `backend/test/salao-cli-ops.test.js` — replay helper miniatura
- `docs/analysis/2026-09-04-dara-chao-3-intent-replay.md` — Dara AC4: 383 / 1170 / 626 / −243; drop-happened; 383 intacto

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: wt-digest:20557e2203b5 (uncommitted-on-7482d3d)

### Code Quality Assessment

Dex fechou o furo de persist: inbound Kapso grava SCHEDULING/FAQ via `intentToPersist` (path `passive`); denylist (mídia, `[AUDIO TRANSCRITO]`, vazio, lero) fica null. Landing / sexta / André → SCHEDULING + MIN sem SKU; mid-funil `keepBookingWithoutSku` → BOOKING. Replay helper write-free; miniatura `would_fill=3`. Focused tests 125/125 (Quinn rerun). AC4/T3: Dara 383 / 1170 / 626 / −243 — drop-happened; 383 **não** fechou; sem `~80%`.

### Refactoring Performed

Nenhum. Anti-self-review: Dex implementou; Quinn só gateou.

### Compliance Check

- Coding Standards: ✓ persist na coluna; telemetry usa intent classificado
- Project Structure: ✓ 8 intents; FILTER/stems intocados; dump `dedup=true` default intacto
- Testing Strategy: ✓ §8.1–8.4 + I5/I6/I7 + G7/G8
- All ACs Met: ✓ drop-happened; 383 permanece aberta (residual honesto)

### Improvements Checklist

- [x] Hunts 1–9 (Quinn)
- [x] Rerun focused suite — 125/125
- [x] AC4: Dara cola `baseline_null=383` / `user_n=1170` / `would_fill=626` / `replay_null=−243` do dump 01–04/09

### Security Review

last4 only no helper. Sem E.164 neste review. Sem `sku_id` de sinónimos. Sem WhatsApp.

### Performance Considerations

MIN sem SKU evita dump FULL no 1º turno de landing/daypart/named. Um classify extra no inbound passivo.

### Files Modified During Review

Nenhum arquivo de aplicação. Artefatos QA: `docs/qa/gates/2026-09-04-chao-3-intent.yml`, `docs/handoffs/2026-09-04-quinn-gate-chao-3.md`.

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-3-intent.yml
`blocks_publish`: vazio. Publish execution: **false**. Sem WhatsApp.

### Lifecycle Transition

Não aplicada. Status permanece Draft (não InReview). `[AUTO-DECISION]` qa-gate.md post-gate exige InReview.