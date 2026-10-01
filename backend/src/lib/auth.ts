import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError, forbidden } from './errors.js';
import { pool } from '../db.js';

export type Role = 'customer' | 'support' | 'admin';
export interface AuthUser { id: string; role: Role; mfa?: boolean; mfaEnrolled?: boolean }

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

/** Jeton de session. `mfa` = double authentification validée : session courte (12 h) pour le back-office. */
export function signToken(user: AuthUser, mfa = false): string {
  return jwt.sign({ sub: user.id, role: user.role, ...(mfa ? { mfa: true } : {}) }, config.jwtSecret,
    { expiresIn: (mfa ? '12h' : config.jwtTtl) as jwt.SignOptions['expiresIn'] });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'unauthenticated', 'Session invalide ou expirée');
  }
  // Le rôle et le statut sont relus en base : une suspension prend effet immédiatement.
  const { rows } = await pool.query(
    "UPDATE users SET last_active_at = now() WHERE id = $1 RETURNING id, role, status, (totp_enabled_at IS NOT NULL) AS mfa_enrolled",
    [payload.sub],
  );
  const user = rows[0];
  if (!user || user.status !== 'active') throw new HttpError(401, 'unauthenticated', 'Compte inactif');
  req.user = { id: user.id, role: user.role, mfa: payload.mfa === true, mfaEnrolled: user.mfa_enrolled };
  next();
};

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden();
  next();
};

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'unauthenticated', 'Non authentifié');
  return req.user;
}

/**
 * Back-office : la double authentification est exigée dès qu'elle est activée sur le compte,
 * et pour tous les comptes support/admin quand ADMIN_MFA_REQUIRED est actif (par défaut en production).
 */
export const requireMfa: RequestHandler = (req, _res, next) => {
  const user = currentUser(req);
  if (user.mfaEnrolled && !user.mfa) throw new HttpError(403, 'mfa_required', 'Saisis le code de ton application d\'authentification');
  if (!user.mfaEnrolled && config.adminMfaRequired) throw new HttpError(403, 'mfa_setup_required', 'Active la double authentification pour accéder au back-office');
  next();
};
