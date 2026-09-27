# 2. Modèle financier

Le modèle complet est dans **`finance/SMARTFIN_modele_financier.xlsx`** (généré par `finance/build_model.py`). Les 406 cellules calculées sont des formules reliées à l'onglet *Hypothèses* : modifiez une cellule bleue, tout se recalcule.

| Onglet | Contenu |
|---|---|
| Synthèse | Indicateurs clés sur 5 ans, besoin de financement, année d'équilibre |
| Hypothèses | ~55 hypothèses commentées (tontines, microfinance, flux, tarifs, coûts). Les plus sensibles sont en jaune |
| Projections | Clients → tontines et crédits → volumes → revenus → coûts directs (dont coût du risque) → charges → résultat → trésorerie → économie unitaire |
| Investissement | Budget de lancement (62 M F) |
| Sensibilité | EBITDA 2029 selon le coût d'encaissement et les frais de retrait |

## 2.1 Scénario central

| (M FCFA sauf clients) | 2027 | 2028 | 2029 | 2030 | 2031 |
|---|---:|---:|---:|---:|---:|
| Inscrits fin d'année | 25 000 | 90 000 | 220 000 | 400 000 | 650 000 |
| Clients actifs | 4 375 | 23 000 | 69 750 | 148 800 | 262 500 |
| **Membres de tontine actifs** | 1 750 | 11 500 | 38 362 | 89 280 | 157 500 |
| **Pots de tontine versés** | 525 | 3 726 | 13 811 | 34 284 | 66 150 |
| **Crédits versés** (avances + microcrédits) | 14 | 202 | 1 081 | 3 482 | 7 770 |
| **Chiffre d'affaires** | **18** | **128** | **484** | **1 198** | **2 394** |
| Marge brute | (4) | 30 | 191 | 564 | 1 271 |
| **EBITDA** | **(151)** | **(245)** | **(276)** | **(90)** | **407** |
| Trésorerie cumulée (hors levée) | (213) | (458) | (734) | (824) | (519) |

- **Équilibre d'EBITDA : 2031** (quasi atteint en 2030).
- **Besoin de financement : ≈ 824 M FCFA** (creux fin 2030). **Levée recommandée ≈ 1,07 Md FCFA (≈ 1,6 M€)** avec 30 % de marge, en trois tours :
  - *Pré-amorçage* (150-250 M F) : lancement Abidjan, 50 tontines pilotes, premiers crédits ;
  - *Amorçage* (400-600 M F) : Côte d'Ivoire entière, montée en charge du crédit ;
  - *Série A* : expansion UEMOA, éventuellement fonds propres pour un agrément SFD propre.

## 2.2 Le financement du crédit ne pèse pas sur SMARTFIN

Les prêts sont financés par le **SFD partenaire** (ligne de crédit). SMARTFIN ne mobilise que sa garantie de première perte, soit 50 % des pertes, déjà comptée en coût du risque. Ordre de grandeur de l'encours moyen à refinancer par le SFD (estimation hors modèle) : **≈ 0,2 Md F en 2029** et **≈ 1,5 Md F en 2031**. C'est un argument de négociation : le partenaire gagne 60 % des intérêts sur un portefeuille déjà noté.

## 2.3 Économie unitaire (par client actif et par an)

| FCFA | 2027 | 2029 | 2031 |
|---|---:|---:|---:|
| Revenu par actif | 4 192 | 6 940 | 9 120 |
| Coûts directs par actif | 5 015 | 4 207 | 4 279 |
| Marge brute par actif | (823) | 2 733 | 4 841 |
| Coût d'acquisition par actif | 4 286 | 2 667 | 2 000 |
| **LTV / CAC** | < 0 | **3,1x** | **7,3x** |

La tontine améliore nettement l'économie unitaire : un membre de tontine cotise chaque mois, génère une commission à chaque pot et devient éligible au crédit.

## 2.4 Leviers (effet sur l'EBITDA 2029)

| Levier | Variation | Effet |
|---|---|---:|
| Coût d'encaissement opérateurs | 0,8 % → 0,5 % | **+63 M F** |
| Part des actifs en tontine | +10 points | +25 M F |
| Part des intérêts négociée avec le SFD | 40 % → 60 % | +8 M F |
| Pertes sur microcrédit | 3 % → 6 % | −10 M F |
| Conversion SMARTFIN+ | +1 point | +8 M F |

## 2.5 Hypothèses à valider avant la levée

| Hypothèse | Valeur modèle | Comment la valider |
|---|---|---|
| Part des actifs en tontine, cotisation moyenne | 40-60 % ; 25 000 à 35 000 F/mois | Pilote avec 50 tontines réelles |
| Taux d'impayé de tontine | couvert par caution | Suivi « impayés couverts » dans le back-office |
| Part des intérêts SMARTFIN / SFD, garantie de première perte | 40 % ; 50 % des pertes | Term sheet avec 3 SFD |
| Pertes sur microcrédit | 4 % → 3 % | Premiers 200 prêts pilotes (PAR30, défauts) |
| Coût d'encaissement | 1 % → 0,7 % | Devis agrégateurs et opérateurs |
| Rémunération du float | 3 % | Offre écrite de la banque partenaire |
| CAC | 1 500 → 1 000 F | Tests par canal ; les organisateurs de tontine doivent le faire baisser |
