# Floor Lexicon Catalog v0.1.0

**Janela:** 2026-09-01 → 2026-09-04 ~11:50 BRT (até o off)  
**Gerado:** 2026-09-04  
**Corpus:** `docs/analysis/floor-corpus-20260904.md`  
**Schema SOT:** `docs/analysis/2026-09-04-mary-catalogo-lexico-schema.md` `1.0.0`  
**Evidência de volume:** `docs/analysis/2026-09-04-orion-ondas-lexico-triagem.md`  
**last4 extra (mesmo janela, ranking):** `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md` — só onde o seed Mary/Orion-ondas não citou last4  
**Autor:** Aria (@floor-lexicographer), analyst flavor  
**Natureza:** **seed-only**. Não é catálogo das 629 falas. Não é cruzamento SKU Trinks.

last4 only. Sem E.164. Sem paste de prompt. Sem volume inventado. Sem `Term.class=landing` (Craft task) — Mary vence: landing = `ChannelPattern`.

---

## 0. Taxonomia (Mary — seis valores)

`Term.class` ∈ `service | pro | time | faq | pay | noise`

| Recusado neste catálogo | Por quê |
|---|---|
| 7ª classe `landing` no Term | Duplicaria `ChannelPattern`. “vim pelo Studio Tirra” = funil **falado**. |
| `sku_id` preenchido da KB de sinónimos | Hipótese de Victor: a regra foi montada nas nossas impressões. KB ≠ evidência desta semana. |
| Ratear 24 `handoff.human` / 71 nomes / “dezenas” em inteiro | Orion não desagregou. |

`pay` ≠ `faq` no Term (PIX vs endereço/funcionamento). Matcher de código pode ser o mesmo `FAQ_RE`.

`recorded_intent` (eixo 2, utterance) ≠ Ask-class (léxico). O catálogo **não** cria nono intent.

---

## Stats

Fonte: Orion ondas + floor-corpus (Dex W2 stats). Corpus **reconferiu** os totais; não recalculou.

| Métrica | Valor | Fonte |
|---|---:|---|
| Fios (last4 distintos) | **97** | Orion / corpus |
| Com resposta da Tess | **90** | Orion / corpus |
| Inbound só (sem IA) | **7** | Orion / corpus |
| Falas únicas do cliente | **629** | Orion / corpus |
| Hit `FILTER_SERVICE_KEYWORDS` | **125** (**20%**) | Orion |
| Falas longas **sem** keyword de SKU | **383** | Orion — **fatia dura** |
| `unique_long` (denominador §6 Mary) | **não publicado** | Orion não publicou; dump Dex não listou falas |
| Intent null (user bot-processed, bruto) | **383 / 511** | Orion / corpus |
| `handoff.human` | **24** | Orion |
| `guard.blocked` | **23** | Orion |
| `booking.created` | **13** | Orion |
| `tess.timeout` | **1** | Orion |
| `tess.context_trimmed` | **1** | Orion |
| `staff_outbound_in_window` | **0** | corpus / Orion |

Intent gravado (511 linhas brutas, duplicata passive): SCHEDULING 85 · UNCERTAIN 33 · PRICING 3 · FAQ 3 · CANCEL 2 · TRIVIAL 2 · **null 383**.

Lista live FILTER (espelho; Onda 1 **não** altera o arquivo):

`cort, barba, mecha, escova, color, camuflag, progressiva, hidrat, manicure, pedicure, sobrancelha, cilio, cílio, depil, limpeza, maquiagem, make, penteado, laser, botox, cauteriz, tonaliz, retoque, avaliacao, avaliação, global, combo, cabelo`

---

## Ranking — o que mais pedem (fala, não SKU)

Ordem Orion. `orion_n` só onde ele publicou. SKU Trinks: **unmatched** / `null`. “Corte Masculino” = padrão **falado** (corte + masculino), **não** id Trinks.

