import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { post, systemAccount, walletOf } from '../services/ledger.js';
import { track } from '../services/notify.js';

// Notifications, contenus « News & Tuto », abonnement SMARTFIN+ et support client.
export const router = Router();

router.get('/notifications', async (req, res) => {
  res.json(await many(pool, 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [currentUser(req).id]));
});

router.post('/notifications/read', async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [currentUser(req).id]);
  res.json({ ok: true });
});

router.get('/news', async (_req, res) => {
  res.json(await many(pool, 'SELECT id, title, summary, video_url FROM news_tutos WHERE published ORDER BY created_at DESC LIMIT 10'));
});

router.post('/plan/subscribe', async (req, res) => {
  const user = currentUser(req);
  await withTx(async (client) => {
    const u = await one(client, 'SELECT plan FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    if (u.plan === 'plus') throw conflict('already_plus', 'Tu es déjà abonné(e) à SMARTFIN+');
    await chargePlus(client, user.id);
  });
  await track(pool, user.id, 'plus_subscribed', {});
  res.json({ plan: 'plus' });
});

router.post('/plan/cancel', async (req, res) => {
  // L'abonnement reste actif jusqu'à la date de renouvellement puis n'est pas reconduit.
  await pool.query("UPDATE users SET plan_renews_at = NULL WHERE id = $1 AND plan = 'plus'", [currentUser(req).id]);
  res.json({ ok: true });
});

export async function chargePlus(client: import('pg').PoolClient, userId: string) {
  const wallet = await walletOf(client, userId);
  await post(client, {
    type: 'subscription', amount: pricing.plus.monthlyPrice, initiatorId: userId, description: 'Abonnement SMARTFIN+',
    legs: [
      { accountId: wallet.id, amount: -pricing.plus.monthlyPrice },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: pricing.plus.monthlyPrice },
    ],
  });
  await client.query("UPDATE users SET plan = 'plus', plan_renews_at = now() + interval '30 days' WHERE id = $1", [userId]);
}

router.get('/support/tickets', async (req, res) => {
  res.json(await many(pool,
    `SELECT t.*, (SELECT json_agg(m ORDER BY m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
     FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC`, [currentUser(req).id]));
});

router.post('/support/tickets', async (req, res) => {
  const body = z.object({ subject: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000) }).parse(req.body);
  const { rows } = await pool.query(
    'INSERT INTO support_tickets (user_id, subject, body) VALUES ($1, $2, $3) RETURNING *', [currentUser(req).id, body.subject, body.body]);
  res.status(201).json(rows[0]);
});

router.post('/support/tickets/:id/messages', async (req, res) => {
  const user = currentUser(req);
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const t = await one(pool, 'SELECT id FROM support_tickets WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!t) throw notFound('Ticket');
  await pool.query('INSERT INTO ticket_messages (ticket_id, author_id, body) VALUES ($1, $2, $3)', [t.id, user.id, body]);
  await pool.query("UPDATE support_tickets SET status = 'open', updated_at = now() WHERE id = $1", [t.id]);
  res.status(201).json({ ok: true });
});
