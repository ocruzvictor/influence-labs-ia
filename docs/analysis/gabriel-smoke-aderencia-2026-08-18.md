# Smoke Gabriel (17/08 noite) × prompt TESS 46589 — análise de aderência e plano de qualidade

> **@analyst (Atlas) · 2026-08-18.** Leitura calma do smoke feito por Gabriel Rocha (ex-recepção, +55 18 99824-04xx)
> na noite de 17/08/2026 (~23:50–00:08 BRT) contra o número do bot 95502, comparado ao prompt canônico
> `docs/prompts/tess-conversa-v3-clean.md` (+ `docs/handoffs/46589-prompt-changes-2026-06-02.md` e
> `docs/ops/ajustes-autorizados-2026-08-17.md`).
>
> **Isto não é um PRD.** É diagnóstico + rubrica + fatia de correção. Nenhuma regra de produto nova é inventada aqui:
> onde falta decisão, está marcado como **questão de produto com opções numeradas** (§7).
>
> **Escopo read-only.** Nada foi executado no Trinks, no Meta/WABA, no deploy ou no git. O projeto irmão
> `ecoadventure-sdr-wpp` foi lido sem modificação.

---

## TL;DR

1. **O bot fez a parte difícil e errou a parte barata.** Ele entendeu combo, respeitou habilitação (recusou Eli),
   montou mini-agenda coerente e emitiu as tags certas. O que quebrou foi **contorno**: horário fora do expediente,
   duplicação de reserva, troca de profissional criando reserva nova em vez de remarcar, e vocabulário de marca.
2. **O dano real da noite é operacional, não conversacional:** a conversa gerou **7 agendamentos** para 1 cliente
   numa única sexta (521402496, 521402506, 521402552, 521402553, 521403349, 521403350, 521403351), sendo
   **4 órfãos** (André, abandonados quando o cliente trocou para Erick) e **2 fora do horário de funcionamento**
   (20:30–23:40 e 23:40–01:10, num dia que fecha às 19h).
3. **Causa dominante = regra sub-especificada, não modelo ruim.** É exatamente o achado do relatório Flora
   `9.4-relatorio-aderencia-FINAL.md`: estrutura ~97% e mesmo assim FAIL, porque **um gatilho estava sub-especificado**
   e o modelo o perdia de forma estocástica. Lá a conclusão foi "a alavanca é o prompt, não o modelo maior". Aqui vale
   igual: nenhuma linha do prompt 46589 diz *"não ofereça horário que não caiba no expediente"* nem *"não re-emita
   BOOKING_CREATE"*. O modelo não desobedeceu — ele preencheu vazio.
4. **Duas coisas são de código, não de prompt:** idempotência de `BOOKING_CREATE` (`backend/server.js:1163`, sem
   nenhuma guarda) e a mensagem final `"Prontinho! Te esperamos no Studio Tirra 😊"` (`backend/server.js:1194`),
   que é emitida **mesmo fora do horário** e contradiz frontalmente a I.8 (*"NÃO diga 'te espero agora'"*).
5. **Rubrica proposta: 8 kill-rules + 6 checks qualitativos.** Pontuando esta conversa: **8/8 kills violadas,
   qualitativo 58%** → **🔴 FAIL** no gate. Não é sinal de desastre — é sinal de que o gate finalmente mede o que
   dói. Antes desta rubrica, a mesma conversa "passaria" numa leitura de tom.
6. **Uma decisão de produto está bloqueando o combo:** *dois profissionais no mesmo horário de início* não existe
   em nenhum artefato. §7 traz 4 opções numeradas.

---

## 0. Contexto factual da noite (para ancorar as leituras)

| Fato | Valor | Fonte |
|---|---|---|
| Data/hora | 17/08/2026 ~23:50 → 18/08 ~00:08 BRT | conversa |
| Dia da semana | **Segunda-feira** | `date` |
| Estado do salão | `FORA do horario — SEGUNDA — salao fechado` | `backend/server.js:171-187` |
| Dia agendado | sexta-feira **21/08/2026** | conversa |
| Expediente da sexta | **9h–19h** (Ter-Sex) | prompt, `CONTEXTO DINÂMICO`; `server.js:183` |
| Cliente | Gabriel Rocha (ex-recepção, testando) | conversa |

Isso importa por dois motivos: (a) a I.8 estava ativa a noite inteira, então o discurso de after-hours era esperado;
(b) tudo que foi marcado depois das 19h de sexta é, por definição, fora do expediente declarado ao próprio bot.

---

## 1. Scorecard — regra do prompt × turno do Gabriel

Legenda: **PASS** = cumpriu · **CONCERNS** = cumpriu parcial / ambíguo · **FAIL** = violou.
"Turno" refere-se à numeração da conversa (1–14, duplicatas `passive` ignoradas).

