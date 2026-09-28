# 7. Organisation et feuille de route

## 7.1 Équipe

| Phase | Rôles |
|---|---|
| Lancement (2027, 8 ETP à Ouagadougou) | Fondateur/CEO · CTO · 2 développeurs (mobile + back-end) · **responsable crédit & risques** (ex-IMF, relation SFD) · responsable conformité & opérations financières · responsable communauté (organisateurs de tontines) · 1 agent support/recouvrement |
| Croissance (2028, 12 ETP siège + équipe Burkina) | + product manager · data analyst (scoring) · 2 développeurs · 2 conseillers recouvrement/support · responsable partenariats B2B |
| Expansion (2029+) | Un responsable et 2-3 animateurs par pays (Côte d'Ivoire, Mali, Niger, Sénégal…), équipe risque/fraude, équipe partenariats SFD |

Gouvernance : comité mensuel (KPI, grand livre, incidents), **comité de crédit mensuel avec le SFD** (PAR30, politique de score, plafonds), comité conformité trimestriel avec les partenaires agréés.

## 7.2 Feuille de route : Burkina Faso, puis la sous-région

Principe : **profondeur avant largeur**. Un nouveau pays n'ouvre que si le précédent atteint ses objectifs de membres et que la trésorerie le permet (chapitre 2.1).

| Période | Produit & technique | Business |
|---|---|---|
| **T0 — préparation (3 mois, 2027)** | Plateforme de ce dépôt en préproduction · intégration Orange Money, Moov Money, Wave (et Sank Money via un agrégateur) · test d'intrusion · CGU tontine et crédit | Société à Ouagadougou · **lettre d'intention d'un SFD** (licence, comptes d'épargne, crédit) · convention de cantonnement · levée pré-amorçage (150-200 M F) |
| **T1 — pilote Ouagadougou** | Bêta fermée : **30 tontines réelles** (marchés, bureaux, groupements de femmes) + 1 groupe SFD · cotisation depuis le compte SFD | Mesures : cotisation moyenne, cotisations à l'heure, impayés couverts, coût d'acquisition |
| **T2** | Lancement public Ouagadougou · **Organisateur Pro** · avance sur tontine · KYC photo | Convention SFD signée · tarifs opérateurs négociés |
| **T3** | Bobo-Dioulasso · plateforme en marque blanche pour le SFD (espace SFD) · connexion au bureau de crédit | 2ᵉ SFD · premiers microcrédits pilotes (100 prêts) |
| **T4** | Micro-assurance · USSD / SMS pour cotiser sans smartphone · détection des tontines fictives | **Levée d'amorçage (350-400 M F)** |
| **2028** | Tontines d'entreprise · rééchelonnement en ligne · tontine « aux enchères » | ≈ 30 000 membres grand public et 30 000 membres SFD au Burkina |
| **2029** | Multi-pays (Orange Money et Wave Côte d'Ivoire) · tontines transfrontalières Burkina ↔ Côte d'Ivoire | **Ouverture Côte d'Ivoire** (diaspora burkinabè) |
| **2030** | — | **EBITDA positif** · ouverture Mali |
| **2031** | Étude d'agrément SFD / établissement de paiement propre | Ouverture Niger et Sénégal ; Bénin/Togo en 2032 |

## 7.3 Facteurs clés de succès

1. **Un SFD partenaire solide dès le pilote.** Il apporte la licence, les comptes d'épargne (cotisations sans frais Mobile Money), le crédit et ses membres : c'est le cœur du modèle G.
2. **Des frais Mobile Money réduits d'au moins 40 %** : sans cela, le modèle ne devient rentable qu'en 2031.
3. **Zéro tontine qui « casse »** : caution, clôture automatique, reconstitution sur le pot. La confiance est le produit.
4. **Les trésoriers comme moteur de croissance** : Organisateur Pro, badge certifié, chaque trésorier amène 5 à 30 membres.
5. **Un crédit prudent** : l'avance sur tontine d'abord (adossée au pot), le microcrédit ensuite, PAR30 < 5 % ; le secteur SFD burkinabè a vu son résultat baisser de 35 % en 2024.
6. **Une expansion financée par la traction** : un pays à la fois.
7. **Une équipe resserrée à Ouagadougou** (−20 % de coûts siège dans le modèle).

## 7.4 Les 10 prochaines actions

1. Immatriculer la société au Burkina Faso (guichet unique de la Maison de l'Entreprise / CEFORE) ; choisir la forme juridique compatible avec une future levée.
2. Démarcher **5 SFD** (liste officielle de la Commission bancaire de l'UMOA : RCPB, Crédit Mutuel du Burkina Faso, Baobab… ) avec la proposition « numérisation de vos groupes + licence 75 F/membre/mois + 40 % des intérêts » ; obtenir **une lettre d'intention**.
3. Obtenir les grilles tarifaires Orange Money, Moov Money, Wave et des agrégateurs locaux ; mettre à jour l'onglet *Hypothèses*.
4. Déclarer le traitement de données à la **CIL** ; rédiger CGU, politique de confidentialité et politique de crédit avec le SFD.
5. Mettre la plateforme en préproduction et brancher l'agrégateur retenu en mode test.
6. Publier l'app en test interne (EAS Build → Play Console / TestFlight).
7. Recruter **30 trésoriers de tontine** (Rood Woko, Sankaryaaré, bureaux, groupements de femmes) pour le pilote.
8. Faire réaliser le test d'intrusion.
9. Préparer le dossier investisseurs : ce dossier, le classeur `SmartTontine_modeles_economiques.xlsx` (verdict et tests de résistance) et une démonstration de l'app.
10. Lancer le pilote et mettre à jour le modèle avec les chiffres réels après 3 mois : cotisation moyenne, adoption, coût d'acquisition, conversion Pro.
