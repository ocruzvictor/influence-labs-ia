# Smoke — Resume IA pós-handoff (Bianca-teste)

**Epic:** [EPIC-resume-ia-pos-handoff](../stories/epics/EPIC-resume-ia-pos-handoff.md)  
**Story:** [salon-whatsapp-resume-ia-5-smoke-bianca](../stories/salon-whatsapp-resume-ia-5-smoke-bianca.md)  
**Data:** 2026-09-01  
**Executor:** @dev (Dex) · gate @qa  
**Incidente canônico:** Bianca pediu agendamento → IA `HANDOFF_HUMAN` → prompt passou a permitir teste de mecha → janela 24h aberta → operador não tinha como mandar a IA voltar.

> **Regra de ouro:** este roteiro usa **número de teste na whitelist**. **Nunca** o número real da Bianca nem PII de cliente real no Dev Agent Record.

---

## Número de teste

| Placeholder no curl/SQL | Onde pegar no VPS |
|-------------------------|-------------------|
| `55XXXXXXXXXXX` | Escolher **um** telefone `mode=allow` das migrations de teste abaixo |

**Whitelist de teste (migrations 011–013 — escolher um):**

| Migration | E.164 (sem `+`) | Notas |
|-----------|-----------------|-------|
| `011_whitelist_teste_5511951489295.sql` | `5511951489295` | Chip Tiago (Fase D); **não** é OWNER_PHONE |
| `012_whitelist_teste_5511975772987.sql` | `5511975772987` | Número de teste autorizado 2026-08-31 |
| `013_whitelist_teste_5511989318027.sql` | `5511989318027` | Cliente real autorizado — usar só se Victor/Tiago confirmarem |

**Bot WhatsApp (IA):** `+55 11 97504-0517` (`5511975040517`). **Não** usar `94831` (Business App humano).

Exportar antes dos passos:

```bash
export TEST_PHONE='55XXXXXXXXXXX'   # substituir por um da tabela acima
export ADMIN_TOKEN='…'              # infra/.env no VPS — NÃO colar no chat
export HOST='https://<host>'         # ex.: https://api.studiotirra.com.br ou IP interno nginx
```

---

## Pré-requisitos (VPS)

### 1. Migrations 016 + 017 aplicadas

Stories 1–2 dependem de `bot_thread_state` e `last_staff_outbound_at`.

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra

# Confirmar que 016+017 ainda não foram aplicadas (opcional)
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_thread_state'
  ) AS has_016;
"

docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'bot_thread_state' AND column_name = 'last_staff_outbound_at';
"

# Aplicar (idempotente)
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < migrations/016_bot_thread_state.sql
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < migrations/017_last_staff_outbound_at.sql
```

**Esperado:** tabela `bot_thread_state` existe; coluna `last_staff_outbound_at` presente.

### 2. Backend com stories 1–4 deployadas

```bash
cd /opt/influence-labs/infra
docker compose up -d --build backend
docker compose restart nginx   # se BFF admin também mudou
```

### 3. Health baseline

```bash
curl -sS "$HOST/health" | jq '.bot.human_handled, .bot.mode'
```

**Esperado:**

- `bot.human_handled.table_ready: true`
- `bot.human_handled.active_count` = COUNT persistido (não Map volátil)
- `bot.mode`: `WHITELIST` ou `OPEN` conforme env

### 4. Whitelist do número de teste

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT phone, mode, reason FROM bot_whitelist
  WHERE phone = '$TEST_PHONE';
"
```

**Esperado:** `mode = allow`. Se ausente, aplicar migration 011/012/013 correspondente.

### 5. Credenciais

- `ADMIN_TOKEN` em `infra/.env` (header `X-Admin-Token`)
- `HOST` apontando para o backend exposto (nginx ou container `:3001` via `docker exec`)

---

## Nota canônica (caso Bianca / mecha)

Mesmo texto do handoff e story 2 — **20–500 chars**, orienta teste de mecha:

```text
Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.
```

---

## Passo 0 — Limpar estado anterior (opcional, recomendado)

