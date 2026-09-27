import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool } from '../db.js';
import { notFound } from '../lib/errors.js';
import { currentUser, requireRole } from '../lib/auth.js';
import { notify } from '../services/notify.js';
import { reverseWithdrawal } from './wallet.js';

// Back-office : CRM (client 360, segments, notes), support, campagnes, finance & rapprochement.
// Accessible aux rôles « support » (lecture + tickets) et « admin » (tout).
export const router = Router();

const SEGMENTS = ['nouveau', 'sans_depot', 'actif', 'epargnant', 'dormant', 'vip'] as const;

router.get('/kpis', async (_req, res) => {
  const users = await one(pool,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new_7d,
            count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new_30d,
            count(*) FILTER (WHERE last_active_at > now() - interval '30 days')::int AS mau,
            count(*) FILTER (WHERE plan = 'plus')::int AS plus_subscribers,
            count(*) FILTER (WHERE kyc_level > 0)::int AS kyc_verified
     FROM users WHERE role = 'customer'`);
  const flows = await one(pool,
    `SELECT COALESCE(sum(amount) FILTER (WHERE type = 'deposit'), 0)::bigint AS deposits_30d,
            COALESCE(sum(amount) FILTER (WHERE type = 'withdrawal'), 0)::bigint AS withdrawals_30d,
            count(*) FILTER (WHERE type = 'deposit')::int AS deposits_count_30d
     FROM transactions WHERE status = 'completed' AND created_at > now() - interval '30 days'`);
  const revenue = await one(pool,
    `SELECT COALESCE(sum(e.amount), 0)::bigint AS total,
            COALESCE(sum(e.amount) FILTER (WHERE e.created_at > now() - interval '30 days'), 0)::bigint AS last_30d
     FROM ledger_entries e JOIN accounts a ON a.id = e.account_id WHERE a.code = 'SYS_FEES'`);
  const aum = await one(pool,
    `SELECT COALESCE(sum(balance), 0)::bigint AS total,
            COALESCE(sum(balance) FILTER (WHERE kind <> 'wallet'), 0)::bigint AS locked_savings
     FROM accounts WHERE kind <> 'system'`);
  const funnel = await one(pool,
    `SELECT count(*)::int AS signups,
            count(*) FILTER (WHERE deposits_count > 0)::int AS deposited,
            count(*) FILTER (WHERE savings > 0)::int AS saving,
            count(*) FILTER (WHERE plan = 'plus')::int AS paying
     FROM customer_overview`);
  const segments = await many(pool, 'SELECT segment, count(*)::int AS n FROM customer_overview GROUP BY segment ORDER BY n DESC');
  const channels = await many(pool,
    `SELECT COALESCE(acquisition_channel, 'inconnu') AS channel, count(*)::int AS n,
            count(*) FILTER (WHERE deposits_count > 0)::int AS converted
     FROM customer_overview GROUP BY 1 ORDER BY n DESC`);
  const products = await one(pool,
    `SELECT (SELECT count(*)::int FROM ecaisses WHERE status = 'locked') AS ecaisses,
            (SELECT count(*)::int FROM cagnottes WHERE status = 'open') AS cagnottes,
            (SELECT count(*)::int FROM projets WHERE status = 'active') AS projets,
            (SELECT count(*)::int FROM challenge_participations WHERE status = 'active') AS challenges,
            (SELECT count(*)::int FROM contrats WHERE status = 'active') AS contrats`);
  const tickets = await one(pool, "SELECT count(*) FILTER (WHERE status <> 'closed')::int AS open FROM support_tickets");
  const daily = await many(pool,
    `SELECT to_char(d, 'YYYY-MM-DD') AS day,
            (SELECT count(*)::int FROM users WHERE role = 'customer' AND created_at::date = d) AS signups,
            (SELECT COALESCE(sum(amount), 0)::bigint FROM transactions WHERE type = 'deposit' AND status = 'completed' AND completed_at::date = d) AS deposits
     FROM generate_series(current_date - 29, current_date, interval '1 day') d`);
  res.json({ users, flows, revenue, aum, funnel, segments, channels, products, tickets, daily });
});

router.get('/customers', async (req, res) => {
  const q = z.object({
    search: z.string().optional(),
    segment: z.enum(SEGMENTS).optional(),
    page: z.coerce.number().int().min(1).default(1),
  }).parse(req.query);
  const params: unknown[] = [];
  const where: string[] = [];
  if (q.search) { params.push(`%${q.search}%`); where.push(`(phone ILIKE $${params.length} OR full_name ILIKE $${params.length})`); }
  if (q.segment) { params.push(q.segment); where.push(`segment = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await one(pool, `SELECT count(*)::int AS n FROM customer_overview ${clause}`, params);
  params.push((q.page - 1) * 50);
  const rows = await many(pool, `SELECT * FROM customer_overview ${clause} ORDER BY created_at DESC LIMIT 50 OFFSET $${params.length}`, params);
  res.json({ total: total.n, page: q.page, rows });
});

router.get('/customers/:id', async (req, res) => {
  const id = req.params.id;
  const customer = await one(pool, 'SELECT * FROM customer_overview WHERE id = $1', [id]);
  if (!customer) throw notFound('Client');
  const [transactions, notes, tickets, events, ecaisses, cagnottes, projets, contrats] = await Promise.all([
    many(pool, 'SELECT id, reference, type, status, amount, fee, description, created_at FROM transactions WHERE initiator_id = $1 ORDER BY created_at DESC LIMIT 30', [id]),
    many(pool, 'SELECT n.*, u.full_name AS author FROM crm_notes n JOIN users u ON u.id = n.author_id WHERE n.user_id = $1 ORDER BY n.created_at DESC', [id]),
    many(pool, 'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC', [id]),
    many(pool, 'SELECT name, props, created_at FROM user_events WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [id]),
    many(pool, 'SELECT e.name, e.status, e.unlock_at, a.balance FROM ecaisses e JOIN accounts a ON a.id = e.account_id WHERE e.user_id = $1', [id]),
    many(pool, 'SELECT c.name, m.role, a.balance FROM cagnotte_members m JOIN cagnottes c ON c.id = m.cagnotte_id JOIN accounts a ON a.id = c.account_id WHERE m.user_id = $1', [id]),
    many(pool, 'SELECT p.name, p.status, p.target_amount, a.balance FROM projets p JOIN accounts a ON a.id = p.account_id WHERE p.user_id = $1', [id]),
    many(pool, 'SELECT title, kind, status, principal FROM contrats WHERE $1 IN (creator_id, counterparty_id)', [id]),
  ]);
  res.json({ customer, transactions, notes, tickets, events, products: { ecaisses, cagnottes, projets, contrats } });
});

router.post('/customers/:id/notes', async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO crm_notes (user_id, author_id, body) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, currentUser(req).id, body]);
  res.status(201).json(rows[0]);
});

