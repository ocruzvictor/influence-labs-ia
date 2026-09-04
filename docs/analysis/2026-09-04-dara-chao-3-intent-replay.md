# Chão 3 — replay intent-null (AC4)

**Autor:** Dara (@data-engineer)  
**Motor:** Grok 4.6 High  
**Data:** 2026-09-04  
**Story:** [salon-whatsapp-chao-3-intent-cauda](../stories/salon-whatsapp-chao-3-intent-cauda.md)  
**SOT medida:** [Aria §7](./2026-09-04-aria-chao-3-intent-tetos.md)  
**CLI:** `backend/scripts/salao/contexto/replay_intent_null.js` (`--stdin`)  
**Helper:** `replayIntentNullDrop` em `backend/lib/salao-cli-ops.js` (puro, zero UPDATE)

> last4 only. Sem E.164. Sem “~80%”. Sem fechar as 383. Sem Hostinger. Sem rsync. Sem Trinks. Sem smoke `0007`. Sem tagger Mary. Sem reescrever `computeCorpusStats`.

---

## 0. Veredito

**AC4 fecha como drop-happened.** `would_fill = 626` ≥ 1 no grain user bruto `--no-dedup`. As 383 **não** fecharam.

`baseline_null = 383` permanece a constante Orion. **Não apagada.**

`replay_null = −243` é o número da fórmula. Publicado. Não “corrigir”.

T3 e AC4 na story: **fechados** (drop, não 383-closed).

---

## 1. O que correu (read-only)

1. Turno anterior: CLI local falhou (`DATABASE_URL` vazio). Sem N inventido. Artefato ficou blocker.
2. Orion desbloqueou: SELECT VPS read-only, last4 já no SQL, mesma janela que `dumpFloorCorpus`:

```
created_at >= 2026-09-01 03:00:00 AND created_at < 2026-09-05 03:00:00
```

Zero UPDATE/INSERT/DELETE.

3. Replay local via `--stdin` no helper Dex: grain `user_bruto_passive_replay`, `path=passive`, history `[]`.

*[AUTO-DECISION] Publicar os inteiros do JSON Orion/replay sem renormalizar o 383 → `replay_null` negativo fica (reason: Aria §7.2 fórmula `383 − would_fill`; dump live cresceu; não apagar baseline).*

---

## 2. Inteiros Aria §7.2

Grain = user bruto `--no-dedup`. Filtro `role=user`. Replay `path=passive`. History `[]`.

| Campo | Valor | Fonte |
|---|---:|---|
| `baseline_null` | **383** | constante Orion — **não apagada** |
| `user_n` | **1170** | dump live, grain user bruto |
| `null_rows` | **1042** | dump live (`intent IS NULL`) |
| `would_fill` | **626** | helper `path=passive` |
| `replay_null` | **−243** | `383 − 626` |
| `drop` | **626** | `= would_fill` |
| last4 sample filled | **3 last4** no recorte publicado (máx 12; duplicata `--no-dedup`) | §2.2 |

Não há percentagem-alvo. Não se afirma que as 383 fecharam.

### 2.1 Fórmula (executada)

```
baseline_null     = 383
user_rows         = 1170
null_rows         = 1042
would_fill        = 626
replay_null       = 383 - 626 = -243
drop              = 626
grain             = user_bruto_passive_replay
```

### 2.2 last4 sample filled (redactado, sem E.164)

| last4 | Fala (recorte) | `would_intent` |
|---|---|---|
| `0954` | landing Studio Tirra | `SCHEDULING` |
| `8194` | reagendar / corte Erik / 9h / Bom dia Sim | `SCHEDULING` |
| `7584` | Studio Tirra + depilação íntima | `SCHEDULING` |

Duplicatas esperadas no grain `--no-dedup`. Não inventar mais linhas de sample.

---

## 3. Footer — delta vs Orion 383/511

O 383 **não se apaga**. O dump live divergiu. Delta só aqui.

| Campo | Orion (extract) | Live (este replay) | Delta |
|---|---:|---:|---:|
| `user_n` | 511 | 1170 | **+659** |
| `null_rows` / baseline | 383 | 1042 | **+659** |
| `tess_replied` threads | 90 | 90 | 0 |

As 659 rows user a mais na janela live são **todas** intent-null (a semana cresceu depois do extract). Por isso `would_fill` (626) > `baseline_null` (383) e `replay_null` é negativo. A fórmula **não** troca o 383 pelo 1042.

---

## 4. Gate Aria §7.3

| # | Cláusula | Estado |
|---|---|---|
| 1 | `would_fill >= 1` | **yes** — 626 |
| 2 | quatro fixtures §8.1 no mesmo helper entram em `would_fill` | **yes** no helper (L1/D1/N1/F1); live sample inclui landing Studio Tirra (`0954`, `7584`) |
| 3 | denylist §8.2 **não** entra em `would_fill` | **yes no helper isolado** — **não** afirmar dump-wide (denylist não re-corrida no live) |
| 4 | quatro inteiros + sample last4 ≤12, sem % | **yes** — §2 |

**§7.3 = PASS** (drop-happened). **Não** = 383-closed.

---

## 5. Helper isolado (ainda válido; não é o N)

Mesmo `replayIntentNullDrop`, rows sintéticas last4, sem banco.

| # | last4 | persist passive |
|---|---|---|
| L1 `Oi, vim pelo Studio Tirra. Quero agendar` | `0007` | `SCHEDULING` |
| D1 `sexta final do dia` | `4749` | `SCHEDULING` |
| N1 `com o André` | `0285` | `SCHEDULING` |
| F1 `aceita pix?` | `0007` | `FAQ` |

`would_fill` neste conjunto = **4**. Denylist Z1–Z8: `would_fill = 0`. Não reabrir como cobertura live.

---

## 6. Footnote — grain dedup (não é gate)

Não publicado neste turno. AC4 olha **só** o grain bruto.

---

## 7. Residual (não fecha as 383)

1. **383 não closed.** Drop 626 no grain live ≠ classificar o leftover Orion.
2. **History `[]`.** Mid-funil no dump sub-estima fill. Não completar com sessão.
3. **`replay_null = −243`** porque o dump live cresceu (+659 user, todas null). Não “fixar” a fórmula nem trocar o baseline.
4. Denylist **não** foi re-medida no live — só helper.
5. Passive+bot duplicata: unique last4+texto pode mal mexer. Gate só no bruto.

---

## 8. File List deste turno

- `docs/analysis/2026-09-04-dara-chao-3-intent-replay.md` — inteiros AC4: 383 / 1170 / 626 / −243

Story T3 / AC4: **fechados** (drop-happened).

— Dara, arquitetando dados 🗄️
