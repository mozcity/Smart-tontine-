# 14. Test d'intrusion — rapport interne et cahier des charges du test externe

*Lot 4 — 2 octobre 2026. Périmètre : API (`backend/`), plateforme web (`web/`), back-office (`backend/public/admin`), application mobile (`mobile/`).*

Ce document a deux parties :
- **Partie A** : le test d'intrusion **interne**, mené par l'équipe de développement. Elle décrit la méthode, les constats et leurs correctifs.
- **Partie B** : le **cahier des charges du test externe**, à confier à un prestataire indépendant avant l'ouverture au public.

Le test interne ne remplace pas le test externe. Il retire les failles évidentes pour que le prestataire concentre son temps sur les attaques difficiles.

---

## Partie A — Test interne

### A.1 Méthode

| Étape | Outil / approche | Résultat |
|---|---|---|
| Revue de code des contrôles d'accès | Inventaire des **62 routes à paramètre** (`:id`, `:reference`…) et lecture du contrôle de chaque route | Toutes vérifient l'appartenance (membre, organisateur, staff partenaire, propriétaire) |
| Attaques automatisées | `backend/tests/securite.test.ts` : 11 scénarios rejoués à chaque intégration continue | 11 / 11 attaques bloquées |
| Paiements et webhooks | `paiements_reels.test.ts`, `sms.test.ts` : faux serveurs CinetPay, Orange et Twilio, notifications forgées et rejouées | Refusées ou sans effet |
| Dépendances | `npm audit --omit=dev` sur les trois projets | Voir A.4 |
| En-têtes HTTP | nginx lancé localement avec la configuration de production, puis requêtes `curl` sur chaque type de route | Constat S-01 corrigé et vérifié |
| CSP | Site, espace membre et back-office chargés dans Chromium sous la nouvelle politique | Aucune violation |

**Matrice d'accès croisés (IDOR).** Un membre « victime » crée une ressource de chaque type :
- tontine, coffre de groupe, e-caisse, projet ;
- ligne de budget, ticket de support, espace partenaire, dépôt.

Un second membre, « attaquant », lance ensuite **22 requêtes** sur ces ressources : lecture, démarrage, clôture, adhésion, ajout de membre, retrait, cassage d'e-caisse, modification et retrait du partenaire, simulation de dépôt.

Le test vérifie deux choses :
- chaque requête reçoit **403 ou 404** ;
- **rien n'a bougé** : soldes, membres, staff, données et grand livre équilibré.

### A.2 Constats et correctifs

| ID | Gravité | Constat | Correctif | Vérifié par |
|---|---|---|---|---|
| S-01 | Moyenne | **nginx n'envoyait pas les en-têtes de sécurité** sur les pages ni sur les fichiers JS : un `add_header` dans un bloc `location` annule ceux du niveau `server`. Seules les réponses de l'API étaient protégées. | En-têtes regroupés dans `web/security-headers.conf`, inclus dans chaque bloc | `curl` sur `/`, `/app/…`, `/assets/…`, `/theme-init.js` |
| S-02 | Moyenne | **Aucune politique de sécurité du contenu (CSP)**. Des scripts en ligne existaient dans le site (thème) et le back-office. Une injection HTML aurait donc pu exécuter du code. | CSP stricte `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, identique dans l'API (helmet) et nginx. Scripts déplacés dans des fichiers. | Test « en-têtes HTTP » + navigateur |
| S-03 | Moyenne | **Retrait vers le numéro d'un tiers sans identité vérifiée.** Avec une session volée et le PIN, l'argent pouvait partir vers le numéro de l'attaquant. | Retrait vers un autre numéro que celui du compte réservé aux membres KYC ≥ 1 (`kyc_required`) | Test « retrait vers le numéro d'un tiers » |
| S-04 | Moyenne | **Sessions de 30 jours impossibles à révoquer.** Après un vol de téléphone, il fallait attendre l'expiration du jeton ou la suspension du compte. | Colonne `sessions_revoked_at` et route `POST /auth/logout-all` : les anciens jetons sont refusés, l'appareil courant reçoit un nouveau jeton. Bouton « Déconnecter mes autres appareils » dans l'app. | Test « révocation » |
| S-05 | Moyenne | **Code OTP renvoyé dans la réponse** dès que `NODE_ENV` n'était pas `production`. Un déploiement mal configuré l'aurait exposé. | Le code n'est renvoyé que si `NODE_ENV` n'est pas `production` **et** si `SMS_PROVIDER=console` | Revue de code |
| S-06 | Faible | Identifiant mal formé (`/tontines/x`, injections SQL dans l'URL) → **erreur 500** et trace complète dans les journaux. La requête restait paramétrée, donc aucune injection n'était possible, mais ce comportement était sondable. | Erreurs PostgreSQL 22P02 / 22003 → 404 | Test « identifiants mal formés et injections SQL » (5 sondes × 5 routes) |
| S-07 | Faible | **Injection de formules dans les exports CSV** : un nom de groupe `=HYPERLINK(…)` s'exécutait à l'ouverture dans Excel chez l'organisateur ou le partenaire. | `lib/csv.ts` préfixe d'une apostrophe les cellules qui commencent par `= + - @` (les nombres ne sont pas touchés) | Test « export CSV » |
| S-08 | Faible | Source maps publiées : le code source lisible de la plateforme web était exposé. | `sourcemap: 'hidden'` et suppression des `.map` dans l'image Docker | Build : 0 référence `sourceMappingURL` |
| S-09 | Faible | Algorithme JWT non imposé à la vérification | `algorithms: ['HS256']` | Test « jetons » (`alg: none` refusé) |
| S-10 | Faible | CORS ouvert à toutes les origines | `CORS_ORIGINS` en production. Risque limité : les jetons voyagent dans l'en-tête `Authorization`, il n'y a pas de cookie. | Revue de code |
| S-13 | Faible | **Redirection ouverte** après connexion : `?next=//site-pirate.com` passait le contrôle « commence par / ». | Seuls les chemins internes sont acceptés (`/` non suivi de `/` ou `\`). | Revue de code |
| S-11 | Info | Webhooks sans limitation de débit | 300 requêtes / min | — |
| S-12 | Info | HSTS absent | `max-age=31536000; includeSubDomains` | Test « en-têtes HTTP » |

