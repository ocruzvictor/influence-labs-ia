# Pedro Valério Squad

**Process Absolutist & Automation Architect**

Squad especializado em Engenharia de Processos, Arquitetura de Sistemas e Automação — operacional L4 com metodologia **Syncra** (sincronização humano × IA × worker).

## Agente Principal

| Agente | Persona | Escopo |
|--------|---------|--------|
| `@pedro-valerio` | Pedro Valério | Processos, automação, criação de artefatos AIOX, Syncra L0–L3 |

## TRIO Position

```
@oalanicolas (INSUMOS_READY)
         ↓
@pedro-valerio (FASE 2 — ESTRUTURA)
         ↓
@thiago_finch (ARTEFATOS_READY)
```

Pedro Valério é a FASE 2 do TRIO AIOX. Recebe insumos estratégicos e entrega artefatos executáveis.

## Factory vs L4 operacional

| Camada | Path | Papel |
|--------|------|-------|
| **Factory** | `squads/squad-creator-pro/` | Brownfield upgrade, axioma, clone-mind — **não** é este squad |
| **Free pack** | `squads/squad-creator/` | `*upgrade-squad` (audit→plan→execute) |
| **L4 operacional** | `squads/pedro-valerio-squad/` | **Este folder** — Pedro em produção (TRIO, Tess, etc.) |

Manifest canônico: `squad.yaml` (AIOX ≥ 2.1.0). `config.yaml` mantido por compatibilidade.

**Portátil:** este L4 serve revisão em outros projetos. Tess é addendum ON-DEMAND — ver `data/portability.md`. Dual-kit com Lib Forge: `docs/analysis/2026-09-08-pedro-structure-pipeline-reuse-kit.md`.

## Ativar

```
@pedro-valerio
```

## Comandos Principais

```
*eng-map {processo}       — Mapear processo completo
*eng-gaps {workflow}      — Identificar gaps e falhas
*arq-structure {sistema}  — Estruturar sistema
*auto-rules {sistema}     — Criar regras de automação
*create-agent {nome}      — Criar agente AIOX
*structure-pipeline       — Pipeline completo FASE 2 (orquestração)
*audit                    — Auditoria completa
*veto-check               — Verificar veto conditions
*fingerprint-check        — Validar Migalhas de Pão (Syncra)
*task-d-audit             — Auditar tarefas burras Tipo D
*help                     — Ver todos os comandos
```

## Princípio Core

> "Se executor CONSEGUE fazer errado → processo está errado."

## Syncra addendum (v1.1.0)

Metodologia consolidada em `data/syncra-methodology.md` (fontes: 5 Google Docs — ver `docs/intake/pedro-metodologia/README.md`).

| Conceito | Comando / artefato |
|----------|-------------------|
| L0–L3 Herança de DNA | `data/syncra-methodology.md` |
| Migalhas de Pão | `*fingerprint-check` |
| Tarefas D (burras) | `*task-d-audit` |
| Martelo (IA executa / humano assina) | Heurísticas no agente |
| Serial Killer de Entidades | `*eng-map`, Journey Log |
| A Forja (Elicitação→Skills) | Referência metodológica (fase pipeline futura) |

## Estrutura

```
pedro-valerio-squad/
├── agents/
│   └── pedro-valerio.md            # Agente principal (hybrid-loader)
├── tasks/                          # 15 tasks (1 por comando)
│   ├── eng-map.md                  # Mapeamento de processo
│   ├── eng-gaps.md                 # Identificação de gaps
│   ├── eng-owners.md               # Matriz RACI
│   ├── arq-structure.md            # Arquitetura de sistema
│   ├── arq-statuses.md             # State machine
│   ├── arq-fields.md               # Schema de campos
│   ├── auto-rules.md               # Regras de automação
│   ├── auto-connect.md             # Integração entre sistemas
│   ├── auto-triggers.md            # Triggers e eventos
│   ├── tmpl-create.md              # Criação de template
│   ├── tmpl-instructions.md        # Instruções de preenchimento
│   ├── tmpl-test.md                # Teste de template
│   ├── create-task.md              # Criar task AIOX
│   ├── create-workflow.md          # Criar workflow YAML
│   └── create-agent.md             # Criação de agentes AIOX
├── checklists/
│   ├── audit-checklist.md          # Auditoria SC_AGT_001
│   ├── veto-checklist.md           # Verificação de veto conditions
│   ├── fingerprint-checklist.md    # Migalhas de Pão (Syncra)
│   └── task-d-audit.md             # Auditoria tarefas Tipo D
├── workflows/
│   └── structure-pipeline.yaml     # Pipeline 5 fases (FASE 2 TRIO)
├── templates/
│   └── base-template.md            # Template-mãe para *tmpl-create
├── data/
│   ├── system-patterns.md          # Catálogo de padrões de arquitetura
│   ├── tess-domain-addendum.md     # Domínio Tess 46589 + Trinks
│   └── syncra-methodology.md       # Metodologia Syncra L0–L3
├── squad.yaml                      # Manifest canônico (AIOX 2.1.0+)
├── config.yaml                     # Legado (compat)
└── README.md
```

## Adaptação Studio Tirra (2026-09-03)

Cópia L4 em `squads/pedro-valerio-squad/` (o loader do agente aponta para este path).
Espelho framework: `.aios-core/squads/pedro-valerio-squad/` (sync separado).

- Domínio: atendimento Tess 46589 + Trinks. Lentes em `data/tess-domain-addendum.md`.
- Insumo desta rodada: `docs/analysis/2026-09-03-insumos-ready-tess-atendimento.md`.
- Saída: blueprint diagnóstico (mapa + veto + gaps). Sem criar agentes/tasks até Orion autorizar fase 3.

## Versão

**v1.1.3** — 8 campos oficiais no first-block das 15 tasks · 2026-09-08  
**v1.1.2** — L0 intake (`data/l0-intake.md`) antes de *eng-map fora deste repo · 2026-09-08  
**v1.1.1** — Anatomia AIOX nas 15 tasks (`status`, `execution_type`, `responsible_executor`) · 2026-09-08  
v1.1.0 — Syncra addendum · manifest `squad.yaml` · 2026-09-08  
v1.0.0 — Criado em 2026-05-21 · addendum Tess 2026-09-03
