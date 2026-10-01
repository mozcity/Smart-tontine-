# 9. Cahier des charges — Plateforme web et application mobile Smart Tontine

| | |
|---|---|
| **Maître d'ouvrage** | Smart Tontine (Ouagadougou, Burkina Faso) |
| **Objet** | Conception, réalisation et mise en service de la plateforme Smart Tontine : API, plateforme web (site public, espace membre, portail partenaire, back-office) et application mobile Android / iOS |
| **Version** | 1.0 |
| **Documents liés** | [01 Modèle économique](01_modele_economique.md) · [05 Plateforme](05_plateforme_informatique.md) · [06 Conformité](06_conformite_risques.md) · [08 Biens et partenaires](08_biens_et_partenaires.md) · [10 Architecture technique](10_architecture_technique.md) |

---

## 1. Contexte et objectifs

### 1.1 Contexte
La tontine est le premier outil d'épargne au Burkina Faso, mais elle se gère encore en espèces et dans des cahiers. Les risques sont connus : trésorier qui disparaît, impayés, litiges. **Smart Tontine** numérise la tontine rotative, y ajoute une **caution** qui couvre les impayés, et transforme la régularité des cotisations en **score de crédit**. Ce score ouvre l'avance sur tontine et le microcrédit, accordés par des **SFD partenaires**.

Le modèle économique retenu (**modèle G, « B2B2C adossé aux SFD »**) repose sur deux canaux :
- **grand public** : commission de 1 % sur les pots, 1 % sur les retraits, abonnements Smart Tontine+ et Organisateur Pro ;
- **partenaires** : SFD, associations, commerçants, entreprises et tontiniers, qui paient une licence de 75 F par membre actif et par mois (minimum 10 000 F).

La plateforme doit servir ces deux canaux avec **un seul code, un seul grand livre et une seule conformité**.

### 1.2 Objectifs
| # | Objectif | Indicateur de réussite |
|---|---|---|
| O1 | Permettre à un membre de cotiser et de recevoir son pot sans espèces | 95 % des pots versés automatiquement le jour de la dernière cotisation |
| O2 | Supprimer le risque d'impayé pour le groupe | 100 % des tours échus soldés (cotisations ou cautions) au plus tard à J+3 |
| O3 | Donner aux partenaires un outil autonome à leur marque | Un partenaire crée son espace, ses groupes et son catalogue sans intervention de Smart Tontine (hors validation KYB) |
| O4 | Ouvrir le crédit à partir de l'historique de cotisation | Score calculé en temps réel ; décision de crédit en moins de 1 minute |
| O5 | Garantir l'intégrité de l'argent | Grand livre équilibré à tout instant (`somme des soldes = 0`), contrôlé chaque jour |
| O6 | Être accessible au plus grand nombre | App Android fonctionnelle sur des téléphones d'entrée de gamme (Android 8+, 2 Go RAM) et en 3G ; plateforme web utilisable sur ordinateur et mobile |

