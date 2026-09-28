# 8. Tontines de biens et espaces partenaires

## 8.1 Tontines de biens matériels

On cotise pour un **bien** (moto, réfrigérateur, téléphone, moulin, pagnes, sacs de céréales, matériel professionnel) au lieu d'une somme d'argent.

| Formule | Pour qui | Fonctionnement |
|---|---|---|
| **Individuelle** : plan d'achat | Une personne seule | J'épargne à mon rythme (par jour, semaine ou mois). À l'objectif : **commande automatique** si le bien vient du catalogue, sinon l'argent revient sur mon jeton pour que j'achète moi-même |
| **Groupe privé** | Collègues, famille, amis | Tontine de bien sur invitation (code, lien, QR code, WhatsApp) ; chacun reçoit le bien à son tour |
| **Groupe public** | Tout le monde | Visible dans **Tontines → Découvrir → Biens** ; typiquement organisée par un commerçant partenaire (« une moto par mois pendant 10 mois ») |

**Règles** (codées dans l'API) :
- **Bien du catalogue** (vendu par un partenaire commerçant) : la cotisation est **calculée automatiquement** pour que le pot, après la commission de 1 % et les frais du partenaire, couvre le prix. Exemple : réfrigérateur à 90 000 F à 3 membres → 30 325 F par tour.
- **Bien libre** (nom et prix saisis) : même calcul ; le pot est versé au bénéficiaire pour qu'il achète lui-même.
- Une tontine de biens **ne démarre que complète**, sinon le pot ne couvrirait pas le prix.
- **Séquestre** : au tour d'un membre, le prix du bien part au compte séquestre (`SYS_ESCROW`) et le fournisseur est prévenu. Le fournisseur marque « expédié / prêt », puis le bénéficiaire **confirme la réception avec son code PIN**. Le fournisseur est alors payé, moins **3 % de commission Smart Tontine**.
- **Sans réclamation**, la réception est confirmée automatiquement **7 jours** après l'expédition.
- **Rupture de stock** : le fournisseur annule et le bénéficiaire est **remboursé intégralement** depuis le séquestre.
- **Pot insuffisant** (impayés non couverts par les cautions) : le bénéficiaire complète avec son solde, ou garde l'argent et achète lui-même.
- **Pas d'avance sur tontine** pour une tontine de biens, afin que le pot reste entier pour le bien.
- Caution, rappels, pénalités de retard et score de crédit : identiques aux tontines d'argent.

## 8.2 Espaces partenaires

**Ma recommandation** : le statut de **partenaire** plutôt qu'une application séparée par client. Chaque partenaire obtient un espace **à son nom et à son logo** dans Smart Tontine :
- ses membres voient sa marque sur ses groupes, dans « Découvrir » et sur les invitations ;
- lui gère tout lui-même, depuis l'application (**Profil → Espace partenaire**) ;
- Smart Tontine garde une seule application à maintenir, un seul contrôle de conformité et un seul grand livre.

Pour les très gros partenaires (SFD, grandes entreprises), une **marque blanche complète** (application à leur nom sur les stores, domaine propre) peut être proposée plus tard sur devis (voir 8.4).

| Type de partenaire | Usage type |
|---|---|
| **Association / GIE** | Plusieurs tontines et caisses de l'association, gérées par le bureau |
| **Commerçant** | Catalogue de biens + tontines publiques de biens (motos, électroménager…) |
| **Entreprise** | Tontines et épargne des salariés |
| **Tontinier professionnel** | Gère des dizaines de tontines de clients, prend ses frais de gestion |
| **SFD** | Numérise ses groupes d'épargne (canal B2B du modèle G) |

**Ce que le partenaire peut faire** :
- créer son espace : nom, type, **logo** (photo de la galerie, recadrée), **couleur**, description, ville, téléphone ;
- créer **autant de tontines** (argent ou biens, privées ou publiques) **et de coffres** qu'il veut, **sans y cotiser lui-même** s'il le souhaite ;
- ajouter des **gestionnaires** à son équipe, qui démarrent les tontines, clôturent les tours et livrent les commandes ;
- suivre son **tableau de bord** : membres actifs, montants collectés ce mois, tontines (tour en cours, impayés), coffres, commandes à livrer, factures ;
- publier son **catalogue** de biens (photo, prix, stock) et gérer les commandes (expédier, annuler) ;
- percevoir ses **frais de gestion** (0 à 3 % de chaque pot, fixés par lui et affichés aux membres) et ses **ventes** sur son **compte partenaire**, puis les retirer vers Mobile Money.

**Contrôles** :
- l'espace est **« en attente »** jusqu'à la validation par Smart Tontine dans le back-office (onglet *Partenaires* : identité du responsable, récépissé d'association, RCCM, agrément SFD) ;
- avant validation, le partenaire ne peut ni créer de groupe ni vendre ;
- un partenaire peut être **suspendu**.
- Le partenaire **ne détient jamais l'argent des membres**. Cotisations, pots et séquestre restent dans le grand livre de Smart Tontine, cantonnés chez l'établissement agréé. Seuls ses frais et ses ventes arrivent sur son compte.

## 8.3 Ce que ça rapporte à Smart Tontine

| Source | Tarif | Qui paie |
|---|---|---|
| **Licence partenaire** | **75 F par membre actif et par mois**, minimum **10 000 F/mois** | le partenaire (prélevé chaque mois sur son compte ; facture « due » sinon, réglée automatiquement dès qu'il alimente son compte) |
| Commission sur chaque pot | 1 % (inchangé) | le bénéficiaire |
| **Commission fournisseur** sur les biens | **3 %** du prix, à la réception | le commerçant partenaire |
| Retrait du compte partenaire | 1 % | le partenaire |

La licence partenaire **généralise la licence SFD** du modèle G (chapitre 1.3) à tous les types de partenaires : associations, commerçants, entreprises, tontiniers. Elle est déjà comptée dans le canal B2B du modèle financier.

**Revenu supplémentaire des biens** (ordre de grandeur, **non inclus** dans le scénario central par prudence) : si 10 % des pots de 2031 (≈ 46 Mds F) financent des biens du catalogue, la commission fournisseur de 3 % rapporterait ≈ **138 M F** de plus. L'EBITDA 2031 passerait ainsi d'environ 191 à environ 330 M F. À valider avec les premiers commerçants partenaires.

## 8.4 Points de vigilance

- **Vente à crédit déguisée** : une tontine de biens reste une épargne collective (chacun paie sa part avant ou pendant). Smart Tontine n'avance jamais le prix d'un bien. Faire valider les CGU « tontine de biens » par un juriste (protection du consommateur, garantie du bien, délais de livraison).
- **Qualité des fournisseurs** : validation préalable, séquestre, confirmation de réception, suspension en cas de litiges répétés. *À ajouter* : notation des fournisseurs et médiation des litiges.
- **Frais du partenaire** : plafonnés à 3 % et affichés avant l'adhésion, pour éviter les abus de tontiniers.
- **Marque blanche complète** (application séparée à la marque d'un gros partenaire) : techniquement possible, puisque le code est commun et qu'il suffit de configurer le nom, l'icône et les couleurs à la compilation EAS. À proposer sur devis : frais de mise en place et licence plus élevée.
- **Portail partenaire web** (`/partenaire` sur la plateforme web) : mêmes fonctions que l'espace dans l'app, sur ordinateur, avec en plus la liste des membres (retards, défaillances), le relevé du compte et son **export CSV**. Voir le [chapitre 10](10_architecture_technique.md).

## 8.5 Référence API

| Domaine | Routes |
|---|---|
| Partenaires | `POST /partners`, `GET /partners/mine`, `GET /partners/:id/public`, `GET /partners/:id/dashboard`, `PATCH /partners/:id`, `POST/DELETE /partners/:id/staff`, `POST /partners/:id/topup`, `POST /partners/:id/withdraw` |
| Catalogue | `GET /goods`, `POST /goods/partners/:partnerId`, `PATCH /goods/:id` |
| Plans d'achat | `GET/POST /goods/plans`, `POST /goods/plans/:id/pay`, `POST /goods/plans/:id/cancel` |
| Commandes | `GET /goods/orders`, `POST /goods/orders/:id/ship`, `POST /goods/orders/:id/confirm`, `POST /goods/orders/:id/cancel` |
| Tontines (nouveaux champs) | `POST /tontines` accepte `kind` (`argent`/`bien`), `goodId` ou `goodLabel` + `goodPrice`, `visibility` (`private`/`public`), `partnerId`, `joinAsMember` ; `GET /tontines/public` |
| Coffres | `POST /cagnottes` accepte `partnerId` |
| Back-office | `GET /admin/api/partners`, `PATCH /admin/api/partners/:id` (valider / suspendre) |
| Tâches automatiques | confirmation des commandes expédiées après 7 jours ; facturation mensuelle de la licence partenaire |
