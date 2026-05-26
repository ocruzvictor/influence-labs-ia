# Biblioteca de Anatomias de Prompt

**Versão:** `v0.1.0`
**Owner:** `prompt-methodology-curator` (via `*curadoria-continua` — processo contínuo do workflow)
**Consumida por:** `*selecionar-anatomia` (etapa 2 do workflow) e `prompt-writer` (etapa 4)
**Decisão fundadora:** D7 do design doc — a metodologia NÃO é fixa; o PACER é UMA anatomia catalogada, não constante implícita do processo.

> Catálogo de anatomias de prompt indexadas por **tipo de objetivo**. Cada anatomia é uma estrutura formal preenchível, com origem rastreável e evidência de eficácia. v0.1.0 nasce semeada com **PACER** e **FAFAC**.
>
> **Veto:** anatomia escolhida na etapa 2 que não está catalogada aqui (e não foi formalmente adicionada com pesquisa) → bloqueia o workflow.

---

## Como ler uma entrada

Cada anatomia segue o schema declarado em §4 (entrada padrão para adição futura). Os campos são obrigatórios; entrada parcial é rejeitada na curadoria.

---

## Anatomia 1 — `pacer`

```yaml
id: pacer
versao: "1.0"
origem:
  declarada: "Importada do projeto influence-labs-ia / Studio Tirra"
  fonte_no_repo: "docs/prompt-engineering/framework-pacer.md"
  fonte_de_formacao: "raw-materials/kb-formacao-ia/3_framework_pacer_prompts.pdf"
  ressalva: |
    Os arquivos `docs/prompt-engineering/framework-pacer.md` e
    `docs/prompt-engineering/referencia-*` ainda estão literalmente escritos
    para "Agentes do Salão" (Studio Tirra). Esta catalogação reconhece a
    anatomia, NÃO valida o conteúdo dos exemplos como aplicável ao
    Studio Tirra (gap G14 do insumo).

tipos_de_objetivo_recomendados:
  - "agente conversacional consultivo (Tipo 4) com escalonamento humano"
  - "qualificação de lead com saída inline estruturada"
  - "atendimento com persona forte + restrições/escalonamento explícitos"

secoes:
  - letra: "P"
    nome: "Persona"
    o_que_preencher: "quem é o agente — tom, personalidade, função, nome (se houver)"
  - letra: "A"
    nome: "Action"
    o_que_preencher: "o que faz — missão, KPIs, prioridades, anti-objetivos"
  - letra: "C"
    nome: "Context"
    o_que_preencher: "dados injetados dinamicamente; mecanismo de injeção (developer role, {{VAR}})"
  - letra: "E"
    nome: "Examples"
    o_que_preencher: "few-shot input→output (cobrem casos-limite, não genéricos)"
  - letra: "R"
    nome: "Restrictions"
    o_que_preencher: "o que NÃO fazer; regras de escalonamento; vocabulário banido"

quando_usar:
  - "Tipo 4 com persona consultiva e handoff humano (SDR, atendimento premium)"
  - "Quando há restrições de marca/compliance fortes que exigem bloco R dedicado"
  - "Quando o contexto dinâmico é central (CRM, histórico, slot do lead)"

quando_NAO_usar:
  - "Agente Tipo 2 (event-triggered) sem turno conversacional — usar anatomia event-handler quando catalogada"
  - "Classificador puro com saída estritamente JSON sem persona — usar FAFAC (Formato é pilar de 1ª ordem) ou anatomia router quando catalogada"
  - "Prompts muito curtos (<200 tokens) onde a estrutura de 5 blocos vira overhead"

exemplos_em_producao:
  - path: "docs/knowledge-base/sdr-prompt-context.md"
    nota: "v1 — PACER aplicado ao SDR Studio Tirra (671 linhas)"
  - path: "docs/knowledge-base/sdr-prompt-v2-tess-ready.md"
    nota: "v2 — PACER + pilares FAFAC (saída estruturada + 6 few-shot)"
  - path: "docs/prompt-engineering/referencia-agente-atendimento.md"
    nota: "exemplo PACER do Studio Tirra (escopo salão — referência, não Studio Tirra)"

evidencia_de_eficacia:
  - "Prompt SDR v6 atingiu 12/13 PASS em sdr-eval (registro: feedback_prompt_engineering.md:116)"
  - "Reutilização cross-scope comprovada: mesma anatomia aplicada em Studio Tirra (salão de beleza) e Studio Tirra (turismo de aventura)"

notas:
  - "PACER e FAFAC são a mesma anatomia com nomes diferentes — ver §3 'Convivência PACER ↔ FAFAC' abaixo"
```

