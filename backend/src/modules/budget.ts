import { Router } from 'express';
import { z } from 'zod';
import { many, pool, withTx } from '../db.js';
import { notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';

export const router = Router();

export const DEFAULT_CATEGORIES = ['Alimentation', 'Transport', 'Logement', 'Factures', 'Santé', 'Éducation', 'Famille', 'Loisirs', 'Tontine', 'Autre'];
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const currentMonth = () => new Date().toISOString().slice(0, 7);

router.get('/categories', (_req, res) => { res.json(DEFAULT_CATEGORIES); });

router.put('/plans/:month', async (req, res) => {
  const user = currentUser(req);
  const m = month.parse(req.params.month);
  const { items } = z.object({
    items: z.array(z.object({ category: z.string().trim().min(1).max(40), planned: z.number().int().min(0) })).max(30),
  }).parse(req.body);
  await withTx(async (client) => {
    await client.query('DELETE FROM budget_plans WHERE user_id = $1 AND month = $2', [user.id, m]);
    for (const i of items) {
      await client.query('INSERT INTO budget_plans (user_id, month, category, planned) VALUES ($1, $2, $3, $4)', [user.id, m, i.category, i.planned]);
    }
  });
  res.json({ ok: true });
});

router.post('/entries', async (req, res) => {
  const body = z.object({
    kind: z.enum(['income', 'expense']),
    category: z.string().trim().min(1).max(40),
    amount: z.number().int().positive(),
    occurredOn: z.iso.date().optional(),
    note: z.string().max(140).optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO budget_entries (user_id, kind, category, amount, occurred_on, note)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6) RETURNING *`,
    [currentUser(req).id, body.kind, body.category, body.amount, body.occurredOn ?? null, body.note ?? null]);
  res.status(201).json(rows[0]);
});

router.delete('/entries/:id', async (req, res) => {
  const r = await pool.query('DELETE FROM budget_entries WHERE id = $1 AND user_id = $2', [req.params.id, currentUser(req).id]);
  if (!r.rowCount) throw notFound('Opération');
  res.status(204).end();
});

router.get('/summary', async (req, res) => {
  const userId = currentUser(req).id;
  const m = month.parse(req.query.month ?? currentMonth());
  const rows = await many(pool,
    `WITH spent AS (
       SELECT category, sum(amount)::bigint AS spent FROM budget_entries
       WHERE user_id = $1 AND kind = 'expense' AND to_char(occurred_on, 'YYYY-MM') = $2 GROUP BY category)
     SELECT COALESCE(p.category, s.category) AS category, COALESCE(p.planned, 0)::bigint AS planned, COALESCE(s.spent, 0)::bigint AS spent
     FROM (SELECT category, planned FROM budget_plans WHERE user_id = $1 AND month = $2) p
     FULL JOIN spent s ON s.category = p.category ORDER BY 1`, [userId, m]);
  const [totals] = await many(pool,
    `SELECT COALESCE(sum(amount) FILTER (WHERE kind = 'income'), 0)::bigint AS income,
            COALESCE(sum(amount) FILTER (WHERE kind = 'expense'), 0)::bigint AS expense
     FROM budget_entries WHERE user_id = $1 AND to_char(occurred_on, 'YYYY-MM') = $2`, [userId, m]);
  const entries = await many(pool,
    `SELECT * FROM budget_entries WHERE user_id = $1 AND to_char(occurred_on, 'YYYY-MM') = $2 ORDER BY occurred_on DESC, created_at DESC`, [userId, m]);
  const categories = rows.map((r) => ({
    ...r,
    remaining: r.planned - r.spent,
    alert: r.planned > 0 && r.spent >= r.planned ? 'depasse' : r.planned > 0 && r.spent >= 0.8 * r.planned ? 'attention' : null,
  }));
  res.json({ month: m, ...totals, balance: totals.income - totals.expense, categories, entries });
});
