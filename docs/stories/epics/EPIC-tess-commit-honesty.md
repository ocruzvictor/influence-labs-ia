# EPIC: Commit e fala da Tess são a mesma fonte (I1/I2/I3)

**Status:** Code Done (1–7 unit) — cola TESS / deploy fora  
**Criado em:** 2026-09-03  
**Rev. 1:** 2026-09-03 — @pm `*create-epic` YOLO; stories detalhadas = @sm  
**Owner:** @pm  
**Handoff SOT:** [docs/handoffs/2026-09-02-aria-rca-correcao.md](../../handoffs/2026-09-02-aria-rca-correcao.md) (Aria rev. 3)  
**Peers SOT:** [Orion consolidado](../../handoffs/2026-09-02-orion-audit-consolidado.md) · [Quinn I1/I2/I3](../../handoffs/2026-09-02-quinn-invariants-verdict.md) · [Nox patrol](../../handoffs/2026-09-02-nox-patrol-audit.yaml) · [Plano go-live](../../ops/plano-correcao-go-live-tess-2026-09-02.md)  
**Incidente:** `tess-46589-nova-versao-errou` — versão nova: `POST /clientes` sem `TipoId` derruba CREATE (`0101`); o turno seguinte afirma o que failed/blocked recusou; PUT 204 pode gravar Barba quando o Rosa era Corte (`2185`, `0160`).  
**ACK Orion (esta missão):** Dex pode **planejar e implementar no repo**. Sem rsync, sem git push, sem POST Trinks, sem colar prompt TESS 46589.  
**Branch sugerida:** `feature/tess-commit-honesty`

## Objetivo

No caminho de agenda (cadastro, CREATE, reschedule, empty-TESS), o **commit Trinks** e a **fala da Tess no WhatsApp** passam a ser a mesma fonte: I1 (sucesso só com 2xx do SKU certo), I2 (1 SKU + slot + prof → POST 2xx ou recusa honesta, inclusive cliente novo e `tess.empty` → handoff), I3 (relógio falado = início real da snapshot / duração contínua). Quinn re-veredita I1/I2 em classe `0101` **em unit**. Deploy VPS **não** é DoD desta entrega.

## Personas

| Persona | Superfície | Job |
|---------|------------|-----|
| Cliente (WhatsApp) | Fio Tess 46589 | Ouvir só o que a Trinks realmente gravou ou recusou |
| Tess | Prompt 46589 + 2-phase + sanitize | Não afirmar tag/turno seguinte se HTTP failed/blocked ou SKU ≠ Rosa |
| Dex | Repo `backend/` | P0.3/P0.5/P0.6/P0.7 + P1 código; zero rsync |
| Quinn | Unit + re-veredito I1/I2 | Gate de honestidade; 118/118 **não** autoriza rsync |
| Victor | Cola TESS 46589 | Único que cola P1.1; story 5 só deixa o diff no repo |
| Ops humano | Kapso / Balcão | Notify `0101` `9605` `5718` `7163` `5668` — **fora** deste epic de código |

## IN

- **P0.3** — `createClientInTrinks` envia `Telefones[].TipoId` (contrato Trinks; 400 literal `0101`). Não inventar enum. Replay em whitelist **nova**, não `0101`.
- **P0.5** — Estender C3: após `booking.failed` / `guard.blocked`, o outbound do **turno seguinte** nunca “já confirmamos” / “tudo certo com [serviço] [hora]” / “seu agendamento está” / “Prontinho + os dois” se o 2º blocked. Flag de thread. Sem cola prompt. `8397` PASS intacto. Não over-strip “Tá certo?” (pergunta ≠ afirmação).
- **P0.6** — PUT reschedule só no `bookingId`/SKU do Rosa (`AGENDAMENTOS FUTUROS`). Futuro Barba + texto/Rosa Corte → 0 PUT + recusa honesta. Emitir `booking.rescheduled` só no 2xx **do SKU certo** (`0160` 14:13 borda + `2185` 20:00).
- **P0.7** — `tess.empty` + credits=0 ⇒ `handoff.human` + silence + row em `bot_thread_state` (`0101` 02:15). Fallback Kapso sozinho não basta.
- **P1 código / prompt-no-repo** — P1.1 diff em `docs/prompts/` (Victor cola depois); P1.2 pin SCHEDULING pós-failed (não UNCERTAIN/FULL 29k); P1.4 2-phase cita só start+SKU do POST 201; P1.3/1.7/1.8/1.9 I3 (contíguo, recheck oferta, `markSlot` em cancel/PUT, fail-closed snapshot vazio).

