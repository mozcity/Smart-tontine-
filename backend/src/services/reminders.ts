import { many, pool } from '../db.js';
import { notify } from './notify.js';
import { sms } from './sms.js';

/** Envoie un rappel une seule fois par clé (notification in-app + SMS). */
async function remind(key: string, userId: string, phone: string, title: string, body: string): Promise<boolean> {
  const inserted = await pool.query('INSERT INTO reminders_sent (key, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [key, userId]);
  if (!inserted.rowCount) return false;
  await notify(pool, userId, title, body);
  await sms.send(phone, `SMARTFIN : ${body}`);
  return true;
}

/**
 * Rappels automatiques la veille (J-1) et le jour (J0) de chaque échéance :
 * cotisations de tontine non payées et échéances de crédit.
 */
export async function sendReminders() {
  let sent = 0;
  const contributions = await many(pool,
    `SELECT r.id AS round_id, r.number, r.due_date, (r.due_date = CURRENT_DATE) AS today,
            t.name, t.contribution_amount, u.id AS user_id, u.phone
     FROM tontine_rounds r JOIN tontines t ON t.id = r.tontine_id
     JOIN tontine_members m ON m.tontine_id = t.id JOIN users u ON u.id = m.user_id
     WHERE t.status = 'active' AND r.status = 'open' AND r.due_date IN (CURRENT_DATE, CURRENT_DATE + 1)
       AND NOT EXISTS (SELECT 1 FROM tontine_contributions c WHERE c.round_id = r.id AND c.user_id = m.user_id)`);
  for (const c of contributions) {
    const when = c.today ? "aujourd'hui" : 'demain';
    if (await remind(`tontine:${c.round_id}:${c.user_id}:${c.today ? 'J0' : 'J-1'}`, c.user_id, c.phone, 'Rappel de cotisation',
      `ta cotisation de ${c.contribution_amount} F pour « ${c.name} » (tour ${c.number}) est due ${when}.`)) sent++;
  }
  const installments = await many(pool,
    `SELECT i.id, i.number, i.principal + i.interest + i.penalty AS amount, (i.due_date = CURRENT_DATE) AS today, l.purpose, u.id AS user_id, u.phone
     FROM loan_installments i JOIN loans l ON l.id = i.loan_id JOIN users u ON u.id = l.user_id
     WHERE l.status = 'active' AND l.product = 'microcredit' AND i.paid_at IS NULL AND i.due_date IN (CURRENT_DATE, CURRENT_DATE + 1)`);
  for (const i of installments) {
    const when = i.today ? "aujourd'hui" : 'demain';
    if (await remind(`loan:${i.id}:${i.today ? 'J0' : 'J-1'}`, i.user_id, i.phone, "Rappel d'échéance",
      `ton échéance de crédit de ${i.amount} F est due ${when}. Garde ce montant sur ton jeton : il sera prélevé automatiquement.`)) sent++;
  }
  return sent;
}
