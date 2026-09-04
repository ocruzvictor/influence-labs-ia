# P-BUDGET — tetos duros de contexto por perfil Tess (PV-P0-2)

**Autor:** Aria (@architect) · **Data:** 2026-09-04  
**Status:** SOT — Dex implementa **exatamente** esta tabela. Sem A/B. Sem “mandar tudo e rezar”.  
**Item:** Orion 7 / Pedro PV-P0-2 / LibForge P-BUDGET  
**Agente:** 46589 (não partir). Prompt Tess: não colar, não editar.

> **BOOKING cap = 16000 (≥ 16k).** O smoke `0007` scoped BOOKING ~9388 / ~10742 chars **não é tocado** por este teto. Item 7 corta a cauda de 54k/91k, não o piso saudável.

---

## 0. Decisão única (owner = Aria)

Uma constante conhecida por perfil. Unidade = **chars UTF-16 `String.length`** (o que o Node já conta). `approxTokens = ceil(chars/4)` é **só telemetria** — nunca é o predicado do teto.

O teto **não** é o timeout Nginx/Tess de 25s. O 25s continua sendo abort de relógio; o orçamento é decisão de payload **antes** de `callTESS`.

UNCERTAIN → MIN (item 6, live) **não reabre**. `tess-context-profiles.js` não muda de rota neste item.

```
budget_chars ≤ cap(profile)
```

Se `budget_chars > cap` → degradar o payload (passos §3) até `≤ cap` **ou** só restarem blocos protegidos (§4).  
Se ainda `> cap` no piso protegido → enviar o piso, emitir evento com `hit_protected_floor: true`. Nunca reanexar o que foi cortado. Nunca subir timeout.

---

## 1. Tabela de tetos (chars)

Predicado: `budget_chars` = `dynamicContext.length` (§2). Não é `measureContextBlocks().total` (esse total soma `user_payload` e conta histórico duas vezes).

| Perfil | max_chars | Medido 0007 / histórico (scoped salvo nota) | Folga | Por que este inteiro |
|---|---:|---|---|---|
| **MIN** | **8000** | TRIVIAL skip 156; UNCERTAIN MIN **2655** e **6124** | +31% vs 6124 | MIN não busca grade/catálogo. Variável = `historico`. 8k cabe shell + até ~6k de histórico. Acima disso, encurta turnos velhos — UNCERTAIN deve **perguntar**, não reler o fio inteiro. |
| **FAQ** | **8000** | FAQ **5014–5129** | +56% vs 5129 | Mesmos blocos que MIN (shell + histórico, sem Trinks). 5k saudável fica intocado. Mesmo teto que MIN de propósito: um número, dois perfis sem grade. |
| **PRICE** | **10000** | PRICE **6082** / 17,7 cr | +64% vs 6082 | Catálogo filtrado + habilitação + shell + histórico. 6k saudável intocado. 10k força filtrar se o keyword miss despejar o catálogo cheio (~10–14k só de `servicos`). |
| **BOOKING** | **16000** | BOOKING **9388** e **10742** / 18–19 cr | **+49% vs 10742** | **Cap ≥ 16k: 0007 ~10k intocado.** Folga para o dia extra compacto do item 2b (hoje + data pedida) e catálogo um pouco mais gordo. 3 dias compactos cabem; dump gordo de HORARIOS não. |
| **CANCEL** | **10000** | lean CANCEL **~6000** / ~7,2s | +67% vs 6k | Perfil lean já existe (future bookings, sem grade). 6k intocado. 10k cobre vários agendamentos + histórico. O 91k era FULL disfarçado — não é este perfil. |
| **FULL** | **24000** | OPEN ~17h (pré-MIN) avg **54300** chars / 30,9 cr/paga; CANCEL FULL histórico **~91000** timeout; confirmação ~89000 / ~12,4s | corta 54k→24k e 91k→24k | Rollback (`TESS_CONTEXT_MODE=full` / `TESS_CONTEXT_FORCE_FULL=1`) **também tem teto**. 24k ≈ 2,2× o BOOKING saudável — ainda é o perfil mais rico, mas deixa de ser função do catálogo do salão. Pior caso conhecido = **24000**, não 91k. |

Piso Tess neste fio: **~17–21 cr mesmo em MIN**. Este item **não** promete voltar a 13,5 cr. Corta timeout e cauda de input.

