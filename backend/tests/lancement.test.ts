import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { currentStep, totpAt } from '../src/lib/totp.js';
import { mockProvider } from '../src/services/payments/mock.js';
import { setPaymentProvider, type PaymentProvider } from '../src/services/payments/index.js';
import type { VerificationResult } from '../src/services/payments/types.js';
import { reconcilePendingDeposits } from '../src/modules/wallet.js';
import { hmac } from '../src/lib/crypto.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
async function staff(name: string, role: 'admin' | 'support' = 'admin') {
  const u = await signup(name);
  await pool.query('UPDATE users SET role = $2 WHERE id = $1', [u.id, role]);
  return u;
}

describe('vérification d\'identité (KYC)', () => {
  it('dépôt du dossier, revue par un administrateur, plafonds et crédit débloqués', async () => {
    const m = await signup('Fatimata KYC');
    const kyc = await m.auth(request(app).get('/me/kyc')).expect(200);
    expect(kyc.body).toMatchObject({ level: 0, pending: null });

    const dossier = { level: 1, idType: 'cnib', idNumber: 'B12345678', fullName: 'Fatimata Ouédraogo', idFront: IMG, selfie: IMG };
    await m.auth(request(app).post('/me/kyc')).send(dossier).expect(400); // verso de la CNIB manquant
    await m.auth(request(app).post('/me/kyc')).send({ ...dossier, idFront: 'https://exemple.bf/x.jpg', idBack: IMG }).expect(400);
    const sub = await m.auth(request(app).post('/me/kyc')).send({ ...dossier, idBack: IMG }).expect(201);
    await m.auth(request(app).post('/me/kyc')).send({ ...dossier, idBack: IMG }).expect(409); // déjà en attente

    const support = await staff('Agent Support', 'support');
    const admin = await staff('Admin Conformité');
    const list = await support.auth(request(app).get('/admin/api/kyc')).expect(200);
    const row = list.body.find((k: any) => k.id === sub.body.id);
    expect(row).toMatchObject({ full_name: 'Fatimata Ouédraogo', id_type: 'cnib', kyc_level: 0 });
    expect(row).not.toHaveProperty('selfie'); // pas de photos dans la liste
    const detail = await support.auth(request(app).get(`/admin/api/kyc/${sub.body.id}`)).expect(200);
    expect(detail.body.selfie).toBe(IMG);
    const viewed = await pool.query("SELECT props FROM user_events WHERE user_id = $1 AND name = 'kyc_viewed'", [m.id]);
    expect(viewed.rows[0].props.by).toBe(support.id);

    await support.auth(request(app).post(`/admin/api/kyc/${sub.body.id}/decision`)).send({ decision: 'approve' }).expect(403);
    await admin.auth(request(app).post(`/admin/api/kyc/${sub.body.id}/decision`)).send({ decision: 'reject' }).expect(400); // motif obligatoire
    await admin.auth(request(app).post(`/admin/api/kyc/${sub.body.id}/decision`)).send({ decision: 'approve' }).expect(200);
    await admin.auth(request(app).post(`/admin/api/kyc/${sub.body.id}/decision`)).send({ decision: 'approve' }).expect(409);

    expect((await m.auth(request(app).get('/me/kyc')).expect(200)).body.level).toBe(1);
    const offers = await m.auth(request(app).get('/credit/offers')).expect(200);
    expect(offers.body.microcredit.reasons.join(' ')).not.toContain('identité');
    expect(offers.body.factors.find((f: any) => f.label === 'Identité vérifiée').points).toBe(50);
    await m.auth(request(app).post('/me/kyc')).send({ ...dossier, idBack: IMG }).expect(409); // niveau déjà atteint

    // Niveau 2 : justificatif obligatoire ; un refus est motivé et notifié.
    await m.auth(request(app).post('/me/kyc')).send({ ...dossier, level: 2, idBack: IMG }).expect(400);
    const sub2 = await m.auth(request(app).post('/me/kyc')).send({ ...dossier, level: 2, idBack: IMG, proofOfAddress: IMG }).expect(201);
    await admin.auth(request(app).post(`/admin/api/kyc/${sub2.body.id}/decision`)).send({ decision: 'reject', reason: 'Justificatif illisible' }).expect(200);
    const notes = await m.auth(request(app).get('/me/notifications')).expect(200);
    expect(notes.body[0].body).toContain('Justificatif illisible');
    expect((await m.auth(request(app).get('/me/kyc')).expect(200)).body).toMatchObject({ level: 1, pending: null, last: { status: 'rejected' } });
  });

  it('accepte des photos réalistes (≈ 400 Ko) mais refuse les requêtes trop lourdes', async () => {
    const m = await signup('Grosse photo');
    const big = 'data:image/jpeg;base64,' + 'B'.repeat(450_000);
    await m.auth(request(app).post('/me/kyc')).send({ level: 1, idType: 'passeport', idNumber: 'P998877', fullName: 'Grosse Photo', idFront: big, selfie: big }).expect(201);
    const logo = 'data:image/png;base64,' + 'C'.repeat(250_000);
    await m.auth(request(app).post('/partners')).send({ name: 'Logo lourd', type: 'association', logo }).expect(201);
    // Hors des routes photo, la limite reste à 100 Ko.
    const r = await m.auth(request(app).post('/me/support/tickets')).send({ subject: 'test', body: 'x'.repeat(150_000) }).expect(413);
    expect(r.body.error).toBe('payload_too_large');
  });
});

