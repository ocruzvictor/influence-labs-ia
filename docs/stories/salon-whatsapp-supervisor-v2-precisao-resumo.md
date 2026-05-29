# Story: Supervisor v2 — Precisão do Resumo Matinal (híbrido + pré-filtro + custo)

**Tipo:** Brownfield improvement (bot WhatsApp Studio Tirra — não pertence ao Epic Admin Dashboard)
**Status:** InProgress — ⚠️ **Camada 1 deployada MAS o filtro AC2 é no-op em prod (ver smoke 2026-05-29); precisa pivô pra filtro por agendamento.** Camada 2 aguarda prompt 46590.
**Agente executor:** @dev (suporte opcional @analyst no prompt; quality gate @architect)
**Story Points:** 8
**Branch sugerida:** `feature/supervisor-v2-precisao-resumo`
**Pode executar agora:** 🟡 Parcial — **Camada 1 (pré-filtro no código)** pode começar já (corta ruído + custo + o travamento). **Camada 2 (prompt do agente 46590)** depende de obter o prompt atual (Fase 0 — Victor cola ou dá acesso ao TESS).
**Source-of-truth técnico:**
- [backend/supervisor.js](../../backend/supervisor.js) — `runMorningTriage()` (:154), `fetchRecentConversations()` (:52), `classifyConversation()` (:77), `scoreFromVerdict()` (:114), `renderDigest()` (:132)
- Agente TESS **46590** "Studio Tirra - Supervisor" (prompt vive no dashboard TESS — **não exposto pela API** `get_agent`)
- [backend/server.js:1600](../../backend/server.js) — `POST /admin/trigger-supervisor?dryRun=1` + `GET /admin/last-digest` (usar pra testar sem esperar 7h)
- `conversation_history` (role: `user`=cliente, `assistant`=bot; coluna `agent`=`human` em takeover)
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
1. **Quem falou por último** — se o **salão** (role `assistant`/`agent=human`) falou por último → já tratado ou é vez do cliente (silêncio ≠ urgência). Se o **cliente** (role `user`) falou por último → está **aguardando resposta** = acionável. O agente tem as mensagens mas não pesa isso.
2. **Status de agendamento** — o agente não sabe se o cliente **já tem agendamento** (resolvido). A tabela `trinks_appointments` (Story 1.6) agora permite cruzar isso.

**Efeito colateral grave observado nesta sessão:** com 24h de lookback = **131 conversas** → 131 chamadas TESS sequenciais → o dry-run **travou (>10 min sem concluir)** + custo de ~131 créditos TESS por execução. O pré-filtro resolve precisão **e** custo **e** travamento de uma vez.

## Esta story entrega — abordagem em 2 camadas

**Camada 1 — Pré-filtro no código (`supervisor.js`), ANTES de chamar o TESS:**
- Filtro duro: considera só conversas onde o **cliente falou por último** (aguardando salão). Isso sozinho cobre os 3 baldes de falso-positivo do Gabriel.
- Status de agendamento (`trinks_appointments`) é **sinal pro agente**, NÃO exclusão (evita falso-negativo — ver AC3).
- Resultado: ~131 → dezenas de conversas → ~muito menos chamadas TESS + sem travamento.

**Camada 2 — Input enriquecido + prompt do agente 46590 (no TESS):**
- Passar ao agente: quem falou por último, se tem agendamento, horário da última msg do cliente.
- Prompt reescrito pro critério "fura-fila" + saída no formato híbrido (respeita o FIFO do Gabriel).

## Escopo

### IN
- Pré-filtro por "cliente falou por último" + exclusão de agendados (Camada 1).
- Robustez: concorrência limitada + budget/timeout no ciclo (mata o travamento).
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
- [ ] **AC2:** Em `runMorningTriage`, antes de classificar, manter **só conversas cuja última mensagem tem `role='user'`** (cliente aguardando resposta). Conversas com `assistant`/`human` por último → **excluídas** (já respondido / vez do cliente). `fetchRecentConversations` já traz `messages` ordenadas — derivar `last_role` do último elemento.
- [ ] **AC3 (revisado pela PO — booking é SINAL, não exclusão dura):** **NÃO** excluir por agendamento. O único filtro duro de Camada 1 é o AC2 (cliente falou por último) — ele já cobre os 3 baldes de falso-positivo do Gabriel sem risco de falso-negativo. O **status de agendamento** é **computado e passado como SINAL** ao agente (ver AC6: `TEM_AGENDAMENTO`), porque um cliente *com* agendamento que manda msg nova (remarcar/reclamar/2º serviço — ex. "corte novo com Érick") **é acionável**, não resolvido. Match por telefone normalizado (dígitos; reusar normalização 55 da 1.6 — `conversation_history.client_phone` 13 díg c/ 55; `trinks_appointments.client_phone` já normalizado).
- [ ] **AC4:** Logar métricas do ciclo: `{total_conversas, apos_filtro_last_role, com_agendamento, enviadas_tess, sinalizadas}` (o `last_role` é o redutor duro; `com_agendamento` é só anotação/sinal). Meta: **≥70% de redução** nas chamadas TESS em volume típico (ex: 131 → ≤40), vinda do filtro `last_role`.
- [ ] **AC5:** **Robustez (mata o travamento):** classificações TESS rodam com **concorrência limitada** (ex: pool de 3-5) e/ou **budget total de tempo** no ciclo; cada chamada já tem `AbortSignal.timeout(60s)` — garantir que uma falha/timeout **não trava** o ciclo (continua, loga o erro, segue). O dry-run deve **sempre concluir** (hoje trava com 131).

