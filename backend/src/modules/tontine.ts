import { Router } from 'express';
import type pg from 'pg';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { createAccount, post, systemAccount, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';
import { assertCanOrganize } from '../services/pro.js';
import { assertActivePartner, BRANDING_SQL } from '../services/partners.js';
import { createOrder } from './goods.js';
import { settleAdvanceFromPayout } from './credit.js';

// Tontine rotative en ligne : chaque tour, tous les membres cotisent ; le bénéficiaire du tour
// reçoit le pot. Une caution bloquée à l'adhésion couvre automatiquement un impayé.
export const router = Router();

const today = () => new Date().toISOString().slice(0, 10);
const frDate = (iso: string) => iso.split('-').reverse().join('/');
const isoDate = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

function dueDate(start: string, frequency: 'weekly' | 'monthly', index: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * index);
  else d.setUTCMonth(d.getUTCMonth() + index);
  return d.toISOString().slice(0, 10);
}

async function load(db: pg.PoolClient | pg.Pool, id: string, lock = false) {
  const t = await one(db, `SELECT * FROM tontines WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!t) throw notFound('Tontine');
  return t;
}

/** L'organisateur, ou toute l'équipe du partenaire pour une tontine de partenaire, gère la tontine. */
async function canManage(db: pg.PoolClient | pg.Pool, t: any, userId: string): Promise<boolean> {
  if (t.organizer_id === userId) return true;
  if (!t.partner_id) return false;
  return !!(await one(db, 'SELECT 1 FROM partner_staff WHERE partner_id = $1 AND user_id = $2', [t.partner_id, userId]));
}

async function member(db: pg.PoolClient | pg.Pool, tontineId: string, userId: string) {
  const m = await one(db, 'SELECT * FROM tontine_members WHERE tontine_id = $1 AND user_id = $2', [tontineId, userId]);
  if (!m) throw notFound('Tontine');
  return m;
}

router.get('/', async (req, res) => {
  res.json(await many(pool,
    `SELECT t.id, t.name, t.kind, t.visibility, t.good_label, t.good_price, t.contribution_amount, t.frequency, t.max_members, t.status, t.organizer_id, m.position,
            (SELECT ${BRANDING_SQL} FROM partners p WHERE p.id = t.partner_id) AS partner,
            (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id) AS members,
            (SELECT json_build_object('number', r.number, 'due_date', r.due_date, 'beneficiary_id', r.beneficiary_id,
                     'paid', EXISTS (SELECT 1 FROM tontine_contributions c WHERE c.round_id = r.id AND c.user_id = $1))
             FROM tontine_rounds r WHERE r.tontine_id = t.id AND r.status = 'open' ORDER BY r.number LIMIT 1) AS current_round,
            (SELECT r.due_date FROM tontine_rounds r WHERE r.tontine_id = t.id AND r.beneficiary_id = $1) AS my_turn
     FROM tontines t JOIN tontine_members m ON m.tontine_id = t.id AND m.user_id = $1
     ORDER BY t.status = 'completed', t.created_at DESC`, [currentUser(req).id]));
});

/** Tontines publiques en recrutement (argent ou biens), visibles par tous dans « Découvrir ». */
router.get('/public', async (req, res) => {
  const q = z.object({ kind: z.enum(['argent', 'bien']).optional(), search: z.string().max(60).optional() }).parse(req.query);
  res.json(await many(pool,
    `SELECT t.id, t.name, t.description, t.kind, t.contribution_amount, t.frequency, t.max_members, t.guarantee_amount,
            t.good_label, t.good_price, g.image AS good_image,
            (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id) AS members,
            (SELECT ${BRANDING_SQL} FROM partners p WHERE p.id = t.partner_id) AS partner
     FROM tontines t LEFT JOIN goods g ON g.id = t.good_id
     WHERE t.visibility = 'public' AND t.status = 'recruiting'
       AND ($1::text IS NULL OR t.kind = $1) AND ($2::text IS NULL OR t.name ILIKE '%' || $2 || '%' OR t.good_label ILIKE '%' || $2 || '%')
     ORDER BY t.created_at DESC LIMIT 50`, [q.kind ?? null, q.search ?? null]));
});

/** Aperçu public d'une tontine (lien d'invitation) avant d'y adhérer. */
router.get('/:id/preview', async (req, res) => {
  const t = await load(pool, req.params.id);
  const organizer = await one(pool, 'SELECT full_name FROM users WHERE id = $1', [t.organizer_id]);
  const count = await one(pool, 'SELECT count(*)::int AS n FROM tontine_members WHERE tontine_id = $1', [t.id]);
  const partner = t.partner_id ? await one(pool, `SELECT ${BRANDING_SQL} AS b FROM partners p WHERE p.id = $1`, [t.partner_id]) : null;
  res.json({
    id: t.id, name: t.name, description: t.description, organizer: partner?.b.name ?? organizer.full_name, status: t.status,
    kind: t.kind, visibility: t.visibility, good_label: t.good_label, good_price: t.good_price, partner: partner?.b ?? null,
    contribution_amount: t.contribution_amount, frequency: t.frequency, max_members: t.max_members,
    guarantee_amount: t.guarantee_amount, members: count.n, pot: t.contribution_amount * t.max_members,
  });
});

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().max(280).optional(),
    contributionAmount: z.number().int().min(500).max(5_000_000).optional(),
    frequency: z.enum(['weekly', 'monthly']),
    maxMembers: z.number().int().min(2).max(50),
    orderMode: z.enum(['random', 'fixed']).default('random'),
    guaranteeAmount: z.number().int().min(0).optional(),
    // Tontine de biens : un bien du catalogue (fournisseur partenaire) ou un bien libre (nom + prix).
    kind: z.enum(['argent', 'bien']).default('argent'),
    goodId: z.uuid().optional(),
    goodLabel: z.string().trim().min(2).max(80).optional(),
    goodPrice: z.number().int().min(1000).optional(),
    // Publique : visible dans « Découvrir » ; privée : sur invitation (code, lien, QR).
    visibility: z.enum(['private', 'public']).default('private'),
    // Organisée au nom d'un partenaire (logo, couleurs, frais de gestion du partenaire).
    partnerId: z.uuid().optional(),
    joinAsMember: z.boolean().optional(),
  }).parse(req.body);

  let partner: any = null;
  if (body.partnerId) partner = (await assertActivePartner(pool, body.partnerId, user.id)).partner;
  else await assertCanOrganize(pool, user.id); // les partenaires paient une licence : pas de limite Pro

  let goodLabel: string | null = null;
  let goodPrice: number | null = null;
  if (body.kind === 'bien') {
    if (body.goodId) {
      const g = await one(pool, "SELECT g.* FROM goods g JOIN partners p ON p.id = g.partner_id WHERE g.id = $1 AND g.active AND p.status = 'active'", [body.goodId]);
      if (!g) throw notFound('Bien du catalogue');
      goodLabel = g.name;
      goodPrice = g.price;
    } else if (body.goodLabel && body.goodPrice) {
      goodLabel = body.goodLabel;
      goodPrice = body.goodPrice;
    } else {
      throw badRequest('good_required', 'Choisis un bien du catalogue ou indique le nom et le prix du bien');
    }
  }
  // Cotisation d'une tontine de biens : le pot net (après commission et frais du partenaire) doit couvrir le prix.
  const mgmtRate = Number(partner?.management_fee_rate ?? 0);
  const contribution = body.contributionAmount ?? (goodPrice
    ? Math.ceil(goodPrice / (body.maxMembers * (1 - pricing.tontine.commissionRate - mgmtRate)) / 25) * 25
    : undefined);
  if (!contribution) throw badRequest('contribution_required', 'Indique le montant de la cotisation');
  if (goodPrice && contribution * body.maxMembers * (1 - pricing.tontine.commissionRate - mgmtRate) < goodPrice) {
    throw badRequest('pot_too_small', `Cotisation trop faible pour financer le bien (${goodPrice} F)`);
  }
  // Par défaut la caution vaut une cotisation : elle couvre un tour impayé.
  const guarantee = body.guaranteeAmount ?? contribution;
  const joins = body.joinAsMember ?? !partner; // un partenaire organise sans forcément cotiser lui-même
  const t = await withTx(async (client) => {
    const accountId = await createAccount(client, null, 'tontine');
    const row = await one(client,
      `INSERT INTO tontines (account_id, organizer_id, name, description, contribution_amount, frequency, max_members, order_mode, guarantee_amount,
                             kind, good_id, good_label, good_price, visibility, partner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [accountId, user.id, body.name, body.description ?? null, contribution, body.frequency, body.maxMembers, body.orderMode, guarantee,
        body.kind, body.goodId ?? null, goodLabel, goodPrice, body.visibility, partner?.id ?? null]);
    if (joins) await addMember(client, row, user.id);
    return row;
  });
  await track(pool, user.id, 'tontine_created', { amount: contribution, members: body.maxMembers, kind: body.kind, partner: !!partner });
  res.status(201).json(t);
});

