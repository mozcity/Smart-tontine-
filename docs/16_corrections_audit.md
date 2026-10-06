# 16. Corrections de l'audit externe du 5 octobre 2026

*Rapport reçu : « Audit Smart Tontine », version 1.0. Il évalue sept axes : QA, sécurité, test d'intrusion, SEO, UX, cycle multi-comptes et crédit/KYC. Corrections livrées le 6 octobre 2026.*

## 16.1 En résumé

Le rapport ne relevait **aucune faille critique**, mais deux bloquants à lever avant la production, plus un troisième dans le plan d'action. **Les trois sont corrigés**, de même que tous les points de sécurité et de SEO classés « court terme ».

**Ce qui a été vérifié :**
- **13 tests automatisés** reprennent les constats un par un (`backend/tests/audit.test.ts`), soit 83 tests en tout sur l'API ;
- la configuration nginx a été rejouée en local ;
- le parcours de connexion complet a été testé dans un navigateur.

| Sévérité (rapport) | Constats | Corrigés | Décidés / documentés |
|---|---|---|---|
| Élevé si production | 3 (dont un classé « moyen · élevé si prod ») | 3 | — |
| Moyen | 5 | 5 | — |
| Faible | 7 | 6 | 1 non reproduit |
| À décider / à confirmer | 3 | 2 | 1 (périmètre du PIN) |

## 16.2 Bloquants avant production

| Constat | Correction | Preuve |
|---|---|---|
| **Code OTP renvoyé en clair** (`devCode`) | Le code n'est renvoyé que si trois conditions sont réunies : hors production, avec les SMS en console, et `OTP_DEV_ECHO` différent de `false`. **L'API refuse de démarrer en production** avec `SMS_PROVIDER=console` ou `OTP_DEV_ECHO=true`. | Tests « le code OTP n'est renvoyé qu'en démonstration explicite » et « la production refuse… » |
| **Dépôt confirmable sans paiement** (`/wallet/deposits/{ref}/simulate`) | En production, la route **n'est même pas déclarée**, et l'API refuse de démarrer avec `PAYMENT_PROVIDER=mock`. Un dépôt n'est confirmé que par l'agrégateur : notification authentifiée, statut redemandé à CinetPay, idempotence (docs/13). | Test « la production refuse… » |
| **Pas de limite sur la vérification OTP** | Plusieurs limites se cumulent : **3 essais par code**, puis le code est invalidé (429). Au plus **10 essais ratés par numéro et par heure**, tous codes confondus. **10 essais par minute et par adresse IP**. Le code expire au bout de 5 minutes. Le message indique les essais restants. | Test « OTP : 3 essais par code puis 429… » |

**Autres gardes ajoutées au démarrage en production :**
- `KYC_ENCRYPTION_KEY` est obligatoire ;
- `JWT_SECRET` doit faire au moins 32 caractères.

## 16.3 Sécurité

| Constat | Correction |
|---|---|
| **JWT en `localStorage`, valable 30 jours** | **Sessions courtes** : un jeton d'accès de **30 minutes**, gardé uniquement en mémoire, et un jeton de renouvellement de 30 jours. Ce dernier change à chaque usage ; s'il est réutilisé, toute la session est révoquée (vol présumé). **Web** : il vit dans un **cookie `HttpOnly`, `SameSite=Strict`, `Path=/auth`**, illisible par JavaScript. **App** : il est rangé dans le trousseau sécurisé du téléphone. L'ancien jeton stocké est effacé au premier chargement. Le jeton du back-office passe en `sessionStorage`, qui disparaît à la fermeture de l'onglet. |
| « Rôle embarqué dans le jeton » | Déjà sans risque : le rôle et le statut sont **relus en base à chaque requête** (`requireAuth`). Le rôle inscrit dans le jeton n'est jamais utilisé, ce que vérifie le test « jeton se disant admin → 403 » (docs/14). |
| **PIN trivial accepté** (0000) | Sont refusés : les chiffres identiques, les suites croissantes ou décroissantes (1234, 9876), les motifs répétés (1212) et les codes les plus courants (2580, années récentes). Message « Code PIN trop facile à deviner ». |
| **Téléphone de tous les membres exposé** | Le numéro des autres membres est **masqué** (`+226 70 •• •• 56`) dans les tontines et les coffres. L'organisateur, ou l'administrateur du coffre, et le membre lui-même le voient en entier. La liste des cotisations n'affiche plus le numéro des membres sans nom. Politique de confidentialité mise à jour. |
| **Routes inconnues → page de l'app (200)** | L'API répond par un **404 JSON** sous ses préfixes. nginx et l'API ne servent la page de l'app (200) **que pour les routes connues**. Toute autre adresse (`/users`, `/.env`, `/wp-admin`) renvoie un **vrai 404**. |
| À valider : chiffrement des documents KYC | **Fait** : numéro de pièce, recto, verso, selfie et justificatif sont chiffrés en AES-256-GCM avant d'être écrits en base (`lib/vault.ts`), et déchiffrés uniquement à la consultation par le back-office, consultation qui reste journalisée. |

## 16.4 Fonctionnel et UX

