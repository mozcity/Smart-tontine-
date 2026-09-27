// Grille tarifaire SMARTFIN — source unique utilisée par l'API, l'app et le modèle financier.
// Principe : dépôts et épargne gratuits (acquisition), on monétise la sortie d'argent,
// la rupture anticipée, les cagnottes et l'abonnement SMARTFIN+.

export const pricing = {
  withdrawal: { rate: 0.015, min: 100, max: 7500 },
  cagnotteWithdrawal: { rate: 0.01, min: 100, max: 10000 },
  ecaisseEarlyBreak: { rate: 0.02, min: 200 },
  p2pTransfer: { rate: 0, min: 0 },
  plus: { monthlyPrice: 1000, freeWithdrawalsPerMonth: 3 },
  referral: { referrerBonus: 500, minFirstDeposit: 5000 },
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
