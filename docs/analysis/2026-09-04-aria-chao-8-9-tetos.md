# Chão 8+9 — tetos (pezinho cortesia · Ausência ocupa)

**Autor:** Aria (@architect) · motor Grok 4.6 High  
**Orquestrado por:** Orion · **Implementa:** Dex (@dev) depois deste artefato  
**Dara:** 1 GET read-only (story 9) — ver §5. Não muta.  
**Data:** 2026-09-04  
**Branch de desenho:** `feature/tess-commit-honesty`  
**HEAD live (não tocar):** `a9d5af8` · `bot_toggles.global=false` — **não religar**  
**Natureza:** tetos. Sem patch de produção JS neste turno. Sem cola 46589. Sem Hostinger. Sem POST/PATCH/PUT Trinks. Sem git add/commit/push. Sem smoke `0007`. Sem André 10:30. Sem CREATE `9800`. last4 only. Sem nome de cliente neste artefato.

SOT desta fatia:

| Artefato | Papel |
|---|---|
| `docs/analysis/2026-09-04-orion-adendo-pezinho-ausencia-recorrencia.md` | regra de chão + factos live 04/09 |
| `docs/ops/2026-09-04-smoke-0007-relatorio.md` | #2 pezinho handoff · #8 Ausência/snapshot |
| `docs/stories/salon-whatsapp-chao-8-pezinho-cortesia.md` | AC1–AC4 |
| `docs/stories/salon-whatsapp-chao-9-ausencia-ocupa.md` | AC1–AC4 |
| `docs/stories/salon-whatsapp-chao-10-recorrencia-trinks.md` | **ponteiro só** — Dara dump; Aria não desenha cancel aqui |
| `docs/analysis/2026-09-04-aria-chao-1-2-tetos.md` | D6 máx. 2 GET — **superseded** na story 9 |
| `docs/analysis/2026-09-04-aria-onda2-triagem-tetos.md` | C3 “pezinho → corte” — **superseded** no turno só-pezinho |

---

## 0. Goal / non-goals (veto Dex)

### Goal

**8.** Cliente que pede só pezinho ouve cortesia / intervalo / grátis. Tess resolve sozinha. Zero `[HANDOFF_HUMAN]`. Zero `[BOOKING_CREATE]`. Zero SKU inventido. Victor cola o prompt **depois** do gate — Dex edita o ficheiro local.

**9.** Início que a grade Trinks já escondeu (Ausência / almoço / bloqueio = omitido de `horariosVagos`) **não** volta na oferta. Refresh de **todas** as datas que entram em HORARIOS VAGOS, não só hoje. Cancelado continua fora. Confirmado continua a ocupar.

### Non-goals (veto Dex)

- Religar o bot. Paste / split / edit 46589. Hostinger. POST/PATCH/PUT Trinks. CREATE `9800`. Replay André 10:30. Flip `BOT_ACCEPT_ALL`. Smoke `0007`.
- Inventar SKU pezinho no Trinks. Inventar `status.id` de Ausência. Persistir row de Ausência. Migration. Campo novo.
- Subir `TRINKS_RECONCILE_INTERVAL_MIN` (1440). Subir worker para 1h. Mexer Nginx.
- Reabrir stems Onda 2 (`tintura` / `gloss` / `maquiador` / `masculino`) excepto o ramo `cort` no turno só-pezinho.
- Reabrir C5/C6 (“fazer o pé” / “pé e mão” = unha). Reabrir I1 (pezinho continua `hasServiceSignal`).
- Story 10 (recorrência / `serieId` / PATCH cancel de série). TipoDeEvento 11/12 ≠ Ausência — não mapear.
- E.164 ou nome de cliente em teste ou doc.

---

## 1. What is already live (do not redo)

