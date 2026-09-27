import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError, forbidden } from './errors.js';
import { pool } from '../db.js';

export type Role = 'customer' | 'support' | 'admin';
export interface AuthUser { id: string; role: Role }

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtTtl as jwt.SignOptions['expiresIn'] });
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
    "UPDATE users SET last_active_at = now() WHERE id = $1 RETURNING id, role, status",
    [payload.sub],
  );
  const user = rows[0];
  if (!user || user.status !== 'active') throw new HttpError(401, 'unauthenticated', 'Compte inactif');
  req.user = { id: user.id, role: user.role };
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
