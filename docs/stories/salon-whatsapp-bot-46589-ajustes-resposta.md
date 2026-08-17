# Story: Bot 46589 — Ajustes de Resposta (feedback testes do Tiago)

**Tipo:** Brownfield improvement (bot conversacional WhatsApp Studio Tirra, agente TESS 46589 — NÃO é o supervisor 46590)
**Status:** ✅ **Approved (GO 9/10, @po 2026-06-02)** — liberada para `@dev *develop`. Item 1 pode começar já; itens 2/3 começam pela Fase 0 (probes read-only).
**Agente executor:** @dev (quality gate @architect na Fase 0; suporte de prompt: Victor cola/edita o 46589)
**Story Points:** 8
**Branch sugerida:** `feature/bot-46589-ajustes-resposta`
**Pode executar agora:** 🟡 **Item 1 (card) liberado já.** Itens 2 e 3 dependem de **Fase 0** (1 probe Trinks cada — read-only). Item 5-novo é fix de prompt (Victor edita o 46589). **O prompt atual do 46589 já está em mãos** (colado nesta sessão) — não há bloqueio de input como teve na v2 do supervisor.

**Source-of-truth técnico (verificado no código, 2026-06-02):**
- [backend/server.js](../../backend/server.js):
  - `processMessage()` (:832) — orquestração; `callTESS()` (:695) chama o agente 46589 com `memory_collections=[39496]`.
  - `buildDynamicContext()` (:297-321) — **o que o backend REALMENTE injeta** (texto livre, ver Causa Raiz).
  - `buildPersistedSection()` (:276-295) — `PERFIL DO CLIENTE` (Nome / Ultimo servico / Ultima visita / Total visitas). **NÃO injeta booking ID nem `ultimoAgendamento`.**
  - `loadClientMemory()` (:215-235) — query `clients` (`name, last_service, last_visit, visit_count`). Sem agendamento.
  - `getSlots()` (:374-389) — `HORARIOS VAGOS` por profissional, **agnóstico ao serviço**.
  - `getProfessionals()` (:391-404) — `PROFISSIONAIS ATIVOS: - {apelido} (ID x)`. **Sem especialidades.**
  - `getServicesText()` (:406-422) — `SERVICOS DISPONIVEIS: - {nome} [{profissionalNome}] (ID x)`. **Sem `profissionaisHabilitados` estruturado.**
  - `getServiceForProfessional()` (:425-473) — probe de serviço por profissional; tenta `/profissionais/{id}/servicos` → `/servicos?profissionalId=` → `/servicos` (cadeia de fallback).
  - **Card de confirmação (item 1):** bloco 4a (:924-969) — `finalMessages.push(...)` (:952-960) monta data/prof/valor. **Não imprime o nome do serviço.** `bookingData.service` (:929) só existe no path legacy `service_name`; em v2 só há `service_id` (:930).
  - **Cancelamento (item 3):** bloco 4b (:972-993) — resolve `bookingCancel.agendamento_id || findClientBooking(clienteId, date)`. `findClientBooking()` (:539-557) busca por data (`GET /agendamentos?clienteId&dataInicio&dataFim`). `cancelBookingInTrinks()` (:560-581) = `PATCH /agendamentos/{id}/status/cancelado` body `{quemCancelou, motivo}` — **correto e documentado.**
  - **Handoff (item 5-novo):** bloco 4d (:1033-1037) — `HANDOFF_HUMAN` → `markHumanHandled()`.
- [backend/lib/booking-parser.js](../../backend/lib/booking-parser.js):
  - `stripBookingTags()` (:53) — cancel inline (:76-86) **exige `bookingId=`**; cancel legacy JSON (:118-125) aceita `{...}` (pode trazer `date`).
- [backend/lib/message-splitter.js](../../backend/lib/message-splitter.js) — `TAG_REGEX` (:30) preserva `BOOKING_*`/`HANDOFF_HUMAN` íntegras no split. Coberto por testes.
- **Prompt do agente TESS 46589** (colado nesta sessão; vive no dashboard TESS, `get_agent` só dá metadados). Estrutura R-I-S-P-C. Seções relevantes: I.1 (agendamento), I.2 (cancelamento), I.4 (dúvidas/preço), I.6 (escalar), C (KB), CONTEXTO DINÂMICO.
- **KB 39496** "Tirra KB Production" — arquivos `fichas-tecnicas-servicos.md` (profissionais habilitados por serviço), `sinonimos-servicos.md`, etc.

