# Workflow — item 7 P-BUDGET (teto de chars) até concluir

Orion orquestra. PV-P0-2: `@architect` define tetos → `@dev` implementa → `@qa` gate → publish.

Victor 2026-09-04 ~11:03 BRT: “agora o item 7 / orquestra até entregarmos” = **W3 ACK**.

Motores: raciocínio Grok 4.6 xHigh (Aria, Quinn); execução Composer 2.5 Fast (Dex, Gage).

```
W0 Aria tetos  →  W1 Dex código  →  W2 Quinn gate
               →  W3 ACK (esta sessão)
               →  W4 Gage publish  →  W5 verify
```

| Passo | Owner | Stop |
|---|---|---|
| W0 | `@architect` Aria (Grok 4.6 xHigh) | Sem tetos escritos não há código |
| W1 | `@dev` Dex (Composer 2.5 Fast) | Só o que a Aria cravar. Degrada; nunca manda tudo |
| W2 | `@qa` Quinn (Grok 4.6 xHigh) | Anti-self-review |
| W3 | Victor | Feito nesta mensagem |
| W4 | `@devops` Gage (Composer 2.5 Fast) | Allowlist. Sem rsync. Sem Hostinger |
| W5 | Orion | Evento de trim no container. Sem André 10:30 |

SOT dossiê: Pedro PV-P0-2 / LibForge P-BUDGET. Item 6 (UNCERTAIN MIN) já live — não reabrir.

## W0 fechado (Aria 2026-09-04)

SOT: `docs/analysis/2026-09-04-aria-p-budget-tetos.md`

Caps: MIN 8000 · FAQ 8000 · PRICE 10000 · BOOKING 16000 · CANCEL 10000 · FULL 24000.

Degrade: drop_slot_days → filter_catalog → shrink_habilitacao → drop_profissionais → shorten_history → truncate_future_bookings → piso protegido.

Evento: `tess.context_trimmed`. BOOKING 16k deixa `0007` ~10k intocado.

## W1 fechado (Dex 2026-09-04)

Código: `backend/lib/tess-context-budget.js` + wiring assembler/server + persist `tess.context_trimmed`.
Recorte Orion: **46/46** (`tess-context-budget` + assembler + profiles + bytes-persist).
Opcional omitido: `before_approx_tokens` / `after_approx_tokens` no payload.

## W2 fechado (Quinn 2026-09-04)

Gate **PASS 91**. `blocks_publish: []`. Artefatos: `docs/qa/gates/2026-09-04-fatia-item7.yml`, `docs/handoffs/2026-09-04-quinn-gate-item7.md`. W4 Gage autorizado.