## OUT

- rsync / rebuild / redeploy VPS.
- Colar prompt TESS 46589 (Victor; story 5 não cola).
- Replay CREATE `0101`.
- Resume `5668` / `7163` / Wave0 (`2513` `4700` `5389` `7434` `7247` `8027` `8528`).
- POST/PATCH Trinks no lugar do cliente; POST 13:30 `2513`; gravar 14h `4749` sem recheck.
- Refazer C1/C2/C3 (não reincidiram na manhã).
- Inventar `tipoId`.
- Overlay appointments como P0 (C2 já esconde slot do próximo fio).
- Rollback FULL / desligar scoped.
- git push / `BOT_ACCEPT_ALL`.
- P0.2 notify-humano (ops paralelo, não story).
- P1.5 `8134` `dado_indisponivel` / P1.6 HABILITACAO stale `7163` (Aria: fora desta wave de correção).
- Epic resume-ia 5668/7163/Wave0; Supervisor 46590.

## Stories (IDs travados — River usa os mesmos paths)

| # | Story | P | Depende | Pts | Status | Pode executar agora |
|---|-------|---|---------|-----|--------|---------------------|
| 1 | [TipoId POST `/clientes`](../salon-whatsapp-tess-commit-1-tipoid-cliente.md) | P0.3 | — | 5 | Done | Gate PASS (`tess-commit.1`) |
| 2 | [Sanitize C3 turno seguinte](../salon-whatsapp-tess-commit-2-sanitize-pos-falha.md) | P0.5 | — | 5 | Done | Gate PASS (`tess-commit.2`) |
| 3 | [PUT = SKU Rosa + `booking.rescheduled`](../salon-whatsapp-tess-commit-3-reschedule-sku-rosa.md) | P0.6 | — | 8 | Done | Gate PASS (`tess-commit.3`) |
| 4 | [`tess.empty` credits=0 → handoff](../salon-whatsapp-tess-commit-4-empty-handoff.md) | P0.7 | — | 5 | Done | Gate PASS (`tess-commit.4`) |
| 5 | [Diff prompt I.8/I.12 no repo](../salon-whatsapp-tess-commit-5-prompt-i8-i12.md) | P1.1 | #2 | 3 | Done | Gate PASS (`tess-commit.5`) · **Victor cola** (fora) |
| 6 | [Pin SCHEDULING + 2-phase hora real](../salon-whatsapp-tess-commit-6-pin-scheduling-2phase.md) | P1.2 + P1.4 | #2 | 5 | Done | Gate PASS (`tess-commit.6`) |
| 7 | [I3 contíguo / recheck / fail-closed](../salon-whatsapp-tess-commit-7-i3-contiguo-recheck.md) | P1.3 / 1.7 / 1.8 / 1.9 | #1 ou paralelo | 8 | Done | Gate PASS (`tess-commit.7`) |

**Soma:** 39 pts. Ordem: **(1 ∥ 2 ∥ 3 ∥ 4) → (5 ∥ 6)** · **7 ∥ 1**.  
Stories **Ready** no disco — @sm `*draft` 2026-09-03. File List / Dev Agent Record vazios até @dev.

### PO validation — 2026-09-03