describe('double authentification du back-office', () => {
  it('activation, code exigé pour le back-office, rejeu et force brute bloqués, réinitialisation', async () => {
    const admin = await staff('Admin MFA');
    const customer = await signup('Client sans MFA');
    await customer.auth(request(app).post('/auth/mfa/setup')).expect(403);

    const setup = await admin.auth(request(app).post('/auth/mfa/setup')).expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Smart%20Tontine/);
    const stored = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [admin.id]);
    expect(stored.rows[0].totp_secret).not.toContain(setup.body.secret); // chiffré en base
    await admin.auth(request(app).post('/auth/mfa/enable')).send({ code: '000000' }).expect(400);
    const step = currentStep();
    const enabled = await admin.auth(request(app).post('/auth/mfa/enable')).send({ code: totpAt(setup.body.secret, step) }).expect(200);

    // Ancien jeton (sans 2FA) : back-office refusé ; nouveau jeton : accepté.
    const denied = await admin.auth(request(app).get('/admin/api/kpis')).expect(403);
    expect(denied.body.error).toBe('mfa_required');
    await request(app).get('/admin/api/kpis').set('authorization', `Bearer ${enabled.body.token}`).expect(200);
    // L'espace client reste accessible sans 2FA.
    await admin.auth(request(app).get('/wallet')).expect(200);

    // Un code déjà utilisé est refusé (rejeu), le suivant est accepté.
    await admin.auth(request(app).post('/auth/mfa/verify')).send({ code: totpAt(setup.body.secret, step) }).expect(400);
    const v = await admin.auth(request(app).post('/auth/mfa/verify')).send({ code: totpAt(setup.body.secret, step + 1) }).expect(200);
    await request(app).get('/admin/api/kyc').set('authorization', `Bearer ${v.body.token}`).expect(200);

    for (let i = 0; i < 5; i++) await admin.auth(request(app).post('/auth/mfa/verify')).send({ code: '123456' }).expect(400);
    await admin.auth(request(app).post('/auth/mfa/verify')).send({ code: totpAt(setup.body.secret, step + 1) }).expect(423);

    // Téléphone perdu : un autre admin (avec 2FA) réinitialise.
    const other = await staff('Admin 2');
    await other.auth(request(app).post(`/admin/api/staff/${admin.id}/mfa/reset`)).expect(200);
    await other.auth(request(app).post(`/admin/api/staff/${customer.id}/mfa/reset`)).expect(404);
    await admin.auth(request(app).get('/admin/api/kpis')).expect(200);
  });
});

describe('paiements : vérification serveur-à-serveur', () => {
  const verdicts = new Map<string, VerificationResult>();
  const fake: PaymentProvider = { ...mockProvider, name: 'fake', verify: async (ref) => verdicts.get(ref) ?? { status: 'pending' } };
  afterEach(() => setPaymentProvider(mockProvider));
  const webhook = (reference: string, status: string) => {
    const body = JSON.stringify({ reference, status });
    return request(app).post('/webhooks/payments').set('content-type', 'application/json')
      .set('x-smarttontine-signature', hmac('test-webhook', body)).send(body);
  };

  it('ne crédite que ce que l’agrégateur confirme, pour le bon montant', async () => {
    setPaymentProvider(fake);
    const m = await signup('Dépôts vérifiés');
    const dep = async (amount: number) => (await m.auth(request(app).post('/wallet/deposits')).send({ amount, channel: 'orange_money' }).expect(201)).body.reference as string;

    // Le webhook dit « succès » mais l'agrégateur dit « refusé » : rien n'est crédité.
    const a = await dep(10_000);
    verdicts.set(a, { status: 'failed' });
    expect((await webhook(a, 'success').expect(200)).body.status).toBe('failed');
    // Montant encaissé différent : mis de côté pour rapprochement, pas crédité.
    const b = await dep(20_000);
    verdicts.set(b, { status: 'success', amount: 2_000 });
    expect((await webhook(b, 'success').expect(200)).body).toMatchObject({ status: 'pending', mismatch: true });
    // Notification CinetPay (formulaire) : vérifiée puis créditée.
    const c = await dep(15_000);
    verdicts.set(c, { status: 'success', amount: 15_000 });
    await request(app).post('/webhooks/cinetpay').type('form').send({ cpm_trans_id: c, cpm_site_id: '123' }).expect(200);
    expect(await balance(m)).toBe(15_000);
    // Webhook perdu : le rattrapage horaire interroge l'agrégateur.
    const d = await dep(5_000);
    verdicts.set(d, { status: 'success', amount: 5_000 });
    await pool.query("UPDATE transactions SET created_at = now() - interval '20 minutes' WHERE reference = $1", [d]);
    expect(await reconcilePendingDeposits()).toBeGreaterThanOrEqual(1);
    expect(await balance(m)).toBe(20_000);
    // Le rattrapage ignore le dépôt au montant incohérent (traité à la main).
    const mm = await pool.query('SELECT status, meta FROM transactions WHERE reference = $1', [b]);
    expect(mm.rows[0]).toMatchObject({ status: 'pending', meta: { verification: 'amount_mismatch', paidAmount: 2000 } });
    expect(await ledgerBalanced()).toBe(true);
  });

  it('sans vérification possible (fournisseur simulé), le webhook signé reste la référence', async () => {
    const m = await signup('Mock');
    await fund(m, 3_000);
    expect(await balance(m)).toBe(3_000);
  });
});
