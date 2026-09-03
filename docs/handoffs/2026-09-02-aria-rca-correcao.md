# Aria — RCA + plano de correção (Tess 46589 pós-release)

**Persona:** Aria (@architect)  
**Orquestração:** Orion (@aios-master) · incidente `tess-46589-nova-versao-errou`  
**Rev:** 3 — Quinn `*verify-trinks-commit` FAIL + Mira `*audit-floor-quality` incorporados  
**Escopo:** análise + plano. **Zero implementação. Zero POST Trinks. Zero cola TESS.**

**Peers:** Dex live-evidence ✅ · Atlas ✅ · Nox patrol ✅ · Quinn verdict ✅ · Mira floor ✅  
Nenhum **[VIVO-PENDENTE]** restante nesta orquestração.

**Hold:** Dex-Night **não patcha** até Orion ACK (ver §6). Quinn FAIL = pode **planejar**; **não** é autorização de rsync. Unit 118/118 **não** basta.

---

## 1. Causa raiz + 2 contribuintes

**Causa raiz (uma frase):** Na versão nova o commit (cadastro, janela, SKU do Rosa) e a boca da Tess não são a mesma fonte — `POST /clientes` sem `TipoId` derruba o CREATE, o turno seguinte afirma o que failed/blocked recusou, e o PUT 204 pode gravar Barba quando o Rosa era Corte.

