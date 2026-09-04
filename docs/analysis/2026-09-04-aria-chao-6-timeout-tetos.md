# Chão 6 — tetos de abort por perfil Tess (PV-P1-5 / G-P10)

**Autor:** Aria (@architect) · motor **Grok 4.6 High**  
**Data:** 2026-09-04  
**Status:** SOT — Dex implementa **exatamente** esta tabela. Sem A/B. Sem subir 25s.  
**Story:** [salon-whatsapp-chao-6-timeout-perfil](../stories/salon-whatsapp-chao-6-timeout-perfil.md)  
**Fecha:** Pedro PV-P1-5 · G-P10  
**Agente:** 46589 (não partir). Prompt Tess: não colar, não editar.

> **last4 only (`0007`).** Sem E.164. Sem smoke `0007`. Sem Hostinger. Sem religar. Sem Nginx. Sem Kapso. Sem caps de chars (P-BUDGET intocado). Sem skip FAQ inbound.

---

## 0. Decisão única (owner = Aria)

O relógio de `callTESS` deixa de ser um único `AbortSignal.timeout(25_000)`. Cada perfil aborta no **seu** teto, **sempre abaixo de 25s**. O 25s continua sendo a **parede** — não o orçamento.

```
abort_ms(profile) < WALL_MS
WALL_MS = 25000   // TESS_REQUEST_TIMEOUT_MS hoje — NÃO sobe
```

commit-12 permanece: fallback honesto, `tess.timeout`, zero mutação Trinks, `tess.turn` com `timed_out=true` (chão 5, persist local). Este item só troca **quando** o abort dispara.

P-BUDGET corta **chars antes** de `callTESS`. Este item corta o **relógio durante** `callTESS`. Um não substitui o outro.

---

## 1. O que existe (e o que não existe)

### 1.1 Âncoras já medidas (ponto, não p95)

| Âncora | ms | Chars | Fonte | last4 |
|---|---:|---:|---|---|
| **LEAN_ANCHOR** | **7200** | CANCEL lean ~5958 / ~6k | smoke commit-12 + nightwatch P0 PASS; Pedro G-P10; P-BUDGET CANCEL | `0007` |
| **HEAVY_ANCHOR** | **12400** | UNCERTAIN/FULL confirmação ~89k | smoke `8440`; dossiê Aria §2.5; Pedro G-P10 | — |
| **WALL** | **25000** | CANCEL FULL ~91k **abortou** | `TESS_REQUEST_TIMEOUT_MS` em `backend/server.js`; o caso que G-P10 quer detectar *antes* | `0007` (falha original) |

Nginx webhook `location /` já é **35s** (`infra/nginx/default.conf`). A parede de 25s é o **Node → TESS**, não o Nginx. Subir Nginx não fecha G-P10 e está **vetado**.

### 1.2 p95 live — **não há**

| Pedido do AC3 | Estado em 2026-09-04 |
|---|---|
| p95 BOOKING / FULL na story 5 | **Ausente.** Quinn gate `2026-09-04-chao-5-credito.yml` = **CONCERNS**. Persist `tess.turn` existe **local**, **não publicado**. AC3 reconcile da 5 **sem teste**. |
| Um dia de dimensão de produção | **Não existe.** Este teto **não** tem `tess.turn` live. |
| `duration_ms` no ledger | **Não existe.** Dara §2.1 grava `timed_out` (bool), não duração. Mesmo depois de publicar a 5, o SUM do dia **não produz p95 de latência**. |

*[AUTO-DECISION] Não STOP por falta de p95 → tetos conservadores a partir das âncoras já medidas (reason: story T1 aceita “baseline já medido”; inventar p95 seria o STOP; 7,2s / 12,4s são o baseline).*

*[AUTO-DECISION] BOOKING/FULL não usam um p95 inventado → piso = HEAVY_ANCHOR 12400 ms + folga da fórmula §2 (reason: AC3 “não menor que p95”; sem p95, o único relógio pesado que **completou** é 12,4s).*

