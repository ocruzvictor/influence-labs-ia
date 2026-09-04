# Gate Quinn — fatia item 7 P-BUDGET (teto duro de chars)

> 2026-09-04T14:20Z · Quinn (@qa, Test Architect) · `*gate` sobre **fatia operacional**, não story formal.
> Gate completo: [docs/qa/gates/2026-09-04-fatia-item7.yml](../qa/gates/2026-09-04-fatia-item7.yml)

| Campo | Valor |
|---|---|
| **Decisão** | **PASS** (quality score **91**) |
| SOT | [tetos Aria](../analysis/2026-09-04-aria-p-budget-tetos.md) + [pacote QA](2026-09-04-orion-fatia-item7-qa.md) |
| Branch / base | `feature/tess-commit-honesty` / `9cb5834` · item 7 **uncommitted** |
| Testes | **46/46** (budget + assembler + profiles + bytes-persist) · syntax 4/4 |
| `blocks_publish` | *(vazio)* |
| Publish | **yes-with-conditions** — W3 ACK Victor já feito; **W4 Gage pode proceder** allowlist-only |
| Não executado | deploy, Hostinger, rsync, smoke 0007, André 10:30, CREATE 9800, paste 46589 |

Anti-self-review: Dex (Composer 2.5 Fast) implementou. Quinn não escreveu este código.

## Veredito por item pedido

| # | Verificação | Status |
|---|---|---|
| 1 | Caps Aria (MIN/FAQ 8k, PRICE/CANCEL 10k, BOOKING 16k, FULL 24k; unknown → FULL) | **PASS** |
| 2 | Predicado `dynamicContext.length` (sem somar `user_payload`) | **PASS** |
| 3 | Degrade: drop_slot_days → filter_catalog → shrink_habilitacao → drop_profissionais → shorten_history → truncate_future_bookings → piso | **PASS** |
| 4 | Pisos: último dia BOOKING/FULL; CANCEL ≥1 future booking; PRICE/BOOKING/FULL catálogo 3/stub | **PASS** |
| 5 | `MENSAGEM DO CLIENTE` / `clientLine` fora do teto e fora do trim | **PASS** |
| 6 | `tess.context_trimmed` só se cortou; sem PII no JSON; phone na coluna; **os dois** `assembleTessContext` persistem | **PASS** |
| 7 | Env `TESS_CONTEXT_CAP_*` 1000–100000; 0/abc → default; sem `BUDGET=off` | **PASS** |
| 8 | UNCERTAIN → MIN intacto; `tess-context-profiles.js` sem diff | **PASS** |
| 9 | Fetch não encolheu (`slotDays` igual) | **PASS** |
| 10 | Travas: Hostinger/rsync/46589/`BOT_ACCEPT_ALL`/Trinks mutate/smoke 0007 | **PASS** |
| 11 | Testes 46/46 | **PASS** |

`before_approx_tokens` / `after_approx_tokens`: SOT opcional, Dex omitiu. **Não bloqueia.**

## O que está sólido

**Tetos copiados da tabela.** `DEFAULT_CAPS` é exatamente a constante Aria. Perfil desconhecido cai em FULL 24000 — nunca ilimitado. Env fora da faixa (0, `abc`) volta ao default.

**Predicado certo.** `measureBudgetChars` usa `dynamicContext.length` no live. `user_payload` de 90k não dispara trim. O `total` antigo de `measureContextBlocks` continua somando `user_payload` só na telemetria `tess.context_bytes`.

**Degradação na ordem.** Seis passos nomeados + `hit_protected_floor`. BOOKING/FULL não zeram o último dia se o fetch trouxe ≥1. CANCEL guarda ≥1 agendamento futuro. PRICE/BOOKING/FULL não esvaziam catálogo (3 SKUs ou stub). O commit de cancel **não** usa o array cortado — `processMessage` recarrega `loadClientFutureBookings`.

**Mensagem do cliente intacta.** `buildDynamicContext` não leva `MENSAGEM DO CLIENTE`. O assembler reanexa `clientLine` depois do budget.

**Evento nos dois call sites.** Inbound (`processMessage`) e `runOperatorResumeTurn` persistem `tess.context_trimmed` só se `trimMeta.trimmed`. JSON sem texto de bloco; telefone só na coluna.

**Item 6 intocado.** `git diff tess-context-profiles.js` vazio. UNCERTAIN → MIN nos testes de profiles e assembler continua verde. Fetch (GETs / `slotDays`) não encolheu — o corte é pós-fetch.

## Findings (nenhum bloqueia)

**MNT-01 (low) — higiene W4.** `infra/.env.example` nesta worktree tem o bloco CAP **e** hunks de crédito Tess / TTL / Nightwatch MCP. Gage leva **só** as 7 linhas `TESS_CONTEXT_CAP_*`.

**OBS-01 (low).** Resume persiste trim mas não emite `tess.context_bytes` (já era assim). Budget no assembler vale igual. Sem patch W2.

**QUAL-01 (low).** Se BOOKING passar de 16k e `filter_catalog` rodar, o reformat tira o prefixo `PENTEADO_DISAMBIGUA`. Compact saudável (~10k, 0007) é no-op. Aceito.

## Allowlist para Gage (W4)

```
backend/lib/tess-context-budget.js
backend/lib/tess-context-assembler.js
backend/lib/tess-context-bytes.js
backend/server.js
backend/test/tess-context-budget.test.js
backend/test/tess-context-assembler.test.js
backend/test/tess-context-bytes-persist.test.js
infra/.env.example          # SOMENTE o bloco TESS_CONTEXT_CAP_* (linhas 63-69)
docs/analysis/2026-09-04-aria-p-budget-tetos.md
docs/ops/2026-09-04-orion-workflow-item7.md
docs/handoffs/2026-09-04-orion-fatia-item7-qa.md
docs/qa/gates/2026-09-04-fatia-item7.yml
docs/handoffs/2026-09-04-quinn-gate-item7.md
```

Não levar: `tess-context-profiles.js`, `docs/prompts/README-46589.md`, nginx, frontend, KB, resto dirty (~300 arquivos).

## W4 e publish

| Pergunta | Resposta |
|---|---|
| `blocks_publish` | **Vazio.** |
| W2 (fixes Dex) obrigatório? | **Não.** |
| Victor ACK (W3)? | **Já feito** nesta sessão. |
| Gage pode publicar (W4)? | **Sim**, allowlist-only. Sem rsync, sem Hostinger neste gate, sem 46589, sem `BOT_ACCEPT_ALL`, sem smoke 0007 / André / CREATE 9800. |
| `publish_execution_allowed` | **false** neste YAML — Gage executa W4; este gate não dispara deploy. |
| `publish_planning_allowed` | **true** |

Worktree dirty enorme fora da fatia. Mesma regra do gate slots+contexto: não FAIL por arquivo alheio.

## Limites deste gate

Não autoriza deploy, Hostinger, rsync, `BOT_ACCEPT_ALL`, alteração de allowlist, paste de prompt Tess, mutação Trinks nem smoke WhatsApp. Nenhum código de aplicação foi alterado nesta revisão — só os dois artefatos de QA.

— Quinn, guardião da qualidade 🛡️
