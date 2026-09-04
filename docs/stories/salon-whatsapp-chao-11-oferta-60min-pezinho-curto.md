# Story 11: Não falar horário que não cabe + pezinho curto

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Done  
**Executor:** @architect → @dev · Victor cola prompt v3.2.5  
**Quality gate:** @qa  
**Story points:** 5  
**Fonte:** smoke `0007` pós 8+9 · Victor 04/09 ~16:30 BRT

## Story

**As a** cliente que pede corte ou pezinho,  
**I want** a Tess só citar horários que cabem na duração do serviço e responder pezinho sem sermão,  
**so that** não ouço 12:30 para um corte de 60 min nem “não é pedicure” quando já sei o que é pezinho.

## Contexto

Pós publish `4356489` (chão 8+9). Smoke parcial `#2` + `#8`.

- **#2 PASS** regra; 1ª resposta verbosa (Ex.14 manda explicar). 2ª resposta limpa.
- **#8 residual:** Tiago sáb 12/09 **12:30** ofertado; grade só tem **30 min** contínuos; **17:00** OK. André **14:00** ofertado; backend bloqueou CREATE (`janela 30min < 60min`) — guard OK, **fala** errada.
- Logs: `durationMin` provavelmente **0** com catálogo >3 SKUs na fala “cortar com Tiago” → `startsFittingDuration` não filtra relógios.
- Ausência/chão 9 **não** reabrir — refresh OK no teste.

## IN

- Aria: teto — inferir duração na oferta quando serviço/prof estão claros (corte 60) mesmo com catálogo gordo; filtrar relógios no bloco HORARIOS.
- Dex: `resolveOfferDurationMin` / compact clock path + testes fixture 12:30/30min.
- Prompt **v3.2.5**: pezinho só = “pode passar sem marcar, é de graça no intervalo” — sem “não é pedicure”, sem “acabamento do corte”, salvo ambiguidade com unha.
- KB FAQ §22 one-liner (D11.4) — sync 39496 após Victor cola v3.2.5
- Quinn gate. Gage publish backend + Victor cola v3.2.5.

## OUT

- Reabrir chão 9 Ausência. Hostinger. Smoke automático. André 10:30. CREATE `9800`.

## Acceptance Criteria

- [x] **AC1:** Aria tetos: duração na oferta + copy pezinho mínima. Tetos: [2026-09-04-aria-chao-11-tetos.md](../analysis/2026-09-04-aria-chao-11-tetos.md). Ready-for-Dex **yes**.
- [x] **AC2:** Fixture Tiago 12/09: start 12:30 + grain 30 min + corte 60 → **12:30 ausente** do bloco com relógios; 17:00 presente se couber.
- [x] **AC3:** Fixture André 11/09 14:00 30 min → não aparece relógio; linha “sem janela contínua” ou só 15:30+.
- [x] **AC4:** Pezinho Ex.14 / REGRA ZERO / VALIDE 28 — resposta modelo ≤2 frases, sem “pedicure” default.
- [x] **AC5:** Quinn PASS · `blocks_publish` vazio.
- [x] **AC6:** Live `8c9c90e` · Victor colou v3.2.5 · FAQ §22 sync 39496 (163141).

## Tasks

- [x] T1: Aria tetos — [2026-09-04-aria-chao-11-tetos.md](../analysis/2026-09-04-aria-chao-11-tetos.md) · Ready-for-Dex **yes**
- [x] T2: Dex backend + prompt v3.2.5 — `resolveOfferDurationMin` narrow + `inferGrainMinutes` fix
- [x] T3: Quinn — [2026-09-04-chao-11-oferta-60min.yml](../qa/gates/2026-09-04-chao-11-oferta-60min.yml)
- [x] T4: Victor colou v3.2.5 · Orion sync FAQ §22 — `docs/intake/registro-chao11-kb-sync-2026-09-04.md`
- [x] T5: Gage publish `8c9c90e` · backup `backend.bak.20260904165231`

## File List

- `docs/stories/salon-whatsapp-chao-11-oferta-60min-pezinho-curto.md`
- `docs/analysis/2026-09-04-aria-chao-11-tetos.md`
- `backend/lib/tess-context-slots.js`
- `backend/lib/tess-context-assembler.js`
- `backend/lib/slot-windows.js`
- `backend/test/tess-context-slots.test.js`
- `docs/prompts/tess-conversa-v3-clean.md`
- `docs/prompts/archive/tess-conversa-46589-v3.2.4-2026-09-04.md`
- `docs/prompts/CHANGELOG-46589.md`
- `docs/qa/gates/2026-09-04-chao-11-oferta-60min.yml`
- `docs/ops/2026-09-04-gage-publish-plan-chao-11.md`
