import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { many, one, pool, withTx, type Db } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { post, systemAccount, walletOf } from '../services/ledger.js';
import { amortize, assertUnderUsury, creditScore, microcreditLimit } from '../services/credit.js';
import { notify, track } from '../services/notify.js';
import { assertPin } from './auth.js';

// Microfinance : prêts financés par le SFD partenaire (SYS_CREDIT). SMARTFIN note, verse,
// recouvre et perçoit `smartfinInterestShare` des intérêts ; le reste revient au partenaire.
export const router = Router();

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);

function splitInterest(amount: number) {
  const smartfin = Math.round(amount * pricing.credit.smartfinInterestShare);
  return { smartfin, partner: amount - smartfin };
}

/** Tours de tontine pour lesquels l'utilisateur peut demander une avance sur son futur pot. */
async function advanceOffers(db: Db, userId: string) {
  const rounds = await many(db,
    `SELECT r.id AS round_id, r.number, r.due_date, t.id AS tontine_id, t.name, t.contribution_amount,
            (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id) AS members,
            m.status AS member_status,
            (SELECT count(*)::int FROM tontine_rounds r2 WHERE r2.tontine_id = t.id AND r2.due_date < CURRENT_DATE
               AND NOT EXISTS (SELECT 1 FROM tontine_contributions c WHERE c.round_id = r2.id AND c.user_id = $1)) AS arrears,
            EXISTS (SELECT 1 FROM loans l WHERE l.tontine_round_id = r.id AND l.status = 'active') AS has_advance
     FROM tontine_rounds r JOIN tontines t ON t.id = r.tontine_id
     JOIN tontine_members m ON m.tontine_id = t.id AND m.user_id = $1
     WHERE r.beneficiary_id = $1 AND r.status = 'open' AND t.status = 'active' AND r.due_date > CURRENT_DATE`, [userId]);
  return rounds.map((r) => {
    const pot = r.contribution_amount * r.members;
    const maxAmount = Math.floor((pot * pricing.credit.advance.maxShareOfPot) / 1000) * 1000;
    // Mois entamés jusqu'au versement du pot (mois moyen de 30,44 jours).
    const months = Math.max(1, Math.ceil((new Date(`${r.due_date}T00:00:00Z`).getTime() - Date.now()) / (30.44 * DAY)));
    const reasons = [
      r.member_status !== 'active' && 'Tu as déjà eu un impayé dans cette tontine',
      r.arrears > 0 && 'Tu as des cotisations en retard',
      r.has_advance && 'Une avance est déjà en cours sur ce tour',
      maxAmount < pricing.credit.advance.minAmount && 'Pot trop petit',
    ].filter(Boolean) as string[];
    return {
      roundId: r.round_id, tontineId: r.tontine_id, tontine: r.name, round: r.number, dueDate: r.due_date, pot,
      months, monthlyRate: pricing.credit.advance.monthlyRate, maxAmount, eligible: reasons.length === 0, reasons,
    };
  });
}

async function microcreditOffer(db: Db, userId: string, score: number) {
  const p = pricing.credit.microcredit;
  const user = await one(db, 'SELECT kyc_level FROM users WHERE id = $1', [userId]);
  const active = await one(db, "SELECT count(*)::int AS n FROM loans WHERE user_id = $1 AND product = 'microcredit' AND status = 'active'", [userId]);
  const defaulted = await one(db, "SELECT count(*)::int AS n FROM loans WHERE user_id = $1 AND status = 'defaulted'", [userId]);
  const maxAmount = microcreditLimit(score);
  const reasons = [
    user.kyc_level < p.minKycLevel && 'Vérifie ton identité (pièce + selfie) pour accéder au crédit',
    score < p.minScore && `Score minimum ${p.minScore} : cotise à l'heure dans une tontine pour l'atteindre`,
    active.n > 0 && 'Un microcrédit est déjà en cours',
    defaulted.n > 0 && 'Un crédit précédent est en défaut',
  ].filter(Boolean) as string[];
  return { eligible: reasons.length === 0, reasons, maxAmount: reasons.length ? 0 : maxAmount, minAmount: p.minAmount,
    durations: p.durations, monthlyRate: p.monthlyRate, apr: p.monthlyRate * 12 };
}

router.get('/offers', async (req, res) => {
  const userId = currentUser(req).id;
  const score = await creditScore(pool, userId);
  res.json({ ...score, microcredit: await microcreditOffer(pool, userId, score.score), advances: await advanceOffers(pool, userId) });
});

router.get('/loans', async (req, res) => {
  res.json(await many(pool,
    `SELECT l.*, (SELECT json_agg(i ORDER BY i.number) FROM loan_installments i WHERE i.loan_id = l.id) AS installments,
            (SELECT COALESCE(sum(principal + interest + penalty), 0)::bigint FROM loan_installments WHERE loan_id = l.id AND paid_at IS NULL) AS outstanding
     FROM loans l WHERE l.user_id = $1 ORDER BY l.created_at DESC`, [currentUser(req).id]));
});

