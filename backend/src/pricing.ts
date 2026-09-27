// Grille tarifaire SMARTFIN — source unique utilisée par l'API, l'app et le modèle financier.
// Principe : dépôts et épargne gratuits (acquisition). On monétise la tontine (commission sur
// chaque pot versé), le crédit (part des intérêts), la sortie d'argent et l'abonnement SMARTFIN+.

export const pricing = {
  withdrawal: { rate: 0.015, min: 100, max: 7500 },
  cagnotteWithdrawal: { rate: 0.01, min: 100, max: 10000 },
  ecaisseEarlyBreak: { rate: 0.02, min: 200 },
  p2pTransfer: { rate: 0, min: 0 },
  plus: { monthlyPrice: 1000, freeWithdrawalsPerMonth: 3 },
  referral: { referrerBonus: 500, minFirstDeposit: 5000 },
  tontine: {
    commissionRate: 0.01,      // prélevé sur chaque pot versé au bénéficiaire du tour
    latePenaltyRate: 0.05,     // pénalité de retard (% de la cotisation), reversée au bénéficiaire du tour
    graceDays: 3,              // après l'échéance + délai de grâce, les cautions couvrent les impayés
  },
  credit: {
    usuryApr: 0.24,            // taux d'usure applicable aux SFD dans l'UEMOA (à confirmer avec le partenaire)
    smartfinInterestShare: 0.4, // part des intérêts revenant à SMARTFIN, le reste au SFD partenaire
    advance: { monthlyRate: 0.015, maxShareOfPot: 0.5, minAmount: 5_000 },
    microcredit: {
      monthlyRate: 0.015,      // intérêt sur capital restant dû (18 % / an)
      minAmount: 10_000,
      maxAmount: 500_000,
      durations: [1, 2, 3, 4, 6],
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
