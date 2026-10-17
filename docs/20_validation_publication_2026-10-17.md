# Smart Tontine — état de validation (17 octobre 2026)

## Changements de cette branche
- Référentiel des jetons Figma dans `design-system/figma-tokens.json` (référence documentaire, sans changement automatique des écrans).
- Script sans dépendance `node scripts/check-design-handoff.mjs` : vérification du format des couleurs, de l'espacement, de la typographie et de huit chemins structurants.
- CI GitHub Actions : ajout d'un job `design-handoff` et passage de Node.js 22 à 24 pour les jobs existants.

## Critères de validation avant fusion
1. Job `design-handoff` vert.
2. Job backend : `npm ci`, `npm run typecheck`, `npm test` verts.
3. Job web : `npm ci`, `npm test`, `npm run build` verts.
4. Job mobile : `npm ci`, `npx tsc --noEmit` verts.
5. Contrôle manuel des écrans, parcours clavier, appareils mobiles et états réseau.
6. Vérifications des flux financiers avec données de test, audit de sécurité et conformité avant déploiement réel.

## Limites
- Les jetons Figma sont une référence ; cette branche ne prétend pas réaliser la conversion intégrale des maquettes en composants.
- La présence de routes ne prouve pas leur fonctionnement.
- Aucun paiement réel ni déploiement de production n'est autorisé par ce document.
- Le statut de la CI est à consulter dans GitHub Actions après ouverture de la pull request.
