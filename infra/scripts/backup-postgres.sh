#!/bin/bash
# Daily PostgreSQL backup for Studio Tirra stack.
# Backs up influence_labs_salon (bot memory), chatwoot, and n8n.
# Stores under /opt/influence-labs/backups/postgres/YYYY-MM-DD/ as .sql.gz.
# Rotates: keeps RETENTION_DAYS days, deletes older.
#
# Install:
#   chmod +x /opt/influence-labs/infra/scripts/backup-postgres.sh
#   crontab -e  → add:  0 6 * * * /opt/influence-labs/infra/scripts/backup-postgres.sh >> /opt/influence-labs/backups/postgres/cron.log 2>&1
#
# TODO (offsite): adicionar upload pra Backblaze B2 ou similar quando Victor decidir provider.

set -euo pipefail

BACKUP_ROOT="/opt/influence-labs/backups/postgres"
DATE="$(date +%Y-%m-%d)"
TS_ISO="$(date -Iseconds)"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASES=("influence_labs_salon" "chatwoot" "n8n")

mkdir -p "$BACKUP_ROOT/$DATE"

for db in "${DATABASES[@]}"; do
  if docker exec postgres pg_dump -U postgres "$db" 2>/dev/null | gzip > "$BACKUP_ROOT/$DATE/${db}.sql.gz"; then
    size="$(du -h "$BACKUP_ROOT/$DATE/${db}.sql.gz" | cut -f1)"
    echo "[$TS_ISO] OK $db ($size)"
  else
    echo "[$TS_ISO] FAIL $db" >&2
    # Nao explode — continua os outros
  fi
done

# Rotacao: apaga diretorios mais antigos que RETENTION_DAYS
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

total="$(du -sh "$BACKUP_ROOT" | cut -f1)"
echo "[$TS_ISO] backup complete. total kept on disk: $total"
