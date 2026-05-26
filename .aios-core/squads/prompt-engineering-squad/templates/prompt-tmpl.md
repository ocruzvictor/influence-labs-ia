# Prompt — Template (parametrizável por anatomia)

**Versão do template:** `v0.1.0`
**Owner do preenchimento:** `prompt-writer` (etapas 4 e 8 do workflow)
**Consumidores:** `prompt-evaluator` (etapas 5/6/7), `prompt-release-manager` (etapa 10)

> Template **agnóstico de anatomia**. A anatomia selecionada na etapa 2 (PACER, FAFAC, outra catalogada em `data/biblioteca-anatomias.md`) define quais seções aparecem em **§3 — Seções da anatomia**. As demais (§1, §2, §4, §5, §6) são fixas e independem da anatomia.

---

## 1. Cabeçalho (fixo)

- **id_prompt:** `{{ID_PROMPT}}` (do briefing — mesmo slug)
- **versao:** `{{vMAJOR.MINOR.PATCH}}` (ex: `v2.1.0`)
- **anatomia:** `{{ANATOMIA}}` (id da biblioteca — ex: `pacer`, `fafac`)
- **agente_destino:** `{{DESTINO}}` (ex: TESS 44853 · OpenAI Assistant X · n8n flow Y)
- **data:** `{{YYYY-MM-DD}}`
- **motivo_da_versao:** `{{UMA_FRASE}}` (ex: "adiciona ancoragem em R$ Treinamento 2 §199-219")
  > Este motivo será reescrito formalmente no `changelog-versao-tmpl.md` na etapa 9. Aqui é o snapshot da intenção.

---

## 2. Briefing referenciado (rastreabilidade)

- **briefing_path:** `{{PATH_DO_BRIEFING}}`
- **fontes_curadas_ref:** `{{PATH_DAS_FONTES_CURADAS}}` (output da etapa 3)
- **anatomia_versao:** `{{VERSAO_DA_ANATOMIA_NA_BIBLIOTECA}}` (ex: `pacer-1.0`)

> Sem briefing referenciado, etapa 5 bloqueia (sem rastreabilidade não há gate).

---

## 3. Seções da anatomia (variável)

> **Instrução de preenchimento:** copie aqui, na ordem definida pela anatomia, **uma seção por letra/elemento**. Para cada elemento da anatomia, inclua:
> - **nome do elemento** (da anatomia — ex: `P — Persona`, `F — Função`)
> - **conteúdo preenchido** (substantivo, não placeholder)
>
> **Veto:** qualquer seção da anatomia vazia → etapa 4 bloqueia (workflow `veto_conditions`).

### Padrão para anatomia `pacer`

```
### P — Persona
{{CONTEUDO_PERSONA}}

### A — Action (Ação)
{{CONTEUDO_ACAO}}

### C — Context
{{CONTEUDO_CONTEXTO}}
> Inclui mecanismo de injeção dinâmica (ex: developer role, variáveis {{VAR}}).

### E — Examples (Few-shot)
> Ver §5 deste template — few-shot vive numa seção fixa por exigência do workflow.

### R — Restrictions
{{CONTEUDO_RESTRICOES}}
> Inclui regras de escalonamento. Sem escalonamento → veto na etapa 5.
```

### Padrão para anatomia `fafac`

```
### F — Função
{{CONTEUDO_FUNCAO}}

### A — Ação
{{CONTEUDO_ACAO}}

### F — Formato (Saída)
> Ver §4 deste template — saída estruturada vive numa seção fixa por exigência do workflow.

### A — Alertas (restrições + escalonamento)
{{CONTEUDO_ALERTAS}}

### C — Contexto
{{CONTEUDO_CONTEXTO}}
```

### Para qualquer outra anatomia catalogada

Reproduza o conjunto de elementos declarados em `data/biblioteca-anatomias.md` → entrada da anatomia selecionada → campo `secoes`. Uma seção por elemento. Mesma regra de veto.

---

## 4. Saída estruturada (fixo)

> Formato declarado de output do agente. Linguagem **imperativa**. Validável (parser determinístico).

- **formato:** `{{FORMATO}}` (ex: tags inline `[ESTADO:...] [SCORE:...]` no fim · JSON · texto livre + envelope)
- **campos obrigatórios:** `{{LISTA}}` (ex: `[ESTADO]`, `[SCORE]`, `[CLASSIFICACAO]`, `[MATERIAL]`, `[HANDOFF]`)
- **ordem:** `{{ORDEM}}` (ex: "ordem exata, uma tag por linha, no fim da resposta")
- **regra de violação:** `{{O_QUE_QUEBRA}}` (ex: "esquecer um campo quebra o painel de inteligência comercial")

**Bloco de instrução para o modelo (copiar literal no prompt):**

```
SAÍDA OBRIGATÓRIA — NUNCA OMITIR. Ao final de TODA resposta, emita as tags na
ordem exata abaixo. Esquecer um campo é falha crítica.

{{BLOCO_DE_INSTRUCAO_DE_SAIDA}}
```

> Sem saída estruturada especificada → veto na etapa 5 (`veto_conditions: BLOCK se saída estruturada não especificada`).

---

## 5. Few-shot (fixo)

> Exemplos `input → output`. Mínimo de exemplos definido no workflow (`N_FEWSHOT_MIN`, hoje = 5).
> Cobrir **casos-limite** declarados nos critérios de sucesso do briefing (§8 do briefing) — não exemplos genéricos.

### Exemplo 1 — `{{NOME_DO_CENARIO_1}}`

```
INPUT (lead): {{MENSAGEM_DO_LEAD}}

OUTPUT (agente): {{RESPOSTA_IDEAL_COMPLETA_COM_TAGS}}
```

### Exemplo 2 — `{{NOME_DO_CENARIO_2}}`

```
INPUT: {{...}}
OUTPUT: {{...}}
```

### Exemplo 3 — `{{NOME_DO_CENARIO_3}}`

(... repita até atingir `N_FEWSHOT_MIN` ...)

> Few-shot < `N_FEWSHOT_MIN` quando a anatomia exige → veto na etapa 4.

---

## 6. Trip-wire (auto-validação antes de enviar)

> Checklist mental que o agente executa **antes** de cada resposta. Linguagem imperativa, curta, em primeira pessoa.

**Bloco de instrução para o modelo (copiar literal no prompt):**

```
ANTES DE ENVIAR, REVISE (checklist INVIOLÁVEL):

[ ] {{CHECK_1}}   (ex: emiti TODAS as tags de saída na ordem exata?)
[ ] {{CHECK_2}}   (ex: usei apenas vocabulário de marca — "Roteiro" não "itinerário", "Proposta" não "orçamento"?)
[ ] {{CHECK_3}}   (ex: respeitei as restrições — sem preço, sem confirmar vaga?)
[ ] {{CHECK_4}}   (ex: identifiquei corretamente B2B/Alhurez e apliquei o escalonamento certo?)
[ ] {{CHECK_5}}   (ex: minha resposta termina com pergunta aberta OU fechamento de handoff válido?)

Se algum check falhar, reescreva antes de emitir.
```

> Mínimo: 3 checks. Recomendado: 5+. Sem trip-wire → não é veto formal, mas registra-se em `quality_gate_report` como ⚠️ — recomendação forte do squad.

---

*Template scaffold da FASE 3 — `prompt-engineering-squad` v0.1.0. Estrutura agnóstica de anatomia; seções fixas (§1, §2, §4, §5, §6) preservam gates do workflow.*