| # | Termo / padrão | class | orion_n | SKU Trinks | sku_status | last4 evidência | Nota |
|---:|---|---|---:|---|---|---|---|
| 1 | agendar / horário / hoje / amanhã / sábado / sexta | time | null | — | — | 4749 (sexta final do dia); 0007 é FAQ funcionamento, **não** este núcleo | Núcleo = **encaixe**. Sem N desagregado. Cluster **não** virou um Term row único (sem last4 por lexema). |
| 2 | cort (`corte`) | service | **75** | `null` (padrão falado corte+masculino, não id) | unmatched | 0285, 3653, 0007 | Hits de `cort`. Orion: + masculino + André/Erick/Tiago. |
| 3 | profissional pelo nome | pro | **71** | — | — | 2987 (Fefe); 0285 (André) | **71 no saco**, não por nome. Erick/Tiago **sem** last4 neste seed → sem Term individual. |
| 4 | cabelo (genérico) | service | **29** | `null` | unmatched | 4501 (“arrumar pezinho do **cabelo**”) | Ambíguo corte vs química. FILTER **pega** `cabelo`. |
| 5 | cancelar | faq | **13** | — | — | **ausente no seed** | Ranking copiado. Term row **withheld** (veto last4). `CANCEL_RE` existe; Ask-class não ganha valor `cancel`. |
| 6 | preço / valor | faq | **13** | — | — | 4905 (“valor para tintura”) | Pouco vs agenda. Intent PRICING gravado = **3** ≠ 13 falas. |
| 7 | penteado | service | **6** | `null` | unmatched | 3653 | Ofensor coloquial **fraco** nesta semana. Tess mapeou Penteado/Gi no fio — isso é **comportamento do sistema**, não match de catálogo. |
| 8 | remarcar | time | **4** | — | — | **ausente no seed** | Ranking copiado. Term row **withheld**. `RESCHEDULE` é eixo 2. |
| 9 | tesoura | service | **2** | `null` | unmatched | 3653 | Coloquial penteado. Stem **ausente** do FILTER; Mary §5.2 marcou `keyword_gap=false` (cobertura via `penteado`/`cort` na fala). |
| 10 | dia a dia | noise | **1** | — | — | 3653 | |

Cauda Orion **sem N** (escova, barba, manicure, mecha, maquiagem, raiz, laser): uma row seed só onde há last4 (`maquiagem` ← 0007). **Não** seedar `mão tradicional` (citado na Onda 2; **não** está no ranking desta semana).

---

## Ranking — dificuldade (Friction, totais de janela)

Totais **não** se rateiam por termo. `handoff_likely` no Term só com ligação Orion na evidência.

| friction_id | kind | window_n | last4_sample | linked_term_ids | quote |
|---|---|---:|---|---|---|
| fr-timeout | timeout | **1** | 4501 | t-pezinho | “arrumar pezinho do cabelo” |
| fr-guard | guard.blocked | **23** | — | — | Orion não atribuiu termo |
| fr-handoff | handoff.human | **24** | — | — | Orion não atribuiu termo |
| fr-duration | duration_query | null | 2987 | t-2h-atendimento | “2h de atendimento?” |
| fr-occupancy | occupancy | null | 2987 | — | “opção que já tem cliente” |
| fr-two-phase | two_phase | null | — | — | Sem amostra last4 no seed → **não** preenchido |
| *(controlo, não Friction)* | booking.created | **13** | — | — | Fora da entidade Friction |

`tess.context_trimmed = 1` — não vira Term.

---

## Catálogo de termos (seed)

Contrato Mary: `Term → { class, keyword_gap, suggested_keyword, handoff_likely }`.  
`utterance_id` aqui = `{last4}-{slug}` (catalog-local). Dex dump ainda **não** emitiu `hash8(norm_text)`.

### 5.1 Seeds mandatórios (missão Mary)

| term_id | surface | class | keyword_gap | suggested_keyword | handoff_likely | orion_n | evidence_last4 | evidence_quote |
|---|---|---|---|---|---|---:|---|---|
| t-tintura | tintura | service | **true** | `tintura` | false | null | 4905 | “valor para tintura” |
| t-gloss | gloss | service | **true** | `gloss` | false | null | 4905 | “trabalham com gloss?” |
| t-pezinho | pezinho | service | **true** | `pezinho` | **true** | null | 4501 | “arrumar pezinho do cabelo” — **tess.timeout = 1** |
| t-maquiadora | maquiadora / maquiador | pro | **true** | `maquiador` | **true** | null | 2987, 0330 | “maquiadora não é só a Fefe?” / “Quem é maquiador aí?” — cargo ≠ `maquiagem` |
| t-pix | pix | pay | false | null | false | null | 0007 | “aceita pix?” — já no `FAQ_RE`; prioridade recepção 04/09 ≠ gap de keyword |
| t-endereco | endereco | faq | false | null | false | null | 0007 | “endereço” — já no `FAQ_RE` |
| t-masculino | masculino | service | **true** | `masculino` | false | null | 4749 | “é masculino” — gênero, SKU implícito; não está no FILTER |
| t-2h-atendimento | 2h atendimento | time | false | null | **true** | null | 2987 | “2h de atendimento?” — `DATE_RE` casa `\d{1,2}h` como relógio; sentido = **duração** (`sense_gap`) |

