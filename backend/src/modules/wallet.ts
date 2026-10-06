import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, conflict, HttpError, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { reference } from '../lib/crypto.js';
import { config } from '../config.js';
import { fee, pricing } from '../pricing.js';
import { post, applyLegs, systemAccount, walletOf } from '../services/ledger.js';
import { paymentProvider, type Channel } from '../services/payments/index.js';
import { notify, track } from '../services/notify.js';
import { assertPin } from './auth.js';

export const router = Router();

const channel = z.enum(['wave', 'orange_money', 'mtn_momo', 'moov_money', 'card']);
const amount = z.number().int().min(100).max(5_000_000);
// Un retrait part toujours vers un compte Mobile Money (pas de remboursement sur carte).
const payoutChannel = z.enum(['wave', 'orange_money', 'mtn_momo', 'moov_money']);

/** Refuse avant toute écriture une opération que l'agrégateur ne pourra pas exécuter. */
function assertProviderAccepts(ch: Channel, phone: string, value: number, direction: 'collect' | 'payout') {
  const p = paymentProvider();
  if (p.supports && !p.supports(ch, phone, direction)) {
    throw badRequest('channel_not_supported', 'Ce moyen de paiement n\'est pas disponible pour ce numéro');
  }
  const max = p.limits?.[direction];
  if (max && value > max) {
    throw badRequest('provider_limit', `Montant maximum par opération : ${max} FCFA. Fais plusieurs opérations.`);
  }
}

router.get('/', async (req, res) => {
  const userId = currentUser(req).id;
  const wallet = await walletOf(pool, userId);
  const pockets = await many(pool,
    `SELECT kind, COALESCE(sum(balance), 0)::bigint AS total FROM accounts
     WHERE owner_id = $1 AND kind IN ('ecaisse', 'projet', 'challenge') GROUP BY kind`, [userId]);
  const saved = pockets.reduce((s, p) => s + p.total, 0);
  res.json({ balance: wallet.balance, pockets, totalSavings: saved, netWorth: wallet.balance + saved });
});

router.get('/history', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
  const wallet = await walletOf(pool, currentUser(req).id);
  const rows = await many(pool,
    `SELECT t.id, t.reference, t.type, t.description, t.meta, e.amount, e.created_at
     FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
     WHERE e.account_id = $1 ORDER BY e.id DESC LIMIT $2`, [wallet.id, limit]);
  const pending = await many(pool,
    `SELECT id, reference, type, amount, status, created_at FROM transactions
     WHERE initiator_id = $1 AND status = 'pending' ORDER BY created_at DESC`, [currentUser(req).id]);
  res.json({ entries: rows, pending });
});

