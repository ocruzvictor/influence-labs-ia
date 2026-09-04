# Onda 2 Fase A — tetos de triagem (código, não prompt)

**Autor:** Aria (@architect) · motor Grok 4.6 High  
**Orquestrado por:** Orion · **Implementa:** Dex (@dev) depois deste artefato  
**Data:** 2026-09-04  
**Branch de desenho:** `feature/tess-commit-honesty`  
**HEAD live (não tocar):** container ainda `fa0ec92` · `bot_toggles.global=false` — **não religar**  
**Natureza:** tetos. Sem patch neste turno. Sem cola 46589. Sem Hostinger. Sem POST Trinks. Sem git add/commit/push. last4 only.

SOT de fala desta semana (não inventar recepção):

| Artefato | Papel |
|---|---|
| `docs/handoffs/2026-09-04-mira-amostra-lexico.md` | rule_suggestions 1–5 · fios `2987` `4905` `4501` `4749` `0330` `1000` `2874` |
| `docs/analysis/floor-corpus-20260904.md` | 629 falas · `staff_outbound_in_window=0` |
| `docs/analysis/floor-corpus-reception-20260904.md` | Kapso: bot `0517` 756 outbound 100% `cloud_api`; recepção `9426` **0** msgs nesta semana |
| `docs/analysis/2026-09-04-mary-catalogo-lexico-schema.md` | schema 1.0.0 · `gender_qualifier` · `suggested_keyword` ≠ SKU |
| `docs/analysis/2026-09-04-orion-ondas-lexico-triagem.md` | Onda 2 Fase A = dentes de código |

Recepção junho (`9426`, max 2500 msgs): diz **“pé e mão”** para unha. **Não** autoriza alias `pezinho` → pedicure.

---

## 0. Goal / non-goals

### Goal

A Tess **lê** os cinco stems do chão desta semana (`tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`) no classificador e no filtro de catálogo, **sem** promover identidade SKU, **sem** tratar duração `2h de atendimento` (`2987`) como relógio 02:00, **sem** meter cargo em `detectNamedProfessionals`, **sem** reverter “Masculino” (`4749`) para Corte Feminino, **sem** vazar scratch `TA` / `[Validação rápida]` / `Consultando HABILITACAO` / `ID 14129543` no WhatsApp.

Contrato vivo que se mantém: `filterServicesByKeywords` → `null` = catálogo **unfiltered** (`filterCatalogForProfile`). O matcher de sinónimo existe precisamente para **não** cair nesse `null` quando o stem do cliente não é substring do nome Trinks.

### Non-goals (veto Dex)

- Religar o bot. Paste / split / edit 46589. Hostinger. POST Trinks. CREATE `9800`. Replay André 10:30. Flip `BOT_ACCEPT_ALL`.
- Reabrir P-BUDGET caps, UNCERTAIN→MIN, item 7.
- Alias identidade: `tintura` → `color`; `pezinho` → `pedicure`.
- Meter `maquiador` em `PROFESSIONAL_RE`.
- Migration Postgres. Campo novo em `clients` / `bot_thread_state`.
- Seed `mão tradicional` (Orion citou; Mary/catálogo: **sem** last4 nesta semana).
- Inventar SKU de pezinho/contorno. `sku_status` continua `unmatched` / `pending_mira`.
- Usar fala de recepção **desta** semana (Kapso `9426` = 0). Junho só como âncora negativa (“pé e mão” ≠ pezinho).
- Fechar o grão das **383** falas longas sem keyword com estes 5 stems.

---

## 1. Tensão a resolver (tintura / gloss / pezinho / maquiador)

Hoje `filterServicesByKeywords` (~552):

1. `hits = FILTER_SERVICE_KEYWORDS.filter(kw => norm.includes(kw))`
2. se `hits` vazio → **`null`** (dump do catálogo)
3. senão filtra `s.nome` com `name.includes(kw)`
4. se o filtro zera → **`null` de novo**

