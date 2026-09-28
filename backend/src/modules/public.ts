import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool } from '../db.js';
import { pricing } from '../pricing.js';
import { BRANDING_SQL } from '../services/partners.js';
import { rateLimit } from '../lib/rateLimit.js';
import { config } from '../config.js';
import { publicTontines, tontinePreview } from './tontine.js';
import { partnerShowcase } from './partners.js';

// API publique (sans compte) du site web : tarifs, chiffres clés, tontines publiques, catalogue,
// vitrines des partenaires et formulaire « Devenir partenaire ». Aucune donnée personnelle exposée.
export const router = Router();

router.get('/pricing', (_req, res) => { res.json(pricing); });

router.get('/stats', async (_req, res) => {
  const s = await one(pool,
    `SELECT (SELECT count(*)::int FROM users WHERE role = 'customer') AS members,
            (SELECT count(*)::int FROM tontines WHERE status IN ('recruiting', 'active')) AS active_tontines,
            (SELECT count(*)::int FROM tontine_rounds WHERE status = 'paid_out') AS pots_paid,
            (SELECT COALESCE(sum(amount), 0)::bigint FROM transactions WHERE type = 'tontine_payout' AND status = 'completed') AS pots_amount,
            (SELECT count(*)::int FROM partners WHERE status = 'active') AS partners`);
  res.set('Cache-Control', 'public, max-age=300').json(s);
});

router.get('/tontines', async (req, res) => { res.json(await publicTontines(req.query)); });
router.get('/tontines/:id', async (req, res) => { res.json(await tontinePreview(req.params.id)); });

router.get('/goods', async (req, res) => {
  const q = z.object({ category: z.string().max(30).optional(), search: z.string().max(60).optional() }).parse(req.query);
  res.json(await many(pool,
    `SELECT g.id, g.name, g.description, g.category, g.price, g.image, g.stock, ${BRANDING_SQL} AS partner
     FROM goods g JOIN partners p ON p.id = g.partner_id
     WHERE g.active AND p.status = 'active' AND ($1::text IS NULL OR g.category = $1)
       AND ($2::text IS NULL OR g.name ILIKE '%' || $2 || '%') ORDER BY g.price LIMIT 100`, [q.category ?? null, q.search ?? null]));
});

router.get('/partners', async (_req, res) => {
  res.json(await many(pool,
    `SELECT p.id, p.name, p.type, p.logo, p.primary_color, p.city, p.description,
            (SELECT count(*)::int FROM tontines t WHERE t.partner_id = p.id AND t.visibility = 'public' AND t.status = 'recruiting') AS open_tontines,
            (SELECT count(*)::int FROM goods g WHERE g.partner_id = p.id AND g.active) AS goods
     FROM partners p WHERE p.status = 'active' ORDER BY p.created_at`));
});

router.get('/partners/:id', async (req, res) => { res.json(await partnerShowcase(req.params.id)); });

const leadLimit = rateLimit({ name: 'leads', windowMs: 60 * 60 * 1000, max: 5, enabled: config.env !== 'test' });

/** Formulaire « Devenir partenaire / SFD » ou contact : traité par l'équipe dans le back-office. */
router.post('/leads', leadLimit, async (req, res) => {
  const body = z.object({
    kind: z.enum(['partenaire', 'sfd', 'contact']),
    name: z.string().trim().min(2).max(80),
    organization: z.string().trim().max(120).optional(),
    partnerType: z.enum(['association', 'commercant', 'entreprise', 'tontinier', 'sfd', 'autre']).optional(),
    phone: z.string().trim().regex(/^\+?\d[\d ]{7,18}$/, 'Numéro de téléphone invalide'),
    email: z.email().optional(),
    city: z.string().trim().max(60).optional(),
    members: z.number().int().min(0).max(1_000_000).optional(),
    message: z.string().trim().max(1000).optional(),
    website: z.string().max(0, 'Champ réservé').optional(), // pot de miel anti-robots : doit rester vide
  }).parse(req.body);
  const lead = await one(pool,
    `INSERT INTO leads (kind, name, organization, partner_type, phone, email, city, members, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
    [body.kind, body.name, body.organization ?? null, body.partnerType ?? null, body.phone, body.email ?? null,
      body.city ?? null, body.members ?? null, body.message ?? null]);
  res.status(201).json({ ok: true, id: lead.id });
});
