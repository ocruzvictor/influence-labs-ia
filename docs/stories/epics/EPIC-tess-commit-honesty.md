# EPIC: Commit e fala da Tess são a mesma fonte (I1/I2/I3)

**Status:** Done (1–13) · gates @qa PASS · operação OPEN (novas mensagens) por autorização de Victor — **separada** do DoD; backlog não retomado
**Criado em:** 2026-09-03  
**Rev. 1:** 2026-09-03 — @pm `*create-epic` YOLO; stories detalhadas = @sm  
**Rev. 2:** 2026-09-03 — @sm `*draft` stories 8–11 (Orion smoke `0007`)
**Rev. 3:** 2026-09-03 — Orion/Dex implementou 8–11 no repo (unit); Quinn gate **PASS**
**Rev. 4:** 2026-09-03 — re-gate pós-CodeRabbit: 144/144 focused, 502/502 backend, 79/79 prompts; CodeRabbit **0 findings**
**Rev. 5:** 2026-09-03 — @devops publicou `a413e16` com dependências runtime autocontidas; health VPS **200/ok**; smoke posterior restrito ao allowlist `0007`
**Rev. 6:** 2026-09-03 — story 13 Nightwatch registrada como Done; gate @qa **PASS** (unit); deploy pendente na redação
**Rev. 7:** 2026-09-03 — story 13 **live** em `07f59cb`; docs pós-deploy `ca1b4af`; smoke WhatsApp da 13 **não** executado; customer-wide bloqueado
**Rev. 8:** 2026-09-03 — operação OPEN para **novas** mensagens (`BOT_ACCEPT_ALL=true`, corte `2026-09-03T19:55:18Z` / 16:55:18 BRT) por autorização explícita de Victor; **não** autorizada pelo gate/story 13. Health 200, `mode=OPEN`, TESS 46589. Denylist preservada (1 allow `0007`, 9 block, 7 human_only — block/human_only valem em OPEN). 25 fios antigos aguardam aprovação individual (16 CANDIDATA_PENDENTE + 9 REVISÃO_MANUAL; 4 NÃO RETOMAR). Smoke mutável da Story 13 **ainda não** executado. Docs atuais `975ee1f`.
**Owner:** @pm  
**Handoff SOT (1–7):** [docs/handoffs/2026-09-02-aria-rca-correcao.md](../../handoffs/2026-09-02-aria-rca-correcao.md) (Aria rev. 3)

**Handoff SOT (8–11):** [docs/handoffs/2026-09-03-orion-smoke-0007-bugs.md](../../handoffs/2026-09-03-orion-smoke-0007-bugs.md) (Orion B1–B4)
**Peers SOT:** [Orion consolidado](../../handoffs/2026-09-02-orion-audit-consolidado.md) · [Quinn I1/I2/I3](../../handoffs/2026-09-02-quinn-invariants-verdict.md) · [Nox patrol](../../handoffs/2026-09-02-nox-patrol-audit.yaml) · [Plano go-live](../../ops/plano-correcao-go-live-tess-2026-09-02.md)  
**Incidente:** `tess-46589-nova-versao-errou` — versão nova: `POST /clientes` sem `TipoId` derruba CREATE (`0101`); o turno seguinte afirma o que failed/blocked recusou; PUT 204 pode gravar Barba quando o Rosa era Corte (`2185`, `0160`).  
**ACK Orion (esta missão):** Dex pode **planejar e implementar no repo**. Sem rsync, sem git push, sem POST Trinks, sem colar prompt TESS 46589.  
**Branch sugerida:** `feature/tess-commit-honesty`

## Operação atual (separada do DoD)

Corte: `2026-09-03T19:55:18Z` / 16:55:18 BRT. A story 13 e o gate `tess-commit.13` **não** autorizam `BOT_ACCEPT_ALL` nem abertura customer-wide por si só. Victor autorizou o corte operacional à parte: `BOT_ACCEPT_ALL` false→true no VPS + recreate do backend. Health 200, `mode=OPEN`, TESS 46589; `bot_toggles.global=true` já estava ativo.