| Constat | Correction |
|---|---|
| **Nom non enregistré à l'inscription** | Si le compte n'a pas encore de nom, le nom saisi à la connexion est enregistré ; un nom existant n'est jamais écrasé. Sur le web et dans l'app, un compte sans nom est invité à le saisir avant d'entrer (étape « Votre nom »). |
| **Champ téléphone accepte les lettres** | Web et app : seuls les chiffres, les espaces et le « + » sont acceptés. Codes OTP et PIN : chiffres uniquement, clavier numérique. |
| **Plafond de cotisation vérifié seulement côté serveur** | L'assistant de création affiche en direct « La cotisation doit être comprise entre 500 F et 5 000 000 F » et bloque « Continuer ». Les bornes sont celles de l'API. |
| **Prépaiement d'un tour futur** | Interdit : une cotisation porte **toujours sur le tour en cours** (409 `not_current_round`). Un tour futur ne peut donc plus être complété, et versé, avant les précédents, ce qui préserve l'ordre de passage et la détection des impayés. Les applications ne proposaient déjà que le tour en cours. |
| **PIN non demandé pour les cotisations** | Décision : le PIN protège l'argent qui **quitte le contrôle du membre** (retraits, envois, crédit, suppression du compte). Une cotisation reste dans le circuit de la tontine, sous le grand livre et la caution. Les textes sont alignés : « demandés pour chaque retrait, envoi d'argent et crédit ». **À revoir** si la direction préfère un PIN au-delà d'un seuil de cotisation. |
| **Pas de lien d'évitement** | Ajout d'un lien « Aller au contenu », premier élément atteint au clavier, sur le site public et dans les espaces membre et partenaire. |
| **Erreur console sur `/connexion`** (média sans source) | **Non reproduit** : la page ne contient aucun élément audio ou vidéo, et Chromium ne relève aucune erreur après correction. L'erreur venait sans doute de l'outil de test ou d'une extension du navigateur. Le seul message réseau observé (un 401 de session pour un visiteur anonyme) est supprimé. |
| Champ `points` de `/auth/me` ≠ score | Ce n'est pas un doublon : ce sont les **points des challenges d'épargne** (récompenses). Le score de crédit est calculé à part et renvoyé par `/credit/offers`. |
| Numéro de démo en 401 à l'adhésion | Non reproduit. Cause probable : un jeton révoqué par « déconnecter mes autres appareils » ou issu d'une ancienne base de démonstration. |

## 16.5 SEO

| Constat | Correction |
|---|---|
| **Pas d'Open Graph ni de Twitter Cards** | Balises `og:*` et `twitter:*` complètes, avec une image de partage de **1200 × 630** (`web/public/og-image.png`, générée avec la bannière des stores). Titre, description, URL canonique et `og:url` sont mis à jour à chaque page. |
| **`robots.txt` et `sitemap.xml` absents** | Les deux fichiers sont servis. Les espaces connectés, l'API et les liens d'invitation sont exclus de l'indexation. |
| **Pas de données structurées ni de canonical** | Le JSON-LD décrit **FinancialService** (zone UEMOA) et **FAQPage** (les 5 questions de l'accueil). Chaque page a son URL canonique ; les pages « introuvable » et d'invitation sont en `noindex`. |
| Pré-rendu ou SSR des pages publiques | **Reste à faire** (moyen terme). Google exécute le JavaScript, et les aperçus WhatsApp et Facebook reposent sur les balises statiques d'`index.html`, déjà en place. |

## 16.6 Outillage de démonstration (cas non testés par l'audit)

Pour rejouer les cas qui dépendent du temps, de nouvelles routes sont disponibles **hors production uniquement**, et seulement pour l'organisateur de la tontine :

| Route | Effet |
|---|---|
| `POST /dev/tontines/{id}/rounds/{n}/overdue` | Le tour passe en impayé (échéance + délai de grâce dépassés), puis les tâches planifiées s'exécutent. La caution du retardataire paie alors le bénéficiaire. |
| `POST /dev/tontines/{id}/rounds/{n}/due-in` `{ "days": 70 }` | Repousse l'échéance d'un tour, par exemple pour tester une avance sur un pot à plus de 61 jours. |
| `POST /dev/jobs/run` | Exécute immédiatement les tâches horaires : rappels, impayés, crédits, rattrapages. |

Le cas d'impayé est couvert par un test automatisé : caution utilisée, bénéficiaire payé, grand livre équilibré.

## 16.7 Reste à faire

| Sujet | Horizon |
|---|---|
| Pré-rendu des pages publiques (accueil, Découvrir, Tarifs) | Moyen terme |
| Accès sans smartphone (USSD, agents relais) | Lot 5 |
| « Où est mon argent ? » : statut de cantonnement BCEAO par tontine | Après la convention avec l'établissement agréé |
| PIN au-delà d'un seuil de cotisation | Décision produit (16.4) |
| Nouveau build mobile EAS : les sessions courtes nécessitent la nouvelle version de l'app | À lancer après le dépôt sur GitHub |

## 16.8 Effets pour l'équipe

- **Production** : définir `KYC_ENCRYPTION_KEY` et `JWT_SECRET` (au moins 32 caractères), `PAYMENT_PROVIDER=cinetpay` et `SMS_PROVIDER=orange,twilio`. Sinon l'API refuse de démarrer, avec la liste des erreurs.
- **Démonstration locale** : rien ne change. Le code OTP s'affiche toujours à l'écran et le bouton « Simuler la confirmation » reste disponible.
- **Données de démonstration** : le PIN des comptes de démonstration et des tests passe de `1234`, désormais refusé, à **`4826`**.
- **Mise à jour des sessions** : les membres connectés avec une ancienne version devront se reconnecter une fois.
