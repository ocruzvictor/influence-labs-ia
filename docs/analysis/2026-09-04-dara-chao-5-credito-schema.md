# Chão 5 — tetos de schema: crédito Tess por turno

**Autor:** Dara (@data-engineer)  
**Motor:** Grok 4.6 High  
**Data:** 2026-09-04  
**Status:** SOT de modelo — Dex persiste **neste** contrato. Sem tabela nova. Sem apply neste artefato.  
**Story:** [salon-whatsapp-chao-5-credito-dimensao](../stories/salon-whatsapp-chao-5-credito-dimensao.md)  
**Fecha:** PV-P1-2 · G-P6  
**Não é:** migration aplicada, CREATE TABLE no VPS, Hostinger, compra de crédito, cap `fa0ec92`, smoke `0007`, skip FAQ (OP013).

> **Não promete 13,5 cr.** Piso medido no fio `0007` já era ~17–21 em MIN. Este modelo torna “cortamos token” um `SUM` por intent × perfil × chars × créditos — não um alvo de fatura.

**Este artefato:** last4 only (`0007`). Sem E.164. Telefone completo não aparece abaixo.

---

## 0. Decisão única (owner = Dara)

**Estender o evento `tess.turn` em `bot_operational_events`. Não criar `tess_turn_credits`.**

| Alternativa | Veredito | Por quê |
|---|---|---|
| Nova tabela `tess_turn_credits` | **Recusada** | As quatro dimensões já cabem no evento que PV-P0-1 abriu. Terceiro write no hot-path (bytes + turn + ledger) sem ganho de query que índice parcial + `salon_day` no JSON não resolva. Aria P-BUDGET: telemetria Tess = evento, sem tabela nova. |
| Colunas novas em `tess_credit_usage_daily` | **Recusada** | Agregado do dia é o total. Dimensão no dia vira pivot sem turno — G-P6 continua infalsificável. |
| Só stdout / só daily | **Recusada** | É o gap. Stdout já se perdeu em rebuild (G-P2). |
| Estender `tess.turn` | **SOT** | Já grava intent, profile, `tess_credits`, chars. Falta timeout, `sent_chars` canônico, `salon_day`, persist no abort, índices de rollup, retenção. |

`tess_credit_usage_daily` **permanece**. É o contador de alerta (`recordTessCredits` / `checkTessCredits`). `tess.turn` é o ledger do turno. Um não substitui o outro.

`tess.context_bytes` **não** é o ledger de crédito. Bytes ≠ créditos. Aria: um não substitui o outro.

`tess.timeout` **permanece** como incidente. O turno com crédito (ou crédito nulo + `timed_out`) mora em `tess.turn`. Dex **não** some créditos a partir de `tess.timeout`.

*[AUTO-DECISION] tabela nova vs evento → evento `tess.turn` (reason: persist já existe; G-P6 é furo de contrato/caminho, não de entidade; Gage R4 já alerta write amp — não somar tabela).*

---

## 1. O que o banco já tem (não republicar)

### 1.1 Agregado do dia — `tess_credit_usage_daily` (014 + 015)

| Coluna | Tipo | Papel |
|---|---|---|
| `day` | `DATE` PK | `salonDayKey` = `America/Sao_Paulo` |
| `credits_used` | `NUMERIC(14,6)` | Soma local do que `extractTessCredits` devolveu |
| `calls` | `INTEGER` | +1 por `recordTessCredits` (skip com 0 cr **conta**) |
| `alerted_thresholds` | `JSONB` | Limiares já avisados |
| `account_used` / `account_remaining` | `NUMERIC(14,6)` | Snapshot da API Tess (carteira), não dimensão |

`recordTessCredits` é `INSERT … ON CONFLICT (day) DO UPDATE` — fire-and-forget, sem intent/perfil/chars.

### 1.2 Evento do turno — `tess.turn` em `bot_operational_events` (010)

Tabela existente (`infra/migrations/010_bot_operational_events.sql`):

| Coluna | Tipo | Papel |
|---|---|---|
| `id` | `BIGSERIAL` PK | Ordem de insert |
| `received_at` | `TIMESTAMPTZ` | Relógio do Postgres |
| `event` | `TEXT` | `'tess.turn'` |
| `client_phone` | `TEXT` | **Padrão da casa** — dígitos, sem `+`. Só nesta coluna. |
| `motivo` | `TEXT` | `${intent}:${context_profile}`, max 500 (`sliceMotivo`) |
| `kapso_conversation_id` | `TEXT` | Nullable; `tess.turn` hoje não preenche |
| `payload` | `JSONB` | Dimensões — **sem telefone** |

