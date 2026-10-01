export const num = (n: number | null | undefined) => Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const fcfa = (n: number | null | undefined) => `${num(n)} F`;
export const pct = (r: number | string | null | undefined, digits = 0) => `${(Number(r ?? 0) * 100).toFixed(digits).replace('.', ',')} %`;

export const date = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const x = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  return x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
export const dateTime = (d: string | Date) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** Convertit une saisie « 10 000 » en entier. */
export const parseAmount = (s: string) => Number(String(s).replace(/\D/g, '')) || 0;

export const FREQ: Record<string, string> = { weekly: 'semaine', monthly: 'mois', daily: 'jour', free: 'libre' };
export const FREQ_ADJ: Record<string, string> = { weekly: 'hebdomadaire', monthly: 'mensuelle', daily: 'quotidienne', free: 'libre' };

export const PARTNER_TYPES: Record<string, string> = {
  association: 'Association / GIE', commercant: 'Commerçant', entreprise: 'Entreprise', tontinier: 'Tontinier professionnel', sfd: 'SFD / microfinance', autre: 'Autre',
};

export const GOOD_CATEGORIES: Record<string, string> = {
  moto: 'Motos', electromenager: 'Électroménager', telephone: 'Téléphones', mobilier: 'Mobilier', cuisine: 'Cuisine',
  textile: 'Textile / pagnes', alimentaire: 'Alimentaire', materiel_pro: 'Matériel pro', autre: 'Autre',
};

export const CHANNELS: Record<string, string> = { orange_money: 'Orange Money', moov_money: 'Moov Money', wave: 'Wave', mtn_momo: 'MTN MoMo' };

export const TX_LABELS: Record<string, string> = {
  deposit: 'Dépôt', withdrawal: 'Retrait', transfer: 'Transfert', reversal: 'Annulation',
  ecaisse_lock: 'E-caisse', ecaisse_release: 'E-caisse débloquée', ecaisse_break: 'E-caisse cassée',
  cagnotte_contribution: 'Coffre de groupe', cagnotte_withdrawal: 'Retrait coffre',
  projet_contribution: 'Projet', projet_payout: 'Projet clôturé', challenge_saving: 'Challenge',
  challenge_payout: 'Challenge', challenge_reward: 'Récompense', subscription: 'Abonnement',
  referral_bonus: 'Bonus parrainage', contrat_disbursement: 'Prêt', contrat_repayment: 'Échéance',
  tontine_contribution: 'Cotisation tontine', tontine_payout: 'Pot de tontine', tontine_guarantee: 'Caution tontine',
  tontine_guarantee_return: 'Caution rendue', loan_disbursement: 'Crédit reçu', loan_repayment: 'Remboursement crédit',
  goods_escrow: 'Achat au séquestre', goods_payment: 'Paiement fournisseur', goods_refund: 'Remboursement bien',
  goods_plan_saving: "Plan d'achat", goods_plan_release: "Plan d'achat débloqué", partner_topup: 'Alimentation',
  partner_withdrawal: 'Retrait partenaire', partner_licence: 'Licence partenaire',
};

export const ORDER_STATUS: Record<string, [string, Tone]> = {
  pending: ['À expédier', 'warn'], shipped: ['Expédiée', 'info'], delivered: ['Reçue', 'ok'], cancelled: ['Annulée', 'muted'],
};
export const TONTINE_STATUS: Record<string, [string, Tone]> = {
  recruiting: ['Recrutement', 'info'], active: ['En cours', 'ok'], completed: ['Terminée', 'muted'], cancelled: ['Annulée', 'muted'],
};
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'brand';

/** « aujourd'hui », « demain », « dans 5 j », « en retard de 2 j » : plus parlant qu'une date. */
export function dueLabel(d: string): { text: string; tone: Tone } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${d}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `en retard de ${-days} j`, tone: 'danger' };
  if (days === 0) return { text: "aujourd'hui", tone: 'warn' };
  if (days === 1) return { text: 'demain', tone: 'warn' };
  return { text: `dans ${days} j`, tone: days <= 3 ? 'warn' : 'muted' };
}

export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; };