### 1.A — O que funcionou (registrar, não é ruído)

| Regra | Turno | Veredito | Evidência |
|---|---|---|---|
| REGRA ZERO — habilitação (`só ofereça profissional listado`) | 10 | **PASS** | Cliente pediu mover para Eli; bot recusou por não ser habilitada e ofereceu Erick. Recusa correta, sem inventar competência. |
| I.4 — masculino discrimina equipe vs TA (exceção do masculino) | 3 | **PASS** | Listou `TA - Corte Masculino R$105` + infantil quando perguntado sobre André. A tabela masculina **pode** discriminar (`ajustes-autorizados-2026-08-17.md` §2). |
| I.1 passo 4 — confirmação tripla antes de criar | 7→8 | **PASS** | Mini-agenda 19:30–22:00 / R$225 apresentada, cliente disse "Pode confirmar". |
| I.1 passo 6 — não dizer "Agendado!" antes da Trinks | 8, 14 | **PASS** | Sem "Agendado!/Confirmado!" no texto do modelo (o `sanitizePrematureConfirm` também cobre). |
| I.6 combo — tentar montar em vez de escalar na 1ª dificuldade | 7 | **PASS** | Montou corte + progressiva em sequência, somou durações, deu total. Era exatamente o comportamento pedido em 17/08. |
| I.8 — agendar fora de horário avisando conferência do Gabriel | 1, 8 | **PASS** | Avisou e seguiu agendando, como manda a I.8. |
| P NUNCA — inventar turno `Cliente:` | todos | **PASS** | Nenhuma linha `Cliente:` fabricada. |
| I.7 — responder o batch uma vez | todos | **PASS** | Sem fatiamento por mensagem recebida. |

### 1.B — Onde quebrou

