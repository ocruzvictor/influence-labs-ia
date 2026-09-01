# Quality Gate — TESS Context-on-Demand & Skip-List

**Data:** 2026-09-01  
**Autor:** Quinn (@qa)  
**Escopo:** reduzir créditos TESS sem regressão de marca Studio Tirra  
**Status:** **NEEDS_WORK** — plano aprovável; implementação e medição **não** provadas

> **Posição cética:** Orion propõe cortes (contexto sob demanda + skip de saudações). **Nada disso está validado em produção.** Este documento define o que medir, o que não sabemos, e as condições para **liberar** vs **fail-closed**.

---

## 0. Contexto técnico (baseline medido)

| Componente | Hoje (`backend/server.js`) | Custo estimado |
|---|---|---|
| Slots | `SLOT_CONTEXT_DAYS=10` dias úteis + sábados Claudia (`mergeSlotContextDates`) | ~10 blocos `HORARIOS VAGOS` |
| Catálogo | **Todos** os SKUs do snapshot (`getServicesText()` → ~117–119 linhas) | Injetado **em toda** mensagem |
| Profissionais | Lista completa (`getProfessionals()`) | 12 ativos |
| Histórico | Últimos 8 turnos + memória persistida (slice -8) | Variável |
| KB RAG | `memory_collections=[TIRRA_KB_COLLECTION_ID]` quando `KB_ACTIVE` | **Não instrumentado** |
| Classificador | **Inexistente** no hot-path WhatsApp — **100%** das msgs → `callTESS()` | — |
| Créditos medidos | **~29,2 cr/msg** (Haiku sem Thinking, 15/ago–01/set/2026, 154 execuções API). Jun/2026 ~13 cr/msg está **obsoleto** (contexto cresceu). Thinking ON em jun era ~27–30. | `GET /workspaces/usage` + `docs/analysis/custo-mensal-studio-tirra-2026-06.md` |

**Artefatos de eval existentes (reutilizar, não reinventar):**

| Artefato | O que cobre | Custo TESS |
|---|---|---|
| `tests/prompt-tests.json` + `tests/run-prompt-tests.js` | Router (37), receptionist (20), FAQ (20) — **legado n8n**, útil como **especificação** de intents | `--mock` = **R$ 0**; LLM externo ≠ TESS |
| `scripts/test-conversa-v3.mjs` | R1–R4, NR2–NR4, A1 sinônimos — **golden TESS 46589** | ~12 chamadas × ~13–29 cr |
| `scripts/test-conversa-v2-robust.mjs` | Multi-turno, batch debounce, warnings | ~10 chamadas |
| `docs/qa/salon-test-matrix.md` | 50 cenários manuais (P0/P1) | Humano + WhatsApp |
| `docs/ops/smoke-roteiro-46589-v3.1.4-2026-08-31.md` | 6 casos P0 pós-prompt (mechas, combo, calendário, preço Tiago, cancel N) | Humano + WhatsApp |
| `docs/ops/pilot-readiness-2026-06-26.md` | Gate GO/NO-GO piloto (10 blockers) | Humano + infra |

---

## 1. O que ainda NÃO sabemos (lacunas críticas)

### 1.1 Taxa de erro do classificador de intent (skip-list)

| Lacuna | Por que importa | Como fechar |
|---|---|---|
| **FPR** — saudação classificada como skip mas cliente quer agendar | Resposta genérica (“Oi! Como posso ajudar?”) pode **mascarar** intenção (“oi quero cortar amanhã”) | Suite **adversarial** derivada de `router_tests` + casos colados (`"oi"`, `"bom dia"`, `"valeu"`, `"ok"`) com **contexto** de conversa ativa |
| **FNR** — mensagem curta que **não** deveria ir ao TESS mas vai | Desperdício menor; aceitável se <5% do volume | Medir após deploy |
| **Ambiguidade contextual** — `"Andre"`, `"10h30"`, `"sim"` | `prompt-tests.json` já marca `context` — skip **proibido** se `history.length > 0` ou estado de booking pendente | Regra fail-closed: **skip só com histórico vazio E mensagem na allowlist estrita** |
| **Baseline de acurácia** | Não há classificador em prod — **zero** dados | Antes do skip: rodar classificador **shadow mode** (classifica, loga, **não** altera rota) por 7 dias em whitelist |

**[AUTO-DECISION]** Shadow mode obrigatório antes de skip em produção → **sim** (reason: FPR em “oi + intenção implícita” destrói conversão).