```javascript
// Default Dex — copiar estes inteiros. Sem “unlimited”.
const DEFAULT_CAPS = Object.freeze({
  MIN: 8000,
  FAQ: 8000,
  PRICE: 10000,
  BOOKING: 16000,
  CANCEL: 10000,
  FULL: 24000,
});
```

Perfil desconhecido → tratar como **FULL** (24000), nunca como ilimitado.

---

## 2. O que entra na conta (`budget_chars`)

### 2.1 Canônico

```
budget_chars = dynamicContext.length
```

`dynamicContext` é o retorno de `buildDynamicContext` em `server.js` — o prefixo que a Tess recebe **antes** de:

```
\n\nMENSAGEM DO CLIENTE: ${clientLine}
```

`clientLine` = `operatorResumeTrigger || messageText`. **Fora da soma. Fora do trim.**

### 2.2 Equivalente a partir de `blocks` (testes)

```
BUDGET_KEYS = [
  'shell',
  'horarios',
  'servicos',
  'habilitacao',
  'profissionais',
  'historico',
  'future_bookings',
]
```

`measureBudgetChars(blocks)` = soma de `String(blocks[k]||'').length` para `k ∈ BUDGET_KEYS`.

**Nunca some `user_payload`.** `user_payload` hoje **é** o string montado (outros blocos + mensagem). Somar isso é contar duas vezes e fura o teste §8.5.

**Não use** `measureContextBlocks().total` como predicado: aquele `total` inclui `user_payload`.

### 2.3 Higiene do `shell` no assembler atual

Hoje `blocks.shell` é leftover de `.replace` de horarios/servicos/hab/profs e **ainda contém** histórico renderizado + future bookings. Por isso o predicado **live** é `dynamicContext.length`, não a soma crua dos 8 keys de `tess-context-bytes.js`.

No loop de degradação, Dex mede de novo `dynamicContext.length` **depois de cada rebuild**. Se o teste não tiver `dynamicContext`, usa a soma de `BUDGET_KEYS` com um `shell` que **não** inclui `historico`/`future_bookings`.

### 2.4 Onde cortar no fluxo

```
fetch (perfil atual, inalterado)
  → buildDynamicContext + blocks   (como hoje)
  → applyContextBudget             (NOVO, depois do fetch, antes do return)
  → se trimmed: rebuild buildDynamicContext com inputs já cortados
  → userMessageWithContext = dynamicContext + "\n\nMENSAGEM DO CLIENTE: " + clientLine
  → return assembler
  → emitContextBytesLog / persist tess.context_bytes  (já existe, POST-trim)
  → persist tess.context_trimmed se trimmed
  → callTESS
```

Fetch **não** encolhe neste item (nem `slotDays` em `tess-context-profiles.js`). Item 7 é teto de **string enviada**, não novo classificador.

---

## 3. Degradação ordenada (numerada)

Loop: `while (budget_chars > cap && há passo aplicável)`.  
Um passo que não muda chars **não** entra em `steps_applied`.  
Depois de cada passo que muda: rebuild `dynamicContext` (ou, em teste unitário, recomputa a soma) e re-mede.

### Passo 1 — `drop_slot_days`

Primeiro a cair: **dias extra de `horarios`**.

- Entrada obrigatória do assembler: `slotDates: string[]` (ISO) e `slotDayTexts: string[]` alinhados (um bloco por data, **antes** do `join('\n')`).
- Pin (sair por último): `requestedDate` se houver; senão `todayIso`.
- Remover primeiro as datas **não-pin**, da mais distante para a mais próxima.
- Recalcular a linha `DATAS COM DADOS DISPONIVEIS` no rebuild.
- **BOOKING e FULL:** nunca zerar `horarios` se havia pelo menos um dia. O último dia restante é protegido ( Tess sem grade inventa hora — dor do `0007`).
- MIN / FAQ / PRICE / CANCEL: `horarios` já vem vazio → no-op.

### Passo 2 — `filter_catalog`

- Se `servicos` ainda estoura: aplicar `filterServicesByKeywords` (já existe) em `messageText + historico`.
- Se já filtrado e ainda gordo: `data.slice(0, k)` com `k` descendo até **piso 3 SKUs** (se `data.length ≥ 3`).
- Reformatar com `formatServicesText`.
- Não esvaziar PRICE/BOOKING/FULL se havia catálogo: no piso, 3 SKUs ou uma linha stub `SERVICOS: lista truncada pelo orcamento; peca o nome do servico.`
- MIN/FAQ/CANCEL: no-op se `servicos` já é `''`.

### Passo 3 — `shrink_habilitacao`

