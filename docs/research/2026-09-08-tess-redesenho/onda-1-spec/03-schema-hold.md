# 1.3 Data Engineer — schema hold (spec, 0 migration)

**Persona:** Dara (@data-engineer)  
**Veto:** hold sem unique `(profissional_id, slot_start)` ativo = BLOCK  
**Nesta sessão:** papel apenas. Sem `ALTER`, sem snapshot de prod, sem aplicar.

---

## Princípios

- Correção > velocidade. Unique no banco, não no LLM.
- Idempotente: re-insert mesmo phone+slot ativo = mesmo `id`.
- Hold **não** é fato Trinks. `trinks_id` só depois de 2xx.
- Acesso: hot-path Express (1 insert + 1 lookup por turno booking).

---

## `booking_holds` (proposta)

```sql
-- PROPOSTA — não executar
CREATE TABLE booking_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(20) NOT NULL,
  profissional_id VARCHAR(64) NOT NULL,
  servico_id      VARCHAR(64) NOT NULL,
  slot_start      TIMESTAMPTZ NOT NULL,
  slot_end        TIMESTAMPTZ,
  status          VARCHAR(16) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  trinks_id       VARCHAR(64),
  trace_id        VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_holds_status_chk
    CHECK (status IN (
      'held', 'committing', 'confirmed',
      'released', 'expired', 'rejected', 'failed'
    )),
  CONSTRAINT booking_holds_trinks_only_when_confirmed
    CHECK (trinks_id IS NULL OR status = 'confirmed')
);

-- Um slot ativo por profissional (dente da race 13h)
CREATE UNIQUE INDEX booking_holds_active_slot_ux
  ON booking_holds (profissional_id, slot_start)
  WHERE status IN ('held', 'committing');

-- Idempotência por fio+slot enquanto ativo
CREATE UNIQUE INDEX booking_holds_active_phone_slot_ux
  ON booking_holds (phone, profissional_id, slot_start)
  WHERE status IN ('held', 'committing');

CREATE INDEX booking_holds_expire_ix
  ON booking_holds (expires_at)
  WHERE status = 'held';

CREATE INDEX booking_holds_phone_ix
  ON booking_holds (phone, created_at DESC);
```

`expires_at` default = `NOW() + interval '180 seconds'` (FR-9).

Expire job: `UPDATE … SET status = 'expired' WHERE status = 'held' AND expires_at <= NOW()` — worker 0 LLM, pode ser o mesmo ritmo do snapshot, **não** no inbound crítico.

---

## `booking_handoff_receipts` (Martelo, story 2)

```sql
-- PROPOSTA — não executar
CREATE TABLE booking_handoff_receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id      UUID REFERENCES booking_holds(id),
  phone        VARCHAR(20) NOT NULL,
  assigned_to  VARCHAR(80) NOT NULL,
  sla_until    TIMESTAMPTZ NOT NULL,
  action       VARCHAR(16) NOT NULL DEFAULT 'pending',
  acted_at     TIMESTAMPTZ,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_receipts_action_chk
    CHECK (action IN ('pending', 'approved', 'rejected', 'timeout')),
  CONSTRAINT booking_receipts_assigned_not_generic
    CHECK (lower(assigned_to) NOT IN ('recepção', 'recepcao', 'a recepção', 'staff'))
);

CREATE INDEX booking_receipts_pending_ix
  ON booking_handoff_receipts (sla_until)
  WHERE action = 'pending';
```

Constraint de `assigned_to` é **mínima** (bloqueia genéricos conhecidos). Owner real continua regra de processo (Pedro).

---

## Relação com tabelas vivas

| Tabela | Relação | Não fazer |
|---|---|---|
| `bot_thread_state` | silence continua; **não** DELETE hold | usar silence como release |
| `trinks_api_requests` | SOT do 2xx; hold aponta `trinks_id` só confirmed | inventar `booking.created` |
| `conversation_history` | log de fala; estado **não** mora aqui | coluna de etapa escrita por LLM |
| `bot_operational_events` | emitir `hold.created` / `hold.expired` / `handoff.receipt` | — |

`infra/schema.sql` do repo está **desatualizado** vs tabelas live (`bot_thread_state` etc.). Migration futura deve seguir o padrão **já usado em prod**, não reescrever o dump antigo.

---

## Queries quentes

```sql
-- adquirir hold (story 1)
INSERT INTO booking_holds (phone, profissional_id, servico_id, slot_start, slot_end, status, expires_at, trace_id)
VALUES ($1, $2, $3, $4, $5, 'held', NOW() + INTERVAL '180 seconds', $6)
ON CONFLICT DO NOTHING
RETURNING id;

-- lookup ativo
SELECT id, status, expires_at
  FROM booking_holds
 WHERE phone = $1 AND status IN ('held', 'committing')
 ORDER BY created_at DESC
 LIMIT 1;
```

`ON CONFLICT DO NOTHING` + unique de slot: perdedor da race 13h não ganha row.

---

## Rollback (quando migrar)

`DROP TABLE booking_handoff_receipts; DROP TABLE booking_holds;` — sem tocar Trinks, allowlist, prompt.