---

## 2. Fórmula (uma, seis inteiros)

```
WALL_MS          = 25000
HARD_CEILING_MS  = 24000          // 1s de folga vs a parede; abort nunca é a parede
LEAN_ANCHOR_MS   = 7200
HEAVY_ANCHOR_MS  = 12400
FACTOR           = 1.75
ceil_1s(n)       = Math.ceil(n / 1000) * 1000

lean_abort  = min(HARD_CEILING_MS, ceil_1s(LEAN_ANCHOR_MS * FACTOR))
            = min(24000, ceil_1s(12600))
            = 13000

heavy_abort = min(HARD_CEILING_MS, max(HEAVY_ANCHOR_MS, ceil_1s(HEAVY_ANCHOR_MS * FACTOR)))
            = min(24000, max(12400, ceil_1s(21700)))
            = 22000
```

`FACTOR 1.75` detecta degradação (~¾ acima do ponto medido) **antes** do abort genérico. `2.0` no heavy estoura para 24800 → cola na parede (perde o dente). `1.5` no lean (10800) aperta sem p95 de jitter.

`ceil_1s` arredonda **para cima** — conservador, não inventa um relógio mais curto.

---

## 3. Tabela de tetos (ms) — Dex copia estes inteiros

| Perfil | Banda | abort_ms | Âncora | Por que este inteiro |
|---|---|---:|---|---|
| **MIN** | lean | **13000** | proxy LEAN (FAQ/UNCERTAIN sem grade) | Sem relógio próprio. P-BUDGET MIN = 8k, mais leve que CANCEL. Usar o **único** lean medido (CANCEL 7,2s) + fórmula. Não inventar MIN mais apertado. |
| **FAQ** | lean | **13000** | proxy LEAN | Mesmos blocos que MIN (P-BUDGET 8k). AC2 exige FAQ < 25s. Mesmo número que MIN/CANCEL de propósito: uma banda lean. |
| **PRICE** | lean | **13000** | proxy LEAN | P-BUDGET PRICE = CANCEL = 10k chars. Sem latência PRICE. Não criar terceira banda. |
| **CANCEL** | lean | **13000** | **7200 medido** | 7,2s × 1,75 → 12,6s → 13s. CANCEL que passa de 13s já é o regime do 91k disfarçado, não o lean do commit-12. |
| **BOOKING** | heavy | **22000** | piso HEAVY 12400 | **Sem latência BOOKING.** Sem p95. AC3: não apertar abaixo do único heavy que completou (12,4s). Mesmo teto que FULL — não inventar BOOKING “mais rápido”. |
| **FULL** | heavy | **22000** | **12400 medido** (89k) | 12,4s × 1,75 → 21,7s → 22s. 3s antes da parede. P-BUDGET já corta FULL a 24k (o 12,4s foi a 89k) — 22s é folga, não aperto. |

Perfil desconhecido / omitido → **FULL (22000)**, nunca 25000 ilimitado.

```javascript
// Default Dex — copiar estes inteiros. Sem “unlimited”. Sem 25000 no AbortSignal.
const DEFAULT_ABORT_MS = Object.freeze({
  MIN: 13000,
  FAQ: 13000,
  PRICE: 13000,
  CANCEL: 13000,
  BOOKING: 22000,
  FULL: 22000,
});

const TESS_TIMEOUT_WALL_MS = 25_000;      // parede. NÃO passar ao AbortSignal.
const TESS_ABORT_HARD_CEILING_MS = 24_000; // teto de qualquer override
```

Predicado:

```
abort_ms = resolveTessAbortMs(context_profile)
AbortSignal.timeout(abort_ms)     // sempre < 25000
tess.timeout.payload.timeout_ms = abort_ms
```

