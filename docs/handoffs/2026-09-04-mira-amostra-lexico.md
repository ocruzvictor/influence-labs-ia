# Mira — amostra léxico (W3 Wave 1)

**Persona:** Mira (Floor Quality) · motor Grok 4.6 High na leitura do fio  
**Orquestrado por:** Orion · schema Mary `1.0.0`  
**Janela:** seg 01/09/2026 00:00 BRT → 04/09/2026 23:59 BRT (`created_at` UTC 01/09 03:00 → 05/09 03:00)  
**Foco:** mismatch de **linguagem** (Ask-class vs o que a Tess tratou). Não é crédito.  
**Fonte:** SELECT `conversation_history` + `bot_operational_events` (VPS). last4 only. Sem E.164.  
**Kill switch:** `bot_toggles.global=false` desde **04/09 11:33 BRT**. Silêncio depois disso **não** é falha da Tess.  
**Fora:** patch, cola 46589, POST Trinks, religar bot. Eixo trinks mutate **não pontuado**. `0007` **não amostrado** (teste interno).

---

## floor_report

### counts

| Métrica | n |
|---|---:|
| last4 amostrados | **8** |
| Prioridade Orion (achados) | `2987` `4905` `4501` `4749` `0330` — todos no dump |
| Inbound-only da semana (7 last4, bate Orion) | `6153` `7016` `7153` `5953` `3684` `4657` `6361` |
| Inbound-only na amostra | `3684` (pé/mão + Fefe; **após** o off) |
| Extra pezinho (além do timeout) | `1000` |
| Extra contraste (progressiva masculina) | `2874` |
| `0007` | skip (teste) |

### threads_sampled

Scores 0 falhou / 1 misto / 2 ok. Eixos: **roteiro**, **horarios**, **confirmacao**, **fidelidade**. Trinks mutate = skip.

| last4 | janela (BRT) | roteiro | horarios | confirmacao | fidelidade | Ask-class cliente | Tess tratou como |
|---|---|---:|---:|---:|---:|---|---|
| `2987` | 01/09 00:01–00:22 | 1 | 0 | 2 | 1 | `pro` + `time` (duração/ocupação) | relógios de maquiagem; depois handoff |
| `4905` | 01/09 08:25–08:30 | 1 | 2 | 2 | 1 | `service` + `faq` (valor) | catálogo Coloração/Retoque; **drop** no gloss |
| `4501` | 04/09 11:05 (**antes** do off) | 0 | 2 | 2 | 0 | `service` (pezinho) | `UNCERTAIN` MIN → `tess.timeout` |
| `4749` | 01/09 22:27–02/09 18:19 | 1 | 0 | 1 | 0 | `noise` landing + `time` + `pro` + `service` (masculino) | Corte **Feminino** depois do “Masculino”; leak TA |
| `0330` | 01/09 00:39–00:40 | 2 | 2 | 2 | 1 | `pro` (role maquiador) | lista Fefe/Eli/Kamila no snapshot (**win**) |
| `3684` | 04/09 11:49 (**depois** do off) | — | — | — | — | `service` (pé e mão) + `pro` (Fefe) | silêncio = kill switch, **não** fail Tess |
| `1000` | 03/09 17:53–18:05 | 0 | 2 | 2 | 0 | `service` (pezinho) + `pro` (André) | **pedicure** → **Cabelo e Barba** → handoff |
| `2874` | 02/09 08:28 (preço) / 03/09 23:52 | 2 / 1 | 2 / 0 | 2 / 1 | 2 / 0 | `service` (progressiva masculina) | preço certo no 1º tiro (**win** de chão) |

`0330` é **dono** (Tiago). Win de linguagem mesmo assim: o Ask-class `pro` role foi o que Mary seedou. Win de cliente de chão = `2874` de manhã.

---

### Fios (leitura)

#### 1. `2987` — maquiadora / 2h / slot ocupado

