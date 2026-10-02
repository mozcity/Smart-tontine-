// Grille tarifaire Smart Tontine — source unique utilisée par l'API et l'app, alignée sur le
// modèle économique retenu (modèle G, finance/SmartTontine_modeles_economiques.xlsx) :
// dépôts, cotisations et épargne gratuits ; 1 % sur chaque pot ; 1 % sur les retraits vers
// Mobile Money ; abonnements Organisateur Pro et Smart Tontine+ ; part des intérêts de crédit.

export const pricing = {
  withdrawal: { rate: 0.01, min: 100, max: 5000 },
  cagnotteWithdrawal: { rate: 0.01, min: 100, max: 10000 },
  ecaisseEarlyBreak: { rate: 0.02, min: 200 },
  p2pTransfer: { rate: 0, min: 0 },
  plus: { monthlyPrice: 500, freeWithdrawalsPerMonth: 3 },
  // Organisateur Pro : pour les trésoriers de tontines, associations, GIE. La version gratuite
  // permet de gérer 2 tontines ou coffres de groupe à la fois ; Pro lève la limite et ajoute les exports.
  pro: { monthlyPrice: 2000, freeOrganizerLimit: 2 },
  // Espace partenaire (association, commerçant, entreprise, tontinier, SFD) : licence par membre
  // actif dans ses groupes, avec un forfait minimum. Le partenaire peut prendre ses propres frais
  // de gestion sur chaque pot (plafonnés), versés sur son compte partenaire.
  partner: { perMemberMonthly: 75, minimumMonthly: 10_000, maxManagementFeeRate: 0.03 },
  // Tontines et plans d'achat de biens : le fournisseur partenaire paie une commission sur chaque
  // vente ; l'argent reste au séquestre jusqu'à la confirmation de réception.
  goods: { supplierCommissionRate: 0.03, autoConfirmDays: 7 },
  referral: { referrerBonus: 500, minFirstDeposit: 5000 },
  tontine: {
    commissionRate: 0.01,      // prélevé sur chaque pot versé au bénéficiaire du tour
    latePenaltyRate: 0.05,     // pénalité de retard (% de la cotisation), reversée au bénéficiaire du tour
    graceDays: 3,              // après l'échéance + délai de grâce, les cautions couvrent les impayés
  },
  credit: {
    usuryApr: 0.24,
    // Remboursement complet jamais avant 61 jours : règle Google Play sur les prêts personnels (« short-term loans »).
    minRepaymentDays: 61,            // taux d'usure applicable aux SFD dans l'UEMOA (à confirmer avec le partenaire)
    smartTontineInterestShare: 0.4, // part des intérêts revenant à Smart Tontine, le reste au SFD partenaire
    advance: { monthlyRate: 0.015, maxShareOfPot: 0.5, minAmount: 5_000 },
    microcredit: {
      monthlyRate: 0.015,      // intérêt sur capital restant dû (18 % / an)
      minAmount: 10_000,
      maxAmount: 500_000,
      durations: [3, 4, 6],    // en mois : la plus courte dépasse minRepaymentDays
      minScore: 550,
      minKycLevel: 1,
      latePenaltyRate: 0.02,   // pénalité unique par échéance en retard
      defaultAfterDays: 90,
    },
  },
  limits: {
    // Plafonds par niveau KYC (à aligner sur la réglementation BCEAO et le partenaire EME)
    0: { balance: 200_000, monthlyInflow: 500_000 },
    1: { balance: 2_000_000, monthlyInflow: 5_000_000 },
    2: { balance: 10_000_000, monthlyInflow: 20_000_000 },
  } as Record<number, { balance: number; monthlyInflow: number }>,
};

export function fee(amount: number, rule: { rate: number; min: number; max?: number }): number {
  if (rule.rate === 0) return 0;
  const raw = Math.ceil(amount * rule.rate);
  return Math.min(Math.max(raw, rule.min), rule.max ?? Number.MAX_SAFE_INTEGER);
}
