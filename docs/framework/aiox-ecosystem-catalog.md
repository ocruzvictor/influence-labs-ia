# Catálogo AIOX neste repo

Instalado em 2026-09-08 a partir de [SynkraAI/aiox-squads](https://github.com/SynkraAI/aiox-squads) + padrões [paulorjlopes/AIOX-SQUADS](https://github.com/paulorjlopes/AIOX-SQUADS) (`aios-forge` **padrões only**).

Core local: `.aiox-core` **5.4.1** (último release). Não reinstalar o core.

Flags de ativação: `.aiox/squad-activation.yaml` (SOT). `autoLoad` permanece off.

## Ativo (usar no trabalho Tess / framework)

| Pasta | Ativar | Para quê |
|-------|--------|----------|
| `squads/pedro-valerio-squad` | `@pedro-valerio` | L4 operacional — processos Tess + Syncra |
| `squads/squad-creator` | `@squad-chief` | `*upgrade-squad`, `*analyze-squad`, `*validate-squad` |
| `squads/squad-creator-pro` | fábrica local | stub oficial + workflow brownfield local |
| `squads/deep-research` | `@dr-orchestrator` | digerir metodologia / evidência |
| `squads/lib-forge` | `@lib-forge` | extract opportunities (já era L4) |
| `squads/tess-nightwatch` | Nightwatch | ops 24/7 Tess/Trinks |
| `squads/tess-floor-lexicon` | léxico | chão único |

## Ops AIOX (ligar sob demanda)

| Pasta | Nota |
|-------|------|
| `squads/kaizen` | base do Kaizen — instalar v2 em cima |
| `squads/kaizen-v2` | memória de sessão / forgetting curve — **não** conflitar com Nightwatch no mesmo ritual |
| `squads/dispatch` | execução paralela |

## Estacionado (disco only — não default)

Ativar só com `@agente` quando a story pedir.

| Pasta | Domínio |
|-------|---------|
| `squads/curator` | curadoria de corpus / POP / KB |
| `squads/seo` | SEO pós-design |
| `squads/apex` | frontend premium |
| `squads/brand` | branding |
| `squads/legal-analyst` | jurídico / LGPD sob demanda |
| `squads/education` | jornadas de treino |

## Não instalado de propósito

| Item | Motivo |
|------|--------|
| `aios-forge-squad` (7 agentes) | sobrepõe `@aios-master` + `@squad-creator` |
| Corpo pago do Squad Creator Pro | **não está no GitHub público** (só README) |
| `aiox-hybrid-ops-pedro-valerio` | repo 404 |

Padrões Forge (modernize + migration log) em `docs/framework/forge-patterns/`.

## MCP

Presets em `.cursor/mcp-presets/`. Ver `HOW-TO.md`. Tess + Docker permanecem no `mcp.json` ativo.

## Como continuar o trabalho Pedro

```
@squad-chief
*upgrade-squad pedro-valerio-squad --mode=audit

@pedro-valerio
*structure-pipeline
# insumos: docs/intake/pedro-metodologia/ + data/syncra-methodology.md
```
