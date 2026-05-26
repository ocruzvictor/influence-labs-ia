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
- **Pendente:** upload offsite (Backblaze B2, S3, etc.). Hoje é só local — se VPS morrer, perde tudo.

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
