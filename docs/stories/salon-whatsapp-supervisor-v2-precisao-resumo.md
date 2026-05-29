# Story: Supervisor v2 — Precisão do Resumo Matinal (híbrido + pré-filtro + custo)

**Tipo:** Brownfield improvement (bot WhatsApp Studio Tirra — não pertence ao Epic Admin Dashboard)
**Status:** InProgress — ✅ **Camada 1 ENTREGUE e VALIDADA EM PROD (smoke AC11 verde, 2026-05-29): filtro Kapso cortou 66% (131→44), join 130/131, janela coberta. AC2/AC4/AC5/AC10/AC11 done.** Aguardando merge em main. ⏳ **Camada 2** (input enriquecido + prompt 46590 + render híbrido "fura-fila") segue bloqueada na Fase 0 (Victor colar o prompt do 46590). AC9 (precisão fina) é majoritariamente Camada 2.
**Agente executor:** @dev (suporte opcional @analyst no prompt; quality gate @architect)
**Story Points:** 8
**Branch sugerida:** `feature/supervisor-v2-precisao-resumo`
**Pode executar agora:** 🟢 **Camada 1 (pré-filtro) LIBERADA** — rota de fetch Kapso decidida (@architect: Rota A, pull no digest — ver Dev Notes) e re-validada pelo @po. Pronta para `@dev *develop`. **Camada 2 (prompt do agente 46590)** continua dependendo de obter o prompt atual (Fase 0 — Victor cola ou dá acesso ao TESS).
**Source-of-truth técnico:**
- [backend/supervisor.js](../../backend/supervisor.js) — `runMorningTriage()` (:181), `fetchRecentConversations()` (:52), `classifyConversation()` (:77), `scoreFromVerdict()` (:114), `renderDigest()` (:132), `clientSpokeLast()` (:156 — **será reimplementado contra fonte Kapso**), `mapWithConcurrency()` (:164 — mantém)
- **API Kapso (fonte do last-speaker):** `GET {KAPSO_API_BASE}/meta/whatsapp/{KAPSO_API_VERSION}/{phone_number_id}/messages` — auth header `X-API-Key`, `KAPSO_API_BASE`/`KAPSO_API_KEY`/`KAPSO_API_VERSION` já em [server.js:1119-1121](../../backend/server.js). Cada msg tem `kapso.direction` (`inbound`=cliente / `outbound`=bot **ou** salão manual) + `whatsapp_conversation_id` + timestamp + `contact_name`. `phone_number_id` de produção = `1016003164939443`. Padrão de chamada já existe em `sendKapsoSingle()` (server.js:1182).
- Webhook Kapso ([server.js:1260](../../backend/server.js)) — **já recebe** os eventos `outbound` (inclusive resposta manual do salão, :1288-1295) mas os **descarta** (não persiste). Relevante pra rota B do @architect.
- Agente TESS **46590** "Studio Tirra - Supervisor" (prompt vive no dashboard TESS — **não exposto pela API** `get_agent`)
- [backend/server.js:1600](../../backend/server.js) — `POST /admin/trigger-supervisor?dryRun=1` + `GET /admin/last-digest` (usar pra testar sem esperar 7h)
- `conversation_history` (**fonte do CONTEÚDO**, não do last-speaker — é bot-only: role `user`=cliente, `assistant`=bot; `agent`=`passive`/`human`). Continua sendo a origem das 12 msgs enviadas ao TESS.
- `trinks_appointments` (entregue na Story 1.6 — `client_phone` normalizado com 55, `status`, `scheduled_at`)
- `clients` (`phone`, `name`, `last_service`, `last_visit`, `visit_count`)
- **Feedback real do Gabriel** (transcrição de áudio, 2026-05-29) — inline em Contexto

## Contexto

O **supervisor matinal** (`backend/supervisor.js`, agente TESS 46590) roda 7h (ter-sáb), classifica as conversas das últimas ~24h (62h na terça) **uma a uma via TESS**, ranqueia e manda um resumo no WhatsApp pro Tiago + Gabriel (destinatários extras adicionados nesta sessão via `SUPERVISOR_EXTRA_PHONES`).

**Feedback real do Gabriel (supervisor de turno) sobre o resumo que recebeu:**
> "Ele mandou dez. Dessas dez, só duas de fato eram relevantes. E dessas duas eu já ia responder de manhã [na minha ordem de chegada]. Uma respondeu 7h da noite, então na ordem eu já ia responder. A outra era cliente querendo marcar corte novo com o Érick. O restante era tudo cliente que eu já tinha respondido ou já tinha agendado — já fechado 100%, não teria nem que dar atenção. (...) gasta um tempo dando atenção e tira a preferência de quem mandou mensagem antes, que é o que eu faço. (...) as outras já tinham confirmado, e outras são clientes que não me responderam — ficou aberto, mas porque eu não consegui confirmar 100%. (...) esses que não me respondem eu dou prioridade pra quem respondeu, e depois volto pros abertos e mando 'posso continuar seu atendimento?'. (...) é um tempo precioso esse do começo do dia; se eu parar pra ver conversa concluída, me atrapalha."

**Precisão atual: 2/10.** Os 8 falsos positivos caem em 2 baldes:
1. **Já resolvidas** — salão já respondeu ou já agendou (fechado 100%).
2. **Cliente sumiu** — conversa "aberta" porque o cliente parou de responder. É o backlog de follow-up do Gabriel, que ele trata do jeito dele (re-pinga depois) — não é urgência.

**Intent do produto (Victor, decisão-chave):** o resumo **NÃO substitui** o método do Gabriel (ordem de chegada / FIFO). Ele **continua** com o método dele. O resumo é um **upgrade híbrido**: deve **puxar pra frente da fila** as poucas mensagens que genuinamente merecem furar o FIFO (urgência/importância real). O Gabriel atende essas primeiro e **depois segue o FIFO normal**.

## Causa raiz (técnica)

O supervisor classifica **cada conversa isoladamente** (1 chamada TESS por conversa, sem estado cruzado) e **não usa os sinais que separam o joio do trigo**:
1. **Quem falou por último** — se o **salão** (bot OU recepção/Gabriel respondendo manual) falou por último → já tratado ou é vez do cliente (silêncio ≠ urgência). Se o **cliente** falou por último → está **aguardando resposta** = acionável. O agente tem as mensagens mas não pesa isso.
2. **Status de agendamento** — o agente não sabe se o cliente **já tem agendamento** (resolvido). A tabela `trinks_appointments` (Story 1.6) agora permite cruzar isso.