Vale só para **novas** mensagens. Não houve resume/backlog automático, mensagem WhatsApp nem mutação Trinks nesta habilitação. Customer-wide no sentido de aceitar novos não-allowlisted está ativo, com denylist preservada (block/human_only continuam valendo em OPEN). 25 fios antigos (16 CANDIDATA_PENDENTE + 9 REVISÃO_MANUAL; 4 NÃO RETOMAR) aguardam aprovação individual; P-STUCK=20 histórico segue follow-up. Smoke mutável da Story 13 ainda não executado. Deploy **não** fecha o DoD deste epic. Histórico até Rev. 7 (OPEN proibido / fora de escopo) permanece válido.

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
- **B1 (P0, story 8)** — `state.createKeys` não sobrevive ao cancel como verdade; skip só se snapshot ativo tem o slot; se skip, nunca “Confirmo aqui” sem 2xx. `findDuplicateAppointment` já ignora `cancelled`.
- **B2 (P0, story 9)** — cancel tag só `trinks_id` de `AGENDAMENTOS FUTUROS`. **0 PATCH** no SKU (`14232906`).
- **B3 (P0, story 10)** — `hasAbortDismissSignal` **e** booking novo na mesma frase → SCHEDULING, não FAQ `abort_draft`.
- **B4 (P1, story 11, depois de 8+9)** — “Pode cancelar esse que a gente acabou de marcar” → CANCEL, não FAQ.
- **P0 timeout (story 12)** — CANCEL de alta confiança não carrega FULL; timeout da TESS gera resposta honesta, sem mutação ou silêncio automático.

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
- Hostinger / rsync / rebuild VPS (Orion 0007: planejar correção, sem rsync nesta wave).
- Live no slot **03/09 10:30 André** (CREATE `0007` 08:15 / cancel ops 09:30). Live seguinte = **outro slot**.
- last4 `0007` como replay de cliente; `0007` só evidência / rótulo de teste.

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
| 8 | [`createKeys` vs cancel + skip honesto](../salon-whatsapp-tess-commit-8-createkeys-cancel.md) | P0 B1 | — | 5 | Done | Gate PASS (`tess-commit.8`) |
| 9 | [Cancel só `trinks_id` — 0 PATCH SKU](../salon-whatsapp-tess-commit-9-cancel-sku-id.md) | P0 B2 | — | 5 | Done | Gate PASS (`tess-commit.9`) |
| 10 | [Abort + booking novo → SCHEDULING](../salon-whatsapp-tess-commit-10-abort-draft-scheduling.md) | P0 B3 | — | 5 | Done | Gate PASS (`tess-commit.10`) |
| 11 | [“Pode cancelar esse…” → CANCEL](../salon-whatsapp-tess-commit-11-cancel-intent-faq.md) | P1 B4 | #8 + #9 | 3 | Done | Gate PASS (`tess-commit.11`) |
| 12 | [CANCEL enxuto + fallback de timeout](../salon-whatsapp-tess-commit-12-cancel-timeout-fallback.md) | P0 | — | 5 | Done | `0b39035` + smoke `0007` PASS |
| 13 | [Nightwatch confiável por timeout e escopo de cliente](../salon-whatsapp-nightwatch-monitoring-scope.md) | P0 confiabilidade | — | — | Done | **`07f59cb` live** · gate PASS · smoke WhatsApp **não** executado |

**Soma estimada:** 62 pts nas stories 1–12 (39 + 18 + 5); story 13 sem estimativa (`—`). Ordem: **(1 ∥ 2 ∥ 3 ∥ 4) → (5 ∥ 6)** · **7 ∥ 1** · **(8 ∥ 9 ∥ 10) → 11** · **12 → 13**.
Stories **8–11 Done** — @dev implementou e @qa aprovou em 2026-09-03 (SOT Orion `0007`). File List / Dev Agent Record preenchidos. Executor @dev Composer · gate @qa PASS. Deploy **não** é DoD e permanece fora desta wave.

