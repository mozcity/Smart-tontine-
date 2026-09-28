# 1. Modèle économique de Smart Tontine

> **Smart Tontine** : la tontine en ligne sûre, adossée aux institutions de microfinance.
> Lancement au **Burkina Faso** (2027), puis Côte d'Ivoire, Mali, Niger, Sénégal, Bénin et Togo.

Ce chapitre présente le modèle retenu **et la façon dont il a été validé** : 7 modèles économiques ont été chiffrés sur les mêmes marchés et avec les mêmes coûts. Un seul passe les critères de rentabilité fixés à l'avance. Chiffres complets : `finance/SmartTontine_modeles_economiques.xlsx` et [chapitre 2](02_modele_financier.md).

## 1.1 Proposition de valeur

| Pour qui | Problème | Ce que Smart Tontine apporte |
|---|---|---|
| **Membres de tontine** (commerçantes, salariés, jeunes) | Trésorier qui disparaît, impayés, litiges, collecte en espèces | Cotisation Orange Money / Moov / Wave en un clic, suivi en temps réel, **caution qui couvre les impayés**, tirage au sort vérifiable, pot versé automatiquement |
| **Trésoriers** (tontines, associations, GIE, groupements de femmes) | Cahiers, relances, soupçons | Tableau des cotisations payé / partiel / impayé, rappels automatiques, retraits à double validation, exports (**Organisateur Pro**) |
| **SFD / institutions de microfinance** | Collecte coûteuse sur le terrain, peu de petite épargne, pas d'historique pour prêter | **Plateforme en marque blanche** pour numériser leurs groupes, **score de crédit** fondé sur la régularité des cotisations, clients apportés par l'application |
| **Membres qui ont besoin d'argent** | Refus des banques, attente de son tour | **Avance sur tontine** (remboursée sur le pot) puis **microcrédit** accordé par le SFD partenaire |

## 1.2 Les 7 modèles testés et le verdict

Critères fixés **avant** le calcul :
- EBITDA 2031 positif avec une marge d'au moins 15 % ;
- besoin de financement ≤ 600 M F ;
- marge positive sur chaque membre ;
- EBITDA positif en 2029 au plus tard pour le verdict strict, en 2030 pour le verdict investisseur.

| Modèle | Principe | EBITDA 2031 | 1er EBITDA positif | Besoin de financement | Verdict |
|---|---|---:|---|---:|---|
| **A — Commission seule** (clone de Maman Tontine) | 1 % sur les pots, retrait gratuit | −582 M | jamais | 1 737 M | ✘ |
| **B — Transactionnel** | 1 % pot + 1 % retrait + float | −306 M | jamais | 1 168 M | ✘ |
| **C — Freemium** | gratuit, abonnements seulement | −439 M | jamais | 1 403 M | ✘ |
| **D — Tontine + microfinance** | B + crédit + assurance | −315 M | jamais | 1 231 M | ✘ |
| **E — B2B pour les SFD** | licence en marque blanche seule | −143 M | jamais | 770 M | ✘ |
| **F — Hybride** | D + abonnements + B2B partiel | −101 M | jamais | 874 M | ✘ |
| **G — Hybride optimisé** ✅ | F + 3 leviers structurels | **+191 M (15,7 %)** | **2030** | **427 M** | **✔ investisseur** / ✘ strict |

**Pourquoi A, B, C et D échouent au Burkina** : une cotisation moyenne d'environ 12 500 F par mois rapporte seulement 3 000 à 3 500 F par membre et par an. Sur ce montant, les frais Mobile Money en absorbent près de la moitié. Il faudrait alors plus de 150 000 membres rien que pour payer l'équipe et les pays ouverts. **Une application de tontine grand public seule n'est pas rentable dans un marché à petits tickets.** Le modèle A, qui copie Maman Tontine, perd même de l'argent sur chaque membre.

**Pourquoi E échoue seul** : les SFD ne peuvent pas payer cher. Au Burkina, le secteur a dégagé environ 3 Mds F de résultat pour 1,47 M de comptes en 2024 (BCEAO). La licence est donc plafonnée à environ 75 F par membre et par mois, ce qui ne couvre pas les coûts sans le canal grand public.

