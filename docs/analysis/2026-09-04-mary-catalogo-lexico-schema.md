# Catálogo léxico — schema Wave 1 (mapa da fala do cliente)

**Autor:** Mary (@analyst)  
**Motor:** Grok 4.6 High  
**Data:** 2026-09-04  
**Versão do schema:** `1.0.0` (congelado para Onda 1)  
**Consome:** [Orion ondas léxico](2026-09-04-orion-ondas-lexico-triagem.md), [Pedro blueprint §2](2026-09-03-pedro-valerio-blueprint-tess.md), `FILTER_SERVICE_KEYWORDS` (`backend/lib/booking-parser.js` ~523–528), nomes de intent (`backend/lib/tess-context-intent.js`)  
**Não é:** story, PRD, patch de keyword, cola de prompt, tabela de SKU Trinks.

Dex/CLI e Mira **preenchem linhas**. Mary **não inventa SKU**. Volume só o que Orion publicou.

---

## 0. Taxonomia única (sem A/B)

**Ask-class de seis valores**, no campo `Term.class`:

`service | pro | time | faq | pay | noise`

Landing **não** é classe de Termo. Landing é a entidade `ChannelPattern` (funil falado “vim pelo Studio Tirra”). Pedro eixo 5: etapa/funil **não existe como campo**; este schema mapeia **fala observada**, não inventa CRM.

| Recusado | Por quê |
|---|---|
| Taxonomia por SKU Trinks | Onda 1 ainda não cruzou fala × snapshot. Preencher SKU agora seria chute. |
| Taxonomia por etapa de funil (lead → agendado) | Pedro eixo 5: eixo inexistente; campo escrito por LLM seria checkpoint sem dentes. |
| Sétima classe `landing` no Term | Duplicaria `ChannelPattern`. Craft/Aria (`catalog-client-terms`) usavam landing como intenção — **este schema vence**. |

`pay` fica separado de `faq`: Orion isolou PIX na cauda **e** na prioridade de recepção do dia 04/09; endereço/funcionamento são FAQ operacional. O matcher de cada um já é o mesmo `FAQ_RE` no código — a classe no catálogo ainda distingue o pedido.

*[AUTO-DECISION] Ask-class de 6 + ChannelPattern à parte → uma taxonomia (reason: mandato da missão; Pedro eixo 2 existe e eixo 5 não; Craft “landing” colide com a entidade pedida).*

---

## 1. Janela, corpus e números (cópia Orion — não recalcular aqui)

**Janela:** seg 01/09/2026 00:00 BRT → 04/09/2026 ~11:50 BRT (até o off).  
**Fonte com dentes hoje:** `conversation_history` (inbound passivo + turnos da Tess).  
**Fonte que falta:** outbound da recepção no WhatsApp — ver §8 (checklist, sem tabela fake).

Dedup Orion: **last4 + texto**. Dex valida; se o dump divergir, documenta o delta — **não substitui** estes totais em silêncio.

| Métrica (Orion) | Valor |
|---|---:|
| Fios (last4 distintos) | **97** |
| Com resposta da Tess | **90** |
| Inbound só (sem IA) | **7** |
| Falas únicas do cliente | **629** |
| Hit `FILTER_SERVICE_KEYWORDS` | **125** (20%) |
| Falas longas **sem** keyword de SKU | **383** |
| `handoff.human` | **24** |
| `guard.blocked` | **23** |
| `booking.created` | **13** |
| `tess.timeout` | **1** |
| `tess.context_trimmed` | **1** |

Intent gravado nos turnos `user` processados pelo bot (**511** linhas brutas, com duplicata passive):

| Intent | N |
|---|---:|
| SCHEDULING | 85 |
| UNCERTAIN | 33 |
| PRICING | 3 |
| FAQ | 3 |
| CANCEL | 2 |
| TRIVIAL | 2 |
| **null** | **383** |

