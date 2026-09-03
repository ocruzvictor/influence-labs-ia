# Task: patrol-live

task: patrol-live
responsavel: "@nightwatch-supervisor"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - last_tick_utc (opcional; default agora-15min)
  - VPS deploy@72.60.155.118 / health / postgres
Saida: |
  - patrol_report: { p0[], p1[], p2[], threads_stuck[], trinks_mutations, tess_credits }
  - activate_peer calls se P0/P1
Checklist:
  - "[ ] /health ok ou incidente infra P0"
  - "[ ] Eventos operacionais desde last_tick classificados"
  - "[ ] CREATE/RESCHEDULE parseados sem evento = P0 I1"
  - "[ ] Threads user-last >3min sem assistant = P0"
  - "[ ] Append nightwatch-log sem PII além last4"

## Workflow

1. `curl` health no backend. Se `trinks_ping` fail → P0 infra, notify Victor, **não** patch de intent.
2. SQL `bot_operational_events` WHERE received_at > last_tick.
3. SQL tags.parsed com creates/reschedules > 0; left join eventos created/failed/blocked no mesmo phone ±120s. Órfão = P0.
4. Conversas: DISTINCT ON phone última row. Se role=user e NOW()-created_at > 3 min → P0 stuck.
5. `trinks_api_requests` method POST/PATCH/PUT desde last_tick.
6. Se P0/P1: executar `activate-peer.md` com o YAML de handoff.
7. Escrever 5–10 linhas no log. Não dumpar transcript completo no chat.

DONE quando o report tem counts e cada P0 tem next_action (rescue | activate-dev | notify-human).
