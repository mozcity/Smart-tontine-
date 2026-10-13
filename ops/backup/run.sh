#!/bin/sh
# Planificateur : une sauvegarde par jour à BACKUP_TIME (heure UTC, HH:MM). Ouagadougou est à UTC+0.
set -u
BACKUP_TIME="${BACKUP_TIME:-02:30}"
echo "[sauvegarde] planifiée chaque jour à ${BACKUP_TIME} UTC"
if [ "${BACKUP_ON_START:-false}" = "true" ]; then backup.sh || true; fi
while true; do
  now=$(date -u +%s)
  target=$(date -u -d "$(date -u +%Y-%m-%d) ${BACKUP_TIME}:00" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo "[sauvegarde] prochaine dans $(( (target - now) / 60 )) min"
  sleep $((target - now))
  backup.sh || true   # un échec est signalé (journal + alerte) sans arrêter le planificateur
done
