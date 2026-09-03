# Mira — *audit-floor-quality* (pós-deploy 13:54Z)

**Persona:** Mira (Floor Quality) · motor Grok 4.6 High  
**Orquestrado por:** Orion  
**Janela:** `2026-09-02 13:54:00Z` → `2026-09-03 02:55:00Z`  
**Fonte:** SELECT `conversation_history`, `bot_operational_events`, `trinks_api_requests`, `trinks_appointments`, `trinks_slots`, `trinks_service_professionals` (VPS). last4 only.  
**tess.context_bytes:** 0 rows na janela (evento não emitido).

Não é patch. Não é cola 46589. Não é I1 PASS (Quinn).

---

## floor_report

### counts

| Métrica | n |
|---|---:|
| Threads com turno na janela | 31 |
| Internos excluídos da amostra | `0330` dono, `1234` teste |
| Amostra real | 8 |
| `tags.parsed` | 157 |
| `guard.blocked` | 11 |
| `handoff.human` | 7 |
| `booking.created` | 2 (`8741` `5718`) |
| `booking.failed` | 1 (`0101`) |
| `booking.cancelled` | 1 (`8397` successCount=0) |
| `tess.empty` | 2 (`0160` `0101`) |
| POST `/agendamentos` 201 | 2 |
| POST `/clientes` 400 | 1 (`0101`) |
| PUT `/agendamentos/:id` 204 | 2 (`0160` `2185`) |
| GET (reconcile/snapshot/lookup/consumo) | 44 × 200 |

GET ≠ POST: 13 `slot_snapshot` 200 vs 2 creates. Tag CREATE sem mutação = falha de negócio (não só infra).

### last4 conhecidos de HOJE (ainda ocorrem?)

| last4 antigo | eixo antigo | na janela nova? |
|---|---|---|
| `8027` `8194` `7247` `4700` `8528` | I1 garantia sem commit | **não** — zero rows |
| `1305` combo / `5389` dado_indisponivel / `7434` sem reply | I2 | **não** |
| `2513` slot Erick ocupado | I3 | só 4 user (humano); 0 assistant |
| C1 `profsPayload` crash | código | **não visto** (CREATE chega em 2phase / `booking.failed`) |
| C2 webhook sem markSlot | código | **mitigado** — `5668` 21:30Z marcado `available=false` às 22:12Z |
| C3 sanitize `Confirmado,` | código | **não visto** |
| Time+Tiago grava Balcão | ops | **ainda** — `5668` 18:30 BRT e `3848` 14h sex sem POST do bot |

O padrão I1 **migrou de telefone**, não morreu. I2 `dado_indisponivel` reaparece em `8134`. I3 reaparece em `4749` (30min contínuos) e no relógio falado vs gravado (`5718`).

---

### threads_sampled

Scores 0 falhou / 1 misto / 2 ok. Eixos: roteiro, horarios, confirmacao, trinks, fidelidade, caso_simples.

| last4 | ts (UTC) | roteiro | horarios | confirmacao | trinks | fidelidade | caso_simples |
|---|---|---:|---:|---:|---:|---:|---:|
| `0101` | 02:09–02:15Z 03/09 | 1 | 1 | 0 | 0 | 1 | 0 |
| `9605` | 21:05–21:44Z | 1 | 0 | 0 | 0 | 1 | 0 |
| `5668` | 21:08–21:22Z | 1 | 1 | 0 | 0 | 1 | 0 |
| `4749` | 21:17–21:19Z | 1 | 0 | 1 | 1 | 1 | 0 |
| `5718` | 16:18–16:44Z | 1 | 1 | 0 | 1 | 1 | 1 |
| `8741` | 19:23–19:42Z | 2 | 1 | 2 | 2 | 2 | 1 |
| `8134` | 15:22–15:24Z | 0 | 0 | 2 | 2 | 2 | 0 |
| `7163` | 14:43–16:46Z | 0 | 1 | 1 | 1 | 0 | 0 |

---

### wins[]

