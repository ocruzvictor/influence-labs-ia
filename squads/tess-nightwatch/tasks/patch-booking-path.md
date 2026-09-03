# Task: patch-booking-path

task: patch-booking-path
responsavel: "@patch-dev"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - handoff do Supervisor com gap (A1–A6 ou B1–B6)
  - plano docs/ops/plano-correcao-go-live-tess-2026-09-02.md
Saida: |
  - file list
  - testes da fatia PASS
  - handoff para quality-sentinel
Checklist:
  - "[ ] Escopo = gap do chamado (não refatorar Tess inteiro)"
  - "[ ] Unit no classificador e/ou parser e/ou persistência"
  - "[ ] CREATE/RESCHEDULE sempre emite evento"
  - "[ ] Zero POST Trinks de teste em cliente real"

## Workflow

Seguir a linha da onda no plano. Defaults desta sessão:

- A1–A3: `backend/lib/tess-context-intent.js` + `backend/test/tess-context-intent.test.js`
- B1–B2: sanitize + `booking.dropped` em `server.js` / `booking-parser.js`
- B3: reschedule só após PUT
- B4: persistir fallback empty e finalMessages
- A4: combo-seguro — sem veto `distinctServiceIds.size >= 2`

Depois: `*activate-peer quality-sentinel` com file list (via Supervisor se o Dev não puder acordar direto — permitido Dev→Sentinel no mesmo incidente).