Somar `tintura` na lista **sem** nomes Trinks contendo `"tintura"` produz `hits=['tintura']` → zero rows → `null` → FULL catalog. O mesmo para `gloss` e `maquiador`. Isso **não** é “ligar o stem”. É o furo.

**Decisão (uma):** matcher de **sinónimo de nome**, não alias de identidade.

```
cliente diz STEM
    → STEM entra em hits (intent + telemetria)
    → CATALOG_SYNONYMS[STEM] = substrings de s.nome
    → um serviço casa se name.includes(stem) OU name.includes(qualquer sinónimo)
    → NÃO se faz hits.push('color')   // isso seria tintura ≡ color
    → NÃO se faz hits.push('pedicure') // isso seria pezinho ≡ pedicure
```

`color` / `tonaliz` / `retoque` **já** estão no FILTER e continuam a casar quando o cliente **diz** essas palavras. O que é proibido é **reescrever** `tintura` como se fosse o stem `color`.

Pezinho é **special-case** (irmã de `isColloquialPenteado`), não linha da tabela de sinónimo química. Ver §3.

*[AUTO-DECISION] Matcher no mesmo `filterServicesByKeywords`, tabela `CATALOG_SYNONYMS` ao lado de `FILTER_SERVICE_KEYWORDS` → um caminho, zero alias map paralelo (reason: `null`=unfiltered é o contrato do assembler; duplicar filtros reabre o dump).*

---

## 2. File-level change list

Dex implementa **só** o comportamento abaixo. Sem A/B.

### 2.1 `backend/lib/booking-parser.js`

| Função / símbolo | Comportamento |
|---|---|
| `FILTER_SERVICE_KEYWORDS` (~523) | **Somar** stems `tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`. Não remover os atuais. Não somar `mão tradicional`. |
| `CATALOG_SYNONYMS` (novo, freeze) | Mapa stem → array de substrings de **nome de catálogo** (após `normalizeCatalogText` / `normalizeServiceName`). Ver tabela §3. Não é identidade SKU. |
| `expandCatalogMatch(name, hits)` (novo) | `true` se algum `hit` está no nome **ou** algum sinónimo do hit está no nome. |
| `isColloquialPezinho(messageText)` (novo) | `normalizeCatalogText` contém `pezinho`. Espelha o padrão de `isColloquialPenteado` (função nomeada, testável). |
| `filterServicesByKeywords(servicesData, messageText, opts?)` (~552) | (a) hits como hoje + 5 stems; (b) **se `isColloquialPezinho`:** NÃO disparar `peMatch`→`pedicure`; remover `cabelo` dos hits (co-ocorrência “pezinho **do cabelo**” foi o hop Cabelo e Barba em `1000`); `hits.push('cort')` se ainda não está; (c) `pe`/`mao` isolados **continuam** pedicure/manicure (`3684` / junho “pé e mão”); (d) filtrar com `expandCatalogMatch` em vez de só `name.includes(kw)`; (e) `applyGenderQualifier` no resultado se `opts.genderQualifier` ou detecção no próprio texto; (f) contrato `null` inalterado se nada casar. |
| `detectGenderQualifier(text)` (novo) | `masculino` \| `feminino` \| `null`. `\bmasculino\b` / `\bfeminino\b` no texto já normalizado. Último ganha se os dois aparecerem. |
| `applyGenderQualifier(services, qualifier)` (novo) | Se `qualifier` nulo, identity. Serviços **sem** masculino/feminino no nome **ficam**. Entre pares F/M, dropa o gênero oposto. Não dropa manicure/maquiagem/química sem gênero no nome. |
| `stripModelScratch` (~197) | Além do line-anchor `^\s*\[Valid[^\n]*$`: strip **inline** `[Validação rápida…]` / `[Validacao rapida…]` (com ou sem `]` de fecho na mesma linha). O leak `4749` não era só linha isolada. |
| `stripResidualBookingTags` (~212) | Estender, **depois** de `stripUnknownTags`: (1) `TA` com hífen ASCII **e** en/em-dash, espaços opcionais, e `(TA)` / `(TA)` scratch; (2) linha ou cláusula `Consultando\s+HABILITACAO` (com/sem acento); (3) header ecoado `HABILITACAO (` … até fim da linha; (4) `\(\s*ID\s+\d{6,}\s*\)` e `\bID\s+\d{6,}\b` (âncora Mira `ID 14129543`). Não stripar marcadores de mídia. Não alterar `formatServiceCatalogLine` / `renderHabilitacaoMap` nesta onda (o gate de produção é o texto **ao WhatsApp**). |
| `module.exports` | Exportar `FILTER_SERVICE_KEYWORDS`, `CATALOG_SYNONYMS`, `isColloquialPezinho`, `detectGenderQualifier`, `applyGenderQualifier`. |

