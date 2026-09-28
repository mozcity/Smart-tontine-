import type pg from 'pg';
import { one, type Db } from '../db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';

export type StaffRole = 'owner' | 'manager';

/** Vérifie que l'utilisateur fait partie de l'équipe du partenaire (et, si demandé, qu'il en est propriétaire). */
export async function assertStaff(db: Db, partnerId: string, userId: string, role?: StaffRole) {
  const p = await one(db, 'SELECT * FROM partners WHERE id = $1', [partnerId]);
  if (!p) throw notFound('Partenaire');
  const s = await one(db, 'SELECT role FROM partner_staff WHERE partner_id = $1 AND user_id = $2', [partnerId, userId]);
  if (!s) throw forbidden('Réservé à l\'équipe du partenaire');
  if (role === 'owner' && s.role !== 'owner') throw forbidden('Réservé au propriétaire de l\'espace partenaire');
  return { partner: p, role: s.role as StaffRole };
}

/** Le partenaire doit être validé par Smart Tontine (KYB) pour organiser des groupes et vendre. */
export async function assertActivePartner(db: Db, partnerId: string, userId: string) {
  const { partner, role } = await assertStaff(db, partnerId, userId);
  if (partner.status !== 'active') throw conflict('partner_not_active', 'Espace partenaire en attente de validation par Smart Tontine');
  return { partner, role };
}

/** Informations de marque affichées aux membres (nom, logo, couleur). */
export const BRANDING_SQL = `json_build_object('id', p.id, 'name', p.name, 'logo', p.logo, 'color', p.primary_color, 'type', p.type)`;

export async function staffIds(client: pg.PoolClient | Db, partnerId: string): Promise<string[]> {
  const { rows } = await client.query('SELECT user_id FROM partner_staff WHERE partner_id = $1', [partnerId]);
  return rows.map((r: { user_id: string }) => r.user_id);
}
