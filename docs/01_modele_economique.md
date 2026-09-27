# 1. Modèle économique SMARTFIN

## 1.1 En une phrase

> **SMARTFIN est une tontine en ligne adossée à un modèle de microfinance : on cotise ensemble, on reçoit le pot à son tour, et la discipline de cotisation devient un score de crédit qui ouvre l'accès à l'avance sur tontine et au microcrédit.**

Promesse client : « Gère ton argent sans stress, depuis ton téléphone. »

**Références** (détail au [chapitre 0](00_benchmark_senegal.md)) : SMARTFIN reprend l'expérience de **Maman Tontine** (Sénégal : tontines, coffres de groupe, rappels, invitation QR/WhatsApp, 1 % de frais) et le modèle de microfinance de **MaTontine** (Sénégal : l'historique de tontine ouvre l'accès au crédit d'une IMF partenaire). Sa différence : une tontine *protégée* par caution et le crédit intégré dans la même application.

## 1.2 Pourquoi la tontine, pourquoi en ligne

La tontine (épargne rotative) est l'outil d'épargne le plus utilisé en Afrique de l'Ouest, bien avant les comptes bancaires. Elle repose sur la confiance, et c'est aussi sa faiblesse :

| Problème de la tontine classique | Réponse SMARTFIN |
|---|---|
| Le trésorier peut partir avec la caisse | L'argent est cantonné chez un établissement agréé ; personne ne le détient seul |
| Un membre reçoit le pot puis arrête de cotiser | **Caution** bloquée à l'adhésion, mobilisée automatiquement ; statut « défaillant » visible ; score dégradé |
| Litiges sur qui a payé quoi | Chaque cotisation est tracée au franc près, visible de tous les membres |
| Ordre de passage contesté | **Tirage au sort cryptographique** ou ordre fixé à l'avance par le groupe |
| Déplacements, collecte en espèces | Cotisation en un clic depuis Wave / Orange / MTN / Moov |
| Besoin d'argent avant son tour | **Avance sur tontine** : une partie du futur pot tout de suite |
| Aucune trace pour obtenir un crédit | L'historique de cotisation alimente un **score SMARTFIN** reconnu par le SFD partenaire |

## 1.3 Les deux moteurs et les produits d'accompagnement

```
                 ┌──────────────── MOTEUR 1 : TONTINE EN LIGNE ────────────────┐
  Cotisations →  │ Tontine rotative (hebdo / mensuelle) · caution · tirage au sort│ → Pot versé au bénéficiaire
                 │ Cagnotte+ (caisse commune, double validation)                  │   (commission 1 %)
                 └──────────────────────────────┬────────────────────────────────┘
                                                │ historique de cotisation
                                                ▼
                 ┌──────────────── MOTEUR 2 : MICROFINANCE ────────────────────┐
                 │ Score SMARTFIN 0-1000                                        │
                 │ Avance sur tontine (≤ 50 % du futur pot, remboursée sur le pot)│ → Part des intérêts (40 %)
                 │ Microcrédit (10 000 – 500 000 F, 1 à 6 mois, 18 %/an)         │
                 └──────────────────────────────────────────────────────────────┘
  Coffres de groupe (associations, dahiras, lieux de culte, familles, GIE, ASC) : cotisations suivies mois par mois
  Produits d'accompagnement (rétention et score) : E-caisse (coffre personnel) · Projets · Challenges · Budget · Contrats
```

### Tontine rotative
- Un organisateur fixe la cotisation, la fréquence (hebdomadaire ou mensuelle), le nombre de membres et le mode d'ordre (tirage au sort ou ordre fixé).
- Chaque membre bloque une **caution** (par défaut = une cotisation) en rejoignant ; elle est rendue en fin de cycle.
- À chaque tour, dès que tous les membres ont cotisé, le **pot est versé automatiquement** au bénéficiaire (moins 1 % de commission).
- Retard : pénalité de 5 % de la cotisation, **reversée au bénéficiaire du tour**. Trois jours après l'échéance, les cautions des retardataires couvrent leur part et le pot est versé.
- Un défaillant qui arrive à son tour voit sa caution **reconstituée sur son pot** : le groupe n'est jamais perdant.