// ───── Dépôt : Mobile Money → portefeuille (confirmé par webhook) ─────
router.post('/deposits', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({ amount, channel, phone: z.string().optional() }).parse(req.body);
  const profile = await one(pool, 'SELECT phone, kyc_level, full_name, email FROM users WHERE id = $1', [user.id]);
  const payer = body.phone ?? profile.phone;
  assertProviderAccepts(body.channel, payer, body.amount, 'collect');
  const wallet = await walletOf(pool, user.id);
  const limit = pricing.limits[profile.kyc_level];
  if (wallet.balance + body.amount > limit.balance) {
    throw badRequest('kyc_limit', `Plafond de solde atteint (${limit.balance} FCFA). Complète ta vérification d'identité.`);
  }
  // Plafond d'entrées mensuelles par niveau KYC (LBC/FT) : dépôts confirmés ou en cours depuis le 1er du mois.
  const inflow = await one(pool,
    `SELECT COALESCE(sum(amount), 0)::bigint AS total FROM transactions
     WHERE initiator_id = $1 AND type = 'deposit' AND status IN ('pending', 'completed') AND created_at >= date_trunc('month', now())`, [user.id]);
  if (inflow.total + body.amount > limit.monthlyInflow) {
    throw badRequest('kyc_monthly_limit', `Plafond mensuel de dépôts atteint (${limit.monthlyInflow} FCFA). Complète ta vérification d'identité.`);
  }

  const ref = reference('DEP');
  const tx = await one(pool,
    `INSERT INTO transactions (reference, type, status, amount, initiator_id, provider, description, meta)
     VALUES ($1, 'deposit', 'pending', $2, $3, $4, 'Dépôt', $5) RETURNING id`,
    [ref, body.amount, user.id, paymentProvider().name, { channel: body.channel, walletId: wallet.id, phone: payer }]);
  const [firstName, ...rest] = String(profile.full_name ?? '').trim().split(/\s+/);
  let result;
  try {
    result = await paymentProvider().collect({
      reference: ref, amount: body.amount, phone: payer, channel: body.channel as Channel,
      description: 'Dépôt Smart Tontine', customer: { firstName, lastName: rest.join(' '), email: profile.email ?? undefined },
    });
  } catch (err) {
    await pool.query("UPDATE transactions SET status = 'failed', completed_at = now() WHERE id = $1", [tx.id]);
    if (err instanceof HttpError) throw err;
    console.error('Initialisation du dépôt', ref, err);
    throw new HttpError(502, 'provider_unavailable', 'Le service de paiement ne répond pas. Réessaie dans un instant.');
  }
  // Le jeton de notification reste côté serveur : il authentifie le webhook de l'agrégateur.
  await pool.query(`UPDATE transactions SET provider_ref = $2, meta = meta || jsonb_strip_nulls(jsonb_build_object('notifyToken', $3::text)) WHERE id = $1`,
    [tx.id, result.providerRef ?? null, result.notifyToken ?? null]);
  await track(pool, user.id, 'deposit_initiated', { amount: body.amount, channel: body.channel });
  res.status(201).json({ reference: ref, paymentUrl: result.paymentUrl, status: 'pending' });
});

/**
 * Développement et démonstration uniquement (fournisseur simulé) : confirme un dépôt comme le ferait
 * le webhook de l'agrégateur. En production, la route n'est même pas déclarée (et la configuration
 * refuse de démarrer avec le fournisseur simulé) : un dépôt n'est confirmé que par l'agrégateur.
 */
if (!config.isProd) {
  router.post('/deposits/:reference/simulate', async (req, res) => {
    if (paymentProvider().name !== 'mock') throw notFound('Route');
    const tx = await one(pool, "SELECT initiator_id FROM transactions WHERE reference = $1 AND type = 'deposit'", [req.params.reference]);
    if (!tx || tx.initiator_id !== currentUser(req).id) throw notFound('Dépôt');
    res.json(await settleDeposit(req.params.reference as string, true, `MOCK-${req.params.reference}`));
  });
}

/**
 * Décide d'un dépôt en interrogeant l'agrégateur (serveur-à-serveur) quand il le permet.
 * `claimed` = ce qu'annonce le webhook ; il n'est utilisé que si le fournisseur n'a pas de vérification.
 * Un montant encaissé différent du montant attendu n'est jamais crédité : il part en rapprochement.
 */
export async function verifyAndSettle(ref: string, claimed?: { success: boolean; providerRef?: string }) {
  const provider = paymentProvider();
  if (!provider.verify) {
    if (!claimed) return { status: 'pending' as const };
    return settleDeposit(ref, claimed.success, claimed.providerRef);
  }
  const tx = await one(pool, "SELECT id, amount, status, meta FROM transactions WHERE reference = $1 AND type = 'deposit'", [ref]);
  if (!tx) throw notFound('Transaction');
  if (tx.status !== 'pending') return { status: tx.status, alreadyProcessed: true };
  const v = await provider.verify(ref, { phone: tx.meta?.phone });
  if (v.status === 'pending') return { status: 'pending' as const };
  if (v.status === 'success' && v.amount !== undefined && v.amount !== tx.amount) {
    await pool.query(`UPDATE transactions SET meta = meta || jsonb_build_object('verification', 'amount_mismatch', 'paidAmount', $2::bigint) WHERE id = $1`, [tx.id, v.amount]);
    console.error(`Dépôt ${ref} : montant encaissé ${v.amount} ≠ attendu ${tx.amount}, à rapprocher`);
    return { status: 'pending' as const, mismatch: true };
  }
  return settleDeposit(ref, v.status === 'success', v.providerRef);
}