## Contexto

O Tiago testou o bot em produção e trouxe feedback (transcrição de áudios resumida por Victor). Foram 5 achados; **4 entram nesta story** (o 5º original — relatório matinal não chegando — foi confirmado como janela 24h do WhatsApp, acessório, **fora de escopo**). Em sessão de triagem (@aios-master) cada item foi classificado contra o código atual.

### Os 4 itens desta story

1. **Card de confirmação sem o nome do serviço.** O recibo final mostra data, hora, profissional e valor — **omite qual serviço foi marcado** (evidência: `image_39cc4b.png`, "Avaliação para Mechas" não aparece). Tiago sugeriu "atualizar o prompt", mas o card é montado pelo **backend** (2-phase), não pelo prompt.
2. **Bot oferece profissional que não faz o serviço.** Ele filtra só por horário livre; ofereceu profissionais às 10h ignorando que "Erick só faz masculino", "Gabriel é recepcionista". Sugestão do Tiago: "ver as atribuições de cada profissional" e filtrar por quem faz o serviço **antes** de buscar horário.
3. **Cancelamento não funciona.** Tiago agendou e tentou cancelar; o bot só conseguiu agendar. (Victor lembra de testar cancelamento numa versão inicial, mas não validou após a migração pra Kapso.)
4. **Handoff para múltiplos serviços (regra nova).** Quando o cliente quer agendar mais de um serviço e a IA não resolve fácil na primeira tentativa → chamar o Gabriel, que continua o atendimento. Hoje a I.6 só escala "agendamento com mais de 1 **profissional**", não cobre "mais de 1 **serviço**".

## Causa Raiz (técnica) — descoberta-chave

**O prompt do 46589 foi escrito contra um CONTEXTO DINÂMICO idealizado que o backend nunca implementou.** O prompt declara como fonte única:

```
SERVICOS: [{ id, nome, preco, duracaoMin, profissionaisHabilitados }]
PROFISSIONAIS: [{ id, nome, especialidades }]
DADOS_CLIENTE: { id?, nome?, telefone, email?, ultimoAgendamento? }
```

Mas `buildDynamicContext()`/`buildPersistedSection()` injetam **texto livre sem esses campos**:
- `PERFIL DO CLIENTE: Nome / Ultimo servico / Ultima visita / Total de visitas` — **sem `ultimoAgendamento`, sem booking ID.**
- `SERVICOS DISPONIVEIS: - {nome} [{profissionalNome}] (ID x)` — **sem `profissionaisHabilitados`.**
- `PROFISSIONAIS ATIVOS: - {apelido} (ID x)` — **sem `especialidades`.**

Esse descompasso é a raiz comum dos itens 2 e 3:

- **Item 3 (cancelamento) — CAUSA CONFIRMADA:** o prompt I.2 manda "Localiza o bookingId no histórico ou em DADOS_CLIENTE" (Exemplo 4 usa `DADOS_CLIENTE.ultimoAgendamento id=498220145`). Mas **o backend nunca injeta esse ID.** O bot fica sem o `bookingId`; a REGRA ZERO o proíbe de inventar → ele emite `[BOOKING_CANCEL]` sem ID (o parser inline exige `bookingId` e **descarta**) ou trava. **A chamada de API está correta** (`cancelBookingInTrinks`) — o que falha é a disponibilidade do dado. O backend já tem `findClientBooking(clienteId, date)` que resolveria o ID **pela data**, mas o prompt nunca emite cancel por data e o parser inline não aceita data.
- **Item 2 (filtro prof×serviço):** o prompt *quer* filtrar (I.1.3 + cita `profissionaisHabilitados` e `fichas-tecnicas-servicos.md`), mas o backend não entrega o mapa de capacidade de forma confiável. Os slots vêm por profissional, agnósticos ao serviço.
- **Item 1 (nome no card):** puro backend — o card não imprime o serviço. Prompt não tem relação.
- **Item 5-novo (handoff multi-serviço):** puro prompt — falta regra na I.6.

## Escopo

