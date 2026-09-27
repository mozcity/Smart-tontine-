// Données de démonstration : un administrateur, des clients et un peu d'activité.
import { pool, withTx, one } from './db.js';
import { migrate } from './migrate.js';
import { referralCode } from './lib/crypto.js';
import { createAccount, post, systemAccount, walletOf } from './services/ledger.js';

await migrate();

async function user(phone: string, name: string, role = 'customer', channel: string | null = null) {
  const existing = await one(pool, 'SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing) return existing.id as string;
  return withTx(async (client) => {
    const u = await one(client,
      'INSERT INTO users (phone, full_name, role, referral_code, acquisition_channel) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [phone, name, role, referralCode(), channel]);
    await createAccount(client, u.id, 'wallet');
    return u.id as string;
  });
}

async function deposit(userId: string, amount: number) {
  await withTx(async (client) => {
    const w = await walletOf(client, userId);
    await post(client, {
      type: 'deposit', amount, initiatorId: userId, provider: 'seed', description: 'Dépôt',
      legs: [{ accountId: await systemAccount(client, 'SYS_FLOAT'), amount: -amount }, { accountId: w.id, amount }],
    });
  });
}

const admin = await user('+2250748553268', 'Admin SMARTFIN', 'admin');
const clovis = await user('+2250700000001', 'Clovis Kouadio', 'customer', 'facebook');
const awa = await user('+2250700000002', 'Awa Traoré', 'customer', 'parrainage');
await user('+2250700000003', 'Moussa Diallo', 'customer', 'tiktok');
await user('+2250700000004', 'Fatou Koné', 'customer', 'ambassadeur');
await deposit(clovis, 200_000);
await deposit(awa, 75_000);
await pool.query("INSERT INTO support_tickets (user_id, subject, body) VALUES ($1, 'Dépôt Wave non reçu', 'J''ai payé 5 000 F par Wave mais je ne vois rien.')", [awa]);

console.log('Données de démo créées. Admin :', admin, '(+2250748553268 — connexion par OTP)');
await pool.end();
