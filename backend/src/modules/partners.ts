import { Router } from 'express';
import { z } from 'zod';
import { csvCell } from '../lib/csv.js';
import { many, one, pool, withTx } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { fee, pricing } from '../pricing.js';
import { createAccount, post, systemAccount } from '../services/ledger.js';
import { notify, track } from '../services/notify.js';
import { assertStaff, staffIds } from '../services/partners.js';
import { paymentProvider, type Channel } from '../services/payments/index.js';
import { assertPin } from './auth.js';

// Espace partenaire : une association, un commerçant, une entreprise, un tontinier professionnel
// ou un SFD organise ses tontines et coffres sur Smart Tontine, sous son nom et avec son logo.
export const router = Router();

// Logo : lien https ou image encodée (data:image/png|jpeg|webp;base64,…) de 300 Ko maximum.
const logo = z.string().max(300_000).refine(
  (v) => /^https:\/\/\S+$/.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
  'Logo : lien https ou image PNG/JPEG/WebP',
);
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur au format #RRGGBB');
const TYPES = ['association', 'commercant', 'entreprise', 'tontinier', 'sfd', 'autre'] as const;

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(TYPES),
    description: z.string().max(500).optional(),
    logo: logo.optional(),
    primaryColor: color.optional(),
    phone: z.string().max(20).optional(),
    city: z.string().max(60).optional(),
    managementFeeRate: z.number().min(0).max(pricing.partner.maxManagementFeeRate).default(0),
  }).parse(req.body);
  const partner = await withTx(async (client) => {
    const accountId = await createAccount(client, null, 'partner');
    const p = await one(client,
      `INSERT INTO partners (account_id, name, type, description, logo, primary_color, phone, city, management_fee_rate, created_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#2F2C8F'), $7, $8, $9, $10) RETURNING *`,
      [accountId, body.name, body.type, body.description ?? null, body.logo ?? null, body.primaryColor ?? null,
        body.phone ?? null, body.city ?? null, body.managementFeeRate, user.id]);
    await client.query("INSERT INTO partner_staff (partner_id, user_id, role) VALUES ($1, $2, 'owner')", [p.id, user.id]);
    return p;
  });
  await track(pool, user.id, 'partner_created', { type: body.type });
  res.status(201).json(partner);
});

router.get('/mine', async (req, res) => {
  res.json(await many(pool,
    `SELECT p.id, p.name, p.type, p.logo, p.primary_color, p.status, s.role
     FROM partners p JOIN partner_staff s ON s.partner_id = p.id WHERE s.user_id = $1 ORDER BY p.created_at`,
    [currentUser(req).id]));
});

/** Vitrine publique d'un partenaire : marque, tontines publiques en recrutement, catalogue. */
export async function partnerShowcase(id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound('Partenaire');
  const p = await one(pool,
    "SELECT id, name, type, description, logo, primary_color, city, phone FROM partners WHERE id = $1 AND status = 'active'", [id]);
  if (!p) throw notFound('Partenaire');
  const tontines = await many(pool,
    `SELECT t.id, t.name, t.kind, t.contribution_amount, t.frequency, t.max_members, t.good_label, t.good_price,
            (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id) AS members
     FROM tontines t WHERE t.partner_id = $1 AND t.visibility = 'public' AND t.status = 'recruiting' ORDER BY t.created_at DESC`, [p.id]);
  const goods = await many(pool,
    'SELECT id, name, description, category, price, image, stock FROM goods WHERE partner_id = $1 AND active ORDER BY price', [p.id]);
  return { ...p, tontines, goods };
}

router.get('/:id/public', async (req, res) => { res.json(await partnerShowcase(req.params.id)); });

