import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { csvCell } from '../lib/csv.js';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { fee, pricing } from '../pricing.js';
import { createAccount, post, systemAccount, walletOf } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';
import { assertCanOrganize, isPro } from '../services/pro.js';
import { assertActivePartner, BRANDING_SQL } from '../services/partners.js';

// Cagnotte+ / coffre de groupe : caisse commune d'une association, d'un dahira, d'une famille,
// d'un GIE… Cotisations suivies période par période (payé / partiel / impayé). Tout retrait exige
// l'accord de `required_approvals` administrateurs distincts (double validation par défaut).
export const router = Router();

async function membership(db: pg.PoolClient | pg.Pool, cagnotteId: string, userId: string) {
  const m = await one(db, 'SELECT role FROM cagnotte_members WHERE cagnotte_id = $1 AND user_id = $2', [cagnotteId, userId]);
  if (!m) throw notFound('Cagnotte');
  return m.role as 'admin' | 'member';
}

router.get('/', async (req, res) => {
  res.json(await many(pool,
    `SELECT c.id, c.name, c.category, c.visibility, c.contribution_amount, c.frequency, c.target_amount, c.status, a.balance, m.role,
            (SELECT ${BRANDING_SQL} FROM partners p WHERE p.id = c.partner_id) AS partner,
            (SELECT count(*)::int FROM cagnotte_members WHERE cagnotte_id = c.id) AS members
     FROM cagnottes c JOIN cagnotte_members m ON m.cagnotte_id = c.id AND m.user_id = $1
     JOIN accounts a ON a.id = c.account_id ORDER BY c.created_at DESC`, [currentUser(req).id]));
});

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().max(280).optional(),
    targetAmount: z.number().int().positive().optional(),
    contributionAmount: z.number().int().positive().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'free']).default('free'),
    requiredApprovals: z.number().int().min(1).max(5).default(2),
    category: z.enum(['association', 'dahira', 'religieux', 'famille', 'gie', 'asc', 'projet', 'autre']).default('autre'),
    visibility: z.enum(['private', 'public']).default('private'),
    partnerId: z.uuid().optional(),
  }).parse(req.body);
  // Coffre d'un partenaire (association, entreprise…) : couvert par sa licence, pas de limite Pro.
  if (body.partnerId) await assertActivePartner(pool, body.partnerId, user.id);
  else await assertCanOrganize(pool, user.id);
  const c = await withTx(async (client) => {
    const accountId = await createAccount(client, null, 'cagnotte');
    const row = await one(client,
      `INSERT INTO cagnottes (account_id, name, description, target_amount, contribution_amount, frequency, required_approvals, created_by, category, visibility, partner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [accountId, body.name, body.description ?? null, body.targetAmount ?? null, body.contributionAmount ?? null,
        body.frequency, body.requiredApprovals, user.id, body.category, body.visibility, body.partnerId ?? null]);
    await client.query("INSERT INTO cagnotte_members (cagnotte_id, user_id, role) VALUES ($1, $2, 'admin')", [row.id, user.id]);
    return row;
  });
  await track(pool, user.id, 'cagnotte_created', {});
  res.status(201).json(c);
});

/** Aperçu via code d'invitation / QR code, avant de rejoindre. */
router.get('/:id/preview', async (req, res) => {
  const c = await one(pool,
    `SELECT c.id, c.name, c.description, c.category, c.visibility, c.contribution_amount, c.frequency, c.status, u.full_name AS organizer,
            (SELECT ${BRANDING_SQL} FROM partners p WHERE p.id = c.partner_id) AS partner,
            (SELECT count(*)::int FROM cagnotte_members WHERE cagnotte_id = c.id) AS members
     FROM cagnottes c JOIN users u ON u.id = c.created_by WHERE c.id = $1`, [req.params.id]);
  if (!c) throw notFound('Coffre');
  res.json(c);
});

/** Un coffre « public » (ex. caisse d'un dahira) se rejoint directement avec son code. */
router.post('/:id/join', async (req, res) => {
  const user = currentUser(req);
  const c = await one(pool, 'SELECT id, visibility, status, created_by, name FROM cagnottes WHERE id = $1', [req.params.id]);
  if (!c) throw notFound('Coffre');
  if (c.visibility !== 'public') throw forbidden('Coffre privé : demande à un administrateur de t\'ajouter');
  if (c.status !== 'open') throw conflict('closed', 'Coffre clôturé');
  const r = await pool.query('INSERT INTO cagnotte_members (cagnotte_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, user.id]);
  if (!r.rowCount) throw conflict('already_member', 'Tu es déjà membre');
  await notify(pool, c.created_by, 'Nouveau membre', `Un membre a rejoint « ${c.name} »`);
  res.status(201).json({ ok: true });
});

/**
 * Tableau des cotisations par membre et par période (mois ou semaine) :
 * « payé » si la cotisation attendue est atteinte, « partiel » si une partie seulement, « na » avant l'adhésion, sinon « impayé ».
 */
router.get('/:id/cotisations', async (req, res) => {
  const id = req.params.id;
  await membership(pool, id, currentUser(req).id);
  const { periods } = z.object({ periods: z.coerce.number().int().min(1).max(24).default(6) }).parse(req.query);
  const c = await one(pool, 'SELECT contribution_amount, frequency FROM cagnottes WHERE id = $1', [id]);
  const unit = c.frequency === 'weekly' ? 'week' : 'month';
  const rows = await many(pool,
    `WITH p AS (
       SELECT generate_series(date_trunc($2, now()) - ($3::int - 1) * ('1 ' || $2)::interval, date_trunc($2, now()), ('1 ' || $2)::interval) AS start
     )
     SELECT u.id AS user_id, COALESCE(u.full_name, u.phone) AS name, to_char(p.start, 'YYYY-MM-DD') AS period,
            (p.start + ('1 ' || $2)::interval <= m.joined_at) AS before_join,
            COALESCE((SELECT sum(t.amount) FROM transactions t WHERE t.type = 'cagnotte_contribution' AND t.status = 'completed'
                      AND t.initiator_id = u.id AND t.meta->>'cagnotteId' = $1::text
                      AND t.created_at >= p.start AND t.created_at < p.start + ('1 ' || $2)::interval), 0)::bigint AS paid
     FROM cagnotte_members m JOIN users u ON u.id = m.user_id CROSS JOIN p
     WHERE m.cagnotte_id = $1::uuid ORDER BY name, period`, [id, unit, periods]);
  const expected = c.contribution_amount ?? 0;
  const status = (paid: number) => (expected === 0 ? (paid > 0 ? 'paye' : 'impaye') : paid >= expected ? 'paye' : paid > 0 ? 'partiel' : 'impaye');
  const members = new Map<string, { userId: string; name: string; periods: { period: string; paid: number; status: string }[] }>();
  for (const r of rows) {
    if (!members.has(r.user_id)) members.set(r.user_id, { userId: r.user_id, name: r.name, periods: [] });
    // Période entièrement antérieure à l'adhésion : rien n'était dû (« non concerné »).
    members.get(r.user_id)!.periods.push({ period: r.period, paid: r.paid, status: r.before_join && r.paid === 0 ? 'na' : status(r.paid) });
  }
  res.json({ expected, frequency: c.frequency, members: [...members.values()] });
});

/** Export CSV des cotisations (Organisateur Pro) : pour l'assemblée générale ou la comptabilité de l'association. */
router.get('/:id/cotisations.csv', async (req, res) => {
  const user = currentUser(req);
  const id = req.params.id;
  if ((await membership(pool, id, user.id)) !== 'admin') throw forbidden('Réservé aux administrateurs du coffre');
  if (!(await isPro(pool, user.id))) throw new HttpError(402, 'pro_required', 'Export réservé aux abonnés Organisateur Pro');
  const rows = await many(pool,
    `SELECT to_char(t.created_at, 'YYYY-MM-DD') AS date, COALESCE(u.full_name, '') AS membre, u.phone AS telephone, t.amount AS montant
     FROM transactions t JOIN users u ON u.id = t.initiator_id
     WHERE t.type = 'cagnotte_contribution' AND t.status = 'completed' AND t.meta->>'cagnotteId' = $1::text
     ORDER BY t.created_at`, [id]);
  const esc = csvCell;
  const csv = ['date;membre;telephone;montant', ...rows.map((r) => [r.date, r.membre, r.telephone, r.montant].map(esc).join(';'))].join('\n');
  res.type('text/csv; charset=utf-8').attachment(`cotisations-${id}.csv`).send('\uFEFF' + csv);
});

router.get('/:id', async (req, res) => {
  const id = req.params.id as string;
  await membership(pool, id, currentUser(req).id);
  const cagnotte = await one(pool,
    `SELECT c.*, a.balance, (SELECT ${BRANDING_SQL} FROM partners p WHERE p.id = c.partner_id) AS partner
     FROM cagnottes c JOIN accounts a ON a.id = c.account_id WHERE c.id = $1`, [id]);
  const members = await many(pool,
    `SELECT u.id, u.full_name, u.phone, m.role,
            COALESCE((SELECT sum(t.amount) FROM transactions t WHERE t.type = 'cagnotte_contribution'
                      AND t.initiator_id = u.id AND t.meta->>'cagnotteId' = $1::text), 0)::bigint AS contributed
     FROM cagnotte_members m JOIN users u ON u.id = m.user_id WHERE m.cagnotte_id = $1::uuid ORDER BY m.joined_at`, [id]);
  const withdrawals = await many(pool,
    `SELECT w.*, (SELECT json_agg(json_build_object('userId', ap.user_id, 'decision', ap.decision))
                  FROM cagnotte_approvals ap WHERE ap.withdrawal_id = w.id) AS approvals
     FROM cagnotte_withdrawals w WHERE w.cagnotte_id = $1 ORDER BY w.created_at DESC`, [id]);
  res.json({ ...cagnotte, members, withdrawals });
});

router.post('/:id/members', async (req, res) => {
  const id = req.params.id as string;
  const user = currentUser(req);
  if ((await membership(pool, id, user.id)) !== 'admin') throw forbidden('Seul un administrateur peut ajouter des membres');
  const body = z.object({ phone: z.string(), role: z.enum(['admin', 'member']).default('member') }).parse(req.body);
  const invitee = await one(pool, 'SELECT id FROM users WHERE phone = $1', [body.phone]);
  if (!invitee) throw notFound('Utilisateur Smart Tontine');
  await pool.query(
    `INSERT INTO cagnotte_members (cagnotte_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (cagnotte_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [id, invitee.id, body.role]);
  await notify(pool, invitee.id, 'Nouvelle cagnotte', 'Tu as été ajouté(e) à une Cagnotte+');
  res.status(201).json({ ok: true });
});

router.post('/:id/contribute', async (req, res) => {
  const id = req.params.id as string;
  const user = currentUser(req);
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  await membership(pool, id, user.id);
  await withTx(async (client) => {
    const c = await one(client, 'SELECT account_id, name, status FROM cagnottes WHERE id = $1', [id]);
    if (c.status !== 'open') throw conflict('closed', 'Cagnotte clôturée');
    const wallet = await walletOf(client, user.id);
    await post(client, {
      type: 'cagnotte_contribution', amount, initiatorId: user.id, description: `Cagnotte « ${c.name} »`,
      meta: { cagnotteId: id }, legs: [{ accountId: wallet.id, amount: -amount }, { accountId: c.account_id, amount }],
    });
  });
  await track(pool, user.id, 'cagnotte_contribution', { amount });
  res.status(201).json({ ok: true });
});

router.post('/:id/withdrawals', async (req, res) => {
  const id = req.params.id as string;
  const user = currentUser(req);
  if ((await membership(pool, id, user.id)) !== 'admin') throw forbidden('Seul un administrateur peut demander un retrait');
  const body = z.object({
    amount: z.number().int().min(100),
    beneficiaryPhone: z.string().optional(),
    reason: z.string().max(280).optional(),
  }).parse(req.body);

  const result = await withTx(async (client) => {
    const c = await one(client,
      `SELECT c.*, a.balance, (SELECT count(*)::int FROM cagnotte_members WHERE cagnotte_id = c.id AND role = 'admin') AS admins
       FROM cagnottes c JOIN accounts a ON a.id = c.account_id WHERE c.id = $1`, [id]);
    if (c.admins < c.required_approvals) {
      throw badRequest('not_enough_admins', `Il faut au moins ${c.required_approvals} administrateurs pour valider un retrait`);
    }
    if (body.amount > c.balance) throw conflict('insufficient_funds', 'Solde de la cagnotte insuffisant');
    let beneficiaryId = user.id;
    if (body.beneficiaryPhone) {
      const b = await one(client,
        `SELECT u.id FROM users u JOIN cagnotte_members m ON m.user_id = u.id AND m.cagnotte_id = $2 WHERE u.phone = $1`,
        [body.beneficiaryPhone, id]);
      if (!b) throw badRequest('beneficiary_not_member', 'Le bénéficiaire doit être membre de la cagnotte');
      beneficiaryId = b.id;
    }
    const w = await one(client,
      `INSERT INTO cagnotte_withdrawals (cagnotte_id, requested_by, beneficiary_id, amount, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [id, user.id, beneficiaryId, body.amount, body.reason ?? null]);
    // La demande vaut première validation.
    await client.query("INSERT INTO cagnotte_approvals (withdrawal_id, user_id, decision) VALUES ($1, $2, 'approve')", [w.id, user.id]);
    return maybeExecute(client, w.id);
  });
  res.status(201).json(result);
});

router.post('/withdrawals/:wid/decision', async (req, res) => {
  const user = currentUser(req);
  const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
  const result = await withTx(async (client) => {
    const w = await one(client, 'SELECT * FROM cagnotte_withdrawals WHERE id = $1 FOR UPDATE', [req.params.wid]);
    if (!w) throw notFound('Demande de retrait');
    if ((await membership(client, w.cagnotte_id, user.id)) !== 'admin') throw forbidden('Seuls les administrateurs valident');
    if (w.status !== 'pending') throw conflict('already_decided', 'Demande déjà traitée');
    const inserted = await client.query(
      'INSERT INTO cagnotte_approvals (withdrawal_id, user_id, decision) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [w.id, user.id, decision]);
    if (inserted.rowCount === 0) throw conflict('already_voted', 'Tu as déjà donné ton avis');
    if (decision === 'reject') {
      await client.query("UPDATE cagnotte_withdrawals SET status = 'rejected' WHERE id = $1", [w.id]);
      await notify(client, w.requested_by, 'Retrait refusé', 'Un administrateur a refusé la demande de retrait de la cagnotte');
      return { id: w.id, status: 'rejected' };
    }
    return maybeExecute(client, w.id);
  });
  res.json(result);
});

async function maybeExecute(client: pg.PoolClient, withdrawalId: string) {
  const w = await one(client,
    `SELECT w.*, c.required_approvals, c.account_id, c.name,
            (SELECT count(*)::int FROM cagnotte_approvals WHERE withdrawal_id = w.id AND decision = 'approve') AS approvals
     FROM cagnotte_withdrawals w JOIN cagnottes c ON c.id = w.cagnotte_id WHERE w.id = $1`, [withdrawalId]);
  if (w.approvals < w.required_approvals) {
    return { id: w.id, status: 'pending', approvals: w.approvals, required: w.required_approvals };
  }
  const f = fee(w.amount, pricing.cagnotteWithdrawal);
  const wallet = await walletOf(client, w.beneficiary_id);
  const tx = await post(client, {
    type: 'cagnotte_withdrawal', amount: w.amount, fee: f, initiatorId: w.beneficiary_id,
    description: `Retrait cagnotte « ${w.name} »`, meta: { cagnotteId: w.cagnotte_id, withdrawalId: w.id },
    legs: [
      { accountId: w.account_id, amount: -w.amount },
      { accountId: wallet.id, amount: w.amount - f },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: f },
    ],
  });
  await client.query("UPDATE cagnotte_withdrawals SET status = 'executed', tx_id = $2 WHERE id = $1", [w.id, tx.id]);
  await notify(client, w.beneficiary_id, 'Retrait de cagnotte validé', `+${w.amount - f} FCFA sur ton portefeuille`);
  return { id: w.id, status: 'executed', fee: f };
}
