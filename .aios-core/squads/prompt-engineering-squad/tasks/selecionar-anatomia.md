# Task: selecionar-anatomia — Selecionar anatomia de prompt da biblioteca

```yaml
task:
  id: selecionar-anatomia
  name: "Selecionar anatomia de prompt da biblioteca"
  agent: prompt-methodology-curator
  command: "*selecionar-anatomia"
  version: "0.1.0"
  etapa_workflow: 2
  gaps_fechados: [G15]
```

## Objetivo

Selecionar a anatomia adequada ao tipo de objetivo declarado no briefing, escolhendo de entrada catalogada na Biblioteca de Anatomias. Sem anatomia válida, não há redação.

## Entradas Necessárias

1. **Briefing aprovado** (output da etapa 1) — em especial `objetivo_negocio`, `tipo_de_agente`, `canal`.
2. **Biblioteca de Anatomias** — `data/biblioteca-anatomias.md` (catálogo indexado por tipo de objetivo).

Se briefing não passou a etapa 1: block — não recebe input parcial.

## Workflow de Execução

### Fase 1: Classificar objetivo

Lê o `objetivo_negocio` do briefing. Mapeia para tipo de objetivo da biblioteca (ex: qualificação SDR, suporte FAQ, agendamento). Registra a classificação e a evidência (qual trecho do briefing).

### Fase 2: Consultar biblioteca

Consulta `data/biblioteca-anatomias.md` filtrando por tipo de objetivo. Resultado: 0, 1 ou N anatomias candidatas.

- Se **1 candidata** → seleção direta.
- Se **N candidatas** → escolhe por critério explícito (canal, restrições do briefing). Registra critério usado.
- Se **0 candidatas** → 🛑 VETO. Não inventa anatomia. Opções: (a) ativar `*curadoria-continua` para catalogar formalmente uma nova com pesquisa, OU (b) devolver ao briefer.

### Fase 3: Registrar seleção

Anota no estado global: `anatomia_selecionada = {nome_anatomia}` + justificativa (1-3 frases ligando objetivo → anatomia → seções obrigatórias).

## Veto Conditions

(espelho da `etapa_2_selecionar_anatomia` do workflow)

- 🔴 **BLOCK se anatomia escolhida não está na Biblioteca E não foi formalmente adicionada (com pesquisa)** → retorna à curadoria contínua (`*curadoria-continua`). Sem anatomia válida, não há redação. Responsável pelo desbloqueio: `prompt-methodology-curator` (curadoria) OU Aprovador Humano (se ambiguidade de objetivo).

## Formato de Saída

```yaml
anatomia_selecionada:
  nome: "{ex: PACER}"
  versao: "{na biblioteca}"
  tipo_de_objetivo: "{classificação}"
  fonte_biblioteca: "data/biblioteca-anatomias.md#{anchor}"
  seções_obrigatórias: [{lista}]
  exige_few_shot: true|false
  justificativa: "{1-3 frases}"
```

## Critério de Conclusão

DONE quando: `anatomia_selecionada` registrada com justificativa rastreável à biblioteca + briefing. Handoff para `etapa_3_curar_fontes`.

Teste verificável: outro agente, sem contexto, ao ler `anatomia_selecionada`, sabe quais seções precisam ser preenchidas na etapa 4 e se há mínimo de few-shot.
