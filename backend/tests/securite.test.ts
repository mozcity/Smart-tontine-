import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db.js';
import { csvCell } from '../src/lib/csv.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

// Test d'intrusion interne (Lot 4) : contrôle d'accès, jetons, injections, en-têtes.
// Chaque cas reproduit une attaque ; il doit échouer sans effet de bord.

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('jetons de session', () => {
  it('refuse jeton absent, falsifié, « alg: none », mauvaise clé, expiré ; le rôle vient de la base', async () => {
    const m = await signup('Jetons');
    await request(app).get('/wallet').expect(401);
    const [h, p] = m.token.split('.');
    await request(app).get('/wallet').set(bearer(`${h}.${p}.signaturebidon`)).expect(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`;
    await request(app).get('/wallet').set(bearer(none)).expect(401);
    await request(app).get('/wallet').set(bearer(jwt.sign({ sub: m.id, role: 'customer' }, 'autre-secret'))).expect(401);
    await request(app).get('/wallet').set(bearer(jwt.sign({ sub: m.id, role: 'customer', exp: 1 }, 'test-secret'))).expect(401);
    // Jeton valide qui se dit « admin » : le rôle est relu en base, l'accès reste refusé.
    const forged = jwt.sign({ sub: m.id, role: 'admin', mfa: true }, 'test-secret');
    await request(app).get('/admin/api/kpis').set(bearer(forged)).expect(403);
  });

  it('compte suspendu : refusé immédiatement ; « déconnecter tous mes appareils » révoque les anciens jetons', async () => {
    const m = await signup('Révocation');
    const r = await m.auth(request(app).post('/auth/logout-all')).expect(200);
    await m.auth(request(app).get('/wallet')).expect(401); // ancien jeton
    await request(app).get('/wallet').set(bearer(r.body.token)).expect(200); // jeton rendu à cet appareil

    await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [m.id]);
    await request(app).get('/wallet').set(bearer(r.body.token)).expect(401);
  });

  it('pas d’affectation de masse : un membre ne peut pas se donner un rôle ou un niveau KYC', async () => {
    const m = await signup('Affectation');
    await m.auth(request(app).patch('/auth/me')).send({ fullName: 'Nouveau nom', role: 'admin', kyc_level: 2, kycLevel: 2, status: 'active' }).expect(200);
    const u = await pool.query('SELECT full_name, role, kyc_level FROM users WHERE id = $1', [m.id]);
    expect(u.rows[0]).toEqual({ full_name: 'Nouveau nom', role: 'customer', kyc_level: 0 });
  });
});

describe('contrôle d’accès entre membres (IDOR)', () => {
  let a: User, b: User;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    a = await signup('Victime');
    b = await signup('Attaquant');
    await fund(a, 200_000);
    await fund(b, 10_000);
    ids.tontine = (await a.auth(request(app).post('/tontines')).send({ name: 'Privée', contributionAmount: 5_000, frequency: 'weekly', maxMembers: 5 }).expect(201)).body.id;
    ids.cagnotte = (await a.auth(request(app).post('/cagnottes')).send({ name: 'Famille', category: 'famille' }).expect(201)).body.id;
    await a.auth(request(app).post(`/cagnottes/${ids.cagnotte}/contribute`)).send({ amount: 20_000, pin: '1234' }).expect(201);
    const unlockAt = new Date(Date.now() + 90 * 86400_000).toISOString();
    ids.ecaisse = (await a.auth(request(app).post('/ecaisses')).send({ name: 'Rentrée', amount: 30_000, unlockAt }).expect(201)).body.id;
    ids.projet = (await a.auth(request(app).post('/projets')).send({ name: 'Voyage', category: 'voyage', targetAmount: 50_000, steps: [{ title: 'Billets' }] }).expect(201)).body.id;
    ids.budget = (await a.auth(request(app).post('/budget/entries')).send({ kind: 'expense', category: 'Transport', amount: 1_000 }).expect(201)).body.id;
    ids.ticket = (await a.auth(request(app).post('/me/support/tickets')).send({ subject: 'Aide', body: 'Question privée' }).expect(201)).body.id;
    ids.partner = (await a.auth(request(app).post('/partners')).send({ name: 'Association A', type: 'association' }).expect(201)).body.id;
    await pool.query("UPDATE partners SET status = 'active' WHERE id = $1", [ids.partner]);
    ids.deposit = (await a.auth(request(app).post('/wallet/deposits')).send({ amount: 1_000, channel: 'wave' }).expect(201)).body.reference;
  });

  it('chaque ressource de la victime est invisible et inaltérable pour un autre membre', async () => {
    const before = { a: await balance(a), b: await balance(b) };
    const attempts: [string, string, object?][] = [
      ['get', `/tontines/${ids.tontine}`],
      ['post', `/tontines/${ids.tontine}/start`, {}],
      ['post', `/tontines/${ids.tontine}/rounds/1/close`, {}],
      ['get', `/cagnottes/${ids.cagnotte}`],
      ['get', `/cagnottes/${ids.cagnotte}/cotisations`],
      ['get', `/cagnottes/${ids.cagnotte}/cotisations.csv`],
      ['post', `/cagnottes/${ids.cagnotte}/join`, {}],
      ['post', `/cagnottes/${ids.cagnotte}/members`, { phone: b.phone }],
      ['post', `/cagnottes/${ids.cagnotte}/withdrawals`, { amount: 20_000, reason: 'vol', pin: '1234' }],
      ['post', `/ecaisses/${ids.ecaisse}/break`, { pin: '1234' }],
      ['post', `/ecaisses/${ids.ecaisse}/release`, {}],
      ['post', `/projets/${ids.projet}/close`, {}],
      ['delete', `/budget/entries/${ids.budget}`],
      ['post', `/me/support/tickets/${ids.ticket}/messages`, { body: 'intrusion' }],
      ['get', `/partners/${ids.partner}/dashboard`],
      ['get', `/partners/${ids.partner}/statement`],
      ['get', `/partners/${ids.partner}/members`],
      ['patch', `/partners/${ids.partner}`, { name: 'Piraté' }],
      ['post', `/partners/${ids.partner}/staff`, { phone: b.phone, role: 'owner' }],
      ['post', `/partners/${ids.partner}/withdraw`, { amount: 1_000, pin: '1234' }],
      ['post', `/goods/partners/${ids.partner}`, { name: 'Faux bien', price: 1_000 }],
      ['post', `/wallet/deposits/${ids.deposit}/simulate`, {}],
    ];
    for (const [method, path, body] of attempts) {
      const r = await (b.auth((request(app) as any)[method](path)) as request.Test).send(body ?? {});
      expect([403, 404], `${method.toUpperCase()} ${path} → ${r.status} ${JSON.stringify(r.body)}`).toContain(r.status);
    }
    // Aucun effet de bord : soldes, membres, staff et ressources intacts.
    expect(await balance(a)).toBe(before.a);
    expect(await balance(b)).toBe(before.b);
    const leaks = await pool.query(
      `SELECT (SELECT count(*) FROM cagnotte_members WHERE user_id = $1)::int AS cm,
              (SELECT count(*) FROM partner_staff WHERE user_id = $1)::int AS ps,
              (SELECT count(*) FROM budget_entries WHERE id = $2)::int AS be,
              (SELECT name FROM partners WHERE id = $3) AS partner`, [b.id, ids.budget, ids.partner]);
    expect(leaks.rows[0]).toEqual({ cm: 0, ps: 0, be: 1, partner: 'Association A' });
    expect(await ledgerBalanced()).toBe(true);
  });

  it('un membre simple n’atteint aucune route du back-office', async () => {
    for (const path of ['/admin/api/kpis', '/admin/api/customers', '/admin/api/kyc', '/admin/api/withdrawals/to-reconcile']) {
      await b.auth(request(app).get(path)).expect(403);
    }
    await b.auth(request(app).post(`/admin/api/staff/${b.id}/mfa/reset`)).expect(403);
  });
});

describe('entrées hostiles', () => {
  it('identifiants mal formés et injections SQL : 404 ou 400, jamais d’erreur interne', async () => {
    const m = await signup('Sonde');
    const probes = ["x", "1'%20OR%20'1'='1", "00000000-0000-0000-0000-000000000000';DROP%20TABLE%20users;--", '%27%3B--', '..%2F..%2Fetc%2Fpasswd'];
    for (const p of probes) {
      for (const path of [`/tontines/${p}`, `/cagnottes/${p}`, `/contrats/${p}`, `/partners/${p}/public`, `/public/tontines/${p}`]) {
        const r = await m.auth(request(app).get(path));
        expect([400, 404], `${path} → ${r.status}`).toContain(r.status);
      }
    }
    const r = await m.auth(request(app).get("/wallet/history?limit=1;DROP TABLE users")).expect(400);
    expect(r.body.error).toBe('validation');
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBeGreaterThan(0);
  });

  it('montants falsifiés refusés : négatif, décimal, texte, énorme', async () => {
    const m = await signup('Montants');
    await fund(m, 10_000);
    for (const amount of [-5_000, 0, 10.5, '1000', 1e12, null]) {
      await m.auth(request(app).post('/wallet/deposits')).send({ amount, channel: 'wave' }).expect(400);
      await m.auth(request(app).post('/wallet/withdrawals')).send({ amount, channel: 'wave', pin: '1234' }).expect(400);
      await m.auth(request(app).post('/wallet/transfers')).send({ amount, toPhone: '+22670000000', pin: '1234' }).expect(400);
    }
    expect(await balance(m)).toBe(10_000);
  });

  it('retrait vers le numéro d’un tiers : identité vérifiée exigée', async () => {
    const m = await signup('Tiers');
    await fund(m, 20_000);
    const r = await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 5_000, channel: 'wave', phone: '+22670111222', pin: '1234' }).expect(403);
    expect(r.body.error).toBe('kyc_required');
    await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 5_000, channel: 'wave', pin: '1234' }).expect(201);
    await pool.query('UPDATE users SET kyc_level = 1 WHERE id = $1', [m.id]);
    await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 5_000, channel: 'wave', phone: '+22670111222', pin: '1234' }).expect(201);
  });

  it('export CSV : les formules sont neutralisées', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33 rue')).toBe(`"'+33 rue"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell(-5000)).toBe('"-5000"');
    expect(csvCell('Tontine du marché')).toBe('"Tontine du marché"');
  });

  it('webhook de paiement non signé ou mal signé : refusé', async () => {
    const body = JSON.stringify({ reference: 'DEP-X', status: 'success' });
    await request(app).post('/webhooks/payments').set('content-type', 'application/json').send(body).expect(401);
    await request(app).post('/webhooks/payments').set('content-type', 'application/json').set('x-smarttontine-signature', 'deadbeef').send(body).expect(401);
  });
});

