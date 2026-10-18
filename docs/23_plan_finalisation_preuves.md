# Smart Tontine — Plan de finalisation et preuves

Date : 2026-10-18. Branche de recette : `chore/smart-tontine-validation-20261017`.
**Ne pas assimiler un contrôle automatisé à une validation de production.**

## Rubriques contrôlées

| Rubrique | État vérifié | Preuve / limite |
|---|---|---|
| Inventaire des 48 écrans Figma | **Validé pour la présence** | 20 cadres mobiles page 02, 28 cadres Web page 03 |
| Liens prototype Figma | **Validé pour la présence** | 20 liens mobiles et 28 liens Web inspectés dans Figma |
| Palette de référence | **Synchronisée** | 60 remplissages mobiles et 168 remplissages Web corrigés ; `design-system/figma-tokens.json` et UI code |
| Prototype HTML interactif | **Créé** | `prototypes/smart-tontine-interactif.html` ; 4 espaces et 48 écrans |
| Tests navigateurs du prototype | **Validés** | Workflow `Prototype browser and accessibility QA`, run [39082306997](https://github.com/mozcity/Smart-tontine-/actions/runs/39082306997) : réussite |
| Responsive du prototype | **Validé sur deux largeurs** | Script Playwright visite les 48 écrans à 390 et 1280 px et vérifie l'absence de débordement horizontal |
| Accessibilité automatisée du prototype | **Validée sur les pages inspectées** | axe-core WCAG 2/2.1 A/AA exécuté pour 4 espaces × 2 largeurs ; pas un audit manuel ni des apps réelles |
| Formulaires du prototype | **Contrôles de démonstration réussis** | Saisie obligatoire et navigation ; aucune transaction réelle |
| Tests Docker d'intégration | **Validés (smoke)** | [39080833123](https://github.com/mozcity/Smart-tontine-/actions/runs/39080833123) : build, services, health API, HTTP web et mobile web, conteneur backup |
| Tests CI backend, web, mobile, handoff | **Réussis sur un run précédent** | [39081634078](https://github.com/mozcity/Smart-tontine-/actions/runs/39081634078) : ces quatre jobs réussis, CI globale échouée |
| Audits de dépendances | **Bloqués** | Backend, Web et mobile échouent sur le même run ; ne pas déployer |
| Comparaison visuelle pixel à pixel | **À faire** | Captures des applications réelles et image de référence |
| Prototype Figma complet | **Partiel** | Liens existants, mais pas de logique complète de formulaires et de transitions d'états |
| Tests manuels d'accessibilité | **À faire** | VoiceOver/TalkBack, clavier, focus, cibles tactiles, contraste de tous les textes |
| Parcours financiers de bout en bout | **À faire** | Double soumission, frais, confirmation réelle, remboursements, RBAC et états réseau |
| Sauvegarde/restauration Docker | **À faire** | Smoke test vérifie le démarrage du conteneur, pas une restauration vérifiée |
| Déploiement de production | **Non autorisé** | Audits sécurité non verts et recette incomplète |

## Portes restantes avant coche définitive

- [x] Présence des 48 cadres Figma et 48 liens de navigation.
- [x] Harmonisation de la palette de référence sur les cadres et tokens.
- [x] Prototype HTML, tests navigateur sur 390/1280 px, contrôle axe-core automatisé.
- [x] Docker Compose : build et smoke test en CI.
- [ ] Vérifier la conformité pixel par pixel des écrans mobiles et Web réellement rendus.
- [ ] Valider tous les états : chargement, vide, erreur, succès, expiration, hors connexion, droits insuffisants.
- [ ] Valider les parcours complets Figma, mobile et Web sur appareils/navigateurs cibles.
- [ ] Corriger les vulnérabilités élevées/critiques et obtenir les audits verts.
- [ ] Exécuter les tests de paiement en environnement de test (idempotence, statuts, journalisation).
- [ ] Vérifier les sauvegardes par restauration et les secrets de production.
- [ ] Effectuer la recette d'accessibilité manuelle.
- [ ] Approuver la fusion PR #1 et le déploiement seulement après preuves.

## Périmètre du prototype

Le prototype HTML est un outil de revue UX sans données privées ni accès aux systèmes financiers. Son succès **ne démontre pas** que les composants React Native et React Web sont visuellement identiques ni que l'API financière fonctionne dans tous les cas.

## Suite prioritaire

1. Sécurité des dépendances (CI globale rouge).
2. Captures réelles et comparaison visuelle avec la référence 390×844.
3. Tests E2E financiers et permissions en staging.
4. Recette manuelle et restauration Docker.
