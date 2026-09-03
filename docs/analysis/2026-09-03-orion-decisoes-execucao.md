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

## Próximo — ACK Victor

Quinn: **CONCERNS** (`docs/qa/gates/2026-09-03-outbox-sla-scoped.yml`). SLA-01/OBX-01/OBX-02 corrigidos no disco; gate não reaberto.
Gage: plano em `docs/ops/2026-09-03-gage-publish-plan-outbox-sla-scoped.md`.
Publish continua **não** autorizado.
