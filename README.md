# SMARTFIN — « Gère ton argent sans stress, depuis ton téléphone »

Projet complet de la fintech d'épargne SMARTFIN (Côte d'Ivoire → UEMOA) : stratégie, modèle économique, modèle financier, marketing, CRM, plateforme informatique et application mobile.

## Contenu

| Dossier | Ce qu'il contient |
|---|---|
| [`docs/`](docs/) | Dossier stratégique en 7 chapitres |
| [`finance/`](finance/) | Modèle financier Excel sur 5 ans (formules, hypothèses modifiables, sensibilité) et son générateur |
| [`backend/`](backend/) | API Node.js/TypeScript + PostgreSQL (grand livre en partie double) + back-office CRM web + 18 tests de bout en bout |
| [`mobile/`](mobile/) | Application Expo / React Native (Android, iOS, web) reprenant l'interface de l'affiche |

## Dossier stratégique

1. [Modèle économique](docs/01_modele_economique.md) — proposition de valeur, segments, Business Model Canvas, grille tarifaire, moteurs de revenus
2. [Modèle financier](docs/02_modele_financier.md) — projections 2027-2031, besoin de financement, économie unitaire, leviers
3. [Système marketing](docs/03_marketing.md) — positionnement, entonnoir, canaux, plan de lancement 90 jours, calendrier, automatisations
4. [Gestion des clients (CRM)](docs/04_gestion_clients_crm.md) — vue 360°, segmentation, cycle de vie, support, KYC
5. [Plateforme informatique et app](docs/05_plateforme_informatique.md) — architecture, grand livre, flux d'argent, API, sécurité, hébergement
6. [Conformité et risques](docs/06_conformite_risques.md) — montage avec un établissement agréé BCEAO, obligations, registre des risques
7. [Organisation et feuille de route](docs/07_feuille_de_route.md) — équipe, trimestres, facteurs clés de succès, 10 prochaines actions

## Chiffres clés (scénario central, modifiable dans l'Excel)

- 650 000 inscrits et 262 500 actifs en 2031 ; 1,9 Md FCFA de chiffre d'affaires en 2031
- EBITDA positif en **2031** ; besoin de financement **≈ 1,15 Md FCFA** (levée recommandée ≈ 1,5 Md FCFA)
- Hypothèse la plus sensible : le **coût d'encaissement** payé aux opérateurs Mobile Money

## Fonctionnalités livrées

| Fonction | App mobile | API | Back-office |
|---|---|---|---|
| Connexion par OTP SMS, code PIN | ✅ | ✅ | ✅ |
| Portefeuille « Mon jeton » : dépôt, retrait, transfert, historique | ✅ | ✅ | rapprochement |
| E-caisse (épargne bloquée, déblocage auto, rupture à 2 %) | ✅ | ✅ | ✅ |
| Cagnotte+ (tontine, double validation des retraits) | ✅ | ✅ | ✅ |
| Budget (plafonds, alertes) | ✅ | ✅ | — |
| Projets (objectif, étapes, progression) | ✅ | ✅ | ✅ |
| Challenges (défis, points, classement, récompenses) | ✅ | ✅ | ✅ |
| Contrats (prêts entre proches signés, échéancier) | ✅ | ✅ | ✅ |
| SMARTFIN+, parrainage, notifications, News & Tuto, support | ✅ | ✅ | ✅ |
| KPI, segments, fiche client 360, notes, tickets, campagnes, contrôle du grand livre | — | ✅ | ✅ |

## Démarrage rapide

```bash
docker compose up -d db              # ou un PostgreSQL 16 local
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
# API : http://localhost:4000   ·   back-office : http://localhost:4000/admin  (admin : +2250748553268)
cd ../mobile && npm install && npx expo start
```

Détails : [docs/05_plateforme_informatique.md](docs/05_plateforme_informatique.md#57-démarrer-en-local).

## Ce qui reste à faire avant un lancement réel

Les paiements sont **simulés** (`PAYMENT_PROVIDER=mock`) et les SMS s'affichent dans la console. Avant d'ouvrir au public : partenaire agréé BCEAO, intégration réelle de l'agrégateur (collecte **et** payout) avec vérification serveur-à-serveur, fournisseur SMS, test d'intrusion, plafond mensuel KYC, verrouillage du PIN, alertes LBC/FT, et validation juridique. Liste complète : chapitres 5.5, 6 et 7.4.
