import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { forbidden, notFound } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { runJobs } from '../jobs.js';
import { canManage, load } from './tontine.js';

/**
 * Outillage de démonstration (audit du 05/10/2026) : jamais monté en production (voir app.ts).
 * Permet de rejouer de bout en bout les cas qui dépendent du temps : impayé couvert par la caution,
 * avance sur un pot lointain. Réservé à l'organisateur de la tontine concernée.
 */
export const router = Router();

async function managedRound(userId: string, tontineId: string, number: number) {
  const t = await load(pool, tontineId);
  if (!(await canManage(pool, t, userId))) throw forbidden('Réservé à l\'organisateur de la tontine');
  const r = await pool.query('SELECT id FROM tontine_rounds WHERE tontine_id = $1 AND number = $2', [t.id, number]);
  if (!r.rowCount) throw notFound('Tour');
  return t;
}

/** Fait passer un tour en impayé (échéance dépassée du délai de grâce), puis exécute les tâches planifiées. */
router.post('/tontines/:id/rounds/:number/overdue', async (req, res) => {
  const number = Number(req.params.number);
  const t = await managedRound(currentUser(req).id, req.params.id as string, number);
  await pool.query('UPDATE tontine_rounds SET due_date = CURRENT_DATE - $3::int WHERE tontine_id = $1 AND number = $2',
    [t.id, number, pricing.tontine.graceDays + 1]);
  res.json({ ok: true, jobs: await runJobs() });
});

/** Repousse l'échéance d'un tour (ex. 70 jours, pour tester l'avance sur un pot à plus de 61 jours). */
router.post('/tontines/:id/rounds/:number/due-in', async (req, res) => {
  const { days } = z.object({ days: z.number().int().min(-60).max(400) }).parse(req.body);
  const number = Number(req.params.number);
  const t = await managedRound(currentUser(req).id, req.params.id as string, number);
  await pool.query('UPDATE tontine_rounds SET due_date = CURRENT_DATE + $3::int WHERE tontine_id = $1 AND number = $2', [t.id, number, days]);
  res.json({ ok: true });
});

/** Exécute immédiatement les tâches horaires (rappels, impayés, crédits, rattrapages…). */
router.post('/jobs/run', async (_req, res) => {
  res.json(await runJobs());
});