### IN
- **Item 1:** card de confirmação passa a incluir o **nome do serviço** (resolvido pelo ID quando v2).
- **Item 2:** backend injeta um **mapa serviço→profissionais habilitados** confiável no contexto dinâmico; prompt reforça o filtro usando esse dado.
- **Item 3:** habilitar cancelamento **fim-a-fim** — fornecer ao bot o dado necessário pro cancel (booking ID via contexto **ou** suporte a cancel-por-data), e validar a chamada Trinks em prod com teste controlado.
- **Item 5-novo:** regra de prompt (I.6) — escalar quando há **múltiplos serviços** que a IA não resolve fácil na 1ª tentativa.
- **Alinhamento de contrato:** corrigir a seção CONTEXTO DINÂMICO do prompt pra refletir o que o backend realmente injeta (ou ajustar o backend pra cumprir o contrato — decisão Fase 0).

### OUT
- **Item original 4 (relatório matinal não chegou)** — confirmado janela 24h do WhatsApp; acessório, fora desta frente.
- **Coexistência humana (item 5 original):** sem alteração — comportamento atual aceito (bot só responde mensagens novas; congela 6h via `markHumanHandled` quando humano responde). **Caveat anotado, não tratado:** `humanHandledUntil` é `Map` em memória → **zera a cada deploy/restart**. Persistir no Postgres fica como tech-debt futuro, fora desta story (decisão Victor 2026-06-02).
- Mudança de modelo / fine-tuning (é prompt + backend, não modelo).
- Reescrita estrutural do prompt além das seções afetadas.

## Acceptance Criteria

### Fase 0 — Probes (read-only, bloqueiam itens 2 e 3)
- [ ] **AC1 (item 2):** Determinar a **fonte confiável e barata** do mapa serviço→profissionais habilitados. Probar a resposta real de `GET /servicos` (tem `profissionaisHabilitados`? uma linha por (serviço,profissional)?), `GET /profissionais/{id}/servicos` e o conteúdo de `fichas-tecnicas-servicos.md` na KB. **Decisão registrada:** 1 chamada existente vs N+1 vs KB. Meta: evitar N+1; preferir 1 chamada se a forma permitir.
- [ ] **AC2 (item 3):** Decidir o **mecanismo de cancelamento** entre (A) backend injeta agendamentos futuros do cliente com ID Trinks no contexto → prompt emite `[BOOKING_CANCEL bookingId=X]`; ou (B) prompt emite cancel **por data** (`[BOOKING_CANCEL date=YYYY-MM-DD ...]` ou JSON `{date}`) → backend resolve via `findClientBooking` já existente. Tradeoff (I/O Trinks vs ambiguidade quando cliente tem múltiplos agendamentos) documentado. @architect aprova.

### Item 1 — Nome do serviço no card (liberado já)
- [ ] **AC3:** No sucesso de `BOOKING_CREATE`, o card final (`finalMessages`, server.js:952-960) inclui uma linha com o **nome do serviço**. Em v2 (só `service_id`), o nome é resolvido (ex.: via `profsPayload`/serviços já buscados ou lookup pelo ID) sem quebrar o path legacy `service_name`.
- [ ] **AC4:** Se o nome do serviço não for resolúvel, o card degrada graciosamente (não imprime linha vazia nem `id:undefined`) — nunca pior que o comportamento atual.

### Item 2 — Filtro profissional × serviço
- [ ] **AC5:** O contexto dinâmico passa a conter um mapa explícito de **quais profissionais fazem cada serviço** (forma decidida na AC1), de modo que o bot consiga filtrar antes de ofertar.
- [ ] **AC6:** O prompt (I.1 / I.4) reforça: ofertar **apenas** profissionais habilitados para o serviço pedido. Caso de teste: cliente pede "mechas" → bot NÃO oferece profissional que não faz mechas, mesmo que esteja livre no horário.
- [ ] **AC7:** Smoke em prod (whitelist): cenário do feedback (serviço com habilitação restrita) não lista profissional inapto.

### Item 3 — Cancelamento fim-a-fim
- [ ] **AC8:** Implementado o mecanismo escolhido na AC2 (backend + ajuste de prompt/parser conforme a rota).
- [ ] **AC9:** Teste controlado em prod usando um **número de teste whitelisted** (não cliente real): criar um agendamento descartável via bot → pedir cancelamento via bot → confirmar na Trinks que foi cancelado (status). Log mostra `Booking cancel from tag` + `PATCH cancelado → 200`. Limpar/cancelar qualquer resíduo no fim para não poluir a agenda real do salão.
- [ ] **AC10:** Quando o cliente tem mais de um agendamento futuro, o bot **desambigua** (pergunta qual) antes de emitir a tag — não cancela o errado.
- [ ] **AC11:** Falha de cancelamento (não achou / Trinks erro) cai numa mensagem honesta + handoff, sem afirmar falsamente que cancelou.