router.patch('/customers/:id', requireRole('admin'), async (req, res) => {
  const body = z.object({
    status: z.enum(['active', 'suspended', 'closed']).optional(),
    kycLevel: z.number().int().min(0).max(2).optional(),
  }).parse(req.body);
  const r = await pool.query(
    'UPDATE users SET status = COALESCE($2, status), kyc_level = COALESCE($3, kyc_level) WHERE id = $1',
    [req.params.id, body.status ?? null, body.kycLevel ?? null]);
  if (!r.rowCount) throw notFound('Client');
  if (body.kycLevel) await notify(pool, req.params.id as string, 'Identité vérifiée ✅', 'Tes plafonds ont été relevés');
  res.json({ ok: true });
});

// ───── Support ─────
router.get('/tickets', async (req, res) => {
  const { status } = z.object({ status: z.enum(['open', 'pending', 'closed']).optional() }).parse(req.query);
  res.json(await many(pool,
    `SELECT t.*, u.full_name, u.phone, (SELECT json_agg(m ORDER BY m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
     FROM support_tickets t JOIN users u ON u.id = t.user_id
     WHERE ($1::text IS NULL OR t.status = $1) ORDER BY t.priority = 'high' DESC, t.updated_at DESC LIMIT 100`, [status ?? null]));
});