Nomes canônicos de intent (código, 0 LLM): `TRIVIAL` · `FAQ` · `PRICING` · `SCHEDULING` · `CANCEL` · `RESCHEDULE` · `HANDOFF_LIKELY` · `UNCERTAIN`. O catálogo **não** cria nono intent. `Term.class` e `recorded_intent` são eixos diferentes (Pedro eixo 2 = turno; Ask-class = léxico da fala).

Lista live de filtro de catálogo (espelho; Onda 1 **não** altera o arquivo):

`cort, barba, mecha, escova, color, camuflag, progressiva, hidrat, manicure, pedicure, sobrancelha, cilio, cílio, depil, limpeza, maquiagem, make, penteado, laser, botox, cauteriz, tonaliz, retoque, avaliacao, avaliação, global, combo, cabelo`

---

## 2. Entidades e campos

Relação: uma `Utterance` recebe zero ou mais `Term`; pode instanciar `ServiceAsk` / `ProfessionalAsk` / `TimeAsk` (composto permitido); pode ter `Friction`; pode casar `ChannelPattern`. `unclassified` é tag explícita, não ausência.

**PII:** telefone = `last4` only. Artefato com E.164 = veto. Não gravar nome civil, e-mail, handle. Texto: se o dump trouxer dígitos de telefone, Dex mascara **antes** de escrever.

### 2.1 Utterance

Fala única do cliente (unidade de cobertura).

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `utterance_id` | slug | sim | `{last4}-{hash8(norm_text)}` — sem E.164 |
| `last4` | char(4) | sim | |
| `role` | `client` | sim | Onda 1 só conta fala de cliente na cobertura |
| `agent` | `tess` \| `human` \| `passive` \| `null` | não | do dump; `human` aqui é rótulo de turno, **não** prova outbound de recepção |
| `recorded_intent` | intent canônico \| `null` | não | valor persistido/lido no dump; Orion: maioria **null** |
| `norm_text` | string | sim | NFD + lower; citação literal na evidência |
| `norm_len` | int | sim | length de `norm_text` |
| `is_long` | bool | sim | regra §6 |
| `keyword_hit` | bool | sim | substring em `FILTER_SERVICE_KEYWORDS` após `normalizeCatalogText` |
| `window` | `2026-09-01/04` | sim | |
| `source` | `conversation_history` \| `kapso_export` \| `manual_export` | sim | default `conversation_history` |
| `term_ids` | Term[] | não | vazio só se `unclassified=true` **ou** ainda não triado |
| `channel_pattern_id` | ChannelPattern \| null | não | |
| `unclassified` | bool | sim | default false |
| `unclassified_reason` | string \| null | se unclassified | uma linha |
| `sample_last4` | char(4) | se unclassified | = `last4` desta row (gate Quinn) |

### 2.2 Term

Token ou locução do cliente. **Não** é SKU.

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `term_id` | slug | sim | `t-{norm}` kebab |
| `surface` | string | sim | grafia do cliente |
| `norm` | string | sim | NFD + lower, sem diacrítico |
| `class` | `service` \| `pro` \| `time` \| `faq` \| `pay` \| `noise` | sim | só estes seis |
| `keyword_gap` | bool | sim | regra §3.1 |
| `suggested_keyword` | string \| `null` | sim | stem **a acrescentar** na Onda 2, ou null. Nunca um SKU Trinks. Nunca um stem que **já falhou** (não sugerir `color` para `tintura`) |
| `handoff_likely` | bool | sim | true só com fricção **atribuída** na evidência Orion desta janela; totais de janela (24 handoff) **não** se rateiam por termo |
| `orion_n` | int \| `null` | sim | copiar Orion; `null` se ele não contou |
| `orion_note` | string \| null | não | ranking / cauda |
| `evidence_last4` | char(4)[] | sim | mínimo 1 para seed; termo novo sem last4 = veto Craft |
| `evidence_quote` | string | não | trecho curto |

### 2.3 ServiceAsk

