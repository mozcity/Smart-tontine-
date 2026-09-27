# 2. Modèle financier

Le modèle complet est dans **`finance/SMARTFIN_modele_financier.xlsx`** (généré par `finance/build_model.py`). Tous les chiffres sont des formules reliées à l'onglet *Hypothèses* : modifiez une cellule bleue, tout se recalcule.

| Onglet | Contenu |
|---|---|
| Synthèse | Indicateurs clés sur 5 ans, besoin de financement, année d'équilibre |
| Hypothèses | ~40 hypothèses commentées ; les plus sensibles sont surlignées en jaune |
| Projections | Clients → volumes → revenus → coûts directs → charges → résultat → trésorerie → économie unitaire |
| Investissement | Budget de lancement (62 M F) |
| Sensibilité | EBITDA 2029 selon le coût d'encaissement et les frais de retrait |

## 2.1 Scénario central

| (M FCFA) | 2027 | 2028 | 2029 | 2030 | 2031 |
|---|---:|---:|---:|---:|---:|
| Inscrits fin d'année | 25 000 | 90 000 | 220 000 | 400 000 | 650 000 |
| Clients actifs | 4 375 | 23 000 | 69 750 | 148 800 | 262 500 |
| Dépôts annuels | 1 050 | 6 072 | 20 925 | 48 211 | 94 500 |
| Encours moyen clients | 109 | 690 | 2 441 | 5 952 | 11 813 |
| **Chiffre d'affaires** | **13** | **94** | **373** | **939** | **1 937** |
| Marge brute | (9) | 0 | 98 | 365 | 943 |
| **EBITDA** | **(156)** | **(274)** | **(369)** | **(289)** | **79** |
| Trésorerie cumulée (hors levée) | (218) | (492) | (861) | (1 150) | (1 091) |

- **Équilibre d'EBITDA : 2031** (année 5).
- **Besoin de financement : ~1,15 Md FCFA** (creux de trésorerie fin 2030) ; levée recommandée avec 30 % de marge : **~1,5 Md FCFA (≈ 2,3 M€)**, à découper en tours :
  - *Pré-amorçage* (love money, subventions, concours, incubateurs) : 150-250 M F → lancement Abidjan et preuve de traction (12 mois).
  - *Amorçage* (business angels, fonds early-stage Afrique de l'Ouest) : 500-700 M F → Côte d'Ivoire entière + premiers pays.
  - *Série A* (2029-2030) : expansion UEMOA et produits partenaires.

## 2.2 Économie unitaire (par client actif et par an)

| FCFA | 2027 | 2029 | 2031 |
|---|---:|---:|---:|
| Revenu par actif | 2 951 | 5 344 | 7 378 |
| Coûts directs par actif | 4 951 | 3 938 | 3 785 |
| Marge brute par actif | (2 000) | 1 406 | 3 592 |
| Coût d'acquisition par actif | 4 286 | 2 667 | 2 000 |
| **LTV / CAC** | < 0 | 1,6x | **5,4x** |

Lecture : la première année est volontairement déficitaire par client (petits volumes, coûts fixes opérateurs), l'économie unitaire devient saine à partir de 2030 (LTV/CAC > 3).

## 2.3 Leviers les plus puissants (à piloter chaque mois)

1. **Coût d'encaissement** : de 0,8 % à 0,5 % → +63 M F d'EBITDA en 2029 (onglet Sensibilité).
2. **Encours moyen par client** : chaque +5 000 F/actif → +10 M F de float en 2029, et moins de retraits.
3. **Conversion SMARTFIN+** : chaque point de conversion → +8 M F en 2029.
4. **CAC** : le parrainage et les Cagnottes+ (un créateur amène son groupe) doivent faire baisser le CAC sous 1 000 F.
5. **Taux d'activité** : tout le modèle est proportionnel aux actifs, pas aux inscrits.

## 2.4 Hypothèses à valider en priorité (avant la levée)

| Hypothèse | Valeur modèle | Comment la valider |
|---|---|---|
| Coût d'encaissement | 1 % → 0,7 % | Devis CinetPay / PayDunya + rendez-vous Wave Business et Orange Money |
| Rémunération du float | 3 % | Offre écrite de la banque partenaire ; cadre BCEAO |
| Dépôt mensuel par actif | 20 000 → 30 000 F | Pilote de 3 mois avec 500 utilisateurs |
| Taux d'actifs | 35 % → 50 % | Pilote : cohortes mensuelles dans le back-office |
| CAC | 1 500 → 1 000 F | Tests de campagnes à 500 000 F par canal |