Só no número de **teste**:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  DELETE FROM bot_thread_state WHERE phone = '$TEST_PHONE';
"
```

Não apagar histórico de `conversation_history` se quiser preservar janela 24h real — ver negativo `window_closed` (seção 5).

---

## 1. Passo feliz — handoff → curl resume → outbound Cloud API

**Objetivo (AC2):** silêncio pós-handoff persiste; operador **não** responde na thread da cliente; `curl` resume envia fala da IA; nota **não** vaza como `role=user`.

### 1.1 Forçar handoff na thread de teste

Do chip **`$TEST_PHONE`**, enviar para **`+55 11 97504-0517`** uma mensagem que dispare `HANDOFF_HUMAN`. Exemplos (escolher um):

- `quero falar com a recepção`
- `fiquei insatisfeita com o corte` (simula reclamação)
- Fluxo combo que estoura guard → handoff (ver smoke 46589)

**Esperado:**

- Cliente de teste **para de receber** respostas da IA (silêncio).
- Tiago recebe ping de handoff com copy **neste chat** (story 3 — não “abre o WhatsApp do salão”).
- **Operador NÃO responde** na thread da cliente pelo Business App.

Verificar silêncio persistido:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT phone, silenced_until, silence_reason, last_handoff_motivo
  FROM bot_thread_state WHERE phone = '$TEST_PHONE';
"

curl -sS "$HOST/health" | jq '.bot.human_handled.active_count'
```

**Esperado:** row com `silence_reason = 'handoff'`, `silenced_until > NOW()`, `active_count >= 1`.

### 1.2 Confirmar janela 24h aberta

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT MAX(created_at) AS last_user_inbound
  FROM conversation_history
  WHERE client_phone = '$TEST_PHONE' AND role = 'user';
"
```

**Esperado:** `last_user_inbound` dentro das últimas 24h (inclui `agent = 'passive'`).

### 1.3 Executar resume (CLI First)

```bash
curl -sS -w '\nHTTP:%{http_code}\n' -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.","actor":"cli"}' \
  "$HOST/admin/conversations/$TEST_PHONE/resume"
```

**Esperado HTTP 200:**

```json
{"status":"sent"}
```

Outros 200 válidos neste roteiro: `already_active` (repetir sem handoff), `window_closed` (só no negativo §5).

### 1.4 Cliente recebe mensagem Cloud API

No WhatsApp do chip de teste:

- **1 outbound** da IA após o resume.
- Fala orienta **agendar teste de mecha** (não só “estou de volta”).
- Origem Kapso / Cloud API (não bolha escrita pelo humano no Business App).

Logs (ajustar grep):

```bash
docker logs backend 2>&1 | tail -200 | grep -E "resume\.|operator_resume|$TEST_PHONE"
```

### 1.5 SQL — nota NÃO é `role=user`

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT id, role, agent, left(content, 80) AS content_preview, created_at
  FROM conversation_history
  WHERE client_phone = '$TEST_PHONE'
  ORDER BY created_at DESC
  LIMIT 20;
"
```

**Esperado:**

- **Nenhuma** row nova com `role = 'user'` contendo o texto da nota de operador.
- Row `role = 'assistant'` com a fala enviada ao cliente.
- Nota de orientação **não** aparece como se a cliente tivesse dito.

### 1.6 Telemetria `resume.*` (AC6 — happy)

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT event, motivo, received_at
  FROM bot_operational_events
  WHERE client_phone = '$TEST_PHONE'
    AND event LIKE 'resume.%'
  ORDER BY received_at DESC
  LIMIT 10;
