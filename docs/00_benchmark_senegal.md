# 0. Références : Maman Tontine et MaTontine (Sénégal)

SMARTFIN s'inspire de deux applications sénégalaises. Elles ne font pas la même chose :

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

## 0.1 Ce que SMARTFIN reprend

| Idée | Source | Dans SMARTFIN |
|---|---|---|
| Tontine rotative avec suivi en temps réel et tirage aléatoire ou manuel | Maman Tontine | ✅ Tontine rotative, tirage cryptographique ou ordre fixé, calendrier des tours |
| Rappels automatiques avant chaque échéance | Maman Tontine | ✅ Rappels J-1 et J0 (notification + SMS), envoyés une seule fois |
| Invitation par lien, WhatsApp, QR code ou code | Maman Tontine | ✅ QR code, partage WhatsApp, lien `smartfin://rejoindre/…`, saisie du code |
| Coffres de groupe pour associations, dahiras, lieux de culte, familles, GIE, ASC | Maman Tontine | ✅ Coffres de groupe par catégorie, publics (rejoints par code) ou privés |
| Suivi des cotisations mois par mois, statut « partiel » | Maman Tontine | ✅ Tableau payé / partiel / impayé par membre et par période |
| Coffre personnel | Maman Tontine | ✅ E-caisse (épargne bloquée) et Projets |
| Frais de 1 % | Maman Tontine | ✅ Commission de 1 % sur chaque pot versé |
| Historique de tontine → score → crédit via une IMF partenaire | MaTontine | ✅ Score SMARTFIN, avance sur tontine, microcrédit financé par un SFD partenaire |
| Micro-assurance pour les membres | MaTontine | 🔜 Feuille de route (T4) |
| Accès sans smartphone (SMS/USSD) et agents de terrain | MaTontine | 🔜 Feuille de route (année 2) ; organisateurs et ambassadeurs au lancement |

## 0.2 Ce qui différencie SMARTFIN

1. **La tontine protégée**. Maman Tontine montre qui a payé ; SMARTFIN va plus loin. Une caution est bloquée à l'adhésion et mobilisée automatiquement en cas d'impayé, puis reconstituée sur le pot du défaillant : le bénéficiaire reçoit toujours son pot complet.
2. **La tontine qui ouvre le crédit, dans la même application**. Chez MaTontine, le crédit passe par l'IMF partenaire. Chez SMARTFIN, il est intégré à l'app : le score est visible et expliqué, l'**avance sur tontine** est remboursée automatiquement sur le pot, et le microcrédit est prélevé sur le jeton.
3. **Au-delà de la tontine** : e-caisse, budget, challenges, contrats entre proches. L'argent reste et travaille dans l'écosystème.

## 0.3 Le point de vigilance révélé par la comparaison : le prix du retrait

Chez Maman Tontine, le tour est reçu directement sur Wave ou Orange Money pour **1 % au total**. Chez SMARTFIN, le pot arrive sur le jeton (1 %), puis le retrait vers Mobile Money coûte **1,5 %**, soit jusqu'à **2,5 %** si le membre retire tout son pot. Un client qui compare le verra.

Le modèle financier contient un levier pour chiffrer l'alignement (*Hypothèses → « Part des pots retirés vers Mobile Money SANS frais de retrait »*) :

| Scénario | CA 2029 | EBITDA 2031 | Année d'équilibre | Besoin de financement |
|---|---:|---:|---|---:|
| Tarif actuel (retrait du pot à 1,5 %) | 484 M F | +407 M F | 2031 | 824 M F |
| 50 % des pots retirés sans frais | 380 M F | −90 M F | après 2031 | 1 306 M F |
| 100 % des pots retirés sans frais | 357 M F | −167 M F | après 2031 | 1 455 M F |

**Recommandation** : ne pas copier le « 1 % tout compris » sans avoir négocié les frais de décaissement. Préférer :
- retrait du pot **offert aux abonnés SMARTFIN+** (déjà 3 retraits offerts par mois) : c'est un argument d'abonnement ;
- mettre en avant ce qui garde l'argent dans l'app : **pot versé instantanément sur le jeton**, cotisation du tour suivant payée depuis le jeton, avance et crédit ;
- rouvrir la question dès que les contrats opérateurs sont signés : avec un décaissement < 0,5 %, un retrait du pot à 0,5 % redevient finançable.

## 0.4 Enseignements de MaTontine × COFINA

Le retour d'expérience publié par le WSBI sur le partenariat COFINA × MaTontine est directement utile pour le partenariat SFD de SMARTFIN :
- **Le partenariat fintech–IMF est long** : il demande d'aligner les processus, une communication fluide, une vraie gestion de projet et une IMF capable de décider vite. → Signer une convention précise (chapitre 6.1) et prévoir 3 à 6 mois d'intégration.
- **Changement culturel côté IMF** : une institution tournée vers le crédit doit s'intéresser à la petite épargne. → Choisir un SFD qui a déjà une offre d'épargne et une cible femmes et commerçants.
- **L'appétit d'épargne est fort, mais peu passe par les institutions** : c'est exactement l'espace que la tontine numérique occupe.

## 0.5 Marché : Côte d'Ivoire d'abord, Sénégal ensuite

L'affiche SMARTFIN (numéro +225) vise la **Côte d'Ivoire**, où la place de « Maman Tontine ivoirienne » est à prendre. Le Sénégal est le **premier pays d'expansion** naturel : même monnaie (XOF), même cadre BCEAO, usages de tontine et de dahira très répandus. Mais la concurrence y est déjà installée.

| | Côte d'Ivoire (lancement) | Sénégal (expansion) |
|---|---|---|
| Mobile Money | Wave, Orange Money, MTN MoMo, Moov Money | Wave, Orange Money / MAXIT, Free Money (vérifier l'offre actuelle de l'opérateur) |
| Indicatif (déjà accepté par l'API) | +225 | +221 |
| Données personnelles | ARTCI | CDP (Commission de protection des données personnelles) |
| Microfinance | SFD agréés, supervision BCEAO et ministère des Finances | SFD agréés, supervision BCEAO et ministère des Finances (DRS-SFD) |
| Groupes cibles | Tontines de marché, collègues, associations | Dahiras, GIE de femmes, ASC, associations de quartier |
| Concurrence tontine numérique | À cartographier | Maman Tontine, MaTontine, applications panafricaines |

Si le lancement doit se faire **au Sénégal** plutôt qu'en Côte d'Ivoire, la plateforme est prête techniquement (XOF, +221, Wave et Orange Money). Il faudrait adapter le chapitre 6 (autorités sénégalaises), le chapitre 3 (canaux : dahiras, GIE) et les hypothèses de marché du modèle financier.
