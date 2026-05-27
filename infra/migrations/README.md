# Migrations — `influence_labs_salon`

Migrations versionadas pro banco Postgres do Studio Tirra.

## Convenção

```
NNN_<slug>.sql           — forward migration (idempotente)
NNN_<slug>.rollback.sql  — rollback destrutivo
```

`NNN` = 3 dígitos com zero-padding, incremental por ordem de aplicação (`001`, `002`, ...).

## Como aplicar (VPS)

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra

# 1. Snapshot pré-migration (sempre)
docker exec postgres pg_dump -U postgres influence_labs_salon \
  > /tmp/backup_pre_001_$(date +%Y%m%d_%H%M%S).sql

# 2. Dry-run (opcional — copia migration sem COMMIT)
#    Trocar COMMIT por ROLLBACK temporariamente e rodar.

# 3. Apply
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < migrations/001_admin_dashboard.sql

# 4. Smoke check
docker exec -i postgres psql -U postgres -d influence_labs_salon -c "
  SELECT key, enabled FROM bot_toggles ORDER BY key;
  SELECT COUNT(*) AS sync_state FROM trinks_sync_state;
  SELECT COUNT(*) AS users FROM admin_users;
"
```

## Como reverter

```bash
docker exec -i postgres psql -U postgres -d influence_labs_salon \
  < migrations/001_admin_dashboard.rollback.sql
```

## Migrations atuais

| # | Slug | Aplicada | Tabelas afetadas |
|---|------|----------|------------------|
| 001 | admin_dashboard | ⏳ pendente | 10 novas tabelas + 2 views + 1 função trigger |

## Tracking de aplicação (futuro)

Quando houver >3 migrations, adicionar tabela `schema_migrations`:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT
);
```

E cada migration termina com:
```sql
INSERT INTO schema_migrations (version, applied_by) VALUES ('001', current_user);
```

Por enquanto (3 migrations ou menos), tracking via README é suficiente.

## Notas por migration

### 001_admin_dashboard

- **Pré-req:** Postgres ≥13 (gen_random_uuid nativo). VPS roda pg17 ✅
- **Idempotente:** sim — IF NOT EXISTS em tudo, ON CONFLICT DO NOTHING em seeds
- **Transação:** sim — toda a migration dentro de `BEGIN`/`COMMIT`
- **Seeds:** 3 toggles (`global`, `feature:audio`, `feature:supervisor`) + 1 row singleton em `trinks_sync_state`
- **Indexes BRIN:** `admin_audit_log.created_at` e `trinks_appointments.created_at_trinks` — apropriado pra séries temporais append-only (footprint mínimo vs BTREE)
- **Partial indexes:** `idx_admin_users_email_active`, `idx_admin_sessions_user_active`, `idx_kb_active_category` — só linhas ativas/não-revogadas
- **Trigger function compartilhada:** `admin_set_updated_at()` reusada em 4 tabelas mutáveis
- **CHECK constraints:** `role`, `status`, `category`, `mode`, `consecutive_failures >= 0`, `id = 1` (singleton)
- **Views:** `v_admin_conversations_summary`, `v_admin_appointments_daily` — encapsulam queries do dashboard
- **Não toca:** `conversation_history`, `clients`, `client_scores`, `proactive_messages`, `metrics`, `trinks_sync_events`