| # | Regra | Turno | Veredito | Evidência / leitura |
|---|---|---|---|---|
| F1 | **Grade e expediente** (REGRA ZERO: *"Horários: apenas HORARIOS VAGOS"* + `HORARIO DE FUNCIONAMENTO Ter-Sex 9h-19h`) | 5, 7, 11, 13, 14 | **FAIL** | Ofereceu **19:00 e 19:30** numa sexta que fecha às 19h; depois construiu mechas **20:30–23:40** e progressiva **23:40–01:10**. Os horários derivados da mini-agenda **não vêm** de `HORARIOS VAGOS` — são aritmética do modelo (início + duração). O prompt manda ofertar só o que está na grade, mas **não** proíbe explicitamente horários **derivados**, e não diz nada sobre fechamento. Severidade alta: agendamento na madrugada de sábado. |
| F2 | **Duplicação de reserva** (sem regra no prompt; sem guarda no código) | 9 | **FAIL** | Turno 8 criou 521402496 + 521402506. Turno 9 o cliente respondeu só **"29/11/1996"** (data de nascimento) e o bot **criou de novo**: 521402552 + 521402553. Quatro reservas para dois serviços. |
| F3 | **Alteração via CREATE em vez de I.3 remarcação** | 11→14 | **FAIL** | Cliente trocou André → Erick e o bot emitiu **novos** `BOOKING_CREATE` (521403349/350/351) sem `[BOOKING_CANCEL]` nem `[BOOKING_RESCHEDULE]` dos 4 anteriores. A I.3 existe e não foi acionada — o prompt não diz que "trocar profissional" é remarcação. Resultado: 7 reservas ativas. |
| F4 | **I.6 — combo que não cabe deve escalar** (*"Só escale … se não couber na agenda visível"*) | 11–14 | **FAIL** | O plano não cabia: mechas 330min a partir das 20:30 estoura o expediente. Era o gatilho literal de `[HANDOFF_HUMAN motivo=multi_servico]`. Também se aplica o bullet **"Agendamento com mais de 1 profissional na mesma reserva"** → Erick + Jackie. Nenhum handoff foi emitido. |
| F5 | **Pedido do cliente não atendido e não escalado** | 12 | **FAIL** | *"Pode deixar tudo no mesmo horário"* → o bot manteve sequencial, sem explicar por que não dá e sem escalar. A I.6 manda escalar quando *"o cliente recusar as alternativas habilitadas"* ou houver ambiguidade após **uma** pergunta. Ficou em terceiro estado: nem atende, nem explica, nem passa. |
| F6 | **P NUNCA — mechas sem fluxo consultivo** (I.4: *"Especialidades (visagismo, mechas): fluxo consultivo. Pergunta 'o que te fez buscar?' antes de dar preço"*) | 11 | **FAIL** | Deu **R$880 / 330min** de mechas direto, sem teste de mechas e sem pergunta consultiva. É uma das poucas regras que o prompt escreve como `NUNCA` explícito. |
| F7 | **P NUNCA — diferenciar por "premium"** (*"NUNCA 'o X é o premium'"*) | 3, 10 | **FAIL** | Usou "premium" e "TA exclusivo" para qualificar serviços/profissionais. Ver §2(c): há uma **contradição de fonte** — a própria linha R do prompt diz *"salão premium em São Caetano do Sul/SP"*. |
| F8 | **Nome interno de SKU vazando** (sem regra; gap) | 3, 10 | **FAIL (de marca)** | `TA - Corte Masculino` é rótulo de tabela interna. Nada no prompt manda traduzir para linguagem de cliente. Gabriel apontou "jeito de escrever esquisito" — parte disso é isso. |
| F9 | **Contradição na mesma resposta + condição comercial hedgeada** (I.4: *"Sem valor promo no contexto, diga que terça/quarta têm condição, sem inventar número"*) | 4 | **FAIL** | Disse *"Não tenho informação de preço promocional diferente por dia"* e, no mesmo bloco, *"terça e quarta costumam ter preços especiais"*, e ainda deferiu ao Gabriel. Três posições incompatíveis numa bolha. O `valorPromocional` está `null` no snapshot — a regra pedia **uma** frase, não um hedge. Gabriel registrou no áudio exatamente isso: *"dia mais barato não foi comunicado"*. |
| F10 | **Drop silencioso de item já confirmado** (sem regra; gap) | 11 | **FAIL** | Ao remontar o combo com mechas, a progressiva — já confirmada no turno 7 — virou "opcional às 23:40" e sumiu do plano. Só voltou no turno 13 porque **o cliente percebeu** (*"Sim, mas faltou a progressiva"*). Num cliente real, some. |
| F11 | **Formatação WhatsApp (markdown)** | 3 (e seguintes) | **FAIL de operação, não de prompt** | Usou markdown. **Nota de honestidade:** revisei o canônico `tess-conversa-v3-clean.md` linha a linha — **não existe** regra escrita proibindo markdown. A regra "sem markdown" é expectativa operacional, não texto do prompt. Portanto isto é **gap de especificação**, não desobediência. Flora tem a regra escrita (`sdr-prompt-v4.2`, linhas 249-253). |
| F12 | **I.1 passo 2 — coletar dados do cliente novo antes de confirmar** | 8 | **CONCERNS** | O bot confirmou e criou no turno 8 com nome + telefone, e só **depois** pediu nascimento. A ordem invertida é o que abriu a porta para F2: o turno 9 (só a data) foi lido como novo pedido de agendamento. |
| F13 | **I.10 — 1 bolha por turno** | 8, 14 | **CONCERNS** | O texto do modelo respeitou 1 bloco, mas o backend anexa `finalMessages` como blocos extras (`server.js:1326`). O commit `88dce88` ("collapse WhatsApp replies to one Kapso send") ataca isso; precisa reconfirmação em smoke, não em leitura de código. |
| F14 | **I.8 — não fingir salão aberto** | 8, 14 (backend) | **FAIL (backend)** | `server.js:1194` empurra *"Prontinho! Te esperamos no Studio Tirra 😊"* **sempre**, inclusive fora do horário. A I.8 diz literalmente *"NÃO diga 'te espero agora'"*. O prompt está certo; o código sobrescreve. É a origem da "cópia de fora-de-horário" percebida. |
| F15 | **Estilo/PT-BR** | 2 | **CONCERNS** | *"Corte com o André, gotei."* — typo por "gostei". Isolado, mas soma na percepção de "escrita esquisita" do Gabriel. |

**Resumo:** 8 PASS · 3 CONCERNS · 12 FAIL. Nenhum FAIL é de compreensão. Todos são de **contorno não especificado** ou de **camada errada** (código fazendo o oposto do prompt).

---

## 2. Causas-raiz (quatro famílias, com atribuição)

### (a) Regra sub-especificada — a família dominante (F1, F2, F3, F10, F11)

O prompt descreve **o caminho feliz** com boa densidade e quase não descreve **as bordas**. Não há uma frase sobre:
horário derivado × grade; fechamento do salão como limite duro; o que fazer depois de já ter emitido um `BOOKING_CREATE`;
o que é "alterar" um plano já criado; formatação de saída.

É literalmente o diagnóstico do `9.4-relatorio-aderencia-FINAL.md` §4: *"o trigger de handoff do prompt v3 está
sub-especificado → os modelos o perdem de forma estocástica"*, com a conclusão *"a alavanca é o prompt, não o modelo"*.
Lá a evidência foi que dois modelos diferentes perdiam cenários **diferentes**. Aqui a evidência análoga é interna:
o mesmo bot, na mesma conversa, **acertou** a habilitação (regra escrita, explícita, com exemplo) e **errou** o
expediente (regra não escrita). O padrão é o mesmo: onde há texto, ele obedece.

### (b) Camada errada — prompt vs backend (F2, F13, F14)