/** Tableau de bord du partenaire : groupes, membres, cotisations, revenus, commandes, factures. */
router.get('/:id/dashboard', async (req, res) => {
  const { partner, role } = await assertStaff(pool, req.params.id, currentUser(req).id);
  const id = partner.id;
  const [account, tontines, coffres, orders, invoices, staff, members, month] = await Promise.all([
    one(pool, 'SELECT balance FROM accounts WHERE id = $1', [partner.account_id]),
    many(pool,
      `SELECT t.id, t.name, t.kind, t.visibility, t.status, t.contribution_amount, t.frequency, t.max_members, t.good_label,
              (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id) AS members,
              (SELECT count(*)::int FROM tontine_members WHERE tontine_id = t.id AND status = 'defaulter') AS defaulters,
              (SELECT json_build_object('number', r.number, 'due_date', r.due_date,
                        'paid', (SELECT count(*)::int FROM tontine_contributions c WHERE c.round_id = r.id))
               FROM tontine_rounds r WHERE r.tontine_id = t.id AND r.status = 'open' ORDER BY r.number LIMIT 1) AS current_round
       FROM tontines t WHERE t.partner_id = $1 ORDER BY t.status = 'completed', t.created_at DESC`, [id]),
    many(pool,
      `SELECT c.id, c.name, c.category, c.status, a.balance, (SELECT count(*)::int FROM cagnotte_members WHERE cagnotte_id = c.id) AS members
       FROM cagnottes c JOIN accounts a ON a.id = c.account_id WHERE c.partner_id = $1 ORDER BY c.created_at DESC`, [id]),
    many(pool,
      `SELECT o.*, g.name AS good_name, u.full_name AS beneficiary, u.phone FROM goods_orders o
       JOIN goods g ON g.id = o.good_id JOIN users u ON u.id = o.beneficiary_id
       WHERE o.partner_id = $1 ORDER BY o.status IN ('pending', 'shipped') DESC, o.created_at DESC LIMIT 50`, [id]),
    many(pool, 'SELECT * FROM partner_invoices WHERE partner_id = $1 ORDER BY month DESC LIMIT 12', [id]),
    many(pool, `SELECT u.id, u.full_name, u.phone, s.role FROM partner_staff s JOIN users u ON u.id = s.user_id WHERE s.partner_id = $1`, [id]),
    one(pool, 'SELECT count(*)::int AS n FROM (' + ACTIVE_MEMBERS_SQL + ') m', [id]),
    one(pool,
      `SELECT COALESCE(sum(c.amount + c.penalty), 0)::bigint AS collected
       FROM tontine_contributions c JOIN tontine_rounds r ON r.id = c.round_id JOIN tontines t ON t.id = r.tontine_id
       WHERE t.partner_id = $1 AND c.paid_at >= date_trunc('month', now())`, [id]),
  ]);
  const fees = await one(pool,
    `SELECT COALESCE(sum(e.amount), 0)::bigint AS earned FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id
     WHERE e.account_id = $1 AND t.type = 'tontine_payout'`, [partner.account_id]);
  res.json({
    partner, role, balance: account.balance, activeMembers: members.n,
    estimatedInvoice: Math.max(pricing.partner.minimumMonthly, members.n * pricing.partner.perMemberMonthly),
    collectedThisMonth: month.collected, managementFeesEarned: fees.earned,
    tontines, coffres, orders, invoices, staff,
  });
});

router.patch('/:id', async (req, res) => {
  await assertStaff(pool, req.params.id, currentUser(req).id, 'owner');
  const body = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().max(500).optional(),
    logo: logo.optional(),
    primaryColor: color.optional(),
    phone: z.string().max(20).optional(),
    city: z.string().max(60).optional(),
    managementFeeRate: z.number().min(0).max(pricing.partner.maxManagementFeeRate).optional(),
  }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE partners SET name = COALESCE($2, name), description = COALESCE($3, description), logo = COALESCE($4, logo),
       primary_color = COALESCE($5, primary_color), phone = COALESCE($6, phone), city = COALESCE($7, city),
       management_fee_rate = COALESCE($8, management_fee_rate) WHERE id = $1 RETURNING *`,
    [req.params.id, body.name ?? null, body.description ?? null, body.logo ?? null, body.primaryColor ?? null,
      body.phone ?? null, body.city ?? null, body.managementFeeRate ?? null]);
  res.json(rows[0]);
});

router.post('/:id/staff', async (req, res) => {
  const { partner } = await assertStaff(pool, req.params.id, currentUser(req).id, 'owner');
  const body = z.object({ phone: z.string(), role: z.enum(['manager', 'owner']).default('manager') }).parse(req.body);
  const u = await one(pool, 'SELECT id FROM users WHERE phone = $1', [body.phone]);
  if (!u) throw notFound('Utilisateur Smart Tontine');
  await pool.query(
    `INSERT INTO partner_staff (partner_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (partner_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [partner.id, u.id, body.role]);
  await notify(pool, u.id, 'Espace partenaire', `Tu fais maintenant partie de l'équipe « ${partner.name} »`);
  res.status(201).json({ ok: true });
});