- Re-render `renderHabilitacaoMap` só com os SKUs que restaram.
- Se ainda acima do teto: `habilitacao = ''`.
- Vazio é permitido. Guards de habilitação no commit **não** leem este bloco.

### Passo 4 — `drop_profissionais`

- `profissionais` texto → `''`.
- Nomes continuam em `servicos` / grade. Lista completa é o bloco mais barato e o menos necessário para o pedido.

### Passo 5 — `shorten_history`

- `historyForModel` é array `{role, content}` (slice -8 de hoje).
- Remover **do mais antigo** (índice 0), um turno por iteração.
- Piso suave: parar de cortar quando restarem **2** turnos, **a menos que** ainda esteja acima do teto — aí 1, depois `[]`.
- A mensagem atual **não** está neste array; não pode ser “cortada” aqui.

### Passo 6 — `truncate_future_bookings`

- Ordenar por `scheduled_at` crescente. Manter os N mais próximos: 3 → 1.
- **CANCEL:** piso **1** se existia algum (sem isso a Tess não tem o quê cancelar).
- Demais perfis: pode ir a `[]`.

### Passo 7 — piso protegido

Se ainda `budget_chars > cap` e os passos 1–6 não têm o que cortar: **parar**. `hit_protected_floor: true`. Enviar o que restou. Não esvaziar §4.

```
1 drop_slot_days
2 filter_catalog
3 shrink_habilitacao
4 drop_profissionais
5 shorten_history
6 truncate_future_bookings
7 stop (protected floor)
```

---

## 4. Blocos protegidos (nunca esvaziar)

A pergunta do turno **não sai**. Shell operacional **não sai**.

### 4.1 Sempre presentes após o trim (strings / funções atuais)

Do `buildDynamicContext` em `server.js`:

| Fragmento | Origem | Pode encolher? |
|---|---|---|
| `CONTEXTO DINAMICO - TRINKS (snapshot local alimentado por webhooks):` | `DYNAMIC_CONTEXT_PREFIX` | não |
| Bloco dono (`renderOwnerContext`) se o telefone é owner | `ownerSection` | não |
| Nota da recepção (`renderOperatorResumeContext`) se houver resume | `operatorSection` | não |
| `HOJE: …` | `formatFullDateLabel(getTodayIsoInSalonTimeZone())` | não |
| `HORARIO_AGORA: …` | `isSalonOpen()` | não |
| `HORARIO DE FUNCIONAMENTO: Ter-Sex 9h-19h \| Sab 9h-18h \| Dom-Seg FECHADO` | literal | não |
| `NOTAS OPERACIONAIS (vale mesmo se a KB TESS estiver desatualizada):` + 3 bullets (Maquiagem/Fefe, Camuflagem, HORARIOS VAGOS/duração) | `OPERATIONAL_NOTES` | não |
| `DATA SOLICITADA: …` se `requestedDate` | `formatRequestedDateLine` | não (a linha some só se não havia data) |
| `DATAS COM DADOS DISPONIVEIS: …` | lista pode **encolher** com o passo 1; a **linha permanece** | lista sim / linha não |
| `DADOS_CLIENTE` / memória persistida | `buildPersistedSection` | não |
| `MENSAGEM DO CLIENTE: ${clientLine}` | sufixo **depois** do teto | **nunca entra na soma, nunca trim** |

### 4.2 Proteção condicional (perfil)

| Bloco | MIN/FAQ | PRICE | BOOKING | CANCEL | FULL |
|---|---|---|---|---|---|
| Último dia de `horarios` (se o fetch trouxe ≥1) | n/a (vazio) | n/a | **protegido** | n/a | **protegido** |
| ≥3 SKUs ou stub de `servicos` se havia catálogo | n/a | piso 3/stub | piso 3/stub | n/a | piso 3/stub |
| ≥1 future booking se havia e perfil CANCEL | n/a | n/a | pode 0 | **≥1** | pode 0 |

### 4.3 Pode zerar

`habilitacao`, `profissionais` (texto), `historico` (depois do passo 5), `future_bookings` (exceto piso CANCEL), dias extra de `horarios`.

---

## 5. Evento operacional

**Nome:** `tess.context_trimmed`  
**Quando:** somente se `before_chars > after_chars` (houve corte). Under-cap = silêncio.  
**Onde:** stdout JSON (grep no container) **e** `bot_operational_events` via `emitOperationalEvent` — mesmo padrão de `persistContextBytesEvent` em `tess-context-bytes.js`. **Sem tabela nova.**

