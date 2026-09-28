export const fcfa = (n: number | null | undefined) =>
  `${Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

export const shortDate = (d: string | Date) => {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};

export const TX_LABELS: Record<string, string> = {
  deposit: 'Dépôt', withdrawal: 'Retrait', transfer: 'Transfert', reversal: 'Annulation',
  ecaisse_lock: 'E-caisse', ecaisse_release: 'E-caisse débloquée', ecaisse_break: 'E-caisse cassée',
  cagnotte_contribution: 'Cagnotte', cagnotte_withdrawal: 'Retrait cagnotte',
  projet_contribution: 'Projet', projet_payout: 'Projet clôturé', challenge_saving: 'Challenge',
  challenge_payout: 'Challenge', challenge_reward: 'Récompense', subscription: 'Smart Tontine+',
  referral_bonus: 'Bonus parrainage', contrat_disbursement: 'Prêt', contrat_repayment: 'Échéance',
  tontine_contribution: 'Cotisation tontine', tontine_payout: 'Pot de tontine', tontine_guarantee: 'Caution tontine',
  tontine_guarantee_return: 'Caution rendue', loan_disbursement: 'Crédit reçu', loan_repayment: 'Remboursement crédit',
};

/** Convertit une saisie « 10 000 » en entier. */
export const parseAmount = (s: string) => Number(s.replace(/\D/g, '')) || 0;
