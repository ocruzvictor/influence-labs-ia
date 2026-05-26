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
# Offsite upload (opcional, ativa via env):
#   BACKUP_OFFSITE_ENABLED=true
#   BACKUP_OFFSITE_PROVIDER=b2|s3
#   BACKUP_OFFSITE_BUCKET=studio-tirra-backups
#   BACKUP_OFFSITE_ENDPOINT=...  (B2 endpoint ou S3 custom)
#   BACKUP_OFFSITE_KEY_ID, BACKUP_OFFSITE_KEY_SECRET
#   Requer 'aws' CLI no host (compatível com S3-API; B2 expõe S3-compat endpoint).
#
# Alerta de falha (opcional):
#   BACKUP_ALERT_WEBHOOK=https://...  (POST com payload {db, error, timestamp})

set -euo pipefail

BACKUP_ROOT="/opt/influence-labs/backups/postgres"
DATE="$(date +%Y-%m-%d)"
TS_ISO="$(date -Iseconds)"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASES=("influence_labs_salon" "chatwoot" "n8n")

BACKUP_OFFSITE_ENABLED="${BACKUP_OFFSITE_ENABLED:-false}"
BACKUP_OFFSITE_PROVIDER="${BACKUP_OFFSITE_PROVIDER:-}"
BACKUP_OFFSITE_BUCKET="${BACKUP_OFFSITE_BUCKET:-}"
BACKUP_OFFSITE_ENDPOINT="${BACKUP_OFFSITE_ENDPOINT:-}"
BACKUP_ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-}"

mkdir -p "$BACKUP_ROOT/$DATE"

# Captura stderr separadamente pra incluir no log de falha (antes ia pra /dev/null).
STDERR_FILE="$(mktemp)"
trap 'rm -f "$STDERR_FILE"' EXIT

failures=0
for db in "${DATABASES[@]}"; do
  # Limpa stderr buffer entre dbs
  : > "$STDERR_FILE"
  if docker exec postgres pg_dump -U postgres "$db" 2>"$STDERR_FILE" | gzip > "$BACKUP_ROOT/$DATE/${db}.sql.gz"; then
    size="$(du -h "$BACKUP_ROOT/$DATE/${db}.sql.gz" | cut -f1)"
    echo "[$TS_ISO] OK $db ($size)"

    # Upload offsite (opcional, best-effort — falha de upload nao quebra backup local)
    if [ "$BACKUP_OFFSITE_ENABLED" = "true" ] && [ -n "$BACKUP_OFFSITE_BUCKET" ]; then
      local_path="$BACKUP_ROOT/$DATE/${db}.sql.gz"
      remote_path="s3://${BACKUP_OFFSITE_BUCKET}/${DATE}/${db}.sql.gz"
      endpoint_flag=""
      [ -n "$BACKUP_OFFSITE_ENDPOINT" ] && endpoint_flag="--endpoint-url=$BACKUP_OFFSITE_ENDPOINT"
      if aws s3 cp "$local_path" "$remote_path" $endpoint_flag 2>>"$STDERR_FILE"; then
        echo "[$TS_ISO] OFFSITE OK $db -> $remote_path"
      else
        err="$(tail -3 "$STDERR_FILE" | tr '\n' ' ')"
        echo "[$TS_ISO] OFFSITE FAIL $db: $err" >&2
        # Nao incrementa failures — local ja salvo, offsite e best-effort.
      fi
    fi
  else
    err="$(tail -5 "$STDERR_FILE" | tr '\n' ' ')"
    echo "[$TS_ISO] FAIL $db: $err" >&2
    failures=$((failures + 1))

    # Alerta webhook (se configurado)
    if [ -n "$BACKUP_ALERT_WEBHOOK" ]; then
      curl -fsS -X POST -H 'Content-Type: application/json' \
        -d "{\"db\":\"$db\",\"error\":\"$(echo "$err" | head -c 300 | sed 's/"/\\"/g')\",\"timestamp\":\"$TS_ISO\"}" \
        --max-time 10 "$BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 || true
    fi
  fi
done

# Rotacao: apaga diretorios mais antigos que RETENTION_DAYS
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

total="$(du -sh "$BACKUP_ROOT" | cut -f1)"
echo "[$TS_ISO] backup complete. local total: $total. failures: $failures"

# Exit non-zero se qualquer db falhou — facilita detecção em cron logs e CI
exit $failures