`orion_n = null` nestes oito: Orion **não** publicou contagem por termo (cauda / amostra). Não interpolar.

**“vim pelo Studio Tirra”:** **não** é `Term.class=landing`. Ver ChannelPattern § abaixo. Term `class=noise` **withheld** — Mary last4 = “—” (veto Craft).

### 5.2 Ranking com N + last4 atribuível

| term_id | surface | class | keyword_gap | suggested_keyword | handoff_likely | orion_n | evidence_last4 | evidence_quote / nota |
|---|---|---|---|---|---|---:|---|---|
| t-corte | corte / cort | service | false | null | false | **75** | 0285, 3653, 0007 | 0285 “corte com André”; 3653 “corte na tesoura”; 0007 histórico “corte” |
| t-profissional-pelo-nome | profissional pelo nome | pro | false | null | false | **71** | 2987, 0285 | Saco Fefe/Erick/André/Tiago. **Não** repartir 71. |
| t-fefe | Fefe | pro | false | null | false | null | 2987 | “maquiadora não é só a Fefe?” — `PROFESSIONAL_RE` hit |
| t-andre | André | pro | false | null | false | null | 0285 | “corte com André” — `PROFESSIONAL_RE` hit (`andre`) |
| t-cabelo | cabelo | service | false | null | false | **29** | 4501 | substring FILTER; co-ocorre com pezinho |
| t-preco | preço / valor | faq | false | null | false | **13** | 4905 | “valor para tintura” — `PRICE_RE`; intent PRICING gravado = 3 |
| t-penteado | penteado | service | false | null | false | **6** | 3653 | “Penteado para o dia a dia” |
| t-tesoura | tesoura | service | false | null | false | **2** | 3653 | “corte na tesoura” — Mary §5.2 `keyword_gap=false` |
| t-dia-a-dia | dia a dia | noise | false | null | false | **1** | 3653 | |
| t-sexta-final-do-dia | sexta final do dia | time | false | null | false | null | 4749 | “horário na sexta final do dia” — `DATE_RE` via `sexta`; `kind=daypart` |
| t-horario-funcionamento | horário de funcionamento | faq | false | null | false | null | 0007 | já no `FAQ_RE` — **não** confundir com núcleo de encaixe |
| t-maquiagem | maquiagem | service | false | null | false | null | 0007 | cauda; last4 Orion slots (“fala maquiagem”). SKU unmatched. |

**Withheld (ranking Orion, zero last4 no seed):** `t-cancelar` (n=13), `t-remarcar` (n=4), Term individuais Erick / Tiago, cluster “hoje / amanhã / sábado / agendar” como rows, cauda escova/barba/manicure/mecha/raiz/laser, `mão tradicional`.

**term_count (rows com last4):** **20**  
**gap_count (`keyword_gap=true`):** **5** — tintura, gloss, pezinho, maquiadora, masculino.

---

## ServiceAsk / ProfessionalAsk / TimeAsk (instâncias seed)

SKU sempre `sku_id=null`, `sku_status=unmatched`. `matched` só depois do cruzamento snapshot (DoD Orion item 3).

| last4 | asks | Campos |
|---|---|---|
| 4905 | ServiceAsk ×2 | t-tintura, t-gloss — unmatched |
| 4501 | ServiceAsk | t-pezinho — `gender_qualifier=null` |
| 2987 | ProfessionalAsk + TimeAsk | `kind=role` maquiadora (`in_professional_re=false`); `kind=named_person` Fefe (`in_professional_re=true`); TimeAsk `kind=duration` `date_re_hit=true` `sense_gap=true`; Friction occupancy |
| 0330 | ProfessionalAsk | `kind=role` maquiador (`in_professional_re=false`) |
| 0007 | — (pay/faq) + ServiceAsk cauda | t-pix, t-endereco, t-horario-funcionamento; t-maquiagem unmatched. Sem inventar SKU. |
| 4749 | TimeAsk + ServiceAsk | TimeAsk `kind=daypart` “sexta final do dia” `date_re_hit=true` `sense_gap=false`; ServiceAsk t-masculino `gender_qualifier=masculino` `implicit_sku=true` |
| 0285 | ServiceAsk + ProfessionalAsk | t-corte unmatched; André `kind=named_person` `in_professional_re=true` `before_sku=unknown` |
| 3653 | ServiceAsk ×2 + noise | t-penteado, t-tesoura unmatched; t-dia-a-dia noise. Mapeamento Tess→Penteado/Gi **não** é `sku_status=matched`. |
| (landing) | ChannelPattern | sem SKU; sem Term.class=landing |

