# Story: TESS Context On-Demand — contexto Trinks por intenção + skip TESS em turnos triviais

**Tipo:** Brownfield optimization (backend bot WhatsApp Studio Tirra — agente TESS 46589)
**Status:** In Progress
**Agente executor:** @dev (quality gate @architect + @qa)
**Story Points:** 8
**Branch sugerida:** `feature/tess-context-on-demand`
**Epic / frente:** Go-live Studio Tirra — caber no tier TESS 4k créditos sem trocar modelo Haiku

## Contexto

O bot da recepcionista (TESS 46589) injeta **contexto Trinks completo em toda mensagem** — default **10 dias úteis** de horários (`TRINKS_SLOT_CONTEXT_DAYS`) + sábados extra, todos os profissionais, ~119 serviços, mapa de habilitação — mesmo quando o cliente só diz "oi" ou pergunta o endereço. Em produção (15/ago–01/set/2026, `GET /workspaces/usage`) isso dá **~29,2 cr/msg** e **~50,8k tokens de input** (Haiku sem Thinking). O plano **TESS PRO 4.000 créditos/mês** (~4.600 com bônus) não aguenta rollout pleno nesse payload.

**Objetivo de negócio (2026-09-01, Victor):** **arrumar tokens primeiro**, só então atender cliente. Não comprar crédito para operar a versão gorda. Pack desta sessão: **1.000 cr (R$ 84,50)** só para validar `scoped`. Playbook: [docs/ops/tess-token-performance-workplan.md](../ops/tess-token-performance-workplan.md).

**Restrições explícitas desta story:**
- **Manter** modelo TESS atual (**Claude 4.5 Haiku**, sem Thinking).
- **Não** alterar `BOT_ACCEPT_ALL` nem ampliar whitelist — rollout continua supervisionado.
- **Não** reescrever prompt 46589 além de nota mínima se o contrato de contexto mudar (preferir backend-only).

**Source-of-truth desta entrega:**
- Spec: [docs/architecture/tess-context-on-demand.md](../architecture/tess-context-on-demand.md)
- Quality gate: [docs/qa/tess-context-on-demand-quality-gate.md](../qa/tess-context-on-demand-quality-gate.md)
- Código atual: [backend/server.js](../../backend/server.js) (`processMessage`, `buildDynamicContext`, `callTESS`)

**Decisões de orquestração (2026-09-01) — conflito dos 3 artefatos resolvido:**
1. **Flag canônica:** `TESS_CONTEXT_MODE=full|scoped` (default `full` = dump atual). Não usar `TESS_CONTEXT_ON_DEMAND`.
2. **v1:** contexto escopado + fallback `UNCERTAIN` → FULL. Skip TESS: allowlist S1 no workplan; default prod `TESS_SKIP_TRIVIAL=false` até shadow.
3. **4k/mês não prometido** até medir `scoped`. Go-live pleno só com média medida **ou** conversa de tier depois.
4. Sem `BOT_ACCEPT_ALL`. Modelo Haiku inalterado.
5. **Ordem de caixa:** não dimensionar pack para atendimento na versão ~29 cr. Investigação + 1.000 cr de teste → depois crédito de operação na versão nova.

## User Story

**Como** operador do Studio Tirra (Victor / equipe),
**quero** que o backend monte contexto Trinks **só quando a intenção exigir** e **pule a chamada TESS** em turnos triviais inequívocos,
**para que** o bot caiba no tier **4k créditos TESS** mantendo a qualidade conversacional já aprovada no piloto.

## Escopo

### IN
- **Classificador de intenção leve** (heurística/reglas no backend — sem LLM extra) com **fallback conservador**.
- **Montagem de contexto escopada:** buscar e injetar blocos Trinks (slots, serviços, profissionais, habilitação, agendamentos futuros) **apenas** conforme a intenção detectada.
- **Skip TESS (código + testes, default desligado):** heurística e template prontos; `TESS_SKIP_TRIVIAL=false` até shadow 7d / FPR &lt; 2% ([quality gate](../qa/tess-context-on-demand-quality-gate.md) §6).
- **Feature flag / kill switch** para reverter ao dump completo + TESS em toda mensagem (comportamento atual).
- **Logging de créditos TESS** por chamada (campo retornado pela API quando disponível) + snapshot agregável pós-deploy.
- **Testes unitários** do classificador e do builder escopado; gate @qa com smoke/eval documentado.