### 2.2 `backend/lib/tess-context-intent.js`

| Função / símbolo | Comportamento |
|---|---|
| `SERVICE_KEYWORDS` (~30) | **Alinhar** com `FILTER_SERVICE_KEYWORDS` (import do parser — `booking-parser.js` **não** importa intent hoje; sem ciclo). Drift atual (`retoque`/`cabelo`/`combo` no FILTER, ausentes no intent; `limpeza de pele` vs `limpeza`) fecha nesta onda. Intent vê `pezinho`/`tintura`/`gloss`/`maquiador`/`masculino` para `hasServiceSignal` — senão `4501` continua `UNCERTAIN` vazio. |
| `DATE_RE` (~27) | Não apagar `\d{1,2}h`. Deixar de casar **duração**. Ver §4. `hasDateSignal` usa o helper, não o regex cru se o helper for mais simples de testar. |
| `ROLE_RE` (novo, ~28) | `/\bmaquiador(a\|es\|as)?\b/i` (e forma sem acento via `normalizeText`). **Fora** de `PROFESSIONAL_RE`. |
| `hasProfessionalSignal` (~67) | `PROFESSIONAL_RE \|\| ROLE_RE`. “Quem é maquiador aí?” (`0330`) deixa de ser `unknown`. |
| `PROFESSIONAL_RE` | **Intocado** na lista de nomes. |
| `classifyTessIntent` | Sem ramo novo. Ganha dentes só via `hasServiceSignal` / `hasProfessionalSignal` / `hasDateSignal`. Landing `vim pelo` já é `hasSchedulingAsk`. |
| `module.exports` | Exportar `ROLE_RE`, `DATE_RE` (se ainda não), `hasProfessionalSignal` (já exporta vários `has*`). |

### 2.3 `backend/lib/tess-context-slots.js`

| Função / símbolo | Comportamento |
|---|---|
| `detectExactClock` (~55) | Percorrer matches; **pular** token de duração (`isDurationHourToken`); manter `as 16h` / `16:00` / `14h30`. Não retornar `{hour:2, minute:0}` para `2987`. |
| `CLOCK_RE` / `detectPeriod` | Hour `2` já está fora 8–19 — período não é o ofensor. Não alargar “3h00”→15:00 nesta onda. |
| `detectNamedProfessionals` (~76) | Continua **só** `PROFESSIONAL_RE`. `maquiador` **não** vira nome de pessoa. |

### 2.4 `backend/lib/tess-context-assembler.js`

| Função / símbolo | Comportamento |
|---|---|
| `filterCatalogForProfile` (~61) | Aceitar `genderQualifier` opcional e passar em `opts` para `filterServicesByKeywords`. `null` continua = unfiltered. |
| `assembleTessContext` | Ler `params.genderQualifier` (vem do `sessionState`). Não inventar persistência aqui. |
| Disambigua pezinho | Irmã de `PENTEADO_DISAMBIGUA` (~20): uma linha, código, **não** prompt. *“Pezinho do cabelo = acabamento de corte (contorno). Não é pedicure.”* Prefixar `svcPayload.text` quando `isColloquialPezinho(messageText)` (e, se o last-turn for curto, quando o hit veio do histórico — mesmo critério do penteado: mensagem atual basta para `1000`/`4501`). |

