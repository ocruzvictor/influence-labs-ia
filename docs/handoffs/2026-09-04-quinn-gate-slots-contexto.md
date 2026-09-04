# Gate Quinn — fatia slots+contexto (1b, 2b, overlay 9800)

> 2026-09-04T14:10Z · Quinn (@qa, Test Architect) · `*gate` sobre **fatia operacional**, não story formal.
> Gate completo: [docs/qa/gates/2026-09-04-fatia-slots-contexto.yml](../qa/gates/2026-09-04-fatia-slots-contexto.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **CONCERNS** (quality score **85**) |
| SOT | [análise Orion](../analysis/2026-09-04-orion-fatia-slots-contexto.md) + [pacote QA](2026-09-04-orion-fatia-slots-contexto-qa.md) |
| Branch / live | `feature/tess-commit-honesty` / live `a08f23b` · worktree **uncommitted** |
| Testes | **97/97** (5 arquivos pedidos) · syntax 4/4 |
| W2 antes do ACK | **Não** — CONCERNS sem dente de código |
| Publish | **yes-with-conditions** — W3 ACK Victor, depois W4 Gage allowlist-only. Sem Hostinger/rsync agora |
| `blocks_publish` | *(vazio)* |
| Não executado | deploy, smoke 0007, replay André 10:30, CREATE 9800, paste 46589 |

Item 7 (teto de chars) ficou **fora**, como o SOT mandou. Não cobrei.

## Veredito por item pedido

| # | Verificação | Status |
|---|---|---|
| 1b | Catálogo/`durationMin` pela última fala | **PASS** |
| 1b | Penteado coloquial + DISAMBIGUA; festa = Gi | **PASS** |
| 2b | `ensureSlotSnapshot` maxAge = 45 min; relê hoje + data pedida | **PASS** |
| 9800 | `isCompatible` matriz **ou** agenda 90d | **PASS** (risco residual = COMPAT-01) |
| 9800 | `getServicesText` une nomes observados | **PASS** |
| 7 | Teto de chars | **OUT** — não implementado, não falha |
| — | CANCEL full sem `ensureSlotSnapshot` | **PASS** |
| — | last4 / sem 46589 / sem `BOT_ACCEPT_ALL` / sem POST Trinks novo / sem smoke | **PASS** |

## O que está sólido

**1b — última fala manda no BOOKING.** `filterCatalogForProfile` só no perfil BOOKING tenta a mensagem atual primeiro. Sem keyword, cai no histórico. O teste do 0007 sintético (“maquiagem” agora, “corte” no histórico) religa `durationMin=120` e some o 12:30 de 30 min. PRICE **não** herdou o atalho — ainda filtra pelo histórico.

**1b — coloquial.** `penteado` + (dia a dia / tesoura / insta / corte / …) inclui SKU de corte e prepende DISAMBIGUA. Festa/casamento/formatura não entram no coloquial. O SKU Penteado continua Gi via `applyOperationalHabilitacao` (já existia).

**2b — 45 min de verdade.** `ensureSlotSnapshot` passou a perguntar `hasSlotSnapshotForDate(date, { maxAgeHours: 0.75 })`. O assembler relê hoje (primeiro dia útil) e a data pedida, e empurra hoje em `slotDates` quando o cliente pediu outro dia. CANCEL nem entra no loop (`fetchSlots: false`); o teste que explode se `ensureSlotSnapshot` for chamado continua verde.

**9800 — overlay no sítio certo.** O guard de CREATE/reschedule e o texto de habilitação passam a ver o par que a agenda já tem (scheduled/confirmed, 90d). Não é “histórico desta cliente” — é o par do salão, que era o ofensor.

## Findings (nenhum bloqueia)

**COMPAT-01 (medium) — o risco que o Orion pediu para julgar.** Overlay não agenda o profissional *errado*; agenda o par que já existe 129 vezes (Gi × Design). A Trinks ainda pode 400 se a matriz oficial estiver magra. Isso vira falha honesta no outbox, não “Giovanna não realiza”. **Sem patch W2.** Observar `booking.failed` depois do ACK. Não POST Trinks para testar.

**QUAL-02 (low).** `pentado` (typo do 3653) não dispara coloquial. O SOT escreveu “penteado”. Aceito.

**TEST-01 (low).** Ninguém testou o intervalo `0.75 hours` no SQL. W5 Gage confirma no container.

## W2 e publish

| Pergunta | Resposta |
|---|---|
| W2 (fixes) obrigatório antes do ACK Victor? | **Não.** Zero `blocks_publish`. COMPAT-01 é qualidade aceita. |
| Victor pode ACK (W3)? | **Sim**, com COMPAT-01 visível. |
| Gage pode publicar (W4)? | **Não ainda.** Depois do ACK, allowlist do YAML. Sem rsync, sem Hostinger, sem 46589, sem `BOT_ACCEPT_ALL`, sem smoke 0007 / André / CREATE 9800. |

Worktree dirty enorme fora da fatia. Não commitiar `docs/prompts/README-46589.md`, `infra/*`, nginx, frontend, KB. Plano Gage (`docs/ops/2026-09-04-gage-publish-plan-slots-contexto.md`) não entrou na allowlist deste gate.

## Limites deste gate

Não autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, alteração de allowlist, paste de prompt Tess, mutação Trinks nem smoke WhatsApp. Nenhum código de aplicação foi alterado nesta revisão — só os dois artefatos de QA.

— Quinn, guardião da qualidade 🛡️
