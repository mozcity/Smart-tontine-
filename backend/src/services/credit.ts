import type { Db } from '../db.js';
import { one } from '../db.js';
import { pricing } from '../pricing.js';

export interface Installment { number: number; dueDate: string; principal: number; interest: number }

const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Échéancier à mensualités constantes, intérêts calculés sur le capital restant dû
 * (pas d'intérêt « flat », dont le taux effectif réel dépasserait le taux annoncé).
 */
export function amortize(principal: number, months: number, monthlyRate: number, start = new Date()): Installment[] {
  const payment = monthlyRate === 0 ? principal / months : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
  let remaining = principal;
  return Array.from({ length: months }, (_, i) => {
    const interest = Math.round(remaining * monthlyRate);
    const capital = i === months - 1 ? remaining : Math.round(payment) - interest;
    remaining -= capital;
    return { number: i + 1, dueDate: iso(addMonths(start, i + 1)), principal: capital, interest };
  });
}

/** Garde-fou réglementaire : le taux annuel (hors pénalités) ne doit jamais dépasser le taux d'usure. */
export function assertUnderUsury(monthlyRate: number) {
  if (monthlyRate * 12 > pricing.credit.usuryApr) throw new Error('Taux supérieur au taux d\'usure');
}

export interface Score { score: number; factors: { label: string; points: number }[] }

/**
 * Score SMARTFIN (0-1000) : il valorise la discipline observée dans l'app,
 * au premier rang desquelles les cotisations de tontine payées à l'heure.
 */
export async function creditScore(db: Db, userId: string): Promise<Score> {
  const t = await one(db,
    `SELECT count(*) FILTER (WHERE source = 'wallet' AND NOT late)::int AS on_time,
            count(*) FILTER (WHERE source = 'wallet' AND late)::int AS late,
            count(*) FILTER (WHERE source = 'guarantee')::int AS defaults
     FROM tontine_contributions WHERE user_id = $1`, [userId]);
  const completed = await one(db,
    `SELECT count(*)::int AS n FROM tontine_members m JOIN tontines t ON t.id = m.tontine_id
     WHERE m.user_id = $1 AND t.status = 'completed' AND m.status = 'active'`, [userId]);
  const savings = await one(db,
    `SELECT (SELECT count(*)::int FROM ecaisses WHERE user_id = $1 AND status = 'released') AS kept,
            (SELECT COALESCE(sum(balance), 0)::bigint FROM accounts WHERE owner_id = $1 AND kind <> 'system') AS balance`, [userId]);
  const loans = await one(db,
    `SELECT count(*) FILTER (WHERE l.status = 'repaid')::int AS repaid,
            count(*) FILTER (WHERE l.status = 'defaulted')::int AS defaulted,
            (SELECT count(*)::int FROM loan_installments i JOIN loans x ON x.id = i.loan_id
             WHERE x.user_id = $1 AND i.penalty > 0) AS late_installments
     FROM loans l WHERE l.user_id = $1`, [userId]);
  const user = await one(db, 'SELECT kyc_level FROM users WHERE id = $1', [userId]);

  const factors = [
    { label: 'Base', points: 300 },
    { label: 'Cotisations de tontine payées à l\'heure', points: Math.min(300, t.on_time * 15) },
    { label: 'Cotisations en retard', points: -20 * t.late },
    { label: 'Cotisations impayées (caution utilisée)', points: -150 * t.defaults },
    { label: 'Tontines menées jusqu\'au bout', points: Math.min(100, completed.n * 50) },
    { label: 'E-caisses tenues jusqu\'à l\'échéance', points: Math.min(100, savings.kept * 20) },
    { label: 'Épargne disponible ≥ 50 000 F', points: savings.balance >= 50_000 ? 50 : 0 },
    { label: 'Crédits remboursés', points: Math.min(200, loans.repaid * 40) },
    { label: 'Échéances de crédit en retard', points: -30 * loans.late_installments },
    { label: 'Identité vérifiée', points: user.kyc_level >= 1 ? 50 : 0 },
  ].filter((f) => f.points !== 0);
  let score = factors.reduce((s, f) => s + f.points, 0);
  if (loans.defaulted > 0) {
    factors.push({ label: 'Crédit en défaut', points: -score });
    score = 0;
  }
  return { score: Math.max(0, Math.min(1000, score)), factors };
}

/** Montant maximal de microcrédit selon le score (0 sous le seuil). */
export function microcreditLimit(score: number): number {
  const p = pricing.credit.microcredit;
  if (score < p.minScore) return 0;
  const raw = (score - 450) * 1_000;
  return Math.min(p.maxAmount, Math.floor(raw / 5_000) * 5_000);
}