describe('en-têtes HTTP', () => {
  it('CSP stricte, HSTS, nosniff, anti-iframe ; pas de bannière serveur', async () => {
    const r = await request(app).get('/health').expect(200);
    expect(r.headers['content-security-policy']).toContain("script-src 'self'");
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(r.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
    const admin = await request(app).get('/admin/').expect(200);
    expect(admin.text).not.toMatch(/<script>(?!<\/script>)/); // aucun script en ligne
  });
});

describe('suppression du compte', () => {
  it('refusée tant qu’il reste de l’argent ; ensuite anonymise, révoque les sessions et libère le numéro', async () => {
    const m = await signup('À supprimer');
    await fund(m, 5_000);
    const blocked = await m.auth(request(app).get('/me/deletion')).expect(200);
    expect(blocked.body.possible).toBe(false);
    await m.auth(request(app).post('/me/deletion')).send({ pin: '1234' }).expect(409);

    // Retrait de tout le solde (4 900 F + 100 F de frais) : le compte est vide.
    await m.auth(request(app).post('/wallet/withdrawals')).send({ amount: 4_900, channel: 'wave', pin: '1234' }).expect(201);
    expect(await balance(m)).toBe(0);
    expect((await m.auth(request(app).get('/me/deletion')).expect(200)).body).toEqual({ possible: true, blockers: [] });
    const wrong = await m.auth(request(app).post('/me/deletion')).send({ pin: '0000' });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    await m.auth(request(app).post('/me/deletion')).send({ pin: '1234' }).expect(200);

    await m.auth(request(app).get('/wallet')).expect(401);
    const u = await pool.query('SELECT status, full_name, email, pin_hash, phone FROM users WHERE id = $1', [m.id]);
    expect(u.rows[0]).toMatchObject({ status: 'closed', full_name: 'Compte supprimé', email: null, pin_hash: null });
    expect(u.rows[0].phone).toMatch(/^closed:/);
    // Les opérations financières restent (LBC/FT).
    expect((await pool.query('SELECT count(*)::int AS n FROM transactions WHERE initiator_id = $1', [m.id])).rows[0].n).toBeGreaterThan(0);
    // Le numéro peut ouvrir un nouveau compte, distinct.
    const otp = await request(app).post('/auth/otp/request').send({ phone: m.phone }).expect(200);
    const again = await request(app).post('/auth/otp/verify').send({ phone: m.phone, code: otp.body.devCode, fullName: 'Nouveau départ' }).expect(200);
    const me = await request(app).get('/auth/me').set(bearer(again.body.token)).expect(200);
    expect(me.body.id).not.toBe(m.id);
    expect(await ledgerBalanced()).toBe(true);
  });
});