**Cliente:** “maquiadora não é só a Fefe?” → sábado 05/09 Fefe → “não são 2h de atendimento?” → “se ela tiver cliente às 3h00” → “opção que já tem cliente”.  
Ask-class: `pro` (`kind=role` maquiadora + `named_person` Fefe, este no `PROFESSIONAL_RE`) + `time` (`kind=duration` 2h, `sense_gap` no `DATE_RE` `\d{1,2}h`; `kind=clock` 15:00 ocupação). Sem SKU na fala.

**Tess:** listou Fefe / Eli / Kamila (role **ok**). Tratou 2h como **duração** na bolha (“leva 2 horas… 14:00 às 16:00”). Ofereceu **14:00 e 14:30**. Cliente insiste 15:00 ocupado; Tess nega, depois admite confusão e handoff `conflito_agenda_disponibilidade` (03:07Z). Follow-up “quem são as maquiadoras?” ficou só `passive` (pós-handoff).

**Mismatch:** I3/ocupação, não o vocábulo `maquiadora`. Relógios ditos não cabem 120 min se 15:00 está tomado.  
**next_action:** Onda 2 — `TimeAsk.sense_gap` + footer HORARIOS de janela contínua ≥ duração. Sem patch agora.

#### 2. `4905` — tintura / gloss

**Cliente:** “valor para tintura” → “Cabelo” → “retoque de raiz com tonalizante” → “trabalham com gloss?” → “Fazem camuflagem?” → “Agenda pra mim coloração de raiz”.  
Ask-class: `service` (`tintura` keyword_gap, `gloss` keyword_gap, `camuflagem` **já** no FILTER `camuflag`, `coloração`/`retoque`/`tonaliz` cobertos) + `faq` preço.

**Tess:** desambiguou sobrancelha vs cabelo (**bom**). Listou Coloração Global / Retoque de Raiz / Tonalização. “Retoque de raiz **com** tonalizante” virou **dois** SKUs em sequência. Depois **zero** turno processado: gloss / camuflagem / agenda só `passive`. Último `tags.parsed` 11:26:46Z.

**Mismatch:** `tintura` não está no FILTER (`color`/`tonaliz` não cobrem — Orion). Tess **compensou** no 1º turno. O drop no `gloss` é o furo de linguagem + silêncio. Não remapear `tintura` → `color`.  
**next_action:** Onda 2 — stem `tintura` e `gloss` em `FILTER_SERVICE_KEYWORDS` (`booking-parser.js` ~523). Investigar por que inbound após 11:26Z não virou turno (fora desta amostra).

#### 3. `4501` — pezinho timeout

**Cliente:** “Posso passar aí pra arrumar o pezinho do cabelo?” 04/09 **11:05 BRT** (28 min **antes** do off).  
Ask-class: `service` (`pezinho`, keyword_gap, `handoff_likely` Mary).

**Tess:** intent gravado `UNCERTAIN`, profile **MIN**, `servicos=0` `horarios=0` no `tess.context_bytes`. `tess.timeout` 25000 ms. Fallback: “Não consegui processar… Não alterei seu agendamento.”

**Mismatch:** coloquial de corte/acabamento caiu em UNCERTAIN vazio e estourou o 25s. Único `tess.timeout` da janela Orion.  
**next_action:** Onda 2 — stem `pezinho` no filtro **sem** mapear para pedicure (ver `1000`). Timeout é sintoma do vazio de catálogo, não da fila de crédito.

#### 4. `4749` — masculino / sexta final do dia

**Cliente:** landing “vim pelo Studio Tirra. Quero agendar” (`noise` + ChannelPattern) → “horário na sexta final do dia” (`time` daypart) → “Corte com o Tiago” (`pro`) → “Masculino” (`service` gender, keyword_gap, `implicit_sku`) → “É masculino” de novo quando Tess ofereceu feminino → “Tem horário a tarde” → mais tarde “Me passaram as 14h”.

**Tess:** pediu serviço de novo depois do daypart (roteiro 1). Perguntou F/M (**bom**). Cliente disse Masculino. Em 05/09 10h30 ofereceu **Corte Feminino R$ 250**. Só corrigiu no “É masculino” — e vazou `TA - Corte Masculino`. Relógio 17h com scratch `[Validação rápida: … (TA) = 60min]`. CREATE 14h → `guard.blocked` janela 30 min < duração 60.

