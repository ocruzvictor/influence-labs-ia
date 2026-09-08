# Task: tmpl-test — Teste de Template

```yaml
task:
  id: tmpl-test
  name: Teste de Template com Dados Reais
  agent: pedro-valerio
  command: "*tmpl-test {template}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: tmpl-test
  input: "{template} + dados reais"
  output: "aprovação do template ou lista priorizada de ajustes"
  action_items: "Preencher com dados reais; anotar falhas; priorizar ajustes"
  acceptance_criteria: "Template aprovado para produção ou gaps priorizados"
```

## Objetivo

Validar template preenchendo com 3+ casos reais e identificando ambiguidades, campos faltantes ou regras implícitas.
Resultado: template aprovado para uso em produção ou lista priorizada de ajustes.

## Entradas Necessárias

1. **Template** a ser testado
2. **3+ dados reais** que representam variação esperada:
   - **Happy path:** caso padrão e completo
   - **Edge case:** caso atípico mas válido (campo opcional vazio, valor extremo)
   - **Caso problemático:** dados inconsistentes ou incompletos
3. **Persona de preenchimento** (quem vai preencher na prática)

## Workflow de Execução

### Fase 1: Preencher Happy Path

Pegue o caso mais comum/representativo e preencha o template campo por campo.

Durante o preenchimento, registre:
- [ ] Algum campo gerou dúvida sobre o que preencher?
- [ ] Algum campo precisou de informação não disponível no dado original?
- [ ] Alguma instrução foi insuficiente?
- [ ] Foi necessário inferir/criar dado que não estava explícito?

### Fase 2: Preencher Edge Case

Pegue caso atípico:
- [ ] Template suporta este caso?
- [ ] Campo opcional realmente é opcional (não quebra significado se vazio)?
- [ ] Validações inline rejeitam dado válido (falso positivo)?

### Fase 3: Preencher Caso Problemático

Pegue dado inconsistente/incompleto:
- [ ] Template detecta a inconsistência?
- [ ] Validações forçam correção antes de avançar?
- [ ] Existe campo para registrar quando dado é "desconhecido" (vs simplesmente vazio)?

### Fase 4: Identificar Issues

Por preenchimento, categorize problemas:

| Severidade | Significado |
|-----------|-------------|
| 🔴 BLOCKING | Template não suporta caso válido OU permite caso inválido |
| 🟡 MAJOR | Instrução ambígua causa interpretações diferentes |
| 🟢 MINOR | Melhoria de clareza ou conveniência |

### Fase 5: Recomendações

Para cada issue, recomende ação específica:
- Adicionar campo X
- Reescrever instrução do campo Y para "..."
- Adicionar validação Z
- Adicionar exemplo para campo W

## Formato de Saída

```
## Teste de Template: {nome}

**Template testado em:** {data}
**Casos testados:** 3 (happy / edge / problemático)
**Veredicto:** {APROVADO / APROVADO COM RESSALVAS / REPROVADO}

---

### Caso 1: Happy Path
**Input:** {descrição do dado}
**Resultado:** PASS / FAIL
**Issues encontrados:**
- 🟡 [Campo X] Instrução ambígua: "..." — preenchedor teve que inferir significado
- 🟢 [Campo Y] Exemplo poderia incluir caso com Z

### Caso 2: Edge Case
**Input:** {descrição}
**Resultado:** PASS / FAIL
**Issues:**
- 🔴 Template não suporta caso onde Z é null — falha de validação

### Caso 3: Caso Problemático
**Input:** {descrição}
**Resultado:** PASS / FAIL
**Issues:**
- 🟡 Não há campo para indicar "desconhecido" vs "vazio"

---

## Resumo de Issues

| # | Severidade | Campo | Issue | Ação Recomendada |
|---|-----------|-------|-------|------------------|
| 1 | 🔴 | Z | Não suporta null | Adicionar validação opcional ou campo "Z_unknown" |
| 2 | 🟡 | X | Instrução ambígua | Reescrever instrução para "..." |

## Próximos Passos

1. Corrigir 🔴 BLOCKING (obrigatório antes de uso)
2. Corrigir 🟡 MAJOR (próxima iteração)
3. Considerar 🟢 MINOR (backlog)

## Aprovação

- [ ] Sem 🔴 BLOCKING = APROVADO
- [ ] Com 🔴 BLOCKING = REPROVADO (não usar em produção)
```

## Critério de Conclusão

DONE quando: 3+ casos testados (happy/edge/problemático), issues categorizados por severidade, recomendações específicas por issue, veredicto final justificado.