**🔴 Furo descoberto no smoke (2026-05-29) e por que pivotamos pra Kapso:** a 1ª implementação derivou "quem falou por último" de `conversation_history` — e **ela é cega pro salão**. A tabela só registra o **bot** (`assistant`/`passive`); as **respostas manuais do Gabriel no WhatsApp NÃO são logadas** lá. Resultado: pra `conversation_history` o cliente *sempre* parece ter falado por último → filtro removeu **0 de 127** conversas (no-op). **A API Kapso TEM esse dado** (`kapso.direction` distingue inbound/outbound, e captura o outbound manual do salão — confirmado em prod, 28 in / 22 out na amostra). Victor confirmou (2026-05-29) que **todas** as respostas do salão passam pela Kapso → o `direction=outbound` é fonte-de-verdade confiável pro last-speaker.

**Efeito colateral grave observado nesta sessão:** com 24h de lookback = **131 conversas** → 131 chamadas TESS sequenciais → o dry-run **travou (>10 min sem concluir)** + custo de ~131 créditos TESS por execução. O pré-filtro resolve precisão **e** custo **e** travamento de uma vez (o AC5/pool já está implementado e funcionando — só o AC2 muda de fonte).

## Esta story entrega — abordagem em 2 camadas

**Camada 1 — Pré-filtro no código (`supervisor.js`), ANTES de chamar o TESS:**
- Filtro duro: considera só conversas onde o **cliente falou por último** (aguardando salão), determinado pela **fonte Kapso** (`kapso.direction`) — NÃO mais por `conversation_history` (que é cega pro salão). Isso sozinho cobre os 3 baldes de falso-positivo do Gabriel.
- **Híbrido (não arrancar a tabela):** a Kapso é o sinal de **filtro** (last-speaker). O `conversation_history` continua sendo a fonte do **conteúdo** (as 12 msgs que vão pro TESS em `classifyConversation`). Join por telefone normalizado (dígitos; reusar normalização 55 da Story 1.6).
- Status de agendamento (`trinks_appointments`) é **sinal pro agente**, NÃO exclusão (evita falso-negativo — ver AC3).
- Resultado: ~131 → dezenas de conversas → ~muito menos chamadas TESS + sem travamento.
- **Decisão de arquitetura pendente (@architect):** *como* obter o `direction` da Kapso — rota A (pull no digest) vs rota B (persistir outbound no webhook). Detalhe e tradeoffs nas Dev Notes. O AC2 abaixo fixa **fonte + resultado**, não o mecanismo.

**Camada 2 — Input enriquecido + prompt do agente 46590 (no TESS):**
- Passar ao agente: quem falou por último, se tem agendamento, horário da última msg do cliente.
- Prompt reescrito pro critério "fura-fila" + saída no formato híbrido (respeita o FIFO do Gabriel).

## Escopo

### IN
- Pré-filtro por "cliente falou por último" via **fonte Kapso** (`kapso.direction`) (Camada 1).
- Robustez: concorrência limitada + budget/timeout no ciclo (mata o travamento) — **já entregue (AC5), mantém**.
- Input enriquecido (last-speaker, booking status, horário última msg cliente).
- Rework do prompt 46590 (critério de urgência + formato híbrido de saída).
- Logging de métricas do ciclo (conversas totais → filtradas → enviadas ao TESS → sinalizadas).
- Validação de precisão + custo (dryRun via `/admin/trigger-supervisor`).

### OUT
- **UI de gestão de destinatários** do resumo (adiada — story separada, decisão Victor 2026-05-29).
- Templates / janela 24h / pagamento WhatsApp.
- Supervisão real-time por-mensagem (esta story é só o **resumo matinal**).
- Re-treino/fine-tuning de modelo (é prompt + filtro, não modelo).

## Acceptance Criteria

### Fase 0 — Prereq do prompt (bloqueia só a Camada 2)
- [ ] **AC1:** Obter o **prompt atual do agente 46590** (Victor cola o texto OU dá acesso ao TESS). A `get_agent` da API só devolve metadados — o prompt não vem por lá. **Camada 1 NÃO depende disto** e pode ser feita antes.

### Camada 1 — Pré-filtro (código, `supervisor.js`)
- [x] **AC2 (reescrito — fonte Kapso, não `conversation_history`):** Em `runMorningTriage`, antes de classificar, manter **só conversas onde o cliente falou por último**, determinado pela **fonte de last-speaker da Kapso** (`kapso.direction`):
  - **Fonte (decisão Victor):** o last-speaker vem do `direction` da Kapso — `inbound`=cliente, `outbound`=salão (bot cloud_api **OU** resposta manual da recepção). É a única fonte que enxerga o outbound manual do salão (o `conversation_history` é bot-only e por isso falhou — ver Causa raiz).
  - **Resultado (testável):** **excluir** toda conversa cuja **última mensagem é `outbound`** (já respondida pelo salão / vez do cliente); **manter** só as com última mensagem `inbound` (cliente aguardando). Os 8 falsos-positivos do feedback do Gabriel **devem cair fora**; as 2 boas **devem permanecer**.
  - **Mecanismo:** NÃO fixado aqui — rota A (pull no digest) vs rota B (persistir outbound no webhook) é decisão do @architect (Dev Notes). O `clientSpokeLast()` atual (derivado de `conversation_history`) **será substituído** pela derivação via Kapso.
