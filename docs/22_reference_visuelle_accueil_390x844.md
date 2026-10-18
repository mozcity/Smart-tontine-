# Référence visuelle officielle — Accueil mobile Smart Tontine

## Source et priorité
Capture fournie dans la conversation, dimensions **390 × 844 px**. L'image fait autorité pour le rendu de l'accueil mobile, devant les anciens tokens indigo vif.

## Couleurs observées sur des zones pleines
- Indigo de la carte « Mon jeton » et de l'avatar : `#2F2C8F`
- Fond de l'application : `#F6F7FB`
- Texte principal : `#15162C`
- Bouton « Payer » : `#278326`
- Cartes : `#FFFFFF`
- Anneau décoratif : vert translucide, ne pas utiliser comme couleur de texte

## Ordre visuel de l'écran
1. En-tête : avatar rond, « Bonjour 👋 », prénom, bouton cloche.
2. Carte « Mon jeton » : visibilité, solde, épargne bloquée, Déposer / Retirer / Envoyer.
3. Grille 4 colonnes × 2 lignes : Tontines, Biens, Coffres, E-caisse, Projets, Challenges, Contrats, Historique.
4. Bloc « À payer » : tontine, tour, délai, montant et action « Payer ».
5. Deux cartes : « Mon score » (anneau) et « Mon prochain pot ».
6. Section « Mes tontines » et lien « Tout voir ».
7. Barre d'onglets fixe : Accueil, Tontines, Crédit, Budget, Profil.

## Confrontation avec le code
- Le fichier `mobile/src/app/(tabs)/index.tsx` contient bien l'en-tête, la carte solde, les 8 raccourcis, les cotisations, les 2 cartes de statistiques et les tontines.
- Les données réelles sont issues des appels API : **ne pas figer** le prénom « Aminata », le montant 226 900 FCFA, le score 415 ni les montants affichés sur la capture.
- La palette `mobile/src/components/ui.tsx` et `web/src/styles.css` a été rétablie pour correspondre à la capture.
- `scripts/check-design-handoff.mjs` empêche les régressions sur les tokens de référence, les libellés et trois contrastes texte/fond.

## Réserves avant validation visuelle complète
- Une conformité pixel par pixel requiert une capture **produite par l'application** sur un appareil 390 × 844 avec un jeu de données de démonstration comparable, puis une comparaison visuelle.
- Les hauteurs de barre de statut, polices et safe areas varient selon iOS/Android ; ne pas imposer les coordonnées absolues de la capture sur toutes les tailles.
- Les cibles tactiles, le lecteur d'écran, les contrastes de tous les textes secondaires, les états vides/erreur et les actions réelles nécessitent une recette complémentaire.
- Le bouton cloche dirige actuellement vers le profil ; vérifier la destination métier attendue.
- Le paiement de cotisation déclenche une requête : vérifier prévention des doubles soumissions et confirmation explicite en recette.

## Docker
Le workflow `Docker integration smoke test` du run [39080833123](https://github.com/mozcity/Smart-tontine-/actions/runs/39080833123) est **réussi** : build des images, démarrage PostgreSQL/API, santé API, chargement Web et mobile Web, lancement du conteneur de sauvegarde. Il ne certifie pas la restauration de sauvegarde ni les parcours métier complets.

## État
**Référence visuelle figée et contrôles statiques ajoutés ; validation visuelle sur rendu réel encore ouverte.**
