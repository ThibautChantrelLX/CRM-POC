#!/usr/bin/env bash
# Copie la base test (crm_test) vers la base dev (crm_dev) — backup/snapshot.
# Usage : ./sync-dev-from-test.sh

set -euo pipefail

DUMP=/tmp/crm_test_snapshot.dump

echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│              SYNC crm_test  →  crm_dev                 │"
echo "├─────────────────────────────────────────────────────────┤"
echo "│  SOURCE  : crm_test  (localhost:5441, user lx)          │"
echo "│  DEST    : crm_dev   (localhost:5440, user lx_dev)      │"
echo "│                                                         │"
echo "│  ⚠️  Toutes les données de crm_dev seront SUPPRIMÉES    │"
echo "│     et remplacées par celles de crm_test.               │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
read -r -p "Êtes-vous sûr de vouloir continuer ? [y/N] " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Annulé."
  exit 0
fi

echo ""
echo "📦 Dump de crm_test…"
PGPASSWORD=password pg_dump \
  -h localhost -p 5441 -U lx \
  --no-owner --no-acl \
  -Fc crm_test \
  -f "$DUMP"

echo "🗑  Reset de crm_dev…"
PGPASSWORD=password psql \
  -h localhost -p 5440 -U lx_dev crm_dev \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" \
  -q

echo "⬆️  Restauration dans crm_dev…"
PGPASSWORD=password pg_restore \
  -h localhost -p 5440 -U lx_dev \
  --no-owner --no-acl \
  -d crm_dev \
  "$DUMP"

rm "$DUMP"
echo "✅ crm_dev est maintenant identique à crm_test."