### 2.5 `backend/lib/tess-context-budget.js`

`filterServicesByKeywords` no step `filter_catalog` (~321) herda o matcher. Passar o mesmo `genderQualifier` se o assembler já o tiver no closure — senão o texto concatenado `message+history` ainda detecta `masculino` enquanto o turno estiver no slice. Sticky de sessão cobre o slice curto.

### 2.6 `backend/server.js` — `processMessage`

| Trecho | Comportamento |
|---|---|
| `sessionState` (~1292) | Campo novo **in-memory**: `genderQualifier: 'masculino'\|'feminino'\|null`. Mesmo lifetime que `lastBookingOutcome` (story 2). **Zero** migration. |
| Sticky | `detected = detectGenderQualifier(messageText)`; se detected → `state.genderQualifier = detected`; senão **mantém**. Nunca resetar para feminino por omissão. |
| Cold start | Se `state.genderQualifier` nulo, varrer `state.history` + `state.persistedMemory.history` (já carregados) com `detectGenderQualifier` no texto concatenado. Evict/restart: rehidrata do histórico, não do Postgres. |
| `assembleTessContext(...)` | Passar `genderQualifier: state.genderQualifier`. |

*[AUTO-DECISION] Sem migration → `sessionState.genderQualifier` + rehydrate do history no cold start (reason: precedente `lastBookingOutcome`; Pedro G-P9 já documenta que sessão é volátil; gênero de corte não justifica 018+).*

### 2.7 Testes (ficheiros)

| Ficheiro | O que acrescentar |
|---|---|
| `backend/test/booking-parser.test.js` | filtro sinónimo, pezinho≠pedicure, pé e mão intacto, gender qualifier, strip HABILITACAO/ID/Validação inline. Estender o teste `vinicius angeli — Validação rápida, fence e TA- não vazam`. |
| `backend/test/tess-context-intent.test.js` | pezinho/tintura/maquiador/masculino → não `UNCERTAIN` vazio; `2h de atendimento` não é date-clock; `ROLE_RE` ≠ named person. |
| `backend/test/tess-context-slots.test.js` | bloco `detectExactClock` (~207): duração vs `as 16h`. `detectNamedProfessionals('quem é maquiador aí?')` → `[]`. |

Não exigir teste de integração Trinks. Não exigir browser.

---

## 3. Synonym table (stem do cliente → substrings do **nome** de catálogo)

Normalizar os dois lados com a mesma NFD-strip já usada em `normalizeCatalogText` / `normalizeServiceName`.

Estas substrings são o que Mira **viu a Tess listar** ou o que o snapshot de testes já nomeia. **Não** são `sku_id`. **Não** copiar `data/kb/conversa-v2/sinonimos-servicos.md` (hipótese Victor: KB = impressão).

| Stem do cliente (FILTER + intent) | Casa `s.nome` se contém | Explicitamente **não** |
|---|---|---|
| `tintura` | `coloracao`, `retoque`, `tonaliz` | **Não** `hits.push('color')`. Não afirma “tintura **é** o SKU Coloração”. `4905` listou Coloração Global / Retoque de Raiz / Tonalização — o matcher carrega **essa família**, não o catálogo inteiro. |
| `gloss` | `coloracao`, `retoque`, `tonaliz` | Idem. Não inventar SKU “Gloss”. Nota operacional live já diz que Gloss não é marca vendida — Fase A só evita dump FULL e `UNCERTAIN` vazio; a recusa de marca continua sendo do modelo + snapshot, não um alias. |
| `pezinho` | **não** vai na tabela de sinónimo química. Special-case → hit virtual `cort` (+ `expandCatalogMatch` com `cort` = nomes que já casam corte). | **Nunca** `pedicure`. **Nunca** tratar como `pe` isolado. Remover hit `cabelo` enquanto `pezinho` presente (`1000`: “Pezinho do cabelo” → Cabelo e Barba). |
| `maquiador` | `maquiagem`, `make` | Não é nome de profissional. Não entra em `PROFESSIONAL_RE`. Role → catálogo de maquiagem (o win `0330` já listou Fefe/Eli/Kamila; o filtro só deixa de despejar o salão inteiro). |
| `masculino` | `masculino` | Não é sinónimo de `cort`. É **qualificador**. `applyGenderQualifier` dropa `feminino` no nome quando o sticky é masculino. `2874` “progressiva masculina” já acerta via `progressiva` — não desfazer. |