**Validação story 13:** AC1–AC12 aprovados; 39/39 focados Nightwatch+Trinks, 531/531 backend, 79/79 prompts, lint/typecheck/syntax/diff PASS e CodeRabbit 0 findings. `tess.timeout` passa a `p0_timeout` separado; `patrolLive` continua global; `verifyCommit`/`listOrphans` correlacionam internamente por telefone completo e janela temporal, com fail-closed `ambiguous_last4`; metadata whitelisted, saída LGPD-safe e operação read-only.

**Gate e limites operacionais:** o gate [`tess-commit.13`](../../qa/gates/tess-commit.13-nightwatch-monitoring-scope.yml) registra `deployed_revision: 07f59cb` (publicado ~19:04 UTC). O gate/story **não** autoriza `BOT_ACCEPT_ALL`, alteração de allowlist ou abertura customer-wide — isso permanece fora do DoD. A operação OPEN para novas mensagens foi habilitada **separadamente** por autorização explícita de Victor em `2026-09-03T19:55:18Z` (docs `975ee1f`); **não** houve retomada de backlog. Smoke WhatsApp/mutável da 13 **não** foi executado. `tess.context_bytes` e mudanças de display em `getThread`/`listStuckThreads` permanecem fora.

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
| 8–10 | `@dev` (Composer 2.5 Fast) | `@qa` | I1/I2 unit classe `0007`; 0 PATCH SKU; intent SCHEDULING |
| 11 | `@dev` (Composer 2.5 Fast) | `@qa` | intent CANCEL; **depois** de 8+9 |
| 13 | `@dev` | `@qa` | Nightwatch+Trinks unit/regression; LGPD/read-only; escopo negativo |

Pre-Commit: @dev. Pre-PR: CodeRabbit 0 CRITICAL (quando houver PR — **Gage**, não Dex). Pre-Deployment: **fora** deste epic.

## Critério de pronto (DoD do epic)

Honestidade: **unit / classe `0101`**, não live VPS. Deploy **não** fecha este DoD.