router.get('/simulate', async (req, res) => {
  const q = z.object({ amount: z.coerce.number().int().positive(), months: z.coerce.number().int().min(1).max(12) }).parse(req.query);
  const schedule = amortize(q.amount, q.months, pricing.credit.microcredit.monthlyRate);
  res.json({ schedule, totalInterest: schedule.reduce((s, i) => s + i.interest, 0), apr: pricing.credit.microcredit.monthlyRate * 12 });
});

async function disburse(client: pg.PoolClient, loan: any, label: string) {
  const wallet = await walletOf(client, loan.user_id);
  const tx = await post(client, {
    type: 'loan_disbursement', amount: loan.principal, initiatorId: loan.user_id, description: label, meta: { loanId: loan.id },
    legs: [{ accountId: await systemAccount(client, 'SYS_CREDIT'), amount: -loan.principal }, { accountId: wallet.id, amount: loan.principal }],
  });
  await client.query('UPDATE loans SET disbursement_tx_id = $2 WHERE id = $1', [loan.id, tx.id]);
}

/** Avance sur tontine : une partie du futur pot tout de suite, remboursée automatiquement au versement du pot. */
router.post('/advances', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({ roundId: z.uuid(), amount: z.number().int().positive(), pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, body.pin);
  const loan = await withTx(async (client) => {
    await client.query('SELECT id FROM tontine_rounds WHERE id = $1 FOR UPDATE', [body.roundId]);
    const offer = (await advanceOffers(client, user.id)).find((o) => o.roundId === body.roundId);
    if (!offer) throw notFound('Tour de tontine éligible');
    if (!offer.eligible) throw badRequest('not_eligible', offer.reasons.join(' · '));
    if (body.amount < pricing.credit.advance.minAmount || body.amount > offer.maxAmount) {
      throw badRequest('invalid_amount', `Montant entre ${pricing.credit.advance.minAmount} et ${offer.maxAmount} FCFA`);
    }
    assertUnderUsury(pricing.credit.advance.monthlyRate);
    const interest = Math.ceil(body.amount * pricing.credit.advance.monthlyRate * offer.months);
    const { score } = await creditScore(client, user.id);
    const l = await one(client,
      `INSERT INTO loans (user_id, product, purpose, principal, interest, apr, score_at_grant, tontine_round_id)
       VALUES ($1, 'avance_tontine', $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, `Avance sur « ${offer.tontine} » tour ${offer.round}`, body.amount, interest, pricing.credit.advance.monthlyRate * 12, score, body.roundId]);
    await client.query('INSERT INTO loan_installments (loan_id, number, due_date, principal, interest) VALUES ($1, 1, $2, $3, $4)',
      [l.id, offer.dueDate, body.amount, interest]);
    await disburse(client, l, `Avance sur tontine « ${offer.tontine} »`);
    return l;
  });
  await track(pool, user.id, 'advance_granted', { amount: body.amount });
  res.status(201).json(loan);
});

router.post('/loans', async (req, res) => {
  const user = currentUser(req);
  const p = pricing.credit.microcredit;
  const body = z.object({
    amount: z.number().int().min(p.minAmount),
    months: z.number().int().refine((m) => p.durations.includes(m), 'Durée non proposée'),
    purpose: z.string().trim().min(3).max(120),
    pin: z.string().optional(),
  }).parse(req.body);
  await assertPin(user.id, body.pin);
  const loan = await withTx(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    const { score } = await creditScore(client, user.id);
    const offer = await microcreditOffer(client, user.id, score);
    if (!offer.eligible) throw badRequest('not_eligible', offer.reasons.join(' · '));
    if (body.amount > offer.maxAmount) throw badRequest('over_limit', `Ton plafond actuel est de ${offer.maxAmount} FCFA`);
    assertUnderUsury(p.monthlyRate);
    const schedule = amortize(body.amount, body.months, p.monthlyRate);
    const interest = schedule.reduce((s, i) => s + i.interest, 0);
    const l = await one(client,
      `INSERT INTO loans (user_id, product, purpose, principal, interest, apr, score_at_grant)
       VALUES ($1, 'microcredit', $2, $3, $4, $5, $6) RETURNING *`,
      [user.id, body.purpose, body.amount, interest, p.monthlyRate * 12, score]);
    for (const i of schedule) {
      await client.query('INSERT INTO loan_installments (loan_id, number, due_date, principal, interest) VALUES ($1, $2, $3, $4, $5)',
        [l.id, i.number, i.dueDate, i.principal, i.interest]);
    }
    await disburse(client, l, `Microcrédit — ${body.purpose}`);
    await notify(client, user.id, 'Crédit versé 💰', `${body.amount} FCFA sur ton jeton. 1re échéance le ${schedule[0].dueDate}.`);
    return { ...l, schedule };
  });
  await track(pool, user.id, 'microcredit_granted', { amount: body.amount, months: body.months });
  res.status(201).json(loan);
});

/** Paie la prochaine échéance depuis le portefeuille (manuel, ou prélèvement automatique par les jobs). */
export async function payNextInstallment(client: pg.PoolClient, loanId: string) {
  const loan = await one(client, 'SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
  if (!loan || loan.status === 'repaid') throw conflict('not_active', 'Crédit déjà remboursé');
  const inst = await one(client, 'SELECT * FROM loan_installments WHERE loan_id = $1 AND paid_at IS NULL ORDER BY number LIMIT 1 FOR UPDATE', [loanId]);
  const wallet = await walletOf(client, loan.user_id);
  const total = inst.principal + inst.interest + inst.penalty;
  const income = splitInterest(inst.interest + inst.penalty);
  const tx = await post(client, {
    type: 'loan_repayment', amount: total, initiatorId: loan.user_id, description: `Échéance ${inst.number} — ${loan.purpose}`,
    meta: { loanId: loan.id, installment: inst.number },
    legs: [
      { accountId: wallet.id, amount: -total },
      { accountId: await systemAccount(client, 'SYS_CREDIT'), amount: inst.principal },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: income.smartfin },
      { accountId: await systemAccount(client, 'SYS_CREDIT_INCOME'), amount: income.partner },
    ],
  });
  await client.query('UPDATE loan_installments SET paid_at = now(), tx_id = $2 WHERE id = $1', [inst.id, tx.id]);
  const left = await one(client, 'SELECT count(*)::int AS n FROM loan_installments WHERE loan_id = $1 AND paid_at IS NULL', [loanId]);
  if (left.n === 0) await client.query("UPDATE loans SET status = 'repaid', closed_at = now() WHERE id = $1", [loanId]);
  return { paid: total, remaining: left.n, status: left.n === 0 ? 'repaid' : loan.status };
}

router.post('/loans/:id/repay', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const out = await withTx(async (client) => {
    const loan = await one(client, 'SELECT user_id FROM loans WHERE id = $1', [req.params.id]);
    if (!loan || loan.user_id !== user.id) throw notFound('Crédit');
    return payNextInstallment(client, req.params.id as string);
  });
  res.json(out);
});

/**
 * Appelé au versement d'un pot de tontine : si une avance est en cours sur ce tour,
 * elle est remboursée en priorité sur le pot. Renvoie les montants à ventiler.
 */
export async function settleAdvanceFromPayout(client: pg.PoolClient, roundId: string) {
  const loan = await one(client,
    "SELECT * FROM loans WHERE tontine_round_id = $1 AND product = 'avance_tontine' AND status = 'active' FOR UPDATE", [roundId]);
  if (!loan) return null;
  const inst = await one(client, 'SELECT * FROM loan_installments WHERE loan_id = $1 AND paid_at IS NULL', [loan.id]);
  if (!inst) return null;
  const income = splitInterest(inst.interest + inst.penalty);
  return {
    total: inst.principal + inst.interest + inst.penalty,
    principal: inst.principal,
    smartfinInterest: income.smartfin,
    partnerInterest: income.partner,
    async markRepaid(txId: string) {
      await client.query('UPDATE loan_installments SET paid_at = now(), tx_id = $2 WHERE id = $1', [inst.id, txId]);
      await client.query("UPDATE loans SET status = 'repaid', closed_at = now() WHERE id = $1", [loan.id]);
    },
  };
}

/** Recouvrement quotidien : prélèvement auto si le solde suffit, pénalité après la grâce, défaut à 90 jours. */
export async function collectDueInstallments() {
  const p = pricing.credit.microcredit;
  const stats = { autoDebited: 0, penalized: 0, defaulted: 0 };
  const due = await many(pool,
    `SELECT DISTINCT ON (l.id) l.id AS loan_id, l.user_id, i.id AS inst_id, i.due_date, i.principal, i.interest, i.penalty
     FROM loans l JOIN loan_installments i ON i.loan_id = l.id
     WHERE l.status = 'active' AND l.product = 'microcredit' AND i.paid_at IS NULL AND i.due_date <= CURRENT_DATE
     ORDER BY l.id, i.number`);
  for (const d of due) {
    await withTx(async (client) => {
      const wallet = await walletOf(client, d.user_id);
      if (wallet.balance >= d.principal + d.interest + d.penalty) {
        await payNextInstallment(client, d.loan_id);
        stats.autoDebited++;
        return;
      }
      const daysLate = Math.floor((Date.parse(today()) - Date.parse(d.due_date)) / DAY);
      if (daysLate > pricing.tontine.graceDays && d.penalty === 0) {
        const penalty = Math.ceil((d.principal + d.interest) * p.latePenaltyRate);
        await client.query('UPDATE loan_installments SET penalty = $2 WHERE id = $1', [d.inst_id, penalty]);
        await notify(client, d.user_id, 'Échéance en retard', `Recharge ton jeton pour éviter d'autres frais (pénalité ${penalty} FCFA).`);
        stats.penalized++;
      }
      if (daysLate > p.defaultAfterDays) {
        await client.query("UPDATE loans SET status = 'defaulted' WHERE id = $1", [d.loan_id]);
        stats.defaulted++;
      }
    });
  }
  return stats;
}
