# Task: rescue-thread

task: rescue-thread
responsavel: "@nightwatch-supervisor"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - phone E.164 ou last4 + evidência do patrol
  - tipo: tess_failed | falso_confirmado | leak | silence_stuck
Saida: |
  - rescue_result: notified | resumed | deferred_human
Checklist:
  - "[ ] Leu as últimas 8 mensagens (não o histórico inteiro)"
  - "[ ] Não emitiu BOOKING_CREATE pelo squad"
  - "[ ] Resume só com nota factual (serviço/dia/hora que o cliente pediu)"
  - "[ ] Falso confirmado: humano/Tiago avisado da divergência Trinks"

## Workflow

1. Confirmar que a thread está P0 (não resgatar ghost P3).
2. `tess_failed` / empty: `resume` com nota curta do pedido real. Se TESS voltar FULL, **parar** e acordar Dev (A1/A2).
3. `falso_confirmado`: **não** resume para “confirmar de novo”. Notify Tiago com last4 + o que a Trinks tem vs o que o bot disse.
4. `leak`: silêncio já aconteceu; registrar. Hotfix de strip é Dev, não rescue.
5. `silence_stuck` (handoff TTL): se o cliente ainda pede slot, notify Tiago. Não forçar resume se humano já marcou (caso Alisson).

Veto: POST Trinks, inventar horário, dizer “tá garantido”.
