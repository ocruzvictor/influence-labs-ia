# Task: eng-gaps — Identificação de Gaps em Workflow

```yaml
task:
  id: eng-gaps
  name: Identificação de Gaps
  agent: pedro-valerio
  command: "*eng-gaps {workflow}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: eng-gaps
  input: "{workflow} ou mapa de processo existente"
  output: "lista de gaps com severidade e recomendações"
  action_items: "Analisar ambiguidade; achar falhas silenciosas; priorizar gaps"
  acceptance_criteria: "Todo ponto de falha silenciosa ou execução incorreta está listado"
```

## Objetivo

Identificar todos os pontos onde o workflow pode falhar silenciosamente, ser executado incorretamente, ou produzir resultado inconsistente.

## Workflow de Execução

### Fase 1: Análise de Ambiguidade

Para cada etapa do workflow, verifique:
- A ação é concreta e verificável? Ou tem termos vagos ("se necessário", "conforme apropriado")?
- O critério de conclusão da etapa é claro?
- Existe apenas uma interpretação possível?

**Severidade:**
- 🔴 CRÍTICO — pode causar falha silenciosa ou dado incorreto
- 🟡 MÉDIO — pode causar inconsistência entre executores
- 🟢 BAIXO — melhoria de clareza, não afeta resultado

### Fase 2: Análise de Checkpoints

Verifique cada transição entre etapas:
- Existe um checkpoint? Se não → gap de controle
- O checkpoint tem condição booleana? Se não → gap de critério
- O checkpoint tem veto condition? Se não → gap de controle
- Existe responsável pelo bloqueio? Se não → gap de ownership

### Fase 3: Análise de Ownership

- Cada etapa tem owner identificado?
- O owner é uma pessoa/cargo ou "o time"?
- Existe backup se o owner estiver indisponível?
- Existe SLA para cada handoff?

### Fase 4: Análise de Edge Cases

- O que acontece se o trigger chega duplicado?
- O que acontece se dados obrigatórios estão faltando?
- O que acontece se o owner não está disponível?
- Existe path para "não" em cada decisão?

## Formato de Saída

```
## Análise de Gaps: {workflow}

**Score Geral:** {X}/10 — {CRÍTICO/ATENÇÃO/OK}

### 🔴 Gaps Críticos (resolução obrigatória antes de usar em produção)
1. **[Etapa X]** {descrição do gap}
   → Impacto: {o que pode dar errado}
   → Correção: {como resolver}

### 🟡 Gaps Médios (resolver na próxima revisão)
1. **[Etapa Y]** {descrição}
   → Impacto: {o que pode dar errado}
   → Correção: {como resolver}

### 🟢 Melhorias Recomendadas
1. {sugestão de clareza}

### ✅ Pontos Fortes
- {o que está bem definido}

**Próximo passo:** {ação prioritária recomendada}
```

## Critério de Conclusão

DONE quando: todos os gaps estão listados com severidade, impacto e correção. Score calculado. Próximo passo definido.
