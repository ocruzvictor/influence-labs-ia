# Task: create-task — Criação de Task AIOX

```yaml
task:
  id: create-task
  name: Criação de Task AIOX
  agent: pedro-valerio
  command: "*create-task {name}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: create-task
  input: "{name} + objetivo da task"
  output: "arquivo de task AIOX executável"
  action_items: "Aplicar decision tree; escrever anatomia; validar critério de conclusão"
  acceptance_criteria: "Task executável, validável, com workflow claro e critério de conclusão"
```

## Objetivo

Criar arquivo de task AIOX seguindo o padrão usado pelos agentes do ecossistema.
Resultado: task executável, validável, com workflow claro e critério de conclusão.

## Pré-requisito — Executor Decision Tree

⚠️ Antes de criar a task, decida o executor correto:

| Pergunta | Resposta SIM → | Resposta NÃO → |
|----------|---------------|----------------|
| É determinística (mesma entrada = mesma saída)? | Worker Python ($0) | Continue |
| Requer julgamento, NLP ou contexto variável? | Agent LLM (~$0.05) | Worker |
| Parte determinística + parte com julgamento? | Hybrid (~$0.02) | - |

Se Worker → task em código (não este template).
Se Agent ou Hybrid → use este template.

## Entradas Necessárias

1. **Nome da task** (kebab-case, ex: `validate-lead-data`)
2. **Agent owner** — qual agente executa
3. **Comando associado** — qual `*comando` aciona
4. **Objetivo da task** em 1-2 frases
5. **Inputs e outputs esperados**

## Workflow de Execução

### Fase 1: YAML Metadata

```yaml
task:
  id: {nome-kebab}
  name: {Nome Human-Readable}
  agent: {agent-id}
  command: "*{comando} {args}"
  version: "1.0.0"
```

### Fase 2: Estrutura da Task

Toda task deve ter as seções:

| Seção | Conteúdo |
|-------|---------|
| **Objetivo** | 1-2 frases sobre o que a task entrega |
| **Pré-requisito** (opcional) | O que deve estar pronto antes |
| **Entradas Necessárias** | Lista de inputs com tipos |
| **Workflow de Execução** | Fases sequenciais com ações |
| **Formato de Saída** | Estrutura exata do output |
| **Critério de Conclusão** | Quando DONE de forma verificável |

### Fase 3: Workflow Sequencial

Divida o trabalho em **Fases numeradas**:
- Cada fase tem objetivo específico
- Cada fase tem ações concretas
- Cada fase tem saída intermediária (alimenta a próxima)

⚠️ Sem fases → workflow vira "improvise". Fase = checkpoint mental.

### Fase 4: Formato de Saída Estruturado

Defina exatamente como o output deve ficar:
- Estrutura markdown ou JSON ou tabela
- Campos obrigatórios marcados
- Exemplos preenchidos quando possível

### Fase 5: Critério de Conclusão Verificável

DONE quando: lista de condições **booleanas e testáveis**.

Não escreva: "DONE quando workflow está bom"
Escreva: "DONE quando: 3+ casos testados, score calculado, recomendações priorizadas"

## Formato de Saída

```markdown
# Task: {nome} — {Título Curto}

\`\`\`yaml
task:
  id: {nome}
  name: {Nome}
  agent: {agent}
  command: "*{cmd}"
  version: "1.0.0"
\`\`\`

## Objetivo
{1-2 frases}

## Entradas Necessárias
1. **{Input 1}** — {descrição}
2. **{Input 2}** — {descrição}

## Workflow de Execução

### Fase 1: {Nome da Fase}
{Ações concretas}

### Fase 2: {Nome}
{Ações}

## Formato de Saída
\`\`\`
{estrutura exata do output}
\`\`\`

## Critério de Conclusão
DONE quando: {condição 1}, {condição 2}, {condição 3}.
```

## Critério de Conclusão

DONE quando: arquivo .md criado em `tasks/`, YAML metadata válido, ≥ 2 fases de workflow, formato de saída estruturado, critério de conclusão verificável com condições booleanas.

Validar com `*audit` (bloco C — Task AIOX).