### OUT
- Mudança de modelo TESS (Haiku → outro, Thinking on/off via painel).
- `BOT_ACCEPT_ALL=true` ou alteração de whitelist / go-live irrestrito.
- Persistência Redis / novo serviço externo de classificação.
- Reescrita estrutural do prompt 46589 (story separada se necessário).
- Desligar supervisor 46590 ou Kapso Findings.

## Acceptance Criteria

### Intenção e fallback conservador
- [ ] **AC1:** Existe módulo testável (ex.: `backend/lib/intent-classifier.js`) que classifica cada turno em categorias mínimas: `TRIVIAL`, `FAQ`, `SCHEDULING`, `PRICING`, `CANCEL`, `RESCHEDULE`, `HANDOFF_LIKELY`, `UNCERTAIN`.
- [ ] **AC2 (fallback conservador):** Se confiança **baixa** ou categoria `UNCERTAIN` → **comportamento idêntico ao atual**: busca Trinks completa (slots multi-dia + profissionais + serviços + habilitação + future bookings) + **chamada TESS** com contexto equivalente ao dump legacy. Nenhuma economia neste path.
- [ ] **AC3:** Classificador coberto por testes com casos ambíguos ("quanto custa amanhã?", áudio transcrito ruidoso, mensagem longa multi-intenção) → **sempre** `UNCERTAIN` ou categoria que aciona contexto amplo + TESS.

### Contexto Trinks escopado por intenção
- [ ] **AC4:** Para `TRIVIAL` → **não** buscar slots/serviços/profissionais Trinks (zero chamadas API Trinks no hot-path, salvo perfil/agendamentos futuros se já carregados por outra razão).
- [ ] **AC5:** Para `FAQ` (endereço, pagamento, horário de funcionamento) → contexto mínimo: data/hora salão + notas operacionais + histórico; **sem** dump de 5 dias de slots nem lista completa de serviços, **a menos** que AC2 force fallback.
- [ ] **AC6:** Para `SCHEDULING` / `RESCHEDULE` → injetar slots (datas relevantes), serviços, profissionais, habilitação e agendamentos futuros conforme já faz hoje, podendo **reduzir** dias de slot quando data explícita na mensagem (`extractRequestedDate`).
- [ ] **AC7:** Para `PRICING` → serviços (+ habilitação se serviço específico detectado); **sem** slots multi-dia salvo fallback AC2.
- [ ] **AC8:** Para `CANCEL` → agendamentos futuros do cliente + contexto mínimo; slots completos só se fallback AC2.
- [ ] **AC9:** `buildDynamicContext` (ou sucessor escopado) recebe **perfil explícito de seções**; texto injetado permanece compatível com o prompt 46589 (mesmas labels: `HORARIOS`, `SERVICOS`, `PROFISSIONAIS`, etc.) — seções omitidas ficam ausentes, não vazias enganosas.

### Skip TESS em turnos triviais
- [ ] **AC10 (skip implementado, default off):** Allowlist trivial (ex. `"oi"`, `"olá"`, `"bom dia"`, `"obrigad*"`, `"valeu"` isolados, 1º turno, histórico vazio) **só** pula `callTESS()` se `TESS_SKIP_TRIVIAL=true`. Default **false**: classifica e loga (shadow) e **sempre** chama TESS.
- [ ] **AC11:** Skip TESS **nunca** ocorre se houver histórico recente indicando agendamento em andamento (ex.: último turno do assistente perguntou horário/serviço) → força TESS + contexto adequado.
- [ ] **AC12:** Skip TESS **nunca** ocorre para mídia (áudio/imagem) nem mensagens com > N caracteres (default 80) — parametrizável.