### Item 5-novo — Handoff multi-serviço
- [ ] **AC12:** I.6 do prompt ganha a regra: agendamento com **mais de um serviço** que a IA não resolve com facilidade na 1ª tentativa → `[HANDOFF_HUMAN motivo=multi_servico]` com a mensagem padrão de passagem pro Gabriel.
- [ ] **AC13:** Caso de teste: cliente pede "corte + escova + hidratação" e a montagem não é trivial → bot escala em vez de errar/loopar.

### Transversal
- [ ] **AC14:** Seção CONTEXTO DINÂMICO do prompt alinhada à realidade do backend (campos que existem de fato), OU backend ajustado para cumprir o contrato — sem deixar o prompt referenciando campos inexistentes.

> **⚠️ Divisão de responsabilidade nos ACs de prompt (AC6, AC12, AC14):** o prompt do 46589 vive no dashboard TESS, **não é versionado no repo**. O `@dev` **entrega o texto proposto** das seções afetadas (I.1/I.4 para AC6, I.6 para AC12, CONTEXTO DINÂMICO para AC14); **o Victor aplica** no dashboard. O AC só fecha após Victor confirmar que aplicou. Recomenda-se registrar a versão do prompt aplicada (data + resumo) no MEMORY/story pra rastreabilidade, já que não há diff.
- [ ] **AC15:** `cd backend && npm test` verde (incluir teste e2e do fluxo de cancelamento — hoje só há cobertura do splitter).
- [ ] **AC16:** Nenhuma regressão no fluxo de agendamento feliz (Exemplo 1 do prompt continua funcionando).

## Dev Notes

- **Deploy:** branch → VPS `ssh deploy@72.60.155.118`, `/opt/influence-labs`, `cd infra && docker compose up -d --build backend` → **SEMPRE `docker compose restart nginx`**. Backend não publica porta no host → testar de dentro (`docker exec backend sh -c 'wget -qO- localhost:3001/...'`). Push/PR/merge = **@devops com autorização explícita do Victor**.
- **Padrão seguro:** deployar a branch no VPS (sem merge em main), validar smoke, só depois mergear.
- **Prompt 46589:** Victor edita no dashboard TESS (não versionado no repo). Os ACs de prompt (AC6, AC12, AC14) viram instruções que Victor aplica; o @dev entrega o texto proposto das seções.
- **Item 3 — pegadinha do parser:** se a rota for (B) por data, o parser inline (`booking-parser.js:76-86`) hoje exige `bookingId`; precisará aceitar `date`/argumentos alternativos, OU usar o path legacy JSON (`:118-125`) que já chega no handler como `bookingCancel.date`. O handler 4b (server.js:978-979) já tenta `findClientBooking` por data — então a rota B é majoritariamente prompt + um ajuste pequeno de parser.
- **Item 1 — fonte do nome:** `getServicesText`/`profsPayload` já trazem nomes de serviço com ID na mesma request; resolver o nome pelo `service_id` no bloco 4a deve ser barato (sem chamada Trinks extra).
- **Logs de prod:** retêm só ~4 dias (container reinicia no deploy) e no período não houve bookings — por isso o teste controlado da AC9 é necessário pra validar cancelamento.

## Tasks (sugestão — @dev refina)
1. [ ] Fase 0: probes AC1 + AC2 (read-only), registrar decisões. ⏳ **Bloqueado por rate-limit Trinks (429) — retomar quando esfriar.**
2. [x] Item 1: incluir nome do serviço no card (AC3, AC4). ✅ código + testes.
3. [x] Item 2: backend injeta mapa de capacidade (AC5) + texto de prompt (AC6). ✅ código + testes; prompt Victor aplica.
4. [ ] Item 3: implementar mecanismo de cancel (AC8) + desambiguação (AC10) + erro honesto (AC11) + teste e2e (AC15).
5. [ ] Item 5-novo: texto da regra I.6 (AC12).
6. [ ] Transversal: alinhar contrato CONTEXTO DINÂMICO (AC14); rodar testes (AC15); deploy branch + smoke (AC7, AC9, AC13, AC16).

