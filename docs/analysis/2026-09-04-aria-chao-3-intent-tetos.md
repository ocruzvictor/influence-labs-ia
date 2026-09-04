# Chão 3 — tetos de intent da cauda (código, não prompt)

**Autor:** Aria (@architect) · motor Grok 4.6 High  
**Orquestrado por:** Orion · **Implementa:** Dex (@dev) depois deste artefato · **Replay N:** Dara (@data-engineer)  
**Story:** [salon-whatsapp-chao-3-intent-cauda](../stories/salon-whatsapp-chao-3-intent-cauda.md)  
**Data:** 2026-09-04  
**Branch de desenho:** `feature/tess-commit-honesty`  
**HEAD live (não tocar):** container ~`405b005` · `bot_toggles.global=false` — **não religar**  
**Natureza:** tetos. Sem patch neste turno. Sem cola 46589. Sem Hostinger. Sem POST Trinks. Sem git add/commit/push. Sem smoke `0007`. last4 only.

SOT desta fatia (não reabrir stems da Onda 2):

| Artefato | Papel |
|---|---|
| `docs/stories/salon-whatsapp-chao-3-intent-cauda.md` | AC1–AC4 · persistir landing / daypart / named / FAQ |
| `docs/analysis/2026-09-04-orion-programa-chao-unico.md` | leftover 383 · não fecha 80% por chute |
| `docs/analysis/2026-09-04-orion-ondas-lexico-triagem.md` | 383 null / 511 user · ChannelPattern · daypart `4749` |
| `docs/analysis/floor-lexicon-catalog-v0.1.0.md` | seed v0.1.0 · `cp-studio-tirra-landing` · `t-sexta-final-do-dia` · `t-andre` |
| `docs/analysis/2026-09-04-mary-catalogo-lexico-schema.md` | 8 intents canónicos · ChannelPattern ≠ Term.class=landing · sem 9º intent |
| `docs/analysis/2026-09-04-aria-onda2-triagem-tetos.md` | **fechado** — pezinho / tintura / gloss / maquiador / DATE_RE duração / ROLE_RE / P-BUDGET caps |

---

## 0. Goal / non-goals

### Goal

A operação lê `conversation_history.intent` e **vê rótulo** nas quatro classes da semana que hoje entram vazias no dump: landing ChannelPattern, daypart, profissional nomeado, FAQ ops (PIX / endereço / funcionamento). Profile **MIN** quando a fala **não** tem sinal de SKU (`hasServiceSignal`). Replay local do dump 01–04/09 mostra intent null **caindo** vs 383/511. Sem meta de 80%. Sem SKU inventido.

O classificador **já devolve** os rótulos certos para as fixtures (I7 live). O furo é **persistir no caminho passivo** + **não promover BOOKING/FULL** quando SCHEDULING não tem SKU.

### Non-goals (veto Dex)

- Religar o bot. Paste / split / edit 46589. Hostinger. POST Trinks. CREATE `9800`. Replay André 10:30. Flip `BOT_ACCEPT_ALL`. Smoke `0007`.
- Reabrir stems Onda 2: `tintura` / `gloss` / `pezinho` / `maquiador` / `masculino` / `CATALOG_SYNONYMS` / `ROLE_RE` / duração `2h`.
- Reabrir caps P-BUDGET (16k / 24k). Reabrir `TESS_CONTEXT_MODE=full` / `FORCE_FULL`.
- “Classificar as 383”. Inventar 9º intent. Copiar `data/kb/conversa-v2/sinonimos-servicos.md` para `sku_id`.
- Somar `final do dia` a `DATE_RE` (sexta já hit). Migration. Campo novo em `clients` / `bot_thread_state`.
- Funil CRM (`funnel_field_exists` continua `false`). Bloco “só prof / só 1 dia” (P-BUDGET leftover).
- Reescrever `computeCorpusStats` para mentir o 383. Prometer 13,5 cr.

---

## 1. Tensão a resolver (null no dump ≠ classificador cego)

`classifyTessIntent` **nunca** devolve `null`. Fallback é `UNCERTAIN`. Fixtures desta story **já passam** no unit:

| Fala | Hoje (classificador) | Hoje (coluna no dump) |
|---|---|---|
| `Oi, vim pelo Studio Tirra. Quero agendar` | `SCHEDULING` high (`hasSchedulingAsk` + compound) — I7 | muitas rows **null** |
| `sexta final do dia` / `horário na sexta final do dia` (`4749`) | `SCHEDULING` (`DATE_RE` via `sext[ao]`) | null se só passivo |
| `com o André` (`0285` família) | `SCHEDULING` (`PROFESSIONAL_RE` `andre`) | null se só passivo |
| `aceita pix?` / `endereço` / `horário de funcionamento` (`0007`) | `FAQ` (`FAQ_RE`) | null se só passivo |

Dois furos, um só desenho:

**Furo A — persist.** `server.js` ~2832 grava inbound Kapso **antes** da whitelist / kill switch:

```
{ role: 'user', content: messageText, agent: 'passive' }   // sem intent → clipIntent → NULL
```

`processMessage` (~1760) **já** grava `intent: intentResult.intent` quando o bot corre. Orion 383/511 é turno user **bruto com duplicata passive**. Kill switch off + whitelist + inbound-only = a maior parte das 383 é row passiva (ou só passiva). Ops lê a coluna, não o stdout.

**Furo B — perfil.** `buildContextProfile` scoped + `SCHEDULING` → `BOOKING` (catálogo + slots + profs). Sem `hasServiceSignal`, `filterServicesByKeywords` devolve `null` = catálogo **unfiltered**. Landing “quero agendar” vira dump do salão. AC2: profile **MIN**, sem FULL.

*[AUTO-DECISION] Não criar ramo novo em `classifyTessIntent` para as quatro fixtures → os dentes já existem; Dex persiste + trava o perfil (reason: I7 / DATE_RE / PROFESSIONAL_RE / FAQ_RE já verdes; 9º intent é veto Mary).*

---

## 2. File-level change list

Dex implementa **só** o comportamento abaixo. Sem A/B. Sem tocar `booking-parser.js` FILTER / sinónimos.

### 2.1 `backend/lib/tess-context-intent.js`

| Função / símbolo | Comportamento |
|---|---|
| `INTENTS` | **Intocado.** Sem 9º valor. |
| `hasSchedulingAsk` / `DATE_RE` / `PROFESSIONAL_RE` / `FAQ_RE` / `classifyTessIntent` | **Intocados** para as fixtures. Não somar `final do dia`. Não reabrir duração / ROLE / stems. |
| `isAudioTranscript(messageText)` (novo) | true se `/\[AUDIO TRANSCRITO\]/i`. Prefixo live em `server.js` ~2911. **Não** está em `isMediaMessage` hoje. |
| `isIntentDenylist(messageText)` (novo) | true se: `isMediaMessage` **ou** `isAudioTranscript` **ou** texto vazio/whitespace **ou** `isLeroUtterance`. Ver §4. |
| `isLeroUtterance(messageText)` (novo) | Ver §4.2. Determinístico, 0 LLM. |
| `PASSIVE_PERSIST_INTENTS` (novo, freeze) | `SCHEDULING`, `FAQ` — só as classes da story no caminho passivo. |
| `intentToPersist(intentResult, messageText, { path })` (novo) | Contrato §6. Exportar. |
| `module.exports` | Exportar `isAudioTranscript`, `isIntentDenylist`, `isLeroUtterance`, `intentToPersist`, `PASSIVE_PERSIST_INTENTS`, `hasSchedulingAsk` (já exporta), `hasFaqSignal` (já). |

### 2.2 `backend/lib/tess-context-profiles.js`

| Função / símbolo | Comportamento |
|---|---|
| `buildContextProfile(intentResult, opts)` | Aceitar `hasServiceSignal?: boolean` e `keepBookingWithoutSku?: boolean`. **Omitir `hasServiceSignal` = `true`** (não quebrar testes que não passam o flag — BOOKING permanece). |
| Override MIN | Se `intent` ∈ `{SCHEDULING, RESCHEDULE}` **e** `hasServiceSignal === false` **e** `keepBookingWithoutSku !== true` **e** `effectiveMode !== 'full'`: devolver o **mesmo objeto MIN** que `UNCERTAIN` (zero fetch). |
| `UNCERTAIN` / `TRIVIAL` / `FAQ` / `PRICE` / `CANCEL` | Inalterados. |
| `effectiveMode === 'full'` + SCHEDULING | **Inalterado** (veto: não reabrir FULL). Residual: `FORCE_FULL` ainda despeja. |

