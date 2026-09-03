# Task: verify-trinks-commit

task: verify-trinks-commit
responsavel: "@quality-sentinel"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - phone last4 ou janela UTC
  - assistant text enviado (Kapso ou conversation_history)
Saida: |
  - verdict: PASS | FAIL | CONCERNS
  - invariant I1 I2
Checklist:
  - "[ ] Comparou texto de sucesso com agent_mutation_* / booking.created"
  - "[ ] tags.parsed órfão = FAIL"
  - "[ ] Não usou só o unit como prova de I1 no vivo"

## Workflow

1. Pegar assistant turns da janela.
2. Regex de afirmação: garantido, já marcado, agendado, reagendei, cancelei, tá confirmado.
3. Join com eventos e `trinks_api_requests` origin `agent_mutation_*`.
4. FAIL se afirmação sem 2xx. PASS se afirmação com created/cancelled. CONCERNS se só unit.

Veredito em Grok 4.6 High. Queries em Composer 2.5 Fast.
