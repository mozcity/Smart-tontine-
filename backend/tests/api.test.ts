import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { hmac } from '../src/lib/crypto.js';
import { runJobs } from '../src/jobs.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

describe('authentification', () => {
  it('rejette un mauvais code OTP', async () => {
    const phone = '+2250799999999';
    await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const res = await request(app).post('/auth/otp/verify').send({ phone, code: '000000' });
    expect(res.status).toBe(400);
  });
  it('refuse un numéro hors UEMOA', async () => {
    await request(app).post('/auth/otp/request').send({ phone: '+33612345678' }).expect(400);
  });
  it('protège les routes', async () => {
    await request(app).get('/wallet').expect(401);
  });
});

describe('portefeuille', () => {
  it('crédite un dépôt une seule fois (webhook idempotent) et refuse une signature invalide', async () => {
    const u = await signup('Clovis');
    const ref = await fund(u, 10_000);
    expect(await balance(u)).toBe(10_000);
    const body = JSON.stringify({ reference: ref, status: 'success' });
    const again = await request(app).post('/webhooks/payments').set('content-type', 'application/json')
      .set('x-smarttontine-signature', hmac('test-webhook', body)).send(body).expect(200);
    expect(again.body.alreadyProcessed).toBe(true);
    expect(await balance(u)).toBe(10_000);
    await request(app).post('/webhooks/payments').set('x-smarttontine-signature', 'faux').send({ reference: ref, status: 'success' }).expect(401);
  });

  it('prélève 1 % (min 100 F) sur les retraits et exige le PIN', async () => {
    const u = await signup('Awa');
    await fund(u, 50_000);
    await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 20_000, channel: 'orange_money', pin: '9999' }).expect(400);
    const w = await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 20_000, channel: 'orange_money', pin: '1234' }).expect(201);
    expect(w.body.fee).toBe(200);
    expect(await balance(u)).toBe(29_800);
    const tooMuch = await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 29_700, channel: 'wave', pin: '1234' });
    expect(tooMuch.status).toBe(409);
  });

  it('transfère gratuitement entre utilisateurs', async () => {
    const a = await signup('Ali');
    const b = await signup('Bintou');
    await fund(a, 5_000);
    await a.auth(request(app).post('/wallet/transfers')).send({ toPhone: b.phone, amount: 3_000, pin: '1234' }).expect(201);
    expect(await balance(a)).toBe(2_000);
    expect(await balance(b)).toBe(3_000);
  });

  it('verse le bonus de parrainage au premier dépôt ≥ 5 000 F', async () => {
    const parrain = await signup('Parrain');
    const filleul = await signup('Filleul', { referralCode: parrain.referralCode });
    await fund(filleul, 5_000);
    await fund(filleul, 5_000);
    expect(await balance(parrain)).toBe(500);
  });

  it('respecte le plafond KYC niveau 0', async () => {
    const u = await signup('Plafond');
    const res = await u.auth(request(app).post('/wallet/deposits')).send({ amount: 250_000, channel: 'wave' });
    expect(res.body.error).toBe('kyc_limit');
  });
});

describe('e-caisse', () => {
  it('bloque l\'argent et applique 2 % de pénalité en cas de rupture', async () => {
    const u = await signup('Epargnant');
    await fund(u, 100_000);
    const unlockAt = new Date(Date.now() + 90 * 86400_000).toISOString();
    const e = await u.auth(request(app).post('/ecaisses')).send({ name: 'Rentrée', amount: 60_000, unlockAt }).expect(201);
    expect(await balance(u)).toBe(40_000);
    await u.auth(request(app).post(`/ecaisses/${e.body.id}/release`)).expect(409);
    const br = await u.auth(request(app).post(`/ecaisses/${e.body.id}/break`)).send({ pin: '1234' }).expect(200);
    expect(br.body.penalty).toBe(1_200);
    expect(await balance(u)).toBe(98_800);
  });

  it('débloque automatiquement à l\'échéance (job)', async () => {
    const u = await signup('Auto');
    await fund(u, 10_000);
    const unlockAt = new Date(Date.now() + 2 * 86400_000).toISOString();
    const e = await u.auth(request(app).post('/ecaisses')).send({ name: 'Test', amount: 10_000, unlockAt }).expect(201);
    await pool.query("UPDATE ecaisses SET unlock_at = now() - interval '1 minute' WHERE id = $1", [e.body.id]);
    const jobs = await runJobs();
    expect(jobs.ecaissesReleased).toBeGreaterThanOrEqual(1);
    expect(await balance(u)).toBe(10_000);
  });
});