- [ ] **AC3 (revisado pela PO — booking é SINAL, não exclusão dura):** **NÃO** excluir por agendamento. O único filtro duro de Camada 1 é o AC2 (cliente falou por último) — ele já cobre os 3 baldes de falso-positivo do Gabriel sem risco de falso-negativo. O **status de agendamento** é **computado e passado como SINAL** ao agente (ver AC6: `TEM_AGENDAMENTO`), porque um cliente *com* agendamento que manda msg nova (remarcar/reclamar/2º serviço — ex. "corte novo com Érick") **é acionável**, não resolvido. Match por telefone normalizado (dígitos; reusar normalização 55 da 1.6 — `conversation_history.client_phone` 13 díg c/ 55; `trinks_appointments.client_phone` já normalizado).
- [x] **AC4:** Logar métricas do ciclo: `{total_conversas, apos_filtro_last_speaker, com_agendamento, enviadas_tess, sinalizadas}` (o last-speaker Kapso é o redutor duro; `com_agendamento` é só anotação/sinal). Meta: **≥50% de redução** nas chamadas TESS em volume típico (a amostra de prod tinha ~22/50 outbound; calibrar contra o dry-run real do AC11). O log deve provar a redução em dados reais (antes vs depois). **Implementado e ESTENDIDO** (`supervisor.js` runMorningTriage): o funil agora é um JSON com contadores de estágio que distinguem os **3 disfarces do no-op** — `kapso_indisponivel` (filtro bypassed), `kapso_msgs_fetched`/`distinct_phones_in_map`/`conversations_matched_in_map` (join quebrado = `matched=0` lê diferente de "tudo aguardando"), `excluded_outbound`, `page_cap_hit`, `apos_filtro_last_speaker`, `classificadas`, `sinalizadas`. A meta de redução só é comprovável no AC11 (prod).
- [x] **AC5:** **Robustez (mata o travamento):** classificações TESS rodam com **concorrência limitada** (pool=4) ; cada chamada tem `AbortSignal.timeout(60s)` — falha/timeout não trava o ciclo (loga, segue). **Validado no smoke:** dryRun com 131 conversas concluiu em **141s** (antes travava >10min), 0 erros de classificação.

### Camada 2 — Input + prompt (depende da Fase 0)
- [ ] **AC6:** Enriquecer o input de `classifyConversation` com: `QUEM_FALOU_POR_ULTIMO` (`cliente`|`salao`, derivado da fonte Kapso do AC2 — reusar, não recomputar), `TEM_AGENDAMENTO` (bool + status/quando se houver), `HORARIO_ULTIMA_MSG_CLIENTE` (pro Gabriel encaixar no FIFO).
- [ ] **AC7:** Prompt do 46590 reescrito — critério **"fura-fila"**: sinalizar **só** quando o cliente está **aguardando resposta E não resolvido E** há sinal real de urgência/importância (ex: pedido de novo agendamento, reclamação, tempo-sensível, cliente recorrente/VIP). **Excluir explicitamente**: já respondido, já agendado, cliente-sumiu.
- [ ] **AC8:** Saída reformulada pro **híbrido** (`renderDigest`): a mensagem deixa claro *"estes furam sua fila — atenda primeiro, depois siga sua ordem de chegada normal"*. Cada item: motivo curto + **horário de chegada** + ação sugerida. Curto e escaneável (tempo do Gabriel é precioso). Vazio → mensagem positiva ("nada fura a fila hoje, bom dia").

### Validação
- [ ] **AC9:** **Precisão (2 lados):** validar contra casos reais via dryRun + revisão manual:
  - **Falso-positivo:** as conversas sinalizadas são de fato "cliente aguardando + acionável" (idealmente reproduzir os casos do Gabriel: sinalizar as 2 boas, não as 8).
  - **Falso-negativo (guardrail):** revisar uma amostra das conversas **excluídas pelo filtro** e confirmar que nenhuma era urgência real. Edge case aceito p/ MVP: bot respondeu sem resolver (salão falou por último) → fica fora do destaque, mas o **FIFO do Gabriel pega** (alinhado ao que ele pediu: menos ruído).
- [x] **AC10:** **Custo:** log comprova a redução de chamadas TESS. **Smoke prod (2026-05-29):** 131 → 44 enviadas ao TESS = **66% de redução** (87 conversas com salão-falou-por-último excluídas). Acima da meta de ≥50%.
- [x] **AC11:** **Confiabilidade + prova-de-fonte (fecha o gap que deixou o no-op passar):** ✅ **SMOKE PROD VALIDADO (2026-05-29, @devops).** Funil real: `total=131, kapso_indisponivel=false, kapso_msgs_fetched=1200, kapso_msgs_with_ts=1198, conversations_matched_in_map=130 (join OK!), excluded_outbound=87, termination=covered_window, window_fully_covered=true, page_cap_hit=false, apos_filtro=44, ms=140944`. **`filtradas=87 > 0` em dados REAIS** — a fonte Kapso carrega o sinal (≠ v1 `127→0`). Concluiu sem travar. ⚠️ Histórico: 3 bugs só pegáveis em prod foram corrigidos no caminho (join `kapso.phone_number`, cursor `paging.next`, `limit≤100`) — unit mockado não os pegaria. Ver Change Log v1.8/v1.9.

## 🤖 CodeRabbit Integration

### Story Type Analysis
- **Primary Type:** Integration (TESS) + Backend/logic (pré-filtro, robustez)
- **Secondary:** Prompt engineering (agente 46590)
- **Complexity:** Medium — lógica de filtro + join com Trinks + robustez de concorrência + prompt.

### Specialized Agent Assignment
- **Primary:** @dev (pré-filtro, input, robustez, render). @analyst opcional no prompt.
- **Supporting:** @architect (aprova desenho de concorrência/budget + critério de "resolvido"); @devops (deploy backend — **lembrar restart nginx após recreate**).

### Quality Gate Tasks
- [ ] Pre-Commit (@dev): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (@devops)
- [ ] Pre-Deployment (@devops): rebuild `backend` + **restart nginx**

### Self-Healing Configuration
- Primary Agent: @dev (light mode) · Max Iterations: 2 · CRITICAL → auto_fix · HIGH → document_only

### CodeRabbit Focus Areas
- **Primary:** robustez de concorrência (sem promise pendente eterna → o bug do travamento); join de telefone normalizado correto; filtro não derruba falsos-negativos (não esconder urgência real).
- **Secondary:** logging de métricas; nenhuma regressão no envio (recipients da v1 intactos); custo TESS.

## Tasks / Subtasks

