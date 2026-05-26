# Task: diagnosticar-falhas — Diagnosticar falhas (FP vs violação real)

```yaml
task:
  id: diagnosticar-falhas
  name: "Diagnosticar falhas (FP vs violação real)"
  agent: prompt-evaluator
  command: "*diagnosticar-falhas"
  version: "0.1.0"
  etapa_workflow: 7
  gaps_fechados: [G6, G8, G9]
```

## Objetivo

Para cada falha do `eval_report`, classificar como **falso-positivo (evaluator)** ou **violação real (prompt)** — sem isso, a correção da etapa 8 vai no lado errado.

## Entradas Necessárias

1. **eval_report** (etapa 6) com lista de `falhas`.
2. **Prompt versão N** auditável.
3. **Critérios do evaluator** (regras pontuáveis) acessíveis para inspeção.

Sem `eval_report` ou critérios, block.

## Workflow de Execução

### Fase 1: Iterar falhas

Para cada cenário em `eval_report.falhas`: lê input, resposta do agente e critério que falhou.

### Fase 2: Classificar

Aplica decisão binária:
- **`falso_positivo`** — a resposta atende ao objetivo de negócio, mas o critério do evaluator está mal calibrado (regex ruim, threshold incorreto, regra inventada).
- **`violacao_real`** — a resposta de fato viola o objetivo/restrição declarada no briefing/prompt.

Cada classificação exige justificativa: 1-3 frases citando trecho da resposta + critério aplicado.

### Fase 3: Anexar destino de correção

Para cada falha classificada:
- `violacao_real` → destino = `prompt-writer` (corrigir prompt na etapa 8).
- `falso_positivo` → destino = `prompt-evaluator` (recalibrar critério do evaluator na etapa 8).

### Fase 4: Verificar completude

Nenhuma falha pode ficar sem classificação. Falha não-classificada = block.

### Fase 5: Emitir diagnóstico

Produz `diagnostico` consolidado e anexa ao estado global.

## Veto Conditions

(espelho da `etapa_7_diagnosticar_falhas` do workflow)

- 🔴 **BLOCK se há falha não classificada** → não avança sem classificação completa. Responsável: `prompt-evaluator`.

## Formato de Saída

```yaml
diagnostico:
  prompt_version: "v{N}"
  total_falhas: {N}
  itens:
    - cenario_id: "C{n}"
      classificacao: "falso_positivo|violacao_real"
      justificativa: "{1-3 frases com citação}"
      destino_correcao: "prompt-writer|prompt-evaluator"
  resumo:
    falsos_positivos: {N}
    violacoes_reais: {N}
```

## Critério de Conclusão

DONE quando: `total_falhas == soma(falsos_positivos + violacoes_reais)`, cada item com justificativa e `destino_correcao`. Handoff para `etapa_8_corrigir_prompt`.

Teste verificável: o writer pode pegar a lista filtrada por `violacao_real` e atuar diretamente sem reinterpretar o eval.
