# Task: create-workflow — Criação de Workflow YAML

```yaml
task:
  id: create-workflow
  name: Criação de Workflow Multi-Step
  agent: pedro-valerio
  command: "*create-workflow {name}"
  version: "1.0.0"
```

## Objetivo

Criar workflow YAML multi-step que orquestra múltiplas tasks e/ou agentes com checkpoints e handoffs.
Resultado: workflow executável, com fases ordenadas, veto conditions e rastreabilidade.

## Entradas Necessárias

1. **Nome do workflow** (kebab-case, ex: `lead-qualification-flow`)
2. **Objetivo do workflow** — que estado final ele atinge?
3. **Fases lógicas** — passos macro que o workflow executa
4. **Agentes/tasks envolvidos** em cada fase
5. **Inputs iniciais e outputs finais**

## Workflow de Execução

### Fase 1: Identificar Fases Macro

Cada fase representa um marco do trabalho:
- Fase tem objetivo claro
- Fase tem entrada (artefato de fase anterior ou input externo)
- Fase tem saída verificável
- Fase tem dono (agente ou task)

### Fase 2: Definir Checkpoints Entre Fases

Entre cada par de fases consecutivas:
- **Critério de avanço:** o que deve estar pronto para próxima fase iniciar
- **Veto condition:** o que bloqueia o avanço
- **Owner do checkpoint:** quem aprova a transição

### Fase 3: Especificar Handoffs

Quando workflow passa de um agente/task para outro:
- **From:** quem entrega
- **To:** quem recebe
- **Payload:** o que é transferido (artefato + contexto)
- **SLA:** prazo para receber e processar

### Fase 4: Definir Compensação / Rollback

Se uma fase falha:
- O workflow tem retry? Quantas tentativas?
- Existe rollback de fases anteriores?
- Há ponto de escalação para humano?

### Fase 5: Observabilidade

- Como cada fase reporta progresso?
- Qual o status visível em cada momento?
- Quem é alertado em caso de bloqueio?

## Formato de Saída

```yaml
# workflows/{name}.yaml
workflow:
  id: {name}
  name: "{Nome Human-Readable}"
  version: "1.0.0"
  description: |
    {1-2 parágrafos sobre objetivo e quando usar}

  inputs:
    - name: {input_1}
      type: {string/object/etc}
      required: true
      description: "{o que é}"

  outputs:
    - name: {output_final}
      type: {tipo}
      description: "{estado final esperado}"

  phases:
    - id: phase_1
      name: "{Nome da Fase}"
      owner: "{@agent ou task}"
      description: "{objetivo}"
      inputs: [{input_1}]
      outputs: [{artifact_phase_1}]

      checkpoint:
        condition: "{condição booleana de avanço}"
        veto_conditions:
          - "{condição que bloqueia}"
          - "{condição adicional}"
        owner: "{quem aprova}"
        sla: "{prazo}"

      on_failure:
        retry: 2
        backoff: "exponential"
        escalate_to: "{@agent}"

    - id: phase_2
      name: "{Nome}"
      owner: "{@agent}"
      inputs: [{artifact_phase_1}]
      outputs: [{artifact_phase_2}]
      ...

  handoffs:
    - from: phase_1
      to: phase_2
      payload: [{artifact_phase_1}, {context_metadata}]
      sla: "{prazo de pickup}"

  compensation:
    enabled: true
    strategy: "saga"  # saga | manual | none
    rollback_steps:
      - phase: phase_2
        action: "{ação de rollback}"

  observability:
    status_field: "workflow_status"
    progress_field: "current_phase"
    alerts:
      - trigger: "phase blocked > 1h"
        notify: "{@agent ou email}"
      - trigger: "workflow failed"
        notify: "{@agent}"
```

## Critério de Conclusão

DONE quando: YAML válido em `workflows/`, ≥ 2 fases, todas com owner/inputs/outputs, checkpoints com veto conditions, handoffs com SLA, compensação definida (ou justificada ausência), observabilidade especificada.

Validar com `*audit` (bloco B — Workflow/Processo) e `*veto-check`.