| SHA / sítio | O que faz | O que **não** fecha |
|---|---|---|
| prompt v3.2.3 L10 / Ex.14 / VALIDE 28 | pezinho ≠ pedicure ≠ Cabelo e Barba; **handoff** `orcamento_referencia` se sem SKU | regra nova do salão (cortesia, sem agenda) |
| KB chão 4 `sinonimos` L16 + `regras` L113 | o mesmo handoff | idem |
| `isColloquialPezinho` + push `cort` | C3/C4: dump Corte Masculino; tira pedicure / Cabelo e Barba | SERVICOS de corte + few-shot = handoff ou oferta de corte |
| `PEZINHO_DISAMBIGUA` | “acabamento… Nao e pedicure.” | sem cortesia / sem veto de tag |
| I1 | “Posso passar aí pra arrumar o pezinho do cabelo?” → `hasServiceSignal` → não UNCERTAIN | perfil BOOKING ainda puxa slots |
| `STATUS_BY_ID` | 4 confirmed · 6 no_show · 8 completed · 9 cancelled · resto `unknown` | Ausência **não** é id |
| 21d raw | sem nome Ausência; 11/12 = webhook create/update | persistir Ausência não tem fonte |
| `listActiveAppointmentWindowsForDate` | só `scheduled`+`confirmed` | smoke #8: **zero** row nos três inícios |
| `GET /agendamentos/profissionais/{date}` | só `horariosVagos`; mapper grava `available: true` hardcoded | Ausência **omite** o início — não chega row |
| `replaceSlotsForDate` | DELETE do dia + INSERT do GET fresco | se o GET não corre, o morto de 03/09 21:10Z fica |
| chão 2 refresh | `refreshDates = unique(todayIso, requestedDate)` · `SNAPSHOT_STALE_OFFER_MIN=45` | sáb 05 / ter 08 / sáb 12 **não** refresharam; idade ~21 h |
| worker | `TRINKS_RECONCILE_INTERVAL_MIN` default **1440** · `SNAPSHOT_DAYS` 10 + 5 sábados/35d | ciclo 24 h ≠ oferta |
| `#8` live | Tiago sáb 14h / ter 16h30 / sáb 17h `trinks_slots.available=true`; `subtracted_occupied=0` | não é duração |

---

## 2. Tension + decisions

### Story 8 — pezinho cortesia