### 1.3 Périmètre
**Dans le périmètre**
1. API centrale (moteur de tontine, portefeuille, crédit, biens, partenaires, CRM).
2. **Application mobile** Android et iOS (membres, organisateurs, équipes partenaires).
3. **Plateforme web** :
   - site public (vitrine, tarifs, découverte des tontines publiques, catalogue, vitrines des partenaires, demande de partenariat) ;
   - espace membre web (mêmes fonctions essentielles que l'app) ;
   - **portail partenaire** (gestion complète de l'espace partenaire sur ordinateur) ;
   - back-office Smart Tontine (CRM, crédit, partenaires, support, finance).
4. Intégrations : agrégateur Mobile Money, SMS, SFD partenaire.
5. Environnements, déploiement, supervision, documentation.

**Hors périmètre (phase 1)**
- canal USSD, prévu en phase 2 via un agrégateur USSD ;
- marque blanche complète (application séparée sur les stores au nom d'un partenaire), sur devis ;
- intégration temps réel au bureau d'information sur le crédit (BIC), prévue en phase 2.

---

## 2. Acteurs et rôles

| Acteur | Description | Accès |
|---|---|---|
| **Visiteur** | Personne non inscrite | Site public |
| **Membre** | Client inscrit par OTP SMS | App mobile, espace membre web |
| **Organisateur** | Membre qui crée des tontines ou des coffres (2 groupes gratuits, au-delà Organisateur Pro) | App, espace membre web |
| **Partenaire — propriétaire** | Responsable d'une association, d'un commerçant, d'une entreprise, d'un tontinier ou d'un SFD | App (espace partenaire), portail partenaire web |
| **Partenaire — gestionnaire** | Membre de l'équipe du partenaire (démarre les tontines, clôture les tours, livre les commandes) | Idem, sans les finances, l'équipe ni les paramètres |
| **Support** | Agent Smart Tontine | Back-office : clients, tickets, crédit en lecture |
| **Administrateur** | Direction, finance, conformité | Back-office complet : validation des partenaires, campagnes, contrôle du grand livre, rapprochement |
| **Systèmes externes** | Agrégateur de paiement, opérateur SMS, SFD | API et webhooks signés |

**Matrice des droits (extrait)**

| Action | Membre | Organisateur | Gestionnaire partenaire | Propriétaire partenaire | Support | Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Cotiser, recevoir un pot | ✔ | ✔ | ✔ | ✔ | — | — |
| Créer une tontine / un coffre | ✔ (2 max) | ✔ (Pro illimité) | ✔ au nom du partenaire | ✔ | — | — |
| Démarrer une tontine, clôturer un tour | — | ✔ ses groupes | ✔ groupes du partenaire | ✔ | — | — |
| Catalogue, expédier une commande | — | — | ✔ | ✔ | — | — |
| Retirer les revenus partenaire, gérer l'équipe, la marque, les frais | — | — | — | ✔ | — | — |
| Consulter un client, répondre à un ticket | — | — | — | — | ✔ | ✔ |
| Valider / suspendre un partenaire, contrôle du grand livre | — | — | — | — | — | ✔ |

---

## 3. Exigences fonctionnelles

Priorités : **P1** indispensable au lancement · **P2** dans les 6 mois · **P3** plus tard.

### 3.1 Inscription, connexion, sécurité du compte
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-AUTH-01 | Inscription et connexion par numéro de téléphone UEMOA et code OTP à 6 chiffres envoyé par SMS (valable 5 min, 5 essais, 5 demandes / 15 min) | P1 |
| F-AUTH-02 | Code PIN à 4 chiffres, exigé pour toute sortie d'argent ou tout engagement (retrait, transfert, crédit, confirmation de réception…) | P1 |
| F-AUTH-03 | **Verrouillage du PIN** après 5 erreurs pendant 30 minutes, avec notification | P1 |
| F-AUTH-04 | Parrainage par code, canal d'acquisition enregistré | P1 |
| F-AUTH-05 | Niveaux KYC 0 / 1 / 2 avec plafonds de solde **et de dépôts mensuels** ; KYC 1 requis pour le crédit | P1 |
| F-AUTH-07 | **Vérification d'identité en ligne** (app et web) : niveau 1 = pièce recto/verso + selfie avec la pièce (photo prise à l'appareil, compressée) ; niveau 2 = + justificatif de domicile ou de revenus ; un seul dossier en attente ; refus motivé et notifié | P1 |
| F-AUTH-06 | Session web et mobile par jeton signé ; suspension du compte effective immédiatement | P1 |

### 3.2 Portefeuille (« Mon jeton »)
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-WAL-01 | Dépôt depuis Orange Money, Moov Money, Wave (et carte) via l'agrégateur ; crédit à réception du webhook signé ; idempotent | P1 |
| F-WAL-02 | Retrait vers Mobile Money : 1 % (min. 100 F, max. 5 000 F), devis affiché avant validation, 3 retraits offerts / mois avec Smart Tontine+ | P1 |
| F-WAL-03 | Transfert entre membres par numéro de téléphone | P1 |
| F-WAL-04 | Historique détaillé et opérations en attente | P1 |

### 3.3 Tontines
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-TON-01 | Création : nom, cotisation, fréquence (semaine / mois), nombre de membres (2 à 50), ordre (tirage au sort ou fixe), caution (par défaut = 1 cotisation), visibilité (privée / publique) | P1 |
| F-TON-02 | Invitation par code, lien, QR code, WhatsApp ; aperçu avant adhésion | P1 |
| F-TON-03 | « Découvrir » : tontines publiques en recrutement (argent et biens), recherche | P1 |
| F-TON-04 | Démarrage par l'organisateur ; tirage au sort vérifiable ; calendrier des tours | P1 |
| F-TON-05 | Cotisation en un clic ; pénalité de 5 % en retard, reversée au bénéficiaire ; **versement automatique du pot** dès la dernière cotisation (moins 1 % de commission, avance éventuelle, frais du partenaire) | P1 |
| F-TON-06 | Clôture automatique des tours échus + 3 jours : cautions des retardataires converties en cotisations | P1 |
| F-TON-07 | Rappels automatiques J-1 et J0 (cotisations, échéances de crédit) | P1 |
| F-TON-08 | Export CSV des cotisations (Organisateur Pro, partenaires) | P2 |

### 3.4 Tontines de biens et catalogue
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-BIE-01 | Tontine de biens en groupe privé ou public, bien du catalogue ou bien libre ; cotisation calculée pour que le pot net couvre le prix | P1 |
| F-BIE-02 | Plan d'achat individuel : épargne libre ou périodique vers un bien ; commande automatique à l'objectif | P1 |
| F-BIE-03 | Paiement au **séquestre** ; expédition par le fournisseur ; confirmation de réception par le bénéficiaire (PIN) ; paiement du fournisseur moins 3 % ; confirmation automatique à 7 jours ; annulation = remboursement intégral | P1 |

### 3.5 Crédit (avec le SFD partenaire)
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-CRE-01 | Score Smart Tontine de 0 à 1000, avec les facteurs expliqués au membre | P1 |
| F-CRE-02 | Avance sur tontine ≤ 50 % du futur pot, remboursée automatiquement sur le pot | P1 |
| F-CRE-03 | Microcrédit (score ≥ 550, KYC 1) : simulation, échéancier sur capital restant dû, prélèvement automatique, pénalité J+3, défaut J+90 | P1 |
| F-CRE-04 | Contrôle du taux d'usure avant tout octroi ; répartition des intérêts 40 % Smart Tontine / 60 % SFD | P1 |

### 3.6 Épargne et outils
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-EPA-01 | E-caisse (épargne bloquée jusqu'à une date, rupture anticipée à 2 %) | P1 |
| F-EPA-02 | Coffres de groupe (associations, dahiras, familles, GIE) : suivi payé / partiel / impayé, retraits à double validation | P1 |
| F-EPA-03 | Budget, projets, challenges d'épargne, contrats de prêt entre proches | P2 |

### 3.7 Espace et portail partenaire
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-PAR-01 | Création d'un espace : nom, type, logo, couleur, description, ville, téléphone, frais de gestion (0 à 3 %) ; statut « en attente » jusqu'à validation | P1 |
| F-PAR-02 | Tableau de bord : membres actifs, collecte du mois, frais perçus, solde, facture estimée, groupes, impayés, commandes | P1 |
| F-PAR-03 | Création et pilotage de tontines (argent, biens) et de coffres au nom du partenaire | P1 |
| F-PAR-04 | Catalogue : ajout, prix, stock, photo, activation ; commandes : expédier, annuler | P1 |
| F-PAR-05 | Équipe : ajouter / retirer des gestionnaires par téléphone | P1 |
| F-PAR-06 | Finances : solde, **relevé du compte partenaire** et **export CSV**, factures de licence, alimentation, retrait vers Mobile Money | P1 |
| F-PAR-07 | **Liste des membres** du partenaire, avec les groupes de chacun et les retards | P1 |
| F-PAR-08 | Vitrine publique du partenaire (marque, tontines publiques, catalogue), partageable par lien | P1 |
| F-PAR-09 | Tout ce qui précède **sur ordinateur** (portail web) comme dans l'app | P1 |

### 3.8 Site public
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-PUB-01 | Page d'accueil : proposition de valeur, fonctionnement en 4 étapes, sécurité, chiffres clés de la plateforme | P1 |
| F-PUB-02 | Tarifs lus en direct depuis l'API (aucun prix codé en dur dans le site) | P1 |
| F-PUB-03 | Découverte des tontines publiques et du catalogue **sans compte** ; adhésion après connexion | P1 |
| F-PUB-04 | Vitrines des partenaires | P1 |
| F-PUB-05 | Formulaire « Devenir partenaire / SFD » et contact, traités dans le back-office | P1 |
| F-PUB-06 | Pages légales : CGU, confidentialité, tontines de biens | P1 (contenu juridique à fournir) |

### 3.9 Back-office Smart Tontine
| Réf. | Exigence | Prio. |
|---|---|:-:|
| F-BO-01 | Tableau de bord : membres, activité, volumes, revenus, tontines, crédit (encours, PAR30) | P1 |
| F-BO-02 | Fiche client 360°, segments, notes, suspension, niveau KYC | P1 |
| F-BO-03 | Partenaires : validation (KYB), suspension ; **demandes de partenariat** reçues du site | P1 |
| F-BO-04 | Support : tickets, réponses | P1 |
| F-BO-05 | Campagnes SMS / notifications par segment, actualités | P2 |
| F-BO-06 | Finance : contrôle du grand livre, retraits à rapprocher (confirmer / annuler) | P1 |
| F-BO-07 | **Revue KYC** : file des dossiers, photos, validation (admin uniquement) ou refus motivé ; chaque consultation des photos est tracée | P1 |
| F-BO-08 | **Double authentification (TOTP)** des comptes support et admin, obligatoire en production ; réinitialisation par un autre admin | P1 |

---

## 4. Exigences non fonctionnelles

| Réf. | Domaine | Exigence |
|---|---|---|
| NF-01 | **Intégrité financière** | Grand livre en partie double ; montants en entiers FCFA ; aucune écriture modifiable ; contrôle quotidien automatique ; solde client jamais négatif (contrainte en base) |
| NF-02 | **Sécurité** | HTTPS partout ; OTP et PIN hachés (scrypt) ; verrouillage du PIN ; jeton en Keychain / Keystore sur mobile ; validation stricte des entrées ; en-têtes de sécurité ; limitation du débit sur les routes d'authentification et publiques ; webhooks signés HMAC ; secrets hors du code ; **2FA (TOTP) pour le back-office**, obligatoire en production ; **vérification serveur-à-serveur de chaque paiement** avant crédit ; test d'intrusion avant lancement |
| NF-03 | **Données personnelles** | Déclaration à la CIL (Burkina) ; minimisation ; hébergement conforme aux exigences BCEAO et du partenaire bancaire ; droit d'accès et de suppression |
| NF-04 | **Performance** | API : p95 < 300 ms sur les lectures, < 800 ms sur les opérations d'argent ; site public : premier affichage < 2,5 s en 3G ; bundle web initial < 250 Ko gzip |
| NF-05 | **Disponibilité** | 99,5 % mensuel en phase 1 ; sauvegardes PostgreSQL point-in-time, rétention 30 jours ; RPO ≤ 5 min, RTO ≤ 4 h |
| NF-06 | **Montée en charge** | 250 000 membres et 50 opérations d'argent / seconde en pointe (objectif 2031) sans refonte : API sans état, mise à l'échelle horizontale |
| NF-07 | **Compatibilité** | Android 8+ (priorité), iOS 15+ ; navigateurs récents (Chrome, Safari, Firefox, Edge) ; écrans dès 360 px de large |
| NF-08 | **Accessibilité et ergonomie** | Français simple, zones tactiles ≥ 44 px, contrastes AA (4,5:1), code PIN sur clavier, récapitulatif avant toute sortie d'argent, mode sombre (web) ; système de design commun web/app ([chapitre 11](11_design_ux_ui.md)) ; langues locales (mooré, dioula) en P2 |
| NF-09 | **Traçabilité** | Chaque mouvement d'argent a une référence unique, un initiateur et des métadonnées ; événements métier journalisés pour le CRM |
| NF-10 | **Qualité** | Tests automatisés de bout en bout sur une vraie base ; intégration continue bloquante ; typage strict TypeScript sur tous les composants |
| NF-11 | **Exploitabilité** | Configuration par variables d'environnement ; conteneurs Docker ; point de santé `/health` ; journaux structurés |

---

## 5. Contraintes réglementaires (rappel du chapitre 6)
- L'argent des membres est **cantonné** chez un établissement agréé BCEAO (banque ou EME) ; Smart Tontine opère comme prestataire technique ou agent.
- Le crédit est accordé **au nom du SFD agréé**. Smart Tontine distribue et fournit le score.
- Taux d'usure vérifié dans le code avant tout octroi.
- LBC/FT : plafonds par niveau KYC, alertes sur opérations atypiques (P2), conservation des données 10 ans.
- Tontines de biens : CGU spécifiques. Ce n'est pas de la vente à crédit, et Smart Tontine n'avance jamais le prix.

---

## 6. Architecture technique (résumé)
Le détail est au [chapitre 10](10_architecture_technique.md).

| Couche | Choix | Justification |
|---|---|---|
| API | Node.js 22, TypeScript, Express 5, Zod, SQL paramétré (`pg`) | Un seul langage du serveur au mobile ; SQL explicite pour le contrôle des transactions financières |
| Base de données | PostgreSQL 16 | Transactions ACID, verrous de ligne, contraintes ; standard et disponible en service managé |
| Plateforme web | React 19 + TypeScript + Vite, application monopage servie par l'API ou un CDN | Léger, rapide en 3G, même langage et mêmes modèles que l'app |
| App mobile | Expo (React Native), Expo Router | Android + iOS d'un seul code ; mises à jour à distance (EAS Update) |
| Back-office | HTML + JavaScript sans dépendance, servi par l'API | Surface d'attaque minimale |
| Tâches planifiées | Worker horaire (rappels, tours échus, prélèvements, e-caisse, abonnements, commandes, licences) | Même base de code que l'API |
| Paiements | Abstraction « fournisseur » (simulé en développement, agrégateur en production) + webhooks HMAC | Changer d'agrégateur sans toucher au métier |
| Déploiement | Docker, Docker Compose (dev / pré-production), intégration continue GitHub Actions, EAS Build / Submit pour les stores | Reproductible |

---

## 7. Livrables

| # | Livrable | Emplacement |
|---|---|---|
| L1 | Cahier des charges (ce document) et architecture technique | `docs/09`, `docs/10` |
| L2 | API + migrations + tâches planifiées + tests automatisés | `backend/` |
| L3 | Plateforme web : site public, espace membre, portail partenaire | `web/` |
| L4 | Back-office | `backend/public/admin` |
| L5 | Application mobile Android / iOS + configuration de build EAS | `mobile/` |
| L6 | Conteneurs, Docker Compose, intégration continue | `docker-compose.yml`, `*/Dockerfile`, `.github/workflows` |
| L7 | Documentation d'exploitation (démarrage, variables, déploiement) | `README.md`, `docs/10` |
| L8 | Données de démonstration | `backend/src/seed.ts` |
| L9 | Système de design et maquettes (captures) web et app | `docs/11_design_ux_ui.md`, `web/src/styles.css`, `*/components/ui.tsx` |

---

## 8. Planning de réalisation (lots)

| Lot | Contenu | Durée indicative | Jalon |
|---|---|---|---|
| **Lot 0** | Cadrage, maquettes, conventions (banque / EME, SFD, agrégateur) | 4 semaines | Validation des parcours |
| **Lot 1** | API cœur : comptes, grand livre, portefeuille, tontines, rappels | 6 semaines | Tontine de bout en bout en simulé |
| **Lot 2** | App mobile membres + site public | 6 semaines | Bêta fermée (50 membres) |
| **Lot 3** | Crédit, biens, partenaires, portail partenaire web, back-office | 6 semaines | Pilote avec 1 SFD et 2 commerçants |
| **Lot 4** | Intégration réelle de l'agrégateur et du SMS, sécurité, test d'intrusion, stores | 4 semaines | Lancement Ouagadougou |
| **Lot 5** | Maintenance évolutive : USSD, langues locales, BIC, marque blanche | continu | — |

État au moment de la rédaction : les lots 1 à 3 sont **réalisés dans ce dépôt** en mode simulé. Les lots 0 et 4 dépendent des conventions avec les partenaires agréés.

---

## 9. Critères de recette

| # | Scénario | Résultat attendu |
|---|---|---|
| R1 | 4 membres créent une tontine, cotisent chacun au tour 1 | Pot versé automatiquement au bénéficiaire moins 1 % ; grand livre équilibré |
| R2 | Un membre ne cotise pas au tour 2, J+3 passé | Sa caution couvre la cotisation ; il est marqué défaillant ; pot versé |
| R3 | Tontine de biens du catalogue à 3 membres | Commande au séquestre au tour 1 ; expédition ; confirmation par PIN ; fournisseur payé moins 3 % |
| R4 | Membre avec score ≥ 550 et KYC 1 demande un microcrédit | Échéancier affiché, taux sous l'usure, décaissement immédiat, prélèvement automatique à l'échéance |
| R5 | 5 PIN erronés | PIN verrouillé 30 min, toute sortie d'argent refusée pendant ce temps |
| R6 | Un partenaire crée son espace sur le portail web | Statut « en attente » ; création de groupe refusée ; après validation back-office, création possible et logo visible par les membres |
| R7 | Un partenaire exporte son relevé | CSV conforme aux écritures de son compte |
| R8 | Un visiteur consulte les tarifs et une tontine publique sans compte, puis s'inscrit et adhère | Parcours complet sur le web |
| R9 | Un prospect envoie une demande « Devenir partenaire » | Demande visible dans le back-office, statut modifiable |
| R10 | Contrôle du grand livre | `somme des soldes = 0` et chaque solde égal à la somme de ses écritures |
| R11 | Un membre envoie pièce + selfie ; un admin valide | Niveau KYC 1, plafonds relevés, condition « identité » du crédit levée |
| R12 | Webhook « succès » pour un paiement que l'agrégateur déclare refusé, ou d'un montant différent | Aucun crédit ; dépôt refusé ou mis en rapprochement |
| R13 | Agent du back-office avec 2FA active, sans code | Accès refusé ; code déjà utilisé refusé ; verrouillage après 5 erreurs |

Chaque scénario R1 à R13 est couvert par un **test automatisé** dans `backend/tests` et exécuté par l'intégration continue.

---

## 10. Maintenance et évolutions
- **Garantie** : 3 mois de correction des anomalies après la mise en production.
- **Niveaux de service** :
  - anomalie bloquante sur l'argent : prise en charge en moins de 1 h, correction ou contournement en moins de 4 h ;
  - anomalie majeure : correction en moins de 2 jours ouvrés.
- **Mises à jour** : l'app reçoit ses correctifs à distance (EAS Update). Une nouvelle version sur les stores n'est nécessaire que si le code natif change.
- **Réversibilité** : code source, schéma de base et documentation appartiennent à Smart Tontine. Aucun service propriétaire indispensable.