`before_sku` default `unknown` até Mira ler o fio. Orion: nomes **muitas vezes antes** do SKU — qualitativo, sem N por ordem.

---

## ChannelPattern — “vim pelo Studio Tirra”

**Não** é `Term.class=landing`. `funnel_field_exists=false` (Pedro eixo 5).

| Campo | Valor |
|---|---|
| pattern_id | cp-studio-tirra-landing |
| surface | vim pelo Studio Tirra |
| steps_observed | `landing_hello` → `quero agendar` → (`masculino` \| `qual valor` \| dia) |
| funnel_field_exists | **false** |
| intent_today | UNCERTAIN / SCHEDULING sem SKU |
| scheduling_ask_hit | **true** (`hasSchedulingAsk` já casa `vim pelo`) |
| orion_n | **null** |
| orion_volume_label | **dezenas de fios** |
| evidence_last4 | **vazio** — Orion não atribuiu last4; dump Dex não listou falas |

Isto **não** é conversa livre de recepção; é **landing**. Hipótese a **contar** last4 distintos no dump — não promovida a campo de funil. Sem last4, **não** entra no numerador da cobertura §6.

---

## Gaps vs FILTER_SERVICE_KEYWORDS

Regra Mary §3.1: `keyword_gap` relativo ao **matcher da classe**, não “faltou no FILTER” para todo mundo. `suggested_keyword` = stem do cliente a **somar**. Proibido remapear para stem que já furou (`tintura` ↛ `color`).

| Termo | class | Por que fura | suggested_keyword (Onda 2) | last4 |
|---|---|---|---|---|
| tintura | service | `color` / `tonaliz` não cobrem o lexema | `tintura` | 4905 |
| gloss | service | ausente da lista | `gloss` | 4905 |
| pezinho | service | coloquial; `cabelo` na **mesma fala** pode hit-ar o FILTER na utterance, o **termo** pezinho não | `pezinho` | 4501 |
| maquiadora / maquiador | pro | cargo ≠ substring `maquiagem`; `kind=role` | `maquiador` | 2987, 0330 |
| masculino | service | gênero / SKU implícito; não está no FILTER | `masculino` | 4749 |

**Não são keyword_gap** (Mary): pix, endereco, 2h atendimento (`DATE_RE` hit + `sense_gap`), corte, cabelo, penteado, nomes no `PROFESSIONAL_RE`.

Onda 2 **não** parte daqui. ACK Victor primeiro.

---

## score-keyword-coverage (conceitual — W3)

Task `score-keyword-coverage` exige hit/miss **por fala única** no dump. O artefato `floor-corpus-20260904.md` **não** traz a tabela de falas (PII residual). Esta secção **copia** Orion; não re-corre o matcher nas 629.

| Métrica | Valor | Honestidade |
|---|---:|---|
| total_utterances (dedup last4+texto) | **629** | Orion / corpus |
| hits FILTER | **125** | Orion |
| hit_rate | **20%** | 125/629 |
| misses (complemento bruto) | **504** | 629−125; **não** usado como fatia dura |
| **fatia dura** = long_no_keyword | **383** | Orion: falas **longas** sem keyword de SKU |
| unique_long | **não publicado** | Mary: Dex publica este denominador. Ausente. |
| is_long cutoff | `norm_len >= 40` **OU** ChannelPattern | Mary AUTO-DECISION; Orion **não** publicou o critério das 383. Confiança **média**. |

### Top misses (amostra Orion — não top 20 do dump)

Não há ranking de misses com N. Amostra last4 do filtro furado:

| last4 | Fala | Por que fura | No catálogo? |
|---|---|---|---|
| 2987 | “maquiadora não é só a Fefe?” / “2h de atendimento?” / “opção que já tem cliente” | Pessoa + duração + ocupação — zero SKU | sim (pro + time + friction) |
| 0330 | “Quem é maquiador aí?” | Cargo, não `maquiagem` | sim (t-maquiadora) |
| 4905 | “valor para **tintura**” / “trabalham com **gloss**?” | sinónimos fora da lista | sim |
| 0007 | “aceita pix?” / “endereço” / “horário de funcionamento” | FAQ operacional, não serviço | sim (pay/faq; **não** gap de FILTER) |
| 4501 | “arrumar **pezinho** do cabelo” | coloquial; timeout | sim (t-pezinho). Utterance pode ser FILTER **hit** via `cabelo`. |
| 4749 | “horário na sexta final do dia” / “é masculino” | dia-parte + gênero | sim |

