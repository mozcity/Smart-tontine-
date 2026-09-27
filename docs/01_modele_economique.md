# 1. Modèle économique SMARTFIN

## 1.1 Proposition de valeur

> **« Gère ton argent sans stress, depuis ton téléphone. »**

SMARTFIN aide les jeunes actifs, commerçants et familles de l'UEMOA à **mettre de l'argent de côté et tenir leurs engagements**, là où le Mobile Money sert surtout à *dépenser et transférer*. SMARTFIN n'est pas un concurrent de Wave ou Orange Money : c'est la **couche d'épargne et de discipline financière** au-dessus d'eux.

| Problème du client | Réponse SMARTFIN |
|---|---|
| « Dès que j'ai l'argent sur mon compte, je le dépense. » | **E-caisse** : épargne bloquée jusqu'à une date, pénalité de 2 % si on casse avant. |
| « Notre tontine repose sur la confiance dans une seule personne. » | **Cagnotte+** : caisse commune, cotisations visibles, **double validation** de chaque retrait. |
| « Je ne sais pas où passe mon argent en fin de mois. » | **Budget** : plafonds par catégorie, alertes à 80 % et 100 %. |
| « Mon projet (voyage, loyer, commerce) n'avance pas. » | **Projets** : objectif chiffré, étapes, progression. |
| « Épargner, c'est ennuyeux. » | **Challenges** : défis ludiques (52 semaines, 1 000 F/jour…), points, classement, récompenses. |
| « J'ai prêté de l'argent à un proche, sans trace. » | **Contrats** : prêt signé des deux côtés, échéancier, remboursement en un clic. |

## 1.2 Segments de clientèle (par ordre de priorité)

1. **Jeunes actifs urbains 20-35 ans** (Abidjan d'abord) : salariés, freelances, étudiants en fin de cursus. Smartphone, Wave/Orange Money déjà utilisés, sensibles au ludique et au social.
2. **Groupes de tontine** (collègues, associations, familles, diaspora) : la Cagnotte+ est leur produit d'entrée ; chaque groupe amène 5 à 30 membres (acquisition virale).
3. **Petits commerçants et entrepreneurs** : épargne pour stock, projets, contrats de prêt avec fournisseurs/proches.
4. **B2B2C (phase 2)** : entreprises qui proposent SMARTFIN en avantage salarié (épargne sur salaire), associations, mutuelles, églises.

## 1.3 Business Model Canvas

| Bloc | Contenu |
|---|---|
| **Partenaires clés** | Banque ou établissement de monnaie électronique (EME) agréé BCEAO (compte de cantonnement) · agrégateur de paiement (CinetPay, PayDunya) puis contrats directs Wave / Orange / MTN / Moov · fournisseur KYC · IMF et assureurs (micro-crédit, micro-assurance) · influenceurs et ambassadeurs. |
| **Activités clés** | Développement produit · conformité (KYC, LBC/FT) · acquisition et animation de communauté · support client · rapprochement financier quotidien. |
| **Ressources clés** | Plateforme (API + app + back-office, livrée dans ce dépôt) · marque · licences/partenariats · base clients et données comportementales. |
| **Proposition de valeur** | Épargne disciplinée, collective et ludique ; zéro frais pour déposer et épargner. |
| **Relation client** | Self-service dans l'app · WhatsApp support · notifications et campagnes segmentées · programme de parrainage · communauté (challenges, classement). |
| **Canaux** | TikTok, Facebook, Instagram, WhatsApp · ambassadeurs campus/marchés · parrainage · partenariats entreprises et associations · stores Google Play / App Store. |
| **Segments** | Voir 1.2. |
| **Structure de coûts** | Frais opérateurs Mobile Money (poste n°1) · salaires · marketing d'acquisition · cloud, SMS, KYC · banque partenaire · conformité et audit. |
| **Sources de revenus** | Frais de retrait · frais Cagnotte+ · pénalités e-caisse · abonnement SMARTFIN+ · revenus du float · commissions partenaires. |

## 1.4 Grille tarifaire

La grille est codée dans `backend/src/pricing.ts` (source unique pour l'API, l'app et le modèle financier).

| Opération | Prix | Justification |
|---|---|---|
| Ouverture de compte, dépôt, épargne, budget, projets, challenges | **Gratuit** | Lever toute barrière à l'entrée d'argent. |
| Transfert entre utilisateurs SMARTFIN | **Gratuit** | Effet réseau : chaque transfert fait venir un nouvel utilisateur. |
| Retrait vers Mobile Money | **1,5 %** (min. 100 F, max. 7 500 F) | Couvre le coût d'encaissement payé à l'entrée. |
| Retrait d'une Cagnotte+ vers un membre | **1 %** (min. 100 F, max. 10 000 F) | Service de confiance à forte valeur. |
| Rupture anticipée d'une e-caisse | **2 %** (min. 200 F) | C'est la « friction » qui rend l'épargne efficace. |
| Déblocage d'une e-caisse à l'échéance | Gratuit, automatique | — |
| **SMARTFIN+** | **1 000 F / mois** | 3 retraits offerts/mois, challenges exclusifs, coach budget, support prioritaire. |
| Parrainage | Parrain : **+500 F** au 1er dépôt ≥ 5 000 F du filleul | Acquisition à coût maîtrisé. |

## 1.5 Moteurs de revenus (scénario central, voir `finance/`)

En 2029 (année 3) : ~70 000 clients actifs, 20,9 Mds F de dépôts annuels, **373 M F de chiffre d'affaires** réparti ainsi :

| Source | Part |
|---|---|
| Frais de retrait | 34 % |
| Revenus du float | 20 % |
| Commissions partenaires | 19 % |
| Abonnements SMARTFIN+ | 16 % |
| Frais Cagnotte+ | 11 % |
| Pénalités e-caisse | < 1 % |

## 1.6 Le point de vigilance n°1 : le coût d'entrée de l'argent

Les dépôts sont gratuits pour le client, mais **SMARTFIN paie l'opérateur à chaque encaissement** (0,7 à 1 % selon les contrats). C'est le premier poste de coût : 167 M F en 2029, soit 45 % du chiffre d'affaires. D'où trois règles :

1. **Négocier dès le premier jour** des contrats directs avec Wave, Orange Money, MTN et Moov (objectif : < 0,8 %). L'onglet *Sensibilité* du modèle montre qu'un point de coût d'encaissement vaut ~200 M F d'EBITDA en année 3.
2. **Garder l'argent dans l'écosystème** : chaque franc qui reste en e-caisse, projet ou cagnotte génère du float et évite un retrait payant pour nous. Les transferts internes sont gratuits *et* ne coûtent rien.
3. **Diversifier vers des revenus récurrents** : SMARTFIN+ et commissions partenaires (micro-assurance, micro-crédit adossé à l'historique d'épargne).

## 1.7 Avantages défendables

- **Données d'épargne** : l'historique de discipline (e-caisses tenues, contrats remboursés) est un score de crédit alternatif très recherché par les IMF → commissions partenaires.
- **Effet réseau des Cagnottes+ et des contrats** : un produit qui ne fonctionne qu'à plusieurs.
- **Confiance** : grand livre en partie double, double validation, transparence totale des cagnottes.