`persistTessTurnEvent` (`tess-context-bytes.js`) já grava:

```json
{
  "intent": "SCHEDULING",
  "confidence": "high",
  "context_profile": "BOOKING",
  "tess_credits": 18.4,
  "skipped_tess": false,
  "total_chars": 4000,
  "trace_id": "…",
  "sessionId": "…"
}
```

Caminhos live que **já** chamam o persist: skip trivial e `callTESS` com resposta (inclui `tess.empty` depois — o turn já saiu).  
Caminho que **não** chama: timeout — `createTessTimeoutEvent` + `return` em `server.js`. G-P6 fica buraco exatamente no turno que mais precisa de dimensão (91k / 25s).

### 1.3 Extração de crédito

`extractTessCredits(raw)` lê, nesta ordem: `responses[0].credits` · `responses[0].credit_cost` · `raw.credits` · `raw.credit_cost` · `usage.credits`. Primeiro número finito `≥ 0` vence. `null` → `recordTessCredits` no-op **a menos que** o caller passe `?? 0` (skip e sucesso fazem isso).

---

## 2. Contrato do payload `tess.turn` (Dex preenche)

Um row por tentativa de turno Tess (paga, skip, timeout, empty). Append-only. Sem UPDATE.

### 2.1 Campos obrigatórios

| Campo | Tipo JSON | Obrigatório | Fonte | Nota |
|---|---|---|---|---|
| `intent` | string \| null | sim | classificador | Canônicos: `TRIVIAL` · `FAQ` · `PRICING` · `SCHEDULING` · `CANCEL` · `RESCHEDULE` · `HANDOFF_LIKELY` · `UNCERTAIN` |
| `context_profile` | string \| null | sim | assembler | `MIN` · `FAQ` · `PRICE` · `BOOKING` · `CANCEL` · `FULL` |
| `confidence` | string \| null | sim | classificador | `high` / `low` |
| `tess_credits` | number \| null | sim (pode null) | `extractTessCredits` | Timeout → `null`. Skip → `0`. Nunca inventar remaining. |
| `sent_chars` | integer | sim | §2.2 | Chars **enviados**. Não é `blocks.total`. |
| `timed_out` | boolean | sim | catch timeout | `true` só no abort 25s. Skip/sucesso/empty = `false`. |
| `skipped_tess` | boolean | sim | `shouldSkipTess` | |
| `salon_day` | string `YYYY-MM-DD` | sim | `salonDayKey(now)` | Mesmo fuso do agregado. **Não** derivar de `received_at` UTC na query. |
| `trace_id` | string \| null | sim (pode null) | turno | Já existe no persist |
| `sessionId` | string \| null | sim (pode null) | turno | Já existe |

### 2.2 `sent_chars` — predicado único

```
pago / empty: sent_chars = userMessageWithContext.length
skip:         sent_chars = 0
timeout:      sent_chars = userMessageWithContext.length  (o que ia embora; o abort é de relógio)
```

`userMessageWithContext` = `dynamicContext + "\n\nMENSAGEM DO CLIENTE: " + clientLine`. É o array que `callTESS` recebe.

**Proibido** usar `measureContextBlocks().total.chars` como dimensão de crédito. Esse `total` soma `user_payload` e conta o payload duas vezes (Aria P-BUDGET §2.2). O `total_chars` que o persist grava hoje **não é a dimensão**. Dex troca a fonte; pode manter `total_chars` um release como telemetria velha, mas o relatório e o AC2 leem **`sent_chars`**.

`budget_chars` (`dynamicContext.length`) **não** entra neste ledger. Mora em `tess.context_bytes` / `tess.context_trimmed`. Quatro eixos do story: intent × profile × chars enviados × créditos.

### 2.3 Exemplo (last4 `0007` só no comentário de export)

Payload persistido — **sem** telefone, sem texto, sem grade:

```json
{
  "intent": "SCHEDULING",
  "confidence": "high",
  "context_profile": "BOOKING",
  "tess_credits": 18.4,
  "sent_chars": 10742,
  "timed_out": false,
  "skipped_tess": false,
  "salon_day": "2026-09-04",
  "trace_id": "…",
  "sessionId": "…"
}
```

