#!/usr/bin/env bash
# Copie la base dev (crm_dev) vers la base test (crm_test).
# Usage : ./sync-test-from-dev.sh

set -euo pipefail

DUMP=/tmp/crm_dev_snapshot.dump

echo "📦 Dump de crm_dev…"
PGPASSWORD=password pg_dump \
  -h localhost -p 5440 -U lx_dev \
  --no-owner --no-acl \
  -Fc crm_dev \
  -f "$DUMP"

echo "🗑  Reset de crm_test…"
PGPASSWORD=password psql \
  -h localhost -p 5441 -U lx crm_test \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" \
  -q

echo "⬆️  Restauration dans crm_test…"
PGPASSWORD=password pg_restore \
  -h localhost -p 5441 -U lx \
  --no-owner --no-acl \
  -d crm_test \
  "$DUMP"

rm "$DUMP"
echo "✅ crm_test est maintenant identique à crm_dev."