### 1.2 Respostas por conversa (replies/conversation)

| Lacuna | Valor assumido hoje | Fonte |
|---|---|---|
| Média de respostas do bot por conversa | **~4** (premissa) | `docs/analysis/custo-mensal-studio-tirra-2026-06.md` §3.2 |
| Distribuição (FAQ 1–2 vs agendamento 4–6) | Desconhecida | — |
| Impacto do skip na média | Desconhecido — skip só na 1ª bolha? | — |

**Como medir (barato):**

```sql
-- Postgres: contar assistant turns por session_id / phone (ajustar schema real)
SELECT phone, COUNT(*) FILTER (WHERE role = 'assistant') AS bot_replies
FROM conversation_messages
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY phone;
```

Gate de custo **total** = `avg_credits_per_msg × avg_replies_per_conv × conv/dia` — não basta `< 4 cr/msg` se replies/conv subir.

### 1.3 Participação do KB RAG no token budget

| Lacuna | Evidência |
|---|---|
| Quantos tokens/chunks o TESS injeta via `memory_collections` | **Nenhuma** — `callTESS()` não loga usage |
| Overlap contexto injetado vs RAG (duplicação FAQ/endereço) | Provável — OPERATIONAL_NOTES + KB + snapshot |
| Créditos atribuíveis ao RAG vs snapshot Trinks | **Impossível hoje** sem instrumentação |

**Como fechar (mínimo viável):**

1. Parsear campo de créditos/usage na resposta TESS (`responses[0].credits` ou equivalente — validar schema atual da API).
2. Persistir em `bot_operational_events`: `{ event: 'tess.usage', credits, context_bytes, rag_active, skip_tess: false }`.
3. Rodar **uma** bateria A/B com `KB_ACTIVE=true` vs `false` (mesmas 12 msgs v3) — delta = custo RAG.

---

## 2. Cenários golden — significado MUST NOT regress

Estes cenários definem **equivalência semântica**, não texto byte-a-byte. Pass = mesmo comportamento comercial e tags corretas.

### 2.1 Preço de UM profissional (R1 / smoke #5)

| Entrada | Significado que MUST persistir | Anti-padrões (FAIL) |
|---|---|---|
| `"quanto custa cortar com o Tiago?"` | **Um** valor do SKU Tiago; convite opcional a horários | Lista Erick/André; “premium”; comparativo de preços |
| `"qual o valor pra cortar com Tiago?"` | Resposta **direta** (NR3) — número na 1ª bolha | “Deixa eu ver…”, evasão |

**Eval:** `test-conversa-v3.mjs` → R1.1, NR3.1  
**Smoke humano:** roteiro §5

### 2.2 Sem comparativo não solicitado (R2 / R3)

| Entrada | MUST | FAIL |
|---|---|---|
| `"quanto custa um corte?"` (sem prof) | Faixa **ou** pergunta “com qual profissional?” | Mapa prof→preço (≥2 pares nome+R$) |
| Após R1, `"tem profissional mais em conta?"` | **Pode** citar alternativa; diferencia por **qualidade**, não “mais barato” | “economia”, “desconto”, “menor preço” |

**Eval:** R1.2, R2.1, R3.1

### 2.3 Tags de booking íntegras (NR2)

| Entrada | MUST | FAIL |
|---|---|---|
| Fluxo confirmação → `"isso!"` | `[BOOKING_CREATE …]` presente; **zero** `<break>` dentro da tag | Tag quebrada; tag vazando no WhatsApp |
| Cancel N | Uma tag por `bookingId`; IDs de `AGENDAMENTOS FUTUROS` | ID inventado; cancela booking de terceiro |

**Eval:** NR2.1, NR4.1 + smoke §6  
**Backend:** `stripBookingTags()` — regressão via `backend/test/booking-parser.test.js`

### 2.4 Expediente / calendário

| Entrada | MUST | FAIL |
|---|---|---|
| `"qual horário de funcionamento?"` | Ter–Sex 9–19, Sáb 9–18, Dom–Seg fechado | Horário inventado |
| `"tem horário dia 30/09?"` (2026 = quarta) | **Quarta** ou pergunta se dado ausente | Segunda, sábado errado |
| `HORARIO_AGORA` fora do expediente | Aviso Gabriel confere de manhã; **não** recusa agendar | “Estamos fechados, não agendo” |

