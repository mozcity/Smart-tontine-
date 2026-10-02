# 13. Lot 4 — Paiements réels, SMS, test d'intrusion, stores

*2 octobre 2026. Ce document est la synthèse du Lot 4. Le détail se trouve dans [docs/14](14_test_intrusion.md) (sécurité) et [docs/15](15_publication_stores.md) (stores).*

## 13.1 En résumé

| Volet | Livré | Reste à faire (hors code) |
|---|---|---|
| **Paiements réels** | CinetPay API v1 : dépôts, **retraits**, notifications, rattrapage | Compte marchand CinetPay (encaissement et transfert), clés `sk_live_` |
| **SMS** | Orange SMS API (Burkina), Twilio en secours, journal, accusés de réception | Contrat Orange SMS (et nom d'expéditeur), compte Twilio |
| **Test d'intrusion** | Test interne : 13 constats corrigés, 13 scénarios d'attaque automatisés | **Test externe** par un prestataire (cahier des charges prêt) |
| **Stores** | Icônes, splash, captures, fiches, formulaires, suppression du compte, compte de revue, conformité aux règles « prêts » de Google | Comptes Apple et Google (D-U-N-S), projet EAS, builds, essais sur vrais téléphones |

**Qualité** :
- **70 tests** automatisés sur l'API, contre 46 avant le lot ;
- 4 tests sur le web ;
- typage strict sur l'API, le web et le mobile.

## 13.2 Paiements : CinetPay API v1

L'intégration précédente reposait sur l'ancienne API « Checkout v2 » de CinetPay et ne savait pas faire de retraits. Elle est réécrite sur l'**API v1**, d'après le SDK officiel `cinetpay-go`.

| Opération | Appel CinetPay | Notre traitement |
|---|---|---|
| Authentification | `POST /v1/oauth/login` (identifiants **par pays**) | Jeton gardé 23 h, renouvelé une fois si CinetPay répond « jeton expiré » (1003). Les identifiants n'apparaissent jamais dans les erreurs. |
| Dépôt | `POST /v1/payment`, canal `PUSH` | Moyen de paiement déduit de l'opérateur choisi et de l'indicatif : `+226` + Orange → `OM_BF`. Le membre valide sur son téléphone ou sur la page CinetPay. |
| Vérification d'un dépôt | `GET /v1/payment/{référence}` | Seul `SUCCESS` crédite le portefeuille |
| Retrait | `POST /v1/transfer` | Le retrait est **asynchrone** : statut « en cours » (202), puis confirmé ou annulé |
| Vérification d'un retrait | `GET /v1/transfer/{référence}` | `SUCCESS` → confirmé ; `FAILED` → annulé et **recrédité** |
| Notification | `POST /webhooks/cinetpay` (`notify_token`, `merchant_transaction_id`) | Jeton comparé à celui reçu à l'initialisation, puis statut redemandé à CinetPay |

**Contrôles avant tout débit.** Le système refuse d'abord une opération que CinetPay ne pourra pas exécuter :
- opérateur absent du pays (MTN au Burkina) ;
- montant au-delà des plafonds CinetPay : 2 500 000 F par dépôt et 1 500 000 F par retrait.

Les applications n'affichent d'ailleurs que les opérateurs du pays du membre.

**Cycle d'un retrait :**

```
Débit du portefeuille ──▶ POST /v1/transfer
   ├─ refus immédiat (solde marchand, destinataire inconnu…) ──▶ annulé, recrédité, message au membre
   ├─ erreur réseau ──▶ « inconnu » : jamais remboursé automatiquement ; rattrapage horaire, sinon back-office
   └─ PENDING ──▶ « en cours »
          ├─ notification CinetPay ou rattrapage (toutes les heures, après 5 min) ──▶ SUCCESS : confirmé
          └─                                                                    ──▶ FAILED : annulé, recrédité
```

Un retrait confirmé ne peut plus être annulé, ni par une notification tardive ni par le back-office : l'argent est parti.

**Mise en service** (après signature du contrat marchand) :

1. Dans l'espace marchand CinetPay, récupérer `api_key` et `api_password` pour le Burkina. Activer le **transfert** et l'alimenter : les retraits sont prélevés sur ce solde.
2. Renseigner `PAYMENT_PROVIDER=cinetpay`, `CINETPAY_API_KEY`, `CINETPAY_API_PASSWORD`, `PUBLIC_API_URL` et `PUBLIC_WEB_URL`. Pour un autre pays : `CINETPAY_API_KEY_CI`, etc.
3. Commencer avec une clé `sk_test_…` (bac à sable) en préproduction. Rejouer : dépôt, dépôt refusé, retrait, retrait refusé, notification perdue (le rattrapage doit la récupérer).
4. Passer en `sk_live_…`, puis faire un dépôt et un retrait réels de 100 F avec un compte de l'équipe.
5. Surveiller chaque jour l'écran « Retraits à rapprocher » du back-office pendant le premier mois.

## 13.3 SMS : Orange en priorité, Twilio en secours

| Sujet | Fonctionnement |
|---|---|
| Fournisseurs | `SMS_PROVIDER=orange,twilio` : liste ordonnée, le suivant prend le relais en cas d'échec |
| Routage | Orange (contrat Burkina) pour les numéros `+226` ; Twilio pour les autres pays |
| Orange SMS API | OAuth `client_credentials` (jeton d'1 h, renouvelé sur 401), expéditeur `tel:+2260000`, nom d'expéditeur `SmartTontine` (à faire valider par Orange) |
| Twilio | API Messages, `MessagingServiceSid` ou numéro `From` |
| Coût maîtrisé | Texte converti en alphabet GSM 7 bits (accents, guillemets typographiques, émojis retirés), pour tenir en **1 SMS de 160 caractères** au lieu de 70 en Unicode |
| Journal | Table `sms_log` : fournisseur, statut, segments, tentatives. **Le code OTP est masqué** avant d'être écrit. |
| Accusés de réception | Orange : URL contenant un jeton secret (`SMS_WEBHOOK_TOKEN`). Twilio : signature `X-Twilio-Signature` vérifiée. |
| Échec | OTP impossible à envoyer → le membre voit « réessaie dans un instant » (503). Rappel impossible → seulement journalisé. |

**Conservation.** Les journaux SMS sont purgés après 12 mois, les événements d'usage après 24 mois, les codes OTP après 1 jour, comme l'annonce la politique de confidentialité.

## 13.4 Sécurité : ce qui a changé pour les membres

- **Déconnecter mes autres appareils** (Profil) : à utiliser après la perte ou le vol d'un téléphone.
- **Supprimer mon compte** (Profil, ou `/suppression-compte` sur le web). La suppression est refusée tant qu'il reste de l'argent ou un engagement : tontine en cours, crédit, contrat, achat de bien.
- **Retrait vers le numéro d'un tiers** : réservé aux membres dont l'identité est vérifiée.
- **Crédit** : remboursement complet jamais avant 61 jours. L'avance sur tontine n'est proposée que si le pot arrive dans 61 jours ou plus, et le microcrédit se fait sur 3, 4 ou 6 mois. C'est une règle de Google Play, et c'est aussi plus prudent pour le membre.

Le détail des 13 constats et de leurs correctifs est dans [docs/14](14_test_intrusion.md).

## 13.5 Nouvelles variables d'environnement

| Variable | Rôle |
|---|---|
| `CINETPAY_COUNTRY`, `CINETPAY_API_KEY`, `CINETPAY_API_PASSWORD` (+ `_CI`, `_SN`…) | Identifiants CinetPay v1 par pays |
| `CINETPAY_BASE_URL` | Surcharge de l'URL de CinetPay (tests, proxy) |
| `PUBLIC_API_URL`, `PUBLIC_WEB_URL` | Adresses de notification et de retour après paiement |
| `SMS_PROVIDER` | `console` en développement ; `orange,twilio` en production |
| `ORANGE_SMS_CLIENT_ID`, `ORANGE_SMS_CLIENT_SECRET`, `ORANGE_SMS_SENDER`, `ORANGE_SMS_SENDER_NAME`, `ORANGE_SMS_COUNTRY_PREFIX` | Orange SMS API |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FROM` | Twilio |
| `SMS_WEBHOOK_TOKEN` | Jeton secret des accusés de réception Orange (32 caractères aléatoires) |
| `CORS_ORIGINS` | Origines web autorisées en production |
| `REVIEW_PHONE`, `REVIEW_OTP` | Compte de revue des stores (à vider après validation) |

Migrations ajoutées : `009_sms.sql` (journal SMS) et `010_securite.sql` (révocation des sessions).

## 13.6 Fichiers principaux

| Fichier | Contenu |
|---|---|
| `backend/src/services/payments/cinetpay.ts` | Client CinetPay v1 |
| `backend/src/modules/wallet.ts` | Dépôts, retraits asynchrones, rattrapages |
| `backend/src/modules/webhooks.ts` | Notifications CinetPay, accusés de réception SMS |
| `backend/src/services/sms.ts` | Orange, Twilio, translittération GSM 7 bits, journal |
| `backend/tests/paiements_reels.test.ts` | Faux serveur CinetPay : dépôts, jetons, retraits, refus |
| `backend/tests/sms.test.ts` | Faux serveurs Orange et Twilio : routage, secours, accusés |
| `backend/tests/securite.test.ts` | Attaques : IDOR, jetons, injections, montants, en-têtes, suppression du compte, compte de revue |
| `web/security-headers.conf` | En-têtes de sécurité et CSP pour nginx |
| `mobile/store/` | Générateurs de visuels, captures, bannière |
