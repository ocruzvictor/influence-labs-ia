# Briefing de Prompt — Template

**Versão do template:** `v0.1.0`
**Owner do preenchimento:** `prompt-briefer` (etapa 1 do workflow)
**Consumidores:** `prompt-methodology-curator` (etapa 2), `prompt-writer` (etapa 4)

> Briefing é o pacote de requisitos do prompt. Sem campo preenchido, sem avanço.
> Nota: **campos sem default → veto na etapa 1**. Solicitante recebe de volta com a lista do que falta.

---

## 1. Identificação

- **id_prompt:** `{{ID_PROMPT}}` (slug curto — ex: `sdr-flora-v3`, `router-tirra-v1`)
- **escopo/cliente:** `{{ESCOPO}}` (ex: `eco-adventure`, `studio-tirra`, `playground-test`)
- **solicitante:** `{{NOME_OU_PAPEL}}`
- **data_briefing:** `{{YYYY-MM-DD}}`
- **destino do prompt:** `{{DESTINO}}` (ex: agente TESS 44853, n8n flow X, openai api direta)

---

## 2. Tipo de agente

- **tipo:** `Tipo 4 — autônomo conversacional`
  > v0.1.0 cobre **apenas Tipo 4**. Tipo 2 (event-triggered) e Tipo 5 (multimodelo) estão deferidos. Outro tipo no briefing → veto na etapa 1.

---

## 3. Canal

- **canal_principal:** `{{CANAL}}` (ex: WhatsApp · web chat · voz · email)
- **plataforma:** `{{PLATAFORMA}}` (ex: TESS Studio · OpenAI Assistants · próprio)
- **modo de injeção:** `{{MODO}}` (ex: system prompt fixo + developer dinâmico · injeção total por turno)

---

## 4. Objetivo de negócio

- **objetivo:** `{{UMA_FRASE_MENSURAVEL}}`
  > Uma frase. Direta. Mensurável. Exemplos válidos: "qualificar leads de turismo de aventura e fazer handoff ao consultor com score BANT ≥ 6". Exemplos vetados: "ser um bom SDR" (não mensurável), "atender bem o cliente" (genérico).
- **kpi_principal:** `{{KPI}}` (ex: % leads com BANT correto · % handoffs aceitos pelo consultor)
- **anti_objetivo:** `{{O_QUE_NAO_PODE_ACONTECER}}` (ex: agente nunca informa preço; nunca confirma vaga)

---

## 5. Persona resumida

- **nome_persona:** `{{NOME}}` (ex: Flora · Vera · sem nome)
- **papel:** `{{PAPEL}}` (ex: consultora SDR · classificador de intenção · avaliador de qualidade)
- **tom:** `{{TOM}}` (ex: informal-acolhedor · técnico-formal · curto-imperativo)
- **público:** `{{PUBLICO_ALVO}}` (ex: viajantes acima de 35 anos · agências B2B · clientes premium)

---

## 6. Restrições conhecidas

> O que o agente **NÃO** deve fazer. Lista taxativa.

- `{{RESTRICAO_1}}` (ex: nunca informar preço em R$)
- `{{RESTRICAO_2}}` (ex: nunca confirmar disponibilidade de data)
- `{{RESTRICAO_3}}` (ex: nunca aplicar fluxo B2C a lead B2B identificado)
- **escalonamento:** `{{QUANDO_E_COMO}}` (ex: B2B → handoff imediato; Alhurez → consultor especializado; frustração detectada → humano)

---

## 7. Fontes esperadas

> Lista de POPs / docs / materiais que vão alimentar a curadoria (etapa 3). Fonte rastreável = referência verificável (path no repo, URL, arquivo controlado).

- `{{FONTE_1}}` (ex: `raw-materials/Treinamento-2-Jane.pdf` §199-219 — régua BANT oficial)
- `{{FONTE_2}}` (ex: `docs/knowledge-base/sales-pops.md` — POP 3 cadastro CRM)
- `{{FONTE_3}}` (ex: `docs/knowledge-base/conversation-patterns.md` — máquina de estados)
- `{{FONTE_N}}` ...

> Mínimo de fontes primárias definido em workflow (`N_FONTES_MIN`). Abaixo do mínimo → veto na etapa 3.
> Fonte de outro escopo/cliente sem localização explícita → veto.

---

## 8. Critérios de sucesso (entrada da etapa de eval)

> O que vai ser **medido** no eval (etapa 6). Cada critério deve virar cenário ou regra de evaluator.

- `{{CRITERIO_1}}` (ex: em cenário "pedido direto de preço", não emite valor em R$ e termina com pergunta aberta)
- `{{CRITERIO_2}}` (ex: em cenário B2B, identifica e faz handoff imediato sem aplicar diagnóstico B2C)
- `{{CRITERIO_3}}` (ex: vocabulário de marca respeitado — "Roteiro" não "itinerário", "Proposta" não "orçamento")
- `{{CRITERIO_N}}` ...

---

## 9. Notas livres (opcional)

`{{NOTAS}}`

---

*Template scaffold da FASE 3 — `prompt-engineering-squad` v0.1.0. Campos sem default não passam o gate da etapa 1.*
