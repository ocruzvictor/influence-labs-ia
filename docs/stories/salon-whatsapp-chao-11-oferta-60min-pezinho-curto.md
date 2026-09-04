# Story 11: Não falar horário que não cabe + pezinho curto

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Ready-for-Dex  
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
- KB opcional: FAQ §22 uma linha mais curta (sync 39496 após gate + Victor cola).
- Quinn gate. Gage publish backend + Victor cola v3.2.5.

## OUT

- Reabrir chão 9 Ausência. Hostinger. Smoke automático. André 10:30. CREATE `9800`.

## Acceptance Criteria

- [x] **AC1:** Aria tetos → [2026-09-04-aria-chao-11-tetos.md](../analysis/2026-09-04-aria-chao-11-tetos.md)
- [ ] **AC2:** Fixture Tiago 12/09: start 12:30 + grain 30 min + corte 60 → **12:30 ausente** do bloco com relógios; 17:00 presente se couber.
- [ ] **AC3:** Fixture André 11/09 14:00 30 min → não aparece relógio; linha “sem janela contínua” ou só 15:30+.
- [ ] **AC4:** Pezinho Ex.14 / REGRA ZERO / VALIDE 28 — resposta modelo ≤2 frases, sem “pedicure” default.
- [ ] **AC5:** Quinn PASS · `blocks_publish` vazio.
- [ ] **AC6:** Live `4356489` → SHA novo · Victor colou v3.2.5 · memories se KB mudou.

## Tasks

- [x] T1: Aria tetos  
- [x] T2: Dex backend + prompt v3.2.5  
- [ ] T3: Quinn  
- [ ] T4: Victor cola v3.2.5 · Orion sync KB se diff  
- [ ] T5: Gage publish  

## File List

- `docs/stories/salon-whatsapp-chao-11-oferta-60min-pezinho-curto.md`