async function addMember(client: pg.PoolClient, t: any, userId: string) {
  if (t.guarantee_amount > 0) {
    const wallet = await walletOf(client, userId);
    await post(client, {
      type: 'tontine_guarantee', amount: t.guarantee_amount, initiatorId: userId, description: `Caution tontine « ${t.name} »`,
      meta: { tontineId: t.id }, legs: [{ accountId: wallet.id, amount: -t.guarantee_amount }, { accountId: t.account_id, amount: t.guarantee_amount }],
    });
  }
  await client.query('INSERT INTO tontine_members (tontine_id, user_id) VALUES ($1, $2)', [t.id, userId]);
}

router.post('/:id/join', async (req, res) => {
  const user = currentUser(req);
  await withTx(async (client) => {
    const t = await load(client, req.params.id as string, true);
    if (t.status !== 'recruiting') throw conflict('not_recruiting', 'Cette tontine a déjà démarré');
    const exists = await one(client, 'SELECT 1 FROM tontine_members WHERE tontine_id = $1 AND user_id = $2', [t.id, user.id]);
    if (exists) throw conflict('already_member', 'Tu es déjà membre de cette tontine');
    const count = await one(client, 'SELECT count(*)::int AS n FROM tontine_members WHERE tontine_id = $1', [t.id]);
    if (count.n >= t.max_members) throw conflict('full', 'Tontine complète');
    await addMember(client, t, user.id);
    await notify(client, t.organizer_id, 'Nouveau membre', `Un membre a rejoint « ${t.name} » (${count.n + 1}/${t.max_members})`);
  });
  await track(pool, user.id, 'tontine_joined', { tontineId: req.params.id });
  res.status(201).json({ ok: true });
});

