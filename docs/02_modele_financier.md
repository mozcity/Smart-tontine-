# 2. Modèle financier et validation de la rentabilité

Classeur : **`finance/SmartTontine_modeles_economiques.xlsx`**, généré par `finance/build_business_models.py`. Il contient environ 1 200 formules, zéro valeur codée en dur. Modifiez une cellule bleue de l'onglet *Hypothèses* : le déploiement, les 7 comptes de résultat et le verdict se recalculent.

| Onglet | Contenu |
|---|---|
| **Comparatif** | Les 7 modèles face aux critères de rentabilité, verdict strict et verdict investisseur |
| **Hypothèses** | Pays et calendrier, courbe d'adoption, coûts, prix, matrice des 7 modèles (sources et statut en commentaire ; en jaune, ce qui reste à valider) |
| **Déploiement** | Membres actifs et cotisations, pays par pays |
| **Modèles** | Compte de résultat 2027-2031 de chaque modèle : revenus, coûts variables, coûts fixes, EBITDA, trésorerie |
| **Sensibilité G** | EBITDA 2031 du modèle G selon l'adoption et le coût Mobile Money |

## 2.1 Hypothèses de marché

| Pays | Lancement | Adultes 15+ | Coefficient de marché | Cotisation mensuelle moyenne |
|---|---|---:|---:|---:|
| **Burkina Faso** | **2027** | 12,9 M | 1,0 | 12 500 F |
| Côte d'Ivoire | 2029 | 18,0 M | 0,7 | 20 000 F |
| Mali | 2030 | 12,0 M | 0,7 | 12 500 F |
| Niger | 2031 | 12,5 M | 0,6 | 10 000 F |
| Sénégal | 2031 | 10,5 M | 0,5 (concurrence) | 20 000 F |
| Bénin / Togo | 2032 | 13,0 M | 0,7 | 15 000 F |

Règle d'expansion, dite « profondeur avant largeur » : **Burkina seul pendant 2 ans**, puis un pays par an. Un calendrier plus rapide (6 pays en 5 ans) a été testé : chaque pays coûte environ 57 M F par an avant d'être rentable, ce qui ruine tous les modèles.

