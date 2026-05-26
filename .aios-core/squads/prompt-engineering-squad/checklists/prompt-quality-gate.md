# Prompt Quality Gate — Checklist

```yaml
checklist:
  id: prompt-quality-gate
  version: 0.1.0
  created: 2026-05-25
  squad: prompt-engineering-squad
  purpose: |
    Validar estrutura de PROMPT CONVERSACIONAL (agente Tipo 4) antes
    do eval. Fecha G11 do insumo: o agent-quality-gate.md v4.0 valida
    persona-agente AIOX (800+ linhas, command_loader, voice_dna),
    NÃO valida prompt conversacional. Este gate cobre a lacuna.
  scope: "Prompts conversacionais (agentes Tipo 4) — SDR, atendimento, similares"
  not_scope: "Agentes AIOX hybrid-loader — use .aiox-core/development/checklists/agent-quality-gate.md"
  mode: blocking
  used_by:
    agent: prompt-evaluator
    command: "*quality-gate"
    etapa: 5
  references:
    workflow: "squads/prompt-engineering-squad/workflows/prompt-engineering-pipeline.yaml (etapa_5_quality_gate)"
    voice_dna: "squads/prompt-engineering-squad/data/voice-dna-squad.md"
    biblioteca_anatomias: "squads/prompt-engineering-squad/data/biblioteca-anatomias.md"
    parameters: "workflows/prompt-engineering-pipeline.yaml > parameters (N_FEWSHOT_MIN, etc.)"
```

---

## Pre-Validation

```yaml
pre_validation:
  - id: prompt-file-exists
    check: "Arquivo de prompt referenciado existe e é legível"
    type: blocking
    validation: "test -f {prompt_path}"
    veto_if_fail: "BLOCK — sem arquivo, não há o que validar"

  - id: anatomia-declarada
    check: "O prompt declara qual anatomia foi usada (Etapa 2 do pipeline)"
    type: blocking
    validation: "Header/metadata do prompt cita anatomia_selecionada"
    veto_if_fail: "BLOCK — sem anatomia declarada, não há critério de validação por seção"
```

---

## Blocking Items — qualquer falha = VETO

```yaml
blocking:

  - id: anatomia-catalogada
    check: "A anatomia selecionada está catalogada na Biblioteca de Anatomias"
    type: blocking
    validation: |
      Anatomia citada pelo prompt EXISTE como entrada em data/biblioteca-anatomias.md
      OU foi formalmente adicionada (com pesquisa registrada) pelo prompt-methodology-curator
    veto_if_fail: "BLOCK — anatomia não catalogada = inventada. Retorne à Etapa 2 para curadoria formal."
    closes_gap: "G15 (PACER vs FAFAC sem reconciliação)"

  - id: anatomia-secoes-completas
    check: "Todas as seções exigidas pela anatomia estão preenchidas e não-vazias"
    type: blocking
    validation: |
      Para cada seção declarada pela anatomia em biblioteca-anatomias.md:
        - presente no prompt: SIM
        - conteúdo não-vazio (não placeholder, não 'TBD', não '...'): SIM
    veto_if_fail: "BLOCK — seção vazia/placeholder. Volta à Etapa 4 (prompt-writer) com lista de seções faltantes."

  - id: fewshot-minimo
    check: "Quantidade de few-shot >= N_FEWSHOT_MIN quando a anatomia exige"
    type: blocking
    validation: |
      Se a anatomia inclui few-shot como seção obrigatória:
        count(few_shot_examples) >= N_FEWSHOT_MIN
        (N_FEWSHOT_MIN definido em workflows/prompt-engineering-pipeline.yaml > parameters; valor inicial: 5)
    veto_if_fail: "BLOCK — few-shot insuficiente. Adicione exemplos até atingir N_FEWSHOT_MIN."
    note: "Valor é placeholder versionado no workflow. Revisar em uso real."

  - id: saida-estruturada-especificada
    check: "Formato de saída declarado e validável"
    type: blocking
    validation: |
      O prompt declara EXPLICITAMENTE o formato de output (ex: JSON com schema,
      tags TESS específicas, estrutura de campos nomeados). Não basta dizer
      'responda de forma organizada' — precisa ser validável programaticamente
      OU por critério booleano objetivo.
    veto_if_fail: "BLOCK — saída estruturada ausente ou ambígua. Sem saída validável, eval não pode pontuar (G10/G11)."

  - id: restricoes-escalonamento-presentes
    check: "Restrições operacionais e regra de escalonamento declaradas"
    type: blocking
    validation: |
      O prompt contém:
        (a) o que o agente NÃO deve fazer (restrições explícitas)
        (b) condição/gatilho para escalar a humano (escalonamento)
    veto_if_fail: "BLOCK — agente sem restrições é agente sem guardrails. Volta à Etapa 4."

  - id: vocabulario-proibido-ausente
    check: "Nenhuma ocorrência de vocabulário proibido (per voice-dna + per anatomia)"
    type: blocking
    validation: |
      Para cada termo em (voice_dna_squad.never_use UNION anatomia.never_use):
        grep -i '{termo}' no conteúdo do prompt OU em few-shot examples
      Resultado esperado: ZERO ocorrências.
    veto_if_fail: "BLOCK — qualquer ocorrência = VETO. Lista os termos encontrados + linha/contexto. Volta à Etapa 4."

  - id: motivo-declarado-presente
    check: "Motivo declarado da versão presente (para versões > 1)"
    type: blocking
    validation: |
      Se prompt_version > 1:
        existe entrada no changelog OU header do prompt declarando
        POR QUE essa versão substitui a anterior (texto não-vazio,
        não placeholder).
    veto_if_fail: "BLOCK — sem motivo declarado, a versão não é rastreável. Volta à Etapa 9 (gate humano) para registro."
    note: "Versão 1 (primeira) está isenta — não há versão anterior para justificar."
    closes_gap: "G5 (reports não declaram motivo)"
```

