import request from 'supertest';
import { pool } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { createApp } from '../src/app.js';
import { hmac } from '../src/lib/crypto.js';

export const app = createApp();
let n = 0;

export async function signup(name: string, extra: Record<string, unknown> = {}) {
  const phone = `+22507${String(Date.now() % 1e6).padStart(6, '0')}${String(n++).padStart(2, '0')}`;
  const otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
  const res = await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode, fullName: name, ...extra }).expect(200);
  const token = res.body.token as string;
  const auth = (r: request.Test) => r.set('authorization', `Bearer ${token}`);
  await auth(request(app).put('/auth/me/pin')).send({ pin: '1234' }).expect(200);
  const me = await auth(request(app).get('/auth/me')).expect(200);
  return { phone, token, id: me.body.id as string, referralCode: me.body.referral_code as string, auth };
}

export async function fund(user: Awaited<ReturnType<typeof signup>>, amount: number) {
  const dep = await user.auth(request(app).post('/wallet/deposits')).send({ amount, channel: 'wave' }).expect(201);
  const body = JSON.stringify({ reference: dep.body.reference, status: 'success' });
  await request(app).post('/webhooks/payments').set('content-type', 'application/json')
    .set('x-smartfin-signature', hmac('test-webhook', body)).send(body).expect(200);
  return dep.body.reference as string;
}

export const balance = async (u: Awaited<ReturnType<typeof signup>>) => (await u.auth(request(app).get('/wallet')).expect(200)).body.balance as number;

export async function ledgerBalanced() {
  const { rows } = await pool.query('SELECT sum(balance)::bigint AS s FROM accounts');
  const mism = await pool.query(
    `SELECT a.id FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id GROUP BY a.id HAVING a.balance <> COALESCE(sum(e.amount), 0)`);
  return rows[0].s === 0 && mism.rowCount === 0;
}

export type User = Awaited<ReturnType<typeof signup>>;

export async function resetDb() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
}