/** Rattrapage : dépôts restés en attente (webhook perdu) vérifiés auprès de l'agrégateur ; abandon après 48 h. */
export async function reconcilePendingDeposits() {
  let settled = 0;
  const pending = await many(pool,
    `SELECT reference, created_at FROM transactions WHERE type = 'deposit' AND status = 'pending'
     AND created_at < now() - interval '15 minutes' AND NOT (meta ? 'verification') ORDER BY created_at LIMIT 200`);
  for (const p of pending) {
    try {
      const r = await verifyAndSettle(p.reference);
      if (r.status === 'completed' || r.status === 'failed') settled++;
      else if (new Date(p.created_at).getTime() < Date.now() - 48 * 3600_000) {
        await pool.query("UPDATE transactions SET status = 'failed', completed_at = now() WHERE reference = $1 AND status = 'pending'", [p.reference]);
        settled++;
      }
    } catch (e) { console.error('Rapprochement du dépôt', p.reference, e); }
  }
  return settled;
}

/** Appelé par le webhook de l'agrégateur. Idempotent : un dépôt n'est crédité qu'une fois. */
export async function settleDeposit(ref: string, success: boolean, providerRef?: string) {
  return withTx(async (client) => {
    const tx = await one(client, "SELECT * FROM transactions WHERE reference = $1 AND type = 'deposit' FOR UPDATE", [ref]);
    if (!tx) throw notFound('Transaction');
    if (tx.status !== 'pending') return { status: tx.status, alreadyProcessed: true };

    if (!success) {
      await client.query("UPDATE transactions SET status = 'failed', completed_at = now() WHERE id = $1", [tx.id]);
      return { status: 'failed' };
    }
    await applyLegs(client, tx.id, [
      { accountId: await systemAccount(client, 'SYS_FLOAT'), amount: -tx.amount },
      { accountId: tx.meta.walletId, amount: tx.amount },
    ]);
    await client.query(
      "UPDATE transactions SET status = 'completed', completed_at = now(), provider_ref = COALESCE($2, provider_ref) WHERE id = $1",
      [tx.id, providerRef ?? null]);
    await notify(client, tx.initiator_id, 'Dépôt reçu', `+${tx.amount} FCFA sur ton portefeuille`);
    await track(client, tx.initiator_id, 'deposit_completed', { amount: tx.amount });
    await rewardReferrer(client, tx.initiator_id, tx.amount);
    return { status: 'completed' };
  });
}

async function rewardReferrer(client: import('pg').PoolClient, userId: string, depositAmount: number) {
  if (depositAmount < pricing.referral.minFirstDeposit) return;
  const user = await one(client, 'SELECT referred_by FROM users WHERE id = $1', [userId]);
  if (!user?.referred_by) return;
  const first = await one(client,
    "SELECT count(*)::int AS n FROM transactions WHERE initiator_id = $1 AND type = 'deposit' AND status = 'completed'", [userId]);
  const alreadyPaid = await one(client,
    "SELECT 1 FROM transactions WHERE type = 'referral_bonus' AND meta->>'referee' = $1", [userId]);
  if (first.n !== 1 || alreadyPaid) return;
  const referrerWallet = await walletOf(client, user.referred_by);
  await post(client, {
    type: 'referral_bonus', amount: pricing.referral.referrerBonus, initiatorId: user.referred_by,
    description: 'Bonus parrainage', meta: { referee: userId },
    legs: [
      { accountId: await systemAccount(client, 'SYS_REWARDS'), amount: -pricing.referral.referrerBonus },
      { accountId: referrerWallet.id, amount: pricing.referral.referrerBonus },
    ],
  });
  await notify(client, user.referred_by, 'Bonus parrainage 🎉', `+${pricing.referral.referrerBonus} FCFA : ton filleul a fait son premier dépôt`);
}

// ───── Retrait : portefeuille → Mobile Money ─────
export async function withdrawalFee(userId: string, amountValue: number): Promise<number> {
  const u = await one(pool, 'SELECT plan FROM users WHERE id = $1', [userId]);
  if (u.plan === 'plus') {
    const used = await one(pool,
      `SELECT count(*)::int AS n FROM transactions WHERE initiator_id = $1 AND type = 'withdrawal'
       AND status = 'completed' AND created_at >= date_trunc('month', now())`, [userId]);
    if (used.n < pricing.plus.freeWithdrawalsPerMonth) return 0;
  }
  return fee(amountValue, pricing.withdrawal);
}