Instância: esta fala pede serviço (talvez sem nome de SKU).

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `utterance_id` | slug | sim | |
| `term_id` | slug | sim | |
| `sku_id` | string \| `null` | sim | Wave 1 seed = **sempre null** |
| `sku_status` | `unmatched` \| `pending_mira` \| `matched` | sim | seed = `unmatched` ou `pending_mira`. `matched` só depois do cruzamento snapshot (DoD Orion item 3) |
| `gender_qualifier` | `masculino` \| `feminino` \| `null` | não | “é masculino” (last4 `4749`) |
| `implicit_sku` | bool | não | true se o serviço está só no gênero/profissional, sem nome |

Não copiar `data/kb/conversa-v2/sinonimos-servicos.md` para preencher `sku_id`. KB é impressão nossa; a hipótese de Victor é exatamente essa.

### 2.4 ProfessionalAsk

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `utterance_id` | slug | sim | |
| `term_id` | slug | sim | |
| `kind` | `named_person` \| `role` | sim | Fefe vs maquiadora |
| `in_professional_re` | bool | sim | `PROFESSIONAL_RE` (tiago, andre, erick, fefe, …) |
| `before_sku` | bool \| `unknown` | não | Orion: muitas vezes **antes** do SKU; default `unknown` até Mira ler o fio |

### 2.5 TimeAsk

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `utterance_id` | slug | sim | |
| `term_id` | slug | sim | |
| `kind` | `day` \| `daypart` \| `relative` \| `duration` \| `clock` | sim | |
| `date_re_hit` | bool | sim | `DATE_RE` do classificador |
| `sense_gap` | bool | sim | true se o regex acerta o token mas o sentido é outro (ex.: `2h` = duração, não relógio) |

### 2.6 Friction

Dificuldade na janela. Totais de evento são da **janela**, não inventar N por termo.

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `friction_id` | slug | sim | |
| `kind` | `timeout` \| `guard.blocked` \| `handoff.human` \| `duration_query` \| `occupancy` \| `two_phase` | sim | DoD Orion item 4 |
| `window_n` | int \| `null` | sim | copiar Orion quando existir; `null` se só há amostra |
| `last4_sample` | char(4)[] | sim | |
| `linked_term_ids` | Term[] | não | só se Orion ligou o termo à fricção |
| `quote` | string \| null | não | |

### 2.7 ChannelPattern

Funil **falado** (landing). Não cria coluna de etapa no banco.

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `pattern_id` | slug | sim | |
| `surface` | string | sim | locução âncora |
| `steps_observed` | string[] | sim | sequência de **fala**, não stages CRM |
| `funnel_field_exists` | `false` | sim | constante. Pedro eixo 5 |
| `intent_today` | string | sim | Orion: UNCERTAIN/SCHEDULING sem SKU |
| `scheduling_ask_hit` | bool | sim | `hasSchedulingAsk` já casa `vim pelo` |
| `orion_n` | int \| `null` | sim | Orion disse **dezenas de fios** — não virar inteiro |
| `orion_volume_label` | string | se n null | `"dezenas de fios"` |
| `evidence_last4` | char(4)[] | não | preencher quando o dump atribuir |

---

## 3. Regras para Dex / Mira (preencher, não redesenhar)

### 3.1 `keyword_gap` (matcher da classe)

Não é “faltou no FILTER” para todo mundo.

| `Term.class` | `keyword_gap = true` quando |
|---|---|
| `service` | `norm` **não** é substring de nenhum item de `FILTER_SERVICE_KEYWORDS` |
| `pro` | `kind=named_person` e **não** casa `PROFESSIONAL_RE`; **ou** `kind=role` e o cargo **não** é substring de FILTER (`maquiadora` ≠ `maquiagem`) |
| `time` | **não** casa `DATE_RE`. Se casa mas o sentido é duração/ocupação → `keyword_gap=false` e `TimeAsk.sense_gap=true` |
| `faq` / `pay` | **não** casa `FAQ_RE` (`endereco`, `pix`, `horario de funcionamento`, …) |
| `noise` | sempre `false` (não entra no filtro de SKU) |

