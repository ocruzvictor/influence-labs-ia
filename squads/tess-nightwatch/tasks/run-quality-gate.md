# Task: run-quality-gate

task: run-quality-gate
responsavel: "@quality-sentinel"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - file list do patch-dev
  - checklists/deploy-gate.md
Saida: |
  - gate: PASS | FAIL
  - test_output summary
Checklist:
  - "[ ] npm test na fatia (intent, parser, guards)"
  - "[ ] lint/typecheck se o patch tocou TS"
  - "[ ] Veto deploy se I1 não estiver coberto por teste"

## Workflow

Execução (Composer 2.5 Fast):

```
cd backend && node --test test/tess-context-intent.test.js test/booking-parser.test.js
```

Ampliar se o file list incluir outros testes. FAIL = Dev corrige, não Sentinel patcha. PASS = Supervisor pode autorizar rsync backend em P1; P0 precisa ACK explícito do Supervisor no log.