**Mismatch:** `masculino` não persiste no estado; Tess volta ao SKU feminino. Landing UNCERTAIN/SCHEDULING sem SKU (Orion).  
**next_action:** Onda 2 — `gender_qualifier` no turno (Mary `ServiceAsk`); não resetar F/M. Fidelidade: banir `TA -` e bloco `[Validação rápida]` no WhatsApp.

#### 5. `0330` — quem é maquiador (**win**, dono)

**Cliente:** “Quem é maquiador aí?” Ask-class `pro` `kind=role` (keyword_gap: `maquiador` ≠ `maquiagem`). Dono (Tiago).

**Tess:** Fefe (Fernanda de Sousa), Eli (Eliane Santana), Kamila — “Todos fazem Maquiagem”. Follow-up: bateu HABILITACAO snapshot, três ✓. **Leu o cargo**, não exigiu SKU na boca.

**Fidelidade 1:** vazou `ID 14129543` e o rótulo `Consultando HABILITACAO` no WhatsApp.  
**next_action:** Onda 2 — stem `maquiador` no matcher de `pro`/role. Não colar ID Trinks. Não tratar este fio como cliente de chão.

#### 6. `3684` — inbound-only (kill switch)

**Cliente:** 04/09 **11:49 BRT** “marcar um horário para pé e mão” → “Com a Fefe”. Ask-class `service` (`pé`/`mão` ≠ `manicure`/`pedicure` no FILTER) + `pro` Fefe. Zero `assistant`, zero evento.

**Tess:** silêncio. Corte 11:33 BRT — **não pontuar**. Útil para o catálogo: `pé e mão` é o jeito do chão; SKU unmatched.

Os outros 6 inbound-only da semana (`6153` `7016` `7153` `5953` `4657` `6361`) estão no HOLD/human_only do resume 03/09 — Tess **não** deveria falar. `5953` tem fala rica (“tratamento para reduzir frizz… sem alisar”) = corpus de recepção, não fail de IA.

#### 7. `1000` — pezinho remapeado (pior mismatch)

**Cliente:** áudio “sempre corto com o André… nesse intervalo faço o pezinho” → “Pezinho do cabelo” → áudio “não é cabelo, é só o pezinho… contorno da orelha… pescoço… amanhã à tarde ou sábado de manhã”.

**Tess:** 1) “agendar o pezinho com o André, certo?” (eco) → 2) “André não tem **pedicure**” → 3) “Você quer fazer o **Cabelo e Barba**” → 4) handoff `orcamento_referencia` (“contorno… não tem esse serviço específico”).

**Mismatch:** `pezinho` de cabelo ≠ pedicure ≠ combo corte+barba. Cliente repetiu três vezes.  
**next_action:** Onda 2 — `pezinho` como acabamento de corte / SKU a cruzar no snapshot (**pending_mira**, não chute). Proibido alias para `pedicure`.

#### 8. `2874` — progressiva masculina (**win** de chão) + I3 depois

**Cliente (02/09 08:29 BRT):** “Qual valor da progressiva masculina?” → Tiago → combo. Ask-class `service` (`progressiva` **hit** FILTER) + gender.  
**Tess:** R$ 105 Erick, R$ 120 Tiago, soma 225 com corte. **1º tiro certo.**

**Depois (03/09 23:52 BRT):** corte masculino Tiago 10h30 05/09 → `guard.blocked` 30<60 (mesmo molde `4749`). “Exatamente isso” caiu `UNCERTAIN:FULL` ~93k chars — crédito, **fora** desta onda. Bolha seguinte saiu truncada (“no Studio Tirra… Endereço”).

Usar o turno da manhã como padrão a **não** desfazer. I3 10h30 é o mesmo ofensor de janela, não léxico.

---

### wins[]