- **Story 1 — CONCERNS (6/10):** AC2 foi clarificado sem ampliar escopo. O valor contratual de `Telefones[].TipoId` não existe no repo/SOT; não implementar com inteiro, `null` ou `undefined` inventado. AC3–AC5 ficam bloqueados até evidência oficial Trinks.
- **Story 2 — PASS (9/10):** Ready mantido. AC1/AC3 clarificados para aplicar os novos padrões somente no contexto pós-`booking.failed` / `guard.blocked`.
- **Story 3 — PASS (9/10):** Ready mantido. Bind id+SKU, 0 PUT na divergência e evento somente após 2xx estão coerentes e testáveis.
- **Story 4 — PASS (9/10):** Ready mantido. `credits===0`, owner skip, `handoff.human` e persistência de silêncio estão coerentes e testáveis.

**Executor / quality_gate** (executor ≠ gate):

| # | executor | quality_gate | quality_gate_tools |
|---|----------|--------------|--------------------|
| 1–4, 6–7 | `@dev` | `@qa` | `code_review`, I1/I2/I3 unit, contract Trinks |
| 5 | `@dev` (diff no repo) | `@qa` | prompt-diff vs Mira `rule_suggestions`; cola = Victor |

Pre-Commit: @dev. Pre-PR: CodeRabbit 0 CRITICAL (quando houver PR — **Gage**, não Dex). Pre-Deployment: **fora** deste epic.

## Critério de pronto (DoD do epic)

Honestidade: **unit / classe `0101`**, não live VPS. Deploy **não** fecha este DoD.

- [x] Quinn re-veredito **I1/I2** nos last4 `0101`-class (unit): turno do fail honesto **e** turno seguinte sem “já confirmamos” / “tudo certo com…”.
- [x] **0×** HTTP 400 `TipoId` em teste de `POST /clientes` (whitelist nova; não replay `0101`).
- [x] PUT Barba ≠ Corte do Rosa **recusado** (0 PUT + recusa honesta); `booking.rescheduled` só no 2xx do SKU certo. Classe `2185`/`0160`.
- [x] `tess.empty` credits=0 → evento `handoff.human` + silence / `bot_thread_state`.
- [x] C1/C2/C3 **não** regressaram; `8397` PASS intacto.
- [x] `@sm` stories 1–7 no disco; File List de cada story atualizado pelo @dev.
- [ ] Deploy VPS / rsync / ACK Supervisor no `nightwatch-log` **não** são DoD desta entrega (Aria §5 itens 1–3 continuam gate de **próximo** deploy, outro rito).

## Decisões

1. **ACK Orion (2026-09-03):** Dex implementa no repo. Quinn FAIL autorizava **planejar**; este ACK autoriza **código local**. rsync / git push / POST Trinks / cola TESS continuam proibidos.
2. **I1 tem duas camadas** (Aria [AUTO-DECISION]): Nox = afirmação↔HTTP; Quinn = afirmação↔SKU do Rosa. **(b) vence.** PUT 204 do serviço errado é `false_confirm` de negócio. P0.6 amarra PUT ao id/SKU do Rosa — emitir `booking.rescheduled` no PUT Barba **piora** o detector.
3. **Causa raiz (uma frase, Aria):** commit e boca da Tess não são a mesma fonte. Não é drift de deploy. C1/C2/C3 no ar e **não reincidiram**.
4. **P0.3:** enum errado quebra todo cadastro novo. Dex lê contrato; Quinn prova whitelist nova. Enum ainda só existe como 400 em prod — **não inventar**.
5. **P0.5 código vs P1.1 prompt:** Quinn #2 é gate de deploy futuro. Backend fecha I1 sem cola. I.8/I.12 continuam a ensinar a mentira — P1 no repo (story 5); cola = Victor, não nesta wave de deploy.
6. **Overlay appointments não é P0** (Mira: C2 ok em `5668`). `9605` 9h Fefe ocupada = oferta sem recheck → P1.7 (story 7).
7. **`0160` 14:13** é borda 13:54–15:02 — mesmo bug de SKU que `2185`, não Wave0.
8. **Handoff SOT = RCA Aria rev. 3.** Quinn/Nox/Orion/plano go-live só corroboram; PM não inventa requisito fora deles.
9. **7 stories** (acima do guia 1–3 do task brownfield): tabela travada pelo spawn + ondas P0+P1 já sequenciadas no RCA. Sem PRD greenfield.
10. **DoD = unit.** Live VPS e ACK Supervisor pós-itens-1–2-no-ar ficam para o rito de deploy, não para fechar este epic.