---

## Anatomia 2 — `fafac`

```yaml
id: fafac
versao: "1.0"
origem:
  declarada: "Importada do guia TESS Creator"
  fonte_no_repo: "raw-materials/kb-formacao-ia/TESS CREATOR - Guia Criação de Prompts.pdf"
  fonte_secundaria: "docs/knowledge-base/sdr-prompt-v2-tess-ready.md (pilares FAFAC adotados em produção via TESS)"

tipos_de_objetivo_recomendados:
  - "agente conversacional Tipo 4 deployado em TESS Studio"
  - "qualquer agente que exija pilar 'Formato' (saída estruturada) como cidadão de 1ª ordem do prompt"
  - "agente onde 'Alertas' (restrições + escalonamento) merecem bloco dedicado e nomeado"

secoes:
  - letra: "F"
    nome: "Função"
    o_que_preencher: "papel funcional do agente (o que ele É) — equivalente a Persona+Action condensado"
  - letra: "A"
    nome: "Ação"
    o_que_preencher: "o que faz, passo a passo; prioridades"
  - letra: "F"
    nome: "Formato"
    o_que_preencher: "saída estruturada declarada com linguagem imperativa (NUNCA OMITIR, SEMPRE, ordem exata)"
  - letra: "A"
    nome: "Alertas"
    o_que_preencher: "restrições + escalonamento + erros críticos proibidos"
  - letra: "C"
    nome: "Contexto"
    o_que_preencher: "dados/variáveis injetadas; janela de contexto; RAG quando aplicável"

quando_usar:
  - "Deploy em TESS Studio (o guia é da própria plataforma)"
  - "Quando o ganho de tratar Formato como pilar (não sub-item de Restrições) for relevante"
  - "Quando há ambiguidade no PACER sobre onde escalonamento vive (em FAFAC, está em Alertas — claro)"

quando_NAO_usar:
  - "Agente sem persona forte mas com tom/marca críticos — PACER deixa Persona mais visível"
  - "Quando exemplos few-shot são o centro do prompt (PACER tem E como pilar; FAFAC os esconde em Contexto)"

exemplos_em_producao:
  - path: "docs/knowledge-base/sdr-prompt-v2-tess-ready.md"
    nota: "v2 do SDR adotou explicitamente 'instrução de saída estruturada OBRIGATÓRIA + 6 few-shot' (pilar Formato + Exemplos do FAFAC)"

evidencia_de_eficacia:
  - "Pilar Formato adotado no v2 TESS-ready: 5 sinais inline (`[ESTADO]` `[SCORE]` `[CLASSIFICACAO]` `[MATERIAL]` `[HANDOFF]`) com regra explícita 'esquecer um sinal quebra o painel de inteligência comercial'"
  - "6 few-shot dedicados no v2 cobrem casos-limite (msg vaga, ancoragem, B2B, Alhurez, objeção, perfil definido)"

notas:
  - "FAFAC e PACER mapeiam 1:1 (ver §3). A escolha entre os dois é estilística + de destino (TESS Studio favorece FAFAC)"
```

---

## 3. Convivência PACER ↔ FAFAC (resolve G15)

PACER e FAFAC são a **mesma anatomia** com acrônimos diferentes. Tabela de equivalência:

| PACER | FAFAC | Observação |
|---|---|---|
| **P** — Persona | **F** — Função | FAFAC condensa Persona+Ação em "Função"; PACER mantém Persona como bloco dedicado. |
| **A** — Action | **A** — Ação | Equivalência direta. |
| **C** — Context | **C** — Contexto | Equivalência direta. PACER às vezes mistura contexto dinâmico (developer role) e estático; FAFAC tende a tratar como contexto único. |
| **E** — Examples | *(implícito em Contexto)* | PACER torna Few-shot pilar de 1ª ordem; FAFAC trata como técnica dentro de Contexto. Quando o prompt depende fortemente de few-shot, PACER deixa isso visível. |
| **R** — Restrictions | **A** — Alertas | FAFAC separa "Alertas" como bloco nomeado (mais claro para escalonamento); PACER agrupa restrições e escalonamento sob R. |
| *(implícito em Restrictions)* | **F** — Formato | FAFAC promove "Formato" (saída estruturada) a pilar; PACER trata como sub-item de Restrições. Quando saída estruturada é crítica, FAFAC deixa isso visível. |