router.post('/tickets/:id/reply', async (req, res) => {
  const body = z.object({ body: z.string().trim().min(1).max(2000), status: z.enum(['open', 'pending', 'closed']).default('pending') }).parse(req.body);
  const t = await one(pool, 'SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
  if (!t) throw notFound('Ticket');
  const agent = currentUser(req).id;
  await pool.query('INSERT INTO ticket_messages (ticket_id, author_id, body) VALUES ($1, $2, $3)', [t.id, agent, body.body]);
  await pool.query('UPDATE support_tickets SET status = $2, assigned_to = COALESCE(assigned_to, $3), updated_at = now() WHERE id = $1', [t.id, body.status, agent]);
  await notify(pool, t.user_id, 'Réponse du support', body.body.slice(0, 120));
  res.json({ ok: true });
});

// ───── Campagnes marketing ciblées par segment ─────
router.get('/campaigns', async (_req, res) => {
  res.json(await many(pool, 'SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 50'));
});

router.post('/campaigns', requireRole('admin'), async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(80),
    segment: z.enum([...SEGMENTS, 'tous']),
    channel: z.enum(['push', 'sms', 'whatsapp', 'email']),
    title: z.string().min(2).max(80),
    body: z.string().min(2).max(500),
  }).parse(req.body);
  // Canal « push » : notification in-app (+ push Expo en production).
  // SMS / WhatsApp / e-mail : export de la cible vers le prestataire (Orange SMS, WhatsApp Business API, Resend…).
  const target = await many(pool,
    `SELECT id FROM customer_overview WHERE status = 'active' AND ($1 = 'tous' OR segment = $1)`, [body.segment]);
  if (body.channel === 'push') {
    for (const u of target) await notify(pool, u.id, body.title, body.body);
  }
  const { rows } = await pool.query(
    `INSERT INTO campaigns (name, segment, channel, title, body, sent_count, created_by, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
    [body.name, body.segment, body.channel, body.title, body.body, target.length, currentUser(req).id]);
  res.status(201).json(rows[0]);
});

router.post('/news', requireRole('admin'), async (req, res) => {
  const body = z.object({ title: z.string().min(2).max(80), summary: z.string().min(2).max(280), videoUrl: z.url().optional() }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO news_tutos (title, summary, video_url) VALUES ($1, $2, $3) RETURNING *',
    [body.title, body.summary, body.videoUrl ?? null]);
  res.status(201).json(rows[0]);
});

// ───── Finance : contrôle du grand livre et rapprochement des retraits ─────
router.get('/ledger/check', requireRole('admin'), async (_req, res) => {
  const total = await one(pool, 'SELECT COALESCE(sum(balance), 0)::bigint AS sum FROM accounts');
  const mismatches = await many(pool,
    `SELECT a.id, a.kind, a.balance, COALESCE(sum(e.amount), 0)::bigint AS ledger
     FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
     GROUP BY a.id HAVING a.balance <> COALESCE(sum(e.amount), 0)`);
  const system = await many(pool, "SELECT code, balance FROM accounts WHERE kind = 'system' ORDER BY code");
  res.json({ balanced: total.sum === 0 && mismatches.length === 0, sum: total.sum, mismatches, system });
});

router.get('/withdrawals/to-reconcile', async (_req, res) => {
  res.json(await many(pool,
    `SELECT t.*, u.phone FROM transactions t JOIN users u ON u.id = t.initiator_id
     WHERE t.type = 'withdrawal' AND t.status = 'completed' AND t.meta->>'payout' IN ('unknown', 'pending', 'processing')
     ORDER BY t.created_at`));
});

router.post('/withdrawals/:id/reverse', requireRole('admin'), async (req, res) => {
  await reverseWithdrawal(req.params.id as string);
  res.json({ ok: true });
});

router.post('/withdrawals/:id/confirm', requireRole('admin'), async (req, res) => {
  const r = await pool.query(
    `UPDATE transactions SET meta = meta || '{"payout":"completed"}' WHERE id = $1 AND type = 'withdrawal' AND status = 'completed'`, [req.params.id]);
  if (!r.rowCount) throw notFound('Retrait');
  res.json({ ok: true });
});