**Points contrôlés sans constat :**
- **jetons** falsifiés, signés avec une autre clé, expirés ou `alg: none` : tous refusés ;
- **rôle « admin »** inscrit dans un jeton : sans effet, car le rôle est relu en base ;
- **affectation de masse** sur `PATCH /auth/me` (`role`, `kyc_level`) : ignorée ;
- **montants falsifiés** (négatifs, décimaux, texte, 10¹²) : refusés sur les dépôts, les retraits et les transferts ;
- **webhooks** non signés, mal signés, au jeton deviné ou rejoués : refusés ou sans effet ;
- **back-office** : inaccessible à un membre ; la double authentification est exigée.

### A.3 Paiements et SMS : défenses en place

**Notification CinetPay.** Le `notify_token` reçu à l'initialisation est conservé côté serveur et n'est jamais renvoyé au client.
- La notification est comparée à ce jeton en temps constant.
- Une référence inconnue et un jeton faux reçoivent la même réponse 401.
- Le statut n'est **jamais lu dans la notification** : il est redemandé à CinetPay avant toute écriture comptable.

**Rejeu.** Le dépôt est verrouillé ligne par ligne (`FOR UPDATE`) puis crédité une seule fois. Un retrait confirmé ne peut plus être annulé.

**Erreur réseau pendant un retrait.** Le retrait est marqué « inconnu » et n'est jamais remboursé automatiquement. Le rattrapage horaire interroge CinetPay ; à défaut, le back-office tranche.

**Accusés de réception SMS.**
- Orange ne signe pas ses notifications : l'URL déclarée contient un jeton secret de 32 caractères.
- Twilio : la signature `X-Twilio-Signature` (HMAC-SHA1) est vérifiée.

**Codes OTP.** Ils ne sont jamais écrits dans le journal SMS : le code est masqué avant l'écriture.

### A.4 Dépendances

| Projet | Vulnérabilités (production) | Analyse |
|---|---|---|
| API | 0 | — |
| Web | 0 | — |
| Mobile | 15 (4 élevées, 11 moyennes) | Voir ci-dessous |

**Détail des 15 alertes mobiles :**
- **14 concernent l'outillage de build**, qui n'est pas embarqué dans l'application installée :
  - CLI Expo ;
  - `node-forge`, qui sert à la signature du code ;
  - `uuid`, utilisé via `xcode`.
- **1 concerne le runtime** : `decode-uri-component`, chargé par `expo-router`. Un lien profond malformé peut provoquer un déni de service local : l'app se fige, sans fuite de données.

`npm audit fix` propose de rétrograder vers Expo 44, ce qui n'est pas une option. **Risque accepté**, à revoir à chaque mise à jour d'Expo.

### A.5 Risques acceptés et observations

- **Rejoindre une tontine par son identifiant** : le lien d'invitation contient un UUID v4 (122 bits, impossible à deviner). C'est un modèle de « lien-capacité », comme les liens de partage de documents. Un lien diffusé publiquement permet à n'importe qui de demander à rejoindre ; l'organisateur garde la main sur le démarrage.
- **Numéros de téléphone visibles entre membres d'un même coffre** : choix produit, pour se contacter. Indiqué dans la politique de confidentialité (`/confidentialite`).
- **Photos KYC en base de données** : à déplacer vers un stockage objet chiffré au moment de l'hébergement de production (docs/12, action 8).
- **Limitation de débit en mémoire** : elle n'est pas partagée entre plusieurs instances de l'API. Il faudra la passer sur Redis si l'API est répliquée.

---

## Audit externe du 5 octobre 2026