"
```

**Esperado (happy path):** pelo menos:

| event | quando |
|-------|--------|
| `resume.requested` | imediatamente ao POST |
| `resume.sent` | após Kapso send ok |

Anotar `received_at` (e `motivo` se presente) no Dev Agent Record — **sem** inventar IDs.

---

## 2. Negativo — restart backend (story 1)

**Objetivo (AC3):** silêncio **permanece** após restart; curl resume ainda funciona.

### 2.1 Com handoff ativo (antes do resume)

Repetir §1.1 até `bot_thread_state.silenced_until > NOW()`.

```bash
BEFORE=$(curl -sS "$HOST/health" | jq '.bot.human_handled.active_count')
docker compose restart backend
sleep 5
AFTER=$(curl -sS "$HOST/health" | jq '.bot.human_handled.active_count')
echo "before=$BEFORE after=$AFTER"
```

**Esperado:**

- `AFTER >= 1` (silêncio sobreviveu — fonte Postgres, não Map).
- Cliente continua **sem** resposta automática da IA (silêncio permanece).

### 2.2 Resume após restart

Executar curl §1.3 **sem** responder na thread da cliente.

**Esperado:** `{"status":"sent"}` (ou erro de gate documentado — nunca perda silenciosa).

---

## 3. Negativo — thread da cliente (story 3)

**Objetivo (AC4):** texto `retomar …` **na thread da cliente** não dispara resume; takeover via Business App continua.

### 3.1 Com handoff ativo

Estado: §1.1 aplicado, **sem** curl resume ainda.

### 3.2 Cliente envia comando disfarçado

Do chip **`$TEST_PHONE`**, enviar para o bot:

```text
retomar. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.
```

**Esperado:**

- **Não** chama `resumeConversation`.
- **Não** aparece `resume.requested` / `resume.sent` novos por causa desta mensagem.
- Silêncio de handoff **permanece** (`silenced_until` ainda futuro).
- Fluxo normal de inbound silenciado (bot quieto).

Verificar:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT event, received_at FROM bot_operational_events
  WHERE client_phone = '$TEST_PHONE' AND event LIKE 'resume.%'
  ORDER BY received_at DESC LIMIT 5;
"
```

### 3.3 Takeover Business App (controle)

Se staff responder **na thread da cliente** pelo WhatsApp Business (`94831` → cliente):

**Esperado:** takeover persiste (`silence_reason` pode virar `business_app`); resume continua disponível via **CLI** ou thread do **dono** (PIN), não via chat da cliente.

> Parser resume WhatsApp só roda em `isOwnerPhone` — ver story 3.

---

## 4. Negativo — `window_closed` (AC5)

**Objetivo:** conversa sem inbound `role=user` nas últimas 24h → curl devolve `window_closed`; nota pendente; **sem** send Kapso.

### 4.1 Preparar conversa “fria”

Opções (escolher uma):

**A — Número de teste sem histórico recente:** usar outro `$TEST_PHONE` da whitelist que não falou nas últimas 24h.

**B — Simular no SQL (somente staging/VPS de teste):**

```bash
# CUIDADO: só em ambiente de teste — ajusta timestamps para fora da janela 24h
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  UPDATE conversation_history
  SET created_at = NOW() - interval '25 hours'
  WHERE client_phone = '$TEST_PHONE' AND role = 'user';
"
```

Inserir silêncio manual se necessário:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  INSERT INTO bot_thread_state (phone, silenced_until, silence_reason)
  VALUES ('$TEST_PHONE', NOW() + interval '6 hours', 'handoff')
  ON CONFLICT (phone) DO UPDATE
    SET silenced_until = NOW() + interval '6 hours',
        silence_reason = 'handoff';
"
```

### 4.2 Curl resume

Mesmo payload §1.3.

**Esperado HTTP 200:**

```json
{"status":"window_closed"}
```

- **Sem** outbound Kapso para o cliente.
- Nota pendente em `bot_thread_state`:

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT resume_note IS NOT NULL AS has_note,
         resume_note_expires_at,
         resume_note_consumed_at
  FROM bot_thread_state WHERE phone = '$TEST_PHONE';
"
```

**Esperado:** `has_note = true`, `resume_note_expires_at` ~ NOW()+30min, `resume_note_consumed_at` NULL.

### 4.3 Telemetria (AC6 — negativo)

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT event, motivo, received_at
  FROM bot_operational_events
  WHERE client_phone = '$TEST_PHONE'
    AND event = 'resume.window_closed'
  ORDER BY received_at DESC LIMIT 3;