`suggested_keyword`: se gap → o stem do cliente (`tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`). Se já coberto → `null`. **Proibido** remapear para um stem que Orion mostrou que fura (`tintura` ↛ `color`).

### 3.2 `handoff_likely`

- `true` só se a evidência Orion desta janela liga o termo a timeout / handoff / ocupação / duração consultiva.  
- `pezinho` → timeout last4 `4501`.  
- `2h atendimento` + ocupação `já tem cliente` → last4 `2987`.  
- `false` para PIX/endereço/masculino/landing (FAQ ou encaixe; o bot **deveria** responder).  
- **Não** distribuir os 24 `handoff.human` pelos termos.

### 3.3 Compostos

Uma utterance pode ter ServiceAsk + ProfessionalAsk + TimeAsk. Cobertura conta **a utterance**, não o ask. “maquiadora não é só a Fefe?” + “2h” = `pro` + `time` + Friction, sem inventar SKU Maquiagem.

### 3.4 O que Dex **não** faz nesta onda

Não altera `booking-parser.js` / `tess-context-intent.js`. Não cola prompt. Não POST Trinks. Não inventa `orion_n`.

---

## 4. Tabela de mapeamento (contrato)

`Term → { class, keyword_gap, suggested_keyword, handoff_likely }`

Colunas extras (`orion_n`, last4) são evidência, não taxonomia.

---

## 5. Seed rows — só evidência Orion

### 5.1 Seeds mandatórios (missão)

| Term (surface) | class | keyword_gap | suggested_keyword | handoff_likely | orion_n | last4 | Por que (Orion, sem SKU) |
|---|---|---|---|---|---:|---|---|
| tintura | service | true | `tintura` | false | null | 4905 | “valor para tintura”; `color`/`tonaliz` não cobrem |
| gloss | service | true | `gloss` | false | null | 4905 | “trabalham com gloss?”; ausente da lista |
| pezinho | service | true | `pezinho` | true | null | 4501 | “arrumar pezinho do cabelo”; coloquial; **tess.timeout = 1** |
| maquiadora | pro | true | `maquiador` | true | null | 2987, 0330 | cargo ≠ `maquiagem`; “não é só a Fefe?” / “Quem é maquiador aí?” |
| pix | pay | false | null | false | null | 0007 | “aceita pix?”; já no `FAQ_RE`; prioridade recepção 04/09 ≠ gap de keyword |
| endereco | faq | false | null | false | null | 0007 | “endereço”; já no `FAQ_RE` |
| masculino | service | true | `masculino` | false | null | 4749 | “é masculino”; gênero, SKU implícito; não está no FILTER |
| vim pelo Studio Tirra | noise | false | null | false | null | — | Term **e** `ChannelPattern` §5.4; `hasSchedulingAsk` já vê `vim pelo` |
| 2h atendimento | time | false | null | true | null | 2987 | `DATE_RE` casa `\d{1,2}h` como relógio; sentido = **duração** (`sense_gap`) |

`orion_n = null` nestes nove: Orion **não** publicou contagem por esses termos (estão na cauda ou em amostra). Não interpolar.

### 5.2 Ranking com N (copiar Orion; Dex não “completa”)

Ordem “o que mais pedem” — fala, não SKU:

| Term / padrão | class | keyword_gap | suggested_keyword | handoff_likely | orion_n | Nota Orion |
|---|---|---|---|---|---:|---|
| agendar / horário / hoje / amanhã / sábado / sexta | time | false | null | false | null | Núcleo = **encaixe**, não nome de serviço. Sem N desagregado |
| cort (`corte`) | service | false | null | false | **75** | hits de `cort`; + masculino + André/Erick/Tiago |
| profissional pelo nome | pro | false | null | false | **71** | Fefe, Erick, André, Tiago — **71 falas no total**, não por nome |
| cabelo (genérico) | service | false | null | false | **29** | ambíguo corte vs química |
| cancelar | faq | false | null | false | **13** | `CANCEL_RE`; Ask-class não ganha valor `cancel` |
| remarcar | time | false | null | false | **4** | troca de slot; `RESCHEDULE` é eixo 2 |
| preço / valor | faq | false | null | false | **13** | pouco vs volume de agenda; intent PRICING=3 nos turnos gravados |
| penteado | service | false | null | false | **6** | ofensor coloquial **fraco** nesta semana |
| tesoura | service | false | null | false | **2** | coloquial penteado |
| dia a dia | noise | false | null | false | **1** | |