**Pé / mão (não é stem novo):** `pe`/`pes` isolados → `pedicure` (+ depilação de pé, regra atual ~570). `mao`/`maos` → `manicure`. Recepção junho: “pé e mão” = unha. Cliente `3684` mesma locução (pós-off — não pontuar Tess; o matcher **deve** continuar a ver unha).

**Ordem de aplicação dentro de `filterServicesByKeywords`:**

```
1. hits ← FILTER stems no texto
2. se isColloquialPezinho:
     bloquear peMatch
     hits = hits sem 'cabelo'
     garantir 'cort'
3. senão: peMatch / maoMatch como hoje
4. isColloquialPenteado → 'cort' (inalterado)
5. filter via expandCatalogMatch(name, hits)
6. applyGenderQualifier
7. length ? filtered : null
```

---

## 4. Relógio vs duração (`2987`)

Ofensor: `DATE_RE` tem `\d{1,2}h`; `detectExactClock` tem `/\b(\d{1,2})\s*h\b/` e devolve o **primeiro** match. “não são 2h de atendimento?” → `{hour:2, minute:0}` → `pickStartsForOffer` ancora 02:00.

**Helper único** (pode viver em `tess-context-slots.js` e ser usado pelo intent, **ou** em intent e importado pelo slots — Dex escolhe o sítio; o predicado é um):

`isDurationHourToken(norm, indexOuMatch)` é true quando o `Nh` está em:

- `\b\d{1,2}\s*h\s+(de\s+)?(atendimento|duracao|servico|sessao)\b`
- `\b(leva|demora|dura[m]?|sao|são)\s+\d{1,2}\s*h\b`

**Não** é duração:

- `as 16h` / `às 16h` (teste existente `detectExactClock`)
- `14h` / `14h30` / `16:00` sem o lookahead `de atendimento|…`
- `10h` durante booking (teste intent: scheduling_in_progress)

`DATE_RE`: o ramo `\d{1,2}h` ganha lookahead negativo ` (?!\s+(de\s+)?(atendimento|duracao|servico|sessao)\b) ` **e** `hasDateSignal` ignora o token se `isDurationHourToken` no texto **só** tem duração (se houver `sábado` + `2h de atendimento`, `sábado` ainda é date — correto).

`detectExactClock`: iterar todos os padrões; skip duração; se sobrar `as 16h` no mesmo texto, devolver 16:00.

Fora: I3 contínuo / footer HORARIOS ≥ duração (`2987` ocupação 15:00). Mira apontou; Orion **não** abriu isso nesta Fase A. Não desenhar janela contínua aqui.

---

## 5. `ROLE_RE` vs `PROFESSIONAL_RE`

```
PROFESSIONAL_RE  → pessoas (tiago, andre, fefe, …) → detectNamedProfessionals
ROLE_RE          → cargo (maquiador/maquiadora)     → hasProfessionalSignal only
```

Se `maquiador` entrar no named-person regex, `compactBookingSlotsBlock` trata “quem é maquiador” como profissional citado e pede relógios de um token que **não** casa `profNameMatchesToken`. Poluição pura.

`0330` / `2987` já leram o cargo via snapshot+prompt. Fase A dá dente ao **classificador** e ao **filtro de catálogo** (sinónimo `maquiagem`), não ao picker de nomes.

---

## 6. `gender_qualifier` (`4749`)

Mary: `ServiceAsk.gender_qualifier = masculino | feminino | null`. Código:

| Camada | Onde | Por quê |
|---|---|---|
| Detecção | `detectGenderQualifier` no turno | “Masculino” / “É masculino” |
| Sticky | `sessionState.genderQualifier` | O turno seguinte (“Tem horário a tarde”) **não** traz a palavra |
| Rehydrate | history + persistedMemory no cold start | Evict não exige 018 |
| Dente | `applyGenderQualifier` no catálogo filtrado | Sem Corte Feminino no payload, o modelo não tem o SKU default para ecoar |

Não escrever no Postgres. Não meter no `DADOS_CLIENTE` nesta onda (isso vira prosa de prompt). O filtro **é** o dente.

`2874` manhã (progressiva masculina no 1º tiro) é o padrão a **não** desfazer: `progressiva` já hitava; `masculino` a mais só aperta o gênero se existirem SKUs F/M.

Residual honesto: restart do container zera sticky até o histórico rehidratar; se o slice de 8 turnos já perdeu “Masculino” **e** a memória persistida também, o default feminino pode voltar. Mesmo teto de `lastBookingOutcome`.

---

## 7. Sanitização de saída (fidelidade WhatsApp)

Live já tem `stripUnknownTags` + line-anchor `[Valid…]` + `\bTA\s*-\s*`. Mira: leak **ainda** em `4749` (TA + Validação) e `0330` (`ID 14129543`, `Consultando HABILITACAO`).

Hipótese de arquitetura (não precisa ser verdade histórica do deploy): o âncora `^` falha **inline**; `TA` com outro dash / `(TA)` escapa; HABILITACAO e `ID n` **nunca** tiveram regra.

Estender `stripResidualBookingTags` (único gate ao Kapso — `server.js` já chama). Teste `vinicius angeli` **permanece** verde e ganha casos §8.

Não colar 46589. Não “consertar” o modelo. O strip é o dente.

---

## 8. Test cases Dex MUST add

Formato: input → expected. last4 = âncora de evidência, não fixture PII.

### 8.1 Catálogo — `filterServicesByKeywords`

Fixture mínima (nomes, não ids reais obrigatórios):

`Corte Masculino`, `Corte Feminino`, `Pedicure`, `Manicure`, `Cabelo e Barba`, `Coloração Global`, `Retoque de Raiz`, `Tonalização`, `Maquiagem`, `Progressiva`.

| # | Input | Expected |
|---|---|---|
| C1 | `valor para tintura` (`4905`) | **não** `null`. Inclui Coloração Global, Retoque de Raiz, Tonalização. **Não** exige que o stem `color` tenha sido pushed para `hits`. |
| C2 | `trabalham com gloss?` (`4905`) | **não** `null`. Mesma família química. Zero row nomeada “Gloss” necessária. |
| C3 | `Posso passar aí pra arrumar o pezinho do cabelo?` (`4501`) | **não** `null`. Inclui Corte Masculino (via `cort`). **Exclui** Pedicure. **Exclui** Cabelo e Barba (hit `cabelo` suprimido). |
| C4 | `Pezinho do cabelo` (`1000`) | Idem C3. `isColloquialPezinho === true`. |
| C5 | `queria fazer o pé sábado` | **inalterado**: Pedicure (+ Depilação de Pé se na lista). Não Corte. |
| C6 | `marcar um horário para pé e mão` (`3684` locução; junho recepção) | Pedicure **e** Manicure. Não é pezinho. |
| C7 | `quero um penteado de festa` | **inalterado**: Penteado, não Pedicure. |
| C8 | `Masculino` com opts `{ genderQualifier: 'masculino' }` ou texto `É masculino` | Inclui Corte Masculino. **Exclui** Corte Feminino. Manicure (sem gênero no nome) permanece se estiver nos hits por outro stem; se o único hit for `masculino`, só SKUs com `masculino` no nome. |
| C9 | `Qual valor da progressiva masculina?` (`2874`) | Progressiva presente (stem já existia). Não regride. |

### 8.2 Intent — `classifyTessIntent`

