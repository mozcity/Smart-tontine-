# 7. Organisation et feuille de route

## 7.1 Équipe

| Phase | Rôles |
|---|---|
| Lancement (A1, 8 ETP) | Fondateur/CEO · CTO · 2 développeurs (mobile + back-end) · responsable conformité & opérations financières · responsable marketing & communauté · 2 agents support/ambassadeurs |
| Croissance (A2, 14 ETP) | + product manager · data analyst · 2 développeurs · 2 support · responsable partenariats B2B |
| Expansion (A3+, 22-42 ETP) | Country managers (Sénégal, Burkina…), équipe risque/fraude, équipe partenariats financiers |

Gouvernance : comité mensuel (KPI, grand livre, incidents), comité conformité trimestriel avec le partenaire agréé.

## 7.2 Feuille de route

| Trimestre | Produit & technique | Business |
|---|---|---|
| **T0 (préparation, 3 mois)** | Plateforme de ce dépôt en staging · intégration réelle d'un agrégateur (collecte + payout) · pentest · CGU | Constitution société · signature partenaire agréé · contrats opérateurs · recrutement ambassadeurs · levée pré-amorçage |
| **T1** | Bêta fermée (500 utilisateurs, 10 tontines pilotes) · notifications push · verrouillage PIN · alertes LBC/FT | Mesure des vraies hypothèses (dépôt moyen, activation, CAC) |
| **T2** | Lancement public Abidjan (Play Store + App Store) · KYC par photo · SMS/WhatsApp de campagne | Plan 90 jours (voir 3.4) · premiers partenariats entreprises |
| **T3** | SMARTFIN+ · épargne programmée (prélèvement automatique chaque semaine/mois) · rappels d'échéances de contrats | Levée d'amorçage |
| **T4** | Score de santé financière · offres partenaires (micro-assurance) · export BI | Couverture Côte d'Ivoire entière |
| **Année 2** | Mode hors ligne partiel, USSD pour la consultation de solde · API entreprises (épargne salariale) | Préparation Sénégal / Burkina |
| **Année 3** | Multi-pays (XOF commun, opérateurs par pays) · micro-crédit partenaire adossé à l'historique d'épargne | Série A, étude d'agrément EME |

## 7.3 Facteurs clés de succès

1. **Un partenaire agréé solide** — sans lui, pas de lancement.
2. **Des coûts opérateurs négociés** sous 0,8 % — c'est la marge du projet.
3. **La confiance** — zéro argent perdu : grand livre équilibré, rapprochement quotidien, support qui répond vite sur WhatsApp.
4. **Les Cagnottes+ comme moteur viral** — chaque tontine amène 5 à 30 personnes.
5. **Mesurer avant de dépenser** — piloter par cohortes et par canal dans le back-office, couper les canaux dont le CAC dépasse 1 500 F.
6. **L'éducation financière** — contenus « Voir clair dans son jeton » : la marque devient la référence de l'épargne des jeunes.

## 7.4 Les 10 prochaines actions

1. Choisir la forme juridique et immatriculer la société (CEPICI, Abidjan).
2. Rencontrer 5 banques/EME pour le compte de cantonnement ; obtenir des propositions écrites.
3. Obtenir les grilles tarifaires CinetPay, PayDunya, Wave Business, Orange Money ; mettre à jour l'onglet *Hypothèses*.
4. Déclarer le traitement de données à l'ARTCI ; rédiger CGU et politique de confidentialité.
5. Déployer l'API en staging, brancher l'agrégateur retenu en mode test (le connecteur CinetPay est amorcé dans `backend/src/services/payments/cinetpay.ts`).
6. Publier l'app en test interne (EAS Build → Play Console / TestFlight).
7. Recruter 10 groupes de tontine et 20 ambassadeurs pour la bêta.
8. Faire réaliser le test d'intrusion.
9. Préparer le dossier investisseurs : ce dossier + modèle financier + démo de l'app.
10. Lancer la bêta fermée et mesurer : activation J+14, dépôt moyen, rétention M1.