Ask-class não inclui `cancel` nem `price`: eixo 2 (`CANCEL` / `PRICING` / `RESCHEDULE`) continua no campo `recorded_intent` da Utterance.

Cauda Orion **sem N** (escova, barba, manicure, mecha, maquiagem, raiz, laser): Dex pode abrir row `orion_n=null` quando o dump mostrar last4. **Não** seedar SKU. Não seedar `mão tradicional` (Onda 2 citou; **não** está no ranking desta semana).

### 5.3 Friction seeds (totais de janela)

| friction_id | kind | window_n | last4_sample | linked terms |
|---|---|---:|---|---|
| fr-timeout | timeout | **1** | 4501 | pezinho |
| fr-guard | guard.blocked | **23** | — | — (Orion não atribuiu termo) |
| fr-handoff | handoff.human | **24** | — | — |
| fr-duration | duration_query | null | 2987 | 2h atendimento |
| fr-occupancy | occupancy | null | 2987 | “opção que já tem cliente” |
| fr-created | *(não é fricção; controlo)* | **13** `booking.created` | — | fora da entidade Friction; métrica de fechamento |

`tess.context_trimmed = 1` (item 7 live) — não vira Term.

### 5.4 ChannelPattern seed

| pattern_id | surface | steps_observed | funnel_field_exists | intent_today | scheduling_ask_hit | orion_n | orion_volume_label |
|---|---|---|---|---|---|---|---|
| cp-studio-tirra-landing | vim pelo Studio Tirra | `landing_hello` → `quero agendar` → (`masculino` \| `qual valor` \| dia) | **false** | UNCERTAIN/SCHEDULING sem SKU | true (`vim pelo`) | null | **dezenas de fios** |

Isto **não** é conversa livre de recepção; é **landing**. Tess trata como UNCERTAIN/SCHEDULING sem SKU (Orion). Hipótese a **contar** no dump (quantos last4 distintos), não a promover a campo de funil.

### 5.5 ServiceAsk / ProfessionalAsk / TimeAsk (instâncias seed)

SKU sempre `unmatched` / `sku_id=null`.

| last4 | asks | Campos |
|---|---|---|
| 4905 | ServiceAsk ×2 | tintura, gloss — `sku_status=unmatched` |
| 4501 | ServiceAsk | pezinho — `gender_qualifier=null` |
| 2987 | ProfessionalAsk + TimeAsk | `kind=role` maquiadora; `kind=named_person` Fefe (`in_professional_re=true`); TimeAsk `kind=duration` sense_gap; Friction occupancy |
| 0330 | ProfessionalAsk | `kind=role` maquiador |
| 0007 | — | Termos pay/faq only; sem ServiceAsk |
| 4749 | TimeAsk + ServiceAsk | `kind=daypart` “sexta final do dia”; `gender_qualifier=masculino`; `implicit_sku=true` |
| (landing) | ChannelPattern | sem SKU; Term noise + pattern `cp-studio-tirra-landing` |

Nomes **André / Erick / Tiago / Fefe**: entram como Term `class=pro`, `keyword_gap=false` (estão no `PROFESSIONAL_RE`), `orion_n=null` cada um (os **71** são o saco, não a parte). Dex não reparte 71.

---

## 6. Coverage — Wave 1 catálogo DONE

### 6.1 O que é fala longa

*[AUTO-DECISION] `is_long = (norm_len >= 40) OR casa ChannelPattern.surface` (reason: `classifyTessIntent` trata `textLen > 40` como ambíguo fora de bundle; landing pode ser curta e ainda assim é o funil falado).*