### Camada 2 — Input + prompt (depende da Fase 0)
- [ ] **AC6:** Enriquecer o input de `classifyConversation` com: `QUEM_FALOU_POR_ULTIMO` (`cliente`|`salao`), `TEM_AGENDAMENTO` (bool + status/quando se houver), `HORARIO_ULTIMA_MSG_CLIENTE` (pro Gabriel encaixar no FIFO).
- [ ] **AC7:** Prompt do 46590 reescrito — critério **"fura-fila"**: sinalizar **só** quando o cliente está **aguardando resposta E não resolvido E** há sinal real de urgência/importância (ex: pedido de novo agendamento, reclamação, tempo-sensível, cliente recorrente/VIP). **Excluir explicitamente**: já respondido, já agendado, cliente-sumiu.
- [ ] **AC8:** Saída reformulada pro **híbrido** (`renderDigest`): a mensagem deixa claro *"estes furam sua fila — atenda primeiro, depois siga sua ordem de chegada normal"*. Cada item: motivo curto + **horário de chegada** + ação sugerida. Curto e escaneável (tempo do Gabriel é precioso). Vazio → mensagem positiva ("nada fura a fila hoje, bom dia").

### Validação
- [ ] **AC9:** **Precisão (2 lados):** validar contra casos reais via dryRun + revisão manual:
  - **Falso-positivo:** as conversas sinalizadas são de fato "cliente aguardando + acionável" (idealmente reproduzir os casos do Gabriel: sinalizar as 2 boas, não as 8).
  - **Falso-negativo (guardrail):** revisar uma amostra das conversas **excluídas pelo filtro** e confirmar que nenhuma era urgência real. Edge case aceito p/ MVP: bot respondeu sem resolver (salão falou por último) → fica fora do destaque, mas o **FIFO do Gabriel pega** (alinhado ao que ele pediu: menos ruído).
- [ ] **AC10:** **Custo:** log comprova a redução de chamadas TESS (antes vs depois).
- [ ] **AC11:** **Confiabilidade:** dryRun (`POST /admin/trigger-supervisor?dryRun=1` → `GET /admin/last-digest`) **conclui sem travar** e em tempo razoável.

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
- [x] **Camada 1 — pré-filtro (AC2, AC4, AC5)** ✅
  - [x] Derivar `last_role` por conversa em `runMorningTriage`; manter só `user` por último (filtro duro) — helper `clientSpokeLast`
  - [ ] Computar status de agendamento (`trinks_appointments`) como **sinal** → **movido pra Camada 2** (só é consumido pelo input do agente, AC6 — evita dead code)
  - [x] Concorrência limitada (`mapWithConcurrency`, pool=4) no lugar do loop sequencial (mata o travamento)
  - [x] Logging de métricas do funil (`total → aguardando → classificadas → sinalizadas`) + 7 testes (node:test) do filtro e do pool
- [ ] **Camada 2 — input + prompt (AC6-AC8)**
  - [ ] Enriquecer input do `classifyConversation`
  - [ ] Reescrever prompt 46590 (no TESS) + formato híbrido no `renderDigest`
- [ ] **Validação (AC9-AC11)** — dryRun, precisão vs casos do Gabriel, custo, confiabilidade
- [ ] Deploy (@devops): rebuild backend + **restart nginx** + dryRun de smoke

## Dev Notes

> Tudo abaixo veio de arquivos reais (citados). O prompt do 46590 é a única peça externa (Fase 0).