- [ ] **Fase 0 (AC1)** — obter prompt atual do 46590 (Victor / TESS). Não bloqueia Camada 1.
- [ ] **Decisão de arquitetura (@architect)** — escolher rota A (pull Kapso no digest) vs rota B (persistir outbound no webhook) pro last-speaker; aprovar estratégia de fetch/agrupamento por `whatsapp_conversation_id` + cache. Ver Dev Notes "Rotas de fetch Kapso". **Bloqueia o re-dev da Camada 1.**
- [x] **Camada 1 — pré-filtro (AC2, AC4) — RE-DEV (fonte Kapso)** 🟢
  - [x] **Reimplementar** o last-speaker contra a **fonte Kapso** (`kapso.direction`) — substitui o `clientSpokeLast` derivado de `conversation_history` (no-op em prod) por `clientSpokeLastKapso` + `fetchKapsoLastSpeaker` + `buildLastSpeakerMap`. Híbrido mantido: `conversation_history` ainda fornece o conteúdo (12 msgs) pro TESS.
  - [x] Join Kapso↔conversa por telefone normalizado (reusa `normalizePhoneBR` de `lib/trinks-mapping.js`, dos dois lados).
  - [x] Atualizar o log de funil (AC4) p/ `apos_filtro_last_speaker` (+ contadores anti-no-op).
  - [x] Atualizar os testes (`backend/test/supervisor.test.js`) pra nova fonte (22 testes, fetch injetado). ⚠️ AC11: unit mockado NÃO comprova a fonte — exige smoke em prod (DIFERIDO).
  - [x] Concorrência limitada (`mapWithConcurrency`, pool=4) no lugar do loop sequencial (mata o travamento) — **AC5, já entregue, mantém**
  - [ ] Computar status de agendamento (`trinks_appointments`) como **sinal** → **na Camada 2** (só consumido pelo input do agente, AC6 — evita dead code)
- [ ] **Camada 2 — input + prompt (AC6-AC8)**
  - [ ] Enriquecer input do `classifyConversation`
  - [ ] Reescrever prompt 46590 (no TESS) + formato híbrido no `renderDigest`
- [ ] **Validação (AC9-AC11)** — dryRun, precisão vs casos do Gabriel, custo, confiabilidade
- [ ] Deploy (@devops): rebuild backend + **restart nginx** + dryRun de smoke

## Dev Notes

> Tudo abaixo veio de arquivos reais (citados). O prompt do 46590 é a única peça externa (Fase 0).

### Como o supervisor funciona hoje (`backend/supervisor.js`)
- `fetchRecentConversations(lookbackHours)` (:52) — agrupa `conversation_history` por `client_phone`, traz `messages` (array ordenado `{role, content, ts}`), `last_ts`, `msg_count`. ⚠️ **O último elemento NÃO é fonte confiável de last-speaker** (tabela bot-only — ver acima). Continua sendo a fonte do **conteúdo** (12 msgs pro TESS). O last-speaker vem da Kapso.
- `classifyConversation({phone, client, messages})` (:77) — manda as **últimas 12 msgs** + `DADOS_CLIENTE` ao TESS 46590; espera JSON `{priority_score, severity, categoria, decision: escalate|monitor, reason_for_human, suggested_action}`. `AbortSignal.timeout(60s)` por chamada.
- `runMorningTriage` (:154) — loop **sequencial** sobre todas as conversas (← origem do travamento com 131). `renderDigest` (:132) monta a msg. Envio pra `recipients` (Tiago + `SUPERVISOR_EXTRA_PHONES`).
- Categorias já existentes no scoring (:114): `reclamacao, pedido_humano, conflito_agenda, qualidade_ruim, silencio_meio_conversa, falso_positivo`. Note que `silencio_meio_conversa` é exatamente o balde "cliente sumiu" que o Gabriel quer **fora** do destaque.

### ⚠️ `conversation_history` é CEGO pro salão (por que o AC2 v1 falhou)
- A tabela só registra o **bot** (`role='user'`=cliente, `role='assistant'`=bot, `agent='passive'`/`'human'`). As **respostas manuais do Gabriel/recepção pelo WhatsApp NÃO entram aqui** — o webhook recebe esses outbound (`server.js:1295`) mas os descarta.
- Logo **NÃO dá pra inferir "salão falou por último" do `conversation_history`** — pra ele o cliente quase sempre é o último (smoke: `127 → filtradas 0`).
- O `conversation_history` **continua útil como fonte do CONTEÚDO** (as 12 últimas msgs que `classifyConversation` manda ao TESS). Só o **last-speaker** muda de fonte → Kapso.

### 🔑 Fonte do last-speaker = API Kapso (`kapso.direction`)
- `inbound`=cliente, `outbound`=salão (bot cloud_api **ou** recepção manual). Confirmado em prod: amostra de 50 msgs = 28 in / 22 out → a Kapso **vê o outbound manual** que falta no `conversation_history`.
- Victor confirmou (2026-05-29): **todas** as respostas do salão passam pela Kapso → fonte confiável.
- ⚠️ **O `humanHandledUntil` (server.js:68) NÃO serve** como fonte: é um `Map` em memória, com TTL, volátil em restart — não é um log por-mensagem. Não usar.

### Rotas de fetch Kapso (DECISÃO @architect — AC2 fixa fonte+resultado, não mecanismo)
| | **Rota A — pull no digest** | **Rota B — persistir no webhook** |
|---|---|---|
| Como | `runMorningTriage` chama `GET .../{phone_number_id}/messages` às 7h e deriva last-speaker por conversa (agrupar por `whatsapp_conversation_id` + cache) | Trocar o descarte em `server.js:1295` por persistir o último outbound por telefone (coluna/tabela leve); às 7h o last-speaker vira query local |
| Retroatividade | ✅ Lê o histórico da Kapso (pega o que já existe) | ❌ Só dados a partir do deploy (sem backfill) |
| Custo/latência 7h | N chamadas HTTP à Kapso no run (paginar/cache) | ~0 no run (já gravado) |
| Risco ao caminho vivo | Baixo (read-only, fora do hot path do bot) | ⚠️ Mexe no webhook do bot em produção — testar com cuidado |
| Confiabilidade | Fonte-de-verdade Kapso direta | Depende de o webhook não perder evento |
| Recomendação SM (não-vinculante) | Boa pro MVP (retroativa, isola do bot) | Melhor a longo prazo (barata, real-time) — talvez híbrido: B grava + A faz backfill/reconciliação |

