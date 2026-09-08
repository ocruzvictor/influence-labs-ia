# EPIC: Redesenho do commit — lock antes da boca (pós T1+T2)

**Status:** Planning  
**Criado em:** 2026-09-08  
**Origem:** ACK **A** pipeline · spec Onda 1 **APPROVED** (@qa)  
**Owner estrutura:** @pm (ratificar) · stories @sm  
**Orquestra:** @aiox-master  
**Branch sugerida:** `feature/tess-redesenho-hold`  
**SOT spec:** [onda-1-spec](../../research/2026-09-08-tess-redesenho/onda-1-spec/spec.md)  
**Memória:** [MEMORY T1+T2](../../ops/MEMORY-tess-t1-t2-fds-2026-09-08.md)

**Não** reabre [EPIC-tess-commit-honesty](EPIC-tess-commit-honesty.md) (Done 1–13).  
**Não** retoma [EPIC-tess-chao-unico](EPIC-tess-chao-unico.md) leftover.  
**Não** é PILOT / OPEN.

## Objetivo

Cliente só ouve compromisso quando o sistema **segurou o slot** (hold local) e, no sucesso, quando a Trinks **2xx**. Fecha o dano T1/T2 (boca sem POST; race 13h; F5 “Já estou confirmando”).

## IN

- Story 1: hold TTL + sanitize F5 / process-promise (este backlog).
- Story 2: Martelo (receipt nomeado) — draft após story 1 Done; smoke 0007 / apply 019 = staging, não bloqueia o papel.
- Invariantes I1/I2/I3 + 2-phase + guards CREATE **intactos**.

## OUT

- OPEN / `startPilot` / `BOT_ACCEPT_ALL` / colar 46589 / Hostinger / POST Trinks de teste.
- Split FAQ/BOOKING · DE Cowork · A/B modelo · Hermes · OpenClaw hot-path.
- Hold nativo Trinks (não evidenciado).
- Lib Forge generate.
- Reabrir corpus FDS.

## Stories

| # | Story | Fecha | Depende | Pts | Status |
|---|---|---|---|---|---|
| 1 | [Hold + sanitize F5](../salon-whatsapp-tess-redesenho-1-hold-sanitize-f5.md) | H4 + F5 copy | spec APPROVED | 8 | **Done** · QA CONCERNS · PO aceitou TEST-001/002 |
| 2 | [Martelo receipt](../salon-whatsapp-tess-redesenho-2-martelo-receipt.md) | F3×F5 `1734`/Denise | story 1 Done | 5 | **Done** · QA CONCERNS · PO aceitou TEST-003/OPS-001/UX-001 |

## Travas

Sem go-live. last4 only. Quinn critique CRIT-1/2/3 entram no AC da story 1.
