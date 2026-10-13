# 17. Sauvegarde de la base de données

*Mise en place le 13 octobre 2026. Service `backup` de `docker-compose.yml`, code dans `ops/backup/`.*

## 17.1 Ce qui est sauvegardé, et quand

| Point | Fonctionnement |
|---|---|
| **Contenu** | Toute la base PostgreSQL : comptes, tontines, grand livre, crédits, dossiers KYC, journaux |
| **Fréquence** | Chaque nuit à **02 h 30** (heure UTC, soit l'heure de Ouagadougou), plus une sauvegarde au démarrage du service |
| **Vérification** | Chaque archive est relue (`pg_restore --list`) et doit contenir le grand livre, sinon la sauvegarde est déclarée en échec |
| **Chiffrement** | **AES-256** (GPG) avec la phrase secrète `BACKUP_PASSPHRASE`. Sans elle, une sauvegarde est illisible ; le service refuse de démarrer une sauvegarde si elle est absente. |
| **Conservation sur le serveur** | Sauvegardes quotidiennes : **14 jours** ; sauvegardes du 1er du mois : **12 mois** (réglables) |
| **Copie hors serveur** | Envoi sur un stockage compatible S3 : Hetzner Object Storage, OVH Object Storage, Backblaze B2 ou AWS |
| **Alerte** | En cas d'échec, message envoyé à `BACKUP_ALERT_URL` (Slack, Google Chat ou Discord) ; Docker marque aussi le service « unhealthy » si aucune sauvegarde n'a réussi depuis 26 heures |
| **Fichiers** | Dossier `./backups` à côté de `docker-compose.yml`, nommés `smarttontine_AAAA-MM-JJTHHMMSSZ.dump.gpg` |

**Pourquoi une copie hors serveur :** une sauvegarde qui reste sur le serveur disparaît avec lui (panne de disque, piratage, résiliation). Pour une application qui garde l'argent de ses membres, la copie hors serveur est **obligatoire en production**.

## 17.2 Mise en service

1. Créer un fichier `.env` à côté de `docker-compose.yml`, en partant de `.env.example`, et définir **`BACKUP_PASSPHRASE`** : au moins 32 caractères aléatoires.
2. **Conserver cette phrase hors du serveur**, dans le coffre-fort de mots de passe de la direction. Sans elle, aucune sauvegarde ne peut être restaurée.
3. Créer un compartiment de stockage, par exemple Hetzner **Object Storage**, environ 6 €/mois pour 1 To. Renseigner `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY` et `BACKUP_S3_SECRET_KEY`.
4. Dans ce compartiment, régler une **durée de conservation** (règle de cycle de vie), par exemple 90 jours, et si possible le **verrouillage d'objets**, pour qu'une sauvegarde ne puisse pas être effacée depuis le serveur.
5. Renseigner `BACKUP_ALERT_URL` pour être prévenu d'un échec.
6. `docker compose up -d backup`, puis vérifier : `docker compose logs backup` doit afficher `[sauvegarde] terminée`.

## 17.3 Commandes utiles

```bash
docker compose logs -f backup                      # suivi des sauvegardes
docker compose exec backup backup.sh               # sauvegarde immédiate (avant une mise à jour, par exemple)
ls -lh backups/                                    # sauvegardes présentes sur le serveur
docker compose ps backup                           # état « healthy » = dernière réussite il y a moins de 26 h
```

## 17.4 Restaurer

> La restauration **remplace** le contenu actuel de la base. À faire uniquement après une perte de données, ou sur une base de test.

```bash
docker compose stop api worker                     # plus aucune écriture pendant la restauration
docker compose exec backup restore.sh /backups/smarttontine_2026-10-13T023000Z.dump.gpg --confirm
#   ou depuis la copie hors serveur :
docker compose exec backup restore.sh s3://<compartiment>/smarttontine/smarttontine_….dump.gpg --confirm
docker compose start api worker
```

La restauration se fait en une seule transaction : en cas d'erreur, la base reste dans son état précédent.

**Test de restauration mensuel (recommandé).** Une sauvegarde jamais restaurée n'est pas une sauvegarde. Une fois par mois, restaurer la dernière copie hors serveur dans une base de test, puis vérifier que le nombre de comptes et le solde du grand livre (somme nulle) sont cohérents.

## 17.5 Vérifications faites avant livraison

Tests faits sur la base de démonstration avec PostgreSQL 16, sur les scripts eux-mêmes :

| Test | Résultat |
|---|---|
| Sauvegarde sans `BACKUP_PASSPHRASE` | Refusée, message explicite, code d'erreur 1 |
| Sauvegarde | Archive de 108 Ko, reconnue comme « PGP symmetric key encrypted data – AES 256 » ; aucun texte lisible |
| Rotation | Sauvegarde quotidienne de plus de 14 jours supprimée ; sauvegarde du 1er du mois gardée ; sauvegarde mensuelle de plus de 12 mois supprimée |
| Restauration sans `--confirm` | Refusée |
| Restauration avec une mauvaise phrase secrète | Refusée (« decryption failed ») |
| Restauration dans une base vide | **Identique à l'original** : 7 comptes, 3 tontines, 35 écritures, grand livre équilibré |

**Restent à valider sur le serveur :**
- la copie vers le stockage S3 (`aws s3 cp`), qui demande un vrai compartiment ;
- l'image Docker elle-même, construite par GitHub Actions à chaque envoi sur `main`.
