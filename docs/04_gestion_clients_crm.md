# 4. Système de gestion des clients (CRM)

Le CRM est intégré à la plateforme : **back-office web** (`/admin`, fichier `backend/public/admin/index.html`) branché sur l'API `/admin/api/*`. Pas d'outil tiers à payer au démarrage ; les données clients restent sur l'infrastructure Smart Tontine.

## 4.1 Rôles

| Rôle | Accès |
|---|---|
| `support` | Tableau de bord, fiches clients, notes, tickets, campagnes (lecture) |
| `admin` | Tout + modification KYC/statut, envoi de campagnes, contrôle du grand livre, rapprochement des retraits |
| `customer` | Application mobile uniquement |

Connexion au back-office par OTP SMS, comme l'app. Un compte est promu en SQL : `UPDATE users SET role = 'admin' WHERE phone = '+226…';`

## 4.2 Vue client 360°

La vue SQL `customer_overview` (migration `002_crm_views.sql`) calcule pour chaque client : solde portefeuille, épargne bloquée, patrimoine Smart Tontine, nombre et total des dépôts, **revenu généré**, filleuls, canal d'acquisition et **segment**.

La fiche client du back-office affiche : indicateurs, produits détenus (e-caisses, cagnottes, projets, contrats), 30 dernières transactions, tickets, **notes CRM** de l'équipe, parcours (événements analytiques : inscription, dépôt, création de produits…), et les actions KYC / suspension.

## 4.3 Onglet « Tontines & crédit »

- **Tontines** : en cours, en recrutement et terminées ; membres engagés ; cotisations collectées ; impayés couverts par caution ; cotisations en retard ; **tours échus non versés**.
- **Portefeuille de crédit** : encours, dont avances ; **PAR30** (encours avec plus de 30 jours de retard, alerte au-delà de 5 %) ; défauts ; taux de remboursement à l'heure ; total décaissé ; intérêts reversés au SFD.
- **Liste des crédits** avec reste dû, prochaine échéance et score à l'octroi.
- La **fiche client** affiche le score Smart Tontine et le détail de ses facteurs, les tontines (position, statut, caution) et les crédits.

## 4.4 Recouvrement (processus automatisé + humain)

| Jour | Action | Canal |
|---|---|---|
| J-1 | Rappel d'échéance (cotisation ou crédit) | Notification app / SMS |
| J0 | **Prélèvement automatique** du crédit si le jeton est suffisamment approvisionné | Automatique (job) |
| J+3 | Pénalité (2 % crédit ; 5 % cotisation, au profit du bénéficiaire) ; **tour de tontine clôturé, caution mobilisée** | Automatique + notification |
| J+7 | Appel du conseiller, solution amiable (report, rééchelonnement avec le SFD) | Téléphone / WhatsApp |
| J+30 | Entrée dans le PAR30 ; organisateur de tontine informé si le client est membre | Back-office |
| J+90 | **Défaut** : score ramené à 0, crédit bloqué, dossier transmis au SFD (et au BIC selon la convention) | Back-office |

Déjà automatisé dans l'API (job horaire) : **rappels J-1 et J0** (notification + SMS, envoyés une seule fois), prélèvement à J0, pénalités et clôture des tours à J+3, passage en défaut à J+90. **À mettre en place** : outil d'appel des conseillers, rééchelonnement.

Principes : pas de harcèlement, pas de publication du nom d'un défaillant hors de sa tontine, rééchelonnement proposé avant le défaut.

## 4.5 Segmentation automatique

| Segment | Règle | Action type |
|---|---|---|
| `nouveau` | Inscrit depuis < 14 jours, aucun dépôt | Onboarding, relance J+3 |
| `sans_depot` | Inscrit depuis ≥ 14 jours, aucun dépôt | Relance, appel ambassadeur |
| `actif` | A déjà déposé, actif dans les 30 jours | Proposer un 1er produit d'épargne |
| `epargnant` | Épargne bloquée > 0 | Smart Tontine+, parrainage |
| `dormant` | Aucune activité depuis 30 jours | Réactivation, nouveau challenge |
| `vip` | Patrimoine Smart Tontine ≥ 500 000 F | Relation personnalisée, KYC niveau 2 |

## 4.6 Cycle de vie client

```
Inscription ─► 1er dépôt ─► rejoint une tontine ─► cotise à l'heure ─► score ≥ 550 ─► avance / microcrédit ─► organisateur / parrain
     │              │                │                    │                                     │
 J+3 relance   notification     rappels J-1         score visible                     remboursement → score ↑
```

Chaque étape est tracée dans `user_events` (`signup`, `deposit_completed`, `tontine_created`, `tontine_joined`, `tontine_contribution`, `tontine_payout`, `advance_granted`, `microcredit_granted`, `ecaisse_created`, `plus_subscribed`…), ce qui permet de mesurer l'entonnoir et les cohortes.

## 4.7 Service client

| Canal | Outil | Délai cible |
|---|---|---|
| In-app | Tickets (`/me/support/tickets`), réponses depuis le back-office, notification au client | < 24 h |
| WhatsApp | numéro WhatsApp Business burkinabè à ouvrir (le numéro de l'affiche, +225 07 48 55 32 68, est ivoirien) ; ticket créé par l'agent avec canal `whatsapp` | < 2 h ouvrées |
| E-mail | contact@smarttontine.app | < 24 h |

**Scripts prioritaires** (à préparer dans la base de connaissances) : dépôt non crédité, cotisation non prise en compte, contestation de l'ordre de passage, caution mobilisée, refus de crédit (expliquer le score), difficulté de remboursement, code PIN oublié, relèvement de plafond (KYC).

**Incidents d'argent** : tout retrait dont l'issue opérateur est inconnue apparaît dans *Finance → Retraits à rapprocher* ; l'admin confirme ou rembourse en un clic (écriture d'annulation tracée dans le grand livre).

## 4.8 KYC progressif et plafonds

| Niveau | Exigences | Solde max | Entrées / mois |
|---|---|---:|---:|
| 0 | Numéro de téléphone vérifié (OTP) | 200 000 F | 500 000 F |
| 1 | Pièce d'identité + selfie | 2 000 000 F | 5 000 000 F |
| 2 | Justificatif de domicile / revenus | 10 000 000 F | 20 000 000 F |

Plafonds paramétrés dans `pricing.ts`. L'API applique aujourd'hui le plafond de **solde** au moment du dépôt ; le plafond d'**entrées mensuelles** reste à implémenter. Valeurs **à aligner sur les exigences de la banque/EME partenaire et de la BCEAO** avant le lancement.

## 4.9 Indicateurs CRM suivis

Nombre de clients, nouveaux 7/30 jours, actifs 30 jours (MAU), encours, dépôts 30 jours, revenus 30 jours, abonnés Smart Tontine+, tickets ouverts, répartition par segment et par canal, produits actifs, courbes quotidiennes d'inscriptions et de dépôts.

## 4.10 Évolutions prévues

- Envoi réel des campagnes SMS / WhatsApp (Orange SMS API, WhatsApp Business API) et e-mail (Resend) — aujourd'hui le canal `push` est livré, les autres enregistrent la cible.
- Notifications push natives (Expo Notifications).
- Consultation et alimentation du **bureau d'information sur le crédit (BIC)** via le SFD partenaire.
- Proposition automatique de rééchelonnement au premier retard.
- Export des cohortes vers un outil BI (Metabase sur une réplique en lecture de PostgreSQL).
