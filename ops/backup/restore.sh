#!/bin/sh
# Restaure une sauvegarde dans la base (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
#   restore.sh /backups/smarttontine_2026-10-13T0230Z.dump.gpg --confirm
#   restore.sh s3://compartiment/smarttontine/smarttontine_….dump.gpg --confirm
# ATTENTION : remplace le contenu actuel de la base. Arrêter l'API et le worker avant (docker compose stop api worker).
set -eu
SRC="${1:?Usage : restore.sh <fichier .dump.gpg ou s3://…> --confirm}"
[ "${2:-}" = "--confirm" ] || { echo "Ajouter --confirm : la base ${PGDATABASE:-?} sur ${PGHOST:-?} sera remplacée." >&2; exit 2; }
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE manquant" >&2; exit 2; }
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
case "$SRC" in
  s3://*) aws s3 cp --only-show-errors ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} "$SRC" "$WORK/backup.gpg"; SRC="$WORK/backup.gpg" ;;
esac
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 --decrypt --output "$WORK/backup.dump" "$SRC"
pg_restore --list "$WORK/backup.dump" >/dev/null
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="${PGDATABASE}" "$WORK/backup.dump"
echo "[restauration] terminée depuis $1"
