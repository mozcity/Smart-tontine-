# 0. Références : Maman Tontine et MaTontine (Sénégal)

Smart Tontine s'inspire de deux applications sénégalaises. Elles ne font pas la même chose :

| | **Maman Tontine** | **MaTontine** |
|---|---|---|
| Éditeur | IMCO Digital (Dakar) | MaTontine (Dakar, créée en 2015) |
| Positionnement | « La tontine digitale simple et transparente » : outil de gestion de tontines, coffres et cotisations de groupe | « Plateforme de services financiers numériques » pour les femmes exclues du système financier : groupes d'épargne → crédit et assurance |
| Produits | Tontines (création, adhésion, poursuite d'une tontine existante), **coffre personnel**, **coffres de groupe** (calebasse, famille, fonds communautaire), cotisations d'associations, **dahiras**, mosquées, églises, ASC, GIE, entités publiques | Digitalisation des tontines, **petits prêts via des institutions de microfinance partenaires**, **micro-assurance** (vie), score de crédit et identité numérique |
| Fonctions clés | Suivi en temps réel (qui a payé, qui doit payer, prochain tour) · **rappels automatiques** · invitation par **lien, WhatsApp, QR code ou code** · tirage **aléatoire ou manuel** · statut **« Partielle »** pour une cotisation incomplète | Accès par **SMS** pour les téléphones simples · **agents de terrain** pour l'inscription · partenariats opérateurs |
| Paiements | Wave, Orange Money (MAXIT), paiement depuis le portefeuille de l'app | Mobile Money (opérateurs partenaires) |
| Partenaires affichés | Wave, Orange Money, FBNBank | COFINA Sénégal (IMF), opérateurs télécoms ; programme WSBI Scale2Save ; déploiement en Gambie avec Afrimoney et l'UNCDF |
| Tarif | **1 % de frais de plateforme** | Non publié |
| Traction publiée | « 30K+ utilisateurs » (site), 10 000+ téléchargements (Google Play) | Pilote COFINA : 1 200 clientes, **570+ petits prêts**, ≈ 30 500 $ d'épargne collectée |

Sources consultées le 27/09/2026 : mamantontine.com ; fiche Google Play `imco.digital.mamantontine` ; matontine.com ; Amarante Consulting, « MaTontine: Digitizing traditional savings groups » ; WSBI, « Senegal: Mobile banking for the tontines » (COFINA × MaTontine) ; UNCDF, « Digitalizing informal women's savings groups in The Gambia ». Chiffres déclarés par les entreprises, non audités.

## 0.1 Ce que Smart Tontine reprend

| Idée | Source | Dans Smart Tontine |
|---|---|---|
| Tontine rotative avec suivi en temps réel et tirage aléatoire ou manuel | Maman Tontine | ✅ Tontine rotative, tirage cryptographique ou ordre fixé, calendrier des tours |
| Rappels automatiques avant chaque échéance | Maman Tontine | ✅ Rappels J-1 et J0 (notification + SMS), envoyés une seule fois |
| Invitation par lien, WhatsApp, QR code ou code | Maman Tontine | ✅ QR code, partage WhatsApp, lien `smarttontine://rejoindre/…`, saisie du code |
| Coffres de groupe pour associations, dahiras, lieux de culte, familles, GIE, ASC | Maman Tontine | ✅ Coffres de groupe par catégorie, publics (rejoints par code) ou privés |
| Suivi des cotisations mois par mois, statut « partiel » | Maman Tontine | ✅ Tableau payé / partiel / impayé par membre et par période |
| Coffre personnel | Maman Tontine | ✅ E-caisse (épargne bloquée) et Projets |
| Frais de 1 % | Maman Tontine | ✅ Commission de 1 % sur chaque pot versé |
| Historique de tontine → score → crédit via une IMF partenaire | MaTontine | ✅ Score Smart Tontine, avance sur tontine, microcrédit financé par un SFD partenaire |
| Micro-assurance pour les membres | MaTontine | 🔜 Feuille de route (T4) |
| Accès sans smartphone (SMS/USSD) et agents de terrain | MaTontine | 🔜 Feuille de route (année 2) ; organisateurs et ambassadeurs au lancement |

## 0.2 Ce qui différencie Smart Tontine

1. **La tontine protégée**. Maman Tontine montre qui a payé ; Smart Tontine va plus loin. Une caution est bloquée à l'adhésion et mobilisée automatiquement en cas d'impayé, puis reconstituée sur le pot du défaillant : le bénéficiaire reçoit toujours son pot complet.
2. **La tontine qui ouvre le crédit, dans la même application**. Chez MaTontine, le crédit passe par l'IMF partenaire. Chez Smart Tontine, il est intégré à l'app : le score est visible et expliqué, l'**avance sur tontine** est remboursée automatiquement sur le pot, et le microcrédit est prélevé sur le jeton.
3. **Au-delà de la tontine** : e-caisse, budget, challenges, contrats entre proches. L'argent reste et travaille dans l'écosystème.

## 0.3 Le point de vigilance révélé par la comparaison : le prix du retrait

Chez Maman Tontine, le tour est reçu directement sur Wave ou Orange Money pour **1 % au total**. Copier ce prix est tentant, mais le modèle économique montre que c'est **le modèle A « commission seule »**, et qu'**il perd de l'argent au Burkina** : il ne passe jamais à l'EBITDA positif et demanderait 1,7 Md F de financement (chapitre 1.2). En cause : les frais Mobile Money d'entrée et de sortie dépassent la commission de 1 %.

**Choix retenu pour Smart Tontine (modèle G)** :
- **1 % sur le pot**, aligné sur le marché, et **1 % sur les retraits** vers Mobile Money ;
- retrait du pot **offert aux abonnés Smart Tontine+** (500 F/mois, 3 retraits offerts par mois) ;
- la vraie différence de coût vient des **SFD partenaires** : cotisations prélevées sur le compte d'épargne, sans frais opérateur.

## 0.4 Enseignements de MaTontine × COFINA

Le retour d'expérience publié par le WSBI sur le partenariat COFINA × MaTontine est directement utile pour le partenariat SFD de Smart Tontine :
- **Le partenariat fintech–IMF est long** : il demande d'aligner les processus, une communication fluide, une vraie gestion de projet et une IMF capable de décider vite. → Signer une convention précise (chapitre 6.1) et prévoir 3 à 6 mois d'intégration.
- **Changement culturel côté IMF** : une institution tournée vers le crédit doit s'intéresser à la petite épargne. → Choisir un SFD qui a déjà une offre d'épargne et une cible femmes et commerçants.
- **L'appétit d'épargne est fort, mais peu passe par les institutions** : c'est exactement l'espace que la tontine numérique occupe.

## 0.5 Marché : Burkina Faso d'abord, puis la sous-région

Smart Tontine se lance au **Burkina Faso**, où aucun acteur de la tontine numérique n'a été identifié comme dominant (à cartographier finement pendant le pilote). L'expansion suit le calendrier du chapitre 2 : Côte d'Ivoire en 2029 (forte diaspora burkinabè), Mali en 2030, Niger et Sénégal en 2031, Bénin et Togo ensuite. Au Sénégal, Maman Tontine et MaTontine sont déjà installées : c'est pourquoi ce pays arrive tard, avec un coefficient de marché réduit.

| | Burkina Faso (lancement) | Sénégal (expansion 2031) |
|---|---|---|
| Mobile Money | Orange Money, Moov Money, Wave (via UBA et Orabank, liste BCEAO), Sank Money | Wave, Orange Money / MAXIT, Free Money (vérifier l'offre actuelle) |
| Indicatif (déjà accepté par l'API) | +226 | +221 |
| Données personnelles | CIL (Commission de l'informatique et des libertés) | CDP (Commission de protection des données personnelles) |
| Microfinance | Loi uniforme de 2025 sur la microfinance ; ministère chargé des Finances et Commission bancaire de l'UMOA | SFD agréés, supervision du ministère des Finances et de la BCEAO |
| Groupes cibles | Tontines de marché, groupements de femmes, associations, GIE, SFD | Dahiras, GIE de femmes, ASC, associations de quartier |
| Concurrence tontine numérique | À cartographier pendant le pilote | Maman Tontine, MaTontine, applications panafricaines |
