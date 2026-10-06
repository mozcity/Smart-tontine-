# Smart Tontine — « La tontine en ligne sûre, adossée à la microfinance »

**Smart Tontine** numérise la tontine : on cotise par Orange Money, Moov Money ou Wave, et on reçoit le pot à son tour. Il n'y a plus de trésorier qui garde la caisse, et une caution protège le groupe. La régularité des cotisations devient un **score de crédit**, qui ouvre l'**avance sur tontine** et le **microcrédit** accordés par des **SFD partenaires**. Ces SFD utilisent aussi la plateforme en marque blanche pour numériser leurs propres groupes.

**Lancement : Burkina Faso (2027)**, puis Côte d'Ivoire (2029), Mali (2030), Niger et Sénégal (2031), Bénin et Togo.

Références : **Maman Tontine** (expérience tontine au Sénégal) et **MaTontine** (tontine → crédit via une IMF), voir [docs/00](docs/00_benchmark_senegal.md).

## Contenu

| Dossier | Ce qu'il contient |
|---|---|
| [`docs/`](docs/) | Dossier stratégique : comparatif Sénégal + 7 chapitres |
| [`finance/`](finance/) | `SmartTontine_modeles_economiques.xlsx` : 7 modèles économiques chiffrés et validés (Burkina puis UEMOA), tests de résistance, et son générateur |
| [`backend/`](backend/) | API Node.js/TypeScript + PostgreSQL : moteur de tontine, scoring et crédit, coffres de groupe, rappels automatiques, Organisateur Pro, tontines de biens, espaces partenaires, grand livre en partie double, API publique du site, back-office CRM web, **CinetPay API v1 (dépôts et retraits)**, **SMS Orange / Twilio**, 83 tests de bout en bout |
| [`web/`](web/) | **Plateforme web** React : site public (vitrine, tarifs, tontines publiques, catalogue, vitrines partenaires, « Devenir partenaire »), espace membre, **portail partenaire** |
| [`mobile/`](mobile/) | Application Expo / React Native (Android, iOS) reprenant l'interface de l'affiche, profils de build EAS, **visuels et captures des stores** (`mobile/store/`) |

## Dossier stratégique