**Contribuinte A — H1 I2 (Quinn #1, Nox high):** `createClientInTrinks` `telefones:[{ddd,numero}]` sem `TipoId`. `0101` 02:13:03Z — 1 SKU Corte Feminino + Giovanna 14:30 + Ok; GET miss → 400 → 0 POST agenda. `booking.created` da janela só em cliente já existente (`5718`, `8741`).

**Contribuinte B — H2 I1 (Quinn #2 + Mira negócio):** I.8 L309 / I.12 L351 ensinam afirmar na tag (“Tá garantido”; “emitida a tag, está criado”). C3 não cobre “já confirmamos” / “tudo certo com a X”. 2-phase é honesto no **primeiro** break (`0101` 02:13:03Z PASS copy); o turno seguinte mente (`0101` 02:13:46Z, `9605`, `5718`, `5668`).

**Conflito `2185` resolvido (Nox vs Quinn):**  
Nox I1 cliente PASS = HTTP PUT 204 + “Pronto, reagendei” (commit **existiu**).  
Quinn I1 FAIL = Trinks ficou **Barba** 04/09 15:00; Rosa era **Corte**. Mira: não tratar PUT 204 como vitória de SKU (`0160` igual, Barba 09:00).  
**[AUTO-DECISION]** I1 tem duas camadas. Nox cobriu (a) afirmação↔HTTP. Quinn cobriu (b) afirmação↔SKU do Rosa. (b) vence: 2xx do serviço errado é `false_confirm` de negócio. P0.6 = amarrar PUT ao id/SKU do Rosa, não só emitir `booking.rescheduled`.

C1/C2/C3 **não reincidiram** nos last4 da manhã (Quinn + Mira). Wave0 = P3. C2 **mitigado**: Mira `5668` 21:30Z `available=false` synced 22:12Z.

Quinn **deploy-gate FAIL.** Não redeployar sem §5 itens 1–3 (e 4–5 no mesmo gate).

---

## 2. Cadeia: sintoma → código/prompt/ops → invariante

| # | Sintoma (last4 / ts) | Camada | Invariante | Veredito |
|---|---|---|---|---|
| N1 | `0101` 02:13:03Z — POST `/clientes` 400 TipoId; 2-phase “problema técnico” | `createClientInTrinks` | **I2** | Quinn: fail do **create**; copy deste turno **PASS** |
| N1b | `0101` 02:13:46Z — “remarcar o corte que **já confirmamos**”; 0 appointment | I.8/I.12 + C3 curto; UNCERTAIN FULL 29054/94531 | **I1** | Quinn **FAIL P0** (único fio pós-v3.2.1) |
| N1c | `0101` 02:15:14Z — `tess.empty` credits=0, fallback humano, 0 `handoff.human` / `bot_thread_state` | empty-TESS sem notify | **I2** | Quinn **FAIL** |
| N2 | `9605` 21:43Z — 3× CREATE Fefe 09:00 → janela blocked; “Tudo certo com a manicure…”. Fefe 09:00 já ocupada (outro cliente) | tag≠reserva (I.12); oferta sem recheck | **I1** | Mira I1; Nox false_confirm |
| N3 | `5718` 16:19Z — POST 201 só franja `525828063` **15:00**; falou **15:30** + “franja + Escova”. 15:00 **fora** da grade Gi (14:30/15:30/17:30) | 2-phase “Prontinho”+“não fecha” → turno seguinte funde; relógio gravado ≠ falado | **I1+I3** | Quinn **FAIL** · Mira confirmacao+horarios 0 |
| N4 | `2185` 20:00Z — PUT 204 “reagendei 15:00”; Trinks **Barba**; Rosa **Corte**. Sem `booking.*` | reschedule sem bind SKU/id do Rosa | **I1** | Quinn **FAIL** (Nox PASS HTTP **superado**) |
| N4b | `0160` 14:13Z — PUT 204 “reagendei 09:00”; Trinks Barba 04/09 09:00; fio Corte. 14:10 `tess.empty` UNCERTAIN | mesma N4; **borda** 13:54–15:02 (pré-StartedAt 15:02) | **I1** (+ I2 empty) | Quinn **FAIL** — tratar com N4, não Wave0 |
| N5 | `5668` 21:22Z — “17h30 (já confirmamos)”; CREATE blocked; Balcão **18:30** `526002012`. C2 marcou 21:30 occupied 22:12Z | H2 + humano na Trinks | **I1** | Mira I1; **não resume** |
| N6 | `8741` 19:33Z — POST 201 adulto 14:00; 2º infantil blocked; “Prontinho” + “não fecha” | combo 1/2 | **I1** | Quinn **CONCERNS** · Mira **win** (bolha lista só o SKU gravado) |
| N7 | `8397` 19:52Z — cancel 0; “Não consegui… recepção” | 2-phase honesto | **I1** | Quinn **PASS** |
| N8 | `4749` 21:19Z — “me passaram 14h” Tiago; guard 30min contínuos < 60; `ends_at` null + dois átomos 17:00Z+17:30Z | contíguo / I.1.10 recheck | **I3** | Mira fail horarios · Quinn → Floor |
| N9 | `7163` Jackie+retoque incompatible; Jackie **não** em `trinks_service_professionals` `14232893` mas **tem** retoque na agenda; vazou HABILITACAO | sync habilitação | roteiro | Mira; **não resume** |
| N10 | `8134` mão+pé Fe/Eli → `dado_indisponivel` no 2º turno | I.1.8 não listou 1–2 inícios | **I2** | Mira caso_simples 0 |

**Cadeia canônica (`0101`, único tráfego pós-cola v3.2.x):**

```
1 SKU + Gi 14:30 + Ok  →  GET miss  →  POST /clientes sem TipoId → 400
  → booking.failed + 2-phase honesto          ✓ Quinn I1 neste turno
    → “já confirmamos”                        ✗ I1
      → “Outro dia” UNCERTAIN FULL ~94k
        → tess.empty credits=0, 0 handoff     ✗ I2
```

**Cadeia SKU (`2185` / `0160`):**

```
Rosa = Corte  →  PUT 204 “Pronto, reagendei”
  → Trinks = Barba (mesmo horário)
    → I1 HTTP (Nox) PASS · I1 identidade (Quinn) FAIL
```

**Cadeia tag=agenda (Mira):**

```
I.8 / I.12 mandam afirmar na tag
  → guard/Trinks recusam (9605 3×, 5668, 5718 2º)
    → cliente ouve “tudo certo / já confirmamos / franja+escova 15:30”
```

Wave0 manhã (`2513` `4700` `5389` `7434` `7247` `8027` `8528`): **não reincidiu** (Quinn). P3.

---

## 3. O que NÃO é causa (descarte com evidência)

| Hipótese descartada | Evidência |
|---|---|
| Drift de deploy / C1–C3 incompletos como P0 das 02:13 | Dex MD5; Quinn reincidência manhã = **não**; Mira C1 não visto; C2 `5668` markSlot ok; C3 `Confirmado,` não voltou |
| Leak scratch | Quinn + Dex `tags.leaked=0` |
| Créditos como P0 do TipoId | Nox P2; `0101` empty é **efeito** do FULL pós-fail |
| `2185` = só gap de evento / I1 cliente PASS | **Superado.** Quinn+Mira: SKU Barba ≠ Corte. Evento `booking.rescheduled` sozinho **não** fecha I1 |
| Wave0 = falha da versão 15:02 | Quinn 0 events nesses last4 |
| Veto cego `distinctServiceIds >= 2` | `5718`/`8741` POST 1º; 2º = janela |
| Soma 10h+11h=90 | `4749` = contínuos 30<60 em átomos (possível bug `ends_at` null), não soma inventada |
| Cola v3.2.1 fechou I1 | Único fio pós-cola = `0101` FAIL. Mira: I.8 já começou em `0101` 02:12Z |
| `8741` = mesmo I1 que `5718` | Quinn CONCERNS; Mira win (copy do 201 lista só o SKU gravado) |
| Overlay appointments como P0 | Mira: C2 já esconde slot do **próximo** fio. I1 do fio atual é copy, não snapshot morto |
| Supervisor 46590 | Fora do 46589 |

---

## 4. Plano em ondas

**[AUTO-DECISION]** Quinn FAIL + “pode planejar / não redeployar sem 1–3” → P0.3/P0.5/P0.6 são o contrato de correção. Dex **HOLD** até Orion ACK. Victor cola = **P1**, não nesta wave (Mira `rule_suggestions` ficam no repo).

### P0 — planejar agora; Dex só após Orion ACK; **sem rsync** até Quinn re-veredito

| # | O quê | Arquivo | Risco | Prova I1/I2/I3 | Dono |
|---|---|---|---|---|---|
| P0.0 | **HOLD patch/rsync.** Quinn 118/118 ≠ deploy | — | Segundo break | Re-veredito Quinn pós-patch nos last4 §5 | Orion ACK → depois Dex |
| P0.1 | Quinn FAIL + Mira floor **fechados**. Próximo Quinn = pós-patch, não re-auditar a mesma janela | — | — | §5 | Quinn (depois) |
| P0.2 | Notify-human: `0101` `9605` `5718` `7163` `5668`. Reconciliar Rosa vs Trinks `0160`/`2185` (Barba≠Corte). Não resume `5668` `7163` Wave0. Não POST 13:30 `2513`. Não gravar 14h `4749` sem recheck | Kapso / Balcão | `9605` acha manicure 9h (slot já de outro) | I1: humano alinha agenda real | **ops humano** |
| P0.3 | **Quinn #1:** `createClientInTrinks` + `Telefones[].TipoId`. Não inventar enum (400 literal `0101`). Replay whitelist **nova**, não `0101` | `backend/server.js` ~733 | tipoId errado = 400 em todos os cadastros | I2: `/clientes` 2xx + `booking.created` no Ok; 0× 400 TipoId | **Dex-Night** |
| P0.4 | Overlay appointments **não é P0** (C2 ok em `5668`). `9605` 9h Fefe ocupada = oferta sem recheck → P1.7 | — | Falso ocupado | — | — |
| P0.5 | **Quinn #2 + #4:** estender C3 — após `booking.failed` / `guard.blocked` o outbound **nunca** “já confirmamos” / “tudo certo com [serviço] [hora]” / “seu agendamento está” / “Prontinho + os dois” se o 2º blocked. Flag de thread no **turno seguinte**. Sem cola prompt | `booking-parser.js` + `server.js` | Over-strip “Tá certo?” (Quinn: pergunta ≠ afirmação) | I1: `0101`/`9605`/`5718`/`5668` sem essas frases; `8397` PASS intacto; `8741` não piora | **Dex-Night** |
| P0.6 | **Quinn #3:** PUT reschedule só no `bookingId`/SKU do Rosa (`AGENDAMENTOS FUTUROS`). Se futuro é Barba e texto/Rosa é Corte → 0 PUT + recusa honesta. `0160` 14:13 (borda) + `2185` 20:00. Emitir `booking.rescheduled` no 2xx **do SKU certo** | `server.js` path reschedule + parser | Bloqueia remarcação legítima se Rosa vazio | I1: PUT 2xx ⇒ appointment.service = SKU do Rosa; `2185`-class Barba≠Corte = FAIL | **Dex-Night** |
| P0.7 | **Quinn #5 parcial:** `tess.empty` credits=0 ⇒ `handoff.human` + silence (`0101` 02:15). Não basta fallback Kapso | `server.js` empty-TESS | Resume indevido | I2: empty ⇒ evento + notify; row em `bot_thread_state` | **Dex-Night** |

C1/C2/C3 **não refazer.**

### P1 — amanhã (inclui cola prompt)

| # | O quê | Arquivo | Risco | Prova | Dono |
|---|---|---|---|---|---|
| P1.1 | Mira `rule_suggestions` 1–6: I.8 L309; I.1.17+NUNCA L392; I.12 L351 (tag≠reserva); I.1.3 sem CREATE antes dos 6 campos; I.1.10+I.11 recheck contínuos; I.10 VALIDE (`7163`) | `docs/prompts/tess-conversa-v3-clean.md` + archive | Cola sem P0.5 = modelo afirma e C3 ainda curto | I1 Quinn no primeiro after-hours + `0101`-class | **Victor cola prompt** — **não nesta wave** |
| P1.2 | Pin SCHEDULING pós-failed (não UNCERTAIN/FULL 29k). `0101` “Outro dia”, `0160`/`5958` | `tess-context-intent.js` | Falso SCHEDULING em FAQ | 0 FULL 90k em continuação de fail | **Dex-Night** |
| P1.3 | Contíguo `4749`: dois átomos 30min com `ends_at` null devem somar 60 se adjacentes | `slot-windows.js` / `booking-guards.js` | Libera 60 em buraco real de 30 | I3: 14h Tiago com 17:00Z+17:30Z livres → cabe 60 **ou** recusa se 14:00 não está na grade | **Dex-Night** |
| P1.4 | Combo 2º SKU além do strip P0.5: `5718` gravou **15:00** falou **15:30** — 2-phase só cita start+SKU do POST 201 | `server.js` 2-phase | Cliente acha 15:30 | I3+I1: texto = `dataHoraInicio` real | **Dex-Night** |
| P1.5 | `8134` `dado_indisponivel` no 2º turno — 1–2 inícios do período antes de handoff | slots + prompt I.1.8 (P1.1) | Handoff cego | I2 caso simples tenta grade | **Dex-Night** / Victor P1.1 |
| P1.6 | HABILITACAO stale `7163`: Jackie faz retoque na agenda, tabela não | `trinks_service_professionals` sync | Libera prof errado | Jackie+retoque ≠ incompatible cego | **Dex-Night** / data |
| P1.7 | Recheck oferta vs appointment (`9605` 9h Fefe ocupada) + I.1.10 “me passaram” (`4749`) | `getSlotsGrouped` e/ou prompt | Falso ocupado | I3 oferta ∩ appointment ativo = 0 | **Dex-Night** se P0.5 não bastar |
| P1.8 | `markSlotWindowAvailable` em cancel/PUT | `server.js` ~837 | 13:30 fantasma | I3 duração | **Dex-Night** |
| P1.9 | fail-closed janela se snapshot vazio | `slot-windows.js` | Bloqueia CREATE se GET cair | I3 sem grade → recusa | **Dex-Night** |

### Não fazer

- rsync / rebuild / redeploy antes de P0.3+P0.5+P0.6 no ar **e** Quinn re-PASS.
- Colar prompt 46589 nesta wave (P1.1).
- POST/PATCH no lugar do cliente; resume `5668` `7163` Wave0; POST 13:30 `2513`; gravar 14h `4749` sem recheck.
- Replay CREATE `0101`.
- Refazer C1/C2/C3.
- Tratar PUT 204 `0160`/`2185` como vitória (Barba ≠ Corte).
- Inventar `tipoId`.
- Rollback FULL / desligar scoped.
- git push / `BOT_ACCEPT_ALL`.

**Trade-off P0.5 código vs P1.1 prompt:** Quinn #2 é gate de **deploy**. Backend fecha I1 sem cola. I.8/I.12 continuam a ensinar a mentira — P1, não bloqueia o plano de hoje.

**Trade-off P0.6 vs só evento:** emitir `booking.rescheduled` no PUT Barba **piora** o detector (órfão some, I1 SKU continua). Evento só depois do bind de SKU.

**Trade-off P0.3:** enum errado quebra todo cadastro novo. Dex lê contrato; Quinn prova whitelist nova.

---

## 5. Gate — Quinn já FAIL; o que precisa para o **próximo** deploy

Quinn 2026-09-03 02:50Z: **i1_i2_verdict FAIL** · **deploy-gate FAIL**. Saúde ok, leak PASS, creates com outcome PASS, saudação `0101` horarios=1868 PASS. Unit 118/118 **não autoriza rsync**.

Re-veredito só depois de P0.3+P0.5+P0.6 (mínimo Quinn 1–3). Itens 4–5 no mesmo checklist.

| # | Quinn “não redeployar sem” | last4 prova | PASS quando |
|---|---|---|---|
| 1 | `TipoId` no POST `/clientes` | whitelist nova (não `0101`) | `/clientes` 2xx + `booking.created`; 0× 400 TipoId |
| 2 | Copy pós-`booking.failed` nunca “já confirmamos” / reagendou | `0101`-class | C3 estendido; turno seguinte honesto |
| 3 | Reschedule = SKU/id do Rosa | `0160` `2185` | PUT 2xx ⇒ service = Rosa; Barba≠Corte = FAIL |
| 4 | Combo: não “Prontinho + os dois” se 2º `guard.blocked` | `5718` `8741` | texto = só SKU+hora do 201 |
| 5 | UNCERTAIN↛FULL 29k; `tess.empty` credits=0 → `handoff.human` + silence | `0101` 02:13:38 / 02:15:14 | 0 FULL mid-fail; empty tem evento + `bot_thread_state` |

I3 Mira/Quinn: `5718` 15:30 falado / 15:00 gravado / 15:00 fora da grade. `4749` contínuos. `0101` 14:30 Gi **PASS** slot (create morreu antes).

C1–C3: 0 reincidência manhã — não regressar.

Mira I1 quebrado `9605` `0101` `5718` `5668` — Quinn re-checa copy nesses (ou equivalentes) pós-patch.

ACK Supervisor no `nightwatch-log` **depois** dos itens 1–2 no ar (Quinn). Este RCA **não** substitui esse ACK.

---

## 6. Dex NÃO patcha até Orion ACK

```
HOLD Dex-Night *patch-booking-path
condição: Orion ACK
Quinn: FAIL — planejar SIM; rsync NÃO até re-PASS §5
evidência (last4 + ts + event):
  0101  2026-09-03T02:13:03Z  booking.failed / TipoId     I2
  0101  2026-09-03T02:13:46Z  já confirmamos              I1
  0101  2026-09-03T02:15:14Z  tess.empty                  I2
  9605  2026-09-02T21:43:16Z  tudo certo manicure         I1
  5718  2026-09-02T16:19:11Z  combo + 15:30 vs 15:00      I1+I3
  2185  2026-09-02T20:00:45Z  PUT 204 Barba ≠ Corte       I1
  0160  2026-09-02T14:13:19Z  PUT 204 Barba ≠ Corte       I1 (borda)
  5668  2026-09-02T21:22:38Z  já confirmamos sem booking  I1
  8397  2026-09-02T19:52:43Z  cancel honesto              PASS (não mexer)
proibido até ACK: rsync, rebuild, POST Trinks, cola TESS, resume, git push
escopo pós-ACK: P0.3 TipoId · P0.5 C3 “já confirmamos” · P0.6 SKU Rosa · P0.7 empty→handoff
fora: P1.1 cola prompt · P1.3 contíguo 4749 · habilitacao 7163
```

Nox/Mira `activate-dev` ≠ execução. Quinn “pode planejar” ≠ ACK Orion.

---

## Fontes (rev. 3)

- `docs/handoffs/2026-09-02-quinn-invariants-verdict.md`
- `docs/handoffs/2026-09-02-mira-floor-audit.md`
- `docs/handoffs/2026-09-02-nox-patrol-audit.yaml`
- `docs/handoffs/2026-09-02-dex-live-evidence.md`
- `docs/handoffs/2026-09-02-atlas-padrao-negocio.md`
- Plano + taxonomy Nightwatch (sem re-implementar)

## Lacunas (não inventado)

- Enum `tipoId` ainda só existe como 400 em prod.
- Estado pré-offer `8741` 14h perdido (Quinn CONCERNS).
- `0160` 14:13 é borda 13:54–15:02 — mesmo bug de SKU que `2185`, não Wave0.
- Não executei SSH/SQL nesta sessão — last4 vêm de Quinn/Mira/Nox.

---

*Aria · Architect · rev. 3 · Quinn FAIL + Mira floor · Dex HOLD · cola prompt = P1.*