> **DECISÃO @architect (2026-05-29) — ROTA A (pull no digest). Read-only, retroativa, isolada do bot vivo.**
> Razão decisiva = **AC11 + dono ausente**: o AC11 exige provar `filtradas > 0` em dados REAIS de prod *nesta iteração*; a Rota A lê o histórico Kapso retroativamente → o dry-run valida no dia 1. A Rota B parte de tabela vazia no deploy (sem dado pra validar até o tráfego acumular) E mexe no webhook do bot vivo sem ninguém vigiando. A ganha nos dois eixos (segurança + validabilidade). B fica documentada como futuro (persistir-going-forward + A pra reconciliação), **não construir agora**.
>
> **Endpoint preferido = API NATIVA Kapso, NÃO o proxy Meta.** A skill `observe-whatsapp` (`scripts/messages.js`, `lookup-conversation.js`) revela dois endpoints muito melhores que o proxy `.../meta/.../messages` citado no AC2:
> - `GET /platform/v1/whatsapp/messages?phone_number=<e164>&direction=&phone_number_id=&conversation_id=&limit=&after=&before=` — auth `X-API-Key`. **Aceita filtro por `phone_number` e cursor (`after`/`before`)** → resolve o join (ver abaixo).
> - `GET /platform/v1/whatsapp/conversations?phone_number=&phone_number_id=&status=active|ended` — mapeia `phone_number ↔ conversation_id ↔ phone_number_id` (bridge se precisar).
> ⚠️ **A base difere do que está em `server.js`:** a skill usa `KAPSO_API_BASE_URL` (host da API nativa Kapso); o `server.js:1119` usa `KAPSO_API_BASE` (`https://api.kapso.ai`, base do proxy Meta). **@dev: confirmar qual host responde `/platform/v1/...` em prod** (provavelmente o mesmo `api.kapso.ai` — o proxy Meta e a REST nativa coexistem). Reusar `KAPSO_API_KEY` (mesma chave). Se as bases divergirem, adicionar `KAPSO_API_BASE_URL` ao `.env` do VPS.
>
> **Desenho concreto (Camada 1 — `runMorningTriage`):**
> 1. `fetchRecentConversations(lookback)` continua sendo a fonte das conversas + conteúdo (12 msgs pro TESS). Híbrido intacto.
> 2. **Nova fn `fetchKapsoLastSpeaker(lookbackHours, phoneNumberId)`:** 1 pull paginado (cursor `after`) do endpoint `/platform/v1/whatsapp/messages?phone_number_id=<id>&limit=<máx>`, percorrendo **toda** a janela (62h ter / 24h demais) — NÃO 1 chamada por conversa (endpoint é account-level). Agrupa client-side por telefone normalizado, guarda o `direction` da msg de **maior timestamp** por telefone num `Map<phoneNorm, 'inbound'|'outbound'>` (esse Map É o "cache" — per-run, sem TTL/Redis; roda 1x/dia, 1 consumidor).
> 3. **Substituir `clientSpokeLast(conv)`** (hoje lê `conversation_history`, no-op) por consulta a esse Map: `lastSpeakerMap.get(normalizePhoneBR(conv.client_phone)) === 'inbound'`.
> 4. **`phone_number_id` PIN:** o cron pega de `lastKnownKapsoPhoneNumberId` (server.js:1110), cache em memória refrescado só em inbound → frio após restart pré-7h sem inbound noturno → fetch não roda → **filtro morre todo dia** (= reincidência do no-op do AC11, invisível a unit mockado). **Usar `lastKnownKapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID || '1016003164939443'`** (adicionar `KAPSO_PHONE_NUMBER_ID` ao `.env` do VPS).
>
> **Join de telefone (resolve o ponto crítico do AC2):** o payload de message Kapso carrega telefone do **contato** (não confundir: em `outbound`, `from`=número do salão, `to`=cliente — derivar o cliente sempre do lado do contato, nunca de `from` cego). Normalizar os dois lados com `normalizePhoneBR` da Story 1.6 (`backend/lib/trinks-mapping.js:34` — prefixa 55, valida 12-13 díg). `conversation_history.client_phone` = 13 díg c/ 55. Se o payload da Kapso não trouxer telefone confiável por mensagem, usar a alternativa: filtrar `/platform/v1/whatsapp/messages?phone_number=<e164>&limit=1&direction=` por conversa (mais chamadas, só se a bulk não carregar o telefone) OU mapear via `/conversations` (conversation_id→phone_number). **@dev valida na Fase de implementação qual campo de telefone a `messages` retorna** (probe read-only).
>
> **Degradação graciosa = FAIL-OPEN, logado distintamente.** Falha da Kapso (timeout/5xx/`phone_number_id` ausente/sem dado) → **pular o filtro e classificar TODAS as conversas** (não derrubar o digest). Seguro só porque o AC5 (pool=4 + budget) limita o estouro — não trava. **Crítico:** o log do funil (AC4) DEVE distinguir `kapso_indisponivel=true → filtro bypassed` de `filtro rodou → manteve N` — conflar os dois é exatamente como o no-op da v1 ficou invisível. Por-conversa: se um telefone não casa no Map (variância do 9º dígito BR etc.), **manter a conversa** (fail-open por item), nunca dropar.

### Join com Trinks (SINAL, não filtro) — reusar normalização da 1.6
`conversation_history.client_phone` = 13 díg com 55. `trinks_appointments.client_phone` já vem normalizado (worker 1.6 prefixa 55). Match por `regexp_replace(phone,'\D','','g')` dos 2 lados (mesmo padrão de `lib/metrics.ts` taxa de sucesso). **Decisão PO:** booking NÃO exclui a conversa (cliente com agendamento que manda msg nova é acionável) — é passado ao agente como `TEM_AGENDAMENTO` (AC6) pra ele pesar. O único filtro duro é "cliente falou por último" (AC2).

### ✅ Payload REAL da API Kapso (probado em prod read-only por @devops 2026-05-29)
`GET https://api.kapso.ai/platform/v1/whatsapp/messages?phone_number_id=1016003164939443&limit=N[&after=CURSOR][&direction=]` (auth `X-API-Key`) → `200 {data:[...], paging:{...}}`. Cada msg em `data[]`:
```
{ id, from, timestamp (epoch SEGUNDOS), type, text:{body},
  kapso: { direction:'inbound'|'outbound', phone_number, whatsapp_conversation_id, contact_name, origin, status, ... } }
```
- **`kapso.phone_number` = telefone do CLIENTE nas DUAS direções** (inbound: `from`=cliente=`kapso.phone_number`; outbound: `from`=número do salão FIXO `5511948319426`, `kapso.phone_number`=cliente). → **é a chave de join** (não `from`, não `to` — `to` nem existe no payload).
- **`origin='business_app'` nos outbound = resposta MANUAL da recepção** — exatamente o dado que o `conversation_history` (bot-only) não enxerga. Confirmado: amostra real com 5 outbound `business_app` pra clientes distintos.
- **Paginação keyset DESC:** cursor em `paging.next` (= `paging.cursors.after`); passar como `?after=`. Probe de 2 páginas confirmou: pág. 2 mais antiga que pág. 1 e IDs disjuntos (avança de verdade, não loopa).