**Pourquoi G fonctionne** : il additionne les deux canaux et s'appuie sur les SFD pour réduire le premier poste de coût.

## 1.3 Le modèle retenu (G) : « B2B2C adossé aux SFD »

```
                  ┌──────────────────────── SFD partenaires ────────────────────────┐
                  │ licence par membre · comptes d'épargne · crédit · agrément       │
                  └───────▲──────────────────────┬───────────────────────▲────────────┘
     membres SFD numérisés│              cotisations prélevées        crédits accordés
     (licence 75 F/mois)  │              sur le compte SFD           (40 % des intérêts
                          │              = pas de frais Mobile Money   pour Smart Tontine)
┌─────────────────────────┴──────────────────────▼───────────────────────┴───────────┐
│                               SMART TONTINE                                      │
│ Tontines · coffres de groupe · caution · rappels · score · avance · assurance    │
└─────────────────────────▲─────────────────────────────────────────▲──────────────┘
      1 % sur chaque pot · 1 % sur les retraits      Organisateur Pro 2 000 F/mois
      vers Mobile Money                              Smart Tontine+ 500 F/mois
                          │                                         │
               Membres grand public                 Trésoriers de tontines, associations, GIE
```

**Les trois leviers qui rendent G rentable** (écart mesuré sur l'EBITDA 2031 en retirant chaque levier du modèle G) :

| Levier | Concrètement | Effet sur l'EBITDA 2031 |
|---|---|---:|
| **1. Frais Mobile Money −40 %** | Cotisations prélevées directement sur le compte d'épargne SFD du membre (la loi burkinabè de 2025 sur la microfinance autorise les SFD à offrir des services de paiement et de monnaie électronique), et tarifs négociés avec Orange Money, Moov et Wave (objectif ≤ 0,7 % en entrée, ≤ 0,3 % en sortie) | **+165 M** |
| **2. Canal SFD exploité à 100 %** | 250 000 membres SFD gérés sur la plateforme en 2031, facturés 75 F/mois | **+89 M** |
| **3. Siège resserré à Ouagadougou** | Équipe siège réduite de 20 %, technologie mutualisée, fonctions support partagées avec le SFD | **+37 M** |

Levier testé puis écarté : garder l'argent dans l'application (« recirculation »). L'effet est **neutre** sur la marge, car les frais de retrait compensent les frais opérateurs évités. Il reste utile pour fidéliser, pas pour la rentabilité.

## 1.4 Grille tarifaire (codée dans `backend/src/pricing.ts`)

| Opération | Prix | Qui paie |
|---|---|---|
| Inscription, dépôt, cotisation, épargne, budget, rappels | **Gratuit** | — |
| **Pot de tontine versé** | **1 %** du pot (aligné sur le marché) | bénéficiaire du tour |
| **Retrait vers Mobile Money** | **1 %** (min. 100 F, max. 5 000 F) ; 3 retraits offerts par mois avec Smart Tontine+ | membre |
| Cotisation en retard | 5 %, **reversés au bénéficiaire** du tour | retardataire |
| Retrait d'un coffre de groupe | 1 % | bénéficiaire |
| **Organisateur Pro** | **2 000 F/mois** : plus de 2 groupes gérés, export CSV des cotisations | trésorier |
| **Smart Tontine+** | **500 F/mois** : 3 retraits offerts par mois (dont le pot), support prioritaire | membre |
| **Licence SFD** | **75 F par membre géré et par mois** + 1 % de frais d'apport sur les crédits accordés via la plateforme | SFD |
| Avance sur tontine / microcrédit | 1,5 %/mois (18 %/an, sous le taux d'usure) ; **40 % des intérêts** pour Smart Tontine, 60 % pour le SFD | emprunteur |
| Micro-assurance (décès, santé) | commission de distribution de 20 % | assureur |
| **Licence partenaire** (associations, commerçants, entreprises, tontiniers) | 75 F par membre actif et par mois, minimum 10 000 F/mois ; le partenaire peut prendre 0 à 3 % de frais de gestion sur ses pots | partenaire |
| **Commission fournisseur** (tontines et plans d'achat de biens) | 3 % du prix, payée à la réception | commerçant partenaire |

## 1.5 D'où vient le chiffre d'affaires (modèle G, 2031 : 1 217 M F)

| Source | M F | Part |
|---|---:|---:|
| Commission sur les pots | 460 | 38 % |
| Frais de retrait | 276 | 23 % |
| Licences SFD | 225 | 18 % |
| Abonnements Organisateur Pro | 79 | 6 % |
| Float | 63 | 5 % |
| Crédit (part des intérêts + frais d'apport) | 51 | 4 % |
| Abonnements Smart Tontine+ | 48 | 4 % |
| Assurance | 16 | 1 % |

Environ 30 % du chiffre d'affaires est **récurrent et prévisible** (licences et abonnements), ce qui rassure les investisseurs et amortit les variations des volumes de tontine.

## 1.6 Segments au Burkina Faso

1. **Tontines de marché et groupements de femmes** (Ouagadougou : Rood Woko, Sankaryaaré ; Bobo-Dioulasso) : cœur de cible, tontines hebdomadaires.
2. **Membres des SFD partenaires** : 1,47 M de comptes SFD au Burkina en 2024 ; canal B2B.
3. **Associations, GIE, groupements villageois, églises et mosquées** : coffres de groupe et Organisateur Pro.
4. **Salariés et fonctionnaires** : tontines de bureau mensuelles, tickets plus élevés.
5. **Diaspora burkinabè en Côte d'Ivoire** : pont vers le deuxième pays (tontines transfrontalières).

## 1.7 Business Model Canvas (modèle G)

| Bloc | Contenu |
|---|---|
| **Partenaires clés** | 2 à 3 **SFD** (licence, comptes d'épargne, crédit, et paiement/e-monnaie si agréés) · banque ou EME pour le cantonnement · Orange Money, Moov Money, Wave, Sank Money (via un agrégateur local) · assureur · bureau d'information sur le crédit |
| **Activités clés** | Animation des tontines · intégration et formation des SFD · scoring · rapprochement quotidien · conformité |
| **Ressources clés** | Plateforme (ce dépôt) · données de cotisation · réseau d'organisateurs et de trésoriers · relations SFD |
| **Proposition de valeur** | Tontine sûre et sans espèces · crédit sans garantie matérielle · numérisation clé en main pour les SFD |
| **Relation client** | Organisateurs de tontine, animateurs terrain, WhatsApp, rappels automatiques |
| **Canaux** | SFD partenaires (B2B) · organisateurs Pro · parrainage · radio et réseaux sociaux · marchés |
| **Coûts** | Frais Mobile Money · équipe siège et pays · acquisition · SMS/cloud · garantie de première perte |
| **Revenus** | Commission 1 % · retraits 1 % · licences SFD · Pro et Plus · part des intérêts · float · assurance |

## 1.8 Ce qu'il faut prouver avant de lever

Le modèle G n'est rentable que si ces conditions sont vérifiées sur le terrain (tests de résistance au [chapitre 2](02_modele_financier.md)) :
1. **Un SFD signe** une licence d'au moins 50 à 75 F par membre et par mois et accepte le prélèvement des cotisations sur les comptes d'épargne.
2. **Les frais opérateurs** négociés baissent d'au moins 40 % par rapport à 1 % + 0,5 %.
3. **L'adoption** au Burkina atteint environ 1 % des adultes en 4 ans (≈ 116 000 membres actifs en 2030).
4. **Les pertes sur crédit** restent sous 3 %. Prudence : le résultat des SFD burkinabè a baissé de 34,8 % en 2024.

**Option de hausse** : une commission de **1,5 %** au lieu de 1 %, justifiée par la caution et le versement garanti, porterait l'EBITDA 2031 à +421 M F. Elle se teste au pilote, marché par marché, car Maman Tontine affiche 1 % au Sénégal.
