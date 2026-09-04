# Gate Quinn — chão 5 crédito (tess.turn dimensões)

> 2026-09-04T17:05Z · Quinn (@qa, Test Architect) · `*gate` sobre persist Dex. SOT Dara.
> Gate completo: [docs/qa/gates/2026-09-04-chao-5-credito.yml](../qa/gates/2026-09-04-chao-5-credito.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **CONCERNS** (quality score **90**) |
| SOT | [Dara schema](../analysis/2026-09-04-dara-chao-5-credito-schema.md) |
| Story | [salon-whatsapp-chao-5-credito-dimensao](../stories/salon-whatsapp-chao-5-credito-dimensao.md) · Draft |
| Branch / base | `feature/tess-commit-honesty` / `7482d3d` · chão 5 **uncommitted** |
| Testes | **6/6** (persist + timeout) · Quinn reexecutou · syntax 3/3 |
| `blocks_publish` | *(vazio)* |
| Publish | **no** — epic pode continuar; este gate não publica |
| Não executado | deploy, Hostinger, rsync, smoke 0007, BOT_ACCEPT_ALL, paste 46589, query VPS |

Anti-self-review: Dex implementou. Quinn não escreveu este código.

## Veredito por hunt

| # | Verificação | Status |
|---|---|---|
| 1 | Payload `tess.turn`: intent × profile × sent_chars × tess_credits + timed_out + salon_day | **PASS** |
| 2 | `sent_chars` = `userMessageWithContext.length` (0 no skip) — nunca `blocks.total` | **PASS** |
| 3 | Timeout: `tess.turn` timed_out=true, credits=null, sem `recordTessCredits` | **PASS** |
| 4 | Telefone só na coluna; payload/stdout/motivo limpos | **PASS** |
| 5 | Sem tabela nova, sem migration, sem VPS; slot/offer fora desta allowlist | **PASS** |
| 6 | AC2 unit verde. AC3 reconcile ±1 — **só documentado** | **CONCERNS** |
| 7 | Focused tests 6/6 (Quinn) | **PASS** |

## O que está sólido

**Contrato do evento.** `persistTessTurnEvent` grava as quatro dimensões + timeout + `salon_day`. `total_chars` deixou de ser eixo; só entra se o caller ainda mandar (skip/sucesso).

**Chars certos.** Skip = 0. Sucesso/timeout = length do string que foi (ou ia) para `callTESS`. No abort que Quinn rodou: `sent_chars=1002` vs `blocks.total=1981`. A dimensão não é o total duplo.

**Timeout deixa de ser buraco.** Antes só `tess.timeout`. Agora tem `tess.turn` com crédito nulo e **não** incrementa o dia. Daily e ledger continuam entidades distintas.

**PII no fio.** Motivo = `intent:profile`. Stdout `tess.turn` sem telefone. Coluna `client_phone` é a única casa. last4 `0007` neste artefato.

**Freeze.** Sem `018_*`, sem `tess_turn_credits`, sem apply VPS. `compactBookingSlotsBlock` / `resolveOfferDurationMin` não estão no hunk Dex (assembler = só telemetry). `slots.js` dirty na worktree é fatia alheia.

## Finding que gera CONCERNS

**TEST-01 (medium) — AC3 não testado.** A query de reconcile (±1 turno, `salon_day`, timeout fora do SUM) existe no SOT Dara §4.1. Não existe unit, não existe CLI, não rodou contra o banco. Dara já disse que o CLI pode ficar para o chão 6. O persist **habilita** o relatório; ninguém **provou** o delta. Por isso CONCERNS, não PASS — e não FAIL.

TEST-02 / PII-01 / OBS-01 (resume sem `tess.turn`) são low. Sem patch neste gate.

## Publish

`blocks_publish` vazio. Orion **pode continuar o epic** sem publish. Este gate **não** autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, smoke `0007`, paste 46589, religar, POST Trinks.

Nenhum código de aplicação foi alterado nesta revisão — só gate, handoff e QA Results da story.

— Quinn, guardião da qualidade 🛡️
