# Sauvegarde automatique de la base Smart Tontine : pg_dump (même version que le serveur), chiffrement GPG,
# copie hors serveur sur un stockage compatible S3 (Hetzner Object Storage, OVH, Backblaze B2, AWS…).
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli gnupg curl tzdata
COPY backup.sh restore.sh run.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/run.sh
VOLUME /backups
# Sain si la dernière sauvegarde réussie date de moins de 26 heures.
HEALTHCHECK --interval=30m --start-period=10m CMD sh -c 'test -f /backups/last_success && test $(( $(date +%s) - $(cat /backups/last_success) )) -lt 93600'
CMD ["run.sh"]
