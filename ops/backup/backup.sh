#!/bin/sh
# Une sauvegarde : export → vérification → chiffrement → copie hors serveur → rotation → témoin de réussite.
# Variables : PGHOST, PGUSER, PGPASSWORD, PGDATABASE (connexion) ; BACKUP_PASSPHRASE (chiffrement, obligatoire) ;
# BACKUP_KEEP_DAYS (14), BACKUP_KEEP_MONTHS (12) ; BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY (copie hors serveur, facultative) ; BACKUP_ALERT_URL (alerte d'échec, facultative).
set -eu
DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
KEEP_MONTHS="${BACKUP_KEEP_MONTHS:-12}"
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
NAME="smarttontine_${STAMP}.dump"
TMP="${DIR}/.${NAME}.partial"
mkdir -p "$DIR"

fail() {
  echo "[sauvegarde] ÉCHEC : $1" >&2
  rm -f "$TMP" "$TMP.gpg"
  if [ -n "${BACKUP_ALERT_URL:-}" ]; then
    curl -fsS -m 20 -X POST -H 'content-type: application/json' \
      -d "{\"text\":\"Smart Tontine : sauvegarde de la base en échec (${STAMP}) : $1\"}" "$BACKUP_ALERT_URL" >/dev/null || true
  fi
  exit 1
}

[ -n "${BACKUP_PASSPHRASE:-}" ] || fail "BACKUP_PASSPHRASE manquant : une sauvegarde contient des données personnelles et doit être chiffrée"

# 1. Export complet (format personnalisé : compressé, restaurable table par table).
pg_dump --format=custom --compress=9 --no-owner --file="$TMP" || fail "pg_dump"
# 2. Vérification : l'archive doit être lisible et contenir le grand livre.
pg_restore --list "$TMP" > "$TMP.toc" || fail "archive illisible"
grep -q "TABLE DATA public ledger_entries" "$TMP.toc" || { rm -f "$TMP.toc"; fail "table ledger_entries absente de l'archive"; }
rm -f "$TMP.toc"
# 3. Chiffrement AES-256 (la base contient des pièces d'identité et des opérations financières).
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 --output "$TMP.gpg" "$TMP" || fail "chiffrement"
rm -f "$TMP"
mv "$TMP.gpg" "${DIR}/${NAME}.gpg"
SIZE=$(du -h "${DIR}/${NAME}.gpg" | cut -f1)
echo "[sauvegarde] ${NAME}.gpg (${SIZE})"

# 4. Copie hors serveur : une sauvegarde qui reste sur le serveur disparaît avec lui.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  aws s3 cp --only-show-errors ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} \
    "${DIR}/${NAME}.gpg" "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-smarttontine}/${NAME}.gpg" || fail "copie S3"
  echo "[sauvegarde] copiée sur s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-smarttontine}/"
fi

# 5. Rotation locale : sauvegardes quotidiennes gardées KEEP_DAYS jours, celles du 1er du mois KEEP_MONTHS mois.
#    (Hors serveur, régler la durée de conservation par une règle de cycle de vie du compartiment S3.)
find "$DIR" -maxdepth 1 -name 'smarttontine_*.dump.gpg' ! -name 'smarttontine_????-??-01T*' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/[sauvegarde] supprimée : /'
find "$DIR" -maxdepth 1 -name 'smarttontine_????-??-01T*.dump.gpg' -mtime +$((KEEP_MONTHS * 31)) -print -delete | sed 's/^/[sauvegarde] supprimée : /'

date +%s > "${DIR}/last_success"
echo "[sauvegarde] terminée"