Export / CLI / handoff: `last4=0007`. Coluna `client_phone` não sai.

### 2.4 Coluna vs payload — telefone

| Onde | Telefone |
|---|---|
| `bot_operational_events.client_phone` | Sim — padrão da casa (dígitos, sem `+`). Mesmo `emitOperationalEvent` de `tess.context_bytes`. |
| `payload` | **Não** |
| `motivo` | **Não** |
| stdout JSON `tess.turn` | **Não** |
| Este doc / relatório / CLI | last4 only |

Não inventar coluna `last4`. Máscara é da camada de export (`salao-cli`, Nightwatch), não do schema.

---

## 3. Caminhos de escrita (o que o Dex liga)

| Caminho | `tess.turn` | `recordTessCredits` | `tess.timeout` |
|---|---|---|---|
| Skip trivial | sim · cr=0 · `sent_chars=0` · `timed_out=false` | sim (`?? 0`) — incrementa `calls` | não |
| `callTESS` ok (texto ou empty) | sim · cr extraído ou `?? 0` | sim | não |
| Timeout 25s | **sim (hoje falta)** · `tess_credits=null` · `timed_out=true` · `sent_chars` do payload montado | **não** — crédito desconhecido; não inflar o dia | sim (já existe) |
| Retry premium (`sanitizePremiumResponse`) | **fora** — um turn, créditos do `tessRaw` principal. Não somar o retry neste story | — | — |

Timeout **não** entra no `SUM` que reconcilia com `credits_used` (crédito null). Entra no relatório de dimensão como linha `timed_out=true` para o chão 6 (timeout por perfil) ter denominador.

Idempotência: um insert por tentativa. Sem unique em `trace_id` neste story (trace ainda pode ser null). Folga do AC3 (±1 turno) cobre retry de processo, não duplicate-key.

---

## 4. Reconciliação com o agregado do dia

Predicado do dia = `payload->>'salon_day' = tess_credit_usage_daily.day` (texto ISO = date). **Não** usar `received_at::date` (UTC vira dia errado depois das 21h BRT).

### 4.1 Query canônica (AC3)

```sql
-- Folga do story: ±1 turno (1 call e créditos desse turno).
WITH turn AS (
  SELECT
    payload->>'salon_day' AS salon_day,
    COUNT(*) FILTER (
      WHERE COALESCE((payload->>'timed_out')::boolean, false) = false
    ) AS turn_calls,
    COALESCE(SUM(
      CASE
        WHEN COALESCE((payload->>'timed_out')::boolean, false) THEN 0
        ELSE COALESCE((payload->>'tess_credits')::numeric, 0)
      END
    ), 0) AS turn_credits
  FROM bot_operational_events
  WHERE event = 'tess.turn'
    AND payload->>'salon_day' = $1          -- mesmo salonDayKey do agregado
  GROUP BY 1
)
SELECT
  d.day,
  d.calls,
  d.credits_used,
  t.turn_calls,
  t.turn_credits,
  (d.calls - COALESCE(t.turn_calls, 0)) AS calls_delta,
  (d.credits_used - COALESCE(t.turn_credits, 0)) AS credits_delta
FROM tess_credit_usage_daily d
LEFT JOIN turn t ON t.salon_day = d.day::text
WHERE d.day = $1::date;
```

**Pass:** `abs(calls_delta) ≤ 1` **e** `abs(credits_delta)` ≤ créditos do turno mais caro daquele dia (proxy: ≤ o maior `tess_credits` do dia, ou 50 cr se a amostra for vazia). Story escreveu “±1 turno”.

Timeout-only rows **não** entram em `turn_calls` / `turn_credits`. Se Dex passar a dar `recordTessCredits` no timeout, o delta quebra — por isso a tabela §3 veta.

### 4.2 Relatório de dimensão (o dente do G-P6)

```sql
SELECT
  payload->>'intent' AS intent,
  payload->>'context_profile' AS context_profile,
  COUNT(*) AS turns,
  COUNT(*) FILTER (WHERE COALESCE((payload->>'timed_out')::boolean, false)) AS timed_out,
  ROUND(AVG(COALESCE((payload->>'sent_chars')::int, 0))) AS avg_sent_chars,
  ROUND(SUM(COALESCE((payload->>'tess_credits')::numeric, 0)), 2) AS credits
FROM bot_operational_events
WHERE event = 'tess.turn'
  AND payload->>'salon_day' = $1
GROUP BY 1, 2
ORDER BY credits DESC;
```

