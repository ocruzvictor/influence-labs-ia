# Task: create-agent — Criação de Agente AIOX

```yaml
task:
  id: create-agent
  name: Criação de Agente AIOX
  agent: pedro-valerio
  command: "*create-agent {name}"
  version: "1.0.0"
  status: active
  execution_type: agent
  responsible_executor: pedro-valerio
  task_name: create-agent
  input: "{name} + persona e quando usar"
  output: "agente hybrid-loader com 6 níveis"
  action_items: "Preencher loader; persona; commands; quality gate"
  acceptance_criteria: "Agente passa SC_AGT_001 (300+ linhas, Voice DNA, examples, gates)"
```

## Objetivo

Criar agente AIOX completo seguindo o template hybrid-loader com todos os 6 níveis.
O agente resultante deve passar no quality gate SC_AGT_001 (300+ linhas, Voice DNA, output examples, quality gates).

## Pré-requisito

Colete antes de iniciar:
1. **Nome do agente** — id kebab-case e nome human-readable
2. **Propósito** — o que o agente faz em uma frase?
3. **Comandos** — lista dos comandos principais
4. **Persona** — quem é o agente? Qual é sua identidade?
5. **Squad de destino** — em qual squad ficará?

Se for mind-cloning (agente baseado em pessoa real):
→ Delegue extração de DNA para `@oalanicolas` primeiro.

## Workflow de Execução

### Fase 1: Definir Identidade (Level 1)

- Nome, id, título, ícone, tier
- Persona: role, style, identity, focus
- Background: 3-5 parágrafos cobrindo origem, filosofia, diferenciais

### Fase 2: Definir Comandos (Level 2)

Para cada comando:
- Nome, descrição, visibility (full/quick/key)
- Arquivo de task associado em `tasks/`
- Core principles (5-9 princípios fundamentais)
- Frameworks operacionais com passos e exemplos

### Fase 3: Definir Voice DNA (Level 3)

- sentence_starters por contexto (authority, teaching, challenging, etc.)
- vocabulary: always_use (5+) e never_use (3+)
- metaphors (3+)
- behavioral_states (2+) com trigger, output e signals
- signature_phrases (5+)

### Fase 4: Quality Assurance (Level 4)

- 3+ output_examples completos (input real → output completo)
- anti_patterns.never_do (5+)
- red_flags_in_input (2+)
- completion_criteria (task_done_when por tipo de tarefa)
- handoff_to (1+ handoffs)
- objection_algorithms (3+)

### Fase 5: Loader Configuration (Level 0)

- command_loader: mapear TODOS os comandos com arquivos requires
- CRITICAL_LOADER_RULE: copiar verbatim do template
- dependencies: listar todos os arquivos referenciados
- REQUEST-RESOLUTION: exemplos de mapeamento de linguagem natural

### Fase 6: Integration (Level 6)

- tier_position, primary_use
- workflow_integration: handoff_from e handoff_to
- synergies com outros agentes
- activation.greeting formatado

### Fase 7: Quality Gate Verification

Antes de finalizar, verifique:

| Check | Mínimo | Status |
|-------|--------|--------|
| Total de linhas | 300+ | |
| command_loader completo | Todos os comandos | |
| CRITICAL_LOADER_RULE presente | Verbatim | |
| voice_dna.vocabulary | always_use 5+ e never_use 3+ | |
| output_examples | 3+ completos | |
| anti_patterns.never_do | 5+ | |
| behavioral_states | 2+ | |
| objection_algorithms | 3+ | |
| completion_criteria | Definido | |
| handoff_to | 1+ | |

Se algum check falhar → completar antes de declarar DONE.

## Critério de Conclusão

DONE quando: arquivo .md criado no squad correto, quality gate 10/10 verificado, greeting testado (leia o greeting e confirme que representa o agente).
