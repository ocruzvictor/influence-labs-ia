# Task: quality-gate-prompt — Validar no quality gate de prompt

```yaml
task:
  id: quality-gate-prompt
  name: "Validar no quality gate de prompt"
  agent: prompt-evaluator
  command: "*quality-gate"
  version: "0.1.0"
  etapa_workflow: 5
  gaps_fechados: [G10, G11]
```

## Objetivo

Aplicar checklist estrutural ao prompt versão N e produzir gate report PASS/FAIL antes de gastar eval em prompt incompleto.

## Entradas Necessárias

1. **Prompt versão N** (output da etapa 4 ou da etapa 8).
2. **Checklist** `checklists/prompt-quality-gate.md`.
3. **Anatomia selecionada** (para validar seções esperadas).

Sem qualquer um, block.

## Workflow de Execução

### Fase 1: Carregar checklist

Lê `checklists/prompt-quality-gate.md`. Itens cobrem no mínimo: completude da anatomia, vocabulário (always_use / never_use), restrições e escalonamento, saída estruturada.

### Fase 2: Aplicar item a item

Para cada item do checklist: marca PASS, FAIL ou N/A com evidência (citação do prompt ou ausência localizada).

### Fase 3: Verificar vetos estruturais

- Vocabulário proibido presente? → FAIL bloqueante.
- Restrições/escalonamento ausentes? → FAIL bloqueante.
- Saída estruturada não especificada? → FAIL bloqueante.

### Fase 4: Emitir gate report

Produz `quality_gate_report` com verdict global e lista de FAILs com referência a item do checklist e trecho do prompt.

### Fase 5: Decisão

- **PASS** → handoff para `etapa_6_rodar_eval`.
- **FAIL** → retorna prompt para `etapa_4_redigir_prompt` (writer) com lista de falhas.

## Veto Conditions

(espelho da `etapa_5_quality_gate` do workflow)

- 🔴 **BLOCK se vocabulário proibido presente** → retorna à etapa 4 com lista de falhas. Responsável: `prompt-writer`.
- 🔴 **BLOCK se restrições/escalonamento ausentes** → retorna à etapa 4. Responsável: `prompt-writer`.
- 🔴 **BLOCK se saída estruturada não especificada** → retorna à etapa 4. Responsável: `prompt-writer`.

## Formato de Saída

```yaml
quality_gate_report:
  prompt_version: "v{N}"
  verdict: "PASS|FAIL"
  itens:
    - id: "QG-01"
      descricao: "{item do checklist}"
      status: "PASS|FAIL|N/A"
      evidencia: "{citação ou ausência}"
  vetos_disparados: [{lista}]
```

## Critério de Conclusão

DONE quando: cada item do checklist tem status + evidência; verdict declarado. PASS = avança; FAIL = devolve ao writer com lista acionável.

Teste verificável: o writer, lendo o report, sabe exatamente o que corrigir, sem releitura do prompt.
