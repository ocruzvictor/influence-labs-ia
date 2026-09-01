# Story: Bot 46589 — Janela de duração, HABILITACAO Gi/Fefe, camuflagem, log TESS failed

**Tipo:** Brownfield improvement (bot WhatsApp TESS 46589)
**Status:** 🟢 **Done** — backend em produção (rsync + rebuild 2026-09-01 15:10 UTC); prompt v3.1.5 colado e salvo no TESS 46589 (Victor, 01/09 ~14:07 BRT)
**Agente executor:** @dev (Dex) · gates @architect / @qa · cola TESS: Victor (sem crédito; execute ainda fora)
**Story Points:** 5
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 01/09/2026, a partir do incidente Jessica + smoke Fefe (05/09) + áudio camuflagem (Gi).

## Squad e controle

| Persona | Papel nesta story |
|---|---|
| **Orion (@aios-master)** | Orquestra; não inventa requisito fora do incidente + áudio + pedido do Tiago |
| **River (@sm)** | Story, ACs, IN/OUT, file list |
| **Aria (@architect)** | Janela contígua nos slots + override operacional de HABILITACAO (não espera o cadastro Trinks) |
| **Pax (@po)** | IN: os 4 itens do incidente. OUT: SKU Gloss/Capral, crédito TESS, cliente Jessica (já agendou com o Tiago no salão) |
| **Dex (@dev)** | Código + testes sem `execute` TESS |
| **Quinn (@qa)** | Gate: `npm test` no backend; fixture Fefe 05/09; sem smoke WhatsApp até crédito TESS |

## Contexto (evidência de prod, 01/09/2026)

1. **Jessica** `5511989318027` — 10:38 BRT, *“Corte de cabelo feminino, com o Tiago.”* TESS 46589 `status: failed` (id `21300921`). Fallback técnico enviado. **Já agendou manualmente com o Tiago** — sem reteste nela. Aprendizado: log truncava o JSON em 300 chars e dumpava o `input`.
2. **Fefe** `5511975772987` — sábado 05/09, maquiagem 120 min. Snapshot só `14:00` e `14:30` livres; Michelle confirmada **15:00 / 120 min**. Bot ofereceu 14:00–16:00. `getSlots()` é agnóstico à duração.
3. **HABILITACAO maquiagem** no Trinks ainda listava Eli + Fefe + Kamila. Tiago pediu filtro operacional: **maquiagem = Fefe; penteado = Gi**. Ele tirou Kamila/Eli no salão e não sabia se o snapshot tinha atualizado.
4. **Camuflagem** — Gi `5511963014905`. Gloss / Capral / Trans / Igora são **como o lead chega falando**, **não SKUs à venda**. KB não tinha o serviço. Bot mapeou tintura genérica e falhou no TESS nas perguntas seguintes.

## Decisão de arquitetura (Aria) — travada

### Item 2 — horários

| Opção | O que faz | Trade-off |
|---|---|---|
| A | Filtrar `getSlots` por duração default (60 min) | Quebra manicure 30 min e maquiagem 120 min |
| **B (escolhida)** | Anotar cada início com **minutos contínuos livres** + regra de prompt + **gate no CREATE/RESCHEDULE** | Modelo ainda precisa ler o número; o POST não passa se a janela não cabe |
| C | Trocar a lista de inícios por só faixas `14:00–15:00` | Quebra I.11 (“início literalmente em HORARIOS VAGOS”) |

**Algoritmo B:** por profissional/dia, ordenar `starts_at` disponíveis (após filtro de expediente). Grain = mediana dos deltas (fallback 30 min). Para cada início, contar slots consecutivos no grain até o buraco. Injetar `14:00 (60min contínuos), 14:30 (30min contínuos)`. Só oferecer se `duracaoMinutos ≤ contínuos`. Fixture Fefe 05/09: 14:00→60, 14:30→30; maquiagem 120 → nenhum cabe.

### Item 3 — HABILITACAO

Override **depois** do snapshot Trinks, em `getServicesText` → `applyOperationalHabilitacao`: maquiagem/make → só Fefe; penteado → só Gi. Não depende do cadastro Trinks estar atualizado. Não inventa SKU.

### Item 1 — log TESS

Log **estruturado**: `response_id`, `status`, `error`/`message`/`reason`, `input_chars`, chaves do objeto. **Não** dumpar o `input` (PII + contexto). Jessica não retesta.

### Item 4 — camuflagem

Serviço **na KB** (sinônimo + regra comercial + FAQ). Sem SKU Gloss/Capral/Trans/Igora. Mapear ao SKU de coloração do snapshot (`Coloração / Tonalização`, `Retoque de Raiz`, `Coloração Global`) depois de esclarecer se é só raiz / brancos. Tonalizante nos brancos **não** é combo de dois serviços.

### Teste sem crédito TESS

- Unit tests Node (`backend/test`).
- Fixture determinística Fefe 05/09.
- Grep/asserções de KB e prompt no repo.
- **Não** chamar `agents/46589/execute`. Prompt 3.1.5 no repo; Victor colou e salvou no TESS 46589 em 01/09/2026 (~14:07 BRT). Smoke WhatsApp continua fora até haver crédito de execute.