`TESS_REQUEST_TIMEOUT_MS = 25000` **deixa de ser** o sinal de `callTESS`. Pode permanecer no ficheiro como `TESS_TIMEOUT_WALL_MS` (comentário: parede, não orçamento).

---

## 4. O que o Dex muda (nível arquivo)

Produção JS = Dex. Aria não implementa.

| Arquivo | Ação |
|---|---|
| `backend/lib/tess-timeout-budget.js` | **Novo.** `DEFAULT_ABORT_MS`, `TESS_TIMEOUT_WALL_MS`, `TESS_ABORT_HARD_CEILING_MS`, `parseAbortCaps(env)`, `resolveTessAbortMs(profile, env?)`. Puro: **sem `db`**, sem fetch. |
| `backend/server.js` | `callTESS(messages, rootId, { timeoutMs })`. `AbortSignal.timeout(timeoutMs)`. Em `processMessage`: `abortMs = resolveTessAbortMs(contextProfile)` **depois** do assembler; passar a **todas** as `callTESS` desse turno (principal + retry premium). No catch commit-12: `timeoutMs: abortMs` (não `TESS_REQUEST_TIMEOUT_MS`). Resume (`runOperatorResumeTurn`): mesma resolução a partir de `assembledCtx.contextProfile`. **Não** acrescentar persist `tess.turn` no resume (Quinn OBS-01 da 5 — fora). |
| `backend/lib/tess-timeout.js` | **Intacto** no contrato de copy / `isTessTimeoutError` / `createTessTimeoutEvent`. O caller já manda `timeoutMs`. |
| `infra/.env.example` | Comentar os seis `TESS_ABORT_MS_*` ao lado de `TESS_CONTEXT_CAP_*`. |
| `backend/test/tess-timeout-budget.test.js` | **Novo.** Contratos §6. |
| `backend/test/server-tess-timeout.test.js` | `timeout_ms` do evento CANCEL passa a **13000** (hoje 25000). `tess.turn timed_out` + fallback + zero mutação **permanecem**. |
| `backend/test/tess-timeout.test.js` | Fixture do evento pode usar 13000; copy honesta **não muda**. |

### Não mexer (veto)

- `infra/nginx/**` — webhook já 35s; MCP 120s. **Zero** diff.
- Kapso (painel, webhook secret, ACK). O ACK já saiu antes de `callTESS`.
- `TESS_TIMEOUT_WALL_MS` / parede 25s — **não subir**.
- `backend/lib/tess-context-budget.js` / caps P-BUDGET (8k/8k/10k/16k/10k/24k).
- `backend/lib/tess-context-profiles.js` — UNCERTAIN → MIN permanece.
- `shouldSkipTess` / skip FAQ inbound (OP013).
- Prompt / agente 46589.
- Hostinger, religar, `BOT_ACCEPT_ALL`, smoke `0007`, POST/PATCH Trinks.
- Schema Dara: **não** nascer `duration_ms` neste slice (calibração futura; sem isso não se fabrica p95).
- Migration / tabela nova.

### API mínima

```
resolveTessAbortMs(profile, env?) → integer

parseAbortCaps(env) → { MIN, FAQ, PRICE, CANCEL, BOOKING, FULL }

callTESS(messages, rootId, { timeoutMs } = {})
  timeoutMs omitido / inválido → DEFAULT_ABORT_MS.FULL (22000), nunca 25000
```

Entrada de `resolveTessAbortMs`: string de perfil (`MIN`…`FULL`). Qualquer outra → FULL.

---

## 5. Override por env (opcional)

Sim. **Nomes apenas** — default = tabela §3, **nunca ilimitado**, **nunca ≥ 25000**.

| Env | Perfil |
|---|---|
| `TESS_ABORT_MS_MIN` | MIN |
| `TESS_ABORT_MS_FAQ` | FAQ |
| `TESS_ABORT_MS_PRICE` | PRICE |
| `TESS_ABORT_MS_CANCEL` | CANCEL |
| `TESS_ABORT_MS_BOOKING` | BOOKING |
| `TESS_ABORT_MS_FULL` | FULL |

