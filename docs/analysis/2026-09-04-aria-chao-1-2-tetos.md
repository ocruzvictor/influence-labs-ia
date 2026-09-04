# Chão 1+2 — tetos (oferta cabe + snapshot fresca)

**Autor:** Aria (@architect) · motor Grok 4.6 High  
**Orquestrado por:** Orion · **Implementa:** Dex (@dev) depois deste artefato  
**Data:** 2026-09-04  
**Branch de desenho:** `feature/tess-commit-honesty`  
**HEAD live (não tocar):** container ~`405b005` · `bot_toggles.global=false` — **não religar**  
**Natureza:** tetos. Sem patch neste turno. Sem cola 46589. Sem Hostinger. Sem POST/PATCH/PUT Trinks. Sem git add/commit/push. Sem smoke `0007`. Sem André 10:30. Sem CREATE `9800`. last4 only.

SOT desta fatia (não inventar SKU nem fala de recepção):

| Artefato | Papel |
|---|---|
| `docs/ops/2026-09-04-orion-workflow-chao-unico.md` | rito W1 — estes tetos |
| `docs/analysis/2026-09-04-orion-programa-chao-unico.md` | o que já está no ar vs leftover |
| `docs/stories/epics/EPIC-tess-chao-unico.md` | stories 1–2 |
| `docs/stories/salon-whatsapp-chao-1-oferta-cabe.md` | PARK-SLOTS resto · `0007` Fefe `durationMin=0` |
| `docs/stories/salon-whatsapp-chao-2-snapshot-fresca.md` | PV-P2-2 / OP012 resto · corrida &lt;45 min |
| `docs/analysis/2026-09-03-orion-estacionados.md` | PARK-SLOTS |
| `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md` | 0007: `durationMin=0` com &gt;3 SKUs; stale 935 min |
| `docs/ops/2026-09-04-orion-workflow-slots-contexto.md` | `9cb5834` live · `maxAgeHours` 0,75 |
| `docs/handoffs/2026-09-04-mira-amostra-lexico.md` | `4749`/`2874`/`2987` são **PRE-`a08f23b`** — não são prova de que `durationMin` falta |
| Pedro PV-P2-2 | SLO de frescura · owner `@data-engineer` · Aria `P-SNAP` |
| LibForge OP012 | CLI `checar_frescura_snapshot.js` **já existe** (default 24h = relógio do worker) |

---

## 0. Goal / non-goals (veto Dex)

### Goal

A grade que a Tess **vê** no compact BOOKING já esconde início que não cabe na duração da **fala atual** (mesmo com catálogo gordo) e já esconde início que o Postgres **já sabe** ocupado. Se ninguém couber: uma linha sem relógio. Idade da snapshot visível para ops sem terceiro GET Trinks.

Dex implementa **só** o residual abaixo. Este ficheiro é SOT: lista de ficheiros, funções, testes, vetos.

### Non-goals (veto Dex)

- Republicar o wiring `durationMin: resolveOfferDurationMin(svcPayload.data)` que já está live (`a08f23b`).
- Republicar refresh ≥45 min / `filterCatalogForProfile` last-utterance / pairing observada (`9cb5834`). Não reabrir `isCompatible` overlay 90d. Não reabrir `PENTEADO_DISAMBIGUA`.
- Relê 10 dias. Terceiro GET Trinks no turno. Mudar `TRINKS_RECONCILE_INTERVAL_MIN` (default 1440) — **precisa ACK Victor**; fora desta fatia.
- CLI OP012 nova ou retunar o default 24h. SLO burn-rate (PV-P2-2 / P-SLO) — Dara depois, a partir do evento.
- Religar o bot. Paste / split / edit 46589. Hostinger. POST/PATCH/PUT Trinks. CREATE `9800`. Replay André 10:30. Flip `BOT_ACCEPT_ALL`. Smoke `0007`.
- Usar Mira `4749`/`2874`/`2987` como prova de que `durationMin` “não existe”. São âncora do **buraco** (catálogo gordo, ocupação, invenção de relógio) **antes** de `a08f23b`.
- Inventar SKU. Inventar fala de recepção. E.164 no teste ou no doc.
- Subir timeout Nginx. Migration. Campo novo em `clients` / `bot_thread_state`.
- Stories 3–7 (intent cauda, memories, crédito, timeout, smoke).

---

## 1. What is already live (do not redo)