`motivo`: `${intent}:${context_profile}:trimmed` (já é fatiado em 500 chars).

`clientPhone` vai na **coluna** do evento (como `tess.context_bytes`). **Não** repetir telefone, nome, texto de mensagem, histórico ou grade no JSON.

### Payload (sem PII, sem texto de bloco)

```json
{
  "intent": "SCHEDULING",
  "confidence": "high",
  "context_profile": "BOOKING",
  "tess_context_mode": "scoped",
  "before_chars": 42000,
  "after_chars": 15812,
  "cap_chars": 16000,
  "steps_applied": ["drop_slot_days", "filter_catalog", "shorten_history"],
  "days_before": 10,
  "days_after": 2,
  "history_turns_before": 8,
  "history_turns_after": 4,
  "hit_protected_floor": false,
  "sessionId": "…",
  "trace_id": "…"
}
```

`steps_applied[]` usa **só** os nomes estáveis do §3 (`drop_slot_days`, `filter_catalog`, `shrink_habilitacao`, `drop_profissionais`, `shorten_history`, `truncate_future_bookings`).

Telemetria `approx_tokens` **pode** ir no payload (`before_approx_tokens`, `after_approx_tokens`) — opcional, não é predicado.

`tess.context_bytes` continua **depois** do trim (tamanho real enviado). Não substituir um evento pelo outro.

---

## 6. Override por env (opcional)

Sim. **Nomes apenas** — default = tabela §1, **nunca ilimitado**.

| Env | Perfil |
|---|---|
| `TESS_CONTEXT_CAP_MIN` | MIN |
| `TESS_CONTEXT_CAP_FAQ` | FAQ |
| `TESS_CONTEXT_CAP_PRICE` | PRICE |
| `TESS_CONTEXT_CAP_BOOKING` | BOOKING |
| `TESS_CONTEXT_CAP_CANCEL` | CANCEL |
| `TESS_CONTEXT_CAP_FULL` | FULL |

Parse: inteiro decimal. Aceitar só se `1000 ≤ n ≤ 100000`. Fora disso / vazio / `0` / negativo / `NaN` → **default da tabela**.  
**Não** existe `TESS_CONTEXT_BUDGET=off`. **Não** existe cap global único. `TESS_CONTEXT_FORCE_FULL=1` muda o **perfil** para FULL; o teto FULL **24000** continua valendo.

Documentar os seis nomes em `infra/.env.example` ao lado de `TESS_CONTEXT_MODE`.

---

## 7. O que o Dex muda (nível arquivo)

Produção JS = Dex. Aria não implementa.

| Arquivo | Ação |
|---|---|
| `backend/lib/tess-context-budget.js` | **Novo.** `DEFAULT_CAPS`, `BUDGET_KEYS`, `parseContextCaps(env)`, `resolveCap(profile, caps)`, `measureBudgetChars(blocks, dynamicContext?)`, `applyContextBudget(input)`. Puro: **sem `db`**. |
| `backend/lib/tess-context-assembler.js` | Depois do fetch e do **primeiro** `buildDynamicContext`/`blocks`, **antes do `return`**: chamar `applyContextBudget`. Passar `slotDayTexts` alinhado a `slotDates` (parar de join-only). Se trimmed: rebuild `buildDynamicContext` + `userMessageWithContext` + `blocks`. Anexar `trimMeta`. **Não** alterar rota UNCERTAIN. |
| `backend/lib/tess-context-bytes.js` | `persistContextTrimmedEvent(db, payload, clientPhone)` — clone do padrão `persistContextBytesEvent` + `console.log` JSON `event: tess.context_trimmed`. Sem texto de bloco. |
| `backend/server.js` | Após `assembleTessContext`: se `assembledCtx.trimMeta?.trimmed`, persistir o evento (fire-and-forget `.catch(() => {})`). `emitContextBytesLog` já deve ver blocos **pós-trim**. Não mudar `callTESS` timeout. |
| `backend/lib/tess-context-config.js` | Opcional: reexportar caps. Pode ficar só no budget module. |
| `infra/.env.example` | Comentar os seis `TESS_CONTEXT_CAP_*`. |
| `backend/test/tess-context-budget.test.js` | **Novo.** Contratos §8. |
| `backend/test/tess-context-assembler.test.js` | 1–2 casos de integração: BOOKING abaixo do teto inalterado; fat horarios reduz `slotDates`. |

### Não mexer