*[AUTO-DECISION] Default `hasServiceSignal=true` quando omitido → regressão zero nos testes de perfil existentes (reason: story 6 pós-failed BOOKING e “explicit date → 1 slot day” não passam o flag).*

### 2.3 `backend/lib/tess-context-assembler.js`

| Função / símbolo | Comportamento |
|---|---|
| `assembleTessContext` | Importar `hasServiceSignal`, `normalizeText`, `isSchedulingInProgress`, `isDraftSchedulingContext`, `isPostBookingFailedContext` de `tess-context-intent.js`. |
| `buildContextProfile(...)` | Passar `hasServiceSignal: hasServiceSignal(normalizeText(messageText))` e `keepBookingWithoutSku: isSchedulingInProgress(historyForModel) \|\| isDraftSchedulingContext(historyForModel) \|\| isPostBookingFailedContext(historyForModel, params.lastBookingOutcome)`. |
| `lastBookingOutcome` | Ler de `params` se já existir; senão `undefined` (mesmo contrato do classificador). |
| Caps / `applyContextBudget` | **Não** retocar números. |

Landing 1º turno (history vazio, sem SKU) → MIN. “10h” no meio do funil (assistant perguntou horário) → `keepBookingWithoutSku` → BOOKING. Não matar a grade mid-thread.

### 2.4 `backend/server.js` — persist

| Trecho | Comportamento |
|---|---|
| Passive Kapso (~2832) | **Depois** de ter `messageText` (ainda **antes** da transcrição de áudio — áudio-only neste ponto é vazio). `intentResult = classifyTessIntent(messageText, [], [])`. Gravar `intent: intentToPersist(intentResult, messageText, { path: 'passive' })`. Continua `agent: 'passive'`. |
| `processMessage` save user+assistant (~1760) e timeout (~1618) | `intent: intentToPersist(intentResult, messageText, { path: 'bot' })`. |
| 2-phase assistant (~2419) | Mesmo `intentToPersist` (path `bot`). |
| Skip trivial / telemetry / `persistTessTurnEvent` | **Não** usar denylist no evento operacional — o evento continua a ver o intent classificado. A denylist é a **coluna** `conversation_history.intent`. |
| Audio ~2911 | Passive já correu com texto vazio → null. Depois da transcrição, `processMessage` recebe `[AUDIO TRANSCRITO]: …` → denylist → persist **null** mesmo se o texto disser “quero agendar”. |
| Operator resume (~1305) | Fora. Não carregar intent em assistant-only. |

Sem migration. `clipIntent` / `saveConversationTurns` já escrevem a coluna.

### 2.5 `backend/lib/conversation-history.js`

Intocado, salvo se Dex quiser um teste de contrato extra. `clipIntent('')` já é null.

### 2.6 Replay (Dex helper + Dara corre o número)

| Ficheiro | Comportamento |
|---|---|
| `backend/lib/salao-cli-ops.js` | Novo `replayIntentNullDrop(rows, { classify, persist })` **puro**: não UPDATE no banco. Input = rows já sanitizadas last4. Output = §7. |
| `backend/scripts/salao/contexto/replay_intent_null.js` (novo) | Lê dump (`dumpFloorCorpus` `--from 2026-09-01 --to 2026-09-04 --no-dedup`) **ou** JSON stdin. Filtra `role=user`. Imprime JSON last4-only. **Zero** write. |
| `dump_corpus_semana.js` | Não mudar o default `dedup=true`. Replay usa `--no-dedup` para casar o grain Orion 511. |

Dara corre o script contra o dump da janela e cola o inteiro no T3. Dex **não** inventa o N.

### 2.7 Testes (ficheiros)

| Ficheiro | O que acrescentar |
|---|---|
| `backend/test/tess-context-intent.test.js` | §8.1–8.2 (labels + denylist + `intentToPersist`). Não reescrever I1–I7 Onda 2. |
| `backend/test/tess-context-profiles.test.js` | §8.3 MIN sem SKU; default omitido = BOOKING; in-progress = BOOKING. |
| `backend/test/tess-context-assembler.test.js` | Um contrato: landing + scoped → `contextProfile === 'MIN'` e `fetchMeta.catalogRequested === false`. |
| `backend/test/conversation-history.test.js` | Passive com landing grava `SCHEDULING`; media/áudio grava `null`. |
| `backend/test/salao-cli-ops.test.js` | Replay helper: fixture de 5 rows (383-shape em miniatura) → drop ≥1, denylist não entra no numerador. |

