// Données de démonstration : un administrateur, des clients et un peu d'activité.
import { pool, withTx, one } from './db.js';
import { migrate } from './migrate.js';
import { referralCode } from './lib/crypto.js';
import { createAccount, post, systemAccount, walletOf } from './services/ledger.js';
import { createApp } from './app.js';
import type { AddressInfo } from 'node:net';

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

const admin = await user('+22670000000', 'Admin Smart Tontine', 'admin');
const clovis = await user('+22670000001', 'Aminata Ouédraogo', 'customer', 'facebook');
const awa = await user('+22670000002', 'Issouf Sawadogo', 'customer', 'parrainage');
await user('+22670000003', 'Salif Compaoré', 'customer', 'organisateur');
await user('+22670000004', 'Awa Kaboré', 'customer', 'sfd_partenaire');
const moussa = await one(pool, "SELECT id FROM users WHERE phone = '+22670000003'");
const fatou = await one(pool, "SELECT id FROM users WHERE phone = '+22670000004'");
const seeded = await one(pool, 'SELECT count(*)::int AS n FROM tontines');
if (seeded.n === 0) {
  await deposit(clovis, 200_000);
  await deposit(awa, 75_000);
  await deposit(moussa.id, 60_000);
  await deposit(fatou.id, 60_000);
  await pool.query("UPDATE users SET kyc_level = 1 WHERE phone IN ('+22670000001', '+22670000002')");
  await demoTontine();
}
await pool.query("INSERT INTO support_tickets (user_id, subject, body) VALUES ($1, 'Dépôt Wave non reçu', 'J''ai payé 5 000 F par Wave mais je ne vois rien.')", [awa]);

async function demoTontine() {
  // Parcours réel via l'API (en mémoire) : tontine mensuelle à 4, tour 1 versé, avance pour le 4e membre.
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (path: string, body: unknown, token?: string, method = 'POST') => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(`${path} : ${data.message}`);
    return data;
  };
  const login = async (phone: string) => {
    const { devCode } = await call('/auth/otp/request', { phone });
    const { token } = await call('/auth/otp/verify', { phone, code: devCode });
    await call('/auth/me/pin', { pin: '1234' }, token, 'PUT');
    return token as string;
  };
  const phones = ['+22670000001', '+22670000002', '+22670000003', '+22670000004'];
  const tokens = await Promise.all(phones.map(login));
  const t = await call('/tontines', { name: 'Tontine du marché de Rood Woko', contributionAmount: 15_000, frequency: 'monthly', maxMembers: 4, orderMode: 'fixed',
    description: 'Cotisation le 5 de chaque mois — Ouagadougou' }, tokens[0]);
  for (const tk of tokens.slice(1)) await call(`/tontines/${t.id}/join`, {}, tk);
  const ids = (await one(pool, 'SELECT array_agg(id ORDER BY phone) AS ids FROM users WHERE phone = ANY($1)', [phones])).ids;
  await call(`/tontines/${t.id}/start`, { order: ids }, tokens[0]);
  for (const tk of tokens) await call(`/tontines/${t.id}/rounds/1/contribute`, {}, tk);
  const offers = await call('/credit/offers', null, tokens[3], 'GET');
  const offer = offers.advances[0];
  if (offer?.eligible) await call('/credit/advances', { roundId: offer.roundId, amount: 20_000, pin: '1234' }, tokens[3]);

  // Coffre de groupe d'une association, cotisations mensuelles (une complète, une partielle, une absente).
  const coffre = await call('/cagnottes', { name: 'Association des femmes de Tanghin', category: 'association', visibility: 'public',
    frequency: 'monthly', contributionAmount: 5_000 }, tokens[1]);
  for (const tk of [tokens[0], tokens[2]]) await call(`/cagnottes/${coffre.id}/join`, {}, tk);
  await call(`/cagnottes/${coffre.id}/contribute`, { amount: 5_000 }, tokens[1]);
  await call(`/cagnottes/${coffre.id}/contribute`, { amount: 2_500 }, tokens[0]);

  // Partenaire commerçant validé, avec son catalogue et une tontine de moto publique.
  const vendeur = await call('/partners', { name: 'Ets Sawadogo Motos', type: 'commercant', city: 'Ouagadougou', primaryColor: '#C0392B',
    description: 'Motos et pièces détachées, Ouagadougou — financement en tontine.' }, tokens[2]);
  await pool.query("UPDATE partners SET status = 'active' WHERE id = $1", [vendeur.id]);
  const moto = await call(`/goods/partners/${vendeur.id}`, { name: 'Moto Sanili 125', category: 'moto', price: 450_000, stock: 10,
    description: 'Garantie 6 mois, immatriculation incluse.' }, tokens[2]);
  await call(`/goods/partners/${vendeur.id}`, { name: 'Réfrigérateur 150 L', category: 'electromenager', price: 180_000, stock: 5 }, tokens[2]);
  await call(`/goods/partners/${vendeur.id}`, { name: 'Téléphone Android 64 Go', category: 'telephone', price: 65_000 }, tokens[2]);
  await call('/tontines', { name: 'Tontine moto des fonctionnaires', kind: 'bien', goodId: moto.id, frequency: 'monthly', maxMembers: 10,
    visibility: 'public', partnerId: vendeur.id, description: 'Une moto par mois pendant 10 mois.' }, tokens[2]);
  // Partenaire association (en attente de validation : visible dans le back-office).
  await call('/partners', { name: 'Association Wend-Panga', type: 'association', city: 'Bobo-Dioulasso', primaryColor: '#1F6F43', managementFeeRate: 0.01 }, tokens[0]);
  server.close();
}

console.log('Données de démo créées. Admin :', admin, '(+22670000000 — connexion par OTP)');
await pool.end();
