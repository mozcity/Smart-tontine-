import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { runJobs } from '../src/jobs.js';
import { amortize, assertUnderUsury } from '../src/services/credit.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

const sys = async (code: string) => (await pool.query('SELECT balance FROM accounts WHERE code = $1', [code])).rows[0].balance as number;

/** Crée une tontine à ordre fixe dont `members[0]` est l'organisateur, et la démarre. */
async function startTontine(members: User[], contribution: number, frequency: 'weekly' | 'monthly' = 'monthly') {
  const t = await members[0].auth(request(app).post('/tontines'))
    .send({ name: 'Tontine des collègues', contributionAmount: contribution, frequency, maxMembers: members.length, orderMode: 'fixed' }).expect(201);
  for (const m of members.slice(1)) await m.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
  await members[0].auth(request(app).post(`/tontines/${t.body.id}/start`)).send({ order: members.map((m) => m.id) }).expect(200);
  return t.body.id as string;
}

const contribute = (u: User, id: string, round: number) => u.auth(request(app).post(`/tontines/${id}/rounds/${round}/contribute`));

describe('tontine rotative', () => {
  it('fait tourner le pot jusqu\'au dernier membre puis rend les cautions', async () => {
    const [a, b, c] = [await signup('Adjoua'), await signup('Bakary'), await signup('Carine')];
    for (const u of [a, b, c]) await fund(u, 50_000);
    const id = await startTontine([a, b, c], 10_000);
    expect(await balance(a)).toBe(40_000); // caution bloquée

    const preview = await c.auth(request(app).get(`/tontines/${id}/preview`)).expect(200);
    expect(preview.body.pot).toBe(30_000);

    for (const round of [1, 2, 3]) {
      const r1 = await contribute(a, id, round).expect(201);
      expect(r1.body.status).toBe('collecting');
      await contribute(b, id, round).expect(201);
      const last = await contribute(c, id, round).expect(201);
      expect(last.body).toMatchObject({ status: 'paid_out', pot: 30_000, commission: 300, net: 29_700 });
    }
    await contribute(a, id, 3).expect(409);

    const detail = await a.auth(request(app).get(`/tontines/${id}`)).expect(200);
    expect(detail.body.status).toBe('completed');
    expect(detail.body.balance).toBe(0);
    for (const u of [a, b, c]) expect(await balance(u)).toBe(49_700);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('refuse les adhésions une fois démarrée et réserve le démarrage à l\'organisateur', async () => {
    const [a, b, late] = [await signup('Orga'), await signup('Membre'), await signup('Retardataire')];
    for (const u of [a, b, late]) await fund(u, 20_000);
    const t = await a.auth(request(app).post('/tontines')).send({ name: 'Test', contributionAmount: 5_000, frequency: 'weekly', maxMembers: 5 }).expect(201);
    await b.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    await b.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(403);
    await a.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(200);
    await late.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(409);
  });

  it('mobilise la caution d\'un membre défaillant et la reconstitue sur son propre pot', async () => {
    const [a, b, c] = [await signup('Awa'), await signup('Bintou'), await signup('Cheick')];
    for (const u of [a, b, c]) await fund(u, 50_000);
    const id = await startTontine([a, b, c], 10_000);
    await contribute(a, id, 1).expect(201);
    await contribute(b, id, 1).expect(201);
    // Cheick ne paie pas le tour 1 ; l'échéance et le délai de grâce passent.
    await pool.query("UPDATE tontine_rounds SET due_date = CURRENT_DATE - 10 WHERE tontine_id = $1 AND number = 1", [id]);
    const jobs = await runJobs();
    expect(jobs.tontineRoundsClosed).toBe(1);
    expect(await balance(a)).toBe(40_000 - 10_000 + 29_700);

    const score = await c.auth(request(app).get('/credit/offers')).expect(200);
    expect(score.body.factors.some((f: any) => f.points === -150)).toBe(true);

    for (const round of [2, 3]) for (const u of [a, b, c]) await contribute(u, id, round).expect(201);
    // Pot de Cheick : 30 000 − 300 de commission − 10 000 pour reconstituer sa caution, rendue en fin de cycle.
    expect(await balance(c)).toBe(49_700);
    expect(await balance(a)).toBe(49_700);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('applique une pénalité de retard reversée au bénéficiaire', async () => {
    const [a, b] = [await signup('Kofi'), await signup('Linda')];
    for (const u of [a, b]) await fund(u, 30_000);
    const id = await startTontine([a, b], 10_000);
    await pool.query("UPDATE tontine_rounds SET due_date = CURRENT_DATE - 1 WHERE tontine_id = $1 AND number = 1", [id]);
    await contribute(a, id, 1).expect(201);
    const r = await contribute(b, id, 1).expect(201);
    expect(r.body.pot).toBe(20_000 + 500 + 500); // les deux ont payé en retard : 5 % chacun
  });
});

describe('microfinance', () => {
  it('calcule un échéancier sur capital restant dû et respecte le taux d\'usure', () => {
    const s = amortize(100_000, 4, 0.015);
    expect(s.reduce((t, i) => t + i.principal, 0)).toBe(100_000);
    expect(s.reduce((t, i) => t + i.interest, 0)).toBe(3_777);
    expect(() => assertUnderUsury(0.025)).toThrow();
    expect(() => assertUnderUsury(0.015)).not.toThrow();
  });

  it('accorde une avance sur tontine remboursée automatiquement sur le pot', async () => {
    const [a, b, c] = [await signup('Mariam'), await signup('Nadia'), await signup('Ousmane')];
    for (const u of [a, b, c]) await fund(u, 100_000);
    const id = await startTontine([a, b, c], 20_000, 'weekly');
    const feesBefore = await sys('SYS_FEES');

    // Pot dans moins de 61 jours : pas d'avance (règle Google Play sur les prêts à court terme).
    let offers = await c.auth(request(app).get('/credit/offers')).expect(200);
    expect(offers.body.advances.find((o: any) => o.tontineId === id)).toMatchObject({ round: 3, eligible: false });
    await pool.query('UPDATE tontine_rounds SET due_date = CURRENT_DATE + 70 WHERE tontine_id = $1 AND number = 3', [id]);
    offers = await c.auth(request(app).get('/credit/offers')).expect(200);
    const offer = offers.body.advances.find((o: any) => o.tontineId === id);
    expect(offer).toMatchObject({ round: 3, maxAmount: 30_000, months: 3, eligible: true });
    await c.auth(request(app).post('/credit/advances')).send({ roundId: offer.roundId, amount: 40_000, pin: '4826' }).expect(400);
    await c.auth(request(app).post('/credit/advances')).send({ roundId: offer.roundId, amount: 20_000, pin: '4826' }).expect(201);
    await c.auth(request(app).post('/credit/advances')).send({ roundId: offer.roundId, amount: 5_000, pin: '4826' }).expect(400);
    expect(await balance(c)).toBe(80_000 + 20_000);

    for (const round of [1, 2, 3]) for (const u of [a, b, c]) await contribute(u, id, round).expect(201);
    const loans = await c.auth(request(app).get('/credit/loans')).expect(200);
    expect(loans.body[0]).toMatchObject({ product: 'avance_tontine', status: 'repaid', interest: 900 });
    // 100 000 − 60 000 cotisés + 20 000 d'avance + (60 000 − 600 − 20 900) de pot + 20 000 de caution rendue
    expect(await balance(c)).toBe(100_000 - 60_000 + 20_000 + 38_500);
    // Commissions tontine (3 × 600) + 40 % des 900 F d'intérêts (3 mois à 1,5 %)
    expect(await sys('SYS_FEES') - feesBefore).toBe(1_800 + 360);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('octroie un microcrédit selon le score, prélève les échéances et suit les impayés', async () => {
    const u = await signup('Rokia');
    const staff = await signup('Analyste');
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [staff.id]);

    const before = await u.auth(request(app).get('/credit/offers')).expect(200);
    expect(before.body.microcredit.eligible).toBe(false);
    await u.auth(request(app).post('/credit/loans')).send({ amount: 50_000, months: 4, purpose: 'Stock de pagnes', pin: '4826' }).expect(400);

    // Historique simulé : 14 cotisations de tontine payées à l'heure + identité vérifiée.
    const [x] = [await signup('Partenaire')];
    await fund(u, 20_000); await fund(x, 20_000);
    const id = await startTontine([u, x], 1_000);
    for (let i = 0; i < 14; i++) {
      const r = await pool.query(
        "INSERT INTO tontine_rounds (tontine_id, number, beneficiary_id, due_date, status) VALUES ($1, $2, $3, CURRENT_DATE, 'paid_out') RETURNING id",
        [id, 100 + i, x.id]);
      await pool.query("INSERT INTO tontine_contributions (round_id, user_id, amount, source) VALUES ($1, $2, 1000, 'wallet')", [r.rows[0].id, u.id]);
    }
    await pool.query('UPDATE users SET kyc_level = 1 WHERE id = $1', [u.id]);

    const offers = await u.auth(request(app).get('/credit/offers')).expect(200);
    expect(offers.body.score).toBe(560);
    expect(offers.body.microcredit).toMatchObject({ eligible: true, maxAmount: 110_000 });
    await u.auth(request(app).post('/credit/loans')).send({ amount: 150_000, months: 4, purpose: 'Stock de pagnes', pin: '4826' }).expect(400);
    await u.auth(request(app).post('/credit/loans')).send({ amount: 100_000, months: 5, purpose: 'Stock de pagnes', pin: '4826' }).expect(400);
    const loan = await u.auth(request(app).post('/credit/loans')).send({ amount: 100_000, months: 4, purpose: 'Stock de pagnes', pin: '4826' }).expect(201);
    expect(loan.body.interest).toBe(3_777);
    const wallet0 = await balance(u);

    const r1 = await u.auth(request(app).post(`/credit/loans/${loan.body.id}/repay`)).send({ pin: '4826' }).expect(200);
    expect(r1.body).toMatchObject({ paid: 25_944, remaining: 3 });

    // Échéance 2 due aujourd'hui : prélevée automatiquement.
    await pool.query('UPDATE loan_installments SET due_date = CURRENT_DATE WHERE loan_id = $1 AND number = 2', [loan.body.id]);
    const j1 = await runJobs();
    expect(j1.credit.autoDebited).toBe(1);
    expect(await balance(u)).toBe(wallet0 - 25_944 * 2);

    // Le client vide son portefeuille ; l'échéance 3 a 40 jours de retard → pénalité et PAR30.
    await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: Math.floor((await balance(u)) / 1.015) - 100, channel: 'wave', pin: '4826' }).expect(201);
    await pool.query("UPDATE loan_installments SET due_date = CURRENT_DATE - 40 WHERE loan_id = $1 AND number = 3", [loan.body.id]);
    const j2 = await runJobs();
    expect(j2.credit.penalized).toBe(1);
    const credit = await staff.auth(request(app).get('/admin/api/credit')).expect(200);
    expect(credit.body.portfolio.par30).toBeGreaterThan(0);

    // 100 jours de retard → défaut, score à zéro.
    await pool.query("UPDATE loan_installments SET due_date = CURRENT_DATE - 100 WHERE loan_id = $1 AND number = 3", [loan.body.id]);
    const j3 = await runJobs();
    expect(j3.credit.defaulted).toBe(1);
    const after = await u.auth(request(app).get('/credit/offers')).expect(200);
    expect(after.body.score).toBe(0);
    expect(after.body.microcredit.eligible).toBe(false);
    expect(await ledgerBalanced()).toBe(true);
  });
});
