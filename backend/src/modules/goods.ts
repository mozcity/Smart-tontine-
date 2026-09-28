import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { createAccount, post, systemAccount, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';
import { assertActivePartner, assertStaff, BRANDING_SQL, staffIds } from '../services/partners.js';
import { assertPin } from './auth.js';

// Biens matériels : catalogue des partenaires commerçants, plans d'achat individuels et
// commandes payées au séquestre (SYS_ESCROW) puis versées au fournisseur à la réception.
export const router = Router();

const CATEGORIES = ['moto', 'electromenager', 'telephone', 'mobilier', 'cuisine', 'textile', 'alimentaire', 'materiel_pro', 'autre'] as const;
const image = z.string().max(300_000).refine(
  (v) => /^https:\/\/\S+$/.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Image : lien https ou PNG/JPEG/WebP');

// ───── Catalogue ─────
router.get('/', async (req, res) => {
  const q = z.object({ category: z.enum(CATEGORIES).optional(), search: z.string().max(60).optional() }).parse(req.query);
  res.json(await many(pool,
    `SELECT g.id, g.name, g.description, g.category, g.price, g.image, g.stock, ${BRANDING_SQL} AS partner
     FROM goods g JOIN partners p ON p.id = g.partner_id
     WHERE g.active AND p.status = 'active' AND ($1::text IS NULL OR g.category = $1)
       AND ($2::text IS NULL OR g.name ILIKE '%' || $2 || '%') ORDER BY g.price`, [q.category ?? null, q.search ?? null]));
});

router.post('/partners/:partnerId', async (req, res) => {
  const { partner } = await assertActivePartner(pool, req.params.partnerId, currentUser(req).id);
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().max(500).optional(),
    category: z.enum(CATEGORIES),
    price: z.number().int().min(1000),
    image: image.optional(),
    stock: z.number().int().min(0).optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO goods (partner_id, name, description, category, price, image, stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [partner.id, body.name, body.description ?? null, body.category, body.price, body.image ?? null, body.stock ?? null]);
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const g = await one(pool, 'SELECT partner_id FROM goods WHERE id = $1', [req.params.id]);
  if (!g) throw notFound('Bien');
  await assertStaff(pool, g.partner_id, currentUser(req).id);
  const body = z.object({
    price: z.number().int().min(1000).optional(), stock: z.number().int().min(0).optional(),
    active: z.boolean().optional(), description: z.string().max(500).optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE goods SET price = COALESCE($2, price), stock = COALESCE($3, stock), active = COALESCE($4, active),
       description = COALESCE($5, description) WHERE id = $1 RETURNING *`,
    [req.params.id, body.price ?? null, body.stock ?? null, body.active ?? null, body.description ?? null]);
  res.json(rows[0]);
});

// ───── Commandes (séquestre) ─────
/**
 * Crée la commande d'un bien : l'argent passe du compte source (tontine ou plan) au séquestre.
 * Le fournisseur est prévenu ; il sera payé quand le bénéficiaire confirmera la réception.
 */
export async function createOrder(client: pg.PoolClient, o: {
  goodId: string; beneficiaryId: string; source: 'tontine' | 'plan'; sourceId: string; amount: number; fromAccountId: string;
}) {
  const g = await one(client, 'SELECT g.*, p.name AS partner_name FROM goods g JOIN partners p ON p.id = g.partner_id WHERE g.id = $1 FOR UPDATE OF g', [o.goodId]);
  const tx = await post(client, {
    type: 'goods_escrow', amount: o.amount, initiatorId: o.beneficiaryId, description: `Achat « ${g.name} » (séquestre)`,
    meta: { goodId: g.id, source: o.source, sourceId: o.sourceId },
    legs: [{ accountId: o.fromAccountId, amount: -o.amount }, { accountId: await systemAccount(client, 'SYS_ESCROW'), amount: o.amount }],
  });
  const order = await one(client,
    `INSERT INTO goods_orders (good_id, partner_id, beneficiary_id, source, source_id, amount) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [g.id, g.partner_id, o.beneficiaryId, o.source, o.sourceId, o.amount]);
  if (g.stock !== null) await client.query('UPDATE goods SET stock = GREATEST(0, stock - 1) WHERE id = $1', [g.id]);
  await notify(client, o.beneficiaryId, 'Ton bien est commandé 🛍️', `« ${g.name} » auprès de ${g.partner_name}. Confirme la réception dans l'app quand tu l'as reçu.`);
  for (const uid of await staffIds(client, g.partner_id)) {
    await notify(client, uid, 'Nouvelle commande', `« ${g.name} » à livrer (${o.amount} F au séquestre).`);
  }
  await track(client, o.beneficiaryId, 'goods_order', { goodId: g.id, amount: o.amount, tx: tx.id });
  return order;
}

router.get('/orders', async (req, res) => {
  res.json(await many(pool,
    `SELECT o.*, g.name AS good_name, g.image, ${BRANDING_SQL} AS partner FROM goods_orders o
     JOIN goods g ON g.id = o.good_id JOIN partners p ON p.id = o.partner_id
     WHERE o.beneficiary_id = $1 ORDER BY o.created_at DESC`, [currentUser(req).id]));
});

router.post('/orders/:id/ship', async (req, res) => {
  const { note } = z.object({ note: z.string().max(200).optional() }).parse(req.body);
  const out = await withTx(async (client) => {
    const o = await one(client, 'SELECT * FROM goods_orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!o) throw notFound('Commande');
    await assertStaff(client, o.partner_id, currentUser(req).id);
    if (o.status !== 'pending') throw conflict('bad_status', 'Commande déjà expédiée ou clôturée');
    await client.query("UPDATE goods_orders SET status = 'shipped', shipped_at = now(), delivery_note = $2 WHERE id = $1", [o.id, note ?? null]);
    await notify(client, o.beneficiary_id, 'Bien expédié / prêt', note ?? 'Ton bien est prêt : confirme la réception dans l\'app.');
    return { status: 'shipped' };
  });
  res.json(out);
});

/** Confirmation de réception par le bénéficiaire : le séquestre paie le fournisseur (moins la commission). */
router.post('/orders/:id/confirm', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const out = await withTx(async (client) => {
    const o = await one(client, 'SELECT * FROM goods_orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!o || o.beneficiary_id !== user.id) throw notFound('Commande');
    if (!['pending', 'shipped'].includes(o.status)) throw conflict('bad_status', 'Commande déjà clôturée');
    return releaseOrder(client, o);
  });
  res.json(out);
});

export async function releaseOrder(client: pg.PoolClient, o: any) {
  const commission = Math.ceil(o.amount * pricing.goods.supplierCommissionRate);
  const partner = await one(client, 'SELECT account_id, name FROM partners WHERE id = $1', [o.partner_id]);
  await post(client, {
    type: 'goods_payment', amount: o.amount, fee: commission, initiatorId: o.beneficiary_id,
    description: `Paiement fournisseur « ${partner.name} »`, meta: { orderId: o.id, partnerId: o.partner_id },
    legs: [
      { accountId: await systemAccount(client, 'SYS_ESCROW'), amount: -o.amount },
      { accountId: partner.account_id, amount: o.amount - commission },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: commission },
    ],
  });
  await client.query("UPDATE goods_orders SET status = 'delivered', delivered_at = now() WHERE id = $1", [o.id]);
  for (const uid of await staffIds(client, o.partner_id)) {
    await notify(client, uid, 'Réception confirmée ✅', `${o.amount - commission} F versés sur le compte partenaire.`);
  }
  return { status: 'delivered', paidToSupplier: o.amount - commission, commission };
}

/** Annulation par le fournisseur (rupture de stock…) : le séquestre rembourse le bénéficiaire. */
router.post('/orders/:id/cancel', async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(200).optional() }).parse(req.body);
  const out = await withTx(async (client) => {
    const o = await one(client, 'SELECT * FROM goods_orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!o) throw notFound('Commande');
    await assertStaff(client, o.partner_id, currentUser(req).id);
    if (!['pending', 'shipped'].includes(o.status)) throw conflict('bad_status', 'Commande déjà clôturée');
    const wallet = await walletOf(client, o.beneficiary_id);
    await post(client, {
      type: 'goods_refund', amount: o.amount, initiatorId: o.beneficiary_id, description: 'Remboursement commande annulée',
      meta: { orderId: o.id }, legs: [{ accountId: await systemAccount(client, 'SYS_ESCROW'), amount: -o.amount }, { accountId: wallet.id, amount: o.amount }],
    });
    await client.query("UPDATE goods_orders SET status = 'cancelled', delivery_note = $2 WHERE id = $1", [o.id, reason ?? null]);
    await notify(client, o.beneficiary_id, 'Commande annulée', `${o.amount} F remboursés sur ton jeton${reason ? ` — ${reason}` : ''}.`);
    return { status: 'cancelled', refunded: o.amount };
  });
  res.json(out);
});

/** Sans réclamation, une commande expédiée est confirmée automatiquement après le délai prévu. */
export async function autoConfirmOrders() {
  const due = await many(pool,
    `SELECT id FROM goods_orders WHERE status = 'shipped' AND shipped_at < now() - make_interval(days => $1)`, [pricing.goods.autoConfirmDays]);
  for (const { id } of due) {
    await withTx(async (client) => {
      const o = await one(client, "SELECT * FROM goods_orders WHERE id = $1 AND status = 'shipped' FOR UPDATE", [id]);
      if (o) await releaseOrder(client, o);
    });
  }
  return due.length;
}

// ───── Plans d'achat individuels ─────
router.get('/plans', async (req, res) => {
  res.json(await many(pool,
    `SELECT pl.*, a.balance, LEAST(100, round(100.0 * a.balance / pl.target_amount))::int AS progress,
            g.name AS good_name, g.image
     FROM goods_plans pl JOIN accounts a ON a.id = pl.account_id LEFT JOIN goods g ON g.id = pl.good_id
     WHERE pl.user_id = $1 ORDER BY pl.status = 'active' DESC, pl.created_at DESC`, [currentUser(req).id]));
});

router.post('/plans', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    goodId: z.uuid().optional(),
    label: z.string().trim().min(2).max(80).optional(),
    targetAmount: z.number().int().min(1000).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'free']).default('weekly'),
    installmentAmount: z.number().int().min(100).optional(),
  }).refine((b) => b.goodId || (b.label && b.targetAmount), 'Choisis un bien du catalogue ou indique un nom et un prix').parse(req.body);
  let label = body.label ?? '';
  let target = body.targetAmount ?? 0;
  if (body.goodId) {
    const g = await one(pool, "SELECT g.* FROM goods g JOIN partners p ON p.id = g.partner_id WHERE g.id = $1 AND g.active AND p.status = 'active'", [body.goodId]);
    if (!g) throw notFound('Bien');
    label = g.name;
    target = g.price;
  }
  const plan = await withTx(async (client) => {
    const accountId = await createAccount(client, user.id, 'plan_bien');
    return one(client,
      `INSERT INTO goods_plans (user_id, account_id, good_id, label, target_amount, frequency, installment_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, accountId, body.goodId ?? null, label, target, body.frequency, body.installmentAmount ?? null]);
  });
  await track(pool, user.id, 'goods_plan_created', { goodId: body.goodId });
  res.status(201).json(plan);
});

router.post('/plans/:id/pay', async (req, res) => {
  const user = currentUser(req);
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  const out = await withTx(async (client) => {
    const pl = await one(client, 'SELECT * FROM goods_plans WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, user.id]);
    if (!pl) throw notFound('Plan d\'achat');
    if (pl.status !== 'active') throw conflict('closed', 'Plan clôturé');
    const acc = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [pl.account_id]);
    const pay = Math.min(amount, pl.target_amount - acc.balance);
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'goods_plan_saving', amount: pay, initiatorId: user.id, description: `Plan d'achat « ${pl.label} »`,
      meta: { planId: pl.id }, legs: [{ accountId: wallet.id, amount: -pay }, { accountId: pl.account_id, amount: pay }],
    });
    const balance = acc.balance + pay;
    if (balance < pl.target_amount) return { balance, status: 'active', progress: Math.round((100 * balance) / pl.target_amount) };

    // Objectif atteint : commande au fournisseur (bien du catalogue) ou argent libéré pour acheter soi-même.
    await client.query("UPDATE goods_plans SET status = 'completed', closed_at = now() WHERE id = $1", [pl.id]);
    if (pl.good_id) {
      const order = await createOrder(client, {
        goodId: pl.good_id, beneficiaryId: user.id, source: 'plan', sourceId: pl.id, amount: balance, fromAccountId: pl.account_id,
      });
      return { balance, status: 'completed', orderId: order.id };
    }
    await post(client, {
      type: 'goods_plan_release', amount: balance, initiatorId: user.id, description: `Plan d'achat « ${pl.label} » atteint`,
      meta: { planId: pl.id }, legs: [{ accountId: pl.account_id, amount: -balance }, { accountId: wallet.id, amount: balance }],
    });
    await notify(client, user.id, 'Objectif atteint 🎉', `${balance} F sont sur ton jeton pour acheter « ${pl.label} ».`);
    return { balance, status: 'completed', released: balance };
  });
  res.json(out);
});

router.post('/plans/:id/cancel', async (req, res) => {
  const user = currentUser(req);
  const out = await withTx(async (client) => {
    const pl = await one(client, 'SELECT * FROM goods_plans WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, user.id]);
    if (!pl) throw notFound('Plan d\'achat');
    if (pl.status !== 'active') throw forbidden('Plan déjà clôturé');
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [pl.account_id]);
    if (balance > 0) {
      const wallet = await walletOf(client, user.id);
      await post(client, {
        type: 'goods_plan_release', amount: balance, initiatorId: user.id, description: `Plan d'achat « ${pl.label} » annulé`,
        meta: { planId: pl.id }, legs: [{ accountId: pl.account_id, amount: -balance }, { accountId: wallet.id, amount: balance }],
      });
    }
    await client.query("UPDATE goods_plans SET status = 'cancelled', closed_at = now() WHERE id = $1", [pl.id]);
    return { status: 'cancelled', refunded: balance };
  });
  res.json(out);
});
