# Gate Quinn — chão 6 timeout por perfil

> 2026-09-04T17:15Z · Quinn (@qa, Test Architect) · `*gate` sobre tetos Dex. SOT Aria.
> Gate completo: [docs/qa/gates/2026-09-04-chao-6-timeout.yml](../qa/gates/2026-09-04-chao-6-timeout.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **CONCERNS** (quality score **94**) |
| SOT | [Aria tetos](../analysis/2026-09-04-aria-chao-6-timeout-tetos.md) |
| Story | [salon-whatsapp-chao-6-timeout-perfil](../stories/salon-whatsapp-chao-6-timeout-perfil.md) · Draft |
| Branch / base | `feature/tess-commit-honesty` / `7482d3d` · chão 6 **uncommitted** |
| Testes | **23/23** (budget + server timeout + commit-12) · Quinn reexecutou · syntax 3/3 |
| `blocks_publish` | *(vazio)* |
| Publish | **no** — epic pode continuar; este gate não publica |
| Não executado | deploy, Hostinger, rsync, smoke 0007, BOT_ACCEPT_ALL, paste 46589, Nginx reload, Kapso |

Anti-self-review: Dex implementou. Quinn não escreveu este código.

## Veredito por hunt

| # | Verificação | Status |
|---|---|---|
| 1 | AbortSignal = `resolveTessAbortMs`; parede 25000 não é o signal | **PASS** |
| 2 | MIN/FAQ/PRICE/CANCEL=13000; BOOKING/FULL/unknown=22000; todos <25000; heavy ≥12400 | **PASS** |
| 3 | Env 3000–24000; 0/abc/25000/30000/2000 → default; sem `TESS_ABORT=off` | **PASS** |
| 4 | CANCEL last4 `0007`: timeout_ms=13000, copy honesta, tess.turn timed_out, credits null, zero Trinks, sem phone | **PASS** |
| 5 | FAQ `aceita pix?`: timeout_ms=13000, DEFAULT_TIMEOUT_COPY, skip FAQ off | **PASS** |
| 6 | BOOKING/FULL timeout_ms=22000. Sem p95 inventado | **PASS** (AC3 aberto) |
| 7 | omit timeoutMs → 22000; premium mesmo abortMs; resume sem persist tess.turn | **PASS** |
| 8 | commit-12 `tess-timeout.test.js` copy / `isTessTimeoutError` | **PASS** |
| 9 | Nginx / Kapso / P-BUDGET / data/kb / 46589 / Hostinger / religar / smoke 0007 | **PASS** (zero deste slice) |

## O que está sólido

**Dois regimes.** Lean 13s. Heavy 22s. Unknown/omit = FULL 22s. A parede 25s ficou no ficheiro e saiu do `AbortSignal`.

**commit-12 intacto.** CANCEL last4 `0007` ainda fala a copy honesta, grava `tess.turn` timed_out com crédito null, e não mexe em Trinks. FAQ no timeout usa `DEFAULT_TIMEOUT_COPY`, não a frase de cancel.

**Resume.** Abort do perfil a partir de `assembledCtx.contextProfile`. Sem persist novo de `tess.turn` (OBS-01 da 5 — fora).

**Freeze.** P-BUDGET e `tess-timeout.js` sem diff. Skip FAQ continua off. Nginx webhook `location /` ainda 35s. Diff nginx/kb/46589 na worktree é fatia alheia.

## Finding que gera CONCERNS

**REQ-01 (medium) — AC3 sem p95.** Não existe um dia de `tess.turn` live nem `duration_ms`. O teto heavy 22000 é folga sobre a âncora 12,4s, não um p95. Por isso CONCERNS, não PASS — e não FAIL. Inventar p95 seria o STOP.

MNT-01 (callTESS sem clamp) e OBS-01 (resume sem turno) são low. Sem patch neste gate.

## Publish

`blocks_publish` vazio. Orion **pode continuar o epic** sem publish. Este gate **não** autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, smoke `0007`, paste 46589, religar, Nginx reload, Kapso, POST Trinks.

Nenhum código de aplicação foi alterado nesta revisão — só gate, handoff e QA Results da story (T3).

— Quinn, guardião da qualidade 🛡️