Três sintomas percebidos como "o bot está ruim" são de código:

- **`BOOKING_CREATE` sem idempotência.** `backend/lib/booking-parser.js:67-77` coleta **N** tags e
  `backend/server.js:1163` executa **todas**, sem chave de deduplicação, sem checar se aquele
  `(serviço, profissional, dataHora, cliente)` já foi criado nesta conversa. Qualquer re-emissão do modelo vira
  reserva nova na Trinks. O turno 9 é exatamente isso.
- **Mensagem de sucesso ignora `isSalonOpen()`** (`server.js:1194`), contradizendo I.8.
- **Blocos extras** anexados após a resposta (`server.js:1326`) competem com a regra de 1 bolha.

O paralelo Flora é direto: em `aprendizados-flora-maria-1741-2026-08-10.md`, mensagens repetidas **não** foram
resolvidas no prompt — foram resolvidas com `[ANTI-ECHO]` + `[OUTBOUND-IDEMPOTENCY]` (4 min) na camada de envio.
Idempotência é problema de código. Sempre.

### (c) Contradição interna do prompt (F7)

`tess-conversa-v3-clean.md:12` — *"salão **premium** em São Caetano do Sul/SP"*.
`tess-conversa-v3-clean.md:160` — *"NUNCA … 'o X é o premium'"*.

O modelo recebe a palavra como vocabulário autorizado da marca na primeira linha da ROLE e é punido por usá-la 148
linhas depois. A proibição é **contextual** (não diferenciar profissional por preço) e a autorização é **genérica**.
Modelo nenhum resolve isso de forma estável. Não é teimosia: é ambiguidade de fonte.

### (d) Estilo TESS / vazamento de dado interno (F8, F15)

