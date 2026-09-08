# Changelog — Lib Forge

## [1.0.2] — 2026-09-08

### Write root (contrato completo)

- SOT: `data/write-root.md` + `scripts/resolve-write-root.js`
- Ordem: `destination` → `LIB_FORGE_WRITE_ROOT` → default deste repo (`../victor-libs/`)
- Projeto estrangeiro sem override: ASK (não grava)
- Heurística LF-G006; publish/workflows/agentes alinhados

## [1.0.1] — 2026-09-08

### Estrutural (anatomia AIOX)

- ACTIVATION-NOTICE nos 5 agentes (persona intacta)
- 8 campos nas 7 tasks (`status`, `execution_type`, `task_name`, `responsible_executor`, `input`, `output`, `action_items`, `acceptance_criteria`)
- Corpo das tasks e `write_paths` inalterados (`LIB_FORGE_WRITE_ROOT` continua backlog)

## [1.0.0] — 2026-04-29

### Lançamento inicial

**Agentes:**
- 🔥 lib-forge-chief (Forge) — Orchestrator
- 🔍 prd-analyst (Ana) — Tier 1
- 🏗️ lib-architect (Arco) — Tier 2
- ✍️ script-writer (Script) — Tier 3
- ✅ lib-validator (Val) — Tier 4

**Workflows:**
- wf-prd-to-lib — Pipeline completo PRD → lib (6 fases)
- wf-validation-gate — Ciclo de validação com até 3 iterações

**Tasks:**
- analyze-prd
- extract-opportunities
- design-lib-structure (com human gate obrigatório)
- generate-scripts
- validate-scripts
- publish-to-victor-libs

**Configurações:**
- Suporte a Python ≥ 3.10
- Saída padrão em victor-libs/
- Organização por domínio de negócio
- Aprovação humana obrigatória antes de gerar código