### Cobertura da fatia dura (383) — **não fingir 80%**

Mary §6.3: DONE quando ≥80% das **383** têm Term **ou** ChannelPattern **ou** `unclassified=true` com last4. Senão o catálogo só etiquetou os 125 hits que o FILTER já via.

v0.1.0 **não** enumera utterance_ids das 383. Rows deste ficheiro = Terms seed, não 383 Utterance tags.

| Contagem honesta | N | % das 383 |
|---|---:|---:|
| Utterance rows tagged na fatia dura | **0** | **0%** |
| Quotes Orion da tabela “filtro não pega” (upper bound, ignora `is_long`) | **12** | **3,1%** |
| last4 distintos nessa tabela | **6** | n/a (não é o denominador) |
| ChannelPattern last4 | **0** (dezenas sem lista) | **0** extra |
| `unclassified` com last4 | **0** | **0** |

**Veredito cobertura 383:** **~0% a ≤3,1%** no grain utterance-row do catálogo seed. **Não é 80%.**

Passo mecânico Orion (dump last4, 04/09 ~12:00 BRT), **sem** gravar PII de texto:

| Denominador | N | Tagged (regex Mary-class) | % |
|---|---:|---:|---:|
| Orion miss `len>8` sem keyword | **383** | não recontado neste passo (mistura curta+longa) | — |
| Mary `is_long` (≥40 ou landing) **sem** keyword | **158** | 127 (pro 17, time 42, faq 4, noise/landing 64, unclassified 31) | **80,4%** |

O 80% de Mary no recorte `norm_len≥40` **aparece** no tagger, mas **64/158 são landing/noise** — não fecha a fatia dura de serviço. `ChannelPattern` “vim pelo Studio Tirra”: **68 last4** distintos (já não é “dezenas” sem N).

Gate Quinn de Onda 1: schema OK; privacidade do dump bruto **ainda** tem risco (e-mail em fala); cobertura das **383** Orion **FAIL**.

---

Os 125 hits (20%) estão **fora** da fatia dura por definição.

---

## Hipóteses

| Hipótese | Veredito v0.1.0 | Evidência | vs prompt? |
|---|---|---|---|
| Triagem fraca **no dado** (intent null alto) | **CONFIRMADO** | 383 null / 511 turnos user bot-processed | Não medido vs prompt |
| Language mismatch (regra montada nas **nossas impressões**, não no chão desta semana) | **CONFIRMADO para as 5 rows `keyword_gap=true`** | tintura, gloss, pezinho, maquiadora, masculino — last4 acima; FILTER/PROFESSIONAL_RE não pegam o stem | **NÃO medido vs prompt** (proibido cola 46589; sem métrica de fidelidade) |
| Lado **recepção** da mesma hipótese (“IA **e** recepção”) | **ABERTO / não medido** | `staff_outbound=0` | — |
| Landing “vim pelo Studio Tirra” → UNCERTAIN/SCHEDULING sem SKU | **CONFIRMADO qualitativo Orion**; N last4 **não medido** | volume_label “dezenas”; `scheduling_ask_hit=true`; evidence_last4 vazio | Não medido vs prompt |
| Encaixe + prof **antes** de SKU | **CONFIRMADO qualitativo** | 71 falas nome; 2987 Fefe em fala sem SKU. `before_sku=unknown` até Mira | Não medido vs prompt |
| `DATE_RE` lê `2h` como relógio | **CONFIRMADO amostra** | 2987 + `sense_gap=true` | Código, não prompt |
| Penteado coloquial é o ofensor da semana | **REFUTADO nesta janela** | penteado 6, tesoura 2, dia a dia 1 — vs encaixe + nomes + não-SKU | — |

Victor: “a Tess ainda erra porque a linguagem foi montada nas nossas impressões.”  
**No FILTER/keywords:** confirmado nas 5 gaps. **No prompt:** ainda hipótese — este catálogo **não** confrontou o texto do agente.

---

## Buraco recepção outbound