- `backend/lib/tess-context-profiles.js` — UNCERTAIN → MIN permanece (inclusive com `effectiveMode=full`).
- Prompt / agente 46589.
- Nginx / timeout 25s.
- Hostinger, Trinks mutate, allowlist, `BOT_ACCEPT_ALL`.
- Migrations / tabela nova.
- `measureContextBlocks` keys (pode continuar contando `user_payload` para telemetria).

### API mínima de `applyContextBudget`

Entrada: `{ profile, intent, confidence, mode, dynamicContext, blocks, slotDates, slotDayTexts, requestedDate, todayIso, historyForModel, futureBookings, svcPayload, profsPayload, habilitacaoText, messageText, caps, rebuild }`  
(`rebuild` = função que chama `buildDynamicContext` com os inputs já cortados — o assembler passa a que já tem.)

Saída: `{ dynamicContext, blocks, slotDates, slotDayTexts, historyForModel, futureBookings, svcPayload, profsPayload, habilitacaoText, trimMeta }`  
`trimMeta`: `{ trimmed, before_chars, after_chars, cap_chars, steps_applied, days_before, days_after, history_turns_before, history_turns_after, hit_protected_floor }`.

---

## 8. Contratos de teste (Given / When / Then)

Arquivo: `backend/test/tess-context-budget.test.js` (node:test, como os outros `tess-context-*.test.js`).

### 8.1 BOOKING sob o teto — no-op

- **Given** perfil BOOKING, `dynamicContext` ~10742 chars (ou blocos cuja soma `BUDGET_KEYS` ≤ 16000), `user_payload` irrelevante.
- **When** `applyContextBudget`.
- **Then** `trimmed === false`, `steps_applied === []`, `dynamicContext` idêntico, `slotDates` idênticos. Nenhum persist de `tess.context_trimmed`.

### 8.2 HORARIOS gordo — derruba dias extra

- **Given** BOOKING, 5 dias sintéticos com ~5000 chars **cada** em `slotDayTexts` (total horarios ~25k) + shell pequeno, `requestedDate` = dia do meio, cap 16000.
- **When** `applyContextBudget`.
- **Then** `steps_applied` contém `drop_slot_days`; `days_after < days_before`; `requestedDate` permanece em `slotDates`; `horarios` do último dia **não** é `''`; `after_chars ≤ 16000`.

### 8.3 FULL ~90k — termina ≤ teto FULL

- **Given** FULL, dump sintético ~70k `horarios` + ~15k `servicos` + ~5k `habilitacao` + histórico (total ~90k), cap 24000.
- **When** `applyContextBudget`.
- **Then** `after_chars ≤ 24000`; `steps_applied.length ≥ 1`; prefixo `CONTEXTO DINAMICO` e `NOTAS OPERACIONAIS` ainda no `dynamicContext`; `hit_protected_floor` só se, após os 6 passos, ainda `> 24000` (não é o caso esperado deste fixture se os dias caírem).

### 8.4 MIN já sob o teto — no-op

- **Given** MIN, shell + histórico ~6124, `horarios/servicos/hab/profs` vazios.
- **When** `applyContextBudget`.
- **Then** no-op (`trimmed === false`). Não inventa grade. Não reverte UNCERTAIN→MIN.

### 8.5 `user_payload` não entra na soma

- **Given** blocos reais pequenos (`BUDGET_KEYS` somam ~2000) **e** `blocks.user_payload` com 90000 chars; `dynamicContext` de ~2000; perfil MIN cap 8000.
- **When** `measureBudgetChars` / `applyContextBudget`.
- **Then** `budget_chars ≈ 2000` (não 90000); `trimmed === false`.

### 8.6 Extra obrigatório ( Dex inclui )

- **Env:** `TESS_CONTEXT_CAP_BOOKING=12000` aplica 12000; `TESS_CONTEXT_CAP_BOOKING=0` e `abc` caem no default **16000**.
- **CANCEL:** fixture lean ~6000 → no-op; fixture com 8 turnos longos + 5 future bookings → `shorten_history` e/ou `truncate_future_bookings`, **≥1** future booking permanece.
- **PRICE:** catálogo sintético 20k chars sem keyword útil → `filter_catalog` (ou slice a 3) e `after_chars ≤ 10000`; não zera `servicos`.
- **Rebuild:** após trim BOOKING, `DATAS COM DADOS DISPONIVEIS` só lista as datas que restaram.
- **Regressão item 6:** o teste já existente `UNCERTAIN → MIN (não herda FULL)` em `tess-context-profiles.test.js` **continua verde**. Budget não o altera.

