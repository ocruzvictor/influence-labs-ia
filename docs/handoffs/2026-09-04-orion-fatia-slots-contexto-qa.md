# Pacote Quinn — gate fatia slots+contexto (1b, 2b, overlay 9800)

> Orion não carimba PASS. Sem deploy neste pacote.

| Campo | Valor |
|---|---|
| Branch | `feature/tess-commit-honesty` |
| Live | `a08f23b` |
| SOT | `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md` |
| Workflow | `docs/ops/2026-09-04-orion-workflow-slots-contexto.md` |
| Motor | Grok 4.6 xHigh (persona Quinn, não modelo puro) |

## O que mudou no hot-path

1. **1b** — Catálogo/`durationMin` pela última fala; histórico só se a fala não tem keyword. “Penteado” coloquial (dia a dia / tesoura / insta / corte) inclui SKU de corte + DISAMBIGUA. Festa continua Gi.
2. **2b** — `ensureSlotSnapshot` usa maxAge = 45 min (não 24 h). Relê hoje + data pedida. Inclui hoje nas datas de oferta.
3. **9800** — `isCompatible` = matriz **ou** agenda 90d scheduled/confirmed. `getServicesText` une nomes observados na agenda.

## Trava

- Sem prompt 46589
- Sem Hostinger / rsync / `git add .`
- Sem flip `BOT_ACCEPT_ALL`
- Sem smoke 0007 / replay André / CREATE 9800
- last4 only
- Item 7 (teto chars) **fora** — não cobrar no gate

## Como validar

```bash
cd backend && node --test \
  test/booking-parser.test.js \
  test/tess-context-assembler.test.js \
  test/trinks-local-store.test.js \
  test/tess-context-slots.test.js \
  test/tess-context-cancel-full.test.js
```

Orion já rodou este recorte: 97/97. Reexecutar.

## Entrega

1. `docs/qa/gates/2026-09-04-fatia-slots-contexto.yml` no mesmo schema do gate `2026-09-03-fatia-pool-victor.yml`
2. `docs/handoffs/2026-09-04-quinn-gate-slots-contexto.md`
3. `gate`, `blocks_publish`, `slice_allowlist`, QUAL/SLOT findings
4. Risco a olhar: overlay 9800 pode autorizar CREATE que a Trinks recuse (400). Se for CONCERNS sem dente, `blocks_publish: false` + nota. Se for FAIL, dizer o patch mínimo.

— Orion
