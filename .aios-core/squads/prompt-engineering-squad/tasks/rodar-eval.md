# Task: rodar-eval — Rodar bateria de eval

```yaml
task:
  id: rodar-eval
  name: "Rodar bateria de eval"
  agent: prompt-evaluator
  command: "*rodar-eval"
  version: "0.1.0"
  etapa_workflow: 6
  gaps_fechados: [G4, G7, G12]
```

## Objetivo

Orquestrar o harness de eval (scope-parametrizado, D8) em `>= N_CENARIOS_MIN` cenários e produzir eval report consolidado para diagnóstico.

## Entradas Necessárias

1. **Prompt versão N** que passou no quality gate (etapa 5).
2. **Suite de cenários** do escopo/cliente do briefing — fornecida ao harness via parâmetros.
3. **Parâmetro** `N_CENARIOS_MIN` (default 7) e `THRESHOLD_EVAL` (default 0.85).
4. **Harness de eval** acessível (worker determinístico).

Sem suite mínima ou harness indisponível, block.

## Workflow de Execução

### Fase 1: Preparar run

Configura o harness com: `prompt_id`, `prompt_version`, `escopo`, `cliente`, suite de cenários. Registra `run_id` e timestamp.

### Fase 2: Executar bateria

Dispara a bateria. Para cada cenário: input → chamada de API → resposta → pontuação por critério do evaluator.

### Fase 3: Detectar respostas vazias

Se algum cenário retornou resposta vazia da API: **retry automático** desse cenário antes de pontuar. Sem retry, eval é ruído.

### Fase 4: Verificar cobertura

Confirma que a run executou `>= N_CENARIOS_MIN` cenários completos (não-vazios). Caso contrário: re-executa; se persistir após retries definidos, escala.

### Fase 5: Consolidar eval report

Agrega scores por cenário e por critério. Produz `eval_report` com score global e lista de falhas (cenários abaixo do critério).

## Veto Conditions

(espelho da `etapa_6_rodar_eval` do workflow)

- 🔴 **BLOCK se eval não rodou** → re-executa run; se persistir, escala ao Aprovador Humano. Responsável: `prompt-evaluator`.
- 🔴 **BLOCK se run tem respostas vazias da API** (retry automático antes de pontuar) → não pontua; reexecuta. Responsável: `prompt-evaluator`.

## Formato de Saída

```yaml
eval_report:
  run_id: "{id}"
  prompt_version: "v{N}"
  cenarios_executados: {>= N_CENARIOS_MIN}
  score_global: {0..1}
  threshold: {THRESHOLD_EVAL}
  por_cenario:
    - id: "C1"
      score: {0..1}
      criterios: { ... }
      passou: true|false
  falhas: [{lista de cenários com passou=false}]
```

## Critério de Conclusão

DONE quando: `cenarios_executados >= N_CENARIOS_MIN`, nenhum cenário com resposta vazia não-retryada, `score_global` e lista de `falhas` registradas. Handoff para `etapa_7_diagnosticar_falhas`.

Teste verificável: o eval_report contém score por cenário com critérios — diagnóstico pode classificar cada falha sem precisar reexecutar.