- [x] Quinn re-veredito **I1/I2** nos last4 `0101`-class (unit): turno do fail honesto **e** turno seguinte sem “já confirmamos” / “tudo certo com…”.
- [x] **0×** HTTP 400 `TipoId` em teste de `POST /clientes` (whitelist nova; não replay `0101`).
- [x] PUT Barba ≠ Corte do Rosa **recusado** (0 PUT + recusa honesta); `booking.rescheduled` só no 2xx do SKU certo. Classe `2185`/`0160`.
- [x] `tess.empty` credits=0 → evento `handoff.human` + silence / `bot_thread_state`.
- [x] C1/C2/C3 **não** regressaram; `8397` PASS intacto.
- [x] `@sm` stories 1–7 no disco; File List de cada story atualizado pelo @dev.
- [x] **B1 (story 8):** CREATE → cancel → mesmo slot mesma sessão → POST de novo (ou recusa honesta); nunca “Confirmo aqui” sem 2xx. Unit classe `0007`.
- [x] **B2 (story 9):** tag `{agendamento_id: 14232906}` + futuro `trinks_id` → **0 PATCH** no SKU. Cancel só `trinks_id` de `AGENDAMENTOS FUTUROS`.
- [x] **B3 (story 10):** “Esquece isso então. Agora só um corte…” → SCHEDULING, não FAQ `abort_draft`.
- [x] **B4 (story 11, P1 depois 8+9):** “Pode cancelar esse que a gente acabou de marcar” → CANCEL, não FAQ.
- [x] **P0 (story 12):** CANCEL high em modo FULL não carrega grade; timeout TESS gera fallback honesto + `tess.timeout`, sem mutação ou silêncio automático.
- [x] `@sm` stories 8–11 no disco; File List / Dev Agent Record preenchidos pelo @dev (2026-09-03). Gate @qa **PASS**; stories 8–11 Done.
- [x] Story 12 implementada, testada e validada no smoke restrito `0007`; abertura customer-wide continua bloqueada.
- [x] **Story 13:** AC1–AC12 e gate @qa **PASS**; **`07f59cb` live** (docs atuais `975ee1f`); `p0_timeout` separado, patrol global preservado, correlação client-scoped/temporal fail-closed, metadata whitelisted e superfícies LGPD-safe/read-only. Allowlist `0007`-only **preservada** (1 allow / 9 block / 7 human_only). Smoke WhatsApp/mutável **não** executado. A story/gate **não** autoriza customer-wide; OPEN para novas mensagens é ato operacional separado (Victor, 19:55:18Z) — backlog não retomado.
- [ ] Deploy VPS / rsync / ACK Supervisor no `nightwatch-log` **não** são DoD desta entrega (Aria §5 itens 1–3 continuam gate de **próximo** deploy, outro rito). Live `0007` **não** fecha DoD; se live, **outro slot**, não 03/09 10:30 André.

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
11. **Smoke `0007` (Orion 2026-09-03):** I1 armadilha Fefe 9h + 2-phase + CREATE André 10:30 (08:15) + `tess.empty` credits=0 **PASS**. Bugs **novos** B1–B4 não reabrem 1–7. last4 `0007` = evidência, não replay. TipoId **não** exercitado — não replay `0101`.
12. **OPEN operacional ≠ DoD do epic (2026-09-03, Victor):** `BOT_ACCEPT_ALL=true` / `mode=OPEN` para novas mensagens foi habilitado por autorização explícita de Victor às `19:55:18Z`, não pelo gate/story 13. Histórico até Rev. 7 (OPEN proibido / fora de escopo) permanece válido. Backlog não retomado; smoke mutável da 13 não executado. Deploy continua sem fechar o DoD.

## Risk (existente)

- **Primário:** `tipoId` inventado → 400 em todos os cadastros novos (Aria trade-off P0.3).
- **Mitigação:** contrato Trinks + teste 0× 400; rollback = reverter payload `createClientInTrinks` sem mexer C1/C2/C3.
- **P0.6:** Rosa vazio bloqueia remarcação legítima — recusa honesta, não PUT cego.
- **P0.5:** over-strip de pergunta (“Tá certo?”) — Quinn: pergunta ≠ afirmação.
- **Rollback FULL:** **proibido** (OUT). Scoped BOOKING permanece alvo (plano go-live I1–I3).
- **B1:** cancel ops não vê `sessionState` — skip deve consultar snapshot ativo, não só dropar o Set no path 4b.
- **B2:** remap SKU→`trinks_id` só se exatamente 1 futuro; senão recusa, não `list[0]`.
- **B3/B4:** não quebrar abort_draft puro (“deixa pra lá” sem pedido novo / com dismiss).

## Change Log

