# Pacote Quinn — re-gate fatia pool (itens 1, 2, 3, 6, 8, 12, 13, 16)

> Orion não carimba PASS. Item **18** = este pedido. Sem deploy.

| Campo | Valor |
|---|---|
| Branch | `feature/tess-commit-honesty` |
| Base live | `b42bb2b` |
| SOT | `docs/analysis/2026-09-03-orion-fatia-pool-victor.md` |
| Pedido | Reabrir gate. Anterior: CONCERNS (72) em `docs/qa/gates/2026-09-03-outbox-sla-scoped.yml` |

## O que mudou no hot-path (cliente pode sentir)

1. **durationMin no assembler** — Tess deixa de ver inícios que não cabem na duração quando o SKU está no payload (≤3 serviços).
2. **Aviso de snapshot velho** (≥45 min) no bloco HORARIOS + evento `snapshot.stale`.
3. **`UNCERTAIN` → MIN** mesmo com `TESS_CONTEXT_MODE=full`. Confiança baixa em intent conhecido, em `scoped`, usa o perfil do intent (não FULL).

## O que é só rastro / CLI (cliente não sente)

- `confidence` + `context_profile` + `trace_id` em `tess.context_bytes` / `tess.turn` / `conversation_history`
- Crédito do turno persistido (agregado diário intacto)
- CLI `listar_fila_atendimento.js`
- `relatar_slo_eventos` ganha `per_hour`
- `correlacionar_last4.js --trace-id` (janela 180 min, sem o clamp de 30 do last4)

## Trava

- Sem prompt 46589
- Sem split de agente
- Sem funil CRM / UI admin
- Sem smoke `0007` / replay André
- last4 na saída das CLIs

## Como validar

```bash
cd backend && node --test \
  test/tess-context-profiles.test.js \
  test/tess-context-assembler.test.js \
  test/tess-context-slots.test.js \
  test/tess-context-bytes-persist.test.js \
  test/conversation-history.test.js \
  test/salao-cli-ops.test.js \
  test/salao-cli-catalog.test.js
```

Pergunta de qualidade (6): desambiguar com MIN não pode virar robotização. Se a Tess ficar muda ou genérica demais em `UNCERTAIN`, marcar CONCERNS — não “consertar” voltando FULL.

— Orion