**Eval:** FAQ em `prompt-tests.json`; smoke §3; `buildDynamicContext()` linhas de expediente  
**Manual:** matriz IDs 24, 9

### 2.5 Handoff humano

| Entrada | MUST | FAIL |
|---|---|---|
| `"quero luzes, maquiagem e pé no mesmo dia"` | Gabriel / `[HANDOFF_HUMAN motivo=multi_servico]`; **zero** POST | Mini-agenda com 2–3 CREATE |
| `"quanto custa luzes?"` | Teste de Mechas gratuito; **sem** preço fechado | R$ 880, R$ 0, duração final |
| Reclamação / `"quero falar com o Gabriel"` | Handoff imediato | Bot continua sozinho |
| Penteado/maquiagem (consultivo) | Handoff orçamento; sem CREATE | Booking direto |

**Eval:** smoke §1–2; matriz IDs 41–43, 20  
**Prompt:** I.1 passo 5, I.4 mechas/laser/penteado

### 2.6 Sinônimos de serviço (A1)

| Entrada | MUST |
|---|---|
| `"queria fazer o pé sábado"` | Pedicure **ou** desambiguação |
| `"queria fazer a mão amanhã"` | Manicure |

**Eval:** A1.1, A1.2

### 2.7 Formatação WhatsApp (R4)

| Entrada | MUST |
|---|---|
| Resposta conversacional multi-ideia | ≥1 `<break>` (exceto confirmação tripla = bloco único) |
| Confirmação tripla | **0** `<break>` no bloco estruturado |

**Eval:** R4.1, R4.2

---

## 3. A/B current vs context-on-demand — eval mais barato defensável

**Objetivo:** provar equivalência sem `29 cr × 200 msgs = ~5.800 cr`.

### 3.1 Estratégia em 3 camadas (custo crescente)

```
Camada 0 — Grátis (CI local)
  npm test                          → booking-parser, slot-windows, kb-camuflagem
  node tests/run-prompt-tests.js --lint-only --typecheck-only
  node tests/run-prompt-tests.js --mock   → 77 cenários estruturais

Camada 1 — TESS mínimo (~24–36 cr total)
  Variante A (FULL):     TRINKS_SLOT_CONTEXT_DAYS=10, catalog=full
  Variante B (ON_DEMAND): flag dev — slots 2d, catalog filtrado por intent
  node scripts/test-conversa-v3.mjs     → 12 casos × 2 variantes = 24 calls
  Critério: score B ≥ score A - 0.05 E zero FAIL em R1/R2/NR2/handoff

Camada 2 — Custo real whitelist (~50 msgs, ~650 cr no pior caso @13cr)
  50 inbound reais (replay ou live) em números whitelist
  Medir rolling avg credits/msg via API TESS
  Gate: média < 4 cr/msg (ver §4)

Camada 3 — Humano (sem TESS extra)
  smoke-roteiro 6 casos + matriz P0 pendentes (IDs 2,3,4,13,20,21,22,41,42)
```

### 3.2 Implementação A/B (requisito @dev)

| Flag | FULL (controle) | ON_DEMAND (tratamento) |
|---|---|---|
| `TESS_CONTEXT_MODE` | `full` | `on_demand` |
| Slots | 10 dias + sábados Claudia | 2 dias úteis + `requestedDate` + profissional mencionado |
| SERVICOS | Catálogo completo | Top-N por intent: preço → SKUs citados + sinônimos; agendar → serviço inferido + habilitação |
| Skip TESS | `false` | `true` só allowlist §6 |
| KB RAG | on | on (medir delta separado) |

**Replay barato:** logar `userMessageWithContext` em staging; reexecutar **só** a chamada TESS (sem Trinks/Kapso) — `scripts/replay-tess-context-ab.mjs` (a criar).

### 3.3 Por que NÃO fazer A/B em centenas de msgs

| Abordagem | Custo estimado | Defensibilidade |
|---|---|---|
| 200 msgs × 2 variantes × 29 cr | **~11.600 cr** | Alta estatística, **proibitivo** |
| 12 golden × 2 × 13 cr | **~312 cr** | Suficiente para **regressões de marca** (complementar com Camada 2) |
| Só skip-list sem golden | ~50 cr | **Indefensável** — economiza mas pode quebrar R1 |

---

## 4. Pass/fail gates

### 4.1 Gate de QUALIDADE (ambos obrigatórios)

