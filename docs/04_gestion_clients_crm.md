# 4. Système de gestion des clients (CRM)

Le CRM est intégré à la plateforme : **back-office web** (`/admin`, fichier `backend/public/admin/index.html`) branché sur l'API `/admin/api/*`. Pas d'outil tiers à payer au démarrage ; les données clients restent sur l'infrastructure SMARTFIN.

## 4.1 Rôles

| Rôle | Accès |
|---|---|
| `support` | Tableau de bord, fiches clients, notes, tickets, campagnes (lecture) |
| `admin` | Tout + modification KYC/statut, envoi de campagnes, contrôle du grand livre, rapprochement des retraits |
| `customer` | Application mobile uniquement |

Connexion au back-office par OTP SMS, comme l'app. Un compte est promu en SQL : `UPDATE users SET role = 'admin' WHERE phone = '+225…';`

## 4.2 Vue client 360°

La vue SQL `customer_overview` (migration `002_crm_views.sql`) calcule pour chaque client : solde portefeuille, épargne bloquée, patrimoine SMARTFIN, nombre et total des dépôts, **revenu généré**, filleuls, canal d'acquisition et **segment**.

La fiche client du back-office affiche : indicateurs, produits détenus (e-caisses, cagnottes, projets, contrats), 30 dernières transactions, tickets, **notes CRM** de l'équipe, parcours (événements analytiques : inscription, dépôt, création de produits…), et les actions KYC / suspension.

## 4.3 Segmentation automatique

| Segment | Règle | Action type |
|---|---|---|
| `nouveau` | Inscrit depuis < 14 jours, aucun dépôt | Onboarding, relance J+3 |
| `sans_depot` | Inscrit depuis ≥ 14 jours, aucun dépôt | Relance, appel ambassadeur |
| `actif` | A déjà déposé, actif dans les 30 jours | Proposer un 1er produit d'épargne |
| `epargnant` | Épargne bloquée > 0 | SMARTFIN+, parrainage |
| `dormant` | Aucune activité depuis 30 jours | Réactivation, nouveau challenge |
| `vip` | Patrimoine SMARTFIN ≥ 500 000 F | Relation personnalisée, KYC niveau 2 |

## 4.4 Cycle de vie client

```
Inscription (OTP) ─► 1er dépôt ─► 1er produit d'épargne ─► habitude mensuelle ─► SMARTFIN+ / parrain
      │                  │                   │                        │
   J+3 relance       notification        challenge suggéré       dormant > 30 j ─► réactivation
```

Chaque étape est tracée dans `user_events` (`signup`, `deposit_completed`, `ecaisse_created`, `cagnotte_created`, `challenge_joined`, `plus_subscribed`…), ce qui permet de mesurer l'entonnoir et les cohortes.

## 4.5 Service client

| Canal | Outil | Délai cible |
|---|---|---|
| In-app | Tickets (`/me/support/tickets`), réponses depuis le back-office, notification au client | < 24 h |
| WhatsApp | +225 07 48 55 32 68 (WhatsApp Business ; ticket créé par l'agent avec canal `whatsapp`) | < 2 h ouvrées |
| E-mail | contact@smartfin.app | < 24 h |

**Scripts prioritaires** (à préparer dans la base de connaissances) : dépôt non crédité, retrait en attente, code PIN oublié, contestation d'un retrait de cagnotte, relèvement de plafond (KYC).

**Incidents d'argent** : tout retrait dont l'issue opérateur est inconnue apparaît dans *Finance → Retraits à rapprocher* ; l'admin confirme ou rembourse en un clic (écriture d'annulation tracée dans le grand livre).

## 4.6 KYC progressif et plafonds

| Niveau | Exigences | Solde max | Entrées / mois |
|---|---|---:|---:|
| 0 | Numéro de téléphone vérifié (OTP) | 200 000 F | 500 000 F |
| 1 | Pièce d'identité + selfie | 2 000 000 F | 5 000 000 F |
| 2 | Justificatif de domicile / revenus | 10 000 000 F | 20 000 000 F |

Plafonds paramétrés dans `pricing.ts`. L'API applique aujourd'hui le plafond de **solde** au moment du dépôt ; le plafond d'**entrées mensuelles** reste à implémenter. Valeurs **à aligner sur les exigences de la banque/EME partenaire et de la BCEAO** avant le lancement.

## 4.7 Indicateurs CRM suivis

Nombre de clients, nouveaux 7/30 jours, actifs 30 jours (MAU), encours, dépôts 30 jours, revenus 30 jours, abonnés SMARTFIN+, tickets ouverts, répartition par segment et par canal, produits actifs, courbes quotidiennes d'inscriptions et de dépôts.

## 4.8 Évolutions prévues

- Envoi réel des campagnes SMS / WhatsApp (Orange SMS API, WhatsApp Business API) et e-mail (Resend) — aujourd'hui le canal `push` est livré, les autres enregistrent la cible.
- Notifications push natives (Expo Notifications).
- Score de santé financière client (régularité d'épargne, contrats remboursés) → base des offres partenaires.
- Export des cohortes vers un outil BI (Metabase sur une réplique en lecture de PostgreSQL).