router.post('/:id/leave', async (req, res) => {
  const user = currentUser(req);
  await withTx(async (client) => {
    const t = await load(client, req.params.id as string, true);
    if (t.status !== 'recruiting') throw conflict('started', 'Impossible de quitter une tontine démarrée');
    if (t.organizer_id === user.id) throw badRequest('organizer', 'L\'organisateur ne peut pas quitter sa tontine');
    await member(client, t.id, user.id);
    if (t.guarantee_amount > 0) await returnGuarantee(client, t, user.id);
    await client.query('DELETE FROM tontine_members WHERE tontine_id = $1 AND user_id = $2', [t.id, user.id]);
  });
  res.json({ ok: true });
});

async function returnGuarantee(client: pg.PoolClient, t: any, userId: string) {
  const wallet = await walletOf(client, userId);
  await post(client, {
    type: 'tontine_guarantee_return', amount: t.guarantee_amount, initiatorId: userId, description: `Caution rendue « ${t.name} »`,
    meta: { tontineId: t.id }, legs: [{ accountId: t.account_id, amount: -t.guarantee_amount }, { accountId: wallet.id, amount: t.guarantee_amount }],
  });
}

/** Démarrage : fixe l'ordre de passage et génère le calendrier des tours. */
router.post('/:id/start', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    startDate: z.iso.date().optional(),
    order: z.array(z.uuid()).optional(),
  }).parse(req.body);
  const result = await withTx(async (client) => {
    const t = await load(client, req.params.id as string, true);
    if (!(await canManage(client, t, user.id))) throw forbidden('Seul l\'organisateur démarre la tontine');
    if (t.status !== 'recruiting') throw conflict('already_started', 'Tontine déjà démarrée');
    const members = await many(client, 'SELECT user_id FROM tontine_members WHERE tontine_id = $1 ORDER BY joined_at', [t.id]);
    if (members.length < 2) throw badRequest('not_enough_members', 'Il faut au moins 2 membres');
    if (t.kind === 'bien' && members.length < t.max_members) {
      throw badRequest('not_full', `Une tontine de biens démarre complète (${members.length}/${t.max_members}) : sinon le pot ne couvre pas le prix du bien`);
    }

    let order = members.map((m) => m.user_id as string);
    if (t.order_mode === 'fixed' && body.order) {
      if (body.order.length !== order.length || !order.every((id) => body.order!.includes(id))) {
        throw badRequest('invalid_order', 'L\'ordre doit contenir chaque membre une seule fois');
      }
      order = body.order;
    } else if (t.order_mode === 'random') {
      // Tirage au sort équitable (Fisher-Yates, aléa cryptographique) : personne ne peut le truquer.
      for (let i = order.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    const start = body.startDate ?? today();
    for (const [i, userId] of order.entries()) {
      await client.query('UPDATE tontine_members SET position = $3 WHERE tontine_id = $1 AND user_id = $2', [t.id, userId, i + 1]);
      await client.query('INSERT INTO tontine_rounds (tontine_id, number, beneficiary_id, due_date) VALUES ($1, $2, $3, $4)',
        [t.id, i + 1, userId, dueDate(start, t.frequency, i)]);
      await notify(client, userId, `Tontine « ${t.name} » démarrée`, `Ton tour : n° ${i + 1} le ${frDate(dueDate(start, t.frequency, i))}`);
    }
    await client.query("UPDATE tontines SET status = 'active', start_date = $2, max_members = $3 WHERE id = $1", [t.id, start, order.length]);
    return { status: 'active', order };
  });
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const userId = currentUser(req).id;
  const id = req.params.id;
  const t = await one(pool, 'SELECT t.*, a.balance FROM tontines t JOIN accounts a ON a.id = t.account_id WHERE t.id = $1', [id]);
  if (!t) throw notFound('Tontine');
  const me = await one(pool, 'SELECT * FROM tontine_members WHERE tontine_id = $1 AND user_id = $2', [id, userId]);
  const manager = await canManage(pool, t, userId);
  if (!me && !manager) throw notFound('Tontine');
  const partner = t.partner_id ? (await one(pool, `SELECT ${BRANDING_SQL} AS b FROM partners p WHERE p.id = $1`, [t.partner_id])).b : null;
  const order = await many(pool,
    `SELECT o.id, o.status, o.amount, o.beneficiary_id, o.created_at FROM goods_orders o WHERE o.source = 'tontine' AND o.source_id = $1`, [id]);
  const members = await many(pool,
    `SELECT u.id, u.full_name, u.phone, m.position, m.status, m.guarantee_status
     FROM tontine_members m JOIN users u ON u.id = m.user_id WHERE m.tontine_id = $1 ORDER BY m.position NULLS LAST, m.joined_at`, [id]);
  const rounds = await many(pool,
    `SELECT r.*, (SELECT json_agg(json_build_object('userId', c.user_id, 'source', c.source, 'late', c.late, 'paidAt', c.paid_at))
                  FROM tontine_contributions c WHERE c.round_id = r.id) AS contributions
     FROM tontine_rounds r WHERE r.tontine_id = $1 ORDER BY r.number`, [id]);
  res.json({ ...t, pot: t.contribution_amount * members.length, me: me ?? null, manager, partner, orders: order, members, rounds });
});