| SHA | O que faz | O que **não** fecha |
|---|---|---|
| `a08f23b` | `resolveOfferDurationMin(services)` + `startsFittingDuration` + assembler passa `durationMin` no compact. Cap **1–3 SKUs**; senão `0`. Clock path já escreve `sem janela contínua de Xmin` quando `durationMin>0` e `wantsClocks`. | Catálogo &gt;3 → filtro desliga. Occupancy consultiva **ignora** `durationMin` e diz “há vagas de manhã”. |
| `9cb5834` | `filterCatalogForProfile` BOOKING: `filterServicesByKeywords(messageText)` primeiro; só cai no histórico se a fala não devolve hits. `ensureSlotSnapshot(hoje, data pedida)` com `maxAgeHours = 45/60 = 0.75`. Aviso `SNAPSHOT: atualizado há N min` se `age≥45`. Evento `snapshot.stale` se `age≥45`. `isCompatible` = matriz **ou** agenda 90d. `getServicesText` une pares observados. | Last-utterance **de catálogo** ≠ last-utterance **de duração** quando a fala ainda devolve &gt;3 SKUs (família maquiagem / stem gordo). Sem keyword na fala → dump histórico → `durationMin=0` de novo. Corrida **dentro** de 45 min. Worker de slots continua 24h. |
| `fa0ec92` | UNCERTAIN→MIN · teto por perfil | irrelevante aqui |
| `405b005` | stems pezinho/tintura/gloss/maquiador + gênero + strip · **container live** | irrelevante aqui |
| webhook | `markSlotWindowAvailable` no inbound Trinks | falha o mark e o row de appointment já existe → oferta ainda lista o start |
| commit-7 | recheck recusa ocupado no **confirm** | a dor é **oferecer** o morto |
| OP012 CLI | `backend/scripts/salao/snapshot/checar_frescura_snapshot.js` · `checarFrescuraSnapshot` default `--max-idade-horas 24` | relógio do **worker**, não do offer 45 min |

Teste live que **já prova** last-utterance de catálogo (não reescrever, não apagar):

`backend/test/tess-context-assembler.test.js` — `scoped BOOKING durationMin ignora corte no histórico se a fala é maquiagem` (4 SKUs no fixture, 1 Maquiagem → `120`, some `12:30`). Classe `0007` **estreita**. O buraco que resta é a mesma fala com **&gt;3 SKUs ainda no payload da fala**.

`I1`/`I2` unit (`detectExactClock` `as 16h` / `16:00`) e o teste `scoped BOOKING passa durationMin e filtra buraco curto` (1 SKU) ficam verdes.

---

## 2. Tension + decisions

### Story 1 — oferta cabe

**Tensão.** `resolveOfferDurationMin` ainda é:

```
if (!services.length || services.length > 3) return 0;
return Math.max(...durs);
```

O assembler chama isto em `svcPayload.data` **depois** do filtro last-utterance. Se a fala isola 1 Maquiagem, já funciona (`9cb5834` + teste). Se a fala isola **família** (&gt;3 SKUs, todos 120) ou se a fala não tem keyword e o histórico infla o payload, volta `0`. Compact occupancy (`!wantsClocks`) nunca passa pelos starts filtrados — o modelo lê “há vagas de manhã” e inventa relógio. Guard pega no confirm. É o ping-pong PARK-SLOTS.

#### D1 — last-utterance / current-speech duration wins when catalog &gt;3 (classe `0007` Fefe)

*[AUTO-DECISION] Cascade no próprio `resolveOfferDurationMin`, sem segundo filtro de catálogo e sem reabrir `filterCatalogForProfile` → duration independe da largura do payload (reason: o cap &gt;3 existia para não misturar corte+maquiagem+manicure num max mentiroso; a fala atual já isolou a família ou trouxe duração em prosa).*

```
extractSpeechDurationMin(messageText)     // só turno atual, nunca history
  → token isDurationHourToken já existente
  → Nh * 60
  → 0 se não houver token de duração

skuDurationFrom(services)
  → 1–3 SKUs com dur>0: max          // live, não mexer na semântica
  → >3 e todas as dur>0 iguais: essa duração   // família maquiagem
  → >3 e durs misturam: 0            // não esconde corte 60 nem finge 120
  → vazio / dur 0: 0

return
  speech && sku ? Math.max(speech, sku)   // conservador: não oferece furo que falha num dos dois
  : (speech || sku)
```