Un audit en boîte noire (QA, sécurité, test d'intrusion non destructif, SEO, UX) a confirmé l'absence de faille critique. Il a relevé deux bloquants à lever avant la production (`devCode`, `/simulate`) et l'absence de limite sur la vérification OTP. Ces constats et tous les points « court terme » sont corrigés : voir [docs/16](16_corrections_audit.md).

## Partie B — Cahier des charges du test d'intrusion externe

### B.1 Objectif

Obtenir un avis indépendant sur la sécurité de Smart Tontine **avant l'ouverture au public**, puis tous les ans, et après chaque évolution majeure :
- nouvel agrégateur ;
- crédit SFD ;
- USSD.

Le rapport sert aussi de pièce justificative pour la banque partenaire (agrément BCEAO), l'agrégateur et la CIL.

### B.2 Périmètre

| Cible | Environnement | Inclus |
|---|---|---|
| API REST | Préproduction, identique à la production, CinetPay en bac à sable | Toutes les routes : membres, partenaires, back-office, webhooks |
| Plateforme web | Préproduction | Site public, espace membre, portail partenaire |
| Back-office | Préproduction | Comptes support et admin avec double authentification |
| App Android | APK de préproduction (profil EAS `preview`) | Analyse statique et dynamique |
| App iPhone | Build TestFlight | Analyse dynamique |
| Infrastructure | Serveurs de préproduction | Ports exposés, TLS, configuration nginx |

**Hors périmètre** :
- les systèmes de CinetPay, Orange et Twilio ;
- l'ingénierie sociale envers le personnel ;
- le déni de service volumétrique ;
- l'infrastructure de l'hébergeur.

### B.3 Référentiels

- **OWASP ASVS 4.0.3, niveau 2** pour l'API, le web et le back-office. Il faut viser le niveau 3 sur les chapitres V2 (authentification), V3 (sessions), V4 (contrôle d'accès) et V11 (logique métier).
- **OWASP MASVS 2.x** (profil L1 + R) pour l'application mobile.
- **OWASP API Security Top 10 (2023)**.

### B.4 Scénarios prioritaires

1. **Détournement d'argent** :
   - créditer un portefeuille sans payer (webhook forgé ou rejoué, montant modifié, course entre deux notifications) ;
   - retirer plus que son solde (requêtes concurrentes) ;
   - se faire verser deux fois un pot de tontine.
2. **Accès aux données d'un autre membre** : IDOR sur toutes les routes à identifiant, énumération de numéros de téléphone, export CSV d'un autre groupe.
3. **Prise de compte** :
   - force brute de l'OTP et du PIN (limites : 5 OTP par 15 min, 5 PIN puis 30 min de blocage) ;
   - réutilisation d'un jeton ;
   - contournement de la révocation.
4. **Escalade vers le back-office** : rôle, double authentification (TOTP, rejeu d'un code, réinitialisation par un autre admin).
5. **Espace partenaire** : un staff « manager » qui se donne le rôle « owner », un retrait du compte partenaire par un non-propriétaire, une marque blanche malveillante (XSS par le nom ou le logo).
6. **Application mobile** :
   - stockage du jeton (SecureStore) ;
   - liens profonds ;
   - captures d'écran des écrans sensibles ;
   - interception TLS ;
   - rétro-ingénierie de l'APK (secrets embarqués).
7. **Logique tontine et crédit** : cotiser pour un tour clôturé, manipuler le tirage au sort, contourner la caution ou le plafond de crédit.

### B.5 Règles d'engagement

- **Fenêtre** : 10 jours ouvrés en préproduction, prévenir 48 h avant de commencer.
- **Comptes fournis** :
  - 6 comptes membres, dont 2 vérifiés KYC ;
  - 2 comptes partenaires (owner et manager) ;
  - 1 compte support et 1 compte admin, avec double authentification.
- **Paiements** : CinetPay en bac à sable uniquement, aucun argent réel.
- **Débit** : au plus 20 requêtes / seconde. Arrêt immédiat et appel du contact technique en cas d'instabilité.
- **Confidentialité** : les données de test restent fictives. Le prestataire détruit ses copies 30 jours après la remise du rapport.
- **Faille critique** : signalement **sous 24 h**, sans attendre le rapport final.

### B.6 Livrables

1. Un **rapport** avec :
   - une synthèse pour la direction ;
   - le détail de chaque faille : preuve, gravité CVSS 3.1, référence ASVS / MASVS, recommandation ;
   - la grille ASVS remplie.
2. Une **restitution** orale d'une heure.
3. Un **contre-test** des correctifs, sous 30 jours, inclus dans le prix.

### B.7 Critères de choix du prestataire

- Qualification **PASSI** (ANSSI) ou équivalent, ou certifications **OSCP / OSWE** pour les auditeurs.
- Références sur des services financiers ou Mobile Money en Afrique de l'Ouest.
- Assurance responsabilité civile professionnelle.
- **Budget indicatif** : 6 à 10 millions FCFA pour le périmètre complet (web, API et mobile).

### B.8 Critère de mise en ligne

L'ouverture au public exige les deux conditions suivantes :
- **aucune faille critique ou élevée** ouverte ;
- chaque faille moyenne a un correctif livré ou une acceptation de risque signée par la direction.
