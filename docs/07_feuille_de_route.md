# 7. Organisation et feuille de route

## 7.1 Équipe

| Phase | Rôles |
|---|---|
| Lancement (A1, 8 ETP) | Fondateur/CEO · CTO · 2 développeurs (mobile + back-end) · **responsable crédit & risques** (ex-IMF, relation SFD) · responsable conformité & opérations financières · responsable communauté (organisateurs de tontines) · 1 agent support/recouvrement |
| Croissance (A2, 14 ETP) | + product manager · data analyst (scoring) · 2 développeurs · 2 conseillers recouvrement/support · responsable partenariats B2B |
| Expansion (A3+, 22-42 ETP) | Country managers (Sénégal, Burkina…), équipe risque/fraude, équipe partenariats financiers |

Gouvernance : comité mensuel (KPI, grand livre, incidents), **comité de crédit mensuel avec le SFD** (PAR30, politique de score, plafonds), comité conformité trimestriel avec les partenaires agréés.

## 7.2 Feuille de route

| Trimestre | Produit & technique | Business |
|---|---|---|
| **T0 (préparation, 3 mois)** | Plateforme de ce dépôt en staging · intégration réelle d'un agrégateur (collecte + payout) · pentest · CGU tontine et crédit | Société · convention banque/EME (cantonnement) · **convention SFD** (part d'intérêts, première perte, politique de crédit) · 50 organisateurs de tontine · levée pré-amorçage |
| **T1** | Bêta fermée : **50 tontines réelles** · rappels J-1 · verrouillage PIN · alertes LBC/FT | Mesure : cotisation moyenne, taux de cotisation à l'heure, impayés couverts |
| **T2** | Lancement public Abidjan · **avance sur tontine** · KYC par photo · SMS/WhatsApp | Plan 90 jours (3.4) · organisateurs certifiés |
| **T3** | **Microcrédit pilote** (200 prêts, commerçantes en priorité) · contrat de prêt électronique au nom du SFD · connexion BIC | Levée d'amorçage · suivi PAR30 hebdomadaire |
| **T4** | Micro-assurance décès des membres · détection des tontines fictives · rééchelonnement en ligne | Couverture Côte d'Ivoire entière |
| **Année 2** | Tontines d'entreprise (cotisation sur salaire) · USSD/SMS pour cotiser sans smartphone (comme MaTontine) · tontine « aux enchères » (le membre qui accepte une décote passe en premier) | **Lancement Sénégal** face à Maman Tontine et MaTontine (dahiras, GIE ; chapitre 0.5), puis Burkina |
| **Année 3** | Multi-pays · crédit plus long (équipement) · étude d'**agrément SFD propre** | Série A |

## 7.3 Facteurs clés de succès

1. **Deux partenaires agréés solides** : une banque/EME pour les fonds, un SFD pour le crédit.
2. **Zéro tontine qui « casse »** : caution, clôture automatique, reconstitution sur le pot. La confiance est le produit.
3. **Un crédit prudent** : petits montants, avance adossée au pot, PAR30 < 5 % tenu dès les 200 premiers prêts.
4. **Les organisateurs de tontine comme moteur de croissance** : chacun amène 5 à 30 membres.
5. **Des coûts opérateurs négociés** sous 0,8 %, qui font la marge du projet.
6. **Mesurer avant de dépenser** — piloter par cohortes et par canal dans le back-office, couper les canaux dont le CAC dépasse 1 500 F.
7. **L'éducation financière** — contenus « Voir clair dans son jeton » : la marque devient la référence de l'épargne des jeunes.

## 7.4 Les 10 prochaines actions

1. Choisir la forme juridique et immatriculer la société (CEPICI, Abidjan).
2. Rencontrer 5 banques/EME (compte de cantonnement) **et 5 SFD/IMF** (ligne de crédit, part d'intérêts, garantie de première perte) ; obtenir des propositions écrites.
3. Obtenir les grilles tarifaires CinetPay, PayDunya, Wave Business, Orange Money ; mettre à jour l'onglet *Hypothèses*.
4. Déclarer le traitement de données à l'ARTCI ; rédiger CGU et politique de confidentialité.
5. Déployer l'API en staging, brancher l'agrégateur retenu en mode test (le connecteur CinetPay est amorcé dans `backend/src/services/payments/cinetpay.ts`).
6. Publier l'app en test interne (EAS Build → Play Console / TestFlight).
7. Recruter 50 organisateurs de tontine (marchés d'Adjamé et Treichville, entreprises, associations) pour la bêta.
8. Faire réaliser le test d'intrusion.
9. Préparer le dossier investisseurs : ce dossier + modèle financier + démo de l'app.
10. Lancer la bêta fermée et mesurer : tontines démarrées, taux de cotisation à l'heure, impayés couverts, puis premières avances.
