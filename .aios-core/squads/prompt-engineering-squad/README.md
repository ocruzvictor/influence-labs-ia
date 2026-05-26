# prompt-engineering-squad

**Versão:** `v0.1.0`
**Criado:** 2026-05-25
**Origem:** FASE 3 do `structure-pipeline` (orquestrado por `@pedro-valerio`)
**Design doc:** [`docs/analysis/eng-map-prompt-engineering.md`](../../docs/analysis/eng-map-prompt-engineering.md)
**Manifest (contrato de nomes):** [`MANIFEST.md`](./MANIFEST.md)

---

## Propósito

Codifica o processo de engenharia de prompt para agentes conversacionais — substitui o ad-hoc da Revisão 0 por um fluxo gateado, com owners segregados, biblioteca de anatomias indexada por tipo de objetivo, e gate humano de aprovação de versão.

O squad implementa as **10 etapas** do `eng-map` (§2 do design doc) + o processo contínuo de curadoria da Biblioteca de Anatomias.

---

## Escopo

### Cobre (v0.1.0)

- **Agentes Tipo 4** — autônomo conversacional (SDR, atendimento, qualificação, etc.)
- **Multi-agente intra-projeto** — Router + Atendimento + Avaliador, etc.
- **Reutilização cross-scope** — novos clientes/negócios via parametrização do briefing

### Deferido (fora do v0.1.0)

- **Tipo 2** — agente acionado por evento
- **Tipo 5** — agente multimodelo

Rationale: insumo (§3.1) só tem caso real de Tipo 4. Prometer Tipo 2/5 sem caso é inventar processo (Article IV — No Invention).

---

## Composição — 5 agentes + 1 gate humano

| Agent ID | Role | Etapas |
|---|---|---|
| `prompt-briefer` | Briefing + curadoria de fontes | 1, 3 |
| `prompt-methodology-curator` | Seleção de anatomia + curadoria contínua da Biblioteca | 2 + contínuo |
| `prompt-writer` | Redação e correção do prompt na anatomia selecionada | 4, 8 |
| `prompt-evaluator` | Quality gate + eval + diagnóstico de falhas | 5, 6, 7 |
| `prompt-release-manager` | Versionamento + deploy registrado | 10 |
| *Aprovador Humano* (gate, não agente) | Decisão final de aprovação de versão | 9 |

Aprovação final (Etapa 9) é **decisão humana indelegável** — gate de accountability. Hoje: Victor.

---

## Como usar

### Para criar um prompt novo (ciclo completo)

1. Comece em `@prompt-briefer *capturar-briefing` — preenche tipo, canal, objetivo, escopo/cliente.
2. `@prompt-methodology-curator *selecionar-anatomia` — escolhe a anatomia da Biblioteca.
3. `@prompt-briefer *curar-fontes` — coleta fontes rastreáveis suficientes.
4. `@prompt-writer *redigir-prompt` — escreve na anatomia selecionada.
5. `@prompt-evaluator *quality-gate` → `*rodar-eval` → `*diagnosticar-falhas`.
6. `@prompt-writer *corrigir-prompt` (loop 5↔8, máx. N iterações).
7. *Aprovador Humano* registra verdict + motivo declarado.
8. `@prompt-release-manager *deploy-versionado` — git + changelog ANTES do deploy.

### Para curadoria fora de ciclo

- `@prompt-methodology-curator *curadoria-continua` — pesquisa avanços, cataloga novas anatomias.

### Workflow completo

Ver [`workflows/prompt-engineering-pipeline.yaml`](./workflows/prompt-engineering-pipeline.yaml) — 10 fases + loop de calibração + processo contínuo.

---

## Tech debt declarado (v0.1.0)

| Item | Severidade | Plano |
|---|---|---|
| Agentes em **300+ linhas** (mínimo blocking do `agent-quality-gate`) | aceito | Expandir para **800+ linhas** (recommended v4.0) em iteração futura |
| **D8 — generalização do harness `sdr-eval`** | escopo confirmado, fora deste squad | Handoff para `@dev`. Spec em [`handoffs/D8-harness-scope-generalizacao.md`](./handoffs/D8-harness-scope-generalizacao.md) |
| Plug do eval no CI (G4) | deferido | Fora do escopo inicial da FASE 3 |
| Tipo 2 / Tipo 5 (agentes não-conversacionais) | deferido | Aguardar caso real antes de codificar processo |

---

## Estrutura de diretórios

```
squads/prompt-engineering-squad/
├── MANIFEST.md                 ← contrato de nomes (consultar SEMPRE)
├── squad.yaml                  ← metadados
├── README.md                   ← este arquivo
├── agents/                     ← 5 agentes hybrid-loader
├── tasks/                      ← 11 tasks (1 por etapa + curadoria contínua)
├── workflows/                  ← pipeline gateado
├── templates/                  ← briefing, prompt, changelog
├── checklists/                 ← quality gate de prompt
├── data/                       ← voice-dna-squad + biblioteca-anatomias
└── handoffs/                   ← D8 handoff para @dev
```

---

## Princípios herdados de `@pedro-valerio`

- Veto condition é função do gate, não falha pessoal.
- Owner é nomeado — "o time" não é owner.
- Hipótese é sinalizada como ⚠️ HIPÓTESE; nunca apresentada como fato.
- Fluxo unidirecional; retornos documentados (Etapa 3→1, loop 5↔8) são exceção explícita.
- Anatomia ≠ framework. PACER é UMA anatomia da Biblioteca, não constante do processo.

---

*Squad scaffolding da FASE 3 — `@pedro-valerio` · `structure-pipeline` v0.1.0.*