**Fato:** `bot_thread_state.last_staff_outbound_at` nesta janela = **0** (`staff_outbound_in_window=0` no corpus). Kapso `history_sync` é **ignorado** no webhook. O mapa da recepção hoje é só o que o cliente escreveu **enquanto** o bot via o inbound. Os 7 fios inbound-only **não** são transcrição da recepção.

**Não feito:** tabela `reception_utterance`, inferência do que a recepção disse, tratar `agent=human` em `conversation_history` como corpus de chão.

### Checklist (Mary §8) — todos abertos

- [ ] **C1 — Confirmar zero no banco.** Dex: contar `last_staff_outbound_at` IS NOT NULL. Esperado: **0**. Corpus já reporta 0.
- [ ] **C2 — Decidir a fonte.** Victor: Kapso (export/API histórico Cloud, não o webhook) **ou** export manual WhatsApp Business.
- [ ] **C3 — Redaction.** last4 only no artefato.
- [ ] **C4 — Artefato separado.** `docs/analysis/floor-corpus-reception-{YYYYMMDD}.md`. **Não** misturar no denominador 629.
- [ ] **C5 — Recobrir ChannelPattern + 24 handoff** com fala da recepção. Sem isso, “IA **e** recepção” fica aberta no lado recepção.
- [ ] **C6 — Não atrasar o 80%.** Cobertura usa `conversation_history`. Gap recepção ≠ desculpa para não etiquetar as 383.

Até C4 existir, ranking “como a recepção fala” = **fora de escopo / não medido**.

---

## Auto-decisões

1. Taxonomia Mary 6 + ChannelPattern — Craft `landing` **não** usado em `Term.class`.  
2. Term rows só com last4. Ranking Orion sem last4 (cancelar 13, remarcar 4, Erick/Tiago, “dezenas” de landing) ficou na tabela de ranking / ChannelPattern, **não** virou Term.  
3. last4 0285 / 3653 / 0007 para corte/penteado/tesoura/dia a dia/André/maquiagem: Orion **slots-contexto**, mesma janela — não inventado.  
4. SKU = `null` / `unmatched`. Corte Masculino = padrão falado, não id Trinks. Mapeamento Tess Penteado/Gi no 3653 **não** promove `matched`.  
5. `keyword_gap` dos 5 mandatórios = Mary seed. tesoura copia Mary `false` apesar do stem ausente do FILTER.  
6. Coverage 383 reportada em 0–3,1%, **não** 80%.  
7. Language mismatch: CONFIRMADO nas gaps; **não** vs prompt.  
8. Reception = checklist, zero rows fake.

**Confiança:** volumes Orion **alta** (cópia). Classificação dos 8 seeds mandatórios **alta**. last4 ranking via slots-contexto **média-alta** (mesma semana, outra fatia Orion). `is_long` cutoff 40 **média**. `handoff_likely` maquiadora/2h **média** (amostra, não N de handoff). Cobertura 383 **alta** no veredito “não é 80%”; **baixa** no inteiro exato de tagged_long.

---

## Contagens de entrega

| Campo | Valor |
|---|---|
| catalog_path | `docs/analysis/floor-lexicon-catalog-v0.1.0.md` |
| version | **0.1.0** |
| term_count | **20** |
| gap_count | **5** |
| ChannelPattern | 1 (`cp-studio-tirra-landing`, last4 vazio) |
| Friction rows | 5 preenchidas + two_phase vazio |
| coverage_383 | **0% utterance-row; ≤3,1% quote upper bound. Não 80%.** |
| staff_outbound | **0** |
| confirmed_hypotheses | intent-null 383/511; keyword_gap×5 = language mismatch no FILTER; landing qualitativo; encaixe+prof qualitativo; 2h sense_gap; penteado-fraco (refuta ofensor da semana) |
| open | recepção outbound; mismatch **vs prompt**; N last4 da landing; 80% das 383 |

---

## Handoff

→ Mira: amostra de fios (IA + inbound-only) para `before_sku` e ChannelPattern last4.  
→ Dex: dump last4+texto para etiquetar as **383** (Term / ChannelPattern / unclassified). Sem isso o gate 80% não passa.  
→ Quinn: `corpus-quality-gate` — privacidade OK; semver OK; **cobertura 80% FAIL** (seed-only).  
→ **Não** `handoff-triage-wave` até gate PASS + ACK Victor.  
→ Onda 2 stems candidatos (não patch): `tintura`, `gloss`, `pezinho`, `maquiador`, `masculino`. Religar bot = decisão à parte.

*Sem E.164. Sem prompt 46589. Sem SKU inventido.*