0. [Références : Maman Tontine et MaTontine (Sénégal)](docs/00_benchmark_senegal.md) — comparatif, ce qu'on reprend, différenciation, Burkina vs Sénégal
1. [Modèle économique](docs/01_modele_economique.md) — **7 modèles testés, le modèle retenu (G) et pourquoi il est rentable**, grille tarifaire, revenus
2. [Modèle financier](docs/02_modele_financier.md) — déploiement pays par pays, compte de résultat, leviers, tests de résistance, levée
3. [Système marketing](docs/03_marketing.md) — positionnement, entonnoir, canaux, plan de lancement 90 jours, calendrier, automatisations
4. [Gestion des clients (CRM)](docs/04_gestion_clients_crm.md) — vue 360°, segmentation, cycle de vie, support, KYC
5. [Plateforme informatique et app](docs/05_plateforme_informatique.md) — architecture, grand livre, flux d'argent, API, sécurité, hébergement
6. [Conformité et risques](docs/06_conformite_risques.md) — montage avec un établissement agréé BCEAO, obligations, registre des risques
7. [Organisation et feuille de route](docs/07_feuille_de_route.md) — équipe, trimestres, facteurs clés de succès, 10 prochaines actions
8. [Tontines de biens et espaces partenaires](docs/08_biens_et_partenaires.md) — biens en individuel / groupe privé / groupe public, séquestre, partenaires à leur logo, revenus
9. [**Cahier des charges**](docs/09_cahier_des_charges.md) — objectifs, acteurs et droits, exigences fonctionnelles et non fonctionnelles, livrables, lots, critères de recette
10. [**Architecture technique**](docs/10_architecture_technique.md) — composants, plateforme web, sécurité, environnements, Docker, intégration continue, EAS, exploitation
11. [**Design UX/UI**](docs/11_design_ux_ui.md) — principes, identité visuelle, navigation, composants, parcours clés, captures web et app
12. [**Point d'avancement**](docs/12_point_avancement.md) — ce qui est livré, ce qui reste avant l'ouverture au public, chemin critique
13. [**Lot 4 : intégrations réelles**](docs/13_lot4_integrations_reelles.md) — CinetPay API v1 (dépôts, retraits asynchrones), SMS Orange / Twilio, mise en service
14. [**Test d'intrusion**](docs/14_test_intrusion.md) — rapport interne (13 constats corrigés) et cahier des charges du test externe
15. [**Publication sur les stores**](docs/15_publication_stores.md) — fiches, formulaires de données, compte de revue, builds EAS, liste de contrôle
16. [**Corrections de l'audit du 05/10/2026**](docs/16_corrections_audit.md) — bloquants levés (OTP, `/simulate`, force brute), sessions courtes, PIN, confidentialité, SEO

**Vidéo de présentation** : [`motion/smart-tontine-presentation.mp4`](motion/smart-tontine-presentation.mp4) (65 s, motion design, musique originale) — sources dans [`motion/`](motion/).

## Chiffres clés (modèle G retenu, modifiable dans l'Excel)

- **7 modèles économiques testés, 1 seul rentable** : le modèle **G, « B2B2C adossé aux SFD »**. Il combine la commission de 1 % sur les pots, 1 % sur les retraits, les abonnements Organisateur Pro (2 000 F/mois) et Smart Tontine+ (500 F/mois), les licences SFD (75 F/membre/mois) et la part des intérêts de crédit.
- **Chiffre d'affaires** : 356 M F en 2029, **1,2 Md F en 2031** ; **EBITDA positif en 2030**, marge de 15,7 % en 2031.
- **Besoin de financement : 427 M F** ; levée recommandée ≈ 555 M F (≈ 0,85 M€) en deux tours.
- **Le modèle résiste** : il reste rentable en 2031 dans chacun des 8 scénarios dégradés testés. Les conditions à sécuriser sont un SFD partenaire et des frais Mobile Money réduits de 40 %.

## Fonctionnalités livrées

| Fonction | App mobile | Web | API | Back-office |
|---|---|---|---|---|
| **Tontine rotative** : création, invitation par code, caution, tirage au sort, cotisation, versement automatique du pot, pénalité de retard, clôture des tours échus par les cautions | ✅ | ✅ | ✅ | ✅ |
| **Tontines de biens matériels** : individuel (plan d'achat), groupe privé ou public ; catalogue des commerçants ; paiement au séquestre libéré à la réception | ✅ | ✅ | ✅ | — |
| **Espaces partenaires** à leur logo et leurs couleurs : plusieurs tontines et coffres, équipe, tableau de bord, frais de gestion, catalogue, licence mensuelle | ✅ | ✅ portail | ✅ | ✅ validation |
| **Découvrir** : tontines publiques d'argent et de biens | ✅ | ✅ | ✅ | — |
| **Score Smart Tontine** (0-1000, facteurs expliqués) | ✅ | ✅ | ✅ | ✅ |
| **Avance sur tontine** (≤ 50 % du futur pot, remboursée sur le pot) | ✅ | ✅ | ✅ | ✅ |
| **Microcrédit** (score ≥ 550, échéancier, prélèvement auto, pénalités, défaut, PAR30) | ✅ | ✅ | ✅ | ✅ |
| Connexion par OTP SMS, code PIN | ✅ | ✅ | ✅ | ✅ |
| Portefeuille « Mon jeton » : dépôt, retrait, transfert, historique | ✅ | ✅ | ✅ | rapprochement |
| E-caisse (épargne bloquée, déblocage auto, rupture à 2 %) | ✅ | — | ✅ | ✅ |
| **Coffres de groupe** (associations, dahiras, familles, GIE…) : suivi des cotisations payé / partiel / impayé, double validation des retraits | ✅ | ✅ | ✅ | ✅ |
| **Invitation** par QR code, WhatsApp, lien ou code | ✅ | ✅ | ✅ | — |
| **Rappels automatiques** J-1 / J0 (cotisations et échéances) | ✅ | — | ✅ | — |
| Budget (plafonds, alertes) | ✅ | — | ✅ | — |
| Projets (objectif, étapes, progression) | ✅ | — | ✅ | ✅ |
| Challenges (défis, points, classement, récompenses) | ✅ | — | ✅ | ✅ |
| Contrats (prêts entre proches signés, échéancier) | ✅ | — | ✅ | ✅ |
| **Organisateur Pro** (plus de 2 groupes gérés, export CSV) · Smart Tontine+ · parrainage · notifications · support | ✅ | ✅ | ✅ | ✅ |
| KPI, segments, fiche client 360, notes, tickets, campagnes, contrôle du grand livre | — | — | ✅ | ✅ |
| **Site public** : vitrine, tarifs en direct, tontines publiques et catalogue sans compte, vitrines partenaires | — | ✅ | ✅ | — |
| **Demandes « Devenir partenaire / SFD »** | — | ✅ | ✅ | ✅ suivi |
| **Portail partenaire** : membres, relevé et export CSV, catalogue, commandes, équipe, marque | relevé | ✅ | ✅ | — |
| **Sécurité** : verrouillage du PIN, plafond mensuel KYC, limitation de débit | ✅ | ✅ | ✅ | — |
| **Vérification d'identité (KYC)** : pièce + selfie, justificatif ; revue et décision motivée | ✅ | ✅ | ✅ | ✅ revue |
| **Double authentification** du back-office (TOTP) | — | — | ✅ | ✅ |
| **Paiements vérifiés** auprès de l'agrégateur avant crédit, rattrapage des webhooks perdus | — | — | ✅ | — |
| **Paiements réels CinetPay v1** : dépôts, retraits asynchrones confirmés ou recrédités | ✅ | ✅ | ✅ | ✅ rapprochement |
| **SMS** Orange (Burkina) + Twilio en secours, accusés de réception | — | — | ✅ | — |
| **Déconnecter mes autres appareils**, **suppression du compte**, politique de confidentialité | ✅ | ✅ | ✅ | — |

## Démarrage rapide

```bash
docker compose up -d db              # ou un PostgreSQL 16 local
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
# API : http://localhost:4000   ·   back-office : http://localhost:4000/admin  (admin de démo : +22670000000)
cd ../web && npm install && npm run dev   # plateforme web : http://localhost:5173
cd ../mobile && npm install && npx expo start
# ou tout en conteneurs : docker compose up -d --build   → http://localhost:8080
```

Détails : [docs/10_architecture_technique.md](docs/10_architecture_technique.md#106-démarrer-la-plateforme-complète-en-local).

## Ce qui reste à faire avant un lancement réel

Le code des paiements réels (CinetPay API v1, dépôts **et** retraits) et des SMS (Orange, Twilio) est prêt et testé contre des serveurs simulés. En développement, `PAYMENT_PROVIDER=mock` et `SMS_PROVIDER=console`. La ligne de crédit du SFD reste un compte comptable (`SYS_CREDIT`).

Avant d'ouvrir au public :
- **conventions** : banque ou EME agréé BCEAO, SFD agréé pour le crédit, contrat de prêt électronique au nom du SFD ;
- **contrats fournisseurs** : compte marchand CinetPay (encaissement et transfert), contrat Orange SMS ;
- **hébergement** de production et stockage objet chiffré des photos KYC ;
- **test d'intrusion externe** ([docs/14](docs/14_test_intrusion.md)) ;
- **comptes Apple et Google** et builds EAS ([docs/15](docs/15_publication_stores.md)) ;
- alertes LBC/FT et validation juridique.

Liste complète : [docs/12](docs/12_point_avancement.md#123-ce-qui-reste-avant-louverture-au-public).