Parse: inteiro decimal. Aceitar só se `3000 ≤ n ≤ 24000`. Fora disso / vazio / `0` / `25000` / `30000` / negativo / `NaN` → **default da tabela**.

**Não** existe `TESS_ABORT=off`. **Não** existe timeout global único de volta. `TESS_CONTEXT_FORCE_FULL=1` muda o **perfil** para FULL; o abort FULL **22000** continua.

---

## 6. Contratos de teste (Given / When / Then)

Arquivo novo: `backend/test/tess-timeout-budget.test.js` (node:test).  
Arquivo existente: `backend/test/server-tess-timeout.test.js` (commit-12 **continua PASS**, com `timeout_ms` atualizado).

### 6.1 Tabela canónica

- **Given** os seis perfis + `undefined` + `'NOPE'`.
- **When** `resolveTessAbortMs`.
- **Then** MIN=FAQ=PRICE=CANCEL=**13000**; BOOKING=FULL=unknown=**22000**. Todos `< 25000`. BOOKING e FULL `≥ 12400`.

### 6.2 Env na faixa / fora da faixa

- **Given** `TESS_ABORT_MS_CANCEL=9000` → 9000; `TESS_ABORT_MS_FULL=20000` → 20000.
- **Given** `0`, `abc`, `25000`, `30000`, `2000` → default da tabela (CANCEL 13000 / FULL 22000).

### 6.3 CANCEL abort < 25s + commit-12 intacto

- **Given** o fixture atual `Pode cancelar esse também` / last4 `0007`.
- **When** `processMessage` com fetch que aborta.
- **Then** `tess.timeout.payload.timeout_ms === 13000`; copy CANCEL honesta; `tess.turn.timed_out === true`; créditos null; zero POST/PATCH / `tags.parsed` / `markHumanHandled`; payload sem telefone.

### 6.4 FAQ abort < 25s

- **Given** intent FAQ (ex.: `aceita pix?`) com fetch que aborta.
- **When** `processMessage`.
- **Then** perfil FAQ; `timeout_ms === 13000`; copy **não-CANCEL** (`DEFAULT_TIMEOUT_COPY`); `tess.turn.timed_out === true`. Sem skip FAQ (OP013 continua off).

### 6.5 BOOKING/FULL não apertam o piso heavy

- **Given** perfil BOOKING e FULL (fixture SCHEDULING scoped / FORCE_FULL).
- **When** timeout.
- **Then** `timeout_ms === 22000` (≥ 12400, < 25000). Fallback honesto. Sem mutação.

### 6.6 `callTESS` sem timeoutMs

- **Given** terceiro arg omitido.
- **When** `callTESS`.
- **Then** AbortSignal usa **22000** (FULL), não 25000.

### 6.7 Extra obrigatório

- `tess-timeout.test.js` copy + `isTessTimeoutError` **verdes** (AC4).
- Retry premium do mesmo turno recebe o **mesmo** `abortMs` do perfil (não 25000).
- Resume: `callTESS` recebe `resolveTessAbortMs(assembledCtx.contextProfile)`. Sem novo persist.
- Caps P-BUDGET / `tess-context-budget.test.js` **não** entram no diff.

---

## 7. Segurança, compatibilidade, trade-offs

### Segurança

- Evento `tess.timeout` já sem texto de mensagem (commit-12). last4 `0007` só neste doc e nos fixtures.
- Abort mais cedo no lean **reduz** janela de espera após ACK — não aumenta superfície.
- Zero Trinks no caminho de timeout (já é a regra).

### Compatibilidade