Export desta query: **sem** `client_phone`. last4 só se o operador pedir amostra e o CLI já mascarar.

Não criar VIEW neste story. Query no CLI / notas do Dex basta.

---

## 5. Índices (propostos — **não aplicados**)

Índices atuais da 010: `(event, received_at DESC)` e `(received_at DESC)`. Servem o scan por tipo. Não servem `GROUP BY salon_day × intent × profile`.

Dex/Gage, **migration futura** (próximo número livre depois de `017`; **não** criar o arquivo neste handoff Dara; **não** rodar no VPS agora):

```sql
-- Rollup do dia (AC3) e relatório §4.2
CREATE INDEX IF NOT EXISTS idx_bot_op_tess_turn_salon_day
  ON bot_operational_events ((payload->>'salon_day'))
  WHERE event = 'tess.turn';

CREATE INDEX IF NOT EXISTS idx_bot_op_tess_turn_day_dim
  ON bot_operational_events (
    (payload->>'salon_day'),
    (payload->>'intent'),
    (payload->>'context_profile')
  )
  WHERE event = 'tess.turn';
```

Rollback: `DROP INDEX IF EXISTS` dos dois. Sem `DROP TABLE`. Sem `ALTER` destrutivo.

Não precisa de GIN no `payload` inteiro. Não precisa de índice em `tess_credits`. Não particionar `bot_operational_events` neste story (Gage R4 = vigilância, não redesign).

---

## 6. Retenção

| Objeto | Retenção | Quem apaga | Neste story |
|---|---|---|---|
| `tess.turn` | **90 salon-days** | job futuro @devops (P-PRIV) | **Só documentar.** Dex não dá `DELETE`. |
| `tess.context_bytes` / `tess.context_trimmed` | mesmo horizonte quando o job existir | idem | não mexer |
| `tess.timeout` / `booking.*` / `handoff.*` | incidentes — **não** entram no purge de 90d deste contrato | — | não mexer |
| `tess_credit_usage_daily` | **indefinido** (1 row/dia) | ninguém neste epic | não mexer |

Purge futuro (não executar agora), last4 never in the job log:

```sql
-- Só event = tess.turn. Nunca o agregado diário. Nunca booking/handoff.
DELETE FROM bot_operational_events
 WHERE event = 'tess.turn'
   AND received_at < NOW() - INTERVAL '90 days';
```

Janela de 90d cobre “o corte de contexto reduziu X%?” entre ondas. Abaixo disso G-P6 volta a ser debate de stdout.

---

## 7. O que o Dex **não** grava

Proibido no `payload`, no `motivo`, no stdout `tess.turn`, em teste de persistência publicado, em comentário de migration:

- Texto da mensagem do cliente ou da Tess  
- Grade / `horarios` / catálogo / habilitação / histórico / future bookings  
- Nome civil, e-mail, handle  
- E.164 ou dígitos de telefone (coluna `client_phone` é a única exceção, via `emitOperationalEvent`)  
- `root_id` Tess, body bruto da API, thinking  
- Nota de resume / `operatorResumeTrigger`  
- Nota de 13,5 cr como meta ou default  
- `grade` / score de qualidade / avaliação humana  

`approx_tokens` **não** é eixo deste ledger. Se o Dex quiser telemetria, fica em `tess.context_bytes`.

---

## 8. O que o Dex muda (nível arquivo)

Produção JS = Dex. Dara não implementa. Dara **não** abre `infra/migrations/018_*`.

| Arquivo | Ação |
|---|---|
| `backend/lib/tess-context-bytes.js` → `persistTessTurnEvent` | Aceitar `sentChars`, `timedOut`, `salonDay`. Gravar os campos §2.1. Parar de usar `total_chars` como dimensão. Telefone só no argumento `clientPhone` da coluna. |
| `backend/lib/tess-context-assembler.js` → `logTessTurnTelemetry` | Espelhar `sent_chars`, `timed_out`, `salon_day` no JSON de stdout. Sem telefone. |
| `backend/server.js` | Timeout: **antes** do `return`, `persistTessTurnEvent` com `timedOut: true`, `tessCredits: null`, `sentChars` do `assembledCtx.userMessageWithContext`. Skip/sucesso: passar `sentChars` certo + `salonDay: salonDayKey()`. Não chamar `recordTessCredits` no timeout. |
| `backend/test/tess-context-bytes-persist.test.js` | AC2: `SCHEDULING` + `BOOKING` grava intent, profile, `sent_chars`, `tess_credits`. Timeout fixture: `timed_out=true`, credits null. Payload sem chave de telefone / texto. |
| CLI de dimensão (opcional) | Query §4.2; saída last4 se houver amostra. Pode ficar para story 6. |