### Robustez / o travamento
O dry-run de hoje processou 131 conversas sequenciais e **não concluiu em 10+ min** (sem log de erro). Cada fetch tem timeout 60s, mas 131 sequenciais somam demais e um call lento segura tudo. **Pré-filtro (Camada 1) é o fix primário** (reduz o volume). Adicionalmente: pool de concorrência (3-5) + budget total de ciclo (ex: aborta o ciclo após N min, envia o que tiver). NÃO deixar promise pendente sem teto.

### Testar sem esperar 7h
`POST /admin/trigger-supervisor?dryRun=1` (header `X-Admin-Token: $ADMIN_TOKEN`) roda em background → `GET /admin/last-digest` devolve `{digest_text, ranked, lookback_hours}`. Em dryRun **não envia** WhatsApp. (Ambos exigem `ADMIN_TOKEN`, que está setado no VPS.)

### Já entregue nesta sessão (não refazer)
`SUPERVISOR_EXTRA_PHONES` (CSV de destinatários extras do resumo) já está no `supervisor.js` (:22, :191) e em prod (Gabriel `5518998240447` configurado). Esta story **não mexe** em destinatários — só na **seleção/qualidade** do conteúdo.

### O que NÃO fazer
- Não substituir o FIFO do Gabriel — **complementar** (puxar pra frente só o que fura a fila).
- Não esconder urgência real por excesso de filtro (cuidado com falso-negativo — validar AC9).
- Não construir a UI de destinatários (story separada).

