import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTx } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { assertPin } from './auth.js';
import { pricing } from '../pricing.js';
import { post, systemAccount, walletOf } from '../services/ledger.js';
import { track } from '../services/notify.js';
import { chargePro, isPro } from '../services/pro.js';

// Notifications, contenus « News & Tuto », abonnement Smart Tontine+ et support client.
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
    if (u.plan === 'plus') throw conflict('already_plus', 'Tu es déjà abonné(e) à Smart Tontine+');
    await chargePlus(client, user.id);
  });
  await track(pool, user.id, 'plus_subscribed', {});
  res.json({ plan: 'plus' });
});

router.post('/pro/subscribe', async (req, res) => {
  const user = currentUser(req);
  await withTx(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    if (await isPro(client, user.id)) throw conflict('already_pro', 'Tu es déjà Organisateur Pro');
    await chargePro(client, user.id);
  });
  await track(pool, user.id, 'pro_subscribed', {});
  res.json({ pro: true });
});

router.post('/pro/cancel', async (req, res) => {
  // Reste actif jusqu'à la date de renouvellement, sans reconduction.
  await pool.query('UPDATE users SET pro_auto_renew = false WHERE id = $1', [currentUser(req).id]);
  res.json({ ok: true });
});

router.post('/plan/cancel', async (req, res) => {
  // L'abonnement reste actif jusqu'à la date de renouvellement puis n'est pas reconduit.
  await pool.query("UPDATE users SET plan_renews_at = NULL WHERE id = $1 AND plan = 'plus'", [currentUser(req).id]);
  res.json({ ok: true });
});

export async function chargePlus(client: import('pg').PoolClient, userId: string) {
  const wallet = await walletOf(client, userId);
  await post(client, {
    type: 'subscription', amount: pricing.plus.monthlyPrice, initiatorId: userId, description: 'Abonnement Smart Tontine+',
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

// ───── Suppression du compte (exigée par Google Play et l'App Store) ─────

/** Ce qui empêche de fermer le compte : l'argent et les engagements envers d'autres membres passent d'abord. */
async function closureBlockers(userId: string): Promise<string[]> {
  const r = await one(pool,
    `SELECT
       (SELECT COALESCE(sum(balance), 0) FROM accounts WHERE owner_id = $1 AND kind <> 'system')::bigint AS funds,
       (SELECT count(*) FROM tontine_members m JOIN tontines t ON t.id = m.tontine_id
         WHERE m.user_id = $1 AND t.status = 'active')::int AS tontines,
       (SELECT count(*) FROM tontines WHERE organizer_id = $1 AND status IN ('recruiting', 'active'))::int AS organizes,
       (SELECT count(*) FROM loans WHERE user_id = $1 AND status = 'active')::int AS loans,
       (SELECT count(*) FROM contrats WHERE (debtor_id = $1 OR creditor_id = $1) AND status IN ('draft', 'active'))::int AS contrats,
       (SELECT count(*) FROM goods_plans WHERE user_id = $1 AND status = 'active')::int AS plans,
       (SELECT count(*) FROM goods_orders WHERE beneficiary_id = $1 AND status IN ('pending', 'shipped'))::int AS orders,
       (SELECT count(*) FROM partner_staff WHERE user_id = $1 AND role = 'owner')::int AS partners,
       (SELECT count(*) FROM transactions WHERE initiator_id = $1 AND (status = 'pending'
          OR (type = 'withdrawal' AND status = 'completed' AND meta->>'payout' IN ('pending', 'processing', 'unknown'))))::int AS in_flight`,
    [userId]);
  const out: string[] = [];
  if (r.funds > 0) out.push(`Retire d'abord ton argent (${new Intl.NumberFormat('fr-FR').format(r.funds)} FCFA sur ton jeton et tes coffres)`);
  if (r.tontines > 0) out.push('Termine tes tontines en cours');
  if (r.organizes > 0) out.push('Clôture ou transmets les tontines que tu organises');
  if (r.loans > 0) out.push('Rembourse ton crédit en cours');
  if (r.contrats > 0) out.push('Solde ou annule tes contrats');
  if (r.plans + r.orders > 0) out.push('Termine ou annule tes achats de biens');
  if (r.partners > 0) out.push('Transmets la propriété de ton espace partenaire');
  if (r.in_flight > 0) out.push('Attends la fin de tes dépôts ou retraits en cours');
  return out;
}

router.get('/deletion', async (req, res) => {
  const blockers = await closureBlockers(currentUser(req).id);
  res.json({ possible: blockers.length === 0, blockers });
});

/**
 * Ferme et anonymise le compte : nom, e-mail, PIN, double authentification, jetons et données de confort sont effacés ;
 * le numéro est libéré. Les opérations financières et le dossier KYC sont conservés 10 ans (LBC/FT), sans lien visible.
 */
router.post('/deletion', async (req, res) => {
  const user = currentUser(req);
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body);
  await assertPin(user.id, pin);
  const blockers = await closureBlockers(user.id);
  if (blockers.length) throw conflict('account_not_empty', blockers.join(' · '));
  await withTx(async (client) => {
    await client.query('DELETE FROM tontine_members m USING tontines t WHERE t.id = m.tontine_id AND m.user_id = $1 AND t.status = \'recruiting\'', [user.id]);
    await client.query('DELETE FROM cagnotte_members WHERE user_id = $1', [user.id]);
    for (const table of ['budget_entries', 'budget_plans', 'notifications', 'user_events', 'otp_codes']) {
      await client.query(`DELETE FROM ${table} WHERE ${table === 'otp_codes' ? 'phone = (SELECT phone FROM users WHERE id = $1)' : 'user_id = $1'}`, [user.id]);
    }
    await client.query(
      `UPDATE users SET status = 'closed', phone = 'closed:' || id::text, full_name = 'Compte supprimé', email = NULL,
         pin_hash = NULL, totp_secret = NULL, totp_enabled_at = NULL, sessions_revoked_at = now() WHERE id = $1`, [user.id]);
  });
  await track(pool, user.id, 'account_deleted', {});
  res.json({ ok: true });
});