### Não mexer

- `tess_credit_usage_daily` schema / `recordTessCredits` fórmula  
- Caps `fa0ec92` / `tess-context-budget.js`  
- `shouldSkipTess` / OP013  
- Prompt 46589 · Hostinger · Trinks mutate · allowlist · `BOT_ACCEPT_ALL`  
- Smoke `0007`  
- CREATE TABLE · apply no VPS · git commit/push  

---

## 9. Segurança e RLS

`influence_labs_salon` no VPS não é Supabase Auth. `bot_operational_events` **não** ganha RLS neste story (nenhuma tabela irmã tem). Acesso = role da aplicação + SSH. PII = coluna `client_phone` + política de export last4 (já live na Story 13).

---

## 10. [AUTO-DECISION] log

| Q | Decisão | Por quê |
|---|---|---|
| Tabela vs evento | **evento `tess.turn`** | Persist existe; G-P6 é contrato + timeout + chars errados |
| `tess_turn_credits` | não | Write amp (Gage R4) + duplicata do evento |
| Chars | `sent_chars` = `userMessageWithContext.length` | “chars enviados”; não `blocks.total` |
| Timeout no daily | não | Crédito null; AC3 quebra se somar |
| Timeout no turn | sim | Story pede timeout sim/não; chão 6 precisa do denominador |
| `salon_day` no JSON | sim | Reconciliar com `day` sem fuso UTC |
| Telefone no payload | não | Casa: coluna only; artefato last4 |
| Retenção turn | 90d documentada | P-PRIV; job não é deste story |
| Daily | fica | Alertas + AC3 |
| VIEW | não | Query basta |
| Migration file | **não neste handoff** | Mandato: tetos only; sem apply |
| 13,5 cr | não é número do schema | Piso 17–21; ofensor Thinking é painel |

---

## 11. Checklist de desenho (Dara)

- [x] Entidade = turno Tess com as 4 dimensões + timeout  
- [x] Relação 1:N implícita (`salon_day` → row diário); sem FK (agregado pode existir sem turns se o persist falhar — folga ±1)  
- [x] Tipos: créditos numéricos no JSON (espelho do `Number` do extract); daily continua `NUMERIC(14,6)`  
- [x] Índices justificados por acesso (dia, dia×intent×perfil)  
- [x] Retenção e o que **não** apagar  
- [x] PII: coluna house-pattern; export last4; payload limpo  
- [N/A] RLS / `auth.uid()` — não é o runtime  
- [N/A] Soft delete — append-only  
- [x] Rollback dos índices = DROP INDEX  

---

## 12. Retorno Orion

| Campo | Valor |
|---|---|
| Path | `docs/analysis/2026-09-04-dara-chao-5-credito-schema.md` |
| Ready-for-Dex | **yes** |

Resumo (8 linhas):

1. Ledger = evento `tess.turn` em `bot_operational_events`; **não** nascer `tess_turn_credits`.  
2. Daily `tess_credit_usage_daily` fica; é alerta, não dimensão.  
3. Dex completa o payload: `intent` × `context_profile` × `sent_chars` × `tess_credits` + `timed_out` + `salon_day`.  
4. `sent_chars` = tamanho do string que foi (ou ia) para `callTESS` — nunca `blocks.total`.  
5. Timeout passa a gravar `tess.turn` (`credits=null`, `timed_out=true`) e **não** incrementa o dia.  
6. Reconcile AC3: `SUM`/`COUNT` dos turns não-timeout no `salon_day` vs `credits_used`/`calls` (±1 turno).  
7. Índices parciais por `salon_day` (+ dim) — propostos, **não aplicados**. Retenção 90d do turn — só papel.  
8. Sem texto, sem grade, sem E.164 no payload/export; last4 `0007` só na borda. Não promete 13,5 cr.

**Próximo:** W Dex — `persistTessTurnEvent` + ramo timeout em `server.js`. Quinn sem WhatsApp.

— Dara, arquitetando dados
