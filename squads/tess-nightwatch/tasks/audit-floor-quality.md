# Task: audit-floor-quality

task: audit-floor-quality
responsavel: "@floor-quality"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - last_tick_utc (default agora-60min; no tick de 15 min usar a janela do patrol)
  - VPS postgres / conversation_history / bot_operational_events / trinks_api_requests
Saida: |
  - floor_report: { threads_sampled, scores, wins[], fails[], rule_suggestions[] }
Checklist:
  - "[ ] Amostra de threads reais da janela (não só dono/teste)"
  - "[ ] I3: relógios ditos vs snapshot; duração contínua"
  - "[ ] I1 de negócio: afirmação sem booking.* = fail (encaminha Sentinel)"
  - "[ ] Fidelidade: leak, FULL indevido, pulo de roteiro serviço→prof→relógio"
  - "[ ] Sugestão de regra é arquivo+trecho, não 'melhorar o tom'"
  - "[ ] Append nightwatch-log sem PII além last4"

## Workflow

1. Listar phones com assistant turn na janela. Amostrar até 8 fios (priorizar SCHEDULING / tags.parsed / “horario”).
2. Para cada fio, ler últimas 12 rows de `conversation_history` (last4 só).
3. Marcar eixos 0 (falhou) / 1 (misto) / 2 (ok): roteiro, horarios, confirmacao, trinks, fidelidade, caso_simples.
4. Cruzar com `trinks_api_requests` GET vs POST/PATCH e com eventos `booking.*` / `tess.context_bytes`.
5. Se I1 quebrado → não patchar; `activate-peer` Sentinel com evidence.
6. Se I3 ou roteiro quebrado com causa de código → `activate-peer` Dev, task `patch-booking-path`.
7. Escrever `rule_suggestions` concretas (ex. alias em PROFESSIONAL_RE, footer de HORARIOS, parágrafo do prompt 46589 para Victor colar).
8. 8–15 linhas no `docs/ops/nightwatch-log.md`. Destacar também o que funcionou no tom scoped.

DONE quando o report tem counts, cada fail tem next_action, e sugestões apontam arquivo.
