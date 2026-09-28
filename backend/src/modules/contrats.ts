import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { post, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';
import { assertPin } from './auth.js';

// Contrats : prêts entre proches, engagements, tontines — signés des deux côtés,
// échéancier visible, remboursement en un clic. Pas d'intérêts (hors cadre réglementaire).
export const router = Router();

const CONTRACT_SQL = `
  SELECT c.*, cr.full_name AS creditor_name, db.full_name AS debtor_name,
         (SELECT json_agg(e ORDER BY e.due_on) FROM contrat_echeances e WHERE e.contrat_id = c.id) AS echeances,
         (SELECT COALESCE(sum(amount), 0)::bigint FROM contrat_echeances WHERE contrat_id = c.id AND paid_at IS NOT NULL) AS repaid
  FROM contrats c JOIN users cr ON cr.id = c.creditor_id JOIN users db ON db.id = c.debtor_id`;

router.get('/', async (req, res) => {
  const id = currentUser(req).id;
  res.json(await many(pool, `${CONTRACT_SQL} WHERE $1 IN (c.creator_id, c.counterparty_id) ORDER BY c.created_at DESC`, [id]));
});

async function load(db: pg.PoolClient | pg.Pool, id: string, userId: string, lock = false) {
  const c = await one(db, `SELECT * FROM contrats WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!c || ![c.creator_id, c.counterparty_id].includes(userId)) throw notFound('Contrat');
  return c;
}

router.get('/:id', async (req, res) => {
  await load(pool, req.params.id, currentUser(req).id);
  res.json(await one(pool, `${CONTRACT_SQL} WHERE c.id = $1`, [req.params.id]));
});

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    counterpartyPhone: z.string(),
    title: z.string().trim().min(2).max(80),
    kind: z.enum(['pret', 'engagement', 'tontine']),
    myRole: z.enum(['creditor', 'debtor']),
    principal: z.number().int().min(500),
    echeances: z.array(z.object({ dueOn: z.iso.date(), amount: z.number().int().positive() })).min(1).max(60),
  }).parse(req.body);
  const total = body.echeances.reduce((s, e) => s + e.amount, 0);
  if (total !== body.principal) throw badRequest('schedule_mismatch', `La somme des échéances (${total}) doit égaler le montant (${body.principal})`);

  const other = await one(pool, "SELECT id FROM users WHERE phone = $1 AND status = 'active'", [body.counterpartyPhone]);
  if (!other) throw notFound('Utilisateur Smart Tontine');
  if (other.id === user.id) throw badRequest('self_contract', 'Un contrat nécessite deux personnes différentes');
  const [creditor, debtor] = body.myRole === 'creditor' ? [user.id, other.id] : [other.id, user.id];

  const c = await withTx(async (client) => {
    const row = await one(client,
      `INSERT INTO contrats (creator_id, counterparty_id, creditor_id, debtor_id, title, kind, principal, signed_creator_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
      [user.id, other.id, creditor, debtor, body.title, body.kind, body.principal]);
    for (const e of body.echeances) {
      await client.query('INSERT INTO contrat_echeances (contrat_id, due_on, amount) VALUES ($1, $2, $3)', [row.id, e.dueOn, e.amount]);
    }
    await notify(client, other.id, 'Contrat à signer', `« ${body.title} » — ${body.principal} FCFA`);
    return row;
  });
  await track(pool, user.id, 'contrat_created', { kind: body.kind });
  res.status(201).json(c);
});

/** Signature de la contrepartie : active le contrat. Pour un prêt, les fonds sont versés au débiteur. */
router.post('/:id/sign', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const out = await withTx(async (client) => {
    const c = await load(client, req.params.id as string, user.id, true);
    if (c.counterparty_id !== user.id) throw forbidden('Seule la contrepartie peut signer');
    if (c.status !== 'draft') throw conflict('not_draft', 'Contrat déjà signé ou annulé');
    if (c.kind === 'pret') {
      const from = await walletOf(client, c.creditor_id);
      const to = await walletOf(client, c.debtor_id);
      await post(client, {
        type: 'contrat_disbursement', amount: c.principal, initiatorId: c.creditor_id, description: `Prêt « ${c.title} »`,
        meta: { contratId: c.id }, legs: [{ accountId: from.id, amount: -c.principal }, { accountId: to.id, amount: c.principal }],
      });
    }
    await client.query("UPDATE contrats SET status = 'active', signed_counterparty_at = now() WHERE id = $1", [c.id]);
    await notify(client, c.creator_id, 'Contrat signé ✍️', `« ${c.title} » est maintenant actif`);
    return { status: 'active' };
  });
  res.json(out);
});

router.post('/:id/cancel', async (req, res) => {
  const user = currentUser(req);
  await withTx(async (client) => {
    const c = await load(client, req.params.id as string, user.id, true);
    if (c.status !== 'draft') throw conflict('not_draft', 'Seul un contrat non signé peut être annulé');
    await client.query("UPDATE contrats SET status = 'cancelled' WHERE id = $1", [c.id]);
  });
  res.json({ status: 'cancelled' });
});

router.post('/:id/echeances/:eid/pay', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const out = await withTx(async (client) => {
    const c = await load(client, req.params.id as string, user.id, true);
    if (c.debtor_id !== user.id) throw forbidden('Seul le débiteur rembourse');
    if (c.status !== 'active') throw conflict('not_active', 'Contrat inactif');
    const e = await one(client, 'SELECT * FROM contrat_echeances WHERE id = $1 AND contrat_id = $2 FOR UPDATE', [req.params.eid, c.id]);
    if (!e) throw notFound('Échéance');
    if (e.paid_at) throw conflict('already_paid', 'Échéance déjà payée');
    const from = await walletOf(client, c.debtor_id);
    const to = await walletOf(client, c.creditor_id);
    const tx = await post(client, {
      type: 'contrat_repayment', amount: e.amount, initiatorId: user.id, description: `Échéance « ${c.title} »`,
      meta: { contratId: c.id, echeanceId: e.id }, legs: [{ accountId: from.id, amount: -e.amount }, { accountId: to.id, amount: e.amount }],
    });
    await client.query('UPDATE contrat_echeances SET paid_at = now(), tx_id = $2 WHERE id = $1', [e.id, tx.id]);
    const left = await one(client, 'SELECT count(*)::int AS n FROM contrat_echeances WHERE contrat_id = $1 AND paid_at IS NULL', [c.id]);
    if (left.n === 0) await client.query("UPDATE contrats SET status = 'completed' WHERE id = $1", [c.id]);
    await notify(client, c.creditor_id, 'Remboursement reçu', `+${e.amount} FCFA — « ${c.title} »`);
    return { status: left.n === 0 ? 'completed' : 'active', remaining: left.n };
  });
  res.json(out);
});
