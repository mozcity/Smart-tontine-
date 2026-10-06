import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { mockProvider } from '../src/services/payments/mock.js';
import { setPaymentProvider } from '../src/services/payments/index.js';
import { cinetpayProvider, paymentMethod } from '../src/services/payments/cinetpay.js';
import { reconcilePendingWithdrawals } from '../src/modules/wallet.js';
import { app, balance, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

/**
 * Faux serveur CinetPay API v1 : mêmes routes et mêmes formats que l'API réelle (SDK officiel).
 * Le test pilote le statut de chaque opération et peut faire expirer le jeton.
 */
const fake = {
  logins: 0,
  token: 'tok-1',
  expireNext: false,
  calls: [] as { method: string; path: string; body: any; auth?: string }[],
  status: new Map<string, string>(),     // merchant_transaction_id → SUCCESS | FAILED | PENDING
  transferCode: new Map<string, number>(), // refus immédiat d'un transfert (2005 solde insuffisant…)
};
let server: Server;
let baseUrl = '';

async function readJson(req: IncomingMessage) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : undefined;
}

beforeAll(async () => {
  await resetDb();
  server = createServer(async (req, res) => {
    const body = await readJson(req);
    const send = (code: number, data: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    fake.calls.push({ method: req.method!, path: req.url!, body, auth: req.headers.authorization });
    if (req.url === '/v1/oauth/login') {
      if (body.api_password !== 'secret') return send(401, { code: 1005, status: 'INVALID_CREDENTIALS', description: 'bad credentials' });
      fake.logins++; fake.token = `tok-${fake.logins}`;
      return send(200, { code: 200, status: 'OK', access_token: fake.token, expires_in: 86400 });
    }
    if (req.headers.authorization !== `Bearer ${fake.token}` || fake.expireNext) {
      fake.expireNext = false;
      return send(401, { code: 1003, status: 'EXPIRED_TOKEN', description: 'token expired' });
    }
    const [, , kind, id] = req.url!.split('/'); // /v1/payment/{id}
    if (req.method === 'POST' && kind === 'payment') {
      fake.status.set(body.merchant_transaction_id, 'PENDING');
      return send(200, {
        code: 200, status: 'OK', payment_token: `pt-${body.merchant_transaction_id}`, notify_token: `nt-${body.merchant_transaction_id}-s3cr3t`,
        transaction_id: `CP-${body.merchant_transaction_id}`, merchant_transaction_id: body.merchant_transaction_id,
        payment_url: `https://checkout.cinetpay.test/${body.merchant_transaction_id}`, details: { status: 'INITIATED', must_be_redirected: true },
      });
    }
    if (req.method === 'POST' && kind === 'transfer') {
      const refused = fake.transferCode.get(body.phone_number);
      if (refused) return send(400, { code: refused, status: 'INSUFFICIENT_BALANCE', description: 'refus' });
      fake.status.set(body.merchant_transaction_id, 'PENDING');
      return send(200, {
        code: 2002, status: 'PENDING', transaction_id: `TR-${body.merchant_transaction_id}`, merchant_transaction_id: body.merchant_transaction_id,
        notify_token: `nt-${body.merchant_transaction_id}-s3cr3t`, amount: String(body.amount), fee_amount: '0',
      });
    }
    if (req.method === 'GET' && (kind === 'payment' || kind === 'transfer')) {
      const st = fake.status.get(decodeURIComponent(id));
      if (!st) return send(404, { code: 404, status: 'NOT_FOUND', description: 'not found' });
      const code = st === 'SUCCESS' ? 100 : st === 'FAILED' ? 2010 : 2002;
      return send(200, { code, status: st, merchant_transaction_id: id, transaction_id: `CP-${id}` });
    }
    send(404, { code: 404, description: 'route inconnue' });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.close(); await pool.end(); });

const use = () => setPaymentProvider(cinetpayProvider({
  credentials: { BF: { apiKey: 'sk_test_bf', apiPassword: 'secret' }, CI: { apiKey: 'sk_test_ci', apiPassword: 'secret' } },
  notifyUrl: 'https://api.smarttontine.test/webhooks/cinetpay',
  successUrl: 'https://smarttontine.test/app/portefeuille?depot=ok',
  failedUrl: 'https://smarttontine.test/app/portefeuille?depot=echec',
  baseUrl,
}));
afterEach(() => setPaymentProvider(mockProvider));

const BF = '+22670112233';
const notifyFor = (ref: string, token = `nt-${ref}-s3cr3t`) =>
  request(app).post('/webhooks/cinetpay').send({ notify_token: token, merchant_transaction_id: ref, transaction_id: `CP-${ref}`, user: {} });

async function deposit(u: User, amount: number, channel = 'orange_money', phone = BF) {
  const r = await u.auth(request(app).post('/wallet/deposits')).send({ amount, channel, phone }).expect(201);
  return r.body as { reference: string; paymentUrl: string };
}

describe('CinetPay API v1', () => {
  it('associe canal et pays au bon moyen de paiement', () => {
    expect(paymentMethod('orange_money', BF)).toBe('OM_BF');
    expect(paymentMethod('wave', '+22507000000')).toBe('WAVE_CI');
    expect(paymentMethod('mtn_momo', BF)).toBeUndefined(); // MTN n'opère pas au Burkina
    expect(paymentMethod('card', BF)).toBeUndefined();
  });

  it('dépôt : jeton OAuth, page de paiement, webhook authentifié par notify_token puis statut vérifié', async () => {
    use();
    const m = await signup('Awa Ouédraogo');
    const dep = await deposit(m, 25_000);
    expect(dep.paymentUrl).toContain('checkout.cinetpay.test');

    const init = fake.calls.find((c) => c.path === '/v1/payment')!;
    expect(init.body).toMatchObject({
      currency: 'XOF', amount: 25_000, merchant_transaction_id: dep.reference, payment_method: 'OM_BF', channel: 'PUSH',
      client_phone_number: BF, client_first_name: 'Awa', client_last_name: 'Ouédraogo', lang: 'fr',
    });
    expect(dep.reference.length).toBeLessThanOrEqual(30);
    // Le jeton de notification n'est jamais renvoyé au client.
    expect(JSON.stringify(dep)).not.toContain('s3cr3t');

    // Notification forgée (mauvais jeton, ou référence inconnue) : refusée, rien n'est crédité.
    await notifyFor(dep.reference, 'nt-devine').expect(401);
    await notifyFor('DEP-INCONNU', 'nt-DEP-INCONNU-s3cr3t').expect(401);
    // Bon jeton mais paiement encore en cours chez CinetPay : on attend.
    expect((await notifyFor(dep.reference).expect(200)).body.status).toBe('pending');
    expect(await balance(m)).toBe(0);
    // Paiement confirmé : crédité une seule fois, même si la notification est rejouée.
    fake.status.set(dep.reference, 'SUCCESS');
    expect((await notifyFor(dep.reference).expect(200)).body.status).toBe('completed');
    await notifyFor(dep.reference).expect(200);
    expect(await balance(m)).toBe(25_000);

    // Paiement refusé : dépôt en échec, rien n'est crédité.
    const ko = await deposit(m, 5_000, 'wave');
    fake.status.set(ko.reference, 'FAILED');
    expect((await notifyFor(ko.reference).expect(200)).body.status).toBe('failed');
    expect(await balance(m)).toBe(25_000);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('renouvelle le jeton expiré (1003) une seule fois et réutilise le jeton en cache', async () => {
    use();
    const m = await signup('Jeton');
    const before = fake.logins;
    await deposit(m, 1_000);
    await deposit(m, 1_000);
    expect(fake.logins - before).toBe(1); // le second dépôt réutilise le jeton
    fake.expireNext = true;
    await deposit(m, 1_000);
    expect(fake.logins - before).toBe(2);
  });

  it('refuse avant tout débit un opérateur absent du pays ou un montant au-delà du plafond agrégateur', async () => {
    use();
    const m = await signup('Contrôles');
    await pool.query('UPDATE users SET kyc_level = 1 WHERE id = $1', [m.id]); // retrait vers un numéro burkinabè distinct
    await m.auth(request(app).post('/wallet/deposits')).send({ amount: 1_000, channel: 'mtn_momo', phone: BF }).expect(400);
    await m.auth(request(app).post('/wallet/deposits')).send({ amount: 1_000, channel: 'wave', phone: '+33612345678' }).expect(400);
    await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1_000, channel: 'card', pin: '4826' }).expect(400);
    const big = await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1_600_000, channel: 'wave', phone: BF, pin: '4826' }).expect(400);
    expect(big.body.error).toBe('provider_limit');
    const pending = await pool.query("SELECT count(*)::int AS n FROM transactions WHERE initiator_id = $1 AND type = 'withdrawal'", [m.id]);
    expect(pending.rows[0].n).toBe(0);
  });

  it('retrait asynchrone : en cours, puis confirmé par webhook ; ou annulé et recrédité par le rattrapage', async () => {
    use();
    const m = await signup('Retraits réels');
    await pool.query('UPDATE users SET kyc_level = 1 WHERE id = $1', [m.id]);
    const dep = await deposit(m, 50_000);
    fake.status.set(dep.reference, 'SUCCESS');
    await notifyFor(dep.reference).expect(200);
    expect(await balance(m)).toBe(50_000);

    // 1. Transfert accepté (PENDING) : portefeuille débité, retrait « en cours ».
    const w1 = await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 10_000, channel: 'orange_money', phone: BF, pin: '4826' }).expect(202);
    expect(w1.body.status).toBe('processing');
    const transfer = fake.calls.filter((c) => c.path === '/v1/transfer').at(-1)!;
    expect(transfer.body).toMatchObject({ amount: 10_000, payment_method: 'OM_BF', phone_number: BF, currency: 'XOF' });
    const afterW1 = await balance(m);
    expect(afterW1).toBeLessThan(40_001);
    fake.status.set(w1.body.reference, 'SUCCESS');
    expect((await notifyFor(w1.body.reference).expect(200)).body.status).toBe('completed');
    const t1 = await pool.query('SELECT status, meta FROM transactions WHERE reference = $1', [w1.body.reference]);
    expect(t1.rows[0]).toMatchObject({ status: 'completed', meta: { payout: 'completed' } });
    // Un retrait confirmé ne peut plus être annulé.
    fake.status.set(w1.body.reference, 'FAILED');
    await notifyFor(w1.body.reference).expect(200);
    expect(await balance(m)).toBe(afterW1);

    // 2. Transfert qui échoue plus tard, webhook perdu : le rattrapage annule et recrédite.
    const w2 = await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 5_000, channel: 'wave', phone: BF, pin: '4826' }).expect(202);
    expect(await balance(m)).toBeLessThan(afterW1);
    fake.status.set(w2.body.reference, 'FAILED');
    await pool.query("UPDATE transactions SET created_at = now() - interval '10 minutes' WHERE reference = $1", [w2.body.reference]);
    expect(await reconcilePendingWithdrawals()).toBeGreaterThanOrEqual(1);
    expect(await balance(m)).toBe(afterW1);
    const t2 = await pool.query('SELECT status FROM transactions WHERE reference = $1', [w2.body.reference]);
    expect(t2.rows[0].status).toBe('reversed');

    // 3. Refus immédiat (solde marchand insuffisant) : annulé et recrédité tout de suite.
    fake.transferCode.set('+22670999999', 2005);
    await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 2_000, channel: 'moov_money', phone: '+22670999999', pin: '4826' }).expect(400);
    expect(await balance(m)).toBe(afterW1);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('ne laisse jamais fuiter les identifiants quand l’authentification échoue', async () => {
    setPaymentProvider(cinetpayProvider({
      credentials: { BF: { apiKey: 'sk_test_bf', apiPassword: 'mauvais-mot-de-passe' } },
      notifyUrl: 'https://x.test/w', successUrl: 'https://x.test/s', failedUrl: 'https://x.test/f', baseUrl,
    }));
    const m = await signup('Identifiants');
    const r = await m.auth(request(app).post('/wallet/deposits')).send({ amount: 1_000, channel: 'wave', phone: BF }).expect(502);
    expect(JSON.stringify(r.body)).not.toContain('mauvais-mot-de-passe');
    const tx = await pool.query("SELECT status FROM transactions WHERE initiator_id = $1 AND type = 'deposit'", [m.id]);
    expect(tx.rows[0].status).toBe('failed');
  });
});