`messageText` entra como 2º argumento opcional. Assembler:

```
durationMin: resolveOfferDurationMin(svcPayload.data, { messageText })
```

Não passar `historyText` para duração. `2h` de um turno antigo não pega.

`2987` “não são 2h de atendimento?” é âncora do **token de duração**, não do wiring `a08f23b`. Isolado `2h` **não** é duração (já decidido na Onda 2: pode ser relógio). Não alargar o parser.

#### D2 — zero starts fit → sem relógio inventado

*[AUTO-DECISION] Occupancy e clock path operam em `startsFittingDuration` quando `durationMin>0` (reason: AC3 é o texto; o ofensor é a linha “há vagas de manhã” com furo de 30 min — o modelo inventa 12:30).*

Em `compactBookingSlotsBlock`, quando `durationMin>0`:

1. Para cada prof, `fitting = startsFittingDuration(startsAt, durationMin)`.
2. Clock path (`wantsClocks`): já existe `sem janela contínua de ${durationMin}min neste dia.` — **manter**.
3. Occupancy path: `occupancyLine` / `periodOccupancyLine` recebem **fitting**, não raw. Se `fitting` vazio → a **mesma** linha `sem janela contínua de Xmin` (não “há vagas de manhã”, não “sem vagas neste dia” genérico).
4. Zero prof com fitting → bloco sem `\d{2}:\d{2}`. Footer consultiva / honesty inalterado.

Não despejar relógios só porque agora sabemos a duração. Profissional desconhecido continua occupancy-only **sobre starts que cabem**.

#### D3 — o que fica 0

`durationMin` permanece `0` quando:

- sem token de duração na **fala atual**, **e**
- payload sem SKU / SKUs sem `duracaoEmMinutos`/`duration_min`, **e**
- payload &gt;3 com durações **misturadas** (histórico inchou; last-utterance não isolou família homogénea).

Não inventar 60. Não ler duração do histórico. Não defaultar maquiagem=120 sem SKU nem “2h” na fala. Residual honesto: occupancy crua + guard no confirm.

---

### Story 2 — snapshot fresca

**Tensão.** `9cb5834` já relê hoje+data se a run daquela data tem ≥45 min (máx. 2 GET). Aviso + evento `snapshot.stale` só quando `age≥45`. Depois do refresh, age≈0 e o evento cala. Worker `TRINKS_RECONCILE_INTERVAL_MIN` continua 1440. Confirm já recusa ocupado. A dor residual é **oferecer** start que o Postgres já tem como appointment ativo (webhook marcou o row e falhou o `markSlot`) **ou** que alguém pegou nos minutos 1–44 sem o row ter chegado.

#### D4 — residual depois do refresh 45 min

*[AUTO-DECISION] Não apertar o limiar abaixo de 45. Não GET extra &lt;45. Oferta subtrai janelas de `trinks_appointments` locais (scheduled/confirmed) dos starts — 0 GET (reason: AC2 = “refresh/recheck já sabe ocupado”; o recheck lê appointments; a oferta ainda lê só `trinks_slots.available`). Worker 24h fica. Confirm não muda.*

| Residual | Dente nesta fatia | Fora |
|---|---|---|
| Corrida 1–44 min, appointment **já** no Postgres, slot ainda `available` | subtrair overlap no `fetchSlotsGrouped` | — |
| Corrida 1–44 min, **nem** appointment nem mark (webhook/sync atrasados) | nenhum — guard no confirm | GET live na oferta |
| Worker 24h em dias que **não** são hoje nem data pedida | nenhum | mudar `TRINKS_RECONCILE_INTERVAL_MIN` (ACK) |
| Oferta vs confirm | oferta = snapshot + subtract local; confirm = recheck live intacto | antecipar o GET do commit |

Overlap = o mesmo critério de `markSlotWindowAvailable`: appointment em `T` com `durationMin` ocupa `[T, T+duration)`. Dropa qualquer `starts_at` nesse intervalo daquele `professional_id`. Status só `scheduled`/`confirmed`. Não usar o match de 60s de `findActiveAppointmentConflict` (isso é confirm de um relógio; aqui é janela).

Isto **não** é republicar overlay `isCompatible` 90d (`9cb5834`). Overlay de pairing ≠ overlay de ocupação na oferta.

