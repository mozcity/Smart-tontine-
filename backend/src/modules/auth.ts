import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, pool, withTx } from '../db.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { hashSecret, otpCode, referralCode, verifySecret } from '../lib/crypto.js';
import { requireAuth, currentUser, signToken } from '../lib/auth.js';
import { clientOf, closeSession, openSession, revokeAllSessions, rotateSession } from '../lib/session.js';
import { matchTotp, newTotpSecret, openSecret, otpauthUrl, sealSecret } from '../lib/totp.js';
import { createAccount } from '../services/ledger.js';
import { sms } from '../services/sms.js';
import { notify, track } from '../services/notify.js';

export const router = Router();

// Numéros UEMOA : +225 (CI), +221 (SN), +223 (ML), +226 (BF), +227 (NE), +228 (TG), +229 (BJ), +245 (GW)
const phone = z.string().trim().regex(/^\+22[1-9]\d{8,10}$|^\+245\d{7,9}$/, 'Numéro au format international, ex. +2250748553268');

/** PIN refusés : chiffres identiques, suites croissantes ou décroissantes, motifs répétés et codes les plus courants. */
const COMMON_PINS = new Set(['1212', '2580', '0852', '1004', '2000', '1122', '6969', '1010', '1313', '2001', '1999', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
export function isWeakPin(pin: string): boolean {
  const d = [...pin].map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]);
  return d.every((x) => x === d[0]) || steps.every((s) => s === 1) || steps.every((s) => s === -1)
    || (pin.slice(0, 2) === pin.slice(2)) || COMMON_PINS.has(pin);
}

const isReviewPhone = (p: string) =>
  !!process.env.REVIEW_PHONE && /^\d{6}$/.test(process.env.REVIEW_OTP ?? '') && p === process.env.REVIEW_PHONE;

router.post('/otp/request', async (req, res) => {
  const { phone: p } = z.object({ phone }).parse(req.body);
  const recent = await one(pool, "SELECT count(*)::int AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '15 minutes'", [p]);
  if (recent.n >= 5) throw new HttpError(429, 'too_many_requests', 'Trop de demandes, réessaie dans quelques minutes');

  // Compte de revue des stores (Apple, Google) : numéro et code fixes fournis aux équipes de validation.
  // Désactivé sans les deux variables ; jamais pour un compte du back-office ; mêmes limites que tout OTP.
  const review = isReviewPhone(p) && !(await one(pool, "SELECT 1 FROM users WHERE phone = $1 AND role <> 'customer'", [p]));
  const code = review ? process.env.REVIEW_OTP! : otpCode();
  await pool.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [p, hashSecret(code), config.otpTtlMinutes],
  );
  if (!review) await sms.send(p, `Smart Tontine : ton code est ${code}. Ne le partage avec personne.`, 'otp');
  // Code renvoyé seulement en développement ET avec le faux fournisseur SMS : un serveur mal configuré
  // (NODE_ENV oublié) qui envoie de vrais SMS ne le divulgue jamais.
  res.json({ ok: true, ...(config.otpDevEcho ? { devCode: code } : {}) });
});