O conjunto Orion **383** = falas longas **sem** hit de keyword. Dex calcula `is_long` no dump e reporta:

- `unique_client` — deve reconferir **629**
- `keyword_hit` — reconferir **125** (20%)
- `long_no_keyword` — reconferir **383**
- `unique_long` — **não publicado por Orion**; Dex publica este denominador. Se `long_no_keyword` ≠ 383, o delta vai no footer — o 383 **não se apaga**.

### 6.2 Fórmula

```
tagged_long = unique_long com (≥1 Term OU ChannelPattern OU unclassified=true com last4)
coverage   = tagged_long / unique_long
```

**DONE** quando `coverage ≥ 0.80`.

`unclassified` **conta** como tag: o gate é auditabilidade (nada some), não “entendemos 80%”. O restante 20% pode estar ainda sem row; acima de 20% sem tag = catálogo incompleto.

Amostra `unclassified`: last4 + `norm_text` curto + `unclassified_reason`. Sem last4 = veto.

### 6.3 Fatia dura

Antes do 80% global: **≥80% das 383** (ou do `long_no_keyword` validado) têm Term/ChannelPattern/`unclassified`. Senão o catálogo só etiquetou os 125 hits que o FILTER já via.

### 6.4 Relação com o gate Quinn

`corpus-quality-gate.md` hoje pede ≥50 fios e hit-rate documentado. A regra **80% unique long tagged** é o DoD do **schema** (este arquivo). Quinn incorpora no gate; Mary não edita o checklist do squad nesta entrega.

---

## 7. O que a Onda 2 pode mudar vs o que fica hipótese

### 7.1 Hipótese (não promover)

Victor: a Tess ainda erra porque a regra de linguagem (SKU, keyword, prompt) foi montada nas **nossas impressões**, não no jeito desta semana (IA **e** recepção).

Status: **hipótese a falsificar**. Onda 1 entrega o mapa. Confirmação/refutação = N no catálogo preenchido (intent null **383**/511 já **confirma** triagem fraca **no dado**; não confirma sozinha a causa “impressão vs chão”).

Não muda neste schema: seis classes; ChannelPattern ≠ campo de funil; last4; SKU não inventado; 80%; buraco de recepção como checklist.

### 7.2 Onda 2 **pode** mudar (depois do catálogo + ACK Victor)

| Corte | Pode mudar | Não é Onda 1 |
|---|---|---|
| Keywords / intent | Acrescentar stems desta tabela (`tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`) em `filterServicesByKeywords` / `SERVICE_KEYWORDS` | Patch agora |
| `DATE_RE` vs duração | Tratar `2h atendimento` como duration, não clock (`sense_gap`) | |
| SCHEDULING sem SKU ≠ dump UNCERTAIN | Qual **bloco** entra (só prof? só 1 dia?) — já é MIN | Reabrir P-BUDGET / caps |
| Contexto só-encaixe | O que **não** entra no payload | Aumentar FULL |
| Métrica turnos até `booking.created` / handoff / silêncio | Dara | Prometer 13,5 cr |
| Prompt (fase B) | Linguagem da Tess | Cola 46589; gate Victor |
| `Term.class` pontual | Mira pode reclassificar row após ler fio | Trocar a taxonomia de 6 |
| `handoff_likely` | Calibrar com N por termo quando o dump cruzar eventos | Ratear os 24 |
| `sku_id` | Mira × snapshot | Chute da KB de sinónimos |
| `mão tradicional` | Só se o dump mostrar last4 | Seed fantasma |

Fora da Onda 2 (Orion): split 46589, funil CRM, desligar Thinking, replay André 10:30, flip `BOT_ACCEPT_ALL`, religar bot sem ACK.

### 7.3 Eixos Pedro — o catálogo não conserta

| Eixo | Neste schema |
|---|---|
| 2 Intent | Lemos `recorded_intent`; não persistimos (já é gap G-P3 / trabalho @architect) |
| 5 Funil | `ChannelPattern` descreve fala. `funnel_field_exists=false` |