#### D5 — OP012 CLI/SLO **não** entra nesta fatia (event-only)

*[AUTO-DECISION] Evento no hot-path; CLI OP012 intocada (reason: o script já existe com default 24h = worker; PV-P2-2 SLO é Dara; Dex não constrói burn-rate).*

Dex emite, em todo compact BOOKING que montou grade (não só `age≥45`):

```
event: snapshot.offer
payload: { snapshot_age_min, stale_after_min: 45, refreshed: bool, subtracted_occupied: n }
```

`refreshed=true` se `ensureSlotSnapshot` nesta volta fez GET (o assembler já chama; o server conta). `snapshot.stale` (≥45) **permanece**. Aviso no bloco HORARIOS **só** ≥45 — não prefixar idade em snapshot fresco (o modelo hedgeia e gasta crédito).

OP012 CLI: não retunar, não chamar no inbound, não criar segundo script. Dara lê `snapshot.offer` quando for P-SNAP.

#### D6 — contrato máx. 2 GET Trinks/turno **intacta**

`refreshDates = unique(todayIso, requestedDate)` — 1 GET se o pedido é hoje, 2 se é outro dia. Dex **não** acrescenta data, não GET por profissional, não GET no subtract (Postgres only). Teste existente `scoped BOOKING → snapshot=2` e `FULL + requestedDate → snapshot=2` ficam verdes; o de BOOKING com `requestedDate` no mesmo dia do mock `getNextBusinessDays(1)[0]` pode ser 1 — não forçar 2.

---

## 3. File-level change list (funções)

Dex toca **só** isto. Sem A/B.

### 3.1 `backend/lib/tess-context-slots.js`

| Função / símbolo | Comportamento |
|---|---|
| `extractSpeechDurationMin(text)` **novo** | Normaliza com `normalizeText`. Percorre os mesmos padrões de `isDurationHourToken`. Devolve `Nh * 60` do **primeiro** token de duração. `0` se nenhum. Não trata `as 16h` / `14h30` / `2h` isolado. |
| `skuDurationFrom(services)` **novo** (ou privado) | Semântica D1. Não inventa. |
| `resolveOfferDurationMin(services, opts?)` | `opts.messageText` opcional. Cascade D1. Sem `opts` = comportamento live (1–3 / 0) — testes velhos sem 2º arg continuam. |
| `startsFittingDuration` | **Exportar.** Semântica intocada. |
| `occupancyLine` / `periodOccupancyLine` | Sem mudança de assinatura. O caller passa starts já filtrados. |
| `compactBookingSlotsBlock` | Se `durationMin>0`, occupancy usa `startsFittingDuration` por prof; zero fitting → linha `sem janela contínua de ${durationMin}min neste dia.` Clock path intocado na copy. |
| `SNAPSHOT_STALE_OFFER_MIN` | **Intocado** (45). |
| `prependStaleWarning` | **Intocado** (só ≥45). |
| `module.exports` | Somar `extractSpeechDurationMin`, `startsFittingDuration`. |

### 3.2 `backend/lib/tess-context-assembler.js`

| Função / símbolo | Comportamento |
|---|---|
| `filterCatalogForProfile` | **Intocado.** |
| chamada `compactBookingSlotsBlock` (~249) | `durationMin: resolveOfferDurationMin(svcPayload.data, { messageText })`. Única mudança neste ficheiro para story 1. |
| `ensureSlotSnapshot` loop | **Intocado** (hoje+data, 45 min). |
| `snapshotStale` / `fetchMeta.snapshotAgeMin` | **Intocado.** Dex **não** inventa `refreshed` aqui se o server já souber pelos `calls.snapshot` — ver 3.4. |

### 3.3 `backend/lib/trinks-local-store.js`

| Função / símbolo | Comportamento |
|---|---|
| `listActiveAppointmentWindowsForDate(date)` **novo** | `SELECT professional_id, scheduled_at, duration_min FROM trinks_appointments WHERE scheduled_at::date = $1 AND status IN ('scheduled','confirmed')`. Sem telefone. Sem E.164 no retorno. |
| `isCompatible` / `listObservedServiceProfessionals` | **Intocados.** |
| `hasSlotSnapshotForDate` | **Intocado** (default 24h; offer já passa 0.75). |
| `module.exports` | Exportar o novo. |

### 3.4 `backend/server.js`