Não exigir teste de integração Kapso. Não exigir browser. Não exigir WhatsApp.

---

## 3. Rótulos (existentes — sem 9º intent)

Mary: `recorded_intent` ∈ `TRIVIAL · FAQ · PRICING · SCHEDULING · CANCEL · RESCHEDULE · HANDOFF_LIKELY · UNCERTAIN`. ChannelPattern **não** vira Term.class=landing.

| Classe da story | Matcher já vivo | Intent persistido | Profile (scoped, 1º turno) |
|---|---|---|---|
| Landing `cp-studio-tirra-landing` — “vim pelo Studio Tirra. Quero agendar” | `hasSchedulingAsk` (`agendar` \| `vim pelo`) | **`SCHEDULING`** | **MIN** (sem SKU) |
| Daypart “sexta final do dia” (`4749`) | `DATE_RE` `sext[ao]` — `hasDateSignal` | **`SCHEDULING`** | **MIN** se `!hasServiceSignal` |
| Named “com o André” | `PROFESSIONAL_RE` `andre` | **`SCHEDULING`** | **MIN** se `!hasServiceSignal` |
| Composto daypart + named na **mesma** fala | `isSimpleBookingBundle` (date+pro) | **`SCHEDULING`** | **MIN** se `!hasServiceSignal` |
| FAQ ops PIX / endereço / funcionamento (`0007`) | `FAQ_RE` | **`FAQ`** | **FAQ** (já zero fetch — não é MIN, não é FULL) |
| Sem SKU + mid-funil (`keepBookingWithoutSku`) | history / pós-failed | `SCHEDULING` | **BOOKING** (não matar grade) |

*[AUTO-DECISION] Landing = `SCHEDULING`, não `UNCERTAIN` MIN-por-label (reason: AC2 pede SCHEDULING ou rótulo já existente; I7 já é SCHEDULING; gravar UNCERTAIN mentiria o funil falado e não mudaria o perfil — UNCERTAIN já é MIN).*

*[AUTO-DECISION] Daypart / named sem SKU = persist `SCHEDULING` + profile MIN (reason: BOOKING + filtro `null` = dump FULL de catálogo; “só prof / só 1 dia” é leftover P-BUDGET, veto desta story). Residual: Tess não vê slots de André na sexta até o cliente nomear serviço **ou** o funil já estar em draft.*

Não copiar KB. Não preencher `sku_id`. `masculino` no FILTER **já** é `hasServiceSignal` — “É masculino” (`4749`) continua BOOKING se scoped. Não desfazer Onda 2.

---

## 4. Denylist — o que **continua null**

A denylist governa a **coluna**. Não governa o skip TESS. Não converte as 33 `UNCERTAIN` históricas em null (isso seria regressão falsa no replay).

### 4.1 Sempre null (passive **e** bot)

| Família | Predicado | Por quê |
|---|---|---|
| Mídia | `isMediaMessage` — `[CLIENTE ENVIOU IMAGEM\|STICKER\|AUDIO\|VIDEO\|ÁUDIO]` + markers Kapso | AC1. Classificador hoje devolve UNCERTAIN; **não persistir** UNCERTAIN como se fosse cauda de agenda. |
| Áudio transcrito | `isAudioTranscript` — `[AUDIO TRANSCRITO]` | AC1. STT é lero-prone; “quero agendar” falado **não** fecha a story. |
| Vazio | `!normalizeText(messageText)` | Passive áudio-only antes da transcrição. |

### 4.2 Lero → null na coluna (passive **sempre**; bot: ver §6)

`isLeroUtterance` é true quando **nenhum** sinal persistível existe **e** casa um destes:

- Allowlist trivial isolada: `oi` / `ola` / `olá` / `oie` / `bom dia` / `boa tarde` / `boa noite` / `valeu` / `ok` / `ta bom` / `obrigad…` ≤14 (reusar `isTrivialAllowlist`).
- Só riso / emoji / sticker-prosa: `/^(k{2,}|haha+|rs+|kkk+|lol|👍|😊|🙏)+$/i` após strip de espaços.
- Noise de catálogo sozinho: `dia a dia` / `dia-a-dia` (term `t-dia-a-dia`, n=1, `3653`) **sem** `hasServiceSignal` / date / pro / faq / scheduling ask.
- Occupancy sozinha: `ja tem cliente` / `já tem cliente` / `opcao que ja tem cliente` (`2987`) **sem** outro sinal persistível.
- Duração sozinha: `isDurationHourToken` cobre o único `Nh` **e** `!hasDateSignal` residual (já o caso de `2h de atendimento`).

Lero **não** inclui: landing, sexta, André, PIX, endereço, “quero agendar”, “marcar horário”.

### 4.3 O que a denylist **não** é

- Mensagem longa >120 sem bundle → classificador `UNCERTAIN`. Passive: null. Bot: **continua** gravar `UNCERTAIN` (já nas 33). Não é denylist nova.
- `HANDOFF_LIKELY` / `CANCEL` / `PRICING` / `RESCHEDULE` no caminho **bot**: inalterado (já persiste). Passive **não** ganha esses rótulos nesta story.
- Recepção outbound (staff=0). Fora.

---

## 5. Profile MIN quando não há SKU

SKU nesta story = `hasServiceSignal(norm)` = substring de `FILTER_SERVICE_KEYWORDS` (já alinhado Onda 2). **Não** é `sku_id` Trinks. Named pro **não** é SKU. Daypart **não** é SKU. `vim pelo` **não** é SKU.

```
scoped + (SCHEDULING|RESCHEDULE) + !hasServiceSignal(turno)
  + !keepBookingWithoutSku
  → MIN (mesmo shape que UNCERTAIN)
```

`keepBookingWithoutSku` = funil já vivo (assistant pediu horário **ou** draft no history **ou** pós-failed). Protege “10h” / “Correto.” / “Outro dia”.

FULL mode: não mexer. Caps: não mexer.

FAQ / PRICE / CANCEL: não passam por este override.

---

## 6. Contrato `intentToPersist`

```
intentToPersist(result, text, { path: 'passive' | 'bot' }):
  if isIntentDenylist(text): return null
  if path === 'passive':
    if result.intent ∈ PASSIVE_PERSIST_INTENTS: return result.intent
    return null          // UNCERTAIN, TRIVIAL, PRICING, CANCEL, … no passivo
  // path === 'bot'
  return result.intent   // inclusive UNCERTAIN / TRIVIAL — grain das 33+2 intacto
                         // excepto denylist acima (media/áudio/vazio/lero-bot)
```

*[AUTO-DECISION] Lero no path `bot`: também null (reason: AC1 lista lero na denylist da coluna; as 33 UNCERTAIN históricas não se reescrevem; turnos novos de kkk/oi isolado deixam de inflar UNCERTAIN). Residual: `oi` no 1º turno bot deixa de gravar TRIVIAL — o classificador e o skip flag continuam iguais; só a coluna.*

Se Dex achar que zerar TRIVIAL no bot quebra um teste de histórico: **só então** restringir lero-null ao path `passive` e documentar no PR. Preferência destes tetos = null nos dois paths para denylist.

---

## 7. AC4 — como medir o replay **sem** inventar 80%

Mary §6 80% é cobertura de **catálogo** (Term / ChannelPattern / unclassified) no grain `unique_long`. **Proibido** usar 80%, 80,4% do tagger `norm_len≥40`, ou “64 landing/noise” como meta desta story.

### 7.1 Grain (obrigatório — copiar Orion)

| Campo | Valor |
|---|---|
| Janela | 2026-09-01 00:00 BRT → 2026-09-04 inclusive (mesmo `dump_corpus_semana.js --from 2026-09-01 --to 2026-09-04`) |
| Dedup | **`--no-dedup`** (511 é bruto com duplicata passive) |
| Filtro | `role = 'user'` apenas |
| Baseline | **383 null / 511** — constante Orion. Se o dump live divergir, Dara publica `delta` no footer e **não apaga** o 383 |

`dumpFloorCorpus` hoje conta `intent_null` em **todas** as roles. Replay **não** usa esse stats cru. Filtra user.

### 7.2 Fórmula (local, 0 LLM, 0 UPDATE)

```
baseline_null     = 383
user_rows         = dump user bruto
null_rows         = user_rows where intent IS NULL
would_fill        = count(null_rows where intentToPersist(classify(text), text, path=passive) ≠ null)
replay_null       = baseline_null - would_fill
drop              = would_fill
```

