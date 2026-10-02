# 12. Point d'avancement — application et plateforme Smart Tontine

*Au 2 octobre 2026, mis à jour à la fin du Lot 4. Base : le dépôt du projet et les tests automatisés.*

## 12.1 En résumé

Le **produit est développé de bout en bout et fonctionne en démonstration**. Une tontine complète se déroule de la création au versement du pot, avec la caution, le crédit, les biens, les partenaires, le back-office et la vérification d'identité. Le produit tourne sur l'API, la plateforme web et l'application mobile.

**Le Lot 4 a branché le réel** : paiements CinetPay (dépôts et retraits), SMS Orange et Twilio, test d'intrusion interne et préparation des stores (voir [docs/13](13_lot4_integrations_reelles.md)).

**Il ne peut pas encore être ouvert au public.** Il manque surtout des démarches, pas du code :
- les **conventions** avec un établissement agréé BCEAO et un SFD ;
- les **contrats** CinetPay et Orange SMS ;
- les **comptes développeur** Apple et Google ;
- l'**hébergement** de production ;
- le **test d'intrusion externe**.

| Lot (cahier des charges) | Contenu | État |
|---|---|---|
| Lot 0 | Cadrage, maquettes, conventions (banque / EME, SFD, agrégateur) | Cadrage et design faits ; **conventions à signer** |
| Lot 1 | API cœur : comptes, grand livre, portefeuille, tontines, rappels | ✅ Terminé |
| Lot 2 | App mobile membres + site public | ✅ Terminé (testé en navigateur, pas encore sur téléphone réel) |
| Lot 3 | Crédit, biens, partenaires, portail partenaire web, back-office | ✅ Terminé |
| Lot 4 | Intégration réelle (paiement, SMS), sécurité, test d'intrusion, stores | ✅ Code terminé ([docs/13](13_lot4_integrations_reelles.md)) ; **test externe et publication à lancer** (comptes et contrats à ouvrir) |
| Lot 5 | USSD, langues locales, BIC, marque blanche | ⏳ Plus tard |

## 12.2 Ce qui est livré

| Bloc | Contenu | Où |
|---|---|---|
| **API** | Moteur de tontine (caution, tirage au sort, pot automatique, pénalités, clôture des tours échus), portefeuille, crédit (score, avance, microcrédit), biens et séquestre, partenaires, coffres de groupe, e-caisse, projets, challenges, contrats, CRM | `backend/` (8 migrations de base de données) |
| **Sécurité** | Grand livre en partie double contrôlé, PIN verrouillé après 5 erreurs, plafonds KYC, limitation de débit, **vérification d'identité**, **double authentification du back-office**, **paiements vérifiés serveur-à-serveur** + rattrapage, webhooks signés | API |
| **Plateforme web** | Site public, espace membre, portail partenaire ; mode sombre ; utilisable sur téléphone | `web/` |
| **App mobile** | Android et iPhone (Expo) : tous les parcours membres et l'espace partenaire, clavier PIN, vérification d'identité avec l'appareil photo | `mobile/` |
| **Back-office** | Tableau de bord, clients 360°, crédit, partenaires, demandes, KYC, support, campagnes, finance | `backend/public/admin` |
| **Design** | Système de design commun, icônes, contrastes conformes AA | `docs/11` |
| **Déploiement** | Docker Compose (API, worker, web), intégration continue, profils de build des stores | racine, `.github/`, `mobile/eas.json` |
| **Documentation** | Stratégie, modèle économique et financier, marketing, CRM, conformité, feuille de route, cahier des charges, architecture, design | `docs/00` à `docs/12` |
| **Vidéo** | Motion design de présentation (65 s, avec musique) | `motion/` |

**Qualité** :
- 70 tests de bout en bout sur l'API (dont 13 scénarios d'attaque) et 4 tests sur le web, tous au vert ;
- typage strict sur tout le code (≈ 10 700 lignes de TypeScript) ;
- parcours rejoués dans un navigateur sans erreur ;
- aucune page web ne déborde sur téléphone.

## 12.3 Ce qui reste avant l'ouverture au public

| # | Action | Type | Qui | Dépend de |
|---|---|---|---|---|
| 1 | Convention avec un établissement agréé BCEAO (cantonnement des fonds) | Juridique | Direction | — |
| 2 | Convention avec un SFD (crédit, licence) | Partenariat | Direction | — |
| 3 | Comptes marchands CinetPay (ou autre agrégateur) : encaissement **et** décaissement | Intégration | Direction + dev | 1 |
| 4 | ~~Brancher le décaissement (retraits)~~ ✅ fait (CinetPay v1) ; passer `PAYMENT_PROVIDER=cinetpay` après essais en bac à sable | Configuration | Dev | 3 |
| 5 | ~~Fournisseur SMS~~ ✅ fait (Orange + Twilio) ; contrat Orange SMS et nom d'expéditeur à obtenir | Contrat | Direction | — |
| 6 | Hébergement de production, nom de domaine, sauvegardes | Infra | Dev | — |
| 7 | Dépôt du code sur GitHub (le dépôt n'a pas encore de serveur distant : l'intégration continue n'a jamais tourné) | Infra | Dev | — |
| 8 | Stockage chiffré des photos KYC (aujourd'hui en base) | Code | Dev | 6 |
| 9 | Comptes Apple (D-U-N-S) et Google ; builds EAS ; essais sur vrais téléphones ; publication (visuels, fiches et formulaires prêts : [docs/15](15_publication_stores.md)) | Stores | Direction + dev | 6 |
| 10 | Test d'intrusion externe (test interne fait, cahier des charges prêt : [docs/14](14_test_intrusion.md)) | Sécurité | Prestataire | 6 |
| 11 | Textes juridiques (CGU, confidentialité, tontines de biens), déclaration CIL | Juridique | Juriste | 1 |
| 12 | Tests avec 5 à 10 utilisateurs réels (marché, association), puis bêta fermée de 50 membres | Produit | Équipe | 9 |

**Chemin critique** : les conventions (1, 2), puis l'agrégateur (3, 4), puis la production (6, 9), puis la bêta. Les tâches techniques 5 à 8 et 10 peuvent avancer en parallèle des démarches.

## 12.4 Points d'attention

- **Démonstration et réalité** : les intégrations CinetPay, Orange et Twilio suivent les API officielles et sont testées contre des serveurs simulés fidèles. Il reste à les rejouer en bac à sable, puis avec de petits montants réels. Prévoir 2 à 3 semaines après la signature des contrats.
- **Crédit et Google Play** : un prêt ne doit jamais être remboursé en totalité en 60 jours ou moins. Avances et microcrédit respectent désormais ce minimum de 61 jours.
- **Application mobile** : vérifiée dans sa version navigateur. L'appareil photo, le clavier PIN et les performances doivent être essayés sur un téléphone d'entrée de gamme.
- **Back-office** : fonctionnel mais au style d'origine. Une refonte est possible si l'équipe interne grandit.
- **Hors périmètre actuel** : USSD (téléphones simples), langues locales, mode sombre de l'app.
