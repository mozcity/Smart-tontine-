# 5. Plateforme informatique et application mobile

## 5.1 Architecture

```
 ┌──────────────────────┐     HTTPS/JSON      ┌─────────────────────────────────────┐
 │ App mobile (Expo/RN) │ ──────────────────► │ API SMARTFIN (Node.js / Express 5)  │
 │ Android · iOS · Web  │                     │  auth · wallet · e-caisse · cagnotte│
 └──────────────────────┘                     │  budget · projets · challenges      │
 ┌──────────────────────┐                     │  contrats · support · admin (CRM)   │
 │ Back-office CRM web  │ ──────────────────► │  jobs horaires (déblocages, abonn.) │
 │ /admin               │                     └───────┬───────────────┬─────────────┘
 └──────────────────────┘                             │               │
                                                      ▼               ▼
                                     ┌─────────────────────┐  ┌───────────────────────────┐
                                     │ PostgreSQL 16       │  │ Agrégateur / opérateurs   │
                                     │ grand livre en      │  │ Wave · Orange · MTN · Moov│
                                     │ partie double       │◄─┤ webhooks signés HMAC      │
                                     └─────────────────────┘  └───────────────────────────┘
                                                               SMS OTP · KYC · push
```

| Composant | Dossier | Technologie |
|---|---|---|
| API | `backend/src` | Node.js 22, TypeScript, Express 5, Zod, `pg` (SQL explicite, pas d'ORM) |
| Base de données | `backend/migrations` | PostgreSQL 16 |
| Back-office CRM | `backend/public/admin` | HTML + JS sans dépendance, servi par l'API |
| App mobile | `mobile/` | Expo SDK 57, React Native 0.86, Expo Router, SecureStore |
| Tests | `backend/tests` | Vitest + Supertest, sur une vraie base PostgreSQL |
| Modèle financier | `finance/` | Python + openpyxl → Excel à formules |

## 5.2 Le cœur : un grand livre en partie double

Chaque « poche » d'argent est un **compte** (`accounts`) : portefeuille, e-caisse, cagnotte, projet, challenge, et trois comptes système (`SYS_FLOAT` = fonds chez les opérateurs, `SYS_FEES` = revenus, `SYS_REWARDS` = budget récompenses). Chaque mouvement est une **transaction** composée d'**écritures** dont la somme est **toujours nulle** (`services/ledger.ts`).

Garanties :
- aucun franc créé ni perdu : `SUM(accounts.balance) = 0` en permanence, vérifiable dans *Finance → Contrôle du grand livre* ;
- solde client jamais négatif : contrainte `CHECK` en base + vérification applicative ;
- pas de double débit concurrent : verrouillage `SELECT … FOR UPDATE` des comptes, dans un ordre fixe (pas d'interblocage) ;
- montants en **entiers FCFA** (`BIGINT`) : pas d'erreur d'arrondi ;
- dépôts **idempotents** : un webhook rejoué ne crédite pas deux fois.

## 5.3 Flux d'argent

| Flux | Déroulé |
|---|---|
| **Dépôt** | App → `POST /wallet/deposits` → transaction `pending` + URL de paiement → le client paie sur Wave/OM → webhook signé `POST /webhooks/payments` → crédit du portefeuille, notification, bonus parrain éventuel |
| **Retrait** | PIN vérifié → débit immédiat (montant + frais) → ordre de paiement opérateur → si échec : écriture d'annulation automatique ; si issue inconnue : file « à rapprocher » dans le back-office |
| **E-caisse** | Portefeuille → compte e-caisse ; job horaire : retour automatique à l'échéance ; rupture anticipée : 2 % vers `SYS_FEES` |
| **Cagnotte+** | Cotisations → compte de la cagnotte ; retrait = demande d'un admin (1re validation) + validation d'un 2e admin → versement au bénéficiaire |
| **Contrat** | Signature de la contrepartie (PIN) → prêt versé ; chaque échéance payée débiteur → créancier |

## 5.4 Référence API (résumé)

| Domaine | Routes |
|---|---|
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET/PATCH /auth/me`, `PUT /auth/me/pin` |
| Portefeuille | `GET /wallet`, `GET /wallet/history`, `POST /wallet/deposits`, `GET /wallet/withdrawals/quote`, `POST /wallet/withdrawals`, `POST /wallet/transfers` |
| E-caisse | `GET/POST /ecaisses`, `POST /ecaisses/:id/topup|release|break` |
| Cagnotte+ | `GET/POST /cagnottes`, `GET /cagnottes/:id`, `POST /cagnottes/:id/members|contribute|withdrawals`, `POST /cagnottes/withdrawals/:wid/decision` |
| Budget | `GET /budget/categories`, `PUT /budget/plans/:month`, `POST/DELETE /budget/entries`, `GET /budget/summary` |
| Projets | `GET/POST /projets`, `POST /projets/:id/contribute|close`, `POST /projets/:id/steps/:stepId/done` |
| Challenges | `GET /challenges`, `GET /challenges/leaderboard`, `POST /challenges/:code/join`, `POST /challenges/participations/:id/save|withdraw` |
| Contrats | `GET/POST /contrats`, `GET /contrats/:id`, `POST /contrats/:id/sign|cancel`, `POST /contrats/:id/echeances/:eid/pay` |
| Compte | `GET /me/notifications`, `GET /me/news`, `POST /me/plan/subscribe|cancel`, `GET/POST /me/support/tickets` |
| Back-office | `/admin/api/kpis`, `customers`, `customers/:id`, `notes`, `tickets`, `campaigns`, `news`, `ledger/check`, `withdrawals/to-reconcile` |
| Public | `GET /health`, `GET /pricing`, `POST /webhooks/payments` |

## 5.5 Sécurité

Déjà en place :
- OTP à 6 chiffres haché (scrypt), expiration 5 min, 5 essais max, 5 demandes / 15 min par numéro ;
- **code PIN obligatoire** pour toute sortie d'argent (retrait, transfert, rupture d'e-caisse, signature et remboursement de contrat) ;
- JWT signé, statut et rôle relus en base à chaque requête (une suspension est immédiate) ;
- jeton stocké dans le Keychain/Keystore (`expo-secure-store`) ;
- webhooks vérifiés par HMAC-SHA256 en temps constant ;
- validation stricte de toutes les entrées (Zod), en-têtes de sécurité (Helmet), requêtes SQL paramétrées.

À faire avant la mise en production :
- limitation de débit globale (reverse proxy / WAF) et journalisation centralisée ;
- vérification serveur-à-serveur de chaque paiement auprès de l'agrégateur avant crédit (l'emplacement est marqué dans `modules/webhooks.ts`) ;
- test d'intrusion externe (budgété : 5 M F) ;
- chiffrement des sauvegardes, rotation des secrets, 2FA pour les comptes back-office ;
- plafond d'entrées mensuelles par niveau KYC ;
- verrouillage du PIN après plusieurs échecs.

## 5.6 Hébergement et exploitation

| Élément | Recommandation |
|---|---|
| Hébergement | Cloud avec région proche (ex. AWS `af-south-1`, ou hébergeur local si exigé par le partenaire bancaire) ; PostgreSQL managé avec sauvegardes point-in-time |
| Environnements | `dev` (local), `staging` (fournisseur de paiement en mode test), `production` |
| Déploiement | Conteneur Docker de l'API ; app via **EAS Build / EAS Submit** vers Play Store et App Store ; mises à jour OTA via **EAS Update** |
| Supervision | Uptime `/health`, alertes sur erreurs 5xx, contrôle quotidien `ledger/check` |
| Rapprochement | Quotidien : relevés opérateurs ↔ transactions `deposit`/`withdrawal` ↔ solde du compte de cantonnement |

## 5.7 Démarrer en local

```bash
# API + back-office
cd backend
cp .env.example .env              # variables par défaut : PostgreSQL local, paiements simulés
npm install
npm run seed                      # schéma + données de démo (admin : +2250748553268)
npm run dev                       # http://localhost:4000 · back-office : http://localhost:4000/admin
npm test                          # 18 tests de bout en bout (base smartfin_test)

# Application mobile
cd ../mobile
npm install
npx expo start                    # scanner le QR code avec Expo Go, ou « w » pour le web
```

En développement, le code OTP est renvoyé dans la réponse de l'API et affiché à l'écran (jamais en production). Sur un téléphone physique, remplacez `extra.apiUrl` dans `mobile/app.json` par l'adresse IP de votre ordinateur.