**Critério de escolha entre as duas (recomendação do squad v0.1.0):**

- Se persona/tom de marca é central → **PACER**
- Se saída estruturada/integração TESS é central → **FAFAC**
- Se ambos são centrais → ainda **PACER** (a v2 do SDR é PACER com pilares FAFAC sobrepostos — convivência funcional comprovada em produção)

> Esta tabela fecha o G15 do insumo ("dois nomes para a mesma anatomia coexistem sem reconciliação documentada"). Agora coexistem **com reconciliação**.

---

## 4. Schema de entrada (para adicionar uma anatomia nova)

> Toda anatomia nova entra na biblioteca pelo `prompt-methodology-curator` via `*curadoria-continua`. **Pesquisa rastreável é requisito**.

```yaml
id: "{{slug-curto}}"                                 # ex: chain-of-thought, react, role-action-restriction
versao: "{{MAJOR.MINOR}}"

origem:
  declarada: "{{Fonte primária — autor, paper, plataforma, projeto importado}}"
  fonte_no_repo: "{{path se já replicada}}"          # OU
  fonte_externa_url: "{{URL com data de acesso}}"
  fonte_de_formacao: "{{path para material formativo se existir em raw-materials/}}"
  ressalva: "{{Limitações de escopo da fonte — ex: 'escrita para o salão Tirra'}}"

tipos_de_objetivo_recomendados:
  - "{{tipo 1 — usar léxico canônico, não invenção}}"
  - "{{tipo 2}}"

secoes:
  - letra: "{{X}}"
    nome: "{{Nome do elemento}}"
    o_que_preencher: "{{instrução curta e operacional}}"
  # repetir para cada elemento

quando_usar:
  - "{{critério positivo 1}}"
  - "{{critério positivo 2}}"

quando_NAO_usar:
  - "{{anti-uso 1 — onde a anatomia falha ou vira overhead}}"
  - "{{anti-uso 2}}"

exemplos_em_producao:
  - path: "{{path no repo OU 'nenhum ainda — anatomia teórica'}}"
    nota: "{{descrição}}"

evidencia_de_eficacia:
  - "{{evidência qualitativa OU quantitativa — score, paper, A/B test}}"
  - "{{se 'nenhuma ainda', declarar — não inventar}}"

notas:
  - "{{notas opcionais — convivência com outras anatomias, conflitos conhecidos}}"
```

### Regras para adicionar uma anatomia

1. **Pesquisa antes de catalogar.** Sem fonte primária rastreável (paper, doc oficial, projeto importado), a curadoria é rejeitada.
2. **Não duplicar.** Se a anatomia proposta é PACER/FAFAC com nome novo, atualize a tabela de equivalência em §3 — não crie entrada redundante.
3. **Declarar evidência de eficácia ou ausência dela.** "Nenhuma ainda — anatomia teórica" é resposta válida; inventar score é veto.
4. **Sem cópia de outro escopo sem localização.** Se importar do Studio Tirra ou de outro cliente, declarar a ressalva explícita (como feito em PACER).

---

## 5. Governança

- **Mantenedor:** `prompt-methodology-curator` via `*curadoria-continua`.
- **Trigger de revisão:** periódico, surgimento de tipo de objetivo novo, avanço relevante em engenharia de prompt (do workflow, `continuous_processes.curadoria_metodologia.trigger.conditions`).
- **Versionamento desta biblioteca:** SemVer por arquivo. v0.1.0 cobre PACER + FAFAC; v0.2.0+ acrescenta anatomias adicionais.
- **Auditoria:** o `prompt-evaluator` consulta esta biblioteca na etapa 2 para validar se a anatomia escolhida está catalogada — sem entrada aqui, veto.

---

*Biblioteca scaffold da FASE 3 — `prompt-engineering-squad` v0.1.0. PACER + FAFAC catalogados; schema de adição definido; convivência reconciliada (fecha G15).*