- 2026-09-03 — @pm (Morgan): `*create-epic` YOLO. Epic Ready para SM. 7 paths travados (39 pts). Sem arquivos de story. Sem código. Sem git commit.
- 2026-09-03 — @sm (River): `*draft` YOLO. 7 stories Ready nos paths da tabela. “Pode executar agora”: 1–4 SIM ∥; 5 e 6 após #2; 7 ∥ #1. Sem código. Sem git commit.
- 2026-09-03 — @po (Pax): `*validate-story-draft` YOLO nas stories 1–4. Story 1 CONCERNS (enum `TipoId` sem fonte contratual); stories 2–4 PASS. ACs 1/2 clarificados sem mudança de escopo.
- 2026-09-03 — @qa (Quinn): `*review`/`*gate` YOLO nas stories 5–7 (P1). Três PASS. Tabela 1–7 → Done. DoD unit marcado; deploy/cola TESS continuam fora. Reexecução 166/166 (P0+P1 honesty) + 98/98 fatia P1.
- 2026-09-03 — @sm (River): `*draft` YOLO stories 8–11 (SOT Orion smoke `0007` B1–B4). Status Ready. Executor @dev Composer · gate @qa. last4 `0007` só evidência. Sem código. Sem git commit. Sem rsync. Sem Hostinger. Sem replay `0101`. Live ≠ 03/09 10:30 André. Deploy não é DoD até unit.
- 2026-09-03 — Orion/Dex: implementou stories 8–11 no repo. Status ready-for-review. Unit classe `0007` (guards + cancel-sku + intent) PASS. Sem rsync. Sem git commit. Sem Hostinger. Sem replay `0101`. Live ≠ 03/09 10:30 André. Gate @qa pendente. Deploy **não** é DoD.
- 2026-09-03 — @qa (Quinn): re-gate stories 8–11 **PASS**. Fatia 144/144, backend 502/502, prompts 79/79; CodeRabbit CLI 0 findings após correções de outbound parcial e prioridade B3. Stories 8–11 → Done. Repo não está conectado a uma organização CodeRabbit, então a revisão usou a franquia CLI gratuita. Deploy/rsync continuam fora.
- 2026-09-03 — @devops (Gage): publicou `de044a7` + `a413e16` em `origin/feature/tess-commit-honesty`; primeiro worktree crashou por dependências runtime não versionadas, rollback restaurou `706e6e7`, e o segundo deploy autocontido entrou no ar às `14:51:59Z`. Health HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589; `bot_toggles.global=false`, sem `.env`/POST/PATCH/WhatsApp. CodeRabbit no segundo commit: 0 critical, 4 major e 2 minor advisory, registrados para follow-up.
- 2026-09-03 — Orion: abriu story 12 após o smoke `0007` revelar timeout de CANCEL em contexto FULL. Correção planejada: perfil CANCEL enxuto + fallback honesto com `tess.timeout`; customer-wide permanece bloqueado.
- 2026-09-03 — @dev/@qa: story 12 implementada no working tree. Gate `tess-commit.12` **PASS**: 103/103 focados, 512/512 backend, 79/79 prompts, lint/typecheck PASS e CodeRabbit 0 findings.
- 2026-09-03 — @devops (Gage): publicou `0b39035` no worktree VPS e reconstruiu somente o backend; health interno/público HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589 e allowlist exclusivo `0007` confirmados.
- 2026-09-03 — Nightwatch: smoke pós-publicação `0007` (17:17–17:28 UTC) **PASS** em outro slot: B3 teve SCHEDULING + POST 201; CANCEL usou perfil CANCEL, PATCH 204 e não teve `tess.timeout`; novo CREATE 201 após cancel confirmou B1. Piloto permanece restrito por allowlist.
- 2026-09-03 — Nightwatch: smoke de cliente novo `8440` (18:08–18:15 UTC) **PASS**: POST `/clientes` 201, POST `/agendamentos` 201, `booking.created`, cancelamento 204 e `booking.cancelled`; zero 400 `TipoId`, timeout ou silêncio. Allow temporário removido após a coleta; atendimento geral continua bloqueado.
- 2026-09-03 — @dev/@qa: story 13 `tess-commit.13` concluída e gate formal **PASS** (AC1–AC12): 39/39 focados Nightwatch+Trinks, 531/531 backend, 79/79 prompts, lint/typecheck/syntax/diff PASS e CodeRabbit 0 findings. Escopo limitado a observabilidade LGPD-safe/read-only; sem deploy, push, Hostinger/rsync, allowlist ou abertura customer-wide.
- 2026-09-03 — @devops (Gage): publicou `07f59cb` no worktree VPS; health HTTP 200, `status=ok`, `trinks_ping=ok`, TESS 46589, allowlist `0007`-only preservada; `patrol_live` com `p0_timeout` no live. Sem smoke WhatsApp nesta execução.
- 2026-09-03 — @devops (Gage): docs pós-deploy `ca1b4af` + registro auditável final no epic/gate/dossiê; smoke WhatsApp da 13 continua pendente; customer-wide bloqueado.
- 2026-09-03 — @pm (Morgan): Rev. 8 — registra operação OPEN para novas mensagens (`2026-09-03T19:55:18Z` / 16:55:18 BRT) por autorização explícita de Victor (`BOT_ACCEPT_ALL` false→true, backend recriado; health 200, `mode=OPEN`, TESS 46589). Story/gate 13 **não** autorizam a mudança. Whitelist intacta; block/human_only valem em OPEN. 25 fios antigos aguardam aprovação (16+9; 4 NÃO RETOMAR); P-STUCK=20 histórico. Sem resume/WhatsApp/Trinks nesta habilitação. Smoke mutável da 13 pendente. Docs `975ee1f`. DoD do epic permanece unit; deploy não fecha. Sem código. Sem git commit.

