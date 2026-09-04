# Fatia autorizada — pool Victor (2026-09-03 noite)

Victor: “vamos trabalhar nesses: 1, 2, 3, 6, 8, 12, 13, 16, 18”.

Não é story formal (`@sm`/`@po` não abriu). ACs vêm dos dossiês + estacionados. Sem deploy. Sem Hostinger. Sem paste de prompt. Sem partir 46589. Sem funil CRM.

| # | Corte desta fatia | Fora (de propósito) |
|---|---|---|
| 1 | Ligar `durationMin` no assembler (já escrito) | Mudar prompt 46589 |
| 2 | Idade do snapshot no bloco HORARIOS + evento `snapshot.stale` | Re-GET Trinks / sync mais agressivo |
| 3 | CLI worklist derivada (last4) | Admin UI / notas / funil |
| 6 | `UNCERTAIN` → perfil MIN (não herda FULL). Confiança baixa em intent conhecido usa o perfil do intent quando `scoped` | Hard cap de chars (item 7) |
| 8 | Evento `tess.turn` persistido com créditos + intent + perfil + chars. Agregado diário **permanece** | Nova tabela |
| 12 | `relatar_slo_eventos` ganha `per_hour` dos P0 | Mutar Nightwatch live |
| 13 | `trace_id` no INSERT de `conversation_history` + correlacionar por `--trace-id` (sem janela de 30 min) | Estender `resolveLast4` default |
| 16 | `confidence` + `context_profile` no evento de bytes (e no turno) | Coluna nova |
| 18 | Pacote para `@qa` re-gate | Orion não carimba PASS |

Rollback de 6: `TESS_CONTEXT_MODE=full` ainda dumpa intents conhecidos; `UNCERTAIN` continua MIN (é o ofensor). Kill do filtro de duração: revert do wiring no assembler.

— Orion
