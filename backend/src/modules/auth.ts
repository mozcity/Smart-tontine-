import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, pool, withTx } from '../db.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { hashSecret, otpCode, referralCode, verifySecret } from '../lib/crypto.js';
import { requireAuth, currentUser, signToken } from '../lib/auth.js';
import { createAccount } from '../services/ledger.js';
import { sms } from '../services/sms.js';
import { track } from '../services/notify.js';

export const router = Router();

// Numéros UEMOA : +225 (CI), +221 (SN), +223 (ML), +226 (BF), +227 (NE), +228 (TG), +229 (BJ), +245 (GW)
const phone = z.string().trim().regex(/^\+22[1-9]\d{8,10}$|^\+245\d{7,9}$/, 'Numéro au format international, ex. +2250748553268');

router.post('/otp/request', async (req, res) => {
  const { phone: p } = z.object({ phone }).parse(req.body);
  const recent = await one(pool, "SELECT count(*)::int AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '15 minutes'", [p]);
  if (recent.n >= 5) throw new HttpError(429, 'too_many_requests', 'Trop de demandes, réessaie dans quelques minutes');

  const code = otpCode();
  await pool.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [p, hashSecret(code), config.otpTtlMinutes],
  );
  await sms.send(p, `Smart Tontine : ton code est ${code}. Ne le partage avec personne.`);
  res.json({ ok: true, ...(config.isProd ? {} : { devCode: code }) });
});

router.post('/otp/verify', async (req, res) => {
  const body = z.object({
    phone,
    code: z.string().regex(/^\d{6}$/),
    fullName: z.string().trim().min(2).max(80).optional(),
    referralCode: z.string().trim().toUpperCase().optional(),
    channel: z.string().max(40).optional(),
  }).parse(req.body);

  const result = await withTx(async (client) => {
    const otp = await one(client,
      `SELECT * FROM otp_codes WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [body.phone]);
    if (!otp || otp.attempts >= config.otpMaxAttempts) throw badRequest('otp_invalid', 'Code expiré, demande un nouveau code');
    if (!verifySecret(body.code, otp.code_hash)) {
      await client.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
      return { error: true as const };
    }
    await client.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id]);

    let user = await one(client, 'SELECT id, role, status FROM users WHERE phone = $1', [body.phone]);
    let isNew = false;
    if (!user) {
      isNew = true;
      const referrer = body.referralCode
        ? await one(client, 'SELECT id FROM users WHERE referral_code = $1', [body.referralCode])
        : undefined;
      user = await one(client,
        `INSERT INTO users (phone, full_name, referral_code, referred_by, acquisition_channel)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, role, status`,
        [body.phone, body.fullName ?? null, referralCode(), referrer?.id ?? null, body.channel ?? (referrer ? 'parrainage' : null)]);
      await createAccount(client, user.id, 'wallet');
      await track(client, user.id, 'signup', { channel: body.channel, referred: !!referrer });
    }
    if (user.status !== 'active') throw new HttpError(403, 'account_inactive', 'Compte suspendu, contacte le support');
    return { user, isNew };
  });

  // Hors transaction : la tentative ratée doit rester comptabilisée.
  if ('error' in result) throw badRequest('otp_invalid', 'Code incorrect');
  res.json({ token: signToken({ id: result.user.id, role: result.user.role }), isNew: result.isNew });
});

router.get('/me', requireAuth, async (req, res) => {
  const me = await one(pool,
    `SELECT u.id, u.phone, u.full_name, u.email, u.role, u.kyc_level, u.plan, u.referral_code, u.points,
            (u.pin_hash IS NOT NULL) AS has_pin, (u.pro_renews_at > now()) IS TRUE AS is_pro, u.pro_renews_at, a.balance AS wallet_balance
     FROM users u JOIN accounts a ON a.owner_id = u.id AND a.kind = 'wallet' WHERE u.id = $1`,
    [currentUser(req).id]);
  res.json(me);
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = z.object({ fullName: z.string().trim().min(2).max(80).optional(), email: z.email().optional() }).parse(req.body);
  await pool.query('UPDATE users SET full_name = COALESCE($2, full_name), email = COALESCE($3, email) WHERE id = $1',
    [currentUser(req).id, body.fullName ?? null, body.email ?? null]);
  res.json({ ok: true });
});

router.put('/me/pin', requireAuth, async (req, res) => {
  const body = z.object({ pin: z.string().regex(/^\d{4}$/), currentPin: z.string().optional() }).parse(req.body);
  const user = currentUser(req);
  const row = await one(pool, 'SELECT pin_hash FROM users WHERE id = $1', [user.id]);
  if (row.pin_hash && !(body.currentPin && verifySecret(body.currentPin, row.pin_hash))) {
    throw badRequest('pin_invalid', 'Code PIN actuel incorrect');
  }
  await pool.query('UPDATE users SET pin_hash = $2 WHERE id = $1', [user.id, hashSecret(body.pin)]);
  res.json({ ok: true });
});

/** Vérifie le code PIN avant toute sortie d'argent. */
export async function assertPin(userId: string, pin: string | undefined) {
  const row = await one(pool, 'SELECT pin_hash FROM users WHERE id = $1', [userId]);
  if (!row?.pin_hash) throw badRequest('pin_required', 'Définis d\'abord ton code PIN');
  if (!pin || !verifySecret(pin, row.pin_hash)) throw badRequest('pin_invalid', 'Code PIN incorrect');
}