1. **Caminho de commit existe.** `8741` POST `/agendamentos` 201 + `booking.created` trinksId `525930541` (Erick corte 12/09 14h BRT = 17:00Z). `2185` PUT 204 + “Pronto, reagendei” no ±2 min.
2. **2-phase honesto no primeiro break.** `0101` 02:13:03Z “problema técnico ao confirmar” bate com `booking.failed`. `8397` cancel `successCount=0` → “Não consegui localizar/cancelar… recepção”.
3. **C1 não repetiu.** Nenhum `profsPayload is not defined`. CREATE chega ao guard/Trinks.
4. **C2 não envenena o próximo no mesmo molde `2513`.** Slot humano `5668` 21:30Z ficou `available=false` (synced 22:12Z).
5. **Combo sequencial no roteiro (`8741`).** 14h + 15h Erick; a bolha de sucesso lista **só** o SKU que gravou. Não desfazer isso.
6. **Handoff paralelo (`3848` 17:17Z `multi_servico`)** quando a cliente pediu duas manicures **no mesmo horário** — alinhado a I.1.12.

---

### fails[]

| last4 | ts | eixo | o que o salão/cliente vê | next_action |
|---|---|---|---|---|
| `9605` | 21:43:16Z | **confirmacao / I1** | “Tudo certo com a manicure amanhã às 9h com a Fefe” depois de **3×** `guard.blocked` `inicio nao esta na grade livre` (826936 / 14129517). Zero POST. Fefe 03/09 09:00 BRT já tem manicure confirmada (outro cliente). | **activate-peer Sentinel** `verify-trinks-commit` |
| `0101` | 02:13:46Z | **confirmacao / I1** + **caso_simples / I2** | Após `booking.failed` (POST `/clientes` 400 TipoId vazio) pergunta se quer “remarcar o corte que **já confirmamos**”. 02:15:14Z `tess.empty` + fallback humano. 1 SKU + 14h30 não fechou. | **Sentinel** I1; **Dev** `patch-booking-path` (TipoId) — não patchar aqui |
| `5718` | 16:19:11Z | **confirmacao / I1** + **horarios / I3** | 2-phase: “Prontinho” franja **e** “não fecha” escova. Turno seguinte: “Seu agendamento está 😊 Corte de franja **+ Escova** … 15:30”. Trinks: só `525828063` franja **15:00 BRT** (18:00Z). Cliente pergunta “Fica 15:30 certo?” → “Fica sim”. | **Sentinel** I1; **Dev** 2-phase / relógio |
| `5668` | 21:22:38Z | **confirmacao / I1** + **caso_simples** | “quinta-feira às 17h30 (**já confirmamos**)”. CREATE 21:19Z bloqueado. Zero `booking.*`. Handoff `encaixe`. Cliente “pode confirmar” em silêncio ACTIVE. Balcão gravou **18:30 BRT** (`526002012`), não 17:30. | **Sentinel** I1; humano já na Trinks — **não resume** |
| `4749` | 21:19:34Z | **horarios / I3** + **roteiro** | Cliente: “Me passaram as 14h” (Balcão). Tess confirma 14h sáb Tiago. Guard: `janela continua 30min < duracao 60min`. Snapshot 21:10Z: Tiago 17:00Z+17:30Z `available=true` (`ends_at` null). Recusou um 60min em dois átomos de 30. Depois “Perfeito!” órfão. | **Dev** `patch-booking-path` (contíguo); prompt I.1.10 recheck |
| `8134` | 15:23:04Z | **caso_simples / I2** + **roteiro** | 1 pedido: mão e pé, Fe ou Eli, sexta tarde ou sábado. Handoff `dado_indisponivel` no segundo turno. Mesmo molde `5389`. | Sentinel I2; prompt I.1.8 + I.11 — listar 1–2 inícios antes de handoff |
| `7163` | 16:44–16:46Z | **roteiro** + **fidelidade** | Jackie + retoque 09:30 → guard `incompatible`. Jackie **não** está em `trinks_service_professionals` para `14232893`, mas **tem** retoque confirmado na agenda (ex. `524130286`). Tess ainda oferece 13h + vaza bloco HABILITACAO. Handoff `conflito_habilitacao`. User 16:46Z “Confirma” sem reply. | **Dev** sync HABILITACAO; **não resume** se recepção pegou |
| `0101` | 02:15:14Z | **trinks / I2** | Cliente nova: pulou I.1.3 (6 campos). `createClientInTrinks` manda `telefones: [{ ddd, numero }]` sem `tipoId` → 400 → FULL → empty. | **Dev** `backend/server.js` ~733 (ticket; Mira não edita) |

