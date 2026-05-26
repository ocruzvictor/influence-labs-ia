# Task: redigir-prompt — Redigir prompt na anatomia selecionada

```yaml
task:
  id: redigir-prompt
  name: "Redigir prompt na anatomia selecionada"
  agent: prompt-writer
  command: "*redigir-prompt"
  version: "0.1.0"
  etapa_workflow: 4
  gaps_fechados: [G14, G15]
```

## Objetivo

Produzir prompt versão N preenchendo cada seção da anatomia selecionada, com few-shot suficiente e saída estruturada declarada.

## Entradas Necessárias

1. **Briefing aprovado** (etapa 1).
2. **Anatomia selecionada** (etapa 2) — seções obrigatórias + `exige_few_shot`.
3. **Fontes curadas** (etapa 3) — material rastreável que alimenta o conteúdo das seções.
4. **Template** `templates/prompt-tmpl.md`.
5. **Parâmetro** `N_FEWSHOT_MIN` (default 5).

Sem qualquer um, block.

## Workflow de Execução

### Fase 1: Instanciar template

Cria arquivo do prompt a partir de `templates/prompt-tmpl.md`, com cabeçalho declarando `prompt_id`, `prompt_version = vN`, `anatomia`, `cliente`, `escopo`.

### Fase 2: Preencher seções da anatomia

Para cada seção obrigatória da `anatomia_selecionada`, escreve conteúdo destilado das `fontes_curadas`. Toda afirmação não-óbvia tem fonte referenciada (`# fonte: F{id}`). Nenhuma seção fica vazia.

### Fase 3: Few-shot

Se `anatomia.exige_few_shot == true`: produz `>= N_FEWSHOT_MIN` exemplos input→output extraídos/adaptados das fontes. Cada few-shot rotulado e rastreável.

### Fase 4: Saída estruturada

Declara explicitamente o formato de saída do agente (schema, exemplo, validador). Sem isso, etapa 5 veta.

### Fase 5: Registro de versão

Marca `prompt_version` no header e atualiza estado global. Não commita ainda — commit é da etapa 10.

## Veto Conditions

(espelho da `etapa_4_redigir_prompt` do workflow)

- 🔴 **BLOCK se qualquer seção da anatomia vazia** → prompt volta a rascunho; não entra no gate. Responsável: `prompt-writer`.
- 🔴 **BLOCK se few-shot < `N_FEWSHOT_MIN` quando a anatomia exige** → prompt volta a rascunho. Responsável: `prompt-writer`.

## Formato de Saída

Arquivo de prompt instanciado em `templates/prompt-tmpl.md`:

```yaml
prompt_id: {id}
prompt_version: "v{N}"
anatomia: "{nome}"
secoes_preenchidas: [{lista da anatomia}]
few_shot_count: {N >= N_FEWSHOT_MIN se exigido}
saida_estruturada:
  formato: "{json|markdown|...}"
  schema_ref: "{path ou inline}"
```

## Critério de Conclusão

DONE quando: todas as seções obrigatórias preenchidas, `few_shot_count` atende mínimo (se exigido), `saida_estruturada` declarada. Handoff para `etapa_5_quality_gate`.

Teste verificável: o quality gate da etapa 5 consegue rodar checklist sem encontrar campo ausente.