---

**Handoff concluído:** Quinn aprovou stories **8–13** no unit gate. Fatia 8–11: `booking-guards.test.js`, `cancel-sku.test.js`, `tess-context-intent.test.js`, `booking-parser.test.js`, `reschedule-sku.test.js`; story 12: `tess-context-profiles.test.js`, `tess-context-cancel-full.test.js`, `tess-timeout.test.js`, `server-tess-timeout.test.js`; story 13: `nightwatch-ops.test.js`, `trinks-api.test.js`. Gate story 12: **103/103** focados, **512/512** backend, **79/79** prompts. Gate story 13: **39/39** focados, **531/531** backend, **79/79** prompts. Código live: **`07f59cb`** (Story 13 Nightwatch); docs atuais: **`975ee1f`**. Smoke restrito `0007` (Story 12, 17:17–17:28 UTC) **PASS**; smoke WhatsApp/mutável da Story 13 **não** executado. Operação: `BOT_ACCEPT_ALL=true`, `mode=OPEN` para **novas** mensagens (Victor, `2026-09-03T19:55:18Z`); whitelist intacta (1 allow `0007`, 9 block, 7 human_only). Sem resume/backlog automático. 25 fios antigos aguardam aprovação individual.

---

*[AUTO-DECISION] 7 stories vs guia 1–3 do brownfield-create-epic → tabela travada + RCA em ondas (reason: SOT do spawn).*  
*[AUTO-DECISION] P1.5/P1.6/P0.2 fora do epic (reason: não estão na tabela; Aria §6 fora habilitacao 7163; P0.2 é ops humano).*  
*[AUTO-DECISION] Code-intel e gotchas.json ausentes → skip silencioso.*  
*[AUTO-DECISION] Elicitação pulada (YOLO + SOT explícito).*  
*[AUTO-DECISION] @sm *draft 2026-09-03: ClickUp skip; code-intel skip; gotchas.json ausente; branch `feature/tess-commit-honesty` documentada, não criada (worktree suja em `feature/resume-ia-pos-handoff`).*
*[AUTO-DECISION] @sm *draft 8–11 2026-09-03: ClickUp skip; code-intel skip; gotchas.json ausente; elicit pulada (YOLO + SOT Orion 0007). Sem código. Sem git commit. B4 P1 depois de 8+9.*
*[AUTO-DECISION] Orion implementou 8–11 2026-09-03: CodeRabbit `-t uncommitted` skip (worktree 327 arquivos fora do epic). Gate = Quinn unit. Sem rsync. Sem git commit. Sem Hostinger.*
*[AUTO-DECISION] Rev. 8 2026-09-03: registrar OPEN como operação atual **separada** do DoD (não reabrir stories, não alterar ACs, não apagar Rev. 1–7 / OUT / changelog histórico). Motivo: Victor autorizou `BOT_ACCEPT_ALL` às 19:55:18Z; gate/story 13 não autorizam a mudança.*
