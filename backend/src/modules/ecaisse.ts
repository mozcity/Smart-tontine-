import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { fee, pricing } from '../pricing.js';
import { createAccount, post, systemAccount, walletOf } from '../services/ledger.js';
import { track } from '../services/notify.js';
import { assertPin } from './auth.js';

export const router = Router();

router.get('/', async (req, res) => {
  res.json(await many(pool,
    `SELECT e.*, a.balance FROM ecaisses e JOIN accounts a ON a.id = e.account_id
     WHERE e.user_id = $1 ORDER BY e.status = 'locked' DESC, e.unlock_at`, [currentUser(req).id]));
});

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(60),
    amount: z.number().int().min(500),
    unlockAt: z.coerce.date(),
    targetAmount: z.number().int().positive().optional(),
  }).parse(req.body);
  if (body.unlockAt.getTime() < Date.now() + 24 * 3600 * 1000) {
    throw badRequest('unlock_too_soon', 'La date de déblocage doit être au moins demain');
  }
  const ecaisse = await withTx(async (client) => {
    const accountId = await createAccount(client, user.id, 'ecaisse');
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'ecaisse_lock', amount: body.amount, initiatorId: user.id, description: `E-caisse « ${body.name} »`,
      legs: [{ accountId: wallet.id, amount: -body.amount }, { accountId, amount: body.amount }],
    });
    return one(client,
      `INSERT INTO ecaisses (user_id, account_id, name, target_amount, unlock_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, accountId, body.name, body.targetAmount ?? null, body.unlockAt]);
  });
  await track(pool, user.id, 'ecaisse_created', { amount: body.amount });
  res.status(201).json(ecaisse);
});

async function mine(client: import('pg').PoolClient, userId: string, id: string) {
  const e = await one(client, 'SELECT * FROM ecaisses WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
  if (!e) throw notFound('E-caisse');
  if (e.status !== 'locked') throw conflict('closed', 'Cette e-caisse est déjà clôturée');
  return e;
}

router.post('/:id/topup', async (req, res) => {
  const user = currentUser(req);
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  await withTx(async (client) => {
    const e = await mine(client, user.id, req.params.id as string);
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'ecaisse_lock', amount, initiatorId: user.id, description: `E-caisse « ${e.name} »`,
      legs: [{ accountId: wallet.id, amount: -amount }, { accountId: e.account_id, amount }],
    });
  });
  res.json({ ok: true });
});

/** Déblocage à l'échéance : gratuit. */
router.post('/:id/release', async (req, res) => {
  const user = currentUser(req);
  const released = await withTx(async (client) => {
    const e = await mine(client, user.id, req.params.id as string);
    if (new Date(e.unlock_at).getTime() > Date.now()) {
      throw conflict('still_locked', 'Pas encore l\'échéance. Tu peux casser la caisse avec une pénalité.');
    }
    return closeEcaisse(client, e, 'released', 0);
  });
  res.json(released);
});

/** Rupture anticipée : pénalité de 2 % (min 200 F), c'est ce qui rend l'épargne « bloquée ». */
router.post('/:id/break', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const result = await withTx(async (client) => {
    const e = await mine(client, user.id, req.params.id as string);
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [e.account_id]);
    return closeEcaisse(client, e, 'broken', Math.min(balance, fee(balance, pricing.ecaisseEarlyBreak)));
  });
  await track(pool, user.id, 'ecaisse_broken', result);
  res.json(result);
});

export async function closeEcaisse(client: import('pg').PoolClient, e: any, status: 'released' | 'broken', penalty: number) {
  const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [e.account_id]);
  if (balance > 0) {
    const wallet = await walletOf(client, e.user_id);
    await post(client, {
      type: status === 'released' ? 'ecaisse_release' : 'ecaisse_break', amount: balance, fee: penalty,
      initiatorId: e.user_id, description: `E-caisse « ${e.name} » ${status === 'released' ? 'débloquée' : 'cassée'}`,
      legs: [
        { accountId: e.account_id, amount: -balance },
        { accountId: wallet.id, amount: balance - penalty },
        { accountId: await systemAccount(client, 'SYS_FEES'), amount: penalty },
      ],
    });
  }
  await client.query('UPDATE ecaisses SET status = $2, closed_at = now() WHERE id = $1', [e.id, status]);
  return { status, returned: balance - penalty, penalty };
}