| Trecho | Comportamento |
|---|---|
| `fetchSlotsGrouped` | Depois de `listSlots` / `groupOpenSlots`: pedir `listActiveAppointmentWindowsForDate(date)` e **remover** `startsAt` que caem em `[scheduled_at, scheduled_at+duration)`. Contar `subtracted_occupied`. Anexar no return (`subtractedOccupied`) para o evento. **0 GET Trinks.** |
| `ensureSlotSnapshot` | **Intocado** (`maxAgeHours = SNAPSHOT_STALE_OFFER_MIN/60`). |
| após `assembleTessContext` (lado do `snapshot.stale` ~1501) | Além do stale: emitir `snapshot.offer` (D5) em compact BOOKING com grade. `refreshed` = `ensureSlotSnapshot` desta volta fez request (Dex: flag no helper ou comparar `hasSlotSnapshotForDate` antes/depois — **sem** GET extra de leitura Trinks; o GET que já corre conta). |
| confirm / `findActiveAppointmentConflict` / guards | **Intocados.** |

### 3.5 `backend/lib/tess-context-intent.js`

`isDurationHourToken` — **intocado**. `extractSpeechDurationMin` **reusa** os padrões; não duplicar regex divergente. Se Dex preferir mover o array de padrões para um `DURATION_HOUR_PATTERNS` exportado e os dois consumirem, ok — um sítio só.

### 3.6 Fora (não abrir)

`trinks-state-worker.js` intervalo. `booking-parser.js` FILTER/sinónimos. `booking-guards.js`. Prompt 46589. `checar_frescura_snapshot.js`. Nginx.

---

## 4. Tests Dex must add (fixtures last4-class, not live WhatsApp)

Sem integração Trinks. Sem browser. Sem WhatsApp. last4 = âncora de evidência, não PII.

Fixture de catálogo **gordo** (nomes, ids fictícios):

`Corte Masculino` 60 · `TA - Corte Masculino` 60 · `Corte Feminino` 120 · `Maquiagem` 120 · `Maquiagem Social` 120 · `Maquiagem Noiva` 120 · `Make Express` 120 · `Manicure` 45 · `Pedicure` 45 · `Coloração Global` 90 · `Retoque de Raiz` 60.

Não é catálogo live. Não afirmar que estes SKUs existem no salão — são **classe** `0007` (fala maquiagem + histórico corte → payload &gt;3).

### 4.1 `backend/test/tess-context-slots.test.js`

| # | Input | Expected |
|---|---|---|
| S1-1 | `extractSpeechDurationMin('não são 2h de atendimento?')` (`2987` classe) | `120` |
| S1-2 | `extractSpeechDurationMin('leva 2h')` | `120` |
| S1-3 | `extractSpeechDurationMin('as 16h')` / `'quero cortar sábado 14h'` | `0` |
| S1-4 | `extractSpeechDurationMin('2h')` isolado | `0` |
| S1-5 | `resolveOfferDurationMin(11 SKUs mistos)` sem opts | `0` (live cap) |
| S1-6 | `resolveOfferDurationMin([4× maquiagem 120])` | `120` (família homogénea &gt;3) |
| S1-7 | `resolveOfferDurationMin([4× maquiagem 120], { messageText: 'quero maquiagem com a Fefe' })` | `120` |
| S1-8 | `resolveOfferDurationMin(11 mistos, { messageText: 'não são 2h de atendimento?' })` | `120` (speech ganha; max com sku se sku&gt;0) |
| S1-9 | `resolveOfferDurationMin([], { messageText: 'oi' })` / sem SKU sem duração | `0` |
| S1-10 | `resolveOfferDurationMin([1× Maquiagem 120])` sem opts | `120` (I1/I2 intacto) |
| S1-11 | occupancy: `compactBookingSlotsBlock` com `durationMin: 120`, **sem** profissional, starts só `12:30` 30 min contínuos | match `sem janela contínua de 120min`; **não** `há vagas`; **não** `12:30` |
| S1-12 | clock path `de tarde com o erick` + `durationMin: 90` (teste atual) | **inalterado** |

### 4.2 `backend/test/tess-context-assembler.test.js`

