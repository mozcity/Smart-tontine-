import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { createAccount, post, systemAccount, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';

export const router = Router();

router.get('/', async (req, res) => {
  const userId = currentUser(req).id;
  const catalog = await many(pool, 'SELECT * FROM challenges WHERE active ORDER BY duration_days');
  const mine = await many(pool,
    `SELECT p.*, c.code, c.title, c.target_amount, a.balance,
            LEAST(100, round(100.0 * a.balance / c.target_amount))::int AS progress
     FROM challenge_participations p JOIN challenges c ON c.id = p.challenge_id JOIN accounts a ON a.id = p.account_id
     WHERE p.user_id = $1 ORDER BY p.started_at DESC`, [userId]);
  res.json({ catalog, mine });
});

router.get('/leaderboard', async (_req, res) => {
  // Seul le prénom est exposé (vie privée).
  res.json(await many(pool,
    `SELECT split_part(COALESCE(full_name, 'Anonyme'), ' ', 1) AS name, points
     FROM users WHERE points > 0 AND role = 'customer' ORDER BY points DESC LIMIT 20`));
});

router.post('/:code/join', async (req, res) => {
  const user = currentUser(req);
  const p = await withTx(async (client) => {
    const c = await one(client, 'SELECT * FROM challenges WHERE code = $1 AND active', [req.params.code]);
    if (!c) throw notFound('Challenge');
    const existing = await one(client,
      "SELECT 1 FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2 AND status = 'active'", [c.id, user.id]);
    if (existing) throw conflict('already_joined', 'Tu participes déjà à ce challenge');
    const accountId = await createAccount(client, user.id, 'challenge');
    return one(client,
      `INSERT INTO challenge_participations (challenge_id, user_id, account_id, ends_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4)) RETURNING *`, [c.id, user.id, accountId, c.duration_days]);
  });
  await track(pool, user.id, 'challenge_joined', { code: req.params.code });
  res.status(201).json(p);
});

async function participation(client: pg.PoolClient, userId: string, id: string) {
  const p = await one(client,
    `SELECT p.*, c.title, c.target_amount, c.reward_points, c.reward_fcfa FROM challenge_participations p
     JOIN challenges c ON c.id = p.challenge_id WHERE p.id = $1 AND p.user_id = $2 FOR UPDATE OF p`, [id, userId]);
  if (!p) throw notFound('Participation');
  return p;
}

router.post('/participations/:id/save', async (req, res) => {
  const user = currentUser(req);
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  const out = await withTx(async (client) => {
    const p = await participation(client, user.id, req.params.id as string);
    if (p.status !== 'active') throw conflict('closed', 'Challenge terminé');
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'challenge_saving', amount, initiatorId: user.id, description: `Challenge « ${p.title} »`,
      legs: [{ accountId: wallet.id, amount: -amount }, { accountId: p.account_id, amount }],
    });
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [p.account_id]);
    if (balance >= p.target_amount) {
      await completeChallenge(client, p);
      return { balance, status: 'completed', reward: { points: p.reward_points, fcfa: p.reward_fcfa } };
    }
    return { balance, status: 'active' };
  });
  res.json(out);
});

async function completeChallenge(client: pg.PoolClient, p: any) {
  await client.query("UPDATE challenge_participations SET status = 'completed', completed_at = now() WHERE id = $1", [p.id]);
  await client.query('UPDATE users SET points = points + $2 WHERE id = $1', [p.user_id, p.reward_points]);
  if (p.reward_fcfa > 0) {
    await post(client, {
      type: 'challenge_reward', amount: p.reward_fcfa, initiatorId: p.user_id, description: `Récompense « ${p.title} »`,
      legs: [{ accountId: await systemAccount(client, 'SYS_REWARDS'), amount: -p.reward_fcfa }, { accountId: p.account_id, amount: p.reward_fcfa }],
    });
  }
  await notify(client, p.user_id, 'Challenge réussi 🏆', `Bravo ! +${p.reward_points} points${p.reward_fcfa ? ` et ${p.reward_fcfa} FCFA offerts` : ''}`);
  await track(client, p.user_id, 'challenge_completed', { participation: p.id });
}

/** Récupérer son épargne : à tout moment, sans frais. Avant l'objectif, le challenge est abandonné. */
router.post('/participations/:id/withdraw', async (req, res) => {
  const user = currentUser(req);
  const out = await withTx(async (client) => {
    const p = await participation(client, user.id, req.params.id as string);
    const { balance } = await one(client, 'SELECT balance FROM accounts WHERE id = $1', [p.account_id]);
    if (balance > 0) {
      const wallet = await walletOf(client, user.id);
      await post(client, {
        type: 'challenge_payout', amount: balance, initiatorId: user.id, description: `Challenge « ${p.title} »`,
        legs: [{ accountId: p.account_id, amount: -balance }, { accountId: wallet.id, amount: balance }],
      });
    }
    if (p.status === 'active') {
      await client.query("UPDATE challenge_participations SET status = 'abandoned' WHERE id = $1", [p.id]);
    }
    return { returned: balance, status: p.status === 'active' ? 'abandoned' : p.status };
  });
  res.json(out);
});