---

## Recommended Items — warning, não bloqueia

```yaml
recommended:

  - id: anatomia-tem-exemplos
    check: "A anatomia selecionada tem >= 3 exemplos de uso registrados na biblioteca"
    type: recommended
    validation: |
      Em data/biblioteca-anatomias.md, a entrada da anatomia lista
      pelo menos 3 prompts reais (rastreáveis) que a aplicaram.
    warning_if_fail: "WARN — anatomia com poucos exemplos é decisão arriscada. Sinalize ao prompt-methodology-curator para enriquecer a biblioteca."

  - id: fewshot-cobre-edge-cases
    check: "Few-shot cobrem casos-limite, não apenas happy path"
    type: recommended
    validation: |
      Pelo menos 1 exemplo few-shot demonstra:
        - input ambíguo/incompleto, OU
        - usuário pedindo coisa fora do escopo, OU
        - resposta que aciona escalonamento
    warning_if_fail: "WARN — few-shot só com happy path leva a degradação em produção. Recomende ao prompt-writer cobrir 1+ edge case."

  - id: trip-wire-auto-validacao
    check: "Trip-wire de auto-validação declarado no prompt"
    type: recommended
    validation: |
      O prompt contém instrução explícita de auto-checagem antes de responder,
      no estilo "antes de enviar, valide: (1) X, (2) Y, (3) Z".
    warning_if_fail: "WARN — sem trip-wire, o agente não tem mecanismo de auto-correção. Recomende ao prompt-writer adicionar."
```

---

## Final Score

```yaml
final_score:
  compute: |
    blocking_pass_count = count(blocking items where status == PASS)
    blocking_total = count(blocking items)
    recommended_pass_count = count(recommended items where status == PASS)
    recommended_total = count(recommended items)

    blocking_pct = blocking_pass_count / blocking_total
    recommended_pct = recommended_pass_count / recommended_total

  decision:
    - verdict: PASS
      condition: "blocking_pct == 1.0 AND recommended_pct >= 0.70"
      action: "Avança para etapa_6_rodar_eval"

    - verdict: CONCERNS
      condition: "blocking_pct == 1.0 AND recommended_pct < 0.70"
      action: "Avança para etapa_6_rodar_eval, MAS registra warnings no eval_report para acompanhamento"

    - verdict: FAIL
      condition: "blocking_pct < 1.0"
      action: "Retorna à etapa_4_redigir_prompt (prompt-writer) com lista de blocking items que falharam. Não avança."

  reporting_format: |
    ## Quality Gate Report — prompt {prompt_id} v{N}

    **Verdict:** PASS | CONCERNS | FAIL

    ### Blocking
    | id | status | note |
    |---|---|---|
    | anatomia-catalogada | ✅ PASS | — |
    | anatomia-secoes-completas | ❌ FAIL | seção "Restrições" vazia |
    | fewshot-minimo | ✅ PASS | 6 exemplos (>= 5) |
    | saida-estruturada-especificada | ✅ PASS | JSON schema declarado |
    | restricoes-escalonamento-presentes | ✅ PASS | — |
    | vocabulario-proibido-ausente | ❌ FAIL | "conforme necessário" em few-shot #3 |
    | motivo-declarado-presente | ✅ PASS | — |

    ### Recommended
    | id | status | note |
    |---|---|---|
    | anatomia-tem-exemplos | ✅ PASS | 4 exemplos na biblioteca |
    | fewshot-cobre-edge-cases | ⚠️ WARN | só happy path |
    | trip-wire-auto-validacao | ✅ PASS | — |

    **Ação:** retornar à Etapa 4 com 2 blocking falhos.
```

---

## Notes for the Evaluator

```yaml
notes:
  - "Esta checklist é AUTORITATIVA quando carregada pelo prompt-evaluator via *quality-gate. NÃO improvise critérios fora desta lista."
  - "Valores N (N_FEWSHOT_MIN etc.) vivem em workflows/prompt-engineering-pipeline.yaml > parameters. Se mudar, atualize lá — não aqui."
  - "Vocabulário proibido = união de voice-dna-squad.never_use (sempre) + anatomia.never_use (se a anatomia define). Não use vocabulário proibido de outras anatomias."
  - "Eval (Etapa 6) NÃO substitui este gate. Eval pontua comportamento; gate valida estrutura. Os dois rodam em série, não em alternativa."
  - "Se uma seção exigida pela anatomia faz sentido estar vazia em um caso específico, a anatomia precisa ser atualizada (escalar ao prompt-methodology-curator). Não relaxe o gate para acomodar exceção não documentada."

closes_gaps:
  - "G10 — metodologia agora é processo gateado (Etapa 5 com critério verificável)"
  - "G11 — gate específico para prompt conversacional (não persona-agente AIOX)"
```

---

*prompt-quality-gate v0.1.0 — FASE 3 do structure-pipeline (@pedro-valerio orquestrando). Carregada pelo prompt-evaluator no comando `*quality-gate` (Etapa 5 do prompt-engineering-pipeline). Forma modelada em .aiox-core/development/checklists/agent-quality-gate.md; conteúdo específico para PROMPT, não para AGENTE AIOX.*
