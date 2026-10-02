# 15. Publication sur Google Play et l'App Store

*Lot 4 — 2 octobre 2026. Application : `mobile/` (Expo SDK 57). Visuels : `mobile/store/`.*

## 15.1 Où en est-on ?

| Élément | État |
|---|---|
| Icônes iOS et Android (adaptative, monochrome), écran de démarrage, favicon | ✅ Générés depuis le logo : `mobile/store/generer-visuels.cjs` |
| Captures d'écran : iPhone 6,9 po (1290 × 2796) et Android (1080 × 1920), 6 écrans | ✅ `mobile/store/captures/finales/` |
| Bannière Google Play (1024 × 500) et icône 512 × 512 | ✅ `mobile/store/` |
| Configuration `app.json` | ✅ Voir 15.2 |
| Politique de confidentialité en ligne | ✅ `https://smarttontine.app/confidentialite` |
| Suppression du compte (dans l'app et sur le web) | ✅ Profil → Supprimer mon compte, et `https://smarttontine.app/suppression-compte` |
| Compte de revue pour Apple et Google | ✅ `REVIEW_PHONE` / `REVIEW_OTP` côté API |
| Règle Google Play sur les prêts (pas de remboursement complet en 60 jours ou moins) | ✅ Avances et microcrédit : 61 jours minimum |
| Comptes développeur Apple et Google, projet EAS, builds signés | ⏳ **À faire par la direction** (15.6) |
| Essais sur vrais téléphones, puis bêta fermée | ⏳ Après le premier build |

## 15.2 Configuration de l'application

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Identifiant | `app.smarttontine.mobile` (iOS et Android) | Définitif après la première publication |
| Version | `1.0.0` ; numéros de build gérés par EAS (`appVersionSource: remote`, `autoIncrement`) | Pas de conflit de numéro entre deux builds |
| iPad | Non pris en charge (`supportsTablet: false`) | L'app est pensée pour le téléphone. Apple exigerait sinon des captures iPad. |
| Chiffrement | `usesNonExemptEncryption: false` | Seul le HTTPS standard est utilisé : exempté de déclaration d'export |
| Permissions Android | `CAMERA` uniquement | `RECORD_AUDIO`, stockage externe et superposition bloqués |
| Micro | Désactivé dans expo-image-picker | Aucune vidéo, aucun son |
| Sauvegarde Android | `allowBackup: false` | Le jeton de session (SecureStore) ne part pas dans les sauvegardes Google |
| Écran de démarrage | expo-splash-screen : logo sur fond blanc, ou `#14123A` en mode sombre | — |
| Adresse de l'API | `https://api.staging.smarttontine.app` (preview), `https://api.smarttontine.app` (production) | Profils `eas.json` |

> **Nom de domaine** : la configuration utilise désormais `smarttontine.app` partout (avant : un mélange de `.app` et `.bf`). Il faut l'acheter, ou remplacer ce nom dans `eas.json` et `backend/.env`.

## 15.3 Fiche du store (français)

**Nom** (30 caractères max.) : Smart Tontine

**Sous-titre App Store** (30) : Tontine en ligne, sans espèces

**Description courte Google Play** (80) : Cotisez par Orange Money, Moov Money ou Wave et recevez votre pot à votre tour.

**Description complète** :

> **La tontine, en plus sûr.** Smart Tontine fait tourner vos tontines sans espèces et sans carnet. Chacun cotise depuis son téléphone et le pot est versé automatiquement à la bonne personne, au bon moment.
>
> **Vos tontines**
> • Créez une tontine en une minute ou rejoignez-en une avec un code
> • Cotisez par Orange Money, Moov Money ou Wave
> • Pot versé automatiquement ; ordre de passage fixe ou tiré au sort
> • Caution de garantie : si un membre ne paie pas, le tour est quand même versé
> • Rappels la veille et le jour de chaque cotisation
>
> **Votre épargne**
> • E-caisse : bloquez de l'argent jusqu'à une date choisie
> • Projets et challenges d'épargne
> • Coffres de groupe pour les associations, familles et GIE, avec validation des retraits à plusieurs
>
> **Vos biens**
> Moto, réfrigérateur, téléphone : épargnez seul ou en tontine auprès de commerçants partenaires. Le vendeur n'est payé que lorsque vous confirmez la réception.
>
> **Crédit responsable**
> Votre régularité construit votre score Smart Tontine. Il ouvre l'accès à une avance sur votre pot et au microcrédit, accordés par des institutions de microfinance (SFD) agréées.
>
> **Sécurité**
> Fonds cantonnés auprès d'un établissement agréé par la BCEAO, code PIN pour chaque opération, vérification d'identité.

**Mots-clés App Store** (100) : `tontine,épargne,cotisation,mobile money,orange money,moov,wave,microcrédit,burkina,association`

**Mentions crédit, obligatoires dans la fiche Google Play** (politique « Services financiers ») :

> Avance sur tontine et microcrédit accordés par nos SFD partenaires agréés (Burkina Faso). Durée de remboursement : 61 jours minimum, 6 mois maximum. TAEG maximal : 18 % (1,5 % par mois), aucuns frais de dossier. Exemple : un microcrédit de 100 000 FCFA sur 4 mois coûte 3 777 FCFA d'intérêts. Le remboursement total est donc de 103 777 FCFA, en 4 mensualités d'environ 25 944 FCFA.

| Champ | Valeur |
|---|---|
| Catégorie | Finance |
| Public cible | 18 ans et plus |
| Coordonnées | support@smarttontine.app ; site https://smarttontine.app |
| Politique de confidentialité | https://smarttontine.app/confidentialite |

## 15.4 Formulaires de conformité

### Google Play — Sécurité des données

| Donnée | Collectée | Partagée | Finalité | Facultative |
|---|---|---|---|---|
| Nom | Oui | Non* | Fonctionnement, gestion du compte | Non |
| Adresse e-mail | Oui | Non | Gestion du compte | **Oui** |
| Numéro de téléphone | Oui | Oui (agrégateur, SMS) | Fonctionnement, sécurité, gestion du compte | Non |
| Pièce d'identité, selfie (photos) | Oui | Non | Prévention de la fraude, obligation légale | Oui (seulement pour relever les plafonds) |
| Informations de paiement, historique d'achats | Oui | Oui (agrégateur, SFD pour le crédit) | Fonctionnement | Non |
| Solvabilité (score) | Oui | Oui (SFD, si le membre demande un crédit) | Fonctionnement | Oui |
| Interactions dans l'app | Oui | Non | Statistiques | Non |

\* Les prestataires qui agissent pour notre compte (hébergement, agrégateur, SMS) ne comptent pas comme un « partage » au sens de Google ; ils sont tout de même cités dans la politique de confidentialité.

**Autres réponses du formulaire :**
- Données chiffrées en transit : **oui**.
- Suppression possible : **oui** (dans l'app et à l'adresse `/suppression-compte`).
- Localisation, contacts, photos de la galerie hors KYC, audio : **non collectés**.

### Google Play — Autres déclarations

- **Fonctionnalités financières** : portefeuille, transferts entre membres, épargne, **prêts personnels** (via des SFD partenaires). Joindre la licence du SFD partenaire et la convention avec l'établissement agréé BCEAO.
- **Publicité** : aucune.
- **Accès à l'app** : identifiants du compte de revue (15.5).
- **Classification du contenu (IARC)** : pas de contenu sensible. L'app manipule de l'argent réel, donc le public cible est réservé aux adultes.

### App Store — Confidentialité (« étiquettes nutritionnelles »)

**Données associées à l'identité :**
- coordonnées : nom, téléphone, e-mail ;
- informations financières ;
- contenu utilisateur : photos pour la vérification d'identité ;
- identifiants : identifiant utilisateur ;
- usage : interactions avec le produit.

**Suivi publicitaire** : aucun. Il n'y a donc pas d'écran App Tracking Transparency.

**Points de vigilance pour la revue Apple :**
- **Compte d'organisation obligatoire** : Apple exige qu'une app de services financiers soit publiée par la société elle-même (règle 3.2.1), et non par un développeur individuel. Il faut un numéro D-U-N-S.
- **Suppression du compte dans l'app** : faite (règle 5.1.1(v)).
- **Notes pour l'équipe de revue** : expliquer le principe de la tontine, indiquer que les paiements passent par Mobile Money (hors achats intégrés, règle 3.1.3) et fournir le compte de revue.

## 15.5 Compte de revue

Les équipes Apple et Google se connectent sans recevoir de SMS. Pour cela :

1. En production, définir `REVIEW_PHONE` (par exemple `+22670999000`) et `REVIEW_OTP` (6 chiffres) dans l'environnement de l'API.
2. Communiquer ce numéro et ce code dans App Store Connect (« Informations de revue ») et dans la Play Console (« Accès à l'application »).
3. Créer un groupe de démonstration avec ce compte : une tontine et un peu de solde, crédité depuis le back-office.

**Garde-fous :**
- sans ces deux variables, rien n'est actif ;
- le code fixe ne fonctionne jamais pour un compte support ou admin ;
- les limites habituelles s'appliquent (5 essais, 5 demandes par 15 minutes) ;
- **vider les deux variables une fois l'app validée**.

## 15.6 Ce que la direction doit faire

| # | Action | Coût | Délai |
|---|---|---|---|
| 1 | Obtenir un numéro **D-U-N-S** pour la société (gratuit, via Apple) | 0 | 1 à 3 semaines |
| 2 | Ouvrir un compte **Apple Developer** au nom de la société | 99 $/an | 2 à 5 jours après le D-U-N-S |
| 3 | Ouvrir un compte **Google Play Console** « organisation » (dispense du test fermé de 14 jours imposé aux comptes personnels) | 25 $ une fois | 2 à 7 jours (vérification d'identité) |
| 4 | Créer un compte **Expo** (organisation) et inviter l'équipe | Gratuit pour commencer | Immédiat |
| 5 | Acheter le nom de domaine et mettre en ligne l'API (préproduction, puis production) | — | Lot hébergement |
| 6 | Pousser le code sur GitHub (`git remote add origin …`) | — | Immédiat |

## 15.7 Construire et publier (développeur)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                            # crée le projet EAS et ajoute extra.eas.projectId à app.json
npx eas-cli@latest credentials                     # clés de signature Android et certificats iOS (gérés par EAS)

# 1. Build d'essai, à installer sur de vrais téléphones (Android d'entrée de gamme + iPhone)
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios   # appareils enregistrés, distribution interne

# 2. Builds de production, puis envoi vers les stores
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform android   # piste « test interne » (eas.json)
npx eas-cli@latest submit --profile production --platform ios       # TestFlight
```

**Régénérer les visuels** après un changement de logo ou d'écran :

```bash
node store/generer-visuels.cjs                             # icônes, splash, bannière (Playwright + ffmpeg)
TOKEN=<jeton démo> TONTINE_ID=<id> node store/captures.cjs # captures, app web sur le port 8081
node store/cadrer.cjs                                      # accroches et mise en forme
```

## 15.8 Liste de contrôle avant envoi

- [ ] API de production en ligne (HTTPS), `NODE_ENV=production`, `CORS_ORIGINS`, CinetPay en clés `sk_live_`, SMS Orange et Twilio configurés
- [ ] Builds `preview` essayés sur au moins 2 Android d'entrée de gamme et 1 iPhone : connexion, PIN, dépôt réel de 100 F, retrait, photo KYC, suppression du compte
- [ ] Captures relues : aucune donnée réelle de client
- [ ] Fiches remplies (15.3), formulaires de données (15.4), compte de revue actif (15.5)
- [ ] Mentions crédit (TAEG, durées) identiques dans la fiche, dans l'app et dans les CGU
- [ ] Licence du SFD et convention BCEAO prêtes pour la déclaration Google
- [ ] Test d'intrusion externe passé sans faille critique ou élevée ouverte (docs/14, B.8)
- [ ] Publication Google : test interne → test fermé (50 membres de la bêta) → production progressive (10 %, puis 50 %, puis 100 %)
- [ ] Publication Apple : TestFlight (bêta) → revue → mise en ligne manuelle
