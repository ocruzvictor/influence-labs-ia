# Metodologia Syncra — Referência Operacional

> **Nome canônico:** Syncra  
> **Variantes nas fontes:** Synkra, Síncra, Sinncra (mesma linha metodológica; normalizar como **Syncra** neste squad)

**Fontes:** 5 Google Docs analisados em 2026-09-08 — ver `docs/intake/pedro-metodologia/README.md`

**Escopo deste documento:** L0–L3 (Identidade → Estratégico → Tático → Operacional). Complementa `system-patterns.md` (padrões técnicos AIOX) sem substituí-lo.

---

## 1. Filosofia central

### Sincronização (não só automação)

O objetivo não é substituir pessoas por máquinas, mas **sincronizar** humano + agente + worker. A IA é um novo tipo de executor — não um "humano mais rápido". Sem processos claros, a IA parece ameaça; com arquitetura precisa, gera eficiência desproporcional.

**Mantra:** *Se não está no sistema, não aconteceu.*

### Redução de Cliques

Métrica de sucesso = quanto **menos** o humano interage com tarefas burras para produzir output de alta qualidade. Cada clique em tarefa sem julgamento é imposto direto sobre margem e valor-hora.

### Metáfora do Martelo

- **IA executa; humano assina.** Accountability é inalienável.
- Você não culpa o martelo por acertar o dedo — culpa quem desferiu o golpe ou quem deu input errado.
- Se o agente alucina, a falha está na **Migalha de Pão** (contexto), não na ferramenta.

---

## 2. Hierarquia L0–L3 (Herança de DNA)

Adotamos **L0–L3** (doc *Plano de Reestruturação → Operação Síncra*) como modelo canônico. Docs mais antigos usam L0–L2; mapeamento:

| Camada | Nome | Função | Herança |
|--------|------|--------|---------|
| **L0** | Identidade | DNA imutável: cultura, tom de voz, premissas, credenciais | Fonte da Verdade — evita alucinação |
| **L1** | Estratégico | ICP, catálogo, ofertas core, posicionamento | Herda L0 |
| **L2** | Tático | Orquestração, setup, configuração de entidades, Spawn | Herda L0 + L1 |
| **L3** | Operacional | Execução, entrega, Serial Killer de Tasks | Herda L0 + L1 + L2 |

**Regra de Herança de DNA:** alteração no L0 propaga para L1–L3 sem re-briefing manual. Tom de voz no DNA → agente no L3 ajusta redação automaticamente.

**Legado L0–L2 (docs 1–3):** L0=Estratégico, L1=Tático, L2=Operacional ≈ nosso L1, L2, L3 respectivamente (L0 Identidade é expansão do doc 4).

---

## 3. Migalhas de Pão (Fingerprints)

Metáfora de João e Maria: rastro mínimo de contexto para guiar o próximo executor (humano ou IA).

| Situação | Efeito |
|----------|--------|
| Migalha **longe demais** | Executor perde conexão lógica → alucinação ou output genérico |
| Migalha = **pão inteiro** | Sobrecarga cognitiva (briefing 20p sem filtro) → mediocridade |
| **Sweet spot** | Input tratado, exato para aquela etapa |

### Checklist de Migalhas (Fingerprints)

Para cada handoff entre etapas, declarar explicitamente:

1. **Formato do output** — ex.: vídeo 9×16, 30s; markdown com tabelas RACI
2. **Regras de legenda / conteúdo** — proibições, termos técnicos
3. **Tom de voz** — DNA L0 aplicado ao artefato
4. **Regras de marca** — paleta, tipografia, nomenclatura

Ver checklist operacional: `checklists/fingerprint-checklist.md` → comando `*fingerprint-check`.

---

## 4. Entidade nasce-e-morre

### Entidade

Objeto central de acompanhamento (Projeto, Criativo, Contrato). **Coração da operação.**

**Regras de ouro:**

1. **Nasce e morre em uma única lista** — centralizada; anti *Google Drive Trap* (pastas dentro de pastas)
2. **Não se move entre telas** — context switching custa 30–60 min/dia de produtividade
3. **Artefato** = output tangível gerado pela entidade (vídeo, NF, cópia, task file)

### Serial Killer de Tasks

Não acumular pendências — **matar** cada entidade movendo-a com velocidade por status claros até conclusão. Recusar estagnação no backlog (*Cemitério de Tarefas*).

**Fluxo linear:**

```
Input (Briefing) → Processamento (status intermediários) → Execução Final (morte/entrega)
```

Todo registro vai ao **Journey Log** (Fingerprints / Johnny Log) — única fonte da verdade do que aconteceu.

---

## 5. Executores: Worker vs Agente vs Humano

| Papel | Executa | Responsabilidade | Exemplos |
|-------|---------|------------------|----------|
| **Worker (Script)** | Tarefas 100% determinísticas | Zero julgamento | Normalizar briefing (campos fixos), regex, ETL |
| **Agente (IA)** | Tarefas generativas / triagem | Orquestração, volume | Briefing Guardian, Decupador Técnico, Processer |
| **Humano** | Criatividade, estratégia, assinatura | **Accountability** | Julgamento ético/estético, decisão final |
| **Híbrido** | IA gera base, humano refina | Colaboração assistida | Análise briefing: IA triagem + humano valida tom |

