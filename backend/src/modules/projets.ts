import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { createAccount, post, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';

export const router = Router();

router.get('/', async (req, res) => {
  res.json(await many(pool,
    `SELECT p.*, a.balance, LEAST(100, round(100.0 * a.balance / p.target_amount))::int AS progress,
            (SELECT json_agg(s ORDER BY s.position) FROM projet_steps s WHERE s.projet_id = p.id) AS steps
     FROM projets p JOIN accounts a ON a.id = p.account_id WHERE p.user_id = $1 ORDER BY p.status, p.created_at DESC`,
    [currentUser(req).id]));
});

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(60),
    category: z.enum(['voyage', 'logement', 'commerce', 'etudes', 'mariage', 'vehicule', 'autre']).default('autre'),
    targetAmount: z.number().int().min(1000),
    deadline: z.iso.date().optional(),
    steps: z.array(z.object({ title: z.string().min(1).max(80), amount: z.number().int().positive().optional() })).max(20).default([]),
  }).parse(req.body);
  const projet = await withTx(async (client) => {
    const accountId = await createAccount(client, user.id, 'projet');
    const p = await one(client,
      'INSERT INTO projets (user_id, account_id, name, category, target_amount, deadline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user.id, accountId, body.name, body.category, body.targetAmount, body.deadline ?? null]);
    for (const [i, s] of body.steps.entries()) {
      await client.query('INSERT INTO projet_steps (projet_id, position, title, amount) VALUES ($1, $2, $3, $4)', [p.id, i + 1, s.title, s.amount ?? null]);
    }
    return p;
  });
  await track(pool, user.id, 'projet_created', { category: body.category });
  res.status(201).json(projet);
});

async function mine(client: import('pg').PoolClient, userId: string, id: string) {
  const p = await one(client, 'SELECT * FROM projets WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
  if (!p) throw notFound('Projet');
  if (p.status !== 'active') throw conflict('closed', 'Projet clôturé');
  return p;
}

router.post('/:id/contribute', async (req, res) => {
  const user = currentUser(req);
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  const out = await withTx(async (client) => {
    const p = await mine(client, user.id, req.params.id as string);
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'projet_contribution', amount, initiatorId: user.id, description: `Projet « ${p.name} »`,
      legs: [{ accountId: wallet.id, amount: -amount }, { accountId: p.account_id, amount }],
    });
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [p.account_id]);
    if (balance >= p.target_amount && balance - amount < p.target_amount) {
      await notify(client, user.id, 'Objectif atteint 🎯', `Ton projet « ${p.name} » est financé à 100 %`);
    }
    return { balance, progress: Math.min(100, Math.round((100 * balance) / p.target_amount)) };
  });
  res.json(out);
});

router.post('/:id/steps/:stepId/done', async (req, res) => {
  const r = await pool.query(
    `UPDATE projet_steps s SET done_at = now() FROM projets p
     WHERE s.id = $1 AND s.projet_id = p.id AND p.id = $2 AND p.user_id = $3`,
    [req.params.stepId, req.params.id, currentUser(req).id]);
  if (!r.rowCount) throw notFound('Étape');
  res.json({ ok: true });
});

/** Clôture : l'argent du projet revient sur le portefeuille, sans frais. */
router.post('/:id/close', async (req, res) => {
  const user = currentUser(req);
  const out = await withTx(async (client) => {
    const p = await mine(client, user.id, req.params.id as string);
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [p.account_id]);
    if (balance > 0) {
      const wallet = await walletOf(client, user.id);
      await post(client, {
        type: 'projet_payout', amount: balance, initiatorId: user.id, description: `Projet « ${p.name} » clôturé`,
        legs: [{ accountId: p.account_id, amount: -balance }, { accountId: wallet.id, amount: balance }],
      });
    }
    const status = balance >= p.target_amount ? 'achieved' : 'cancelled';
    await client.query('UPDATE projets SET status = $2 WHERE id = $1', [p.id, status]);
    return { status, returned: balance };
  });
  res.json(out);
});