| ID | Critério | Threshold | Bloqueante |
|---|---|---|---|
| Q1 | `test-conversa-v3.mjs` score ON_DEMAND | ≥ **0,85** e ≥ FULL − 0,05 | **SIM** |
| Q2 | Zero FAIL em {R1.1, R2.1, NR2.1, NR3.1, A1.*, handoff combo} | 0 FAIL | **SIM** |
| Q3 | `npm test` backend | 100% pass | **SIM** |
| Q4 | Smoke roteiro v3.1.4 (6 casos) | 6/6 PASS | **SIM** para expandir além whitelist |
| Q5 | Classificador shadow (7d) | FPR < **2%** em msgs com intenção oculta | **SIM** para skip-list |
| Q6 | Matriz P0 piloto | 10/10 PASS | **SIM** para `BOT_ACCEPT_ALL` |

### 4.2 Gate de CUSTO

| ID | Critério | Threshold | Janela |
|---|---|---|---|
| C1 | Média créditos TESS / msg bot | **< 4,0 cr/msg** | Últimas **50** msgs whitelist com usage logado |
| C2 | p95 créditos/msg | < **8 cr** | Mesma janela |
| C3 | Nenhuma msg > 15 cr | 0 ocorrências | Mesma janela (outlier = bug contexto) |
| C4 | Custo/conversa | < **16 cr** (assumindo ≤4 replies) | Derivado — revisar se replies/conv medido >4 |

**Fonte de créditos (ordem de preferência):**

1. Campo de usage na resposta `POST /agents/46589/execute` (instrumentar `callTESS()`).
2. Planilha/export TESS workspace (manual, D+1).
3. **Não** usar estimativa de tokens — créditos TESS ≠ tokens raw.

### 4.3 Veredito consolidado

| Resultado | Condição | Ação |
|---|---|---|
| **APPROVED** | Q1–Q4 + C1–C3 PASS | Liberar ON_DEMAND em whitelist; monitorar 14d |
| **NEEDS_WORK** | Qualidade OK, custo FAIL | Iterar contexto; **manter FULL** |
| **FAIL** | Q1/Q2 FAIL | **Fail-closed** — revert; investigar regressão |
| **FAIL (skip)** | Q5 FAIL | Desligar skip; TESS em tudo |

---

## 5. Fail-closed (não negociável)

```
IF eval_quality FAIL OR shadow FPR ≥ 2% OR C1 FAIL after 50 msgs:
  TESS_CONTEXT_MODE = full
  TESS_SKIP_ENABLED = false
  BOT_ACCEPT_ALL = false          # já deve estar false
  DO NOT expandir whitelist
  DO NOT desligar supervisor até P0 10/10
```

**Rollback operacional (< 5 min):**

1. Env `TESS_CONTEXT_MODE=full` + restart backend.
2. Confirmar `/health` → `bot.accept_all=false`.
3. Re-rodar `test-conversa-v3.mjs` (3 casos smoke: R1.1, NR2.1, combo handoff).

**Princípio:** economizar crédito **nunca** antecede resposta correta de preço/agenda/handoff.

---

## 6. Skip-list — o que é seguro em código vs MUST TESS

### 6.1 Seguro responder em código (allowlist estrita)

**Pré-condições ALL:**

- `history.length === 0` (primeiro turno **ou** sessão resetada >24h)
- Mensagem normalizada ∈ allowlist
- Sem nome de profissional, serviço, preço, data, hora, reclamação
- `TESS_SKIP_ENABLED=true` **e** shadow FPR < 2%

| Padrão (regex normalizada) | Resposta código (exemplo) | Crédito economizado |
|---|---|---|
| `^(oi\|ol[aá]\|e a[ií]\|hey\|bom dia\|boa tarde\|boa noite)[!.?\s]*$` | Saudação + “Como posso te ajudar?” | ~13–29 cr |
| `^(obrigad[oae]\|valeu\|brigad[oao\|vlw\|thanks)[!.?\s]*$` | “Por nada! Precisa de mais alguma coisa?” | ~13–29 cr |
| `^(tchau\|at[eé]\|flw\|falou)[!.?\s]*$` | Despedida cordial | ~13–29 cr |
| `^[👍👋🙏😊]+[\s!.]*$` | Emoji ack curto | ~13–29 cr |

**Volume esperado:** ~15–25% das conversas (só 1ª bolha) — **não** 15% de todas as msgs se replies/conv ≈ 4.

### 6.2 MUST sempre hit TESS (denylist / fail-closed)

