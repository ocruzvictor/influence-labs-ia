# Plano — próxima sessão (P2 + chão restante)

> **De:** Orion (`@aios-master`)  
> **ACK Victor:** 2026-09-05 ~16:16 BRT  
> **Branch:** `feature/pilot-first-n-soft-open` · live `c043a75`  
> **Modo live:** WHITELIST · allow só `0007` · FAQ/PRICING info-open · **sem novo PILOT** · `BOT_ACCEPT_ALL=false`

Não inventar AC fora deste plano + handoffs A/B + story PILOT. Dirty honesty **fora**. Push só Gage.

---

## Travas (não reabrir)

| Trava | Valor |
|---|---|
| Novo `startPilot` / N=5 | **Não.** Q5 superseded. |
| OPEN / `BOT_ACCEPT_ALL` | **Não.** FAQ já abre pelo info-open. |
| Hostinger / POST Trinks de teste / paste 46589 sem Victor | **Não.** |
| P2.3 | Código + **cola do prompt** (Victor cola). |
| Chão 10 cancel | Read-only → contrato Aria → Dex **só com GO**. Sem `serieId` inventado. Sem PATCH de teste. |
| Story 5/6 amostra | Tráfego **já live** (info-open + `0007`). **Não** ligar PILOT pra gerar número. |

---

## P3 = P2.2 (+ P2.3 na Daiane)

| last4 | O que falhou no PILOT | Item |
|---|---|---|
| `4749` Vinicius | 14h Tiago não cabe; Tess ofereceu **só 11h** e calou | **P2.2** |
| `4367` Daiane | Dia 12 → handoff seco `encaixe`; cliente “Ok”; **0 msgs depois** | **P2.2** (alternativas antes do handoff) + **P2.3** (última bolha + SLA) |

I1 ok nos dois — não é bug de commit. Conversão.

Código hoje em `CLOCK_HONESTY_FOOTER` (`tess-context-slots.js`): *“ofereça **1** alternativa … ou HANDOFF_HUMAN motivo=encaixe”*. É o dente a trocar.

---

## Ondas (ordem)

### Onda 0 — docs (este turno)

- [x] T11 story + nightwatch
- [x] Smoke #8: Victor ACK *“refiz e passou”*. Log `0007` 04/09 21:06–22:18 (Tiago sáb + André 11/09 14h) + resmoke 23:33 (#1–7 PASS, #8 Erick). **Fecha.** Sem 2 msgs novas.
- [x] Story 5 AC3 query live (abaixo)
- [x] Doc residual 383 + plano de léxico 04–05/09

### Onda 1 — P2.2 (Dex) **feito** · cola em `docs/prompts/tess-46589-p2-alternativas-handoff-linger.md`

### Onda 1 — P2.2 (Dex, sem prompt)

**AC:** pedido que não cabe → **2–3** alternativas (outro horário **e/ou** outro pro listado). Não uma e calar. Handoff `encaixe` **não** é a primeira resposta se ainda houver grade.

Fixtures: Vinicius (14h Tiago cheio → 2–3 outros) · Daiane (dia 12 seco → alternativas noutro dia/pro **antes** de handoff).

Aria: 6–10 linhas no story PILOT (não reabrir assembler). Quinn na fatia.

### Onda 2 — P2.4 (Dex, ops) **feito** (`[booking.digest] last4= trinksId=`)

### Onda 2 — P2.4 (Dex, ops)

**AC:** quando `booking.created`, digest last4 + `trinksId` (evento/log ops). Sem E.164. Fecha o ruído Ronaldo (`5482` / `526831469`).

### Onda 3 — P2.3 (Dex **depois** da cola 46589)

**AC:** após handoff, última bolha *“já te passei, a recepção te chama”* + SLA. “Ok” do cliente **não** some o fio.

Victor cola o prompt. Sem cola = sem patch de boca.

### Onda 4 — Story 5 AC3 (medida, sem PILOT)

Query Dara §4.1 no VPS (não UTC):

| salon_day | daily calls / cr | tess.turn calls / cr | delta | Nota |
|---|---|---|---|---|
| 01–03/09 | só daily | 0 turn | n/a | persist ainda não live |
| 04/09 | 142 / 3657 | 48 / 1143 | 94 calls | persist começou no meio do dia |
| **05/09** | **19 / 415.15524** | **19 / 415.15524** | **0 / 0** | **PASS** (±1) |

`duration_ms` = 0 rows (chão 6). 44 turns antigos sem `salon_day`.

**Fecha AC3** com o dia 05/09. Quinn re-gate opcional (ainda sem teste automatizado da query — residual TEST-01).

### Onda 5 — Story 6 (o que falta de verdade)

AC3 pede p95 BOOKING/FULL. **Não existe** sem `duration_ms` (Aria: ledger só tem `timed_out`). Esperar “1 dia” no ledger atual **não produz p95**.

1. Dara: `duration_ms` no payload de `tess.turn` (sem tabela nova).
2. Dex: gravar elapsed de `callTESS` (sucesso + abort).
3. Medir p95 **depois** de ≥1 dia de tráfego info-open/`0007` — **não** `startPilot`.
4. Só então mexer `TESS_ABORT_MS_*` se p95 heavy > 22000 (sobe teto, <24000) ou lean saudável estourar 13s. **Não** apertar BOOKING abaixo do p95. **Não** subir Nginx 25s.

Até existir p95: tetos 13s lean / 22s heavy **ficam**.

### Onda 6 — Story 3 / léxico 383

Ver `docs/analysis/2026-09-05-orion-lexico-383-residual.md`.  
Dara dump 04/09 12:00 BRT → agora (janela que a Onda 1 **não** pegou) → Aria 2ª onda de classes **só se** o cluster valer a pena → Dex sem 9º intent, sem SKU de sinónimo.

### Onda 7 — Chão 10 (no plano, STOP de cancel)

1. Dara: GET detalhe de **1** série conhecida (id Trinks; sem E.164/nome no doc).
2. Aria: contrato *cancela 1* vs *cancela série* vs HANDOFF forever.
3. Dex T3: **só** GO explícito. Zero PATCH de teste.

Oferta já subtrai ocorrência `confirmed`. O buraco é só cancel.

---

## Smoke #8

**Fechado** pelo ACK Victor + log `0007`. Não reabrir no plano.

---

## Commit / push desta sessão

Allowlist docs. Sem dirty honesty. Push Gage quando Victor pedir (T11 já está no working tree deste commit).