### Avance sur tontine
- Un membre à jour dont le tour arrive plus tard peut recevoir **jusqu'à 50 % de son futur pot**.
- Frais : 1,5 % par mois jusqu'au versement du pot (18 %/an, sous le taux d'usure).
- **Remboursement automatique** prélevé sur le pot avant versement : risque très faible, adossé à la cotisation des autres membres.

### Microcrédit
- Accessible avec une identité vérifiée (KYC 1) et un **score ≥ 550**, soit environ 14 cotisations payées à l'heure.
- Plafond croissant avec le score : 100 000 F à 550 points, jusqu'à 500 000 F.
- Intérêts sur le capital restant dû (1,5 %/mois), sans frais de dossier. Échéances prélevées automatiquement sur le jeton ; pénalité de 2 % après 3 jours de retard ; défaut à 90 jours.

### Score SMARTFIN (0 à 1 000)
| Comportement | Points |
|---|---|
| Base | +300 |
| Cotisation de tontine payée à l'heure | +15 chacune (max +300) |
| Cotisation en retard | −20 chacune |
| Cotisation impayée (caution utilisée) | −150 chacune |
| Tontine menée jusqu'au bout | +50 chacune (max +100) |
| E-caisse tenue jusqu'à l'échéance | +20 chacune (max +100) |
| Épargne disponible ≥ 50 000 F | +50 |
| Crédit remboursé | +40 chacun (max +200) |
| Échéance de crédit en retard | −30 chacune |
| Identité vérifiée | +50 |
| Crédit en défaut | score ramené à 0 |

Le détail du score est affiché au client (écran Crédit) et au conseiller (fiche client du back-office) : **le client sait exactement comment progresser**.

## 1.4 Segments de clientèle

1. **Groupes de tontine existants** (collègues, associations, familles, commerçantes des marchés, diaspora) : on digitalise leur tontine. Chaque organisateur amène 5 à 30 membres.
2. **Associations et communautés** (dahiras, mosquées, églises, GIE, ASC, associations de quartier) : leur caisse devient un coffre de groupe, avec cotisations visibles et retraits à double validation.
3. **Jeunes actifs urbains 20-35 ans** : tontines entre amis, challenges d'épargne, premier crédit.
4. **Petits commerçants et entrepreneurs** : tontine hebdomadaire + microcrédit de stock. C'est le cœur de cible de la microfinance.
5. **B2B2C** (phase 2) : entreprises, mutuelles, coopératives, églises qui gèrent leur caisse commune sur SMARTFIN.

## 1.5 Business Model Canvas

| Bloc | Contenu |
|---|---|
| **Partenaires clés** | **SFD / IMF agréé** (finance et porte les crédits) · banque ou EME agréé BCEAO (compte de cantonnement) · agrégateur de paiement puis contrats directs Wave / Orange / MTN / Moov · **bureau d'information sur le crédit (BIC)** · assureur (micro-assurance décès/santé des membres) · fournisseur KYC |
| **Activités clés** | Animation des tontines · scoring · octroi, versement et recouvrement des crédits · conformité (KYC, LBC/FT) · rapprochement quotidien |
| **Ressources clés** | Plateforme (moteur de tontine, grand livre, scoring, back-office) · données de cotisation · marque · réseau d'organisatrices et organisateurs de tontines |
| **Proposition de valeur** | Tontine sûre et transparente · crédit accessible sans garantie matérielle, grâce à la discipline d'épargne |
| **Relation client** | Self-service · organisateurs de tontines (relais communautaires) · WhatsApp · rappels de cotisation et d'échéance |
| **Canaux** | Organisateurs de tontines et ambassadeurs · parrainage · réseaux sociaux · marchés et associations · entreprises |
| **Structure de coûts** | Frais opérateurs Mobile Money · salaires · acquisition · **coût du risque (garantie de première perte)** · bureau de crédit · cloud, SMS, KYC · partenaires agréés |
| **Revenus** | Commission sur pots de tontine · part des intérêts de crédit · frais de retrait · float · SMARTFIN+ · frais Cagnotte+ et e-caisse · commissions d'assurance |

