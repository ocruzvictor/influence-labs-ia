# Ops scripts — Studio Tirra VPS

Scripts versionados de manutenção da operação. Rodam via cron do usuário `deploy` no VPS.

## Setup inicial (uma vez)

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs
git pull origin main
chmod +x infra/scripts/*.sh
mkdir -p backups/postgres
crontab -e
```

Conteúdo do crontab:

```cron
# Backup diário do PostgreSQL às 06:00 UTC (03:00 BRT)
0 6 * * * /opt/influence-labs/infra/scripts/backup-postgres.sh >> /opt/influence-labs/backups/postgres/cron.log 2>&1

# Renovação semanal de certs às segundas 07:17 UTC (~04:00 BRT)
17 7 * * 1 /opt/influence-labs/infra/scripts/renew-certs.sh >> /opt/influence-labs/backups/cert-renewal.log 2>&1
```

## Scripts

### `backup-postgres.sh`
- Backup diário das 3 DBs críticas: `influence_labs_salon` (memória do bot), `chatwoot`, `n8n`.
- Sai em `/opt/influence-labs/backups/postgres/YYYY-MM-DD/*.sql.gz`.
- Rotação: mantém 14 dias (var `RETENTION_DAYS`).
- **stderr** do `pg_dump` agora é capturado e incluído no log de FAIL (antes ia pra `/dev/null`, diagnóstico cego).
- **Exit code** ≠ 0 quando qualquer DB falha — facilita detecção em cron logs e CI.

#### Offsite backup (opcional, opt-in via env)

Hoje, sem offsite, **se o VPS morrer, perde tudo**. Pra ligar:

```bash
# No .env do crontab (ou shell que invoca o script)
export BACKUP_OFFSITE_ENABLED=true
export BACKUP_OFFSITE_PROVIDER=b2          # b2 (Backblaze) ou s3
export BACKUP_OFFSITE_BUCKET=studio-tirra-backups
export BACKUP_OFFSITE_ENDPOINT=https://s3.us-west-002.backblazeb2.com  # pro B2
# Credenciais (AWS CLI lê do ambiente automaticamente):
export AWS_ACCESS_KEY_ID=<key_id>
export AWS_SECRET_ACCESS_KEY=<secret>
```

Requer `aws` CLI instalado no host (`apt install awscli`). B2 expõe endpoint S3-compatível.

Cron com env vars carregadas:
```cron
0 6 * * * . /opt/influence-labs/.env.backup && /opt/influence-labs/infra/scripts/backup-postgres.sh >> /opt/influence-labs/backups/postgres/cron.log 2>&1
```

#### Alerta de falha (opcional)

```bash
export BACKUP_ALERT_WEBHOOK=https://api.studiotirra.com.br/admin/alert
```

Quando qualquer DB falha, faz POST com `{db, error, timestamp}`. Best-effort — não bloqueia o script.

#### Restore test (recomendado mensal)

```bash
# Pega dump mais recente, restaura em DB temporária, valida row count, dropa
DB_TEST=salon_restore_test
gunzip -c /opt/influence-labs/backups/postgres/$(date +%Y-%m-%d)/influence_labs_salon.sql.gz | \
  docker exec -i postgres psql -U postgres -c "CREATE DATABASE $DB_TEST;" && \
  docker exec -i postgres psql -U postgres $DB_TEST
docker exec postgres psql -U postgres $DB_TEST -c "SELECT COUNT(*) FROM conversation_history;"
docker exec postgres psql -U postgres -c "DROP DATABASE $DB_TEST;"
```

Backup que não é testado **não é backup**.

### `renew-certs.sh`
- Tentativa semanal de renovação dos certs Let's Encrypt (`n8n.studiotirra.com.br` SAN cobrindo n8n + chat + api).
- Substitui o container `certbot` do docker-compose, que estava com loop quebrado (mount mismatch entre volumes).
- Usa one-off `docker run` com os mounts certos: host `/etc/letsencrypt` (que nginx lê) + volume `infra_certbot_webroot` (que nginx serve `.well-known/`).
- Reload nginx após renovação.

## Verificar saúde

```bash
# Ultimo backup
ls -la /opt/influence-labs/backups/postgres/$(date +%Y-%m-%d)/

# Logs do cron de backup
tail -20 /opt/influence-labs/backups/postgres/cron.log

# Logs do cron de cert
tail -20 /opt/influence-labs/backups/cert-renewal.log

# Validade do cert
echo | openssl s_client -connect api.studiotirra.com.br:443 -servername api.studiotirra.com.br 2>/dev/null | openssl x509 -noout -enddate
```

## Restore (em emergência)

```bash
# Listar dumps disponiveis
ls /opt/influence-labs/backups/postgres/

# Restaurar uma DB de um dia especifico
gunzip -c /opt/influence-labs/backups/postgres/2026-05-25/influence_labs_salon.sql.gz \
  | docker exec -i postgres psql -U postgres influence_labs_salon
```
