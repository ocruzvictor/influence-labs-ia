# Squad Creator Pro — Local Factory (README.local)

> **Honest status.** This file documents what exists in *this* workspace vs what the official paid pack promises.

---

## Official vs Materialized

| Aspect | Official (SynkraAI/aiox-squads) | This workspace |
|--------|----------------------------------|----------------|
| **Public repo body** | `squads/squad-creator-pro/README.md` only (stub) | Same upstream README + **local factory layer** |
| **Pro agents** (oalanicolas, pedro-valerio, thiago_finch as Pro specialists) | Documented in README, not shipped publicly | **Not invented** — use standalone `squads/pedro-valerio-squad/` for L4 methodology |
| **34 Pro tasks** | Listed in README | **Not materialized** |
| **Mind cloning / DNA extraction** | Core Pro feature | **Unavailable** until official Pro body is published |
| **Structural upgrade** | `*brownfield-upgrade` (Pro command) | Delegated to **free** `squads/squad-creator/tasks/upgrade-squad.md` |
| **Local factory** | N/A | `config.yaml` + `workflows/wf-brownfield-upgrade-squad.yaml` |

We do **not** pretend the paid Pro body exists. `config.yaml` sets `pro_mode: false` and `local_factory: true`.

---

## What we materialized

```
squads/squad-creator-pro/
├── config.yaml                              # Local factory config (detection + routing)
├── workflows/wf-brownfield-upgrade-squad.yaml  # Orchestrator workflow
├── README.md                                  # Upstream product README (unchanged intent)
└── README.local.md                            # This file — honest local status
```

**Dependencies (siblings, not copies):**

- `../squad-creator` — free pack with real `*upgrade-squad` (audit → plan → execute)
- `../pedro-valerio-squad` — operational L4 target for optional `*structure-pipeline`

---

## How to run

### 1. Structural audit (recommended first step)

```text
@squad-chief *upgrade-squad pedro-valerio-squad --mode=audit
```

Or via the local factory workflow:

```text
@squad-chief *brownfield-upgrade pedro-valerio-squad --mode=audit --dry-run
```

### 2. Plan + dry-run before any execute

```text
@squad-chief *upgrade-squad {squad_name} --mode=plan --dry-run
```

Review the diff. **Execute is veto-blocked** without a prior dry-run (`VETO-BFU-001`).

### 3. Execute structural upgrades (free pack)

```text
@squad-chief *upgrade-squad {squad_name} --mode=execute
```

Requires backup + migration log per `docs/framework/forge-patterns/`.

### 4. Optional methodology enrichment (Pedro L4)

```text
@pedro-valerio *structure-pipeline process-map
```

Use after structural upgrade when gaps are **methodology/SOP/process**, not DNA cloning.

### 5. Validate

```text
@squad-chief *validate-squad {squad_name}
```

---

## Protected squads (no in-place overwrite)

These squads are **audit/plan only** through this factory:

- `tess-nightwatch`
- `tess-floor-lexicon`
- `lib-forge`

Execute mode is veto-blocked for them. Use gap reports for targeted manual patches.

---

## Pedro L4 vs this factory

| | **Local factory (`wf-brownfield-upgrade-squad`)** | **Pedro L4 (`pedro-valerio-squad`)** |
|---|---------------------------------------------------|--------------------------------------|
| **Purpose** | Brownfield **structural** compliance + optional handoff to Pedro | **Methodology** → executable artifacts (tasks, workflows, process maps) |
| **Orchestrator** | `@squad-chief` | `@pedro-valerio` |
| **Input** | Existing squad on disk | INSUMOS_READY (SOPs, frameworks, requirements) |
| **Output** | Gap report, upgrade plan, validation score | ARTEFATOS_READY (agents, tasks, workflows) |
| **DNA / mind cloning** | Explicitly **not** available | Not its job — needs insumos, not clone-mind |
| **When to use** | Squad exists but fails structural checks | You have process knowledge and need new/refined artifacts |

**Rule of thumb:** Factory first (structure), Pedro second (methodology). Official Pro would add a third layer (qualitative DNA) — not available locally.

---

## Forge pattern references

Before mutating squad files, follow:

- `docs/framework/forge-patterns/modernize-component.md` — backup, migration log, L3/L4 only
- `docs/framework/forge-patterns/optimize-component.md` — rollback on failure

Backups land in `.aiox/squad-backups/{squad_name}-{timestamp}/`.

---

## When official Pro ships

1. Replace or merge `config.yaml` flags (`pro_mode: true`, remove `local_factory` if no longer needed).
2. Add real `agents/`, `tasks/`, `workflows/` from the paid pack.
3. Update this file or delete it if redundant.
4. Keep `wf-brownfield-upgrade-squad.yaml` only if it still adds value over the official workflow.
