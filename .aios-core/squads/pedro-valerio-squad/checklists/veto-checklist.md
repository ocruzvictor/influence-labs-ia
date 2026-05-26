# Checklist: Veto Conditions

```yaml
checklist:
  id: veto-checklist
  name: Verificação de Veto Conditions
  agent: pedro-valerio
  command: "*veto-check"
  version: "1.0.0"
```

## Propósito

Verificar se um sistema, processo ou workflow tem veto conditions necessárias para prevenir execução incorreta.

Veto condition = condição que BLOQUEIA o fluxo quando não satisfeita.
Diferente de warning (avisa mas deixa continuar).

---

## Checklist de Veto Conditions

### Por Etapa de Processo

Para cada transição entre etapas, verifique:

| Pergunta | Se NÃO → Gap |
|----------|-------------|
| Existe condição booleana para avançar? | Gap: sem checkpoint |
| A condição é verificável (não subjetiva)? | Gap: condição vaga |
| Se condição = false, há ação de bloqueio? | Gap: sem veto condition |
| A ação de bloqueio impede avanço de fato? | Gap: veto sem dentes |
| Existe responsável pelo desbloqueio? | Gap: sem owner do veto |
| Existe timeout para o desbloqueio? | Gap: pode ficar em limbo |

### Por Automação

| Pergunta | Se NÃO → Gap |
|----------|-------------|
| Automação tem condição de guarda (opt_out check)? | CRÍTICO: pode spammar |
| Automação verifica se já foi executada? | CRÍTICO: pode duplicar |
| Há limite de execuções por período? | Gap: pode gerar loops |
| Existe fallback se ação falha? | Gap: falha silenciosa |
| Existe log de execução e veto? | Gap: sem auditoria |

### Por Agente AIOX

| Pergunta | Se NÃO → Gap |
|----------|-------------|
| CRITICAL_LOADER_RULE presente? | CRÍTICO: executa sem carregar arquivos |
| Cada comando tem veto condition de dados? | Gap: pode executar sem input |
| Anti_patterns.never_do ≥ 5? | Gap: sem guardrails comportamentais |
| completion_criteria definido? | Gap: nunca sabe quando terminou |

---

## Formato de Saída

```
## Veto Conditions: {sistema/processo/agente}

### 🛑 Veto Conditions Existentes ({count})
| Etapa | Condição | Ação de Bloqueio | Owner do Veto |
|-------|---------|-----------------|---------------|
| {etapa} | {condição} | {ação} | {owner} |

### ❌ Veto Conditions Faltando ({count})
| Etapa | Gap Identificado | Severidade | Veto Condition Recomendada |
|-------|-----------------|-----------|---------------------------|
| {etapa} | {descrição do gap} | 🔴/🟡 | {condição + ação recomendada} |

### Resumo
- Total de checkpoints: {n}
- Checkpoints com veto: {n}
- Checkpoints SEM veto: {n} → {severidade}

**Risco Atual:** {descrição do risco de executar sem os vetos faltando}
**Próximo Passo:** {ação imediata recomendada}

---
<promise>COMPLETE</promise>
```

**Nota:** sinal de conclusão herdado de aios-core-main — indica que verificação rodou até o fim.

## Severidade de Gaps

| Severidade | Significado |
|-----------|-------------|
| 🔴 CRÍTICO | Pode causar dado incorreto, duplicação ou falha silenciosa |
| 🟡 MÉDIO | Pode causar inconsistência ou retrabalho |
| 🟢 BAIXO | Melhoria de controle, não afeta resultado imediato |