### Testing
- **Backend:** `node:test` em `backend/test/` — cobrir: derivação de last-speaker pela **fonte Kapso** (última msg `outbound` → exclui; `inbound` → mantém), join Kapso↔conversa por telefone normalizado, e que o filtro não derruba um caso "cliente aguardando". Mockar a chamada Kapso + `db.query` + `fetch` TESS.
- ⚠️ **Unit mockado é necessário mas NÃO suficiente (lição do no-op):** o ciclo anterior passou 44/44 e o filtro era morto em prod. **AC11 exige smoke em prod com `filtradas > 0` em dados reais** — só isso comprova que a fonte carrega o sinal.
- **Integração/smoke:** dryRun real no VPS (AC9-AC11) — conclui, `filtradas > 0`, precisão vs casos do Gabriel, log de custo.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-29 | 1.9 | **@devops: ✅ SMOKE AC11 VERDE em prod + 3º bug (limit) corrigido.** Deploy da branch no VPS (sem merge em main). 1º dryRun: `400 Invalid limit parameter` → fail-open bypassou (digest intacto). Causa: `KAPSO_PAGE_LIMIT=200` > máx da API (100, probado). Fix `200→100` + guard test. 2º dryRun (após redeploy) **PASSOU**: funil real `total=131, matched_in_map=130, excluded_outbound=87 (66% corte), termination=covered_window, window_fully_covered=true, page_cap_hit=false, apos_filtro=44, ms=140944, 0 erros`. **AC2/AC4/AC5/AC10/AC11 satisfeitos com dados REAIS.** A fonte Kapso carrega o sinal (≠ v1 `127→0`). Camada 1 entregue e validada. Próximo: merge em main + restaurar VPS→main. Camada 2 segue bloqueada na Fase 0 (prompt 46590). | @devops Gage |
| 2026-05-29 | 1.8 | **@devops: probe pré-deploy em prod pegou 2 bugs no re-dev autônomo (que o @dev não tinha como saber sem a key) + corrigiu.** Antes de deployar, probei a API Kapso read-only do VPS (com a `KAPSO_API_KEY` real). **Bug 1 (join, crítico):** `extractContactPhone` não lia `kapso.phone_number` (campo REAL do telefone do cliente) e o fallback outbound usava `msg.to`, que **não existe** no payload → toda msg outbound virava `null` → descartada → no-op parcial (salão-respondeu não excluído). Fix: `kapso.phone_number` candidato primário (estável nas 2 direções). **Bug 2 (paginação):** cursor lido de `meta.next_cursor`, mas o real é `paging.next` → parava na página 1 → truncava a janela. Fix: ler `paging.next`/`paging.cursors.after`; probe de 2 páginas confirmou DESC (avança p/ mais antigas, disjuntas). **Fix 3 (advisor):** truncamento barulhento — funil ganhou `termination` + `window_fully_covered`. **Fix 4:** mocks reescritos pro shape REAL (`kapso.phone_number`, `timestamp` unix, `paging.next`) — antes verdes mentindo. **62/62 pass.** Payload real documentado nas Dev Notes. RISCO #1 do @dev RESOLVIDO. Próximo: deploy da branch no VPS (sem merge em main até o smoke) + dryRun AC11. | @devops Gage |
| 2026-05-29 | 1.7 | **@dev: Camada 1 re-dev (rota A) — last-speaker via API Kapso (`kapso.direction`) substitui o no-op `conversation_history`; pull paginado account-level + Map per-run, join `normalizePhoneBR`, fail-open distinto, funil anti-no-op (22 testes, backend 59/59) — branch local `feature/supervisor-v2-precisao-resumo`, sem push.** | @dev Dex |
| 2026-05-29 | 1.6 | **@po: re-validada GO 9/10 — AC2 testável com fonte Kapso (excluir última-msg-outbound / manter inbound), AC11 bem-posto (`filtradas>0` em prod, unit mockado não satisfaz) é a salvaguarda que pega o no-op, e No-Invention limpo: refs do @architect (`/platform/v1/whatsapp/messages` e `/conversations`, `KAPSO_API_BASE_URL`) conferidas na skill `observe-whatsapp`; AC2/AC5 do código real.** Liberada para re-dev da Camada 1. | @po Pax |
| 2026-05-29 | 1.5 | **@architect: rota A escolhida (pull Kapso no digest) — read-only, retroativa e isolada do bot vivo, e a ÚNICA que valida `filtradas > 0` em prod já no dry-run (AC11) com o dono ausente.** Desenho detalhado nas Dev Notes ("DECISÃO @architect" abaixo da tabela de rotas): endpoint nativo `GET /platform/v1/whatsapp/messages` (filtra por `phone_number`/`phone_number_id`, cursor `after`/`before` — descoberto na skill `observe-whatsapp`, melhor que o proxy Meta); 1 pull paginado por run agrupado por telefone normalizado → Map per-run de last-speaker; `phone_number_id` pinado via env (evita no-op por cache frio pós-restart); join com `normalizePhoneBR` (Story 1.6); fail-OPEN logado distintamente (Kapso indisponível ≠ filtro vazio). Rota B fica como futuro (não construir). Não altera ACs (é do @po). Próximo: `@dev *develop` (re-dev Camada 1). | @architect Aria |
| 2026-05-29 | 1.4 | **@sm: story reescrita — AC2 fonte = Kapso (após Victor confirmar que TODAS as respostas do salão passam pela Kapso).** (1) **AC2 reescrito em fonte+resultado, não mecanismo:** last-speaker vem de `kapso.direction` (inbound/outbound); resultado testável = excluir conversas com última msg `outbound`. (2) **Híbrido explícito** pra @dev não arrancar a tabela: Kapso = filtro (last-speaker), `conversation_history` = conteúdo (12 msgs pro TESS), join por telefone normalizado. (3) **Gap de validação fechado:** AC11 agora exige dry-run em prod com `filtradas > 0` em dados REAIS (unit mockado passou 44/44 e mesmo assim shippou no-op — não repetir). (4) **Decisão @architect adicionada:** rota A (pull no digest) vs rota B (persistir outbound no webhook) com tabela de tradeoffs nas Dev Notes — bloqueia o re-dev. (5) **AC5/pool mantido [x]** (funciona); só o `clientSpokeLast` (AC2) reabre. AC3 (booking=sinal) preservado intacto. Descoberta nova documentada: o webhook (`server.js:1295`) já recebe os outbound e os descarta; `humanHandledUntil` é Map efêmero (não usar). **Próximo: `@po *validate-story-draft` (mudança material de fonte do AC2 exige re-validação) → `@architect` (escolher rota) → `@dev *develop` (re-dev Camada 1).** | @sm River |
| 2026-05-29 | 1.3 | **@devops: rota Kapso CONFIRMADA (resolve o furo do AC2 sem pivotar pra booking).** Probe read-only na API Kapso: `GET /meta/whatsapp/{ver}/{phone_number_id}/messages` (phone_number_id `1016003164939443`, auth `X-API-Key`) → 200, cada msg tem **`kapso.direction` (inbound/outbound)** + `whatsapp_conversation_id` + timestamp + `contact_name`. Amostra 50 msgs = 28 in / **22 out**. **A Kapso captura os envios (inclusive manuais do salão, que o `conversation_history` bot-only não tem)** → dá pra reconstruir "quem falou por último" de verdade. **NOVA ROTA (substitui o AC2 atual):** fonte do last-speaker passa a ser a **API Kapso**, não `conversation_history`. Booking volta a ser só sinal. Endpoints úteis: `/platform/v1/whatsapp/phone_numbers` (lista PNs), `.../messages` (proxy). **A confirmar com Victor:** todas as respostas do Gabriel passam pela Kapso (ele vê no painel → sim). Requer revisita @sm/@po (reescrever AC2 com fonte Kapso) + @architect (estratégia de fetch: bulk `messages` agrupado por `whatsapp_conversation_id` vs por-conversa + cache). | @devops Gage |
| 2026-05-29 | 1.2 | **@devops: smoke em prod revelou furo no AC2.** Deploy OK (backend rebuild + nginx), mas o dryRun mostrou `127 conversas; filtradas 0` — **o filtro "cliente falou por último" não remove nada**. Causa: `conversation_history` é **bot-only** + bot majoritariamente **passivo** (24h: `user/passive`=421 vs `assistant`=20); as respostas manuais do Gabriel no WhatsApp **não são logadas** → pra tabela o cliente sempre "falou por último". **Sinal de last-role é cego pro que o salão já tratou.** Dado descobre: **83/127 (65%) têm agendamento Trinks** → filtro por **booking** é o sinal viável (corta ~65%). AC5/pool funciona (bound de tempo, sem hang eterno) — fica. **PIVÔ necessário:** trocar o filtro duro de AC2 → agendamento (reabre tradeoff de falso-negativo que a PO levantou). Decisão com Victor + provável revisita @sm/@po/@architect. Deploy atual é inofensivo (no-op, sem regressão). | @devops Gage |
| 2026-05-29 | 1.1 | **@dev: Camada 1 implementada** (`backend/supervisor.js`). AC2 (`clientSpokeLast` — filtro "cliente falou por último"), AC5 (`mapWithConcurrency` pool=4 no lugar do loop sequencial — mata o travamento), AC4 (log do funil). 7 testes novos (`backend/test/supervisor.test.js`) + backend 44/44 + CodeRabbit 0 findings. Camada 2 (input+prompt 46590) segue bloqueada na Fase 0. Próximo: `@devops *push` (rebuild backend + restart nginx) → smoke dryRun em prod (AC9-11). | @dev Dex |
| 2026-05-29 | 1.0 | **Validada GO 9/10 → Ready (@po).** Anti-alucinação limpo (refs de `supervisor.js`, taxonomia `role`, join Trinks, endpoint dryRun conferidos no código). 1 Should-Fix P1 aplicado: **AC3 rebaixada** — booking vira SINAL pro agente, NÃO exclusão dura (evita falso-negativo: cliente com agendamento que manda msg nova, ex. "2º serviço com Érick", é acionável). Filtro duro = só AC2 (cliente falou por último), que já cobre os 3 baldes do Gabriel. AC9 ganhou guardrail de falso-negativo. Meta de custo ajustada (≥70%, vinda do `last_role`). Pronta para `@dev *develop` (começar pela Camada 1). Camada 2 aguarda prompt 46590 (Fase 0). | @po Pax |
| 2026-05-29 | 0.1 | Story draftada a partir do feedback real do Gabriel (precisão 2/10). Intent híbrido (Victor): resumo complementa o FIFO do Gabriel puxando pra frente só o que fura a fila. Abordagem 2 camadas: (1) pré-filtro no código (cliente-falou-por-último + exclui agendados via `trinks_appointments`) que resolve precisão + custo (~10x menos chamadas TESS) + o travamento de hoje; (2) input enriquecido + rework do prompt 46590 (precisa do prompt atual — Fase 0). Causa raiz: classificação isolada sem sinal de last-speaker nem booking status. OUT: UI de destinatários (adiada). Próximo: `@po *validate-story-draft`. | @sm River |

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (@dev Dex)