router.delete('/:id/staff/:userId', async (req, res) => {
  const user = currentUser(req);
  await assertStaff(pool, req.params.id, user.id, 'owner');
  if (req.params.userId === user.id) throw badRequest('self', 'Le propriétaire ne peut pas se retirer lui-même');
  await pool.query('DELETE FROM partner_staff WHERE partner_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.status(204).end();
});

/** Retrait des revenus du partenaire (frais de gestion, ventes) vers Mobile Money. */
router.post('/:id/withdraw', async (req, res) => {
  const user = currentUser(req);
  const { partner } = await assertStaff(pool, req.params.id, user.id, 'owner');
  const body = z.object({
    amount: z.number().int().min(100),
    channel: z.enum(['wave', 'orange_money', 'mtn_momo', 'moov_money']),
    phone: z.string().optional(),
    pin: z.string().optional(),
  }).parse(req.body);
  await assertPin(user.id, body.pin);
  const f = fee(body.amount, pricing.withdrawal);
  const phone = body.phone ?? partner.phone ?? (await one(pool, 'SELECT phone FROM users WHERE id = $1', [user.id])).phone;
  const tx = await withTx(async (client) => post(client, {
    type: 'partner_withdrawal', amount: body.amount, fee: f, initiatorId: user.id, provider: paymentProvider().name,
    description: `Retrait partenaire « ${partner.name} »`, meta: { partnerId: partner.id, channel: body.channel, phone, payout: 'processing' },
    legs: [
      { accountId: partner.account_id, amount: -(body.amount + f) },
      { accountId: await systemAccount(client, 'SYS_FLOAT'), amount: body.amount },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: f },
    ],
  }));
  const payout = await paymentProvider().payout({ reference: tx.reference, amount: body.amount, phone, channel: body.channel as Channel });
  await pool.query(`UPDATE transactions SET meta = meta || jsonb_build_object('payout', $2::text) WHERE id = $1`, [tx.id, payout.status]);
  res.status(201).json({ reference: tx.reference, fee: f, status: payout.status });
});

/** Membres du partenaire : groupes de chacun, retards et défaillances (portail partenaire). */
router.get('/:id/members', async (req, res) => {
  const { partner } = await assertStaff(pool, req.params.id, currentUser(req).id);
  res.json(await many(pool,
    `WITH g AS (
       SELECT m.user_id, t.name, 'tontine' AS kind, m.status FROM tontine_members m JOIN tontines t ON t.id = m.tontine_id WHERE t.partner_id = $1
       UNION ALL
       SELECT m.user_id, c.name, 'coffre', 'active' FROM cagnotte_members m JOIN cagnottes c ON c.id = m.cagnotte_id WHERE c.partner_id = $1
     )
     SELECT u.id, u.full_name, u.phone, u.kyc_level,
            json_agg(json_build_object('name', g.name, 'kind', g.kind, 'status', g.status) ORDER BY g.name) AS groups,
            bool_or(g.status = 'defaulter') AS defaulter,
            (SELECT count(*)::int FROM tontine_contributions c JOIN tontine_rounds r ON r.id = c.round_id JOIN tontines t ON t.id = r.tontine_id
              WHERE t.partner_id = $1 AND c.user_id = u.id AND c.late) AS late_payments,
            (SELECT COALESCE(sum(c.amount), 0)::bigint FROM tontine_contributions c JOIN tontine_rounds r ON r.id = c.round_id JOIN tontines t ON t.id = r.tontine_id
              WHERE t.partner_id = $1 AND c.user_id = u.id) AS contributed
     FROM g JOIN users u ON u.id = g.user_id
     GROUP BY u.id ORDER BY u.full_name NULLS LAST`, [partner.id]));
});

/** Catalogue complet du partenaire, y compris les biens désactivés. */
router.get('/:id/goods', async (req, res) => {
  const { partner } = await assertStaff(pool, req.params.id, currentUser(req).id);
  res.json(await many(pool,
    `SELECT g.*, (SELECT count(*)::int FROM goods_orders o WHERE o.good_id = g.id) AS orders
     FROM goods g WHERE g.partner_id = $1 ORDER BY g.active DESC, g.created_at DESC`, [partner.id]));
});

async function statement(partnerId: string, userId: string, query: unknown) {
  const { partner } = await assertStaff(pool, partnerId, userId, 'owner');
  const q = z.object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }).parse(query);
  // Le solde après opération est calculé sur tout l'historique, puis filtré sur la période demandée.
  const entries = await many(pool,
    `SELECT * FROM (
       SELECT e.id, e.created_at, t.reference, t.type, t.description, e.amount, sum(e.amount) OVER (ORDER BY e.id) AS balance_after
       FROM ledger_entries e JOIN transactions t ON t.id = e.tx_id WHERE e.account_id = $1
     ) x WHERE ($2::date IS NULL OR x.created_at >= $2::date) AND ($3::date IS NULL OR x.created_at < $3::date + 1)
     ORDER BY x.id DESC`, [partner.account_id, q.from ?? null, q.to ?? null]);
  return { partner, entries };
}

/** Relevé du compte partenaire (propriétaire) : chaque écriture avec le solde après opération. */
router.get('/:id/statement', async (req, res) => {
  const { entries } = await statement(req.params.id, currentUser(req).id, req.query);
  res.json(entries.map((e) => ({ ...e, balance_after: Number(e.balance_after) })));
});