I1 **quebrado**. Não declaro PASS.

---

### rule_suggestions[]

Não é “melhorar o tom”. Arquivo + trecho.

1. **`docs/prompts/tess-conversa-v3-clean.md` § I.8 L309**  
   Hoje: `troque "Confirmo aqui então 👀" por: "Vou registrar isso aqui pra você. Como estamos fora do horário, a recepção confere logo cedo amanhã. Tá garantido 😊"`  
   **`0101` 02:12:33Z** já começou esse script (“Como estamos fora do horário, a…”).  
   Trocar por: *mesma* frase neutra de I.1.16 + tag. Banir “Tá garantido” / “já confirmamos” / “tudo certo com a X” até o backend mandar a bolha 2-phase.

2. **`docs/prompts/tess-conversa-v3-clean.md` § I.1.17 + NUNCA L392**  
   Ampliar o ban: além de “Agendado!/Confirmado!/Pronto!”, proibir “já confirmamos”, “seu agendamento está”, “tudo certo com [serviço] [hora]”, “fica sim 15:30” se não houver `booking.created` neste turno.  
   Cobre `9605` `5718` `5668` `0101`.

3. **`docs/prompts/tess-conversa-v3-clean.md` § I.12 L351**  
   Hoje: `Emitida a tag, aquele serviço está criado.`  
   Isso ensina a Tess a narrar sucesso quando o guard **barra** a tag (`9605` 3×, `5668` 21:19Z).  
   Trocar: *tag ≠ reserva. Só o backend confirma. Se a 2-phase disser que não fechou, não diga que está marcado.*

4. **`docs/prompts/tess-conversa-v3-clean.md` § I.1.3 + I.1.16**  
   Cliente sem cadastro Trinks: **não** emitir `[BOOKING_CREATE]` antes dos 6 campos. Se o cadastro falhar, **nunca** “já confirmamos” — handoff `dado_indisponivel` + 1 linha honesta. Caso `0101`.

5. **`docs/prompts/tess-conversa-v3-clean.md` § I.1.10 + I.11**  
   Relógio que “me passaram” (Balcão) **não** é hold. Recheck `HORARIOS VAGOS` + `(NNmin contínuos) >= duracao` **antes** de “Tá certo?”. Caso `4749`.  
   `dado_indisponivel` só depois de 1 tentativa de 1–2 inícios do período pedido. Caso `8134`.

6. **`docs/prompts/tess-conversa-v3-clean.md` § I.10 VALIDE (já existe L332)**  
   Reafirmar: proibido colar `HABILITACAO` / `[Validação…]` no WhatsApp. Caso `7163` 16:45Z (pós-13:54Z).

7. **Dev (ticket, não patch Mira)**  
   - `backend/server.js` ~733 `createClientInTrinks`: `tipoId` no telefone (ler contrato Trinks; não inventar enum).  
   - Contíguo: `trinks_slots.ends_at` null + átomos 30min → `janela continua 30min < 60min` mesmo com 17:00+17:30 livres (`4749`).  
   - 2-phase: não enviar “Prontinho” + “não fecha” no mesmo segundo e deixar o turno seguinte fundir os dois (`5718`).  
   - `trinks_service_professionals`: Jackie `827187` sem `14232893` enquanto a agenda real tem retoque.

---

## causa_raiz_negocio

O salão e o cliente veem **uma reserva feita** (ou um horário “já nosso”). A Trinks, neste deploy, só gravou o que o guard deixou passar — **2 creates e 2 PUTs**. O resto é conversa.

A versão nova **não** é o crash C1 nem o `Confirmado,` C3. O que ainda erra:

1. **A Tess fala como se a tag fosse a agenda.** I.8 (“Tá garantido”) e I.12 (“emitida a tag, está criado”) mandam afirmar. O guard/Trinks recusam. O cliente ouve “tudo certo / já confirmamos / franja+escova 15:30”. Isso é I1 de **negócio** — Quinn prova HTTP; Mira vê a mentira no fio.
2. **Oferta antes do recheck.** Ela propõe 9h Fefe ocupada, 14h Tiago com 30min contínuos, 17:30 “já confirmado” sem POST. O guard salva a Trinks **depois** do cliente já ter dito “ok/isso/correto”.
3. **Cliente nova quebra no cadastro, não no horário.** `0101` fez o roteiro até 14h30 e morreu em `TipoId`. Aí a Tess trata a falha como reserva existente e o crédito acaba (`tess.empty`).
4. **Balcão ainda é a rede — e ainda fala no WhatsApp.** “Me passaram as 14h” (`4749`); humano grava 18:30 (`5668`) e 14h Fefe (`3848`) sem o bot. C2 agora esconde o slot do próximo fio (bom). Não apaga a frase mentirosa no fio atual.
5. **HABILITACAO da tabela ≠ cadeira real.** Jackie faz retoque na Trinks e o bot diz que não faz — depois vaza o bloco e chama humano (`7163`). `8134` nem tenta a grade.

Por isso a versão nova ainda erra no canal ao vivo: o relógio e a garantia saem da **boca** da Tess; o commit depende de cadastro+janela+tabela que ela não espera. O cliente não distingue “Confirmo aqui 👀” de “está na agenda da Giovanna”.

---

## activate-peer

### Sentinel (Quinn) — I1, não declare PASS

```yaml
consumed: false
from: floor-quality
to: quality-sentinel
model: cursor-grok-4.6-medium
task: verify-trinks-commit
invariant_broken: I1
evidence:
  - phone_last4: "9605"
    event: "false_confirm_after_guard"
    timestamp_utc: "2026-09-02T21:43:16Z"
    note: "tudo certo manicure 9h Fefe; 3x guard.blocked; 0 POST"
  - phone_last4: "0101"
    event: "ja_confirmamos_after_booking.failed"
    timestamp_utc: "2026-09-03T02:13:46Z"
    note: "POST /clientes 400 TipoId; tess.empty 02:15:14Z"
  - phone_last4: "5718"
    event: "combo_claimed_one_created"
    timestamp_utc: "2026-09-02T16:19:11Z"
    note: "franja+escova 15:30 falado; só 525828063 15:00 BRT"
  - phone_last4: "5668"
    event: "ja_confirmamos_sem_booking"
    timestamp_utc: "2026-09-02T21:22:38Z"
    note: "17:30 falado; Balcão 18:30; não resume"
```

### Dev (Dex-Night) — I3 / cadastro / 2-phase — NÃO patchar daqui

```yaml
consumed: false
from: floor-quality
to: patch-dev
model: composer-2.5-fast
task: patch-booking-path
severity: P0
invariant_broken: I2+I3
evidence:
  - phone_last4: "0101"
    event: "create_client_TipoId_empty"
    timestamp_utc: "2026-09-03T02:13:03Z"
    files_hint: ["backend/server.js"]
  - phone_last4: "4749"
    event: "contiguous_30_lt_duration_60"
    timestamp_utc: "2026-09-02T21:19:59Z"
    files_hint: ["backend/lib/booking-guards.js"]
  - phone_last4: "5718"
    event: "two_phase_success_plus_fail_then_merge_copy"
    timestamp_utc: "2026-09-02T16:19:05Z"
    files_hint: ["backend/server.js"]
  - phone_last4: "7163"
    event: "habilitacao_stale_vs_live_trinks"
    timestamp_utc: "2026-09-02T16:44:14Z"
    files_hint: ["trinks_service_professionals"]
```

---

## O que NÃO fazer

- Não declarar I1 PASS.
- Não resume `5668` `7163` `4700` `7247` `5389` (silêncio/humano).
- Não POST 13:30 `2513`. Não gravar o 14h `4749` sem recheck.
- Não colar prompt 46589. Não editar `backend/`.
- Não tratar PUT 204 de `0160`/`2185` como vitória de SKU: ambos ficaram “Ação de junho - Barba” 30min, não corte 60min (Quinn confirma).