## Dev Agent Record

### Agent Model Used
Claude (Dex / @dev) — sessão 2026-06-02

### Completion Notes
- **Item 1 (AC3/AC4) — DONE (código + testes, pré-deploy):**
  - `getServicesText()` agora retorna `{ text, data }` (antes só string) — `data` é a lista crua de `/servicos`, pra resolver o nome do serviço pelo ID. Caller (`processMessage`) atualizado: `svcPayload.text` alimenta o contexto dinâmico (zero mudança no que o bot vê), `svcPayload.data` alimenta o card.
  - Novo helper `resolveServiceName(servicesData, serviceId)` em `lib/booking-parser.js` (testável; importado no server.js). Resolve `nome` pelo ID; retorna `null` quando não resolúvel.
  - Card de sucesso 2-phase: nova linha `💅 {serviço}` inserida entre data e profissional, **só quando o nome resolve** (AC4 — degrada graciosamente, nunca imprime `id:undefined`). Path legacy `service_name` continua funcionando.
  - Bônus: `updateClientAfterBooking` agora grava o **nome real** do serviço em `clients.last_service` (antes gravava `id:123` em v2).
  - Testes: `test/booking-parser.test.js` novo, 6 casos de `resolveServiceName` (match number/string, no-match, id ausente, data não-array, item sem nome). Suíte total **79/79** verde. `node --check` OK em server.js e booking-parser.js.
- **Item 2 (AC5/AC6) — DONE (código + testes, prompt Victor aplica):**
  - `renderHabilitacaoMap(servicesData)` em `lib/booking-parser.js` — seção compacta serviço→profissionais habilitados (snapshot local via `listCompatibility`, zero REST extra).
  - `buildDynamicContext` injeta HABILITACAO **antes** de HORARIOS VAGOS.
  - Catch em create/reschedule: erro `incompativel` → mensagem honesta citando habilitados (não "problema técnico").
  - Testes item2.1–2.5 em `booking-parser.test.js`. Suíte **157/157** verde.
  - Prompt deliverables em `docs/prompts/tess-conversa-v3-clean.md` + `docs/handoffs/46589-prompt-changes-2026-06-02.md` (I.1 habilitação).
- **Fase 0 (AC1/AC2) — BLOQUEADA:** probes read-only à Trinks retornaram **429 persistente** (mesmo com backoff até 50s respeitando Retry-After). `/health` mostra `trinks_ping.status=down`. Hoje é ter 20:30 (salão fechado, sem tráfego real nos logs há 2h) → causa provável: meus ~10 probes seguidos dispararam bloqueio temporário de IP/key. **Nenhuma mudança feita na Trinks; só leitura.** Retomar com 1 chamada quando esfriar. ⚠️ Validar com Victor se o `trinks_ping=down` persiste (seria problema de prod independente desta story).

### File List
- `backend/lib/booking-parser.js` (M) — `renderHabilitacaoMap`, `formatIncompatibleProfServiceMessage`.
- `backend/server.js` (M) — injeta HABILITACAO em `buildDynamicContext`; catch incompatível create/reschedule.
- `backend/test/booking-parser.test.js` (M) — testes item 2 (5 casos).
- `docs/prompts/tess-conversa-v3-clean.md` (M) — REGRA ZERO, I.1 passo 3, CONTEXTO DINÂMICO.
- `docs/handoffs/46589-prompt-changes-2026-06-02.md` (M) — bloco I.1 habilitação (Victor apply).
- `backend/server.js` (M) — `getServicesText` retorna `{text,data}`; caller usa `svcPayload`; card inclui nome do serviço; import de `resolveServiceName`.
- `backend/lib/booking-parser.js` (M) — novo `resolveServiceName` + export.
- `backend/test/booking-parser.test.js` (A) — testes de `resolveServiceName`.

### Change Log
- 2026-06-02: Item 1 (nome do serviço no card) implementado + testado. Fase 0 bloqueada por rate-limit Trinks.
- 2026-06-02: Fase 0 — achados consolidados (abaixo) + decisões do Victor. Pacote Trinks-acoplado encaminhado ao @architect.
- 2026-06-02 (YOLO): Fase A (resiliência Trinks) entregue em story própria (`salon-whatsapp-trinks-resiliencia-429`, commits `7c0e7b4`). Item 3 Rota C (backend) entregue (`a480d2b`). Prompt deliverables (I.2/I.3/I.6/CONTEXTO DINÂMICO) prontos em `docs/handoffs/46589-prompt-changes-2026-06-02.md` (Victor aplica).