| # | Input | Expected |
|---|---|---|
| I1 | `Posso passar aí pra arrumar o pezinho do cabelo?` (`4501`) | **não** `UNCERTAIN` por `unknown`/vazio de serviço. `hasServiceSignal` true → `SCHEDULING` (compound/booking) confidence high. |
| I2 | `valor para tintura` (`4905`) | `PRICING` (PRICE_RE + serviço). |
| I3 | `Quem é maquiador aí?` (`0330`) | **não** `UNCERTAIN` unknown. `hasProfessionalSignal` true (ROLE). `SCHEDULING` ou compound; `detectNamedProfessionals` no slots teste à parte = `[]`. |
| I4 | `não são 2h de atendimento?` (`2987`) | `hasDateSignal` **false** se o único `Nh` for duração. (Outros tokens no fio real — `sábado` — continuam date.) |
| I5 | `as 16h` / `quero cortar sábado 14h com o Erick` | **inalterado**: date/clock + SCHEDULING. |
| I6 | `É masculino` (`4749`) | `hasServiceSignal` true (`masculino`). Não `UNCERTAIN` unknown. |
| I7 | `Oi, vim pelo Studio Tirra. Quero agendar` | **inalterado** SCHEDULING (`hasSchedulingAsk`). |

### 8.3 Clock — `detectExactClock`

| # | Input | Expected |
|---|---|---|
| K1 | `as 16h` | `{ hour: 16, minute: 0 }` (teste atual, não quebrar) |
| K2 | `prefiro 16:00` | `{ hour: 16, minute: 0 }` |
| K3 | `não são 2h de atendimento?` (`2987`) | `null` (não `{hour:2, minute:0}`) |
| K4 | `leva 2h` | `null` |
| K5 | `não são 2h de atendimento, prefere as 16h` | `{ hour: 16, minute: 0 }` (duração skip, clock permanece) |
| K6 | `10h30` | `{ hour: 10, minute: 30 }` |

### 8.4 Named professionals

| # | Input | Expected |
|---|---|---|
| N1 | `Quem é maquiador aí?` | `detectNamedProfessionals` → `[]` |
| N2 | `maquiadora não é só a Fefe?` (`2987`) | `['fefe']` (nome). Token `maquiadora` **não** entra no Set. |
| N3 | `corte com o Tiago` | `['tiago']` inalterado |

### 8.5 Gender sticky (unit do helper + contrato assembler)

| # | Input | Expected |
|---|---|---|
| G1 | `detectGenderQualifier('Masculino')` | `'masculino'` |
| G2 | `detectGenderQualifier('É masculino')` | `'masculino'` |
| G3 | `detectGenderQualifier('Tem horário a tarde')` | `null` (sticky é responsabilidade do `sessionState`, não deste helper) |
| G4 | `applyGenderQualifier([Corte Masculino, Corte Feminino, Manicure], 'masculino')` | Corte Masculino + Manicure; **sem** Corte Feminino |
| G5 | Documentar no teste de assembler (se Dex tocar a assinatura): `filterCatalogForProfile` com history contendo `Masculino` e mensagem `tem horario a tarde` + `genderQualifier: 'masculino'` → catálogo sem Corte Feminino |

Não exigir teste e2e `processMessage` se o helper + assembler cobrirem o dente; se Dex plugar `server.js`, um teste de sessão in-memory (padrão `lastBookingOutcome`) é suficiente.

### 8.6 Strip — estender `vinicius angeli`

| # | Input | Expected |
|---|---|---|
| S1 | Bloco atual `[Validação rápida: … Corte Masculino (TA) = 60min]` | **inalterado**: sem Validação, sem 60min contínuos; `Confirma` e `17h` ficam |
| S2 | `TA - Corte Masculino` no meio da frase | sem `TA -`; `Corte Masculino` fica |
| S3 | `Corte Masculino (TA - Corte Masculino)` | sem `TA -` |
| S4 | Inline: `tenho 17h [Validação rápida: sábado 05/09 … (TA) = 60min] Confirma?` (`4749` scratch) | sem Validação, sem `(TA)`; `Confirma?` fica |
| S5 | `Consultando HABILITACAO` (`0330`) | ausente no output |
| S6 | `HABILITACAO (só ofereça profissional listado…)` ecoado | ausente |
| S7 | `ID 14129543` e `(ID 14129543)` (`0330`) | ausente; prosa ao lado permanece |
| S8 | `[CLIENTE ENVIOU IMAGEM]` | **preservar** (D1) |

