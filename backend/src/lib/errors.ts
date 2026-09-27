import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
export const forbidden = (message = 'Accès refusé') => new HttpError(403, 'forbidden', message);
export const notFound = (what = 'Ressource') => new HttpError(404, 'not_found', `${what} introuvable`);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation', message: 'Données invalides', details: err.issues });
    return;
  }
  // Violation de contrainte CHECK sur le solde (course entre deux débits)
  if (err?.code === '23514' && String(err?.constraint).includes('balance')) {
    res.status(409).json({ error: 'insufficient_funds', message: 'Solde insuffisant' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal', message: 'Erreur interne' });
};
