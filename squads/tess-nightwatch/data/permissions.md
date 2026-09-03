# Permissions — tess-nightwatch

| Ação | Supervisor | Patch Dev | Sentinel | Floor Quality | Victor |
|---|---|---|---|---|---|
| SELECT postgres / logs / health / Kapso observe | sim | sim | sim | sim | sim |
| POST resume IA / notify Tiago | sim (P0) | não | não | não | sim |
| Editar backend + testes | não | sim | testes só | não | sim |
| Sugerir diff de regra/prompt em `docs/` | sim | sim | não | sim | sim |
| rsync backend + rebuild | não | sim após gate PASS | não | não | sim |
| git push | não | não | não | não | sim (@devops) |
| Colar prompt TESS 46589 | não | não | não | não | sim |
| POST/PATCH Trinks (agenda cliente) | não | não | não | não | sim (ou o próprio bot) |
| BOT_ACCEPT_ALL / whitelist block | não | não | não | não | sim |
| Acordar outro agente do squad | sim | Dev→Sentinel no incidente | Sentinel→Dev se gate FAIL | Floor→Supervisor/Dev/Sentinel com evidência | sim |

P0 deploy: Supervisor ACK no log além do gate.