| Categoria | Exemplos | Motivo |
|---|---|---|
| **Preço / serviço** | “quanto custa”, “valor”, “mechas”, “luzes”, “corte”, “manicure” | R1/R2/NR3; snapshot autoritativo |
| **Agenda** | “horário”, “agendar”, “cancelar”, “remarcar”, datas, “amanhã”, “sábado” | Tags booking; slots dinâmicos |
| **Profissional** | Tiago, André, Erick, Gi, Fefe, Claudia, … | Habilitação + preço por SKU |
| **Handoff triggers** | reclamação, “Gabriel”, “humano”, combo multi-serviço | `[HANDOFF_HUMAN]` |
| **Confirmação ativa** | “sim”, “isso”, “confirmo”, “10h30”, “pode ser” | Estado conversacional — **contexto importa** |
| **Mensagem composta** | “oi quero cortar amanhã” | Intent misto — **nunca** skip |
| **Áudio / mídia** | voice note, imagem | Transcrição + TESS |
| **Curta ambígua** | “???”, “?” , “ok” (com histórico) | `router_tests` → humano/faq incerto |
| **Cliente conhecido + nome Trinks** | “oi, quero cortar” (DADOS_CLIENTE preenchido) | Identidade + fluxo — TESS com contexto mínimo |

### 6.3 Zona cinza — TESS com contexto **mínimo** (não skip)

| Caso | Tratamento |
|---|---|
| FAQ estático (endereço, Pix, estacionamento) | TESS **ou** template código **com** KB estática — só após A/B provar equivalência; default = TESS |
| “Qual o endereço?” | Golden R4.3 — resposta curta; candidato a template **depois** de Q1 pass |

---

## 7. Plano de execução (ordem)

| Fase | Responsável | Entrega | TESS cr aprox |
|---|---|---|---|
| F0 | @dev | Instrumentar `tess.usage` em `callTESS()` + flag `TESS_CONTEXT_MODE` | 0 |
| F1 | @dev | Implementar `buildDynamicContextOnDemand()` | 0 |
| F2 | @qa | Rodar Camada 0 + Camada 1 A/B | ~312 |
| F3 | @qa | Shadow classificador 7d whitelist | 0 (só logs) |
| F4 | Victor | Smoke roteiro 6 casos em staging ON_DEMAND | 0 TESS extra (WhatsApp) |
| F5 | @qa | Camada 2: 50 msgs whitelist + gate C1 | ~650 |
| F6 | @qa | Atualizar `pilot-readiness` + veredito | 0 |

---

## 8. Veredito QA (2026-09-01)

| Dimensão | Status |
|---|---|
| Plano de gate | **APPROVED** (este documento) |
| Implementação context-on-demand | **NEEDS_WORK** — não mergeável sem F0–F2 |
| Skip-list em produção | **FAIL** — proibido até Q5 |
| Meta `< 4 cr/msg` | **NÃO PROVADA** — Orion não claim; medir na Camada 2 |
| Expansão / BOT_ACCEPT_ALL | **FAIL-closed** — manter whitelist + contexto FULL até Q1–Q4 + C1 |

**Recomendação final:** ship **context-on-demand** primeiro (sem skip); validar golden + custo; **só então** skip-list com shadow. Qualidade Studio Tirra > economia.

---

## Apêndice A — Comandos

```bash
# Camada 0
cd backend && npm test
node tests/run-prompt-tests.js --lint-only
node tests/run-prompt-tests.js --mock

# Camada 1 (requer TESS_API_TOKEN + prompt v3.1.5 no painel)
node scripts/test-conversa-v3.mjs
# Comparar results JSON entre FULL e ON_DEMAND

# Regressão booking tags
cd backend && npm test -- booking-parser.test.js
```

## Apêndice B — Rastreabilidade

| Requisito de marca | Teste automático | Smoke manual |
|---|---|---|
| Preço único prof | R1.1, NR3.1 | Roteiro §5 |
| Sem comparativo | R2.1, R3.1 | — |
| Tags íntegras | NR2.1 | Roteiro §6 |
| Expediente | FAQ prompt-tests | Roteiro §3, Matriz 24 |
| Handoff combo/meias | — (adicionar em v3) | Roteiro §1–2, Matriz 20 |
| Sinônimos | A1.1, A1.2 | — |

**Gap identificado:** `test-conversa-v3.mjs` **não** cobre combo multi-serviço (smoke §2) — **adicionar** antes de APPROVED final.