**Tensão.** O léxico já acertou (#2). O desenho velho (chão 4 / Onda 2) manda handoff quando não há SKU. O salão fechou outra frase: *não agenda, intervalo, grátis*. Three layers still teach the old phrase: prompt few-shot, KB, FILTER `cort`.

#### D8.1 — turno só-pezinho = cortesia; sem tag; sem SKU

*[AUTO-DECISION] Copy + corte de contexto + strip de tag no inbound só-pezinho; não inventar SKU (reason: time do salão 04/09; #2 não é buraco de cadastro).*

`isSoloPezinhoTurn(messageText)` (novo, `booking-parser.js`):

1. `isColloquialPezinho(messageText)` é true.
2. Hits naturais de `FILTER_SERVICE_KEYWORDS` **excepto** `pezinho` e `cabelo` (o “do cabelo” da fala) estão **vazios**.
3. `cort` **injectado** não conta como hit natural. `corte` / `cortar` na fala **é** hit natural → **não** é só-pezinho.

Só-pezinho: Tess fala cortesia. Não é pedicure. Não é Cabelo e Barba. Não oferece slot de corte.

“quero um corte e já deixar o pezinho” → **não** só-pezinho: catálogo/slots de corte intactos; DISAMBIGUA ainda diz que o pezinho é cortesia (sem CREATE extra).

#### D8.2 — onde corta FILTER `cort` / slots / handoff

*[AUTO-DECISION] Três cortes no turno só-pezinho, um sítio cada (reason: AC1 pede os três; few-shot sozinho perde para o dump de Corte).*

| Camada | Só-pezinho | Não só-pezinho |
|---|---|---|
| `filterServicesByKeywords` | **não** `hits.push('cort')`. Devolve `[]` (vazio), **nunca** `null` (null = dump do salão). | ramo actual (C5/C6 intactos) |
| assembler | **não** chama `ensureSlotSnapshot` / `getSlotsGrouped` / `getSlots`. `slotsAll=''`. `svcPayload = { text: PEZINHO_DISAMBIGUA, data: [] }`. Sem HABILITACAO de corte. | intacto |
| `stripBookingTags` (ou helper a seguir) | descarta `BOOKING_CREATE*` e `HANDOFF_HUMAN` com `motivo=orcamento_referencia`. Outros motivos (ex. `cliente_pediu_humano`) ficam. | intacto |

I1 / `hasServiceSignal` / classificador: **intocados**. BOOKING sem slots neste turno é honesto.

`PEZINHO_DISAMBIGUA` (substitui o bloco actual em `tess-context-assembler.js` L33–36):

```
DISAMBIGUA: Pezinho do cabelo = acabamento de corte (contorno orelha-pescoco).
Nao e pedicure. Nao e Cabelo e Barba. Nao precisa agendar.
E cortesia, feito no intervalo entre clientes, gratuito.
Nao emita [HANDOFF_HUMAN]. Nao emita [BOOKING_CREATE]. Nao invente SKU.
Diga que pode passar sem marcar.
```

`OPERATIONAL_NOTES` em `server.js` (~L316): **uma** linha nova, mesmo sentido. Vale mesmo se Victor ainda não colou o prompt.

#### D8.3 — hunks exactos do prompt (Victor cola depois)

Dex edita `docs/prompts/tess-conversa-v3-clean.md` → header **v3.2.4**. Arquiva v3.2.3 em `docs/prompts/archive/tess-conversa-46589-v3.2.3-2026-09-04.md`. CHANGELOG + README. **Não cola 46589.**

| # | Sítio | Troca |
|---|---|---|
| P1 | L1 | `# TESS 46589 · v3.2.4 · 2026-09-04` |
| P2 | L10 REGRA ZERO | Substituir a frase do handoff. Fica: `**"Pezinho" / "pezinho do cabelo" / contorno orelha-pescoço ≠ pedicure e ≠ Cabelo e Barba.** É acabamento de corte, **cortesia no intervalo, sem agendar, gratuito**. Não remapeie para unha. Não invente SKU. Não emita `[HANDOFF_HUMAN]` nem `[BOOKING_CREATE]` neste pedido. Diga que pode passar sem marcar.` |
| P3 | L385 vocabulário | `"pezinho do cabelo" = cortesia no intervalo (grátis, sem marcar) → ❌ pedicure / Cabelo e Barba / handoff / CREATE / SKU inventido` |
| P4 | L431 NUNCA | manter ≠ pedicure / ≠ Cabelo e Barba; **somar**: `handoff` / `BOOKING_CREATE` / SKU inventido no pedido só-pezinho |
| P5 | L449 SEMPRE | depois de “Pezinho do cabelo ≠ unha.”: `Pezinho só = cortesia/intervalo/grátis; zero handoff; zero CREATE.` |
| P6 | L601–604 Ex.14 | ver copy abaixo |
| P7 | L639 VALIDE 28 | `Tratei pezinho/contorno como pedicure, Cabelo e Barba, handoff, CREATE ou SKU inventido? Se sim, REFAÇA — cortesia no intervalo, sem marcar, grátis.` |

**Ex.14 (substitui o bloco inteiro):**

```
Ex.14 — Pezinho do cabelo (cortesia, sem agenda)
Cliente: "Posso passar aí pra arrumar o pezinho do cabelo?"
Você: "Pode passar sem marcar. Pezinho é o acabamento do corte, de graça, a gente faz no intervalo. Não é pedicure."
```

Sem tag. Sem “a recepção te encaixa”. Sem “não tem na tabela”.

Não mexer nos outros `orcamento_referencia` (mechas, laser, PIX, visagismo, Ex.12/13).

#### D8.4 — hunks exactos da KB (4 ficheiros · PATCH 39496 **depois** do gate, Victor ACK)

Dex edita local. Sync TESS **não** neste turno.

| Ficheiro | Hunk |
|---|---|
| `data/kb/conversa-v2/sinonimos-servicos.md` | L3 → `v1.3 (2026-09-04 — chão 8: pezinho cortesia)`. L16 célula direita → `Acabamento de corte — cortesia no intervalo, sem agendar, gratuito. **NÃO** pedicure, **NÃO** Cabelo e Barba. **NÃO** `[HANDOFF_HUMAN]`. **NÃO** `[BOOKING_CREATE]`. **NÃO** inventar SKU.` L83: depois da excepção pezinho, a mesma frase (sem handoff). |
| `data/kb/conversa-v2/regras-comerciais.md` | L113: trocar “Sem SKU isolado… orcamento_referencia” por `Cortesia no intervalo, sem agendar, gratuito. Tess resolve sozinha — zero handoff, zero CREATE, zero SKU inventido.` |
| `data/kb/conversa-v2/faq-servicos.md` | Novo **### 22. Posso passar só pro pezinho / contorno?** `Sim. Não precisa marcar. É de graça, feito no intervalo. Não é pedicure. Não é Cabelo e Barba. Sem SKU — não invente.` |
| `data/kb/conversa-v2/fichas-tecnicas-servicos.md` | L9 lista de gratuitos: somar `Pezinho / contorno orelha-pescoço — cortesia no intervalo; **não** é linha de catálogo; **não** inventar SKU.` **Proibido** criar row de tabela com preço/duração/id. |

`padroes-fala` / `info-estatica` / laser: **intocados**.

---

### Story 9 — Ausência ocupa

**Tensão.** A oferta lê `trinks_slots` (grade `horariosVagos`). Ausência **não** entra em `GET /agendamentos` com nome; `STATUS_BY_ID` não tem id; 21d raw sem Ausência; `subtractOccupied` só vê `scheduled`+`confirmed`. Os três inícios do #8 **não têm** appointment. A foto desses dias é 03/09 21:10Z. O refresh de 45 min só correu para **hoje**.

#### D9.1 — SOT = grade `horariosVagos`, não persistir Ausência

*[AUTO-DECISION] Fonte da Ausência (e almoço/bloqueio do mesmo objecto) = omissão em `GET /agendamentos/profissionais/{date}` → `replaceSlotsForDate` (reason: a API já só devolve vagos; o mapper hardcodeia `available:true` porque a lista **é** a dos livres; persistir Ausência exigiria inventar id — veto).*

| Fonte | Veredicto |
|---|---|
| `GET /agendamentos` + `trinks_appointments` | **não** SOT de Ausência. Manter subtract `scheduled`+`confirmed` (corrida webhook). Não alargar a `unknown`. |
| webhook `TipoDeEvento` 11/12 | **não** Ausência. Não mapear. |
| `GET /agendamentos/profissionais/{date}` | **SOT.** Início ausente de `horariosVagos` some no REPLACE. |
| tabela nova / status novo | **veto.** |

Cancelado: continua fora do subtract (já não é `scheduled`/`confirmed`) e, se a grade o libertou, volta a `horariosVagos` no GET fresco. Confirmado: continua a ocupar via subtract **e** some da grade.

#### D9.2 — refresh = todas as datas de HORARIOS, não só hoje

*[AUTO-DECISION] `refreshDates = unique(slotDates)` — o mesmo array que o compact vai imprimir (reason: #8 ofereceu sáb/ter/sáb-12; D6 chão 2 só hoje+pedida; worker 1440 não fecha a oferta).*

Em `assembleTessContext` (`tess-context-assembler.js` ~L225):

```
// era: unique(todayIso, requestedDate)
const refreshDates = [...new Set(slotDates.filter(Boolean))];
```

`ensureSlotSnapshot(date)` **intocado**: ainda `maxAgeHours = 45/60 = 0.75`; GET só se a run daquela data ≥45 min; mesmo path `/agendamentos/profissionais/${date}`; `replaceSlotsForDate`.

Não acrescentar data que `resolveSlotDates` não devolveu. Não GET por profissional. Não GET `/agendamentos` extra. Não mudar `slotDays` / `includeSaturdays` / `SLOT_CONTEXT_DAYS`.

**D6 chão 2 (máx. 2 GET) fica superseded neste slice.** Teste `scoped BOOKING → snapshot=2` **actualiza** o expect para `calls.snapshot === refreshDates.length` (ou `≤ \|slotDates\|` se o mock de `ensureSlotSnapshot` ainda for no-op contador).

#### D9.3 — inteiros

| Símbolo | Valor | Mexer? |
|---|---|---|
| `SNAPSHOT_STALE_OFFER_MIN` | **45** | não |
| `maxAgeHours` offer | **0.75** | não |
| BOOKING `slotDays` | `min(slotContextDays, 3)` = **3** weekdays se sem data pedida; **1** se `requestedDate` | não |
| BOOKING sábados | `nextSaturdayDates(2, 21)` se `!requestedDate` | não |
| \|slotDates\| típico scoped | **≤5** (3 weekdays + 2 sáb) | não alargar |
| FULL | `SLOT_CONTEXT_DAYS` (default **10**) + `nextSaturdayDates(5, 35)` | refresh também as datas que FULL imprimir; não subir o default |
| GET/turno (stale) | **≤ \|unique(slotDates)\|** · 0 se todos &lt;45 min | é o tecto |
| `TRINKS_RECONCILE_INTERVAL_MIN` | **1440** | **não** |
| `STATUS_BY_ID` | 4 / 6 / 8 / 9 | **não** somar |
| subtract | `scheduled` + `confirmed` | **não** somar `unknown` / cancelled |
| `subtracted_occupied` | count do subtract local (appointments) | semântica intacta; #8 pode continuar 0 se só a grade omitir |

Trade-off: até ~5 GET Trinks num BOOKING scoped com a janela toda podre, vs 1–2 hoje. Custo de quota vs oferecer Tiago 14h morto. Aceito. Não compensar subindo o worker.

`snapshot.offer`: `refreshed=true` se **qualquer** `ensureSlotSnapshot` desta volta fez GET. `snapshot_age_min` = máx. das idades dos dias impressos (já é `Math.max`). `stale_after_min=45`.

#### D9.4 — Dara: 1 GET read-only (pedido, não mutação)

*[AUTO-DECISION] Pedir a Dara um GET read-only da grade; Dex não espera o dump para começar o refresh (reason: REPLACE fresco é correcto mesmo se o #8 já tiver sido libertado; o GET só prova a hipótese “Ausência some de horariosVagos”).*

Dara, **um** (ou três) GET, **sem** POST/PATCH, **sem** E.164, **sem** nome de cliente no relatório:

1. `GET /agendamentos/profissionais/2026-09-05`
2. Opcional: `…/2026-09-08` e `…/2026-09-12`

No dump: `id` do profissional (Tiago) + se `horariosVagos` contém `14:00` / `16:30` / `17:00`. last4-class. Sem raw de cliente.

| Achado | Dex |
|---|---|
| esses inícios **ausentes** de `horariosVagos` | refresh D9.2 fecha o #8 |
| esses inícios **ainda listados** | **STOP** persistência. Não inventar status. Ping Aria — a grade também não esconde; outro objecto (fora desta story) |

---

## 3. File-level change list

Dex toca **só** isto. Sem A/B. Sem produção JS da Aria.

### Story 8

#### 3.1 `backend/lib/booking-parser.js`

| Símbolo | Comportamento |
|---|---|
| `isSoloPezinhoTurn(text)` **novo** | D8.1. Exportar. |
| `isColloquialPezinho` | **intocado** (ainda `includes('pezinho')`). |
| `filterServicesByKeywords` | se `isSoloPezinhoTurn`: **não** push `cort`; `return []`. Senão: ramo actual (push `cort` se colloquial+não-solo, C5/C6). |
| `stripBookingTags` ou helper `suppressSoloPezinhoTags(parsed, inboundText)` | D8.2 strip CREATE + handoff `orcamento_referencia`. |
| `FILTER_SERVICE_KEYWORDS` / `CATALOG_SYNONYMS` | **intocados** (pezinho fica no array — I1). |

#### 3.2 `backend/lib/tess-context-assembler.js`

| Símbolo | Comportamento |
|---|---|
| `PEZINHO_DISAMBIGUA` | D8.2 copy nova. |
| ramo catalog/slots | se `isSoloPezinhoTurn(messageText)`: `svcPayload` DISAMBIGUA+`data:[]`; **skip** bloco `if (profileSpec.fetchSlots)` (refresh+compact). `fetchMeta.slotsRequested=0`. |
| `filterCatalogForProfile` | **intocado** (o skip é no caller). |

#### 3.3 `backend/server.js`

| Trecho | Comportamento |
|---|---|
| `OPERATIONAL_NOTES` | +1 linha D8.2. |
| depois de `stripBookingTags` | chamar suppress se inbound só-pezinho. |
| `ensureSlotSnapshot` / `fetchSlotsGrouped` / `STATUS_BY_ID` | **intocados** nesta story. |

#### 3.4 Prompt + KB + changelog

Ficheiros D8.3–D8.4. `docs/prompts/CHANGELOG-46589.md` entrada v3.2.4. `docs/prompts/README-46589.md` vivo = v3.2.4. Archive v3.2.3.

### Story 9

#### 3.5 `backend/lib/tess-context-assembler.js`

| Trecho | Comportamento |
|---|---|
| L225 `refreshDates` | `unique(slotDates)` — D9.2. Continua a `ensureSlotSnapshot` no loop. Continua a `sort`/`push` só se a data ainda não estava (já está). |

#### 3.6 Intocado na 9

`ensureSlotSnapshot`, `SNAPSHOT_STALE_OFFER_MIN`, `mapSlotPayload` / `mapSlots` (`available: true` + só `horariosVagos`), `replaceSlotsForDate`, `listActiveAppointmentWindowsForDate`, `subtractOccupiedSlotStarts`, `trinks-mapping.js` `STATUS_BY_ID`, `trinks-state-worker.js` intervalo, `booking-parser` FILTER, Nginx.

---

## 4. Tests Dex must add (last4-class, sem WhatsApp)

Sem integração Trinks. Sem browser. Sem OPEN. Sem E.164. Sem nome de cliente.

### 4.1 Story 8 — `backend/test/booking-parser.test.js`

| # | Input | Expected |
|---|---|---|
| P8-1 | `isSoloPezinhoTurn('Posso passar aí pra arrumar o pezinho do cabelo?')` (`0007` #2) | `true` |
| P8-2 | `isSoloPezinhoTurn('quero um corte e o pezinho')` | `false` |
| P8-3 | `isSoloPezinhoTurn('fazer o pé')` / `'pé e mão'` | `false` |
| P8-4 | **reescrever C3/C4** | só-pezinho → `filterServicesByKeywords` `[]` (length 0). **Não** Corte Masculino. **Não** Pedicure. **Não** Cabelo e Barba. **Não** `null`. |
| P8-5 | C5 / C6 | **inalterados** (unha) |
| P8-6 | `filterServicesByKeywords(fixture, 'quero um corte e o pezinho')` | tem Corte Masculino; sem Pedicure |
| P8-7 | strip: inbound só-pezinho + texto modelo com `[HANDOFF_HUMAN motivo=orcamento_referencia]` e `[BOOKING_CREATE …]` | zero creates; `handoffHuman` null; copy visível sem tags |

### 4.2 Story 8 — `backend/test/tess-context-assembler.test.js`

| # | Input | Expected |
|---|---|---|
| A8-1 | scoped BOOKING + fala #2 + `ensureSlotSnapshot` spy | `calls.snapshot=0` · `calls.slots=0` · `dynamicContext` / `blocks.horarios` **sem** `HORARIOS VAGOS` · texto contém cortesia/intervalo/grátis (via DISAMBIGUA) · **sem** `orcamento_referencia` · **sem** id de SKU inventido |
| A8-2 | scoped BOOKING + `'quero cortar amanhã'` | slots/catalog **inalterados** (regressão) |
| A8-3 | I1 em `tess-context-intent.test.js` | **inalterado** verde |

Não exigir `processMessage` e2e nem WhatsApp. AC2 da story = este fixture + parser P8-7.

### 4.3 Story 8 — prompt / KB (unit de ficheiro, se já existir padrão)

Se houver teste que faz match Ex.14 / L10 handoff: actualizar para a copy nova. Não criar runner WhatsApp.

### 4.4 Story 9 — `backend/test/tess-context-assembler.test.js`

| # | Input | Expected |
|---|---|---|
| A9-1 | scoped BOOKING sem `requestedDate`; mock `getNextBusinessDays(3)` + `nextSaturdayDates` → 4–5 datas; `ensureSlotSnapshot` incrementa | `calls.snapshot ===` número de datas em `slotDates` (não 1–2) |
| A9-2 | scoped BOOKING + `requestedDate` só (explicitDateOnly) | `calls.snapshot === 1` (só essa data; **não** forçar hoje se não está em `slotDates`) |
| A9-3 | teste actual `FULL + requestedDate → snapshot=2` | **reler**: FULL imprime a janela FULL; snapshot = \|slotDates\| daquele perfil, não o 2 mágico. Ajustar expect. Não alargar FULL. |
| A9-4 | A5 chão 2 `scoped BOOKING snapshot=2` | **actualizar** — o 2 morreu de propósito |

### 4.5 Story 9 — slots / store

| # | Input | Expected |
|---|---|---|
| S9-1 | `replaceSlotsForDate('2026-09-05', [Tiago 10:00])` depois de fixture com Tiago 14:00 available | 14:00 **ausente**; 10:00 presente. Sem telefone. |
| S9-2 | `subtractOccupiedSlotStarts` + appointment `confirmed` no start | start some; `subtractedOccupied ≥ 1` |
| S9-3 | appointment `cancelled` no start | start **permanece** (cancelled fora) |
| S9-4 | `listActiveAppointmentWindowsForDate` SQL | ainda `scheduled`/`confirmed`; sem coluna de telefone |
| S9-5 | `mapStatus` / `STATUS_BY_ID` | 4/6/8/9 intactos; id inventido → `unknown` (não entra no subtract) |

Não mockar GET Trinks live. Fixture de payload `{ data: [{ id, horariosVagos: ['10:00'] }] }` no teste do mapper se Dex o extrair; senão S9-1 no store chega.

---

## 5. Out / stop rules

**Dex para se:**

- aparecer SKU pezinho, row de ficha com preço, ou POST Trinks;
- `STATUS_BY_ID` ganhar id; `unknown` entrar no subtract; tabela de Ausência;
- `TRINKS_RECONCILE_INTERVAL_MIN` / Nginx / Hostinger / cola 46589 / kill switch / `BOT_ACCEPT_ALL`;
- GET fora de `ensureSlotSnapshot(date)` para `date ∈ slotDates`;
- teste com E.164, nome de cliente, OPEN, ou roteiro `0007` ao vivo;
- story 10 (recorrência / cancel de série) entrar no diff.

**Residual honesto:**

1. Prompt no dashboard continua v3.2.3 até Victor colar. Código + KB local + OPERATIONAL_NOTES fecham o chão no container; o Haiku no TESS ainda pode few-shot-handoff até a cola.
2. PATCH 39496 depois do gate + ACK — Orion/Victor, não Dex neste turno.
3. Corrida 1–44 min sem row e sem GET (idade &lt;45): oferta pode listar; confirm recusa. Igual chão 2.
4. Se Dara achar `14:00`/`16:30`/`17:00` ainda em `horariosVagos`, a grade **não** esconde — STOP persistência, não é “inventar Ausência”.
5. Recorrência: se a ocorrência já é `confirmed` isolado, a oferta já ocupa. Cancel de série = story 10 / Dara. Ponteiro: `docs/stories/salon-whatsapp-chao-10-recorrencia-trinks.md`.

**Precisa Victor?** Cola v3.2.4 + ACK sync 4 memories **depois** do Quinn. Não para o Dex começar os ficheiros. Kill switch **fica false**.

---

## 6. Ready for Dex?

| Story | Ready? | Por quê |
|---|---|---|
| 8 pezinho cortesia | **yes** | D8.1–D8.4 únicos; hunks P1–P7 + 4 KB; FILTER/slots/tags nomeados; C3/C4 reescritos; I1/C5/C6 intactos. |
| 9 Ausência ocupa | **yes** | D9.1 SOT = `horariosVagos`; D9.2 refresh = `slotDates`; D9.3 inteiros; D9.4 Dara GET paralelo (não bloqueia o refresh). Persistência = STOP. |

**Quinn:** gate = testes novos verdes + C5/C6/I1/subtract cancelled/confirmed inalterados no veredito. Sem WhatsApp até story 11.

**Dara:** GET §5. Story 10 dump é **dela** — este ficheiro não desenha recorrência.

**Orion:** W Dex 8 → Quinn → Dex 9 → Quinn. Kill switch off. Sem Hostinger. Sem cola no meio.

— Aria, arquitetando o futuro 🏗️