router.post('/:id/rounds/:number/contribute', async (req, res) => {
  const user = currentUser(req);
  const result = await withTx(async (client) => {
    const t = await load(client, req.params.id as string);
    await member(client, t.id, user.id);
    if (t.status !== 'active') throw conflict('not_active', 'La tontine n\'est pas en cours');
    const round = await one(client, 'SELECT * FROM tontine_rounds WHERE tontine_id = $1 AND number = $2 FOR UPDATE', [t.id, Number(req.params.number)]);
    if (!round) throw notFound('Tour');
    if (round.status !== 'open') throw conflict('round_closed', 'Ce tour est clôturé');
    const paid = await one(client, 'SELECT 1 FROM tontine_contributions WHERE round_id = $1 AND user_id = $2', [round.id, user.id]);
    if (paid) throw conflict('already_paid', 'Cotisation déjà payée pour ce tour');

    const late = today() > isoDate(round.due_date);
    const penalty = late ? Math.ceil(t.contribution_amount * pricing.tontine.latePenaltyRate) : 0;
    const wallet = await walletOf(client, user.id);
    const tx = await post(client, {
      type: 'tontine_contribution', amount: t.contribution_amount + penalty, initiatorId: user.id,
      description: `Tontine « ${t.name} » — tour ${round.number}${late ? ' (retard)' : ''}`,
      meta: { tontineId: t.id, round: round.number, penalty },
      legs: [{ accountId: wallet.id, amount: -(t.contribution_amount + penalty) }, { accountId: t.account_id, amount: t.contribution_amount + penalty }],
    });
    await client.query(
      `INSERT INTO tontine_contributions (round_id, user_id, amount, penalty, source, late, tx_id) VALUES ($1, $2, $3, $4, 'wallet', $5, $6)`,
      [round.id, user.id, t.contribution_amount, penalty, late, tx.id]);
    return payoutRound(client, round.id, false);
  });
  await track(pool, user.id, 'tontine_contribution', { tontineId: req.params.id });
  res.status(201).json(result);
});

