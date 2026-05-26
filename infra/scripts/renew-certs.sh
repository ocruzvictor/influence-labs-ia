#!/bin/bash
# Weekly Let's Encrypt cert renewal for Studio Tirra stack.
# Substitui o container certbot do docker-compose (que estava morto/loop quebrado).
# Usa docker run one-off com os mounts CORRETOS:
#   - host /etc/letsencrypt (onde nginx le os certs read-only)
#   - volume infra_certbot_webroot (onde nginx serve /.well-known/acme-challenge/)
#
# Renova SOMENTE os certs ja existentes. Para emitir cert novo, ver
# docs/ops/meta-cloud-activation-runbook.md (passo do certbot certonly).
#
# Install:
#   chmod +x /opt/influence-labs/infra/scripts/renew-certs.sh
#   crontab -e  → add:  17 7 * * 1 /opt/influence-labs/infra/scripts/renew-certs.sh >> /opt/influence-labs/backups/cert-renewal.log 2>&1
#   (segundas-feiras as 7:17 UTC = ~4h BRT)

set -euo pipefail

TS_ISO="$(date -Iseconds)"

# certbot/certbot renew respeita o /etc/letsencrypt/renewal/*.conf existente.
# --quiet so loga em caso de erro/renovacao.
if docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v infra_certbot_webroot:/var/www/certbot \
    certbot/certbot renew --webroot -w /var/www/certbot --non-interactive --quiet; then
  echo "[$TS_ISO] cert renew check ok (renovou se necessario)"
else
  echo "[$TS_ISO] cert renew FALHOU — verificar manualmente" >&2
  exit 1
fi

# Reload nginx pra pegar cert novo (no-op se nao renovou)
docker exec nginx nginx -s reload 2>/dev/null || echo "[$TS_ISO] nginx reload skipped"
echo "[$TS_ISO] renew-certs.sh complete"