router.get('/withdrawals/quote', async (req, res) => {
  const { amount: a } = z.object({ amount: z.coerce.number().int().min(100) }).parse(req.query);
  const f = await withdrawalFee(currentUser(req).id, a);
  res.json({ amount: a, fee: f, total: a + f });
});

router.post('/withdrawals', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({ amount, channel: payoutChannel, phone: z.string().optional(), pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, body.pin);
  const profile = await one(pool, 'SELECT phone, kyc_level FROM users WHERE id = $1', [user.id]);
  // Vers un autre numéro que celui du compte : identité vérifiée exigée (session volée, LBC/FT).
  if (body.phone && body.phone !== profile.phone && profile.kyc_level < 1) {
    throw new HttpError(403, 'kyc_required', 'Pour retirer vers un autre numéro, vérifie d\'abord ton identité');
  }
  assertProviderAccepts(body.channel, body.phone ?? profile.phone, body.amount, 'payout');
  const f = await withdrawalFee(user.id, body.amount);

  const tx = await withTx(async (client) => {
    const wallet = await walletOf(client, user.id);
    return post(client, {
      type: 'withdrawal', amount: body.amount, fee: f, initiatorId: user.id, provider: paymentProvider().name,
      description: 'Retrait', meta: { channel: body.channel, phone: body.phone ?? profile.phone, payout: 'processing' },
      legs: [
        { accountId: wallet.id, amount: -(body.amount + f) },
        { accountId: await systemAccount(client, 'SYS_FLOAT'), amount: body.amount },
        { accountId: await systemAccount(client, 'SYS_FEES'), amount: f },
      ],
    });
  });

  let payout: Awaited<ReturnType<ReturnType<typeof paymentProvider>['payout']>> | undefined;
  try {
    payout = await paymentProvider().payout({
      reference: tx.reference, amount: body.amount, phone: body.phone ?? profile.phone, channel: body.channel as Channel,
    });
  } catch (err) {
    // Issue inconnue (timeout…) : on ne rembourse pas automatiquement, le back-office rapproche.
    await pool.query(`UPDATE transactions SET meta = meta || '{"payout":"unknown"}' WHERE id = $1`, [tx.id]);
    console.error('Payout en erreur', tx.reference, err);
    res.status(202).json({ reference: tx.reference, status: 'processing' });
    return;
  }

  if (payout.status === 'failed') {
    await reverseWithdrawal(tx.id);
    throw badRequest('payout_failed', 'Le retrait a échoué, ton portefeuille a été recrédité');
  }
  await pool.query(
    `UPDATE transactions SET provider_ref = $2,
       meta = meta || jsonb_strip_nulls(jsonb_build_object('payout', $3::text, 'notifyToken', $4::text)) WHERE id = $1`,
    [tx.id, payout.providerRef ?? null, payout.status, payout.notifyToken ?? null]);
  await track(pool, user.id, 'withdrawal', { amount: body.amount, fee: f });
  // Décaissement asynchrone : le webhook ou le rattrapage confirme, ou annule et recrédite.
  if (payout.status === 'pending') {
    res.status(202).json({ reference: tx.reference, amount: body.amount, fee: f, status: 'processing' });
    return;
  }
  res.status(201).json({ reference: tx.reference, amount: body.amount, fee: f, status: payout.status });
});

const OPEN_PAYOUT = ['pending', 'processing', 'unknown'];

/**
 * Statut d'un retrait en cours, demandé à l'agrégateur : succès → confirmé ; échec → annulé et recrédité.
 * Idempotent : appelé par le webhook comme par le rattrapage.
 */