### Como o supervisor funciona hoje (`backend/supervisor.js`)
- `fetchRecentConversations(lookbackHours)` (:52) — agrupa `conversation_history` por `client_phone`, traz `messages` (array ordenado `{role, content, ts}`), `last_ts`, `msg_count`. **O último elemento de `messages` dá o `last_role`** (não precisa query nova).
- `classifyConversation({phone, client, messages})` (:77) — manda as **últimas 12 msgs** + `DADOS_CLIENTE` ao TESS 46590; espera JSON `{priority_score, severity, categoria, decision: escalate|monitor, reason_for_human, suggested_action}`. `AbortSignal.timeout(60s)` por chamada.
- `runMorningTriage` (:154) — loop **sequencial** sobre todas as conversas (← origem do travamento com 131). `renderDigest` (:132) monta a msg. Envio pra `recipients` (Tiago + `SUPERVISOR_EXTRA_PHONES`).
- Categorias já existentes no scoring (:114): `reclamacao, pedido_humano, conflito_agenda, qualidade_ruim, silencio_meio_conversa, falso_positivo`. Note que `silencio_meio_conversa` é exatamente o balde "cliente sumiu" que o Gabriel quer **fora** do destaque.

### Taxonomia de `role` (confirmada em `backend/server.js:242,292`)
- `role='user'` → **Cliente**. `role='assistant'` → **bot/salão** (e `agent='human'` quando humano assumiu o atendimento). Logo **"cliente aguardando" = última msg `role='user'`**.

### Join com Trinks (SINAL, não filtro) — reusar normalização da 1.6
`conversation_history.client_phone` = 13 díg com 55. `trinks_appointments.client_phone` já vem normalizado (worker 1.6 prefixa 55). Match por `regexp_replace(phone,'\D','','g')` dos 2 lados (mesmo padrão de `lib/metrics.ts` taxa de sucesso). **Decisão PO:** booking NÃO exclui a conversa (cliente com agendamento que manda msg nova é acionável) — é passado ao agente como `TEM_AGENDAMENTO` (AC6) pra ele pesar. O único filtro duro é "cliente falou por último" (AC2).

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
- **Backend:** `node:test` em `backend/test/` — cobrir: detecção de `last_role` (mantém `user`, descarta `assistant`/`human`), exclusão por agendamento (com/sem match de telefone normalizado), e que o filtro não derruba um caso "cliente aguardando + sem agendamento". Mockar `db.query` e `fetch` TESS.
- **Integração/smoke:** dryRun real no VPS (AC9-AC11) — conclui, precisão vs casos do Gabriel, log de custo.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-29 | 1.3 | **@devops: rota Kapso CONFIRMADA (resolve o furo do AC2 sem pivotar pra booking).** Probe read-only na API Kapso: `GET /meta/whatsapp/{ver}/{phone_number_id}/messages` (phone_number_id `1016003164939443`, auth `X-API-Key`) → 200, cada msg tem **`kapso.direction` (inbound/outbound)** + `whatsapp_conversation_id` + timestamp + `contact_name`. Amostra 50 msgs = 28 in / **22 out**. **A Kapso captura os envios (inclusive manuais do salão, que o `conversation_history` bot-only não tem)** → dá pra reconstruir "quem falou por último" de verdade. **NOVA ROTA (substitui o AC2 atual):** fonte do last-speaker passa a ser a **API Kapso**, não `conversation_history`. Booking volta a ser só sinal. Endpoints úteis: `/platform/v1/whatsapp/phone_numbers` (lista PNs), `.../messages` (proxy). **A confirmar com Victor:** todas as respostas do Gabriel passam pela Kapso (ele vê no painel → sim). Requer revisita @sm/@po (reescrever AC2 com fonte Kapso) + @architect (estratégia de fetch: bulk `messages` agrupado por `whatsapp_conversation_id` vs por-conversa + cache). | @devops Gage |
| 2026-05-29 | 1.2 | **@devops: smoke em prod revelou furo no AC2.** Deploy OK (backend rebuild + nginx), mas o dryRun mostrou `127 conversas; filtradas 0` — **o filtro "cliente falou por último" não remove nada**. Causa: `conversation_history` é **bot-only** + bot majoritariamente **passivo** (24h: `user/passive`=421 vs `assistant`=20); as respostas manuais do Gabriel no WhatsApp **não são logadas** → pra tabela o cliente sempre "falou por último". **Sinal de last-role é cego pro que o salão já tratou.** Dado descobre: **83/127 (65%) têm agendamento Trinks** → filtro por **booking** é o sinal viável (corta ~65%). AC5/pool funciona (bound de tempo, sem hang eterno) — fica. **PIVÔ necessário:** trocar o filtro duro de AC2 → agendamento (reabre tradeoff de falso-negativo que a PO levantou). Decisão com Victor + provável revisita @sm/@po/@architect. Deploy atual é inofensivo (no-op, sem regressão). | @devops Gage |
| 2026-05-29 | 1.1 | **@dev: Camada 1 implementada** (`backend/supervisor.js`). AC2 (`clientSpokeLast` — filtro "cliente falou por último"), AC5 (`mapWithConcurrency` pool=4 no lugar do loop sequencial — mata o travamento), AC4 (log do funil). 7 testes novos (`backend/test/supervisor.test.js`) + backend 44/44 + CodeRabbit 0 findings. Camada 2 (input+prompt 46590) segue bloqueada na Fase 0. Próximo: `@devops *push` (rebuild backend + restart nginx) → smoke dryRun em prod (AC9-11). | @dev Dex |
| 2026-05-29 | 1.0 | **Validada GO 9/10 → Ready (@po).** Anti-alucinação limpo (refs de `supervisor.js`, taxonomia `role`, join Trinks, endpoint dryRun conferidos no código). 1 Should-Fix P1 aplicado: **AC3 rebaixada** — booking vira SINAL pro agente, NÃO exclusão dura (evita falso-negativo: cliente com agendamento que manda msg nova, ex. "2º serviço com Érick", é acionável). Filtro duro = só AC2 (cliente falou por último), que já cobre os 3 baldes do Gabriel. AC9 ganhou guardrail de falso-negativo. Meta de custo ajustada (≥70%, vinda do `last_role`). Pronta para `@dev *develop` (começar pela Camada 1). Camada 2 aguarda prompt 46590 (Fase 0). | @po Pax |
| 2026-05-29 | 0.1 | Story draftada a partir do feedback real do Gabriel (precisão 2/10). Intent híbrido (Victor): resumo complementa o FIFO do Gabriel puxando pra frente só o que fura a fila. Abordagem 2 camadas: (1) pré-filtro no código (cliente-falou-por-último + exclui agendados via `trinks_appointments`) que resolve precisão + custo (~10x menos chamadas TESS) + o travamento de hoje; (2) input enriquecido + rework do prompt 46590 (precisa do prompt atual — Fase 0). Causa raiz: classificação isolada sem sinal de last-speaker nem booking status. OUT: UI de destinatários (adiada). Próximo: `@po *validate-story-draft`. | @sm River |

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (@dev Dex)