- Shape de `tess.timeout` / `tess.turn` **inalterado**. Só `timeout_ms` deixa de ser sempre 25000.
- Fallback commit-12 palavra por palavra.
- P-BUDGET / intent / UNCERTAIN→MIN / skip trivial: intocados.
- Nginx 35s / Kapso ACK: intocados. Dois `callTESS` (premium retry) × 22s ainda podem exceder 35s — **já era** 2×25s; residual, não deste slice.

### Trade-off (por que não 10s lean nem 24s FULL)

| Alternativa rejeitada | Por que não |
|---|---|
| CANCEL = 7200 | Ponto medido, não teto. Jitter de 1s vira falso abort. |
| Lean 10000 | 39% acima de 7,2s; sem p95 de FAQ/PRICE é aperto no escuro. |
| Lean 18000 | Quase o heavy. G-P10 pede **dois regimes**, não uma média nova. |
| BOOKING 16000 | Inventa que BOOKING é mais rápido que o FULL de 12,4s. Vaza AC3. |
| FULL 24000 | 1s da parede — não detecta degradação “antes do abort genérico”. |
| FULL 25000 | É o bug. |
| Esperar 1 dia de `tess.turn` | Ledger sem `duration_ms` **não** entrega p95. STOP eterno. |
| Subir Nginx para 60s | Veto Pedro / story OUT. Não cura lean de 7s esperando 25s. |
| `duration_ms` neste slice | Calibração futura. Não é preciso para abortar no teto. |

### Riscos residuais

| Risco | Mitigação |
|---|---|
| Thinking no painel piora e lean saudável passa de 13s | Env `TESS_ABORT_MS_CANCEL` (≤24000). Recalibrar quando houver `duration_ms`. |
| BOOKING scoped ~10k um dia levar 19s | 22000 ainda passa. Se p95 real aparecer **acima** de 22000, **subir o teto do perfil** (ainda <24000) — nunca a parede. |
| Resume sem `tess.turn` | Quinn OBS-01. Fora. Abort do resume usa o teto; denominador do resume continua furo da 5. |
| AC3 da story 5 (reconcile) aberto | Não bloqueia estes inteiros. Não autoriza relatório live de p95. |

---

## 8. [AUTO-DECISION] log

| Q | Decisão | Por quê |
|---|---|---|
| STOP vs números | **Números** | Baseline 7,2 / 12,4 já medido; p95 inventado seria STOP |
| p95 story 5 | **Não há** | Persist local CONCERNS; sem `duration_ms`; não publicado |
| Fórmula | 1,75× + ceil 1s + teto 24000 | Dente antes da parede; sem aperto no ponto |
| Lean (MIN/FAQ/PRICE/CANCEL) | **13000** | Um número; âncora CANCEL 7200 |
| Heavy (BOOKING/FULL) | **22000** | Piso 12400; sem inventar BOOKING mais curto |
| Unknown | FULL 22000 | Igual P-BUDGET: nunca ilimitado |
| Parede | 25000 intacta | Não é o AbortSignal |
| Nginx / Kapso | **zero diff** | Webhook já 35s; ACK já saiu |
| Caps chars / skip FAQ / prompt | **veto** | Story OUT |
| `duration_ms` no turn | não neste slice | Não fabrica p95; abort não precisa |
| Resume persist | não | OBS-01 da 5 |
| Env ≥25000 | rejeitar → default | Fail-open é o bug |
| Smoke `0007` | não | last4 só no papel |

---

## 9. Retorno Orion

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-04-aria-chao-6-timeout-tetos.md` |
| Abort ms | MIN 13000 · FAQ 13000 · PRICE 13000 · CANCEL 13000 · BOOKING 22000 · FULL 22000 |
| Parede | 25000 — **não sobe** |
| p95 live | **não há** — piso heavy = 12400 medido |
| Evento | `tess.timeout.timeout_ms` = abort do perfil; `tess.turn.timed_out` intacto |
| Próximo | Dex — `tess-timeout-budget.js` + `callTESS(..., { timeoutMs })` |

— Aria, arquitetando o futuro
