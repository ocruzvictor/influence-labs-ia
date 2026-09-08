# *upgrade-squad — audit + execute estrutural

**Data:** 2026-09-08  
**Modo:** audit → execute (frontmatter / ACTIVATION-NOTICE only)  
**Alvos:** `pedro-valerio-squad` v1.1.1 · `lib-forge` v1.0.1  
**Objetivo declarado:** ambos como kits de revisão portáteis para outros projetos.

Execute estrutural aplicado após autorização (“pode seguir”). Sem rewrite de persona, sem Pro fake, sem `LIB_FORGE_WRITE_ROOT`.

---

## Inventário

| | Pedro | Lib Forge |
|--|-------|-----------|
| Manifest | `squad.yaml` + `config.yaml` | `squad.yaml` + `config.yaml` |
| Agentes | 1 (1080 L, loader OK) | 5 (165–194 L, sem ACTIVATION-NOTICE) |
| Tasks | 15 | 7 |
| Workflows | 1 (`structure-pipeline`) | 2 |
| Checklists | 4 | 3 |
| Data | 3 + Tess ON-DEMAND | 4 + Tess ON-DEMAND |
| `slashPrefix` | **ausente** (S-CFG-007) | `libForge` |
| `aiox.minVersion` | 2.1.0 | 2.0.0 |

---

## Score estrutural

| Squad | Score (audit) | Score (pós-execute) | Motivo residual |
|-------|---------------|---------------------|-----------------|
| **pedro-valerio-squad** | NEEDS_UPGRADE | **PASS** (estrutural) | S-CFG-007 `slashPrefix` já existia; tasks agora com anatomia mínima |
| **lib-forge** | NEEDS_UPGRADE | **PASS** (estrutural) | `write_paths` ainda aponta `../victor-libs/` (P2-3 backlog) |

Nada **CRITICAL** (manifesto e entry_agent válidos nos dois).

---

## Gaps Pedro (estrutural)

| ID | Severidade | Gap |
|----|------------|-----|
| S-CFG-007 | recommended | Sem `slashPrefix` no `squad.yaml` |
| S-TSK | high | Todas as tasks: falta `execution_type` |
| S-TSK | medium | 10 tasks sem campo `status` |
| S-TSK | medium | `auto-rules`, `eng-gaps` sem bloco `input` nomeado |
| — | note | Tess addendum já é ON-DEMAND — correto para portabilidade |

**Não é gap:** identidade, Syncra, veto, pipeline. Isso é conteúdo, não anatomia AIOX.

---

## Gaps Lib Forge (estrutural)

| ID | Severidade | Gap |
|----|------------|-----|
| S-AGT-001 | blocking (template) | 5 agentes sem ACTIVATION-NOTICE |
| S-TSK | high | Tasks no formato Entrada/Saída próprio, não 8 campos |
| S-CFG | recommended | `write_paths` aponta `../victor-libs/` — amarra um repo |
| — | note | Tess addendum já ON-DEMAND |

**Não é gap:** pipeline analysis-only (já serve revisão sem gerar código).

---

## Execute (feito)

### P0 — portabilidade (já estava)
- `data/portability.md` nos dois squads
- Mapa dual-kit (Pedro revisa processo → Forge extrai scripts)

### P1 — Pedro
1. `slashPrefix: pedroValerio` — já estava no `squad.yaml`
2. Frontmatter nas 15 tasks: `status: active`, `execution_type: agent`, `responsible_executor: pedro-valerio`
3. `input` nomeado em `auto-rules` e `eng-gaps`

### P2 — Lib Forge
1. ACTIVATION-NOTICE nos 5 agentes (persona intacta)
2. Frontmatter 8 campos nas 7 tasks (corpo atual preservado)
3. **Não feito:** `write_paths` parametrizável (`LIB_FORGE_WRITE_ROOT`) — backlog consciente

**Protected:** tess-nightwatch / tess-floor-lexicon sem mutação deste execute.

---

## Re-score sugerido

```
@squad-chief *upgrade-squad pedro-valerio-squad --mode=audit
@squad-chief *upgrade-squad lib-forge --mode=audit
@pedro-valerio *fingerprint-check
@lib-forge analysis-only
```