Adoption (part des adultes devenus membres actifs, selon l'ancienneté du pays) : 0,06 % → 0,23 % → 0,55 % → 0,9 % → 1,3 %. Au Burkina, cela donne ≈ 168 000 membres actifs en 5 ans ; à titre de repère, Maman Tontine revendique plus de 30 000 utilisateurs au Sénégal.

## 2.2 Modèle G : compte de résultat

| M FCFA (sauf membres) | 2027 | 2028 | 2029 | 2030 | 2031 |
|---|---:|---:|---:|---:|---:|
| Membres actifs grand public | 7 740 | 29 670 | 78 510 | 150 120 | 263 970 |
| Membres SFD gérés (B2B) | 5 000 | 30 000 | 80 000 | 150 000 | 250 000 |
| Pots de tontine versés | 1 161 | 4 450 | 12 457 | 25 126 | 45 981 |
| **Chiffre d'affaires** | **32** | **131** | **356** | **692** | **1 217** |
| Marge sur coûts variables | 10 | 55 | 170 | 369 | 678 |
| Coûts fixes | 152 | 187 | 278 | 354 | 487 |
| **EBITDA** | **(142)** | **(132)** | **(108)** | **15** | **191** |
| Trésorerie cumulée | (187) | (319) | (427) | (416) | (277) |

- **EBITDA positif en 2030** (année 4), avec une marge de 15,7 % en 2031.
- **Besoin de financement : 427 M F.** Levée recommandée avec 30 % de marge : **≈ 555 M F (≈ 0,85 M€)** :
  - **pré-amorçage 2027 : 150 à 200 M F** (subventions et concours, love money, business angels). Il finance le pilote de Ouagadougou et la signature du premier SFD ;
  - **amorçage 2028 : 350 à 400 M F** (fonds d'amorçage ouest-africains, investisseurs d'impact en inclusion financière). Il finance la montée en charge au Burkina et l'ouverture de la Côte d'Ivoire.
- **Marge par membre et par an** (hors acquisition) : ≈ 1 600 F, pour un coût d'acquisition d'environ 1 000 F. Chaque membre rembourse son acquisition en moins d'un an.

## 2.3 Pourquoi les autres modèles échouent (détail au chapitre 1.2)

| | A | B | C | D | E | F | **G** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Chiffre d'affaires 2031 (M F) | 523 | 799 | 275 | 848 | 242 | 1 096 | **1 217** |
| EBITDA 2031 (M F) | −582 | −306 | −439 | −315 | −143 | −101 | **+191** |
| Besoin de financement (M F) | 1 737 | 1 168 | 1 403 | 1 231 | 770 | 874 | **427** |
| Marge par membre (F/an) | 90 | 1 135 | 716 | 1 216 | 835 | 1 420 | **1 599** |

## 2.4 Ce qui rend G rentable

| Scénario (EBITDA 2031) | M F |
|---|---:|
| G complet | **191** |
| sans la réduction des frais Mobile Money | 26 |
| avec le canal SFD à 50 % au lieu de 100 % | 102 |
| sans siège resserré | 154 |

**Le levier décisif est le coût Mobile Money.** Sans prélèvement sur le compte SFD ni tarifs négociés, le modèle ne dégage que 26 M F en 2031 et n'atteint l'équilibre qu'en 2031.

## 2.5 Tests de résistance du modèle G

| Scénario dégradé | EBITDA 2031 | 1er EBITDA positif | Besoin | Verdict investisseur |
|---|---:|---|---:|---|
| Central | 191 M | 2030 | 427 M | ✔ |
| Adoption −25 % | 66 M | 2031 | 520 M | ✘ |
| Frais Mobile Money réduits de 20 % seulement | 108 M | 2031 | 500 M | ✘ |
| Cotisations moyennes −20 % | 94 M | 2031 | 504 M | ✘ |
| Licence SFD à 50 F au lieu de 75 F | 116 M | 2031 | 491 M | ✘ |
| Pertes sur crédit 6 % au lieu de 3 % | 163 M | 2030 | 434 M | ✘ (marge < 15 %) |
| Coût d'acquisition 1 500 F | 134 M | 2031 | 487 M | ✘ |
| Potentiel SFD −40 % | 120 M | 2031 | 480 M | ✘ |
| Adoption −25 % **et** frais Mobile Money −20 % seulement | 4 M | 2031 | 586 M | ✘ |
| *Hausse : commission 1,5 %* | *421 M* | *2030* | *337 M* | *✔* |

**Lecture.** Dans chaque scénario dégradé, le modèle G reste **rentable en 2031** et le besoin de financement reste **sous 600 M F**. Le risque porte sur le calendrier (un an de retard), pas sur la viabilité. Seul le cumul de deux mauvaises nouvelles ramène l'entreprise à l'équilibre tout juste. D'où l'importance de sécuriser **le SFD partenaire et les tarifs opérateurs avant la levée d'amorçage**.

## 2.6 Hypothèses à valider en priorité (pilote de 6 mois à Ouagadougou)

| Hypothèse | Valeur du modèle | Comment la valider |
|---|---|---|
| Licence SFD et prélèvement sur compte d'épargne | 75 F/membre/mois | Lettre d'intention puis convention avec 1 SFD (RCPB, Crédit Mutuel du Burkina Faso, Baobab… ; liste officielle des SFD agréés publiée par la Commission bancaire de l'UMOA) |
| Frais Mobile Money | −40 % par rapport à 1 % + 0,5 % | Devis Orange Money, Moov Money, Wave, agrégateurs locaux |
| Cotisation mensuelle moyenne | 12 500 F | 30 tontines pilotes (marchés, bureaux, groupements) |
| Adoption et coût d'acquisition | 0,06 % des adultes la 1re année ; 1 000 F | Organisateurs Pro et parrainage : mesure du coût par canal |
| Conversion Organisateur Pro | 15 % des groupes | Offre testée sur les 30 tontines pilotes |
| Pertes sur crédit | 3 % | 100 premières avances sur tontine (risque faible), puis microcrédits |