| # | Input | Expected |
|---|---|---|
| A1 | Fixture 11 SKUs + `messageText: 'quero maquiagem com a Fefe no sábado'` + history corte + start `12:30` 30 min (`0007` classe gorda) | `sem janela contínua de 120min`; **não** `12:30`. Catálogo da fala pode continuar &gt;3 maquiagens — o filtro de **duração** não zera. |
| A2 | Mesmo fixture, `messageText: 'tem horário sábado?'` (sem keyword de serviço, sem duração) + history corte+maquiagem | `durationMin` 0; occupancy permitida; **não** exigir linha 120 min. Não inventar SKU. |
| A3 | Teste atual 4 SKUs / 1 Maquiagem | **inalterado** verde. |
| A4 | Teste atual 1 SKU 120 / buraco curto | **inalterado** verde. |
| A5 | `scoped BOOKING` `requestedDate` + mock `ensureSlotSnapshot` | `calls.snapshot` ≤ 2. |

Não exigir `processMessage` e2e.

### 4.3 `backend/test/trinks-local-store.test.js` (+ assembler se Dex mockar grouped)

| # | Input | Expected |
|---|---|---|
| F1 | `listActiveAppointmentWindowsForDate` SQL cita `trinks_appointments` + `scheduled`/`confirmed` + data | sem coluna de telefone no SELECT |
| F2 | `fetchSlotsGrouped` (ou helper extraído): slot `12:30` available **e** appointment Fefe `12:00` duration 60 | `12:30` **ausente** nos `startsAt`; `subtractedOccupied ≥ 1` |
| F3 | appointment outro profissional / outro dia | start permanece |
| F4 | `isCompatible` overlay 90d | **inalterado** |

### 4.4 Evento (unit do emit, se o helper for testável)

| # | Input | Expected |
|---|---|---|
| E1 | compact BOOKING `snapshotAgeMin: 10` | evento `snapshot.offer` com `snapshot_age_min=10`, `stale_after_min=45`; **não** exige `snapshot.stale` |
| E2 | `snapshotAgeMin: 90` | `snapshot.stale` **e** `snapshot.offer` |

Não exigir Nightwatch live.

---

## 5. Out / stop rules

**Dex para se:**

- o diff reabrir `filterCatalogForProfile`, `isCompatible`, `CATALOG_SYNONYMS`, ou `ensureSlotSnapshot` limiar;
- aparecer GET Trinks fora de `ensureSlotSnapshot(hoje|requestedDate)`;
- `TRINKS_RECONCILE_INTERVAL_MIN` mudar no código ou no doc de deploy;
- teste novo tiver E.164, WhatsApp, OPEN, ou roteiro `0007`;
- `BOT_ACCEPT_ALL` / kill switch / Hostinger / cola 46589;
- default OP012 24h for alterado “para alinhar com 45 min”.

**Residual honesto (não é STOP — é o que **não** fecha):**

1. Corrida sem row de appointment e sem mark (lag total) → confirm recusa; oferta ainda pode listar. Medir via `snapshot.offer`, não fingir zero corrida.
2. Dias da janela compacta que não são hoje/pedida continuam no ciclo 24h do worker.
3. `durationMin=0` (D3) → occupancy crua; o modelo ainda pode inventar relógio; o guard segura o commit.
4. `4749`/`2874`/`2987` pré-`a08f23b` não regressam esta fatia.
5. Live `405b005` + kill switch off. Estes tetos são desenho na branch. Dex não deploya, não religa, não rsync.

**Precisa Victor?** Não para implementar. Precisa ACK **só** se alguém quiser mexer no intervalo do worker — e isso está **fora**.

---

## 6. Ready for Dex?

| Story | Ready? | Por quê |
|---|---|---|
| 1 oferta cabe | **yes** | D1–D3 únicos; funções nomeadas; fixture `0007` gorda; veto de não republicar `a08f23b`/`9cb5834` last-utterance de catálogo. |
| 2 snapshot fresca | **yes** | D4–D6 únicos; subtract local + evento; 2 GET intacta; OP012 CLI fora; worker fora. |

**Quinn:** gate = testes novos verdes + os existentes (1 SKU 120, last-utterance 4→1, `as 16h`, occupancy sem prof, `snapshot=2`, `isCompatible` 90d) inalterados no veredito.

**Dara:** P-SNAP / SLO de `snapshot.offer` **depois**. Não bloqueia Dex.

**Orion:** W2 Dex story 1 → Quinn → W3 Dex story 2 → Quinn. Kill switch off. Sem smoke no meio.

— Aria, arquitetando o futuro 🏗️
