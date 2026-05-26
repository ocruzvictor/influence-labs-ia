# Pedro Valério Squad

**Process Absolutist & Automation Architect**

Squad especializado em Engenharia de Processos, Arquitetura de Sistemas e Automação.

## Agente Principal

| Agente | Persona | Escopo |
|--------|---------|--------|
| `@pedro-valerio` | Pedro Valério | Processos, automação, criação de artefatos AIOX |

## TRIO Position

```
@oalanicolas (INSUMOS_READY)
         ↓
@pedro-valerio (FASE 2 — ESTRUTURA)
         ↓
@thiago_finch (ARTEFATOS_READY)
```

Pedro Valério é a FASE 2 do TRIO AIOX. Recebe insumos estratégicos e entrega artefatos executáveis.

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
*help                     — Ver todos os comandos
```

## Princípio Core

> "Se executor CONSEGUE fazer errado → processo está errado."

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
│   └── veto-checklist.md           # Verificação de veto conditions
├── workflows/
│   └── structure-pipeline.yaml     # Pipeline 5 fases (FASE 2 TRIO)
├── templates/
│   └── base-template.md            # Template-mãe para *tmpl-create
├── data/
│   └── system-patterns.md          # Catálogo de padrões de arquitetura
├── config.yaml                     # Manifesto do squad
└── README.md
```

## Versão

v1.0.0 — Criado em 2026-05-21
