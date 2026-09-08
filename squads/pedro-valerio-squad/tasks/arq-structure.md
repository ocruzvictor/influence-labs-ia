# Task: arq-structure — Arquitetura de Sistema

```yaml
task:
  id: arq-structure
  name: Estruturação de Sistema
  agent: pedro-valerio
  command: "*arq-structure {sistema}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: arq-structure
  input: "{sistema} — casos de uso documentados"
  output: "schema de entidades, estados, campos e relações"
  action_items: "Listar entidades; definir relações; fechar schema"
  acceptance_criteria: "Schema cobre todos os casos de uso documentados"
```

## Objetivo

Definir arquitetura de sistema com entidades, estados, campos e relações.
Resultado: schema executável que cobre todos os casos de uso documentados.

## Entradas Necessárias

1. **Nome do sistema** e propósito principal
2. **Casos de uso** que o sistema precisa suportar
3. **Sistemas adjacentes** com que ele se integra (se houver)
4. **Restrições conhecidas** (volume, latência, compliance)

## Workflow de Execução

### Fase 1: Identificar Entidades

Para cada "substantivo importante" do domínio:
- Nome da entidade (singular, kebab-case ou PascalCase consistente)
- Definição em uma frase ("Lead = pessoa que demonstrou interesse mas ainda não comprou")
- Justificativa: por que é uma entidade separada (não atributo de outra)?

**Regra:** se duas "entidades" têm ciclos de vida idênticos e nunca existem separadas, são UMA entidade.

### Fase 2: Definir Estados

Por entidade, identifique os estados possíveis:
- Estados devem ser **mutuamente exclusivos**
- Listar **todos** os estados (incluindo terminais: cancelado, arquivado, deletado)
- Sem estado "outros" ou "diversos"

Saída desta fase alimenta a task `*arq-statuses` (state machine completa).

### Fase 3: Mapear Campos

Por entidade, liste campos:
- Nome do campo (snake_case)
- Tipo (string, integer, decimal, datetime, boolean, enum, foreign_key)
- Obrigatoriedade (sempre / por estado / opcional)
- Default value (se houver)
- Validação (regex, range, lookup)

Saída desta fase alimenta a task `*arq-fields` (schema detalhado).

### Fase 4: Mapear Relações

Para cada par de entidades relacionadas:
- Cardinalidade: 1:1, 1:N, N:N
- Direção: A "tem" B, B "pertence a" A
- Comportamento na deleção: cascade, restrict, set_null

### Fase 5: Validar Cobertura

Faça matriz **casos de uso × entidades**:
- Cada caso de uso é coberto por quais entidades?
- Existe caso de uso sem entidade que o suporte? (gap)
- Existe entidade não usada em nenhum caso de uso? (excesso)

## Formato de Saída

```
## Arquitetura: {sistema}

### Entidades
| Entidade | Definição | Justificativa |
|----------|-----------|---------------|
| {nome} | {1 frase} | {por que separada} |

### Estados por Entidade
**{Entidade A}:** estado_1 → estado_2 → estado_3 (terminal)
**{Entidade B}:** estado_x → estado_y → estado_z (terminal)

### Schema Resumido (detalhes em *arq-fields)
| Entidade | Campos-chave | Total de campos |
|----------|-------------|-----------------|
| {nome} | {pk + 3-5 principais} | {n} |

### Relações
| De | Cardinalidade | Para | On Delete |
|----|--------------|------|-----------|
| Lead | 1:N | Mensagem | cascade |

### Matriz Casos de Uso × Entidades
| Caso de Uso | Entidades Envolvidas |
|-------------|---------------------|
| {caso} | {lista} |

### Gaps de Cobertura
- ⚠️ {se algum caso de uso não tem entidade suficiente}
```

## Critério de Conclusão

DONE quando: entidades têm definição e justificativa, estados listados por entidade, relações com cardinalidade e on_delete, matriz de cobertura completa sem gaps críticos.