---

## 9. Honest residual risks

1. **Kapso semana vazia.** Linha recepção `9426` (`94831`): 0 mensagens 01–04/09; conversa mais nova 2026-06-20. `staff_outbound_in_window=0`. Estes tetos **não** calibram a boca da recepção desta semana. Junho ensina só a âncora negativa: “pé e mão” = unha ≠ pezinho. Export WhatsApp Business da semana continua o único fecho do lado humano (Mary C2–C4).

2. **383 não fecha com 5 stems.** Orion: 383 falas longas sem keyword / 383 intent null em 511. Os cinco stems cobrem a **cauda amostrada** (Mira), não o denominador. `cort` já tinha 75 hits; o ofensor frequente da semana é encaixe + nome de profissional + palavras que não são SKU. Fase A não é o catálogo 80% Mary.

3. **Pezinho sem SKU.** `1000` pediu contorno orelha/pescoço. Snapshot não tem (Mira: handoff `orcamento_referencia`). Fase A mapeia para **família corte** + disambigua “não é pedicure”. Cliente que recusar corte cheio ainda pode handoff. `sku_status=pending_mira`. Não criar serviço Trinks.

4. **Gloss sem SKU.** Matcher carrega química. Tess ainda pode (e deve poder) dizer que não vende a marca. O drop `4905` pós-11:26Z (inbound sem turno) é **outro** ofensor — fora desta onda.

5. **`genderQualifier` volátil.** Igual `lastBookingOutcome`. Restart / evict / slice de 8 turnos sem a palavra = regressão possível ao default feminino.

6. **Strip ≠ prompt fiel.** Haiku ainda pode *gerar* scratch; o gate é não enviar. IDs no bloco HABILITACAO **injetado no contexto** continuam visíveis ao modelo (`renderHabilitacaoMap` usa `(ID ${id})`). Fase A limpa o **outbound**. Tirar ID do contexto é P-BUDGET / outra onda.

7. **`2h` solto.** Helper cobre `2h de atendimento` e `leva 2h`. `2h` isolado ainda pode ser relógio. Aceitável: não há evidência Mira desse isolado.

8. **Ocupação 15:00 / janela 30<60.** `2987` I3 e `4749`/`2874` `guard.blocked` **não** são léxico. Fora.

9. **Live `fa0ec92`.** Estes tetos são desenho na branch. Dex não deploya, não religa, não rsync.

---

## 10. Auto-decisões

1. Synonym matcher **dentro** de `filterServicesByKeywords`, não rewrite `tintura`→`color`.  
2. `pezinho` = special-case (bloquear `pe`, suprimir `cabelo`, push `cort`), não linha química.  
3. `SERVICE_KEYWORDS` := import de `FILTER_SERVICE_KEYWORDS` (fecha drift).  
4. `ROLE_RE` só `maquiador(a|es|as)?`.  
5. Gênero = `sessionState` + rehydrate history; **não** migration.  
6. Strip outbound; não mudar `renderHabilitacaoMap` nesta onda.  
7. Sem `mão tradicional`. Sem SKU inventado.  
8. Sem I3 contínuo / P-BUDGET / 46589.

---

## 11. Handoff

**Dex:** implementar §2 + testes §8. Kill switch permanece `false`. Não colar prompt. Não POST Trinks.

**Quinn:** gate = testes novos verdes + os existentes (`vinicius angeli`, `as 16h`, pé/mão, penteado dia a dia) inalterados no veredito.

**Mira:** Fase A não substitui cruzamento snapshot (`pending_mira` pezinho).

**Orion:** Fase B (linguagem 46589) **depois** destes dentes + ACK Victor. Religar = decisão à parte.

— Aria, arquitetando o futuro 🏗️
