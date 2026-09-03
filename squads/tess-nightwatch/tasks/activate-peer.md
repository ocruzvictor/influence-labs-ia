# Task: activate-peer

task: activate-peer
responsavel: "@nightwatch-supervisor"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - to: patch-dev | quality-sentinel | floor-quality
  - evidence YAML (phone_last4, event, timestamp_utc, invariant_broken, task)
Saida: |
  - handoff_path em .aios/handoffs/ ou docs/handoffs/
  - peer acordado com modelo correto (Fast para Dev, High para veredito Sentinel)
Checklist:
  - "[ ] Evidence completa (sem last4 = BLOCK)"
  - "[ ] LLM do peer bate com squad.yaml llm (não raw model)"
  - "[ ] Task destino existe em tasks/"

## Workflow

1. Recusar se faltar evidence.phone_last4 ou timestamp.
2. Escolher modelo:
   - patch-dev → Composer 2.5 Fast (`composer-2.5-fast`)
   - quality-sentinel veredito → Grok 4.6 High; bateria → Composer 2.5 Fast
   - floor-quality análise → Grok 4.6 High; logs → Composer 2.5 Fast
3. Escrever handoff YAML `consumed: false`.
4. No Cursor: Task tool com `subagent_type` alinhado (dev / qa) **e** o `model` slug — a persona do squad é o prompt, o slug é o motor. Nunca `prompt: "fix tess"` sem o arquivo `agents/*.md`.

DONE quando o peer tem o path da task e a evidência no contexto.