### Completion Notes List
**Camada 1 — IMPLEMENTADA ✅** (`backend/supervisor.js`)
- **AC2:** `clientSpokeLast(conv)` — filtra antes de classificar; só conversas com última msg `role='user'`. Remove os 3 baldes de falso-positivo do Gabriel (já-respondida/já-agendada/cliente-sumiu, todos terminam com salão por último).
- **AC5:** `mapWithConcurrency(items, 4, fn)` substitui o loop sequencial — pool de 4 + cada `classifyConversation` já tem `AbortSignal.timeout(60s)` → wall-time com teto, **mata o travamento** dos 131 convos. Erro numa conversa não derruba o ciclo (retorna null, filtrado).
- **AC4:** log do funil `total → aguardando → classificadas → sinalizadas`.
- **Testes:** `backend/test/supervisor.test.js` (7, pass) + suíte backend 44/44.
- **Camada 2 (pendente):** input enriquecido (`QUEM_FALOU_POR_ULTIMO`, `TEM_AGENDAMENTO`, `HORARIO_ULTIMA_MSG_CLIENTE`) + rework do prompt 46590 + render híbrido. **Bloqueada na Fase 0** (prompt atual do 46590 — Victor cola / acesso TESS). O sinal de agendamento (AC3) entra aqui (não em Camada 1) por só ser consumido pelo input do agente.
- **Validação pendente (precisa prod):** dryRun real no VPS pra confirmar AC9 (precisão) + AC10 (custo: chamadas TESS caem) + AC11 (conclui sem travar). Não rodável localmente (sem DB/TESS prod).

### File List
- `backend/supervisor.js` (modificado) — `clientSpokeLast`, `mapWithConcurrency`, `CLASSIFY_CONCURRENCY`, refactor do `runMorningTriage` (filtro + pool + métricas), exports
- `backend/test/supervisor.test.js` (novo) — 7 testes

### Debug Log References
_(preenchido na Camada 2 — incluir resultado da Fase 0: prompt atual do 46590 + nova versão)_

## QA Results
_(preenchido pelo @qa)_