describe('cagnotte+', () => {
  it('exige la double validation avant tout retrait', async () => {
    const admin1 = await signup('Admin 1');
    const admin2 = await signup('Admin 2');
    const membre = await signup('Membre');
    for (const u of [admin1, admin2, membre]) await fund(u, 20_000);

    const c = await admin1.auth(request(app).post('/cagnottes')).send({ name: 'Tontine du quartier', frequency: 'monthly' }).expect(201);
    const id = c.body.id;
    await admin1.auth(request(app).post(`/cagnottes/${id}/members`)).send({ phone: admin2.phone, role: 'admin' }).expect(201);
    await admin1.auth(request(app).post(`/cagnottes/${id}/members`)).send({ phone: membre.phone }).expect(201);
    await membre.auth(request(app).post(`/cagnottes/${id}/members`)).send({ phone: admin1.phone }).expect(403);
    for (const u of [admin1, admin2, membre]) {
      await u.auth(request(app).post(`/cagnottes/${id}/contribute`)).send({ amount: 10_000 }).expect(201);
    }

    const w = await admin1.auth(request(app).post(`/cagnottes/${id}/withdrawals`))
      .send({ amount: 30_000, beneficiaryPhone: membre.phone, reason: 'Tour de Membre' }).expect(201);
    expect(w.body.status).toBe('pending');
    await admin1.auth(request(app).post(`/cagnottes/withdrawals/${w.body.id}/decision`)).send({ decision: 'approve' }).expect(409);
    await membre.auth(request(app).post(`/cagnottes/withdrawals/${w.body.id}/decision`)).send({ decision: 'approve' }).expect(403);
    const ok = await admin2.auth(request(app).post(`/cagnottes/withdrawals/${w.body.id}/decision`)).send({ decision: 'approve' }).expect(200);
    expect(ok.body).toMatchObject({ status: 'executed', fee: 300 });
    expect(await balance(membre)).toBe(10_000 + 29_700);

    const detail = await membre.auth(request(app).get(`/cagnottes/${id}`)).expect(200);
    expect(detail.body.balance).toBe(0);
    expect(detail.body.members.every((m: any) => m.contributed === 10_000)).toBe(true);
  });
});

