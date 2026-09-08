# Task: arq-fields — Schema de Campos

```yaml
task:
  id: arq-fields
  name: Schema de Campos
  agent: pedro-valerio
  command: "*arq-fields {entidade}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: arq-fields
  input: "{entidade}"
  output: "schema de campos (tipo, obrigatoriedade, validação, default)"
  action_items: "Inventariar campos; tipar; definir validação e default"
  acceptance_criteria: "Nenhum campo com tipo ambíguo ou validação implícita"
```

## Objetivo

Definir schema completo de campos para uma entidade: tipo, obrigatoriedade, validação, default.
Resultado: nenhum campo fica com tipo ambíguo ou regra de validação implícita.

## Entradas Necessárias

1. **Entidade** a ser detalhada
2. **Estados** da entidade (para definir obrigatoriedade por estado)
3. **Casos de uso** que tocam a entidade (para inferir campos necessários)

## Workflow de Execução

### Fase 1: Listar Campos

Por entidade, identifique:
- **Identificação:** id, slug, externa_id
- **Atributos do domínio:** nome, email, telefone, etc.
- **Estado:** status, sub_status
- **Metadados:** created_at, updated_at, created_by, version
- **Soft-delete:** deleted_at (se aplicável)
- **Relações:** *_id (foreign keys)

### Fase 2: Tipos e Validações

Por campo:

| Atributo | Definir |
|----------|---------|
| Nome | snake_case, sem ambiguidade |
| Tipo | string / integer / decimal / boolean / datetime / enum / json / fk |
| Tamanho | Se string: min/max chars |
| Range | Se número: min/max |
| Formato | Regex se aplicável (email, telefone, CPF, CNPJ) |
| Enum values | Se enum: lista exata de valores aceitos |

### Fase 3: Obrigatoriedade por Estado

Nem todo campo é obrigatório sempre. Defina:

| Campo | New | Qualifying | Qualified | Converted |
|-------|-----|-----------|----------|-----------|
| email | OPT | OBR | OBR | OBR |
| budget | - | - | OBR | OBR |
| won_at | - | - | - | OBR |

OBR=obrigatório, OPT=opcional, - = não aplicável

### Fase 4: Defaults

Por campo opcional, definir:
- Default value (se houver)
- Default behavior (null, empty string, computed)

⚠️ Default null em campo que será usado em comparação numérica → bug garantido. Defina 0 ou empty.

### Fase 5: Validações Compostas

Algumas validações envolvem múltiplos campos:
- `won_at` só pode estar preenchido se `status='converted'`
- `cnpj` obrigatório se `tipo_pessoa='PJ'`, `cpf` obrigatório se `'PF'`

Listar essas regras explicitamente.

## Formato de Saída

```
## Schema: {entidade}

### Tabela de Campos
| # | Campo | Tipo | Tamanho/Range | Default | Validação | PK/FK |
|---|-------|------|---------------|---------|-----------|-------|
| 1 | id | uuid | - | gen_random_uuid() | - | PK |
| 2 | email | string | 5-255 | null | regex email | - |
| 3 | budget | decimal | 0-9999999.99 | null | >= 0 | - |
| 4 | status | enum | - | 'new' | enum_values | - |
| 5 | source_id | fk | - | null | references source(id) | FK |

### Enum Values
- **status:** new, qualifying, qualified, disqualified, converted

### Obrigatoriedade por Estado
| Campo | new | qualifying | qualified | converted |
|-------|-----|-----------|----------|-----------|
| email | OPT | OBR | OBR | OBR |
| budget | - | - | OBR | OBR |

### Validações Compostas
- `won_at` IS NOT NULL → `status` MUST be 'converted'
- `tipo_pessoa='PJ'` → `cnpj` IS NOT NULL

### Index Recomendados
- `email` (unique)
- `status, created_at` (consultas por status)
- `source_id` (FK)
```

## Critério de Conclusão

DONE quando: todos os campos tipados com tamanho/range, obrigatoriedade por estado definida, defaults explícitos, validações compostas documentadas, indexes recomendados.