router.post('/otp/verify', async (req, res) => {
  const body = z.object({
    phone,
    code: z.string().regex(/^\d{6}$/),
    fullName: z.string().trim().min(2).max(80).optional(),
    referralCode: z.string().trim().toUpperCase().optional(),
    channel: z.string().max(40).optional(),
  }).parse(req.body);

  // Anti force brute : 3 essais par code, et au plus 10 essais ratés par numéro et par heure.
  const failures = await one(pool,
    "SELECT COALESCE(sum(attempts), 0)::int AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'", [body.phone]);
  if (failures.n >= config.otpMaxFailuresPerHour) throw new HttpError(429, 'otp_locked', 'Trop d\'essais sur ce numéro : réessaie dans une heure');

  const result = await withTx(async (client) => {
    const otp = await one(client,
      `SELECT * FROM otp_codes WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [body.phone]);
    if (!otp) throw badRequest('otp_invalid', 'Code expiré, demande un nouveau code');
    if (otp.attempts >= config.otpMaxAttempts) throw new HttpError(429, 'otp_locked', 'Trop d\'essais : demande un nouveau code');
    if (!verifySecret(body.code, otp.code_hash)) {
      await client.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
      return { error: true as const, left: config.otpMaxAttempts - otp.attempts - 1 };
    }
    await client.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id]);

    // Le nom saisi complète un compte qui n'en avait pas encore (il n'écrase jamais un nom existant).
    let user = await one(client,
      'UPDATE users SET full_name = COALESCE(full_name, $2) WHERE phone = $1 RETURNING id, role, status', [body.phone, body.fullName ?? null]);
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
  if ('error' in result) {
    const left = result.left ?? 0;
    if (left <= 0) throw new HttpError(429, 'otp_locked', 'Code incorrect. Trop d\'essais : demande un nouveau code');
    throw badRequest('otp_invalid', `Code incorrect (${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''})`);
  }
  const session = await openSession(res, clientOf(req), { id: result.user.id, role: result.user.role });
  res.json({ ...session.body, isNew: result.isNew });
});

/** Renouvelle le jeton d'accès (30 min) à partir du jeton de renouvellement, qui est remplacé au passage. */
router.post('/refresh', async (req, res) => {
  res.json(await rotateSession(req, res));
});

/** Déconnexion de cet appareil : le jeton de renouvellement est révoqué (et le cookie effacé sur le web). */
router.post('/logout', async (req, res) => {
  await closeSession(req, res);
  res.json({ ok: true });
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
  if (isWeakPin(body.pin)) throw badRequest('weak_pin', 'Code PIN trop facile à deviner (ex. 0000, 1234, 1212) : choisis-en un autre');
  const user = currentUser(req);
  const row = await one(pool, 'SELECT pin_hash FROM users WHERE id = $1', [user.id]);
  if (row.pin_hash) await assertPin(user.id, body.currentPin); // le changement de PIN compte aussi les erreurs
  await pool.query('UPDATE users SET pin_hash = $2, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1', [user.id, hashSecret(body.pin)]);
  res.json({ ok: true });
});

/** Déconnecte tous les appareils (téléphone perdu ou volé) : jetons d'accès et de renouvellement révoqués ; une nouvelle session est ouverte pour cet appareil. */
router.post('/logout-all', requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { at } = await one(pool, 'UPDATE users SET sessions_revoked_at = now() WHERE id = $1 RETURNING sessions_revoked_at AS at', [u.id]);
  await revokeAllSessions(u.id);
  // Le nouveau jeton d'accès est daté de la seconde suivante : seul l'appareil qui a demandé la révocation reste connecté.
  const session = await openSession(res, clientOf(req), { id: u.id, role: u.role }, undefined, Math.floor(new Date(at).getTime() / 1000) + 1);
  res.json(session.body);
});

// ───── Double authentification (TOTP) — comptes support et admin ─────
const staffOnly = (role: string) => { if (role !== 'support' && role !== 'admin') throw new HttpError(403, 'forbidden', 'Réservé aux comptes du back-office'); };

router.get('/mfa', requireAuth, async (req, res) => {
  const u = currentUser(req);
  res.json({ enrolled: !!u.mfaEnrolled, verified: !!u.mfa, required: config.adminMfaRequired && (u.role === 'support' || u.role === 'admin') });
});

/** Génère un secret (non actif tant qu'un premier code n'a pas été validé). */
router.post('/mfa/setup', requireAuth, async (req, res) => {
  const u = currentUser(req);
  staffOnly(u.role);
  if (u.mfaEnrolled) throw new HttpError(409, 'mfa_already_enabled', 'Double authentification déjà active');
  const secret = newTotpSecret();
  const row = await one(pool, 'UPDATE users SET totp_secret = $2 WHERE id = $1 RETURNING phone', [u.id, sealSecret(secret)]);
  res.json({ secret, otpauthUrl: otpauthUrl(secret, row.phone) });
});

/** Contrôle un code TOTP : verrouillage 15 min après 5 erreurs, un même code ne sert qu'une fois. */
async function checkTotp(userId: string, code: string) {
  const row = await one(pool, 'SELECT totp_secret, totp_last_step, mfa_failed_attempts, mfa_locked_until FROM users WHERE id = $1', [userId]);
  if (!row?.totp_secret) throw badRequest('mfa_not_setup', 'Commence par configurer la double authentification');
  if (row.mfa_locked_until && new Date(row.mfa_locked_until) > new Date()) {
    throw new HttpError(423, 'mfa_locked', 'Trop d\'erreurs : réessaie dans 15 minutes');
  }
  const step = matchTotp(openSecret(row.totp_secret), code);
  if (step === null || (row.totp_last_step !== null && step <= row.totp_last_step)) {
    await pool.query(
      `UPDATE users SET mfa_failed_attempts = mfa_failed_attempts + 1,
         mfa_locked_until = CASE WHEN mfa_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' END WHERE id = $1`, [userId]);
    throw badRequest('mfa_invalid', 'Code incorrect ou déjà utilisé');
  }
  await pool.query('UPDATE users SET totp_last_step = $2, mfa_failed_attempts = 0, mfa_locked_until = NULL WHERE id = $1', [userId, step]);
}

router.post('/mfa/enable', requireAuth, async (req, res) => {
  const u = currentUser(req);
  staffOnly(u.role);
  if (u.mfaEnrolled) throw new HttpError(409, 'mfa_already_enabled', 'Double authentification déjà active');
  const { code } = z.object({ code: z.string() }).parse(req.body);
  await checkTotp(u.id, code);
  await pool.query('UPDATE users SET totp_enabled_at = now() WHERE id = $1', [u.id]);
  await track(pool, u.id, 'mfa_enabled', {});
  res.json({ token: signToken(u, true) });
});

router.post('/mfa/verify', requireAuth, async (req, res) => {
  const u = currentUser(req);
  if (!u.mfaEnrolled) throw badRequest('mfa_not_setup', 'Double authentification non activée');
  const { code } = z.object({ code: z.string() }).parse(req.body);
  await checkTotp(u.id, code);
  res.json({ token: signToken(u, true) });
});

/**
 * Vérifie le code PIN avant toute sortie d'argent. Après 5 erreurs consécutives, le PIN est
 * verrouillé 30 minutes : les tentatives suivantes sont refusées sans même être comparées.
 */
export async function assertPin(userId: string, pin: string | undefined) {
  const row = await one(pool, 'SELECT pin_hash, pin_failed_attempts, pin_locked_until FROM users WHERE id = $1', [userId]);
  if (!row?.pin_hash) throw badRequest('pin_required', 'Définis d\'abord ton code PIN');
  if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(row.pin_locked_until).getTime() - Date.now()) / 60_000);
    throw new HttpError(423, 'pin_locked', `Code PIN verrouillé après trop d'erreurs. Réessaie dans ${minutes} min.`);
  }
  if (pin && verifySecret(pin, row.pin_hash)) {
    if (row.pin_failed_attempts > 0) await pool.query('UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1', [userId]);
    return;
  }
  const { rows } = await pool.query(
    `UPDATE users SET pin_failed_attempts = pin_failed_attempts + 1,
       pin_locked_until = CASE WHEN pin_failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) END
     WHERE id = $1 RETURNING pin_failed_attempts`, [userId, config.pinMaxAttempts, config.pinLockMinutes]);
  const left = config.pinMaxAttempts - rows[0].pin_failed_attempts;
  if (left <= 0) {
    await notify(pool, userId, 'Code PIN verrouillé 🔒', `Trop d'erreurs : ton code PIN est bloqué ${config.pinLockMinutes} minutes. Si ce n'était pas toi, contacte le support.`);
    throw new HttpError(423, 'pin_locked', `Code PIN verrouillé ${config.pinLockMinutes} minutes après ${config.pinMaxAttempts} erreurs.`);
  }
  throw badRequest('pin_invalid', `Code PIN incorrect (${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''})`);
}