### Modelo, rollout e kill switch
- [ ] **AC13 (modelo TESS):** Nenhuma alteração de modelo no painel TESS nem parâmetro de API que troque Haiku/Thinking — verificável por Victor no dashboard **antes** do smoke piloto. Story **rejeita** deploy se modelo ≠ Haiku non-Thinking acordado.
- [ ] **AC14 (sem BOT_ACCEPT_ALL):** Story **não** inclui `BOT_ACCEPT_ALL=true` nem migration de whitelist. Piloto permanece whitelist Postgres atual.
- [ ] **AC15 (kill switch):** Env `TESS_CONTEXT_MODE` default `full` (dump atual). `scoped` = intent-on-demand. Valor inválido ou `TESS_CONTEXT_FORCE_FULL=1` → dump atual. Restart de container. Documentado em `infra/.env.example`.

### Observabilidade de créditos
- [ ] **AC16:** Cada chamada `callTESS()` registra structured log (JSON) com: `sessionId`, `intent`, `context_profile`, `skipped_tess` (bool), `tess_credits` (número se API retornar; senão `null`), timestamp. Log grepável em produção.
- [ ] **AC17:** Após deploy piloto (mín. 24h ou ≥20 mensagens whitelist), Victor ou @qa extrai média `tess_credits`/msg (`GET /workspaces/usage` e/ou logs AC16) e compara com baseline **ao vivo ~29,2 cr/msg** (154 execuções pagas 46589, 15/ago–01/set). O ~13 cr/msg do relatório de junho está **obsoleto**. Gate de go-live pleno (outra story): média móvel **&lt; 4 cr/msg** em ≥50 msgs whitelist. Resultado na seção QA Results.

### Qualidade — gate @qa
- [ ] **AC18:** `cd backend && npm test` verde incluindo novos testes de intent + context builder.
- [ ] **AC19 (eval):** Rodar subset mínimo de [tests/prompt-tests.json](../../tests/prompt-tests.json) via [tests/run-prompt-tests.js](../../tests/run-prompt-tests.js) **ou** eval manual documentado — **≥95%** dos cenários P0 de agendamento/FAQ/handoff da [docs/qa/salon-test-matrix.md](../qa/salon-test-matrix.md) (IDs 1, 4, 21–24, 41–43) **PASS** com flag `TESS_CONTEXT_ON_DEMAND=true` em staging/VPS whitelist.
- [ ] **AC20 (smoke piloto):** Sequência whitelist documentada: `"oi"` → skip TESS (log confirma) → `"quero cortar amanhã"` → TESS + contexto scheduling → resposta coerente com slots reais. Evidência em `docs/ops/` ou QA Results.
- [ ] **AC21 (regressão):** Com `TESS_CONTEXT_ON_DEMAND=false`, smoke idêntico ao pré-deploy (byte-compatible no perfil de contexto injetado — diff test ou snapshot).

## Env novas (proposta)
| Variável | Default | Função |
|---|---|---|
| `TESS_CONTEXT_MODE` | `full` | `full` = dump atual; `scoped` = contexto por intenção |
| `TESS_CONTEXT_FORCE_FULL` | unset | Se `1`, ignora `scoped` (emergência) |
| `TESS_SKIP_TRIVIAL` | `false` | Skip TESS só com `scoped` + esta flag `true` + allowlist (pós-shadow) |
| `TESS_TRIVIAL_MAX_CHARS` | `80` | Acima disso, nunca skip TESS |

## Tasks
1. [x] Extrair `classifyIntent(messageText, history)` + testes (AC1–3, 10–12).
2. [x] Extrair `buildScopedContext(intent, ...)` / perfis de fetch Trinks (AC4–9).
3. [x] Integrar em `processMessage()` com branch skip TESS + templates triviais (AC10–12).
4. [x] Feature flag + documentação env (AC15).
5. [x] Logging créditos TESS (AC16–17).
6. [ ] Testes + deploy VPS whitelist + smoke (AC18–21).

## Dev Notes

