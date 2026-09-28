import type pg from 'pg';
import { one, type Db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { pricing } from '../pricing.js';
import { post, systemAccount, walletOf } from './ledger.js';

export async function isPro(db: Db, userId: string): Promise<boolean> {
  const u = await one(db, 'SELECT pro_renews_at > now() AS pro FROM users WHERE id = $1', [userId]);
  return !!u?.pro;
}

/** Tontines et coffres de groupe actuellement gérés par l'utilisateur. */
export async function organizedCount(db: Db, userId: string): Promise<number> {
  const r = await one(db,
    `SELECT (SELECT count(*) FROM tontines WHERE organizer_id = $1 AND status IN ('recruiting', 'active'))
          + (SELECT count(*) FROM cagnottes WHERE created_by = $1 AND status = 'open') AS n`, [userId]);
  return Number(r.n);
}

/** Version gratuite : 2 groupes gérés à la fois. Au-delà, l'abonnement Organisateur Pro est requis. */
export async function assertCanOrganize(db: Db, userId: string) {
  if (await isPro(db, userId)) return;
  if ((await organizedCount(db, userId)) >= pricing.pro.freeOrganizerLimit) {
    throw new HttpError(402, 'pro_required',
      `La version gratuite permet de gérer ${pricing.pro.freeOrganizerLimit} tontines ou coffres à la fois. Passe à Organisateur Pro (${pricing.pro.monthlyPrice} F/mois).`);
  }
}

export async function chargePro(client: pg.PoolClient, userId: string) {
  const wallet = await walletOf(client, userId);
  await post(client, {
    type: 'subscription', amount: pricing.pro.monthlyPrice, initiatorId: userId, description: 'Abonnement Organisateur Pro',
    meta: { plan: 'pro' },
    legs: [
      { accountId: wallet.id, amount: -pricing.pro.monthlyPrice },
      { accountId: await systemAccount(client, 'SYS_FEES'), amount: pricing.pro.monthlyPrice },
    ],
  });
  await client.query(
    `UPDATE users SET pro_auto_renew = true,
       pro_renews_at = GREATEST(COALESCE(pro_renews_at, now()), now()) + interval '30 days' WHERE id = $1`, [userId]);
}
