# 6. Cadre réglementaire et risques

> Ce chapitre donne un cadre de travail, pas un avis juridique. Il doit être validé par un cabinet spécialisé en droit bancaire UEMOA avant tout lancement public.

## 6.1 Le point structurant : qui détient l'argent ?

Dans l'UEMOA, recevoir des fonds du public et émettre de la monnaie électronique sont des activités **réservées** aux établissements agréés par la **BCEAO** (banques, établissements de monnaie électronique — EME, systèmes financiers décentralisés). SMARTFIN n'a pas d'agrément au lancement.

**Montage recommandé : SMARTFIN = prestataire technique d'un établissement agréé.**

- Les fonds clients sont logés sur un **compte de cantonnement** ouvert chez une banque ou un EME partenaire, au nom de ce partenaire ; ils ne se mélangent jamais à la trésorerie de SMARTFIN.
- SMARTFIN fournit l'application, la relation client et le grand livre ; le partenaire porte l'agrément, la conformité LBC/FT de dernier ressort et le reporting réglementaire.
- Le compte système `SYS_FLOAT` du grand livre doit correspondre, chaque jour, au solde du compte de cantonnement (rapprochement quotidien).
- Évolution possible (année 3+) : demande d'agrément EME propre ou statut d'agent / intermédiaire en opérations de banque, selon la réglementation en vigueur à ce moment-là.

Partenaires à approcher : banques commerciales ivoiriennes ayant une offre « Banking-as-a-Service », EME existants, agrégateurs agréés (CinetPay, PayDunya…) pour la collecte.

## 6.2 Obligations à couvrir

| Domaine | Exigence | Dans la plateforme |
|---|---|---|
| **KYC** | Identification proportionnée au risque | KYC progressif niveaux 0-1-2, plafonds par niveau (`pricing.ts`), validation dans le back-office |
| **LBC/FT** | Surveillance des opérations, déclaration de soupçon (CENTIF) | Historique complet, grand livre ; *à ajouter* : règles d'alerte (fractionnement, volumes inhabituels) |
| **Données personnelles** | Loi ivoirienne n° 2013-450 ; déclaration/autorisation auprès de l'**ARTCI** | Données minimales, classement par prénom seulement, pas de revente |
| **Protection du consommateur** | Tarifs affichés, CGU claires, traitement des réclamations | Grille publique `GET /pricing`, devis de frais avant retrait, tickets de support |
| **Prêts entre particuliers (Contrats)** | Ne pas exercer d'activité de crédit ; respecter l'usure | Contrats **sans intérêts**, SMARTFIN n'avance jamais de fonds, simple outil de formalisation entre deux personnes |
| **Tontines (Cagnotte+)** | Pas de promesse de rendement, transparence | Soldes et contributions visibles de tous les membres, double validation |
| **Jeux / récompenses** | Les challenges ne doivent pas être assimilés à un jeu d'argent | Récompenses fixes, liées à l'effort d'épargne, pas au hasard |
| **Fiscalité** | IS 25 %, TVA sur les commissions selon le régime applicable | Revenus isolés dans `SYS_FEES`, exportables |

## 6.3 Registre des risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Aucun partenaire agréé ne signe | Moyenne | Bloquant | Démarcher 5+ partenaires en parallèle ; commencer par un agrégateur agréé ; pilote fermé en attendant |
| Coûts opérateurs plus élevés que prévu | Élevée | Fort | Onglet Sensibilité ; ajuster frais de retrait ; privilégier transferts internes |
| Fraude (usurpation de compte, SIM swap) | Moyenne | Fort | PIN pour toute sortie, plafonds KYC, alerte de connexion, *à ajouter* : blocage après changement de SIM / nouvel appareil |
| Incident de paiement (dépôt non crédité, retrait perdu) | Élevée au début | Moyen | Webhooks idempotents, file de rapprochement, support WhatsApp réactif |
| Faille de sécurité | Faible | Critique | Pentest avant lancement, revue de code, secrets hors dépôt, sauvegardes chiffrées |
| Faible rétention | Moyenne | Fort | Challenges, e-caisse automatique, notifications segmentées, analyse des cohortes |
| Concurrence (Wave, Djamo, banques) | Élevée | Moyen | Se différencier sur l'épargne collective et la discipline, pas sur le paiement |
| Changement réglementaire | Faible | Fort | Veille BCEAO, relation étroite avec le partenaire |