- **Ponto de integração:** bloco `Promise.allSettled([getSlots...])` em `processMessage()` (~L1114) hoje roda **antes** de saber a intenção — refatorar para classificar **primeiro** (texto + últimos N turnos), depois fetch condicional.
- **Conservadorismo > economia:** na dúvida, `UNCERTAIN` → path legacy. Preferir gastar crédito a errar horário/preço.
- **Skip trivial ≠ bot burro:** templates devem ser cordiais e pedir intenção; **não** usar para "qual o preço do corte?" mesmo que curto.
- **Créditos TESS:** resposta execute pode incluir campo de custo (validar shape real da API em dev); se ausente, logar `null` e usar amostragem manual na planilha TESS (AC17).
- **Tiago / comunicação:** nenhuma copy ao cliente ou dono sobre plano/créditos; changelog interno only.
- **Dependência:** Trinks webhook-first já reduz chamadas API; esta story ataca **tokens TESS**, camada ortogonal.

### Testing
- Unit: `backend/test/intent-classifier.test.js`, `backend/test/scoped-context.test.js` (novos).
- Integração leve: mock Trinks — assert **zero** fetch em trivial, fetch completo em uncertain.
- QA manual: matriz P0 em [docs/qa/salon-test-matrix.md](../qa/salon-test-matrix.md).
- Eval prompt: [docs/qa/prompt-eval/](../qa/prompt-eval/) como referência de gate histórico.

## CodeRabbit Integration
- **Primary Type:** API / performance optimization
- **Quality gate:** @architect (decisão de perfis de contexto); @qa (AC19–21)
- **Focus:** regressão de booking tags, fallback conservador, nenhum leak de skip em fluxo ativo

## Dev Agent Record

### Completion Notes
S0–S2 implementados (branch `feature/tess-context-on-demand`). Classificador + perfis + assembler integrados em `processMessage` com classify-then-fetch. Telemetria `tess.context_bytes` (S0) e `tess.turn` (AC16) via structured JSON log. Skip TESS default OFF (`TESS_SKIP_TRIVIAL=false`); shadow classifica+loga sempre. Follow-up Orion: `ensureSlotSnapshot` restaurado para data explícita fora da janela. **Bloqueado em S3:** eval TESS credits, deploy VPS, smoke AC19–21.

**Agent Model Used:** Composer 2.5 Fast (@dev Dex)

### File List
- `backend/lib/tess-context-config.js` (A)
- `backend/lib/tess-context-intent.js` (A)
- `backend/lib/tess-context-profiles.js` (A)
- `backend/lib/tess-context-assembler.js` (A)
- `backend/lib/tess-context-bytes.js` (A)
- `backend/lib/booking-parser.js` (M — `filterServicesByKeywords`, `formatServicesText`)
- `backend/server.js` (M — classify-then-fetch, skip branch, telemetry)
- `backend/test/tess-context-intent.test.js` (A)
- `backend/test/tess-context-profiles.test.js` (A)
- `backend/test/tess-context-assembler.test.js` (A)
- `infra/.env.example` (M)
- `docs/stories/salon-whatsapp-tess-context-on-demand.md` (M)

## QA Results
_(preencher @qa após AC18–21)_

| Gate | Resultado | Evidência |
|---|---|---|
| Unit tests | | |
| Eval P0 matriz | | |
| Smoke piloto whitelist | | |
| Média créditos/msg pós-ship | | |
| Kill switch verified | | |

## Change Log
| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-09-01 | 1.0 | Story Ready — contexto on-demand + skip trivial TESS | @po (Pax) |
| 2026-09-01 | 1.1 | Baseline créditos: 29,2 cr/msg (usage API); 10 dias de slots | @aios-master |
| 2026-09-01 | 1.2 | Alinhamento spec+QA: `TESS_CONTEXT_MODE`, skip default off, 4k não prometido | @aios-master |
| 2026-09-01 | 1.3 | Premissa invertida: arrumar tokens primeiro; pack teste 1.000 cr | @aios-master |
| 2026-09-01 | 1.4 | S0–S2 dev complete — classify-then-fetch, telemetry, tests green | @dev (Dex) |
