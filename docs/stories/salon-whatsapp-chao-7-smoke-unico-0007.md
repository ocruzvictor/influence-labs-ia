# Story 7: Um smoke no `0007` — todas as verticais no mesmo roteiro

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Ops / QA  
**Status:** Draft  
**Executor:** Victor (WhatsApp) · Nightwatch lê o fio · Orion relata  
**Quality gate:** @qa (relatório, não unit)  
**Story points:** 3  
**Fonte:** [roteiro congelado](../ops/smoke-0007-roteiro-lexico-v323.md)

## Story

**As a** Victor no chip de teste,  
**I want** rodar o roteiro inteiro **uma** vez depois das stories 1–6,  
**so that** um erro de horário não invalida o teste de pezinho e vice-versa.

## IN

- Stories 1–6 Done + publicados (Gage allowlist).
- Kill switch: global=true só como chave técnica; `BOT_ACCEPT_ALL=false`; allow único `0007`.
- Roteiro 1–8 sem desvio. André 10:30 e CREATE `9800` proibidos.
- Relatório last4: cada item PASS/FAIL + vertical (léxico / memory / slot / FAQ / duração).

## OUT

- Teste no meio da story 1–6. OPEN. Replay `0101`. Hostinger.

## Acceptance Criteria

- [ ] **AC1:** 1–6 live no container + memories syncadas (4) + prompt v3.2.3 (já colado).
- [ ] **AC2:** Roteiro executado na ordem. Itens 1–7 obrigatórios; 8 opcional.
- [ ] **AC3:** Relatório classifica o fail na vertical certa. Não reabre story 3 por um `guard.blocked`.
- [ ] **AC4:** Depois do relatório: global=false de novo, salvo ACK de OPEN.

## Tasks

- [ ] T1: Gage confirma env WHITELIST `0007`  
- [ ] T2: Victor manda o roteiro  
- [ ] T3: Nightwatch + Orion relatório  
- [ ] T4: kill switch off  