/** Clôture forcée d'un tour échu (organisateur) : les cautions couvrent les impayés. */
router.post('/:id/rounds/:number/close', async (req, res) => {
  const user = currentUser(req);
  const result = await withTx(async (client) => {
    const t = await load(client, req.params.id as string);
    if (!(await canManage(client, t, user.id))) throw forbidden('Seul l\'organisateur peut clôturer un tour');
    const round = await one(client, 'SELECT * FROM tontine_rounds WHERE tontine_id = $1 AND number = $2 FOR UPDATE', [t.id, Number(req.params.number)]);
    if (!round) throw notFound('Tour');
    if (round.status !== 'open') throw conflict('round_closed', 'Ce tour est déjà versé');
    if (isoDate(round.due_date) > today()) throw conflict('not_due', 'Le tour n\'est pas encore échu');
    return payoutRound(client, round.id, true);
  });
  res.json(result);
});

/**
 * Verse le pot du tour au bénéficiaire quand tout le monde a cotisé (ou, si `force`,
 * après avoir mobilisé les cautions des membres défaillants). Sur le pot sont déduits :
 * la commission Smart Tontine, l'avance sur tontine éventuelle, et la reconstitution de la
 * caution si le bénéficiaire est lui-même défaillant.
 */
export async function payoutRound(client: pg.PoolClient, roundId: string, force: boolean) {
  const round = await one(client, 'SELECT * FROM tontine_rounds WHERE id = $1 FOR UPDATE', [roundId]);
  const t = await one(client, 'SELECT * FROM tontines WHERE id = $1 FOR UPDATE', [round.tontine_id]);
  const missing = await many(client,
    `SELECT m.* FROM tontine_members m WHERE m.tontine_id = $1
     AND NOT EXISTS (SELECT 1 FROM tontine_contributions c WHERE c.round_id = $2 AND c.user_id = m.user_id)`, [t.id, round.id]);
  if (missing.length && !force) {
    return { round: round.number, status: 'collecting', missing: missing.length };
  }
  for (const m of missing) {
    if (m.guarantee_status === 'held' && t.guarantee_amount >= t.contribution_amount) {
      // La caution est déjà sur le compte de la tontine : elle devient la cotisation du défaillant.
      await client.query(
        `INSERT INTO tontine_contributions (round_id, user_id, amount, source, late) VALUES ($1, $2, $3, 'guarantee', true)`,
        [round.id, m.user_id, t.contribution_amount]);
      await client.query(
        "UPDATE tontine_members SET guarantee_status = 'used', status = 'defaulter' WHERE tontine_id = $1 AND user_id = $2", [t.id, m.user_id]);
      await notify(client, m.user_id, 'Cotisation impayée', `Ta caution a couvert le tour ${round.number} de « ${t.name} ». Ton score baisse.`);
    } else {
      await client.query("UPDATE tontine_members SET status = 'defaulter' WHERE tontine_id = $1 AND user_id = $2", [t.id, m.user_id]);
    }
  }

  const { pot } = await one(client, 'SELECT COALESCE(sum(amount + penalty), 0)::bigint AS pot FROM tontine_contributions WHERE round_id = $1', [round.id]);
  const commission = Math.ceil(pot * pricing.tontine.commissionRate);
  // Tontine de partenaire : ses frais de gestion (≤ 3 %) vont sur son compte partenaire.
  const partner = t.partner_id ? await one(client, 'SELECT account_id, management_fee_rate FROM partners WHERE id = $1', [t.partner_id]) : null;
  const mgmtFee = partner ? Math.floor(pot * Number(partner.management_fee_rate)) : 0;
  const beneficiary = await one(client, 'SELECT * FROM tontine_members WHERE tontine_id = $1 AND user_id = $2', [t.id, round.beneficiary_id]);
  const replenish = beneficiary.guarantee_status === 'used' && pot - commission - mgmtFee >= t.guarantee_amount ? t.guarantee_amount : 0;
  const wallet = await walletOf(client, round.beneficiary_id);

  const advance = await settleAdvanceFromPayout(client, round.id);
  const net = pot - commission - mgmtFee - replenish - (advance?.total ?? 0);
  if (net < 0) throw new Error('Pot insuffisant pour couvrir les déductions');

  const tx = await post(client, {
    type: 'tontine_payout', amount: pot, fee: commission, initiatorId: round.beneficiary_id,
    description: `Pot tontine « ${t.name} » — tour ${round.number}`,
    meta: { tontineId: t.id, round: round.number, advance: advance?.total ?? 0, replenish, managementFee: mgmtFee },
    legs: [
      { accountId: t.account_id, amount: -(pot - replenish) },
      { accountId: wallet.id, amount: net },
      ...(partner ? [{ accountId: partner.account_id, amount: mgmtFee }] : []),
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: commission + (advance?.smartTontineInterest ?? 0) },
      { accountId: await systemAccount(client, 'SYS_CREDIT'), amount: advance?.principal ?? 0 },
      { accountId: await systemAccount(client, 'SYS_CREDIT_INCOME'), amount: advance?.partnerInterest ?? 0 },
    ],
  });
  if (advance) await advance.markRepaid(tx.id);
  if (replenish) {
    await client.query("UPDATE tontine_members SET guarantee_status = 'held' WHERE tontine_id = $1 AND user_id = $2", [t.id, round.beneficiary_id]);
  }
  await client.query("UPDATE tontine_rounds SET status = 'paid_out', payout_amount = $2, payout_tx_id = $3, paid_out_at = now() WHERE id = $1",
    [round.id, net, tx.id]);
  let orderId: string | null = null;
  if (t.kind === 'bien' && t.good_id) {
    // Tontine de biens (catalogue) : le prix du bien part au séquestre et le fournisseur est prévenu ;
    // le reste éventuel du pot reste sur le jeton. Si le pot ne suffit pas (impayés non couverts), le
    // bénéficiaire complète avec son solde ; sinon il garde l'argent et achète lui-même.
    const w = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [wallet.id]);
    if (w.balance >= t.good_price) {
      const order = await createOrder(client, {
        goodId: t.good_id, beneficiaryId: round.beneficiary_id, source: 'tontine', sourceId: t.id, amount: t.good_price, fromAccountId: wallet.id,
      });
      orderId = order.id;
    } else {
      await notify(client, round.beneficiary_id, 'Pot insuffisant pour le bien',
        `+${net} FCFA sur ton jeton : complète pour commander « ${t.good_label} » ou achète-le toi-même.`);
    }
  } else if (t.kind === 'bien') {
    await notify(client, round.beneficiary_id, 'C\'est ton tour 🎉', `+${net} FCFA sur ton jeton pour acheter « ${t.good_label} »`);
  } else {
    await notify(client, round.beneficiary_id, 'C\'est ton tour 🎉', `+${net} FCFA : le pot de « ${t.name} » est sur ton jeton`);
  }
  await track(client, round.beneficiary_id, 'tontine_payout', { amount: net, kind: t.kind });

  const left = await one(client, "SELECT count(*)::int AS n FROM tontine_rounds WHERE tontine_id = $1 AND status = 'open'", [t.id]);
  if (left.n === 0) {
    for (const m of await many(client, "SELECT user_id FROM tontine_members WHERE tontine_id = $1 AND guarantee_status = 'held'", [t.id])) {
      if (t.guarantee_amount > 0) await returnGuarantee(client, t, m.user_id);
      await client.query("UPDATE tontine_members SET guarantee_status = 'returned' WHERE tontine_id = $1 AND user_id = $2", [t.id, m.user_id]);
    }
    await client.query("UPDATE tontines SET status = 'completed' WHERE id = $1", [t.id]);
  }
  return { round: round.number, status: 'paid_out', pot, commission, managementFee: mgmtFee, advanceRepaid: advance?.total ?? 0, net, orderId };
}

/** Tours échus depuis plus que le délai de grâce : versés automatiquement (appelé par les jobs). */
export async function closeOverdueRounds() {
  const due = await many(pool,
    `SELECT r.id FROM tontine_rounds r JOIN tontines t ON t.id = r.tontine_id
     WHERE t.status = 'active' AND r.status = 'open' AND r.due_date + $1::int < CURRENT_DATE ORDER BY r.due_date`,
    [pricing.tontine.graceDays]);
  let closed = 0;
  for (const r of due) {
    await withTx((client) => payoutRound(client, r.id, true));
    closed++;
  }
  return closed;
}
