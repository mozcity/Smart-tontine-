# Smart Tontine — Matrice de validation UI multi-plateforme

Date : 2026-10-17. État : **en cours**, non validé pour la production.

## Sources vérifiées
- `mobile/src/app` (Expo Router), `mobile/src/components/ui.tsx`
- `web/src/pages` (public, app, partner), `web/src/styles.css`
- `docker-compose.yml`, `design-system/figma-tokens.json`
- Figma : https://www.figma.com/design/kguC4oAtePuRBUuqtWIuM8

## Couverture des écrans Figma
- 20 cadres mobiles métier créés dans la page « 02 — Official Brand & Product Screens ».
- 28 cadres web métier créés dans la page « 03 — Web Dashboards & Site ».
- Les cadres sont **éditables**, mais ne constituent pas des interfaces finales ni des prototypes fonctionnels.
- À compléter : champs exacts, navigation réelle, actions, responsive, accessibilité, états chargement/vide/erreur/succès, permissions, validations métier, contrôles de sécurité.

## Règles de cohérence
1. Les couleurs de marque sont synchronisées sur `#3029D1` (indigo), `#59DE17` (vert vif décoratif), `#F5F7FA` (fond), `#121729` (texte). Les boutons verts utilisent une variante foncée à contraste renforcé (`#278326`) ; ne pas utiliser le vert vif avec texte blanc sans test WCAG.
2. Les valeurs d'argent doivent toujours utiliser le même format FCFA et les mêmes montants issus de l'API. Ne jamais simuler un paiement confirmé en production.
3. États UI requis pour chaque route : initial, chargement, vide, erreur réseau, succès, accès refusé, session expirée, formulaire invalide.
4. Les confirmations de dépôt/retrait/transfert doivent afficher le canal, les frais, le bénéficiaire, la référence et le statut réel de la transaction.
5. Les données sensibles doivent être protégées ; les rôles partenaire et membre ne doivent pas exposer des données d'autres comptes.

## Matrice de recette par périmètre

| Périmètre | Écrans à recetter | Tests essentiels | Statut |
|---|---|---|---|
| Mobile / connexion | téléphone, OTP, identité | saisie, délai, erreurs, expiration, navigation | À faire |
| Mobile / argent | accueil, portefeuille, dépôt, retrait, transfert, historique | format FCFA, double soumission, frais, statuts, erreurs | À faire |
| Mobile / tontines | liste, découverte, code, création, détail, paiement | validation, rôles, cotisation, calendrier | À faire |
| Mobile / épargne | coffres, e-caisse, projets | soldes, verrouillage, validations | À faire |
| Mobile / autres | biens, challenges, contrats, crédit, support, profil, suppression | états, autorisations, navigation | À faire |
| Web public | accueil, tarifs, découverte, partenaires, connexion, légal | responsive, liens, accessibilité, formulaires | À faire |
| Web membre | accueil, tontines, portefeuille, coffres, crédit, biens, identité, profil | cohérence API, erreurs, autorisations | À faire |
| Web partenaire | dashboard, groupes, membres, catalogue, commandes, finances, équipe, paramètres | RBAC, données, export, workflow | À faire |
| Docker | PostgreSQL, API, worker, web, mobile web, sauvegardes | démarrage, santé, migrations, secrets, persistance | À faire |

## Portes de validation

- [ ] Audit sécurité : aucune vulnérabilité critique/élevée non traitée, justification documentée des exceptions éventuelles.
- [ ] CI backend : tests et typecheck verts avec PostgreSQL.
- [ ] CI web : tests et build verts.
- [ ] CI mobile : typecheck vert et vérification Expo sur appareils réels.
- [ ] Recette fonctionnelle écran par écran sur mobile, desktop et tablette.
- [ ] Vérification WCAG des contrastes, focus, lecteurs d'écran et tailles de cibles.
- [ ] Vérification des droits d'accès et des opérations financières en environnement de test.
- [ ] Validation du démarrage Docker et de la sauvegarde/restauration.
- [ ] Validation visuelle finale Figma ↔ implémentation.
- [ ] Validation explicite avant fusion vers `main` et déploiement.

## Travaux en cours

Le workflow `safe-dependency-fix.yml` a été corrigé pour démarrer PostgreSQL pendant les tests backend. Les palettes Web et mobile ont été rapprochées des valeurs de référence Figma. Les résultats de la CI et les tests manuels restent nécessaires pour valider ces changements.