## Risk (existente)

- **Primário:** `tipoId` inventado → 400 em todos os cadastros novos (Aria trade-off P0.3).
- **Mitigação:** contrato Trinks + teste 0× 400; rollback = reverter payload `createClientInTrinks` sem mexer C1/C2/C3.
- **P0.6:** Rosa vazio bloqueia remarcação legítima — recusa honesta, não PUT cego.
- **P0.5:** over-strip de pergunta (“Tá certo?”) — Quinn: pergunta ≠ afirmação.
- **Rollback FULL:** **proibido** (OUT). Scoped BOOKING permanece alvo (plano go-live I1–I3).

## Change Log

- 2026-09-03 — @pm (Morgan): `*create-epic` YOLO. Epic Ready para SM. 7 paths travados (39 pts). Sem arquivos de story. Sem código. Sem git commit.
- 2026-09-03 — @sm (River): `*draft` YOLO. 7 stories Ready nos paths da tabela. “Pode executar agora”: 1–4 SIM ∥; 5 e 6 após #2; 7 ∥ #1. Sem código. Sem git commit.
- 2026-09-03 — @po (Pax): `*validate-story-draft` YOLO nas stories 1–4. Story 1 CONCERNS (enum `TipoId` sem fonte contratual); stories 2–4 PASS. ACs 1/2 clarificados sem mudança de escopo.
- 2026-09-03 — @qa (Quinn): `*review`/`*gate` YOLO nas stories 5–7 (P1). Três PASS. Tabela 1–7 → Done. DoD unit marcado; deploy/cola TESS continuam fora. Reexecução 166/166 (P0+P1 honesty) + 98/98 fatia P1.

---

**Handoff @sm (River):** `*draft` as 7 stories nos paths da tabela. Stack existente: Node backend (`server.js`, `booking-parser.js`, `tess-context-intent.js`, `slot-windows.js`, `booking-guards.js`) + Trinks + Tess 46589 + Kapso. Integração: `createClientInTrinks`, sanitize C3 outbound, path PUT reschedule, empty-TESS, pin SCHEDULING, 2-phase, I3 slots. Padrões: C3 já existe (não refazer); 2-phase honesto no primeiro break (`0101` 02:13:03Z / `8397`). Compat: APIs admin/resume intocadas; sem migration nova neste epic. Cada story verifica que C1/C2/C3 e `8397` PASS não regridem. Objetivo: commit e fala = mesma fonte (I1/I2/I3) em unit.

---

*[AUTO-DECISION] 7 stories vs guia 1–3 do brownfield-create-epic → tabela travada + RCA em ondas (reason: SOT do spawn).*  
*[AUTO-DECISION] P1.5/P1.6/P0.2 fora do epic (reason: não estão na tabela; Aria §6 fora habilitacao 7163; P0.2 é ops humano).*  
*[AUTO-DECISION] Code-intel e gotchas.json ausentes → skip silencioso.*  
*[AUTO-DECISION] Elicitação pulada (YOLO + SOT explícito).*  
*[AUTO-DECISION] @sm *draft 2026-09-03: ClickUp skip; code-intel skip; gotchas.json ausente; branch `feature/tess-commit-honesty` documentada, não criada (worktree suja em `feature/resume-ia-pos-handoff`).*