`path=passive` no replay: a maioria das 383 **é** passiva. Não simular history/futureBookings (replay 1º turno). Honestidade: mid-funil no dump pode ficar null no replay mesmo se o bot na hora teria SCHEDULING — Dara anota, não “corrige” com history.

### 7.3 Gate AC4 (sim/não, sem %)

**PASS** se **todas**:

1. `would_fill >= 1`
2. As quatro fixtures de §8.1, corridas no mesmo helper, entram em `would_fill` (não são denylist)
3. Denylist §8.2 **não** entra em `would_fill`
4. Relatório publica `baseline_null`, `user_n` (esperado ~511), `would_fill`, `replay_null` — inteiros, last4 sample dos filled (máx 12), **sem** percentagem-alvo

**FAIL** se Dex/Dara escrever “~80%” ou fechar as 383. Drop de 12 ou de 200 é igualmente válido.

### 7.4 Dois números, um gate

Dara **pode** (não é gate) publicar o grain dedup last4+texto user-null. AC4 olha **só** o grain bruto 383/511.

Não correr o tagger Mary. Não misturar `long_no_keyword` 383 (fala sem keyword) com intent-null 383 — Orion usou o mesmo inteiro; o replay **não** reabre essa identidade. Filtra intent IS NULL, ponto.

---

## 8. Test cases Dex MUST add

Formato: input → expected. last4 = âncora, não PII.

### 8.1 Intent + persist (fixtures da story)

| # | Input | classify | persist passive | persist bot | profile scoped 1º turno |
|---|---|---|---|---|---|
| L1 | `Oi, vim pelo Studio Tirra. Quero agendar` | `SCHEDULING` high | `SCHEDULING` | `SCHEDULING` | **MIN**, `fetchCatalog=false` |
| L2 | `vim pelo Studio Tirra` (sem “agendar”) | `SCHEDULING` (`vim pelo`) | `SCHEDULING` | `SCHEDULING` | **MIN** |
| D1 | `sexta final do dia` | `SCHEDULING` | `SCHEDULING` | `SCHEDULING` | **MIN** |
| D2 | `horário na sexta final do dia` (`4749`) | `SCHEDULING` | `SCHEDULING` | `SCHEDULING` | **MIN** |
| N1 | `com o André` | `SCHEDULING` | `SCHEDULING` | `SCHEDULING` | **MIN** |
| C1 | `sexta final do dia com o André` | `SCHEDULING` (bundle date+pro) | `SCHEDULING` | `SCHEDULING` | **MIN** |
| F1 | `aceita pix?` (`0007`) | `FAQ` | `FAQ` | `FAQ` | **FAQ** (não FULL, não BOOKING) |
| F2 | `qual o endereço?` | `FAQ` | `FAQ` | `FAQ` | FAQ |
| F3 | `horário de funcionamento` | `FAQ` | `FAQ` | `FAQ` | FAQ — **não** confundir com núcleo de encaixe |
| S1 | `quero cortar sábado 14h com o Erick` | `SCHEDULING` (I5) | `SCHEDULING` | `SCHEDULING` | **BOOKING** (`hasServiceSignal`) |
| S2 | `É masculino` (`4749`) | não UNCERTAIN (I6) | `SCHEDULING` | `SCHEDULING` | **BOOKING** (`masculino` no FILTER) |

### 8.2 Denylist (continua null)

| # | Input | persist (passive e bot) |
|---|---|---|
| Z1 | `[CLIENTE ENVIOU IMAGEM]` | `null` (não SCHEDULING, não UNCERTAIN na coluna) |
| Z2 | `[CLIENTE ENVIOU STICKER]` | `null` |
| Z3 | `[AUDIO TRANSCRITO]: quero agendar sexta com o André` | `null` |
| Z4 | `''` / `'   '` | `null` |
| Z5 | `oi` / `kkkkk` / `👍` | `null` |
| Z6 | `dia a dia` | `null` |
| Z7 | `opção que já tem cliente` (`2987`) | `null` |
| Z8 | `não são 2h de atendimento?` (`2987`) | `null` na coluna (hasDateSignal false; não promover SCHEDULING) |

I7 / I4 Onda 2 **permanecem** verdes no classificador. Z3 é só persist.