`TA - Corte Masculino` é nome de SKU. O bot fala o snapshot literalmente porque a REGRA ZERO manda usar
*"o nome EXATO"*. Correto para o `servicoId`, errado para a fala. Falta a distinção "nome técnico × nome ao cliente" —
que a Flora tem explícita (`sdr-prompt-v4.2:247`: *"os IDs técnicos `card_economico`/`card_privativo` existem só nos
sinais `[MATERIAL]`, nunca na fala com o lead"*).

---

## 3. O que a Flora tem e o 46589 não tem (transferível, sem turismo)

Cinco mecanismos. Nenhum deles é conteúdo de viagem — todos são **estrutura de prompt**.

| # | Mecanismo Flora | Onde vive | Por que resolve um FAIL do Gabriel |
|---|---|---|---|
| T1 | **Bloco "O QUE VOCÊ NÃO FAZ (limites absolutos)"** — 8 linhas, no topo, antes de qualquer fluxo | `sdr-prompt-v4.2:24-33` | O 46589 tem `NUNCA:` com 11 itens, mas **no rodapé**, depois de 150 linhas de fluxo, sem hierarquia. Limites no topo são lidos como constituição; no rodapé, como rodapé. |
| T2 | **Tabela de vocabulário obrigatório (Use sempre / Nunca use)** | `sdr-prompt-v4.2:35-52` | Resolve F7 e F8 de uma vez. Flora bane "orçamento" e "card" com substituto explícito. O 46589 proíbe "premium" **sem oferecer o que dizer no lugar** — e ainda usa a palavra na ROLE. |
| T3 | **Regra de formatação WhatsApp explícita** | `sdr-prompt-v4.2:249-253` (*"PROIBIDO markdown de lista … use bullet unicode `•`"*) | Resolve F11. Hoje "sem markdown" é folclore de operação, não regra do prompt. |
| T4 | **TRIP-WIRE FINAL — checklist "valide antes de enviar, senão REFAÇA"** | `sdr-prompt-v4.2:483-502` (14 itens) | É **o** mecanismo que converte regra sub-especificada em comportamento determinístico. Cada item é um `if … REFAÇA`. É o antídoto direto da família (a). |
| T5 | **Gate binário em kill-rules, independente do %** | `9.3-rubrica-aderencia-flora-gemini.md` §4 | A lição registrada: *"estrutura pode ser 97% e mesmo assim FAIL"*. Sem isso, esta conversa do Gabriel seria lida como "boa, com alguns detalhes" — quando na verdade produziu 4 reservas órfãs. |

Dois refinamentos metodológicos que também transferem:

- **Discriminador de kill justo** (`9.4` §5): mantém-se o kill quando o comportamento esperado **não ocorreu em turno
  nenhum**; limpa-se quando ocorreu em **turno adjacente**. Usei isso na §4 (ex.: a progressiva do turno 11 **voltou**
  no 13, mas só por intervenção do cliente → mantive como kill, com nota).
- **Híbrido regex→humano** (`9.3` §1.D): checks de preço/valor sinalizam candidatos e um humano confirma, para não
  gerar falso positivo em valor legítimo do snapshot. O 46589 precisa disso para não punir R$105 correto.

**O que NÃO transferir:** score BANT, sinais `[ESTADO]/[SCORE]/[CLASSIFICACAO]`, funil de 8 etapas, protocolo de
ancoragem por faixas, catálogo de roteiros. É produto de SDR de turismo, não de agenda de salão.

---

## 4. Rubrica proposta para o 46589 — 8 kill-rules + 6 qualitativos

Desenho copiando a **forma** da 9.3 (gate binário em K, % como tuning secundário), não o conteúdo.

### 4.A — Kill-rules (K) — cada uma reprova a conversa sozinha

| ID | Kill-rule | Como checar | Nesta conversa |
|---|---|---|---|
| **K1** | **Grade e expediente.** Horário ofertado ou emitido em `BOOKING_CREATE` que (a) não esteja em `HORARIOS VAGOS` do profissional/dia, ou (b) cujo `início + duração` ultrapasse o fechamento do dia. | Determinístico: comparar tag × grade injetada × `isSalonOpen` do dia-alvo. | 🔴 **VIOLADA** — turnos 5, 11, 13, 14 (19:30 numa sexta 9h-19h; mechas até 23:40; progressiva até 01:10) |
| **K2** | **Idempotência de criação.** Re-emitir `BOOKING_CREATE` para um `(serviço, profissional, dataHoraInicio)` já criado na mesma conversa. | Determinístico: hash das tags já executadas. | 🔴 **VIOLADA** — turno 9 (521402552/553 duplicam 521402496/506) |
| **K3** | **Alteração é remarcação.** Trocar profissional/horário de reserva já criada emitindo `BOOKING_CREATE` novo, sem `BOOKING_CANCEL`/`BOOKING_RESCHEDULE` do bookingId anterior. | Determinístico: existe `AGENDAMENTOS FUTUROS` + novo CREATE mesmo dia sem CANCEL/RESCHEDULE. | 🔴 **VIOLADA** — turno 14 (3 novos creates, 4 antigos vivos) |
| **K4** | **Vocabulário e formatação.** Uso ao cliente de "premium", "exclusivo", prefixo de SKU interno (`TA - `), ou markdown (`**`, `*`, `-` iniciando linha). | Determinístico (regex) + confirmação humana para "premium" em citação do cliente. | 🔴 **VIOLADA** — turnos 3, 10 |
| **K5** | **Combo que não fecha = handoff.** Combo com 2+ profissionais na mesma janela, ou que não cabe no expediente, sem `[HANDOFF_HUMAN motivo=multi_servico]`. | Determinístico. | 🔴 **VIOLADA** — turnos 11–14 (Erick + Jackie, estourando o expediente, zero handoff) |
| **K6** | **Especialidade sem fluxo consultivo.** Preço de mechas/visagismo/alisamento sem a pergunta consultiva antes. | Híbrido: regex de valor + serviço; humano confirma. | 🔴 **VIOLADA** — turno 11 (R$880 direto) |
| **K7** | **Condição comercial inventada ou contraditória.** Afirmar e negar a mesma condição na mesma resposta, ou hedgear promo sem valor no snapshot ("costumam ter"). | Híbrido. | 🔴 **VIOLADA** — turno 4 |
| **K8** | **Drop silencioso.** Remover do plano um serviço já confirmado pelo cliente sem declarar a remoção e o motivo. | Estado de conversa (lista de serviços confirmados × plano atual). | 🔴 **VIOLADA** — turno 11 (progressiva sumiu; voltou só no 13, por iniciativa do cliente) |

> **Nota de justiça (discriminador 9.4 §5):** considerei limpar K8, já que a progressiva **voltou** no turno 13
> (turno adjacente). Mantive violada porque o retorno **não foi do bot** — foi correção do cliente. O comportamento
> esperado ("declarar a remoção") não ocorreu em turno nenhum.

### 4.B — Qualitativos (Q) — 0/1/2, agregados

| ID | Check | Nesta conversa | Nota |
|---|---|---|---|
| **Q1** | PT-BR natural, sem typo/gíria/robotismo | "gotei"; texto geralmente ok | **1** |
| **Q2** | Uma pergunta por vez (não enfileirar 3) | respeitado ao longo dos 14 turnos | **2** |
| **Q3** | Confirmação tripla completa **e na ordem** (dados do cliente antes do create) | criou antes de ter nascimento | **1** |
| **Q4** | Recuperação após correção do cliente | corrigiu, mas só após o cliente insistir (turnos 12→13) | **1** |
| **Q5** | Mini-agenda legível (serviço + duração + horário + total) | clara e somada corretamente | **2** |
| **Q6** | Coerência after-hours (não fingir salão aberto) | "Te esperamos" emitido às ~00h (backend) | **0** |

`qual_score` = (1+2+1+1+2+0) / 12 = **58%**.

### 4.C — Gate

| Veredito | Condição |
|---|---|
| 🔴 **FAIL** | ≥1 kill violada **ou** `qual_score < 60%` |
| 🟡 **CONCERNS** | zero kills e `qual_score ∈ [60%, 75%)` |
| 🟢 **PASS** | zero kills e `qual_score ≥ 75%` |

**Veredito desta conversa: 🔴 FAIL — 8/8 kills violadas, qualitativo 58%.**

Leitura calma disso: o gate não está dizendo "o bot é ruim". Está dizendo que **oito bordas nunca foram escritas**, e
que a conversa encontrou todas as oito em 14 turnos. É um resultado esperado para um prompt que só especifica o caminho
feliz. O valor do número é servir de linha de base: o mesmo smoke, re-rodado após os patches da §6, deve derrubar
K1/K2/K3/K5 imediatamente.

---

## 5. Prompt (cola no TESS) × código (backend)

| Item | Camada | Por quê |
|---|---|---|
| K1 grade/expediente — **regra de decisão** ("não ofereça") | **Prompt** | O modelo é quem oferta. |
| K1 — **guarda dura** ("não crie") | **Código** | Última linha de defesa, igual ao `isCompatible` do POST. |
| K2 idempotência de `BOOKING_CREATE` | **Código** (`server.js:1163`) | Prompt não garante ausência de re-emissão; garantia precisa ser determinística. |
| K3 alteração = remarcação | **Prompt** (I.3) + **Código** (alerta ao detectar create duplicando dia/cliente) | Decisão é do modelo; detecção é barata no backend. |
| K4 vocabulário / markdown | **Prompt** (tabela T2/T3) + sanitizer leve no backend | Igual ao `sanitizeInventedClientTurns` já existente. |
| K5 combo → handoff | **Prompt** (I.6) | Já existe a regra; falta o gatilho de "não cabe". |
| K6 fluxo consultivo mechas | **Prompt** (I.4) | Já é regra; falta trip-wire. |
| K7 promo terça/quarta | **Prompt** (I.4, frase única) | Snapshot já traz `valorPromocional: null`. |
| K8 drop silencioso | **Prompt** (trip-wire) | Comportamento de redação. |
| Mensagem "Te esperamos" fora de horário | **Código** (`server.js:1194`) | O prompt já proíbe; o código sobrescreve. |
| 1 bolha | **Código** (`server.js:1326` + commit `88dce88`) | Reconfirmar em smoke. |
| Nome de SKU ao cliente | **Prompt** (nome técnico × nome falado) | Analogia direta ao `sdr-prompt-v4.2:247`. |

---

## 6. Próxima fatia recomendada (pequena, verificável)

Ordem pensada para máximo dano evitado por linha alterada. **Nada aqui foi executado.**

### 6.1 — Três patches de prompt (Victor cola no TESS 46589)

**P1 — novo bloco `I.11 — Grade e expediente (limite duro)`** — mata K1 e alimenta K5.

```
## I.11 — Grade e expediente (limite duro)

- Só ofereça um horário de INÍCIO que esteja literalmente em HORARIOS VAGOS daquele profissional naquele dia.
- Todo serviço precisa TERMINAR dentro do expediente do dia (HORARIO DE FUNCIONAMENTO).
  Antes de ofertar, some: inicio + duracaoMinutos. Se ultrapassar o fechamento, o horário NÃO existe — não ofereça.
- Em combo, isso vale para CADA serviço da mini-agenda, inclusive os derivados (o 2º e o 3º).
  Horário derivado que não esteja em HORARIOS VAGOS ou que estoure o fechamento é inválido.
- Se o plano inteiro não fecha dentro do expediente do dia: NÃO empurre para a noite.
  Ofereça dividir em dois dias OU emita [HANDOFF_HUMAN motivo=multi_servico].
```

**P2 — novo bloco `I.12 — Depois de criar, não crie de novo`** — mata K2 (lado do modelo) e K3.

```
## I.12 — Depois de criar, não crie de novo

- Um [BOOKING_CREATE] por serviço, UMA vez por conversa. Emitida a tag, aquele serviço está criado.
- Se o cliente mandar um dado solto depois disso (data de nascimento, e-mail, "ok", "obrigado"),
  isso NÃO é um novo pedido de agendamento. Agradeça/registre e NÃO emita [BOOKING_CREATE] de novo.
- Colete TODOS os dados do cliente novo (nome, telefone, e-mail, nascimento) ANTES da confirmação tripla.
  Nunca crie primeiro e peça dado depois.
- Mudar profissional, dia ou horário de algo já criado NÃO é criar: é remarcar.
  Use [BOOKING_RESCHEDULE bookingId=…] ou [BOOKING_CANCEL bookingId=…] + novo create,
  sempre com o bookingId da seção AGENDAMENTOS FUTUROS DO CLIENTE. Nunca deixe reserva antiga viva.
```

**P3 — bloco de vocabulário e formatação (adaptação de T2+T3), + correção da contradição da ROLE** — mata K4 e F8.

```
# VOCABULÁRIO AO CLIENTE (obrigatório)

| Use sempre | Nunca use ao cliente |
|---|---|
| "Corte Masculino com o André" | ❌ "TA - Corte Masculino" (nome interno de tabela) |
| "o André é referência em X" | ❌ "premium", "exclusivo", "top de linha" |
| "esse valor é o da tabela dele" | ❌ comparação espontânea de preços |

Os nomes de SERVICOS DISPONIVEIS são EXATOS para o campo servicoId da tag.
Ao FALAR com o cliente, use o nome natural do serviço, sem prefixo de tabela.

# FORMATAÇÃO WHATSAPP
- PROIBIDO markdown: nada de **negrito**, *itálico*, ou linhas começando com "*" ou "-".
- Listas: use "•" no início da linha, um item por linha.
- 1 bolha por turno (I.10).
```

> Ajuste de fonte necessário junto do P3: trocar `R — ROLE` linha 12 de *"salão **premium** em São Caetano do Sul/SP"*
> para *"salão de referência em São Caetano do Sul/SP"*. Enquanto a ROLE autorizar a palavra, a proibição do rodapé
> não estabiliza.

**Trip-wire final (mecanismo T4) — 6 linhas, no fim do prompt:**

```
# VALIDE ANTES DE ENVIAR
1. Todo horário que citei está em HORARIOS VAGOS e termina antes do fechamento? Se não, REFAÇA.
2. Estou emitindo BOOKING_CREATE de algo que já criei nesta conversa? Se sim, REMOVA a tag.
3. O cliente está mudando algo já criado? Se sim, use CANCEL/RESCHEDULE com bookingId, não CREATE.
4. Escrevi "premium", "exclusivo", "TA - " ou markdown? Se sim, REFAÇA.
5. Tirei do plano um serviço que o cliente já confirmou? Se sim, declare a remoção e o motivo.
6. Combo com 2 profissionais ou que não cabe no expediente? Se sim, [HANDOFF_HUMAN motivo=multi_servico].
```

### 6.2 — Um patch de backend: idempotência de `BOOKING_CREATE`

Escopo mínimo, em `backend/server.js` no laço de `createsToRun` (linha 1163):

- Chave: `sha1(clientPhone | service_id | professional_id | date_time)`.
- Guardar as chaves executadas com sucesso no `state` da sessão **e** consultar `trinks_appointments` local
  (mesmo cliente + mesmo `scheduled_at` + mesmo profissional) antes do POST.
- Se a chave repetir: **pular o POST**, logar `[idempotency] create duplicado ignorado`, e **não** empurrar segunda
  mensagem de sucesso.
- Complemento barato no mesmo patch: recusar create cujo `date_time + duration` caia fora de `isSalonOpen()`
  daquele dia, devolvendo mensagem de "esse horário não fecha dentro do expediente" (guarda dura de K1).

Precedente do projeto irmão: `[OUTBOUND-IDEMPOTENCY]` com janela de 4 min
(`aprendizados-flora-maria-1741-2026-08-10.md`, fix S4). Aqui a janela natural é a conversa + o registro local.

### 6.3 — Nota operacional: reservas órfãs da noite de teste

**Não executado — é ação humana no painel Trinks.** A conversa deixou reservas provavelmente indevidas na
sexta 21/08:

| bookingId | Origem | Situação provável |
|---|---|---|
| 521402496, 521402506 | turno 8 (André, 19:30) | órfãs — cliente migrou para Erick |
| 521402552, 521402553 | turno 9 (duplicata do 8) | duplicadas **e** órfãs |
| 521403349 | turno 14 (Erick 19:30) | dentro/na borda do expediente |
| 521403350 | turno 14 (Jackie mechas 20:30–23:40) | **fora do expediente** |
| 521403351 | turno 14 (Erick 23:40–01:10) | **fora do expediente**, vira madrugada de sábado |

Sugestão: Gabriel cancela as 4 primeiras (teste, duplicadas/órfãs) e decide as duas fora do expediente.
A 521403349 pode ficar se a sexta às 19:30 for aceitável na prática — o que é, em si, a questão da §7 opção 4.

### 6.4 — Como validar (mesmo smoke, rubrica da §4)

Repetir a **mesma** conversa de 14 turnos após P1+P2+P3+trip-wire+idempotência. Critério de sucesso desta fatia:
**K1, K2, K3 e K5 limpas**. K4/K6/K7/K8 devem melhorar mas podem exigir uma segunda passada — são regras de redação,
mais sensíveis a variação estocástica (lição `9.4`: single-run não decide traço de estilo).

---

## 7. Questão de produto — dois profissionais no mesmo horário de início

**Não decido isto.** Vasculhei `docs/` e `.aiox-core/`: **não existe artefato** que defina se o Studio Tirrá aceita
dois profissionais atendendo o mesmo cliente simultaneamente (ex.: mechas com a Jackie enquanto o Erick faz o corte).
O que existe é o oposto, e apenas para o formato da reserva: I.6 manda `HANDOFF_HUMAN` para *"agendamento com mais de
1 profissional na mesma reserva"* — o que trata da **reserva**, não da **operação de salão**.

O cliente pediu isso explicitamente no turno 12 (*"Pode deixar tudo no mesmo horário"*) e o bot não soube responder
(F5). Enquanto não houver decisão, esse turno vai continuar produzindo comportamento aleatório.

**Opções (para Victor/Gabriel decidirem, não para o bot inferir):**

1. **Não existe atendimento paralelo.** O bot explica que os serviços são sequenciais e oferece a mini-agenda ou outro
   dia. Menor custo, zero código, resposta previsível. Perde-se um pedido legítimo de cliente com pressa.
2. **Existe, mas o bot não marca — escala.** O bot reconhece o pedido, explica que combinações simultâneas são montadas
   pelo Gabriel, e emite `[HANDOFF_HUMAN motivo=agenda_paralela]`. Custo baixíssimo, preserva a venda, transfere o
   julgamento operacional para quem tem contexto de cadeira/lavatório.
3. **Existe e o bot marca**, criando reservas com o **mesmo** `dataHoraInicio` para profissionais diferentes.
   Exige: (a) confirmar com a Trinks que dupla-reserva do mesmo cliente no mesmo horário é aceita; (b) regra de quais
   pares de serviço são fisicamente compatíveis (corte + mechas provavelmente **não** são — mesma cabeça);
   (c) ajuste no laço de creates. Maior custo, maior risco de reserva inexecutável.
4. **Existe só para pares pré-aprovados** (ex.: unha + cabelo — mãos livres vs cabeça), lista curta mantida no snapshot
   ou numa KB. Qualquer par fora da lista cai na opção 2. Compromisso razoável, mas exige alguém manter a lista.

**Leitura do analista (não é decisão):** a opção 2 resolve o buraco desta noite com uma linha de prompt e nenhuma
mudança de código, e não fecha a porta para 3 ou 4 depois. A opção 4 é a única que atende o pedido literal do cliente
sem risco de marcar algo impossível — mas só faz sentido se houver volume real desse pedido.

**Uma segunda pendência de produto já registrada** (não reabrir aqui, só lembrar que continua aberta):
`ajustes-autorizados-2026-08-17.md` §2 deixou em aberto o que responder a "corte feminino com o Tiago"
(R$250 do SKU dele vs R$190 da tabela) e sinalizou a Jackie habilitada em Corte Feminino como **flag de catálogo a
conferir no Trinks**. A mechas da Jackie no turno 11 veio desse mesmo cadastro — o valor R$880/330min não foi
inventado pelo bot, veio do snapshot.

---

## Apêndice — o que NÃO foi feito nesta análise

- Nenhum arquivo do `ecoadventure-sdr-wpp` foi modificado (leitura apenas).
- Nenhum booking foi cancelado, criado ou alterado na Trinks.
- Nenhum commit, deploy, `BOT_ACCEPT_ALL` ou mexida em Meta/WABA.
- Nenhuma regra de produto nova foi criada; onde faltou decisão, virou §7.
- Não reli os logs brutos da Kapso: as citações da conversa vêm do dossiê de evidência entregue com a tarefa;
  as citações de prompt e de código vêm dos arquivos, com linha.

### Confiança

| Afirmação | Confiança | Base |
|---|---|---|
| Falta de idempotência no `BOOKING_CREATE` | **Alta** | código lido (`server.js:1163`, `booking-parser.js:67`) |
| "Te esperamos" emitido fora do horário | **Alta** | código lido (`server.js:1194` sem checagem de `isSalonOpen`) |
| Contradição "premium" ROLE × NUNCA | **Alta** | prompt lido (linhas 12 e 160) |
| Ausência de regra de expediente/grade derivada | **Alta** | prompt lido integralmente |
| Ausência de regra anti-markdown no prompt | **Alta** | prompt lido integralmente |
| Horários exatos e bookingIds da conversa | **Média-alta** | dossiê de evidência, não reverificado no banco |
| Atribuição das 4 reservas órfãs a André | **Média** | inferida da sequência de turnos 8→9→11→14 |
| "Atendimento paralelo não está em nenhum artefato" | **Alta** | busca em `docs/` sem resultado pertinente |