describe('budget, projets, challenges, contrats', () => {
  it('calcule le budget du mois avec alertes', async () => {
    const u = await signup('Budget');
    const month = new Date().toISOString().slice(0, 7);
    await u.auth(request(app).put(`/budget/plans/${month}`)).send({ items: [{ category: 'Transport', planned: 20_000 }] }).expect(200);
    await u.auth(request(app).post('/budget/entries')).send({ kind: 'income', category: 'Salaire', amount: 150_000 }).expect(201);
    await u.auth(request(app).post('/budget/entries')).send({ kind: 'expense', category: 'Transport', amount: 17_000 }).expect(201);
    const s = await u.auth(request(app).get('/budget/summary')).expect(200);
    expect(s.body.balance).toBe(133_000);
    expect(s.body.categories.find((c: any) => c.category === 'Transport').alert).toBe('attention');
  });

  it('finance un projet et restitue les fonds à la clôture', async () => {
    const u = await signup('Voyageur');
    await fund(u, 60_000);
    const p = await u.auth(request(app).post('/projets')).send({ name: 'Voyage Assinie', category: 'voyage', targetAmount: 50_000, steps: [{ title: 'Transport' }] }).expect(201);
    const c = await u.auth(request(app).post(`/projets/${p.body.id}/contribute`)).send({ amount: 50_000 }).expect(200);
    expect(c.body.progress).toBe(100);
    const close = await u.auth(request(app).post(`/projets/${p.body.id}/close`)).expect(200);
    expect(close.body).toEqual({ status: 'achieved', returned: 50_000 });
    expect(await balance(u)).toBe(60_000);
  });

  it('récompense un challenge réussi', async () => {
    const u = await signup('Challenger');
    await fund(u, 40_000);
    const p = await u.auth(request(app).post('/challenges/30_JOURS_1000/join')).expect(201);
    await u.auth(request(app).post('/challenges/30_JOURS_1000/join')).expect(409);
    const s = await u.auth(request(app).post(`/challenges/participations/${p.body.id}/save`)).send({ amount: 30_000 }).expect(200);
    expect(s.body.status).toBe('completed');
    await u.auth(request(app).post(`/challenges/participations/${p.body.id}/withdraw`)).expect(200);
    expect(await balance(u)).toBe(40_300);
    const me = await u.auth(request(app).get('/auth/me')).expect(200);
    expect(me.body.points).toBe(100);
  });

  it('gère un prêt entre proches signé des deux côtés', async () => {
    const preteur = await signup('Prêteur');
    const emprunteur = await signup('Emprunteur');
    await fund(preteur, 100_000);
    const c = await preteur.auth(request(app).post('/contrats')).send({
      counterpartyPhone: emprunteur.phone, title: 'Prêt commerce', kind: 'pret', myRole: 'creditor', principal: 50_000,
      echeances: [{ dueOn: '2026-11-01', amount: 25_000 }, { dueOn: '2026-12-01', amount: 25_000 }],
    }).expect(201);
    await preteur.auth(request(app).post(`/contrats/${c.body.id}/sign`)).send({ pin: '1234' }).expect(403);
    await emprunteur.auth(request(app).post(`/contrats/${c.body.id}/sign`)).send({ pin: '1234' }).expect(200);
    expect(await balance(emprunteur)).toBe(50_000);
    const detail = await emprunteur.auth(request(app).get(`/contrats/${c.body.id}`)).expect(200);
    for (const e of detail.body.echeances) {
      await emprunteur.auth(request(app).post(`/contrats/${c.body.id}/echeances/${e.id}/pay`)).send({ pin: '1234' }).expect(200);
    }
    const done = await preteur.auth(request(app).get(`/contrats/${c.body.id}`)).expect(200);
    expect(done.body.status).toBe('completed');
    expect(await balance(preteur)).toBe(100_000);
  });
});

describe('Smart Tontine+ et CRM', () => {
  it('abonne un client à Smart Tontine+ avec 3 retraits gratuits par mois', async () => {
    const u = await signup('Premium');
    await fund(u, 20_000);
    await u.auth(request(app).post('/me/plan/subscribe')).expect(200);
    expect(await balance(u)).toBe(19_500);
    const q = await u.auth(request(app).get('/wallet/withdrawals/quote?amount=10000')).expect(200);
    expect(q.body.fee).toBe(0);
  });

  it('donne au back-office les KPI, la vue client 360 et les campagnes', async () => {
    const client = await signup('Client CRM');
    await client.auth(request(app).get('/admin/api/kpis')).expect(403);
    const staff = await signup('Staff');
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [staff.id]);

    const k = await staff.auth(request(app).get('/admin/api/kpis')).expect(200);
    expect(k.body.users.total).toBeGreaterThan(5);
    expect(k.body.revenue.total).toBeGreaterThan(0);
    expect(k.body.daily).toHaveLength(30);

    const list = await staff.auth(request(app).get('/admin/api/customers?segment=nouveau')).expect(200);
    expect(list.body.rows.some((r: any) => r.id === client.id)).toBe(true);
    await staff.auth(request(app).post(`/admin/api/customers/${client.id}/notes`)).send({ body: 'Appelé : intéressé par Cagnotte+' }).expect(201);
    const c360 = await staff.auth(request(app).get(`/admin/api/customers/${client.id}`)).expect(200);
    expect(c360.body.notes).toHaveLength(1);

    const camp = await staff.auth(request(app).post('/admin/api/campaigns'))
      .send({ name: 'Relance J+3', segment: 'nouveau', channel: 'push', title: 'Fais ton 1er dépôt', body: 'Dépose 5 000 F et lance ta première e-caisse !' }).expect(201);
    expect(camp.body.sent_count).toBeGreaterThan(0);

    const check = await staff.auth(request(app).get('/admin/api/ledger/check')).expect(200);
    expect(check.body.balanced).toBe(true);
  });

  it('le grand livre reste équilibré après tous les scénarios', async () => {
    expect(await ledgerBalanced()).toBe(true);
  });
});