**Regra de Ouro:** IA executa, humano assina. Humano só acionado para tarefas que exigem criatividade, empatia e autoridade.

**Super Agentes (referência Syncra):**

- **Briefing Guardian** — normaliza input bruto antes de humano tocar
- **Decupador Técnico** — triagem técnica de materiais brutos
- **Processer** — converte caos humano em estruturas L2/L3

**Executor Decision Tree** (já no agente): determinístico → Worker; julgamento/NL → Agent; parcial → Hybrid.

---

## 6. Ciclo de vida da Task

Estados obrigatórios (doc *Plano de Transição Sinncra*):

1. **Infinitivo** — verbo planejado (*Mapear processo*)
2. **Gerúndio** — executando (*Mapeando processo*) — tira entidade do limbo
3. **Passado** — concluído (*Processo mapeado*) — output validado

Nada acontece fora de uma Task; nenhuma Task sem propósito mapeado.

---

## 7. Tarefas "D" (burras / burocráticas)

Atividades a **extirpar** da rotina humana:

- Criar pastas no Drive
- Vincular links em planilhas
- Copiar/colar entre plataformas (Control C + Control V)
- Buscar arquivos em silos dispersos

São o "câncer financeiro" da operação. Delegar a agentes/workers.

Auditoria: `checklists/task-d-audit.md` → comando `*task-d-audit`.

---

## 8. A Forja (Elicitação → Audit → Gold Standard → Skills)

Ciclo para transformar processo manual em Skill executável (AIOX Cockpit / API):

| Fase | Objetivo |
|------|----------|
| **1. Elicitação** | Extrair conhecimento tácito via perguntas certas (agentes consultivos) |
| **2. Investigação / Audit** | Auditar arquivos e logs — como o trabalho **realmente** flui |
| **3. Gold Standard Research** | Se processo desconhecido/ineficiente, IA descobre padrões de mercado como base |
| **4. Construção de Skills** | Codificar orquestração para execução autônoma |

Não buscamos processo perfeito — buscamos **Verdade Atual** verificável.

---

## 9. Spawn / Inheritance / Execução Condicional

**Spawn:** entidade tática gera automaticamente N entidades operacionais a partir de variável de configuração.

- *Case Magalu/BBB:* variável "número de criativos" no L2 tático → **851 entidades** operacionais configuradas via Spawn + Inheritance.

**Inheritance (Herança):** atributos do projeto (ex.: Account responsável) replicam para todos os filhos operacionais.

**Execução Condicional:** tarefas (ex.: benchmarking) só disparam se módulo ativo no nível tático (ex.: módulo "Remix").

---

## 10. Journey Log e governança

- **Journey Log / Fingerprints / Johnny Log:** registro irremediável de cada ação na entidade
- **Dogma operacional:** *Se não está no ClickUp/sistema, não aconteceu*
- Fingerprints servem **analytics de produtividade**, não vigilância — identificar se falha foi processo (migalha) ou executor
- Abolir WhatsApp/e-mail para comunicação operacional — tudo gera log rastreável

---

## 11. Benchmarks de referência (Fluence / Alfluence)

Implementação real citada nas fontes — usar como âncora, não promessa:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Abertura de projeto | 45 min | 3 min |
| Análise de briefing | 3 h | 3 min |
| Triagem casting/candidatos | 3 dias | 4 h |
| Economia anual | — | ~5.000 h |
| Escala time | 42 → 25 espartanos | vs. concorrentes 200–500 |

---

## 12. Integração com este squad (L4 operacional)

| Conceito Syncra | Artefato no squad |
|-----------------|-------------------|
| Migalhas / Fingerprints | `checklists/fingerprint-checklist.md`, `*fingerprint-check` |
| Tarefas D | `checklists/task-d-audit.md`, `*task-d-audit` |
| L0–L3 + Herança | Este doc + `*eng-map`, `*arq-structure` |
| Checkpoints + veto | `checklists/veto-checklist.md`, `*veto-check` |
| Verdade Sistêmica | Identity Core do agente |
| TRIO FASE 2 | `workflows/structure-pipeline.yaml` |
| Forja | Fase opcional futura no pipeline (não bloqueia v1.1.0) |

**Nota factory vs L4:** `squads/squad-creator-pro/` é camada **factory** (brownfield upgrade). Esta pasta é **L4 operacional** — Pedro em produção no Studio Tirra / TRIO AIOX.

---

## Glossário rápido

| Termo | Definição |
|-------|-----------|
| Syncra | Metodologia de sincronização humano × IA × worker |
| Entidade | Objeto central com ciclo de vida (nasce → morre) |
| Artefato | Entregável tangível |
| Migalha de Pão | Contexto mínimo suficiente para próximo executor |
| Gap de Tempo | Custo cognitivo de troca de aba/tela/handoff sem prazo |
| Tarefa D | Tarefa burra/burocrática — candidata a automação |
| Forja | Ciclo de 4 fases para codificar processo em Skill |
| Spawn | Geração automática de entidades filhas a partir de config tática |
