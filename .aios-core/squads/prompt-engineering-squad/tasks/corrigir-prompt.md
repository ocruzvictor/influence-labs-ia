# Task: corrigir-prompt — Corrigir prompt (ou evaluator)

```yaml
task:
  id: corrigir-prompt
  name: "Corrigir prompt (ou evaluator)"
  agent: prompt-writer
  command: "*corrigir-prompt"
  version: "0.1.0"
  etapa_workflow: 8
  gaps_fechados: [G6, G8]
```

## Objetivo

Aplicar correção no lado certo conforme `diagnostico` da etapa 7: prompt se `violacao_real`, evaluator se `falso_positivo`. Re-entra no loop de calibração (5→6→7→8) até `score >= THRESHOLD_EVAL` ou `iteration_count >= N_ITERACOES_MAX`.

## Entradas Necessárias

1. **diagnostico** (etapa 7) com lista classificada.
2. **Prompt versão N** atual.
3. **Critérios do evaluator** (quando há FP a corrigir).
4. **Parâmetros** `THRESHOLD_EVAL` e `N_ITERACOES_MAX`.
5. **`iteration_count`** do estado global.

Sem diagnóstico, block.

## Workflow de Execução

### Fase 1: Separar por destino

Particiona `diagnostico.itens` em dois grupos: `violacao_real` (vai no prompt) e `falso_positivo` (vai no evaluator).

### Fase 2: Corrigir prompt (violações reais)

Para cada violação real: edita o prompt — ajusta seção da anatomia, adiciona few-shot contraexemplo, refina restrição. Cada edição rastreável ao item do diagnóstico. Bump `prompt_version` para `v{N+1}`.

### Fase 3: Corrigir evaluator (falsos positivos)

Para cada FP: ajusta o critério do evaluator (regex, threshold, regra). Registra a recalibração com diff e motivo. Não altera o prompt nesse fluxo.

### Fase 4: Atualizar contador

Incrementa `iteration_count`.

### Fase 5: Verificar guarda do loop

- Se `iteration_count >= N_ITERACOES_MAX` E `score_global < THRESHOLD_EVAL`: 🛑 VETO — escala ao Aprovador Humano. Não força nova iteração.
- Caso contrário: handoff para `etapa_5_quality_gate` (re-entrada do loop). Quando `score_global >= THRESHOLD_EVAL`, sai do loop → `etapa_9_aprovar_versao`.

## Veto Conditions

(espelho da `etapa_8_corrigir_prompt` do workflow)

- 🔴 **BLOCK se `score < THRESHOLD_EVAL` após `N_ITERACOES_MAX` iterações** → escala ao Aprovador Humano para decisão. Responsável pelo desbloqueio: Aprovador Humano.

## Formato de Saída

```yaml
correcao:
  iteration: {n}
  prompt_version_anterior: "v{N}"
  prompt_version_nova: "v{N+1}"
  edicoes_no_prompt:
    - item_diagnostico: "C{n}"
      secao_afetada: "{nome}"
      diff_resumo: "{1-2 linhas}"
  recalibracoes_no_evaluator:
    - item_diagnostico: "C{n}"
      criterio: "{id}"
      diff_resumo: "{1-2 linhas}"
  proxima_etapa: "etapa_5_quality_gate | escalar_humano"
```

## Critério de Conclusão

DONE quando: toda violação real foi tratada no prompt OU todo FP no evaluator; `prompt_version` bumped se houve edição no prompt; decisão de loop (re-entrar OU escalar) registrada.

Teste verificável: o próximo quality gate consegue ser rodado sem ambiguidade sobre qual versão avaliar.
