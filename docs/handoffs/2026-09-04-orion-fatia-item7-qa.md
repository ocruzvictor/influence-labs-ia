# Pacote QA — item 7 P-BUDGET

**De:** Orion (@aios-master)  
**Para:** Quinn (@qa)  
**Data:** 2026-09-04  
**Anti-self-review:** Dex implementou; Quinn não é Dex.

## SOT

`docs/analysis/2026-09-04-aria-p-budget-tetos.md` (Aria W0).  
Workflow: `docs/ops/2026-09-04-orion-workflow-item7.md`.

Caps: MIN/FAQ 8000 · PRICE/CANCEL 10000 · BOOKING 16000 · FULL 24000.

## Recorte (Orion rerodou)

```
cd backend && node --test test/tess-context-budget.test.js test/tess-context-assembler.test.js test/tess-context-profiles.test.js test/tess-context-bytes-persist.test.js
# tests 46 / pass 46 / fail 0
```

UNCERTAIN → MIN intacto. `user_payload` não entra na soma.

## Travas (não FAIL por ausência)

Não Hostinger, rsync, paste 46589, BOT_ACCEPT_ALL, Trinks mutate, smoke 0007, André 10:30, CREATE 9800.  
approx_tokens no evento é **opcional** no SOT — omitido não é blocker.  
Item 6 (UNCERTAIN MIN) não reabre. Item 7 não promete 13,5 cr.

## Artefatos pedidos

- `docs/qa/gates/2026-09-04-fatia-item7.yml`
- `docs/handoffs/2026-09-04-quinn-gate-item7.md`