### Estado por item (2026-06-02, YOLO run)
- **Item 1 (card):** ✅ código + testes, commit `59da171`. Smoke pós-deploy.
- **Item 3 (cancelamento, Rota C):** ✅ backend (`loadClientFutureBookings` + injeção de `AGENDAMENTOS FUTUROS` com bookingId real + bloco 4b cancela por ID + fallback). Commit `a480d2b`. 94/94 testes. 📝 Prompt I.2/I.3 a aplicar. 🔴 e2e (AC9) precisa Trinks de volta.
- **Item 5-novo (handoff multi-serviço):** 📝 texto I.6 pronto (Victor aplica). Sem código.
- **Item 2 (filtro prof×serviço):** 🔴 Fase C — bloqueado pelo probe `/servicos` (Trinks 429). Worker constrói mapa (decisão @architect).
- **AC14 (contrato CONTEXTO DINÂMICO):** 📝 texto pronto (parte do item 3); parte do item 2 fica pra Fase C.
- **Fase A (resiliência Trinks):** ✅ código + 89→94 testes, commits na branch. 🔴 deploy+smoke (AC9 da Fase A) pendente de Trinks normalizar.

### Fase 0 — Achados (2026-06-02)

**🔴 Trinks 429 em produção (REAL, nova frente aprovada por Victor):**
- Evidência: logs de prod `2026-06-02T05:43Z` e `2026-06-02T17:35Z` (14:35 BRT) — **conversa real** (`getSlots`/`getProfessionals`, que só rodam em `processMessage`) com **~7-8 chamadas falhando no mesmo milissegundo** (17:35:05.695–698).
- **Causa-raiz (diagnóstico @dev):** cada mensagem dispara **7 chamadas Trinks concorrentes** (`server.js:853` — `Promise.allSettled` de 5 dias de slots via `getNextBusinessDays(5)` + `getProfessionals` + `getServicesText`), **sem cache** (só `pingTrinks` tem TTL 60s) e **sem retry/backoff** (só o backfill worker tem). A rajada estoura o rate-limit da Trinks → bot degradado ("Erro ao consultar" em tudo).
- Limite exato da Trinks não documentado publicamente; fix independe do número.
- **Direção de fix (validar com @architect):** (1) cachear serviços+profissionais (quase estáticos) com TTL; (2) reduzir/cachear/serializar os 5 slots; (3) retry com Retry-After/backoff em 429; (4) limiter global de concorrência Trinks. **Victor vai checar quota/billing da conta Trinks em paralelo.**

**🟡 Item 2 — fonte do mapa de habilitação encontrada na KB:**
- `data/kb/conversa-v2/fichas-tecnicas-servicos.md` tem tabela completa **serviço → preço → duração → profissionais habilitados** (catálogo por categoria). O bot já consulta KB (collection 39496).
- **Decisão Victor: abordagem HÍBRIDA** — KB validada contra Trinks (ou vice-versa) pra manter dado fresco e seguro. Mecanismo a desenhar (@architect). **Caveat:** KB usa nomes completos ("Tiago Rocha", "Erick Barros"); slots ao vivo usam `apelido` → precisa cruzar/normalizar nomes. Risco de staleness da KB vs Trinks.

**🟢 Item 3 — decisão Victor: gate formal do @architect** para rota A (injetar agendamentos c/ ID no contexto) vs rota B (cancel por data + `findClientBooking`). Recomendação @dev: rota B (menos I/O Trinks, reusa código), com atenção à desambiguação (AC10).

**Decisões do Victor (2026-06-02):** (1) Trinks 429 = investigar já (nova frente); (2) item 2 = híbrido KB↔Trinks; (3) item 3 = chamar @architect.

### Decisões de Arquitetura (@architect Aria, 2026-06-02 — APROVADAS por Victor)

**Princípio unificador:** a Trinks sai do caminho de resposta em tempo-real → vira **ingestão periódica (worker `admin-trinks-sync` da Story 1.6) + leitura local (DB/cache)**. Runtime não chama Trinks por mensagem.

