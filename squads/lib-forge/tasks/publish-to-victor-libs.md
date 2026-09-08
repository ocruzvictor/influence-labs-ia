---
task:
  name: publishToVictorLibs()
  responsavel: "@lib-forge-chief"
  responsavel_type: Agente
  atomic_layer: Page
  task_name: publish-scripts
  status: active
  responsible_executor: "@lib-forge-chief"
  execution_type: agent
  input: ver bloco inputs/Entrada
  output: ver bloco outputs/Saida
  action_items: "Resolver write root (data/write-root.md); publicar approved_scripts só depois"
  acceptance_criteria: "Scripts no root resolvido; estrangeiro sem override = ASK"

Entrada:
  - approved_scripts (array → Memory, obrigatório)
  - destination (string → User Input, opcional — ver data/write-root.md)

inputs:
  - campo: approved_scripts
    tipo: array
    origem: Memory (from validateScripts)
    obrigatorio: true
  - campo: destination
    tipo: string
    origem: User Input
    obrigatorio: false
    default: "resolvido: destination → LIB_FORGE_WRITE_ROOT → ../victor-libs/ neste repo"

Saida:
  - published_paths (array → Memory)
  - module_readme (file → {WRITE_ROOT}/{dominio}/README.md)

Checklist:
  - "[ ] Criar estrutura de pastas no destino"
  - "[ ] Copiar scripts aprovados para destino correto"
  - "[ ] Gerar README.md do módulo"
  - "[ ] Informar usuário com resumo do que foi entregue"

outputs:
  - campo: published_paths
    tipo: array
    destino: Memory
  - campo: module_readme
    tipo: string
    destino: File
    path: "{WRITE_ROOT}/{dominio}/README.md"

steps:
  - id: "1"
    description: "Organizar scripts no destino"
    actions:
      - "Resolver WRITE_ROOT: node scripts/resolve-write-root.js [destination] [--foreign]"
      - "Se mustAsk: parar e perguntar. Não gravar."
      - "Criar {WRITE_ROOT}/{dominio}/ se não existir"
      - "Copiar scripts aprovados para o root resolvido"
      - "Verificar que nenhum script com problemas foi incluído"

  - id: "2"
    description: "Gerar README do módulo"
    actions:
      - "Criar README.md em {WRITE_ROOT}/{dominio}/"
      - "Documentar cada função: o que faz, como usar, exemplo"
      - "Listar dependências e como instalar"

  - id: "3"
    description: "Apresentar resumo ao usuário"
    actions:
      - "Mostrar lista de arquivos publicados com caminhos"
      - "Mostrar como usar cada script com exemplo simples"
      - "Informar como usar em outros projetos (copiar pasta)"

autoClaude:
  deterministic: true
  elicit: false
  composable: false
  pipelinePhase: delivery
---

# publishToVictorLibs()

Publica scripts validados no write root resolvido (`data/write-root.md`) e gera documentação de uso.

## README Gerado por Módulo

```markdown
# victor-libs/salao/

Scripts para automação do domínio de salão de beleza.

## Instalação

pip install requests python-dotenv

## Scripts Disponíveis

### disponibilidade.py

**buscar_horarios_disponiveis**
Busca horários livres no Trinks para um serviço e data.

Uso:
    from disponibilidade import buscar_horarios_disponiveis
    horarios = buscar_horarios_disponiveis("123", "2025-01-15", API_URL, API_KEY)

**verificar_profissional_disponivel**
Verifica se um profissional está disponível em um horário específico.

Uso:
    from disponibilidade import verificar_profissional_disponivel
    disponivel = verificar_profissional_disponivel("prof_456", "14:00", API_URL, API_KEY)

## Como Usar em Outro Projeto

Copie a pasta salao/ para dentro do seu projeto e importe:
    from salao.disponibilidade import buscar_horarios_disponiveis
```
