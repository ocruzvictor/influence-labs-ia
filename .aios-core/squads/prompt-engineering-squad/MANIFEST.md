# MANIFEST — `prompt-engineering-squad`

**Squad:** `prompt-engineering-squad`
**Versão:** `v0.1.0`
**Data:** 2026-05-25
**Origem:** FASE 3 do `structure-pipeline` (orquestrado por @pedro-valerio)
**Design doc:** `docs/analysis/eng-map-prompt-engineering.md`
**Insumo:** `docs/analysis/insumos-ready-prompt-engineering.md`

> **CONTRATO DE NOMES.** Toda referência de arquivo, ID de agente, comando e task deste squad está fixada aqui. Subagentes geradores devem usar EXATAMENTE estes nomes — `command_loader` apontando para path inexistente ou divergente é veto da FASE 4.

---

## Estrutura de Diretórios

```
squads/prompt-engineering-squad/
├── MANIFEST.md                  ← este arquivo
├── squad.yaml                   ← metadados do squad
├── README.md                    ← overview e guia de uso
├── agents/                      ← 5 agentes (hybrid-loader, 300+ linhas, v0.1.0)
│   ├── prompt-briefer.md
│   ├── prompt-methodology-curator.md
│   ├── prompt-writer.md
│   ├── prompt-evaluator.md
│   └── prompt-release-manager.md
├── tasks/                       ← 11 tasks (uma por etapa + curadoria contínua)
│   ├── capturar-briefing.md
│   ├── selecionar-anatomia.md
│   ├── curar-fontes.md
│   ├── redigir-prompt.md
│   ├── quality-gate-prompt.md
│   ├── rodar-eval.md
│   ├── diagnosticar-falhas.md
│   ├── corrigir-prompt.md
│   ├── aprovar-versao.md
│   ├── deploy-versionado.md
│   └── curadoria-continua.md
├── workflows/
│   └── prompt-engineering-pipeline.yaml
├── templates/
│   ├── briefing-tmpl.md
│   ├── prompt-tmpl.md
│   └── changelog-versao-tmpl.md
├── checklists/
│   └── prompt-quality-gate.md
├── data/
│   ├── voice-dna-squad.md       ← léxico compartilhado (já criado no scaffold)
│   └── biblioteca-anatomias.md
└── handoffs/
    └── D8-harness-scope-generalizacao.md   ← spec para @dev
```

---

## Inventário Canônico

### Agentes ↔ Etapas ↔ Commands ↔ Tasks

| Agent ID | Etapas | Commands | Task File |
|---|---|---|---|
| `prompt-briefer` | 1, 3 | `*capturar-briefing` | `tasks/capturar-briefing.md` |
| | | `*curar-fontes` | `tasks/curar-fontes.md` |
| `prompt-methodology-curator` | 2 + contínuo | `*selecionar-anatomia` | `tasks/selecionar-anatomia.md` |
| | | `*curadoria-continua` | `tasks/curadoria-continua.md` |
| `prompt-writer` | 4, 8 | `*redigir-prompt` | `tasks/redigir-prompt.md` |
| | | `*corrigir-prompt` | `tasks/corrigir-prompt.md` |
| `prompt-evaluator` | 5, 6, 7 | `*quality-gate` | `tasks/quality-gate-prompt.md` |
| | | `*rodar-eval` | `tasks/rodar-eval.md` |
| | | `*diagnosticar-falhas` | `tasks/diagnosticar-falhas.md` |
| `prompt-release-manager` | 10 | `*deploy-versionado` | `tasks/deploy-versionado.md` |
| *(Aprovador Humano — gate, não agente)* | 9 | — | `tasks/aprovar-versao.md` (procedimento de aprovação humana, referenciado pelo workflow) |

Standard commands em todos os agentes: `*help`, `*chat-mode`, `*exit`.

### Comandos opcionais (optional na `command_loader`)

- `prompt-methodology-curator`: optional `data/biblioteca-anatomias.md`
- `prompt-evaluator` (`*quality-gate`): optional `checklists/prompt-quality-gate.md`

### Caminhos absolutos para referência cruzada

- Design doc: `docs/analysis/eng-map-prompt-engineering.md`
- Insumos: `docs/analysis/insumos-ready-prompt-engineering.md`
- Template estrutural (hybrid-loader): `squads/pedro-valerio-squad/agents/pedro-valerio.md`
- Léxico compartilhado: `squads/prompt-engineering-squad/data/voice-dna-squad.md`
- Workflow do processo: `squads/prompt-engineering-squad/workflows/prompt-engineering-pipeline.yaml`

---

## Regras de Geração (subagentes)

1. **Use somente os nomes deste manifesto.** Não invente caminhos, IDs ou comandos.
2. **Estrutura hybrid-loader (Levels 0-6)** — modelar em `squads/pedro-valerio-squad/agents/pedro-valerio.md`.
3. **Alvo: 300+ linhas por agente, `v0.1.0`** — atende o veto blocking do `structure-pipeline` (300+ linhas). 800+ fica como tech debt declarado no header (`# tech_debt: expansao_para_800_linhas`).
4. **Voice DNA do squad em `data/voice-dna-squad.md`** — léxico shared (vocabulário always/never, tom). Cada agente preserva sua especialidade mas reusa o léxico do squad.
5. **`command_loader` deve listar todos os commands operacionais** com `requires` apontando para tasks que EXISTEM neste manifesto.
6. **`dependencies` deve refletir** todos os arquivos referenciados em `command_loader.requires`.
7. **Não criar arquivos fora deste manifesto.** Se algo parecer faltar, sinalize — não improvise.

---

*MANIFEST — @pedro-valerio · scaffolding sequencial da FASE 3.*