router.get('/:id/statement.csv', async (req, res) => {
  const { partner, entries } = await statement(req.params.id, currentUser(req).id, req.query);
  const esc = csvCell;
  const lines = entries.map((e) => [new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16), e.reference, e.type, e.description,
    e.amount, Number(e.balance_after)].map(esc).join(';'));
  const csv = ['date;reference;type;libelle;montant;solde', ...lines].join('\n');
  res.type('text/csv; charset=utf-8').attachment(`releve-${partner.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.csv`).send('\uFEFF' + csv);
});

/** Membres distincts actifs dans les groupes du partenaire (base de la licence). */
export const ACTIVE_MEMBERS_SQL = `
  SELECT m.user_id FROM tontine_members m JOIN tontines t ON t.id = m.tontine_id
  WHERE t.partner_id = $1 AND t.status IN ('recruiting', 'active')
  UNION
  SELECT m.user_id FROM cagnotte_members m JOIN cagnottes c ON c.id = m.cagnotte_id
  WHERE c.partner_id = $1 AND c.status = 'open'`;

/**
 * Facturation mensuelle de la licence partenaire (mois écoulé) : membres actifs × 75 F, avec un forfait
 * minimum. Prélevée sur le compte partenaire ; sinon la facture reste due et le propriétaire est prévenu.
 */
export async function invoicePartners(month = previousMonth()) {
  const partners = await many(pool,
    `SELECT p.* FROM partners p WHERE p.status = 'active' AND p.created_at < to_date($1, 'YYYY-MM') + interval '1 month'
     AND NOT EXISTS (SELECT 1 FROM partner_invoices i WHERE i.partner_id = p.id AND i.month = $1)`, [month]);
  let invoiced = 0;
  for (const p of partners) {
    await withTx(async (client) => {
      const { n } = await one(client, 'SELECT count(*)::int AS n FROM (' + ACTIVE_MEMBERS_SQL + ') m', [p.id]);
      const amount = Math.max(pricing.partner.minimumMonthly, n * pricing.partner.perMemberMonthly);
      const acc = await one(client, 'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [p.account_id]);
      let txId: string | null = null;
      if (acc.balance >= amount) {
        const tx = await post(client, {
          type: 'partner_licence', amount, description: `Licence Smart Tontine ${month} — ${p.name}`, meta: { partnerId: p.id, month, members: n },
          legs: [{ accountId: p.account_id, amount: -amount }, { accountId: await systemAccount(client, 'SYS_FEES'), amount }],
        });
        txId = tx.id;
      }
      await client.query(
        'INSERT INTO partner_invoices (partner_id, month, active_members, amount, status, tx_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [p.id, month, n, amount, txId ? 'paid' : 'due', txId]);
      for (const uid of await staffIds(client, p.id)) {
        await notify(client, uid, `Licence ${month}`, txId
          ? `${amount} F prélevés (${n} membres actifs).`
          : `Facture de ${amount} F en attente : alimente le compte partenaire.`);
      }
      invoiced++;
    });
  }
  return invoiced;
}

export function previousMonth(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return x.toISOString().slice(0, 7);
}

/** Alimenter le compte partenaire depuis son propre jeton (pour payer la licence). */
router.post('/:id/topup', async (req, res) => {
  const user = currentUser(req);
  const { partner } = await assertStaff(pool, req.params.id, user.id, 'owner');
  const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
  await withTx(async (client) => {
    const { rows } = await client.query("SELECT id FROM accounts WHERE owner_id = $1 AND kind = 'wallet'", [user.id]);
    await post(client, {
      type: 'partner_topup', amount, initiatorId: user.id, description: `Alimentation du compte « ${partner.name} »`,
      meta: { partnerId: partner.id }, legs: [{ accountId: rows[0].id, amount: -amount }, { accountId: partner.account_id, amount }],
    });
    // Une facture due est réglée dès que le solde le permet.
    const due = await many(client, "SELECT * FROM partner_invoices WHERE partner_id = $1 AND status = 'due' ORDER BY month", [partner.id]);
    for (const inv of due) {
      const acc = await one(client, 'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [partner.account_id]);
      if (acc.balance < inv.amount) break;
      const tx = await post(client, {
        type: 'partner_licence', amount: inv.amount, description: `Licence Smart Tontine ${inv.month} — ${partner.name}`,
        meta: { partnerId: partner.id, month: inv.month },
        legs: [{ accountId: partner.account_id, amount: -inv.amount }, { accountId: await systemAccount(client, 'SYS_FEES'), amount: inv.amount }],
      });
      await client.query("UPDATE partner_invoices SET status = 'paid', tx_id = $2 WHERE id = $1", [inv.id, tx.id]);
    }
  });
  res.json({ ok: true });
});

