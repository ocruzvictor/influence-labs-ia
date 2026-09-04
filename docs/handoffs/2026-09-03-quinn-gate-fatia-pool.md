# Gate Quinn — fatia pool Victor (itens 1, 2, 3, 6, 8, 12, 13, 16)

> 2026-09-04T02:28Z · Quinn (@qa, Test Architect) · `*gate` sobre **fatia operacional**, não story formal.
> Gate completo: [docs/qa/gates/2026-09-03-fatia-pool-victor.yml](../qa/gates/2026-09-03-fatia-pool-victor.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **CONCERNS** (quality score **86**) |
| SOT | [análise Orion](../analysis/2026-09-03-orion-fatia-pool-victor.md) + [pacote QA](2026-09-03-orion-fatia-pool-qa.md) |
| Branch / live | `feature/tess-commit-honesty` / live `b42bb2b` · worktree **uncommitted** |
| Testes | **109/109** (10 arquivos pedidos) · syntax 11/11 |
| W2 antes do ACK | **Não** — CONCERNS sem dente de código |
| Publish | **yes-with-conditions** — W3 ACK Victor, depois W4 Gage allowlist-only. Sem Hostinger/rsync agora |
| Não executado | deploy, smoke 0007, replay André, paste 46589 |

Gate anterior (outra fatia): [2026-09-03-outbox-sla-scoped.yml](../qa/gates/2026-09-03-outbox-sla-scoped.yml). Não reaberto — I1 e SLA desta suíte continuam verdes.

## Veredito por item pedido

| # | Verificação | Status |
|---|---|---|
| 1 | `durationMin` no assembler | **PASS** |
| 2 | Snapshot ≥45 min + `snapshot.stale` | **PASS** |
| 3 | CLI `listar_fila_atendimento` last4 | **PASS** |
| 6 | `UNCERTAIN` → MIN (mesmo `mode=full`) | **PASS** |
| 6 | Confiança baixa + intent conhecido + scoped → perfil do intent | **PASS** |
| 6 | Qualidade: MIN não vira silêncio robótico | **CONCERNS** (QUAL-01) |
| 8 | `persistTessTurnEvent` + agregado diário intacto | **PASS** |
| 12 | `relatar_slo_eventos` `per_hour` | **PASS** |
| 13 | `trace_id` no INSERT + `--trace-id` (180 min) | **PASS** |
| 16 | `confidence` + `context_profile` nos eventos | **PASS** |
| — | I1 sem regressão | **PASS** |
| — | last4-only nas CLIs | **PASS** |
| — | Sem paste 46589 / sem flip `BOT_ACCEPT_ALL` / sem smoke 0007 | **PASS** |

## O que está sólido

**Item 1 — duração no offer.** `assembleTessContext` passa `durationMin: resolveOfferDurationMin(svcPayload.data)` no compact BOOKING (`tess-context-assembler.js:171`). Com SKU ≤3, Tess deixa de ver inícios que não cabem: teste de maquiagem 120 min some o buraco 14:00/14:30 e escreve “sem janela contínua de 120min”. `mode=full` continua no dump `getSlots()` — o rollback do item 1 é revert do wiring.

**Item 2 — snapshot velho.** Limiar 45 min (`SNAPSHOT_STALE_OFFER_MIN`). O bloco HORARIOS ganha `SNAPSHOT: atualizado há N min — … Não afirme vaga como certa.` `server.js:1439-1450` emite `snapshot.stale` com `trace_id`. `getSlotsGrouped` calcula a idade a partir de `synced_at`.

**Item 6 — UNCERTAIN não herda FULL.** O early-return MIN (`tess-context-profiles.js:26-39`) roda **antes** do dump. O dump FULL agora é só `effectiveMode === 'full'` — saiu o `confidence !== 'high' \|\| UNCERTAIN` que explodia crédito. Em scoped, SCHEDULING com confiança `medium` cai em BOOKING, não FULL. Default desconhecido recursa com `scoped`. Tess **ainda é chamada** em UNCERTAIN (`shouldSkipTess` só pega TRIVIAL high).

**CLI / rastro.** `tess.turn` e `tess.context_bytes` persistem confidence, profile, chars, créditos e `trace_id`. `recordTessCredits` (agregado diário) permanece. `listar_fila_atendimento` e `correlacionar --trace-id` saem last4-only; `--trace-id` usa janela 180 min sem o clamp de 30 do last4. `relatar_slo_eventos` ganha `per_hour`.

**Invariantes.** I1 não foi tocado (outbox 4/4). `BOT_ACCEPT_ALL` sem diff. Prompt vivo 46589 sem paste. 0007 só como fixture de teste.

## Findings (nenhum bloqueia)

**QUAL-01 (medium) — CONCERNS pedido pelo Orion.** Frases compostas viram UNCERTAIN e chegam na Tess sem catálogo nem grade. Ela pode desambiguar de forma genérica. Não é silêncio (não skipa). **Não voltar UNCERTAIN para FULL.** Observar `tess.turn` `UNCERTAIN:MIN` depois do publish.

**SLOT-01 (low).** `resolveOfferDurationMin` usa o *máximo* das durações quando há 2–3 SKUs — combo curto+longo esconde inícios do curto. Conservador; o guard de confirmação continua.

**OBS-01 (low).** O JSON de stdout `tess.turn` não leva confidence/trace_id; o evento persistido leva. Só dói grep de container.

## W2 e publish

| Pergunta | Resposta |
|---|---|
| W2 (fixes) obrigatório antes do ACK Victor? | **Não.** Zero `blocks_publish`. QUAL-01 é qualidade aceita, não patch. |
| Victor pode ACK (W3)? | **Sim**, com QUAL-01 visível. |
| Gage pode publicar (W4)? | **Não ainda.** Depois do ACK, allowlist do YAML. Sem rsync, sem Hostinger, sem 46589, sem `BOT_ACCEPT_ALL`, sem smoke 0007. |

Worktree dirty enorme fora da fatia. Não commitiar `docs/prompts/README-46589.md`, `infra/*`, nginx, frontend, KB.

## Limites deste gate

Não autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, alteração de allowlist, paste de prompt Tess, mutação Trinks nem smoke WhatsApp. Nenhum código de aplicação foi alterado nesta revisão — só os dois artefatos de QA.

— Quinn, guardião da qualidade 🛡️
