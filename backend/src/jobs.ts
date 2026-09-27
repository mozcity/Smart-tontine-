import { many, one, pool, withTx } from './db.js';
import { closeEcaisse } from './modules/ecaisse.js';
import { chargePlus } from './modules/account.js';
import { notify } from './services/notify.js';
import { pricing } from './pricing.js';
import { closeOverdueRounds } from './modules/tontine.js';
import { collectDueInstallments } from './modules/credit.js';

/** Tâches périodiques (toutes les heures). En production : un worker dédié ou un cron. */
export async function runJobs() {
  const results = { ecaissesReleased: 0, plansRenewed: 0, plansExpired: 0, challengesExpired: 0, tontineRoundsClosed: 0,
    credit: { autoDebited: 0, penalized: 0, defaulted: 0 } };

  // Tontines : tours échus au-delà du délai de grâce → cautions mobilisées et pot versé.
  results.tontineRoundsClosed = await closeOverdueRounds();
  // Microcrédit : prélèvements automatiques, pénalités, passage en défaut.
  results.credit = await collectDueInstallments();

  // E-caisses arrivées à échéance : l'argent revient automatiquement, « sans y penser ».
  for (const { id } of await many(pool, "SELECT id FROM ecaisses WHERE status = 'locked' AND unlock_at <= now()")) {
    await withTx(async (client) => {
      const e = await one(client, "SELECT * FROM ecaisses WHERE id = $1 AND status = 'locked' FOR UPDATE", [id]);
      if (!e) return;
      await closeEcaisse(client, e, 'released', 0);
      await notify(client, e.user_id, 'E-caisse débloquée 🔓', `Ton épargne « ${e.name} » est de retour sur ton portefeuille`);
      results.ecaissesReleased++;
    });
  }

  // Renouvellement SMARTFIN+ (ou retour au plan gratuit si solde insuffisant / résiliation).
  for (const { id } of await many(pool, "SELECT id FROM users WHERE plan = 'plus' AND (plan_renews_at IS NULL OR plan_renews_at <= now())")) {
    await withTx(async (client) => {
      const u = await one(client, 'SELECT u.plan_renews_at, a.balance FROM users u JOIN accounts a ON a.owner_id = u.id AND a.kind = \'wallet\' WHERE u.id = $1 FOR UPDATE OF u', [id]);
      if (u.plan_renews_at && u.balance >= pricing.plus.monthlyPrice) {
        await chargePlus(client, id);
        results.plansRenewed++;
      } else {
        await client.query("UPDATE users SET plan = 'free', plan_renews_at = NULL WHERE id = $1", [id]);
        await notify(client, id, 'SMARTFIN+ expiré', 'Recharge ton portefeuille pour réactiver tes avantages');
        results.plansExpired++;
      }
    });
  }

  // Challenges arrivés à terme sans atteindre l'objectif : l'épargne reste disponible au retrait.
  const expired = await pool.query(
    "UPDATE challenge_participations SET status = 'abandoned' WHERE status = 'active' AND ends_at <= now() RETURNING user_id");
  for (const r of expired.rows) await notify(pool, r.user_id, 'Challenge terminé', 'Récupère ton épargne et relance un nouveau défi !');
  results.challengesExpired = expired.rowCount ?? 0;

  return results;
}