- **Decisão 1 — Resiliência Trinks (429): SHIP PRIMEIRO, story própria (Fase A).** Fix em camadas: (a) cache de serviços+profissionais (TTL 15–30min); (b) cache de slots por data (TTL 30–60s); (c) limiter global de concorrência Trinks (~3) + retry com Retry-After/backoff em 429. In-process (padrão `trinksPingCache` existente). Destrava operação confiável + o probe da Fase 0. **Esta é uma nova story — referência: `salon-whatsapp-trinks-resiliencia-429` (a draftar).**
- **Decisão 3 — Item 3 = Rota C (DB-backed).** Lookup do agendamento em `trinks_appointments` local (`client_phone` + `scheduled_at>NOW()` + status scheduled/confirmed) → dá `trinks_id` pro PATCH com **zero chamada Trinks** e habilita desambiguação (AC10). Só o PATCH cancelar bate na Trinks. Fallback `findClientBooking` (Trinks) no lag de 15min do sync, ou usar booking criado na própria sessão. Schema confirmado: `trinks_appointments` tem `trinks_id, client_phone, professional_id/name, service_id/name, status, scheduled_at`.
- **Decisão 2 — Item 2 = worker constrói + KB cruza (robusto).** Worker constrói mapa autoritativo `serviceId→[professionalId]` **por ID** (elimina o problema nomes-KB×apelido — runtime usa IDs). KB `fichas-tecnicas-servicos.md` = cross-check com alerta de drift Trinks×KB. Runtime lê local (zero custo/msg). **Ainda precisa do probe da forma de `/servicos` (pós-fix da Decisão 1 ou off-peak).** Fase C.

**Sequenciamento:** Fase A (resiliência Trinks, story própria) → Fase B (item 3 Rota C + prompt: 5-novo, lado-prompt de 1/2) → Fase C (item 2 híbrido, pós-probe). Item 1 já entregue (independente).

## CodeRabbit Integration
- **Specialized agents previstos:** backend (Node/Express), prompt-engineering (revisão das seções do 46589).
- **Quality gates:** @architect na Fase 0 (decisões AC1/AC2); @qa no gate final (cancelamento e2e + smoke prod).
- Self-healing CodeRabbit: máx 2 iterações em `uncommitted` antes do commit.

## File List (preencher na implementação)
- `docs/ops/pilot-readiness-2026-06-26.md` (A) — gate operacional datado para smoke/piloto supervisionado.
- `docs/ops/trinks-webhook-first-pilot.md` (M) — link e veredito do gate 2026-06-26.
- `docs/qa/salon-test-matrix.md` (M) — recorte P0 do smoke WhatsApp supervisionado.

## QA Results

### Review Date: 2026-06-26

### Gate: CONCERNS — smoke whitelisted liberado, clientes reais bloqueados

Evidencia automatizada coletada:

- Root gates: `npm run lint && npm run typecheck && npm test` PASS, prompt tests 79/79.
- Backend: `cd backend && npm test` PASS, 138/138.
- Admin: `cd frontend/admin && npm run lint && npm run typecheck && npm test` PASS com 1 warning lint (`frontend/admin/lib/kb.ts`) e 25 testes de integracao skipped por `postgres-test` indisponivel.
- Scripts: parser tags 11/11, HMAC Kapso 8/8, extracao de transcricao 13/13.
- Producao `/health`: backend `ok`, Trinks ping `ok`, snapshots preenchidos, webhook configurado, `pending_notifications=0`, `BOT_ACCEPT_ALL=false`, whitelist count 3.

Bloqueios para clientes reais:

- `whatsapp_window.status=red`: nenhum inbound do Tiago registrado desde restart do backend.
- Criacao/cancelamento pelo WhatsApp ainda nao foram validados ponta a ponta nesta bateria.
- `trinks_webhook.last_error=Unsupported Trinks webhook event: null` precisa ser classificado.
- Forecast local retornou `pass=false` por ausencia de baseline observado no ambiente local; rodar no ambiente com DB de producao antes de expandir.
- AC7, AC9 e AC13 permanecem abertos ate evidencia real pelo WhatsApp.

Decisao: manter `BOT_ACCEPT_ALL=false`, usar apenas numeros whitelisted e executar o smoke descrito em `docs/ops/pilot-readiness-2026-06-26.md` antes de atender 1-3 clientes reais.