"
```

**Esperado:** pelo menos um `resume.window_closed` (e tipicamente `resume.requested` no mesmo POST).

---

## Queries SQL de referência (story 5)

Substituir `$TEST_PHONE` pelo número escolhido.

```sql
-- Nota não vaza como user
SELECT id, role, agent, left(content, 80), created_at
  FROM conversation_history
 WHERE client_phone = $1
 ORDER BY created_at DESC
 LIMIT 20;

-- Telemetria resume.*
SELECT event, motivo, received_at
  FROM bot_operational_events
 WHERE client_phone = $1
   AND event LIKE 'resume.%'
 ORDER BY received_at DESC;

-- Estado de silêncio / nota pendente
SELECT phone, silenced_until, silence_reason,
       resume_note IS NOT NULL AS pending_note,
       resume_note_expires_at,
       last_resume_at, last_resume_result
  FROM bot_thread_state
 WHERE phone = $1;

-- Janela 24h (INCLUI agent='passive')
SELECT MAX(created_at) AS last_user_inbound,
       MAX(created_at) >= NOW() - interval '24 hours' AS window_open
  FROM conversation_history
 WHERE client_phone = $1 AND role = 'user';
```

---

## O que NÃO fazer

| Proibido | Por quê |
|----------|---------|
| Usar número **real da Bianca** | Story 5 = reprodução em teste; PII no record |
| Responder na **thread da cliente** pelo **Business App** (`94831`) antes do curl | Marca takeover (`business_app`); ensina caminho errado |
| Colar a nota de operador como se fosse mensagem da cliente | Fake `role=user` — vazamento no histórico/WhatsApp |
| Slash genérico (`/preco`, `/kb`, `/prompt`) no thread do dono | Fora do escopo; story 3 é parser **estreito** só `retomar\|retoma\|…` |
| Auto-limpar `human_only` / `block` via resume | Resume **nunca** muta `bot_whitelist` |
| Inventar IDs de evento no Dev Agent Record | Só timestamps/`received_at` reais do SQL |
| Template Meta quando janela fechada | GO: falha visível + nota pendente TTL 30min |

**Caminho certo do operador:** ping de handoff → responder **neste chat** (thread do dono) **ou** `curl` / botão admin — **nunca** abrir chat da cliente no Business App para “ajudar”.

---

## Evidência para @qa (Dev Agent Record)

Preencher após execução live:

| Campo | Valor |
|-------|-------|
| `TEST_PHONE` usado | (últimos 4 dígitos ok) |
| Handoff timestamp | |
| Curl HTTP + body | |
| `resume.requested` / `resume.sent` timestamps | |
| Restart: `active_count` before/after | |
| Negativo cliente: confirmou zero resume | |
| `window_closed` timestamp | |
| Screenshot/log Kapso (opcional) | |

---

## Gates unitários (stories 1–4 — substituto quando live bloqueado)

Quando VPS/`ADMIN_TOKEN` indisponíveis, estes testes cobrem os contratos:

| Story | Arquivo | Casos relevantes |
|-------|---------|------------------|
| 1 | `backend/test/bot-thread-state.test.js` | persistência pós-invalidate cache; TTL; `countActiveSilenced`; `persistStaffOutbound` |
| 2 | `backend/test/resume-conversation.test.js` | 409s, `window_closed`, happy `sent`, leak filter, idempotência, auth 401, zero `UPDATE bot_whitelist` |
| 3 | `backend/test/owner-resume-parser.test.js` | âncoras; 0/1/N pendentes; **thread cliente ignorada**; ack sent/window_closed |
| 4 | `frontend/admin/tests/api/conversas-resume.test.ts` | BFF POST resume + auth |

```bash
cd backend && npm test
# filtro local:
npm test -- --test-name-pattern='resume|bot-thread-state|owner-resume'
```

---

## Referências

- Handoff: [2026-09-01-plano-resume-ia-pos-handoff.md](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md)
- Story 2 contrato HTTP: [salon-whatsapp-resume-ia-2-comando-api.md](../stories/salon-whatsapp-resume-ia-2-comando-api.md)
- Migrations: `infra/migrations/016_bot_thread_state.sql`, `017_last_staff_outbound_at.sql`
- Whitelist teste: `011_*`, `012_*`, `013_*`