export async function checkWithdrawal(ref: string) {
  const provider = paymentProvider();
  const tx = await one(pool, "SELECT id, status, initiator_id, amount, meta FROM transactions WHERE reference = $1 AND type = 'withdrawal'", [ref]);
  if (!tx) throw notFound('Retrait');
  if (tx.status !== 'completed' || !OPEN_PAYOUT.includes(tx.meta?.payout)) return { status: tx.meta?.payout ?? tx.status, alreadyProcessed: true };
  if (!provider.payoutStatus) return { status: tx.meta.payout };
  const v = await provider.payoutStatus(ref, { phone: tx.meta.phone });
  if (v.status === 'pending') return { status: 'pending' };
  if (v.status === 'failed') {
    try { await reverseWithdrawal(tx.id); } catch (e) { if ((e as HttpError).code !== 'not_reversible') throw e; }
    return { status: 'failed' };
  }
  const done = await pool.query(
    `UPDATE transactions SET provider_ref = COALESCE($2, provider_ref), meta = meta || '{"payout":"completed"}'
     WHERE id = $1 AND status = 'completed' AND meta->>'payout' = ANY($3)`, [tx.id, v.providerRef ?? null, OPEN_PAYOUT]);
  if (done.rowCount) await notify(pool, tx.initiator_id, 'Retrait effectué', `${tx.amount} FCFA envoyés sur ton compte Mobile Money`);
  return { status: 'completed' };
}

/** Rattrapage : retraits en cours depuis plus de 5 minutes, interrogés auprès de l'agrégateur. */
export async function reconcilePendingWithdrawals() {
  let settled = 0;
  const open = await many(pool,
    `SELECT reference FROM transactions WHERE type = 'withdrawal' AND status = 'completed' AND meta->>'payout' = ANY($1)
     AND created_at < now() - interval '5 minutes' ORDER BY created_at LIMIT 200`, [OPEN_PAYOUT]);
  for (const w of open) {
    try {
      const r = await checkWithdrawal(w.reference);
      if (r.status === 'completed' || r.status === 'failed') settled++;
    } catch (e) { console.error('Rapprochement du retrait', w.reference, e); }
  }
  return settled;
}

export async function reverseWithdrawal(txId: string) {
  return withTx(async (client) => {
    const tx = await one(client, "SELECT * FROM transactions WHERE id = $1 AND type = 'withdrawal' FOR UPDATE", [txId]);
    // Un décaissement confirmé par l'agrégateur ne s'annule jamais : l'argent est parti.
    if (!tx || tx.status !== 'completed' || tx.meta?.payout === 'completed') throw conflict('not_reversible', 'Transaction non annulable');
    const legs = await many(client, 'SELECT account_id, amount FROM ledger_entries WHERE tx_id = $1', [txId]);
    await post(client, {
      type: 'reversal', amount: tx.amount + tx.fee, initiatorId: tx.initiator_id, description: 'Annulation de retrait',
      meta: { reverses: tx.reference }, legs: legs.map((l) => ({ accountId: l.account_id, amount: -l.amount })),
    });
    await client.query(`UPDATE transactions SET status = 'reversed', meta = meta || '{"payout":"failed"}' WHERE id = $1`, [txId]);
    await notify(client, tx.initiator_id, 'Retrait annulé', `${tx.amount + tx.fee} FCFA recrédités sur ton portefeuille`);
  });
}

// ───── Transfert entre utilisateurs Smart Tontine (gratuit) ─────
router.post('/transfers', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({ toPhone: z.string(), amount, note: z.string().max(140).optional(), pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, body.pin);
  const recipient = await one(pool, "SELECT id, full_name FROM users WHERE phone = $1 AND status = 'active'", [body.toPhone]);
  if (!recipient) throw notFound('Destinataire Smart Tontine');
  if (recipient.id === user.id) throw badRequest('self_transfer', 'Impossible de t\'envoyer de l\'argent à toi-même');

  const tx = await withTx(async (client) => {
    const from = await walletOf(client, user.id);
    const to = await walletOf(client, recipient.id);
    const t = await post(client, {
      type: 'transfer', amount: body.amount, initiatorId: user.id, description: body.note ?? 'Transfert',
      meta: { to: recipient.id }, legs: [{ accountId: from.id, amount: -body.amount }, { accountId: to.id, amount: body.amount }],
    });
    await notify(client, recipient.id, 'Argent reçu', `+${body.amount} FCFA${body.note ? ` — ${body.note}` : ''}`);
    return t;
  });
  await track(pool, user.id, 'transfer', { amount: body.amount });
  res.status(201).json({ reference: tx.reference, to: recipient.full_name });
});
