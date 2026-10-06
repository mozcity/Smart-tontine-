import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { one, pool } from '../db.js';
import { HttpError } from './errors.js';
import { signToken, type Role } from './auth.js';

// Sessions : jeton d'accès court (JWT, 30 min) + jeton de renouvellement (30 jours, rotation à chaque usage).
// Web : le jeton de renouvellement vit dans un cookie HttpOnly, invisible du JavaScript (un XSS ne peut pas le voler).
// App : il est rendu dans la réponse et rangé dans le trousseau sécurisé du téléphone (SecureStore).

export const REFRESH_COOKIE = 'st_refresh';
const REFRESH_DAYS = 30;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type Client = 'web' | 'app';
export const clientOf = (req: Request): Client => (req.headers['x-client'] === 'web' ? 'web' : 'app');

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict' as const,
    path: '/auth',
    maxAge: REFRESH_DAYS * 86_400_000,
  };
}

export function readRefreshToken(req: Request): string | undefined {
  if (clientOf(req) === 'web') {
    const raw = req.headers.cookie ?? '';
    const m = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    return m ? decodeURIComponent(m.slice(REFRESH_COOKIE.length + 1)) : undefined;
  }
  const t = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  return typeof t === 'string' && t.length <= 200 ? t : undefined;
}

/** Ouvre une session : jeton d'accès + jeton de renouvellement (cookie pour le web, corps de réponse pour l'app). */
export async function openSession(res: Response, client: Client, user: { id: string; role: Role }, family = randomUUID(), iat?: number) {
  const refresh = randomBytes(32).toString('base64url');
  const row = await one(pool,
    `INSERT INTO refresh_tokens (user_id, family, token_hash, client, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5)) RETURNING id`,
    [user.id, family, sha256(refresh), client, REFRESH_DAYS]);
  if (client === 'web') res.cookie(REFRESH_COOKIE, refresh, cookieOptions());
  return {
    id: row.id as string,
    body: { token: signToken(user, false, iat), expiresIn: config.accessTtlSeconds, ...(client === 'app' ? { refreshToken: refresh } : {}) },
  };
}

/** Renouvelle une session (rotation). Un jeton déjà remplacé ou révoqué qui revient : toute la famille est révoquée. */
export async function rotateSession(req: Request, res: Response) {
  const token = readRefreshToken(req);
  if (!token) throw new HttpError(401, 'unauthenticated', 'Session expirée, reconnecte-toi');
  const rt = await one(pool,
    `SELECT r.*, u.role, u.status, u.sessions_revoked_at FROM refresh_tokens r JOIN users u ON u.id = r.user_id WHERE r.token_hash = $1`,
    [sha256(token)]);
  if (!rt) throw new HttpError(401, 'unauthenticated', 'Session expirée, reconnecte-toi');
  if (rt.revoked_at) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family = $1 AND revoked_at IS NULL', [rt.family]);
    throw new HttpError(401, 'unauthenticated', 'Session révoquée, reconnecte-toi');
  }
  const revokedAfter = rt.sessions_revoked_at && new Date(rt.created_at) < new Date(rt.sessions_revoked_at);
  if (new Date(rt.expires_at) < new Date() || rt.status !== 'active' || revokedAfter) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [rt.id]);
    throw new HttpError(401, 'unauthenticated', 'Session expirée, reconnecte-toi');
  }
  // Révocation conditionnelle : deux renouvellements simultanés avec le même jeton ne passent pas tous les deux.
  const claimed = await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [rt.id]);
  if (!claimed.rowCount) throw new HttpError(401, 'unauthenticated', 'Session révoquée, reconnecte-toi');
  const next = await openSession(res, rt.client, { id: rt.user_id, role: rt.role }, rt.family);
  await pool.query('UPDATE refresh_tokens SET replaced_by = $2 WHERE id = $1', [rt.id, next.id]);
  return next.body;
}

export async function closeSession(req: Request, res: Response) {
  const token = readRefreshToken(req);
  if (token) await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(token)]);
  if (clientOf(req) === 'web') res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

export const revokeAllSessions = (userId: string) =>
  pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