---

## 8. Gap — outbound da recepção (checklist, não tabela)

**Fato (Orion):** `bot_thread_state.last_staff_outbound_at` nesta janela = **0**. Kapso `history_sync` é **ignorado** no webhook. O mapa da recepção hoje é só o que o cliente escreveu **enquanto** o bot via o inbound. Os 7 fios inbound-only não são transcrição da recepção.

**Não fazer:** tabela `reception_utterance` preenchida com placeholder, “inferir” o que a recepção disse, ou tratar `agent=human` em `conversation_history` como corpus de chão da recepção sem fonte Kapso/export.

### Checklist para fechar o buraco (item, owner, critério)

- [ ] **C1 — Confirmar zero no banco.** Dex, no dump: contar `last_staff_outbound_at` IS NOT NULL na janela. Esperado Orion: **0**. Se ≠ 0, publicar o N e last4 — ainda não é o texto da recepção.
- [ ] **C2 — Decidir a fonte.** Victor: **Kapso** (export / API de histórico do WhatsApp Cloud, não o webhook que ignora `history_sync`) **ou** export manual do WhatsApp Business. Uma fonte, datada.
- [ ] **C3 — Redaction.** Quem exportar: last4 only no artefato; E.164 só na query interna. Mesmo veto do corpus Tess.
- [ ] **C4 — Artefato separado.** Path tipo `docs/analysis/floor-corpus-reception-{YYYYMMDD}.md`. `source=kapso_export` ou `manual_export`. **Não** misturar no denominador 629 até existir.
- [ ] **C5 — Recobrir ChannelPattern + handoff.** Mira: a landing e os 24 `handoff.human` com fala da recepção vs só inbound. Sem esse corpus, a hipótese “IA **e** recepção” permanece **aberta no lado recepção**.
- [ ] **C6 — Não atrasar o 80%.** Cobertura §6 usa `conversation_history` desta janela. O gap da recepção é **item do DoD Orion #5**, não desculpa para não etiquetar as 383.

Até C4 existir, qualquer ranking “como a recepção fala” = **fora de escopo / não medido**.

---

## 9. Auto-decisões

1. Taxonomia Ask-class 6 + `ChannelPattern` — uma, sem A/B.  
2. `keyword_gap` relativo ao matcher da classe, não sempre FILTER.  
3. `suggested_keyword` = stem do cliente a **somar**; proibido remapear para stem que já furou (`tintura` ↛ `color`). Vence o placeholder do template Craft.  
4. `is_long`: `norm_len >= 40` OU ChannelPattern.  
5. SKU seed = null / unmatched. KB sinónimos não é evidência desta semana.  
6. `orion_n` só onde Orion publicou número; “dezenas” fica label.  
7. `cancelar` → faq; `remarcar` → time; `preço` → faq (não criar classe cancel).  
8. `pay` ≠ `faq` no Term; matcher de código pode ser o mesmo `FAQ_RE`.  
9. Reception outbound = checklist §8, zero rows fake.

**Confiança:** números de volume **alta** (cópia). Classificação dos 9 seeds **alta** (amostra last4 Orion). `is_long` cutoff 40 **média** (Orion não publicou o critério das 383). `handoff_likely` em maquiadora/2h **média** (fricção de amostra, não N de handoff).

---

## 10. Handoff

**Orion:** schema em `docs/analysis/2026-09-04-mary-catalogo-lexico-schema.md` (`1.0.0`). Dex: CLI dump last4. Mira: amostra (IA + inbound-only). Aria/floor-lexicographer: preenche catálogo **neste** schema (não no 7º valor `landing` do task Craft). Quinn: gate + regra 80%. ACK Victor → Onda 2 Architect. Religar bot = decisão à parte.

**Preenche:** `squads/tess-floor-lexicon` — `extract-week-corpus` → `catalog-client-terms` (colunas = §2–§4) → `score-keyword-coverage` (não patch de parser).

---

— Mary (@analyst), mapa da fala, não do SKU.