## Acceptance Criteria

- [x] **AC1 (log TESS):** `summarizeFailedTessResponse` cobre `status:failed` sem o texto de `input`. `console.error` usa o resumo. Teste com payload estilo `21300921`.
- [x] **AC2 (injeção de janela):** `HORARIOS VAGOS` lista início + `(NNmin contínuos)`. Fixture 14:00+14:30 → 60 e 30. Header manda só oferecer se duração ≤ contínuos.
- [x] **AC3 (gate CREATE/RESCHEDULE):** início cuja janela contínua < `duracaoMinutos` → bloqueia, copy honesta, evento `guard.blocked` kind `janela`. Expediente (I.11 fechamento) permanece. Incompatível continua ganhando de expediente.
- [x] **AC4 (HABILITACAO operacional):** Maquiagem no contexto = só Fefe, mesmo com Eli/Kamila no Trinks. Penteado = só Gi. Corte/escova inalterados. `renderHabilitacaoMap` e catálogo `SERVICOS` usam a lista já filtrada.
- [x] **AC5 (KB camuflagem):** sinônimos (camuflagem, gloss como marca perguntada, brancos, tonalizante nos brancos) + regra comercial + FAQ. Explicitar: **não vendemos Gloss**; marcas de uso Capral/Trans/Igora são contexto, não SKU. Sem preço inventado.
- [x] **AC6 (prompt 3.1.5):** I.11 contínuos; I.4 camuflagem + penteado/maquiagem só Gi/Fefe. Changelog + handoff. Colado e salvo no TESS 46589 (Victor, 01/09/2026).
- [x] **AC7 (sem TESS execute):** `cd backend && npm test` verde. Sem smoke WhatsApp obrigatório.

## IN

- Log TESS failed estruturado.
- Janela contínua + gate.
- Override HABILITACAO Gi/Fefe.
- KB/prompt camuflagem (não-SKU).

## OUT

- Reteste com Jessica / POST na agenda dela.
- Criar SKUs Gloss, Capral, Trans, Igora na Trinks.
- `BOT_ACCEPT_ALL`, número 94831, supervisor 46590.
- Reabrir AC17–23 Fase D.
- Smoke WhatsApp / `agents/46589/execute` (crédito TESS).

## Tasks

- [x] Story + Dev Notes (este arquivo)
- [x] `lib/tess-errors.js` + testes
- [x] `lib/slot-windows.js` + testes (fixture Fefe)
- [x] `getSlots` anota contínuos; CREATE/RESCHEDULE usam `bookingFitsSlotWindow`
- [x] `pickCreateGuard` kind `janela`
- [x] `applyOperationalHabilitacao` + `getServicesText`
- [x] KB + prompt 3.1.5 + changelog + handoff
- [x] `npm test` backend
- [x] Deploy VPS (`docker compose up -d --build backend` + restart nginx) — rsync dos 5 arquivos + rebuild 2026-09-01 15:10 UTC, `/health` ok, Trinks ping ok
- [x] Colar prompt 3.1.5 no TESS 46589 — Victor colou e salvou 01/09/2026 ~14:07 BRT (cola não gasta crédito)

## File List

- `docs/stories/salon-whatsapp-bot-46589-janela-habilitacao-camuflagem.md`
- `backend/lib/tess-errors.js`
- `backend/test/tess-errors.test.js`
- `backend/lib/slot-windows.js`
- `backend/test/slot-windows.test.js`
- `backend/lib/booking-parser.js`
- `backend/lib/booking-guards.js`
- `backend/test/booking-parser.test.js`
- `backend/test/booking-guards.test.js`
- `backend/server.js`
- `data/kb/conversa-v2/sinonimos-servicos.md`
- `data/kb/conversa-v2/regras-comerciais.md`
- `data/kb/conversa-v2/faq-servicos.md`
- `data/kb/conversa-v2/fichas-tecnicas-servicos.md`
- `docs/prompts/tess-conversa-v3-clean.md`
- `docs/prompts/CHANGELOG-46589.md`
- `docs/prompts/README-46589.md`
- `docs/prompts/archive/tess-conversa-46589-v3.1.5-2026-09-01.md`
- `docs/handoffs/46589-prompt-changes-2026-09-01-janela-camuflagem.md`
- `backend/test/kb-camuflagem.test.js`

## Dev Notes

- `ends_at` no snapshot de slots da Fefe veio vazio — grain por delta de `starts_at`, não por `ends_at`.
- Gate de penteado/maquiagem (Fase E, `needsReferenceService`) já bloqueia POST; HABILITACAO filtrada evita o modelo **oferecer** Eli/Kamila na conversa.
- `OPERATIONAL_NOTES` no contexto dinâmico + prompt v3.1.5 no agente 46589 (colado 01/09). Collection 39496 não precisa de sync para estes ACs. Smoke `execute` segue bloqueado por crédito.
- Camuflagem: SKU Trinks existente `Coloração / Tonalização` pode ser o alvo depois da desambiguação; não criar linha de catálogo fantasma.
