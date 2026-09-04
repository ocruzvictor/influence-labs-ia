# Decisões de execução — 2026-09-03 (Victor → Orion)

| # | Pergunta | Resposta | O que esta sessão faz |
|---|---|---|---|
| 1 | Primeira CLI (7 OPs) | **Aprovo** | `backend/scripts/salao/` das 7 + depois OPs 9–18 |
| 2 | Quem aceita handoff | **Tiago** | Owner + SLA **15 min em horário comercial** (ter–sex 9–19, sáb 9–18) |
| 3 | Onde persistir intent | **Executar** (coluna existente) | `conversation_history.intent` + evento `tess.context_bytes` |
| 4 | Duplicar outbound? | **Duplicar** | Outbox: copy honesta se ACK sem outbound; falso “não gravei” > silêncio |
| 5 | Desligar Thinking | **Nunca esteve ligado** | Ofensor 1 = inativo. Não pedir ação de painel |
| 6 | §7–§9 no radar | **Concordo** | Sem story de H-CRM / H-SPLIT / P0–P2 extras |

## Executado nesta orquestração (1 + 2 + 3)

1. **Outbox** — `backend/lib/outbound-outbox.js` no webhook Kapso após ACK. Evento `outbound.watchdog`. Copy I1-safe. Kill/allowlist/human-handled/owner **não** disparam.
2. **Handoff SLA** — payload em `handoff.human`; aviso no WhatsApp do Tiago; CLIs listar / aceitar / re-alertar. Eventos `handoff.accepted` e `handoff.sla_breach`. Re-alerta **não** fala com o cliente.
3. **`scoped` default** — `parseTessContextConfig`, `infra/.env.example`, `docker-compose` fallback. Rollback: `TESS_CONTEXT_MODE=full` ou `TESS_CONTEXT_FORCE_FULL=1`. **Não publicado** — VPS só muda no próximo @devops com ACK.
4. **CLIs OP005–OP007, OP011, OP013–OP018** geradas.

Não deploy. Não Hostinger. Não rsync. Não alterar `BOT_ACCEPT_ALL` (preservar baseline VPS). Não paste de prompt. Não Trinks mutate.

## Publicado 2026-09-03 ~22:30Z

Victor ACK 1+2+3+4. Commit `b42bb2b` em `origin/feature/tess-commit-honesty`. VPS worktree + backend = `b42bb2b`.

Live: `TESS_CONTEXT_MODE=scoped`, `TESS_SKIP_TRIVIAL=true`, `BOT_ACCEPT_ALL=true` (baseline preservado). Outbox + SLA + resume-ia.6 no ar. Compose do VPS **não** sobrescrito. Nginx `-t` ok + reload. Backup `backend.bak.1788474285`. Sem Hostinger. Sem rsync local. Sem smoke `0007`.

## Estacionados (voltar já — sem story)

Victor 2026-09-03 noite: tokens promissórios **e** dor de horário vs duração sentida pelo time.

SOT: `docs/analysis/2026-09-03-orion-estacionados.md`

| ID | Dor | Status |
|---|---|---|
| PARK-TOKENS | `UNCERTAIN` herda FULL + sem teto de chars | **Em código local** (item 6). Hard cap (7) continua fora |
| PARK-SLOTS | Tess sugere hora que o guard recusa na confirmação (ping-pong) | **Em código local** (itens 1+2). Sem deploy |

Pool Victor 23:12: `1,2,3,6,8,12,13,16,18` — fatia `docs/analysis/2026-09-03-orion-fatia-pool-victor.md`. Sem publish até ACK.
