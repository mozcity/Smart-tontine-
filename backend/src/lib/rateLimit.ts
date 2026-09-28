import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

/**
 * Limitation de débit par adresse IP (fenêtre fixe, en mémoire). Suffit pour une instance ;
 * avec plusieurs instances, la limite globale est portée par le reverse proxy / WAF (voir docs/10).
 */
export function rateLimit(opts: { windowMs: number; max: number; name: string; enabled?: boolean }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    if (opts.enabled === false) return next();
    const now = Date.now();
    const key = req.ip ?? 'inconnu';
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, h);
      if (hits.size > 50_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    h.count++;
    res.setHeader('RateLimit-Limit', String(opts.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.max - h.count)));
    if (h.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      throw new HttpError(429, 'too_many_requests', 'Trop de requêtes, réessaie dans un instant');
    }
    next();
  };
}