1. **Role `maquiador` lido** — `0330` listou três nomes do snapshot sem exigir a palavra `maquiagem`. `2987` fez o mesmo no 1º turno.
2. **`progressiva masculina` no preço** — `2874` 1º tiro, FILTER já vê `progressiva`.
3. **`tintura` desambiguada** — `4905` perguntou sobrancelha vs cabelo e ofereceu Coloração/Retoque/Tonalização **sem** o stem no FILTER.
4. **Timeout honesto** — `4501` não fingiu agendamento.
5. **2-phase I3 visível** — `4749`/`2874` `guard.blocked` janela 30<60 em vez de “já marquei”.

### fails[] (linguagem)

| last4 | fail | next_action |
|---|---|---|
| `1000` | pezinho → pedicure → cabelo/barba | stem `pezinho` ≠ pedicure; cruzar snapshot |
| `4501` | pezinho → UNCERTAIN MIN vazio → timeout 25s | mesmo stem; timeout é sintoma |
| `4749` | “Masculino” → Tess confirma **Feminino**; leak `TA -` + scratch | persistir `gender_qualifier`; sanitizar TA/scratch |
| `2987` | 14:00/14:30 oferecidos com 2h se 15:00 ocupado | I3 contínuo; `sense_gap` em `\d{1,2}h` |
| `4905` | `gloss` (e agenda) sem turno depois do 1º bloco | stems `tintura`/`gloss`; não remapear p/ `color` |

### rule_suggestions[] (arquivo + trecho, Onda 2 — **não** aplicar agora)

1. `backend/lib/booking-parser.js` `FILTER_SERVICE_KEYWORDS` (~523–528): **somar** stems do cliente `tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`. **Não** alias `tintura`→`color`. **Não** alias `pezinho`→`pedicure`.
2. `backend/lib/tess-context-intent.js` `DATE_RE` (~27): `\d{1,2}h` casa relógio **e** duração. `TimeAsk.sense_gap` — “2h de atendimento” (`2987`) não é 02:00.
3. `backend/lib/tess-context-intent.js` `PROFESSIONAL_RE` (~28): cargos (`maquiador`/`maquiadora`) não estão no regex; só nomes. `0330`/`2987` sobreviveram pelo prompt+snapshot, não pelo matcher.
4. Estado de gênero: depois de `Masculino` (`4749`) o SKU default feminino não pode voltar. Campo Mary `ServiceAsk.gender_qualifier`.
5. Fidelidade WhatsApp: proibir `TA -`, `[Validação rápida…]`, `ID 14129543`, `Consultando HABILITACAO` — trecho de sanitização de saída (não cola 46589 aqui).

---

## Devolução Orion

**8 last4:** `2987` `4905` `4501` `4749` `0330` `3684` `1000` `2874`

**Top 3 language fails**

1. **`1000`** — pezinho (cabelo/contorno) lido como pedicure, depois como Cabelo e Barba. Cliente teve que negar duas vezes. Handoff `orcamento_referencia`.
2. **`4501`** — mesmo vocábulo, caminho pior: `UNCERTAIN` MIN sem bloco de serviços → único timeout da semana. 11:05 BRT, **antes** do off.
3. **`4749`** — “é masculino” ignorado; Tess confirma Corte Feminino; ainda vaza `TA -` e scratch. Landing + daypart no mesmo fio.

**1 win**

- **`0330`** (dono): “Quem é maquiador aí?” → três nomes do snapshot. Ask-class `pro` role acertado.  
- Win de chão (mesmo relatório): **`2874`** “valor da progressiva masculina” no 1º tiro.

`3684` entra como inbound-only de linguagem (`pé e mão` + Fefe), silêncio = kill switch 11:33 BRT.

Hipótese Victor (impressão vs chão): **ainda aberta**. Esta amostra **confirma** furo de léxico em `pezinho` / `gloss` / `masculino` / ocupação 2h. **Não** confirma sozinha que o FILTER inteiro foi montado só em impressão — `progressiva` e a desambiguação de `tintura` já acertam no dado.

— Mira, Floor Quality. Sem patch. Sem cola. Sem POST.
