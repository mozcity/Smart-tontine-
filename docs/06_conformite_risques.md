# 6. Cadre réglementaire et risques

> Ce chapitre donne un cadre de travail, pas un avis juridique. Il doit être validé par un cabinet spécialisé en droit bancaire et en microfinance UEMOA, puis par les partenaires agréés, avant tout lancement public. Les taux et seuils cités sont à confirmer au moment du lancement.

## 6.1 Trois activités, trois régimes

| Activité SMARTFIN | Nature réglementaire | Qui la porte au lancement |
|---|---|---|
| Détenir l'argent des clients (jeton, cotisations, cautions) | Réception de fonds du public / monnaie électronique : réservée aux établissements agréés BCEAO | **Banque ou EME partenaire** : compte de cantonnement |
| Tontine en ligne | Épargne collective rotative entre membres ; SMARTFIN fournit l'outil et prend une commission de service, sans promesse de rendement | SMARTFIN (prestataire technique), fonds chez le partenaire agréé |
| **Crédit** (avance sur tontine, microcrédit) | Opération de crédit : réservée aux banques et aux **systèmes financiers décentralisés (SFD)** agréés (loi uniforme portant réglementation des SFD dans l'UEMOA) | **SFD / IMF partenaire** : prêteur en titre, finance le portefeuille |

**SMARTFIN = apporteur d'affaires et prestataire technique.** SMARTFIN note les clients, distribue, verse et recouvre pour le compte du SFD, en vertu d'une convention qui fixe : la part des intérêts (modèle : 40 %), la garantie de première perte (modèle : 50 % des pertes), la politique de crédit validée par le SFD, le reporting et l'accès au bureau de crédit.

**Évolution (année 3+)** : demander un **agrément SFD propre** pour capter 100 % des intérêts. Cela suppose des fonds propres, un portefeuille financé et le respect des normes prudentielles (solvabilité, liquidité, division des risques, PAR).

## 6.2 Règles de crédit déjà codées dans la plateforme

| Exigence | Implémentation |
|---|---|
| **Taux d'usure** (SFD : 24 %/an à confirmer) | `pricing.credit.usuryApr` ; `assertUnderUsury()` bloque tout octroi au-delà |
| Transparence du coût | Simulation avant demande (`/credit/simulate`), coût total affiché ; intérêts sur capital restant dû |
| Octroi responsable | Score ≥ 550 + identité vérifiée ; plafond lié au score ; un seul microcrédit à la fois ; aucun crédit après un défaut |
| Consentement | Code PIN obligatoire pour toute demande et tout remboursement |
| Traçabilité | Chaque versement et remboursement est une écriture du grand livre (`SYS_CREDIT`, `SYS_CREDIT_INCOME`, `SYS_FEES`) |
| Suivi du risque | PAR30, défauts, taux de remboursement à l'heure dans le back-office |

À ajouter avant le lancement du crédit : fiche d'information précontractuelle et contrat de prêt signés électroniquement au nom du SFD ; consultation et déclaration au **bureau d'information sur le crédit (BIC)** ; politique de rééchelonnement ; plafond d'endettement (mensualités / revenus déclarés).

## 6.3 Tontine : règles de protection des membres

- **Aucun membre ni organisateur ne détient la caisse** : tout est cantonné chez le partenaire agréé.
- **Caution** obligatoire, transparente, rendue en fin de cycle.
- **Ordre de passage** fixé avant le démarrage (tirage au sort cryptographique ou ordre accepté par tous), non modifiable ensuite.
- **Pénalités de retard reversées au bénéficiaire**, pas à SMARTFIN : la plateforme ne profite pas des retards.
- Conditions générales spécifiques : que se passe-t-il en cas de décès d'un membre, de départ, de litige (médiation SMARTFIN) ; **micro-assurance décès** proposée en option.
- Taille et montants plafonnés selon le niveau KYC (LBC/FT).

## 6.4 Autres obligations

| Domaine | Exigence | Dans la plateforme |
|---|---|---|
| **KYC** | Identification proportionnée au risque | Niveaux 0-1-2 ; niveau 1 exigé pour le microcrédit |
| **LBC/FT** | Surveillance, déclaration de soupçon (CENTIF) | Historique complet ; *à ajouter* : alertes (fractionnement, tontines fictives, remboursements anticipés inhabituels) |
| **Données personnelles** | Loi ivoirienne n° 2013-450 ; déclaration/autorisation **ARTCI** ; données de crédit particulièrement sensibles | Score explicable, accès limité au back-office, classement public par prénom uniquement |
| **Protection du consommateur** | Tarifs affichés, réclamations, recouvrement loyal | Grille publique `GET /pricing`, tickets, charte de recouvrement (chapitre 4.4) |
| **Fiscalité** | IS 25 %, TVA selon régime sur les commissions | Revenus isolés dans `SYS_FEES` |

## 6.5 Registre des risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Aucun SFD ne signe | Moyenne | Fort : pas de crédit | Démarrer avec la tontine seule (qui fonctionne sans SFD), démarcher 5+ SFD ; le portefeuille noté est l'argument |
| Aucune banque/EME ne signe | Moyenne | Bloquant | Démarcher plusieurs partenaires ; agrégateur agréé ; bêta fermée |
| **Impayés de tontine en cascade** | Moyenne | Fort : perte de confiance | Caution automatique, clôture à J+3, reconstitution sur le pot du défaillant, score ; *option* : caution à 2 cotisations pour les tontines de plus de 10 membres |
| **Défauts de crédit** (PAR30 > 5 %) | Moyenne | Fort : garantie de première perte | Score prudent, petits montants au départ, prélèvement automatique, avance adossée au pot, suivi PAR30 quotidien, gel de l'octroi si seuil dépassé |
| Fraude : faux membres ou tontines fictives pour obtenir du crédit | Moyenne | Fort | KYC 1 obligatoire, détection des tontines « circulaires » (mêmes membres, montants minimes), plafond selon l'ancienneté |
| Coûts opérateurs plus élevés que prévu | Élevée | Fort | Onglet Sensibilité ; renégociation ; transferts internes gratuits |
| Faille de sécurité | Faible | Critique | Test d'intrusion, PIN, secrets hors dépôt, sauvegardes chiffrées |
| Surendettement des clients | Moyenne | Réputationnel | Un seul crédit à la fois, plafond lié au score, messages de prévention, pas de relance commerciale après un retard |
| Changement réglementaire | Faible | Fort | Veille BCEAO, comité conformité trimestriel avec les partenaires |