## 1.6 Grille tarifaire (`backend/src/pricing.ts`)

| Opération | Prix |
|---|---|
| Ouverture de compte, dépôt, cotisation de tontine, épargne, budget | **Gratuit** |
| Transfert entre utilisateurs | Gratuit |
| **Pot de tontine versé** | **1 %** du pot |
| Cotisation en retard | 5 % de la cotisation, **au profit du bénéficiaire du tour** |
| **Avance sur tontine** | 1,5 % par mois, déduite du pot |
| **Microcrédit** | 1,5 % par mois sur capital restant dû (18 %/an), 40 % pour SMARTFIN et 60 % pour le SFD ; pénalité de retard 2 % |
| Retrait vers Mobile Money | 1,5 % (min. 100 F, max. 7 500 F) |
| Retrait Cagnotte+ | 1 % |
| Rupture anticipée d'e-caisse | 2 % |
| SMARTFIN+ | 1 000 F/mois (3 retraits offerts, support prioritaire) |

**Garde-fou réglementaire codé** : l'API refuse tout produit dont le taux annuel dépasse le taux d'usure paramétré (24 %, à confirmer avec le SFD partenaire).

## 1.7 D'où vient l'argent (scénario central 2029)

~70 000 clients actifs dont 38 000 membres de tontines, 13,8 Mds F de pots versés, 1,1 Md F de crédits versés. **484 M F de chiffre d'affaires :**

| Source | M F | Part |
|---|---:|---:|
| Commissions sur pots de tontine | 138 | 29 % |
| Frais de retrait | 127 | 26 % |
| Revenus du float | 73 | 15 % |
| Abonnements SMARTFIN+ | 59 | 12 % |
| Frais Cagnotte+ | 42 | 9 % |
| Commissions micro-assurance et partenaires | 28 | 6 % |
| Part SMARTFIN des intérêts de crédit | 15 | 3 % |
| Pénalités e-caisse | 2 | < 1 % |

**Lecture stratégique.** En phase partenaire, la microfinance rapporte peu en direct (40 % d'intérêts sur des prêts courts). Sa vraie valeur est ailleurs :
1. **Rétention** : on ne quitte pas l'app qui porte son score et son crédit.
2. **Discipline** : les membres cotisent à l'heure pour faire monter leur score, ce qui réduit les impayés de tontine.
3. **Option stratégique** : avec un agrément SFD propre (année 3+), SMARTFIN capterait 100 % des intérêts. Il faudrait en contrepartie des fonds propres et porter le risque.

## 1.8 Points de vigilance

1. **Coût d'entrée de l'argent** : chaque cotisation passe par Mobile Money et SMARTFIN paie l'encaissement (≈ 35 % du chiffre d'affaires en 2029). Négocier sous 0,8 % est vital (onglet *Sensibilité*).
2. **Risque de crédit** : le SFD porte les prêts, mais demandera probablement une **garantie de première perte**. Le modèle suppose que SMARTFIN couvre 50 % des pertes. Objectif PAR30 < 5 %, suivi en temps réel dans le back-office.
3. **Réglementation** : ni SMARTFIN ni les organisateurs ne détiennent l'argent ; tout crédit est octroyé par un SFD agréé (chapitre 6).
4. **Prix face à Maman Tontine** : chez elle, le tour arrive directement sur Wave ou Orange Money pour 1 % au total. Chez SMARTFIN, jusqu'à 2,5 % si le pot est entièrement retiré. S'aligner coûterait cher (chapitre 0.3) : il faut plutôt réserver le retrait offert du pot aux abonnés SMARTFIN+ et renégocier une fois les contrats opérateurs signés.

## 1.9 Avantages défendables

- **Données de cotisation** : un historique de discipline financière que ni les banques ni les opérateurs Mobile Money n'ont.
- **Effet réseau** : une tontine ne fonctionne qu'à plusieurs ; chaque organisateur recrute son groupe.
- **Confiance** : caution automatique, tirage au sort vérifiable, grand livre en partie double, zéro argent perdu.