### Completion Notes List
**Camada 1 — RE-DEV CONCLUÍDO 🟢 (rota A — pull Kapso no digest)** (`backend/supervisor.js`)
- **AC2 (refeito, fonte Kapso):** o no-op `clientSpokeLast` (derivado de `conversation_history` bot-only → removia `0/127`) foi **substituído** por:
  - `fetchKapsoMessagesRaw({phoneNumberId, lookbackHours, fetchImpl})` — 1 pull paginado account-level do endpoint NATIVO `GET {base}/platform/v1/whatsapp/messages?phone_number_id=&limit=&after=`, cursor `after` defensivo (envelope `data[]`/`messages[]`/array; `meta.next_cursor`/`next_cursor`/`has_more`), para por janela coberta OU teto de páginas (`page_cap_hit` logado). `fetchImpl` injetável p/ testes.
  - `buildLastSpeakerMap(messages)` (PURA) — agrupa por telefone normalizado, guarda a `direction` da msg de **maior timestamp** → `Map<phoneNorm,'inbound'|'outbound'>`. Como guarda max-ts, a ordem das páginas é irrelevante.
  - `extractContactPhone(msg)` (PURA, direction-aware) — telefone do **contato** (cliente): campos de conversa/contato primeiro; fallback por direção (`outbound→to`, `inbound→from`), **nunca `from` cego**. Normaliza com `normalizePhoneBR`.
  - `clientSpokeLastKapso(conv, map)` — mantém só `inbound`; **FAIL-OPEN** (map=null → mantém tudo; telefone sem match → mantém; só exclui outbound certo).
  - `fetchKapsoLastSpeaker(...)` — orquestra fetch+build; `{ok:false, map:null}` em qualquer falha (→ fail-open no chamador).
- **PIN do phone_number_id:** `kapsoPhoneNumberId || process.env.KAPSO_PHONE_NUMBER_ID || '1016003164939443'` — evita reincidência do no-op por cache em memória frio pós-restart. **Requer `KAPSO_PHONE_NUMBER_ID` no `.env` do VPS** (e confirmar/setar `KAPSO_API_BASE_URL` se o host nativo divergir do proxy Meta — código usa `KAPSO_API_BASE_URL || KAPSO_API_BASE`).
- **AC5 (mantido):** `mapWithConcurrency(items, 4, fn)` — pool de 4 + `AbortSignal.timeout(60s)` por chamada → wall-time com teto, mata o travamento dos 131 convos.
- **AC4 (estendido):** funil agora é JSON com contadores que distinguem os 3 disfarces do no-op (Kapso indisponível / join quebrado `matched=0` / filtro OK) — ver AC4.
- **Guardrail do timestamp (4º disfarce do no-op):** `buildLastSpeakerMap` conta `messagesWithTs` (ts > 0). Se o campo de timestamp da Kapso tiver outro nome (não probado) e `extractTimestampMs` devolver 0 pra tudo, "max-timestamp" degradaria silenciosamente p/ "ordem do fetch" (arbitrária) → filtro ranqueando em ruído. Por isso: `kapso_msgs_fetched > 0 && kapso_msgs_with_ts === 0` → **fail-OPEN loud** (`kapso_timestamps_unparseable`), igual ao tratamento de 5xx. Bypass visível > filtro errado invisível.
- **⚠️ RISCO DE PROD #1 (top):** o campo exato de telefone-por-msg do endpoint nativo Kapso **não está documentado** na skill `observe-whatsapp` e **não pôde ser probado localmente** (sem `KAPSO_API_KEY` no ambiente do @dev). `extractContactPhone` cobre os candidatos mais prováveis; se nenhum casar, `conversations_matched_in_map=0` no funil do AC11 expõe o join quebrado (não fica invisível). Mitigação futura se necessário: derivar telefone via `/platform/v1/whatsapp/conversations` (conversation_id→phone_number).
- **⚠️ RISCO DE PROD #2 (smoke):** a **ordem de paginação** do endpoint não foi probada. `fetchKapsoMessagesRaw` assume newest-first (cursor `after` → mais antigos) e para quando a página cobre o início da janela. Se a API for oldest-first, o early-stop pode disparar cedo demais e perder as msgs recentes. **No AC11 (Victor), conferir no funil:** `pages` razoável p/ a janela (não `pages=1` com `kapso_msgs_fetched` baixo demais) e `page_cap_hit=false`. Não corrigível às cegas (precisa do probe); fica como check do smoke. Como o reduce usa max-timestamp, **a ordem só afeta completude da janela, não a correção do last-speaker por telefone** desde que a janela seja coberta.
- **Testes:** `backend/test/supervisor.test.js` (**24**, pass — helpers puros + `fetchKapsoLastSpeaker` com fetch injetado, incl. fail-open de 5xx, phone_number_id ausente e timestamp não-parseável) + suíte backend **61/61**.
- **Camada 2 (pendente):** input enriquecido (`QUEM_FALOU_POR_ULTIMO`, `TEM_AGENDAMENTO`, `HORARIO_ULTIMA_MSG_CLIENTE`) + rework do prompt 46590 + render híbrido. **Bloqueada na Fase 0** (prompt atual do 46590 — Victor cola / acesso TESS). O sinal de agendamento (AC3) entra aqui (não em Camada 1) por só ser consumido pelo input do agente.
- **Validação pendente (precisa prod):** dryRun real no VPS pra confirmar AC9 (precisão) + AC10 (custo: chamadas TESS caem) + AC11 (conclui sem travar). Não rodável localmente (sem DB/TESS prod).

### File List
- `backend/supervisor.js` (modificado) — RE-DEV Camada 1: novos `getKapsoApiBaseUrl`, `extractContactPhone`, `extractDirection`, `extractTimestampMs`, `buildLastSpeakerMap`, `fetchKapsoMessagesRaw`, `fetchKapsoLastSpeaker`, `clientSpokeLastKapso` (substitui `clientSpokeLast`); config Kapso (base/key lazy, PIN do phone_number_id, page limits/timeout); `runMorningTriage` refeito (filtro Kapso fail-open + funil diagnóstico); `require('./lib/trinks-mapping')`; exports atualizados
- `backend/test/supervisor.test.js` (reescrito) — 22 testes (helpers puros + fetch injetado)

### Debug Log References
_(preenchido na Camada 2 — incluir resultado da Fase 0: prompt atual do 46590 + nova versão)_

## QA Results
_(preenchido pelo @qa)_