### 8.3 Profile (não reabrir FULL)

| # | Setup | Expected |
|---|---|---|
| G1 | `buildContextProfile(SCHEDULING, { scoped, hasServiceSignal: false })` | MIN, zero fetch |
| G2 | omitir `hasServiceSignal` + SCHEDULING scoped | **BOOKING** (default true) |
| G3 | SCHEDULING + `hasServiceSignal: false` + `keepBookingWithoutSku: true` | BOOKING |
| G4 | UNCERTAIN scoped / full | MIN inalterado |
| G5 | SCHEDULING + `effectiveMode: 'full'` + `hasServiceSignal: false` | **FULL** inalterado (veto) |
| G6 | FAQ + pix | FAQ profile inalterado |
| G7 | assembler: mensagem L1, history `[]`, scoped | `contextProfile === 'MIN'`, catálogo não pedido |
| G8 | assembler: `10h` + history assistant `qual horário…` | BOOKING (in-progress) |

### 8.4 Replay helper (miniatura, sem dump live)

Cinco rows user last4 fictício `0007`/`4749`/`0285`/`0330`/`3653`:

1. L1, intent null → would_fill  
2. D2, intent null → would_fill  
3. N1, intent null → would_fill  
4. Z1, intent null → **não** fill  
5. já `SCHEDULING` → fora do denominador null  

`would_fill === 3`, `drop >= 1`. Sem `%`.

---

## 9. Honest residual risks

1. **383 ≠ “falas longas sem keyword” resolvidas.** O inteiro coincide no relatório Orion; o trabalho aqui é a **coluna**. Replay pode cair 20 ou 200 e a fatia dura de serviço continua. Não reportar como 80% Mary.

2. **Passive + bot = duplicata.** O mesmo “vim pelo” pode existir null (passive) e SCHEDULING (bot). Replay preenche o null. Grain bruto **cai**; unique last4+texto pode mal mexer. Por isso os dois números — gate só no bruto.

3. **Áudio com pedido real.** Z3 deixa null. Cliente que só manda áudio “quero o André sexta” não entra no numerador. Aceitável: AC1.

4. **MIN sem SKU atrasa oferta.** “sexta + André” persistido não carrega slots até haver stem ou draft. Melhor que dump FULL. Não desenhar bloco prof-only aqui.

5. **`FORCE_FULL`.** Landing ainda pode FULL. Fora. Default live = scoped.

6. **Kill switch off.** Passive passa a gravar SCHEDULING/FAQ mesmo com bot calado. Isso é **ops**, não religar. Não envia WhatsApp.

7. **History no replay = []**. Mid-funil no dump sub-estima fill. Dara não “completa” com sessão.

8. **Live `405b005`.** Tetos de desenho. Dex não deploya, não religa, não rsync.

9. **Stems Onda 2.** Pezinho/tintura/gloss já live. Esta story **não** os reabre nem os conta como vitória da cauda.

---

## 10. Auto-decisões

1. Sem ramo novo no classificador para as quatro fixtures — persist + perfil.  
2. Landing / daypart / named → `SCHEDULING`; PIX/endereço → `FAQ`; sem 9º intent.  
3. Passive persiste só `{SCHEDULING, FAQ}`; denylist → null.  
4. Sem SKU + scoped + sem funil vivo → MIN (não BOOKING, não FULL).  
5. `hasServiceSignal` omitido = true.  
6. Não somar `final do dia` a `DATE_RE`.  
7. Replay grain = user bruto 383/511; PASS = drop ≥1 + fixtures filled + denylist excluded; **sem %**.  
8. Sem stems Onda 2, sem P-BUDGET caps, sem 46589, sem SKU da KB.

---

## 11. Handoff

**Dex:** §2 + testes §8. Kill switch permanece `false`. Não colar prompt. Não POST Trinks. Não inventar o inteiro do replay.

**Dara:** correr `replay_intent_null.js` na janela 01–04/09; colar inteiros no T3 da story. Sem 80%. Sem E.164.

**Quinn:** gate = testes novos verdes + I5/I6/I7 + perfil UNCERTAIN MIN + `vinicius angeli` / pé-mão **não** tocados. Sem WhatsApp.

**Orion:** ready-for-Dex **yes**. Religar = decisão à parte.

— Aria, arquitetando o futuro 🏗️