---

## 9. Segurança, compatibilidade, trade-offs

### Segurança

- Evento sem texto de conversa, sem last4 no payload (last4 só neste doc, nos smokes citados).
- Telefone só na coluna `client_phone` já usada.
- Degradação é local (snapshot já fetched). Zero POST/PATCH Trinks. Zero Hostinger.

### Compatibilidade

- `TESS_CONTEXT_MODE=scoped` (live) + teto por perfil.
- Rollback de **perfil** (`full` / `FORCE_FULL`) **não** é rollback de orçamento: FULL ≤ 24000.
- `tess.context_bytes` / `tess.turn` inalterados na forma; passam a refletir o payload já cortado.
- Histórico slice -8 permanece o teto **de fetch**; o passo 5 pode mandar menos.

### Trade-off (por que não 14k BOOKING nem 32k FULL)

| Alternativa rejeitada | Por que não |
|---|---|
| BOOKING 14000 | Folga estreita demais para o dia extra do 2b + catálogo; risco de trim no fio saudável do `0007` se um dia compacto engordar. 16000 é o piso que o pedido pediu explicitamente. |
| BOOKING 20000 | Quase não corta dump de 3 dias em formato FULL (`getSlots` não-compacto). 16k já deixa 10,7k em paz e ainda tem dentes. |
| FULL = 10 dias ilimitado | É o bug. 91k morreu no relógio. |
| FULL 32000 | Ainda “cabe” em 12s-ish, mas o pior caso deixa de ser apertado. Pedro pediu constante conhecida que **degrada**. 24k é ~2,2× o BOOKING saudável e metade da média OPEN 54k. |
| MIN 12000 | UNCERTAIN gordo voltaria a carregar fio longo. O ponto do item 6 é uma pergunta. 8k já está acima do 6124 medido. |
| Flag `BUDGET=off` | Fail-open. Vetado. |

### Riscos residuais

| Risco | Mitigação |
|---|---|
| 1 dia FULL-format (todos os profissionais, todos os relógios) + catálogo + hist > 16k BOOKING | Passos 2–5 cortam catálogo/hist; o **dia** fica. Compact BOOKING live raramente chega nisso. |
| CANCEL com 0 future bookings | Já é outro perfil na prática (não há o que cancelar). Budget não inventa booking. |
| `shell` leftover infla soma em teste mal escrito | Testes 8.1/8.5 usam `dynamicContext.length` ou `BUDGET_KEYS` sem `user_payload`. |
| Crédito/msg não cai a 13,5 | Fora de escopo. Piso Haiku ~17–21 cr. |

---

## 10. [AUTO-DECISION] log

| Q | Decisão | Por quê |
|---|---|---|
| Unidade do teto | chars | Pedro: tokens só telemetria |
| BOOKING | **16000** (≥16k) | 0007 ~10k intocado; folga 2b |
| MIN = FAQ | **8000** | mesmos blocos; 6124 / 5129 medidos |
| PRICE = CANCEL | **10000** | sem grade; lean 6k / PRICE 6k |
| FULL | **24000** | corta 54k/91k; ainda > BOOKING |
| Predicado | `dynamicContext.length` | não double-count `user_payload` |
| Fetch vs trim | só trim pós-fetch | não mexer matriz de perfil (item 6) |
| Kill switch de budget | **não existe** | fail-open é o bug |
| Env fora de faixa | default tabela | `0` ≠ unlimited |
| Último dia BOOKING/FULL | protegido | senão a Tess inventa hora |
| Evento | `tess.context_trimmed` | só quando cortou |
| Split 46589 | não | Pedro §8; assembler é o ofensor |

---

## 11. Retorno Orion (W0)

| Campo | Valor |
|---|---|
| SOT | `docs/analysis/2026-09-04-aria-p-budget-tetos.md` |
| Caps | MIN 8000 · FAQ 8000 · PRICE 10000 · **BOOKING 16000** · CANCEL 10000 · FULL 24000 |
| Degrade | 1 `drop_slot_days` → 2 `filter_catalog` → 3 `shrink_habilitacao` → 4 `drop_profissionais` → 5 `shorten_history` → 6 `truncate_future_bookings` → 7 piso protegido |
| Evento | `tess.context_trimmed` |
| Próximo | W1 Dex — `tess-context-budget.js` + call no assembler **depois do fetch, antes do return** |

— Aria, arquitetando o futuro
