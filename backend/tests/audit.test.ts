import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { config, productionConfigErrors } from '../src/config.js';
import { SPA_ROUTES } from '../src/app.js';
import { isWeakPin } from '../src/modules/auth.js';
import { maskPhone } from '../src/lib/privacy.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

// Corrections issues de l'audit externe du 05/10/2026 (docs/16). Chaque test reprend un constat du rapport.

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

let n = 0;
const newPhone = () => `+22676${String(Date.now() % 1e5).padStart(5, '0')}${String(n++ % 10)}`;

async function startTontine(members: User[], contribution: number) {
  const t = await members[0].auth(request(app).post('/tontines'))
    .send({ name: 'Tontine audit', contributionAmount: contribution, frequency: 'monthly', maxMembers: members.length, orderMode: 'fixed' }).expect(201);
  for (const m of members.slice(1)) await m.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
  await members[0].auth(request(app).post(`/tontines/${t.body.id}/start`)).send({ order: members.map((m) => m.id) }).expect(200);
  return t.body.id as string;
}

describe('bloquants avant production', () => {
  it('la production refuse paiements simulés, SMS console, code OTP renvoyé et secrets faibles', () => {
    const errors = productionConfigErrors({ NODE_ENV: 'production', JWT_SECRET: 'court', PAYMENT_WEBHOOK_SECRET: 'x', DATABASE_URL: 'x' });
    expect(errors.join(' ')).toMatch(/PAYMENT_PROVIDER=mock/);
    expect(errors.join(' ')).toMatch(/SMS_PROVIDER=console/);
    expect(errors.join(' ')).toMatch(/KYC_ENCRYPTION_KEY/);
    expect(errors.join(' ')).toMatch(/32 caractères/);
    expect(productionConfigErrors({ PAYMENT_PROVIDER: 'cinetpay', SMS_PROVIDER: 'orange,twilio', JWT_SECRET: 'x'.repeat(48),
      PAYMENT_WEBHOOK_SECRET: 'x', DATABASE_URL: 'x', KYC_ENCRYPTION_KEY: 'k', OTP_DEV_ECHO: 'true' })).toEqual(['OTP_DEV_ECHO interdit en production']);
  });

  it('le code OTP n’est renvoyé qu’en démonstration explicite', async () => {
    const saved = config.otpDevEcho;
    try {
      (config as { otpDevEcho: boolean }).otpDevEcho = false;
      const r = await request(app).post('/auth/otp/request').send({ phone: newPhone() }).expect(200);
      expect(r.body).toEqual({ ok: true });
    } finally { (config as { otpDevEcho: boolean }).otpDevEcho = saved; }
  });

  it('OTP : 3 essais par code puis 429, et au plus 10 essais ratés par numéro et par heure', async () => {
    const phone = newPhone();
    let otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const wrong = (c: string) => (c === '000000' ? '111111' : '000000');
    expect((await request(app).post('/auth/otp/verify').send({ phone, code: wrong(otp.body.devCode) }).expect(400)).body.message).toMatch(/2 essais restants/);
    await request(app).post('/auth/otp/verify').send({ phone, code: wrong(otp.body.devCode) }).expect(400);
    expect((await request(app).post('/auth/otp/verify').send({ phone, code: wrong(otp.body.devCode) }).expect(429)).body.error).toBe('otp_locked');
    // Même le bon code est refusé : le code est invalidé.
    await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode }).expect(429);

    // Nouveaux codes : le plafond horaire par numéro (10 échecs) finit par bloquer, même avec le bon code.
    for (let i = 0; i < 3; i++) {
      otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
      for (let k = 0; k < 3; k++) await request(app).post('/auth/otp/verify').send({ phone, code: wrong(otp.body.devCode) });
    }
    await pool.query("DELETE FROM otp_codes WHERE phone = $1 AND id NOT IN (SELECT id FROM otp_codes WHERE phone = $1 ORDER BY id DESC LIMIT 4)", [phone]); // contourne la limite d'envoi
    otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const r = await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode }).expect(429);
    expect(r.body.message).toMatch(/une heure/);
  });
});

describe('sessions courtes', () => {
  it('app : jeton d’accès + jeton de renouvellement à usage unique ; la réutilisation révoque toute la famille', async () => {
    const phone = newPhone();
    const otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const s1 = (await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode, fullName: 'Session App' }).expect(200)).body;
    expect(s1).toMatchObject({ expiresIn: 1800 });
    expect(s1.refreshToken).toBeTruthy();
    const s2 = (await request(app).post('/auth/refresh').send({ refreshToken: s1.refreshToken }).expect(200)).body;
    expect(s2.refreshToken).not.toBe(s1.refreshToken);
    await request(app).get('/auth/me').set('authorization', `Bearer ${s2.token}`).expect(200);
    // Jeton déjà utilisé (volé ?) : refusé, et le jeton légitime suivant est révoqué aussi.
    await request(app).post('/auth/refresh').send({ refreshToken: s1.refreshToken }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: s2.refreshToken }).expect(401);
  });

  it('web : le jeton de renouvellement n’existe que dans un cookie HttpOnly, jamais dans le corps', async () => {
    const phone = newPhone();
    const otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const r = await request(app).post('/auth/otp/verify').set('x-client', 'web').send({ phone, code: otp.body.devCode, fullName: 'Session Web' }).expect(200);
    expect(r.body.refreshToken).toBeUndefined();
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/st_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/auth/);
    const value = cookie.split(';')[0];
    const again = await request(app).post('/auth/refresh').set('x-client', 'web').set('cookie', value).send({}).expect(200);
    expect(again.body.token).toBeTruthy();
    expect(again.body.refreshToken).toBeUndefined();
    // Déconnexion : le cookie suivant est révoqué et effacé.
    const next = String(again.headers['set-cookie']).split(';')[0];
    await request(app).post('/auth/logout').set('x-client', 'web').set('cookie', next).send({}).expect(200);
    await request(app).post('/auth/refresh').set('x-client', 'web').set('cookie', next).send({}).expect(401);
  });

  it('« déconnecter tous mes appareils » révoque aussi les jetons de renouvellement', async () => {
    const phone = newPhone();
    const otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const other = (await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode, fullName: 'Deux appareils' }).expect(200)).body;
    const otp2 = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const mine = (await request(app).post('/auth/otp/verify').send({ phone, code: otp2.body.devCode }).expect(200)).body;
    const fresh = (await request(app).post('/auth/logout-all').set('authorization', `Bearer ${mine.token}`).send({}).expect(200)).body;
    await request(app).post('/auth/refresh').send({ refreshToken: other.refreshToken }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: fresh.refreshToken }).expect(200);
  });
});

describe('compte et confidentialité', () => {
  it('refuse les codes PIN triviaux', async () => {
    for (const p of ['0000', '1111', '1234', '6789', '9876', '4321', '1212', '2580', '2026']) expect(isWeakPin(p), p).toBe(true);
    for (const p of ['4826', '7391', '0592']) expect(isWeakPin(p), p).toBe(false);
    const m = await signup('PIN faible');
    const r = await m.auth(request(app).put('/auth/me/pin')).send({ pin: '0000', currentPin: '4826' }).expect(400);
    expect(r.body.error).toBe('weak_pin');
  });

  it('enregistre le nom d’un compte qui n’en avait pas, sans jamais écraser un nom existant', async () => {
    const phone = newPhone();
    let otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode }).expect(200);
    expect((await pool.query('SELECT full_name FROM users WHERE phone = $1', [phone])).rows[0].full_name).toBeNull();
    otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode, fullName: 'Rasmata Zongo' }).expect(200);
    otp = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    await request(app).post('/auth/otp/verify').send({ phone, code: otp.body.devCode, fullName: 'Autre Nom' }).expect(200);
    expect((await pool.query('SELECT full_name FROM users WHERE phone = $1', [phone])).rows[0].full_name).toBe('Rasmata Zongo');
  });

  it('masque le numéro des autres membres ; l’organisateur voit les numéros complets', async () => {
    expect(maskPhone('+22670123456')).toBe('+226 70 •• •• 56');
    const [org, a] = [await signup('Organisatrice'), await signup('Membre A')];
    for (const u of [org, a]) await fund(u, 50_000);
    const id = await startTontine([org, a], 5_000);
    const asMember = (await a.auth(request(app).get(`/tontines/${id}`)).expect(200)).body.members;
    expect(asMember.find((m: any) => m.id === org.id).phone).toMatch(/••/);
    expect(asMember.find((m: any) => m.id === a.id).phone).toBe(a.phone);
    const asOrg = (await org.auth(request(app).get(`/tontines/${id}`)).expect(200)).body.members;
    expect(asOrg.find((m: any) => m.id === a.id).phone).toBe(a.phone);
  });

  it('chiffre au repos le numéro et les photos des pièces d’identité', async () => {
    const m = await signup('KYC chiffré');
    const IMG = 'data:image/jpeg;base64,' + 'B'.repeat(2000);
    await m.auth(request(app).post('/me/kyc')).send({ level: 1, idType: 'passeport', idNumber: 'P1234567', fullName: 'KYC Chiffré', idFront: IMG, selfie: IMG }).expect(201);
    const row = (await pool.query('SELECT id_number, id_front, selfie FROM kyc_submissions WHERE user_id = $1', [m.id])).rows[0];
    for (const v of Object.values(row)) expect(String(v)).toMatch(/^enc:v1:/);
    expect(JSON.stringify(row)).not.toContain('P1234567');
  });
});

describe('logique tontine et outillage de démonstration', () => {
  it('une cotisation porte toujours sur le tour en cours', async () => {
    const [a, b] = [await signup('Tour A'), await signup('Tour B')];
    for (const u of [a, b]) await fund(u, 50_000);
    const id = await startTontine([a, b], 5_000);
    const r = await b.auth(request(app).post(`/tontines/${id}/rounds/2/contribute`)).expect(409);
    expect(r.body.error).toBe('not_current_round');
    await a.auth(request(app).post(`/tontines/${id}/rounds/1/contribute`)).expect(201);
  });

  it('rejoue un impayé de bout en bout : la caution du retardataire paie le bénéficiaire', async () => {
    const [a, b] = [await signup('Bénéficiaire'), await signup('Retardataire')];
    for (const u of [a, b]) await fund(u, 50_000);
    const id = await startTontine([a, b], 10_000);
    await a.auth(request(app).post(`/tontines/${id}/rounds/1/contribute`)).expect(201);
    await b.auth(request(app).post(`/dev/tontines/${id}/rounds/1/overdue`)).expect(403); // réservé à l'organisateur
    const before = await balance(a);
    await a.auth(request(app).post(`/dev/tontines/${id}/rounds/1/overdue`)).expect(200);
    const t = (await a.auth(request(app).get(`/tontines/${id}`)).expect(200)).body;
    expect(t.rounds[0].status).not.toBe('open');
    expect(await balance(a)).toBeGreaterThan(before); // pot versé grâce à la caution de B
    expect(t.members.find((m: any) => m.id === b.id).guarantee_status).toBe('used');
    expect(await ledgerBalanced()).toBe(true);
  });
});

describe('hygiène HTTP', () => {
  it('API : route inconnue → 404 JSON ; pages web inconnues → vrai 404', async () => {
    const r = await request(app).get('/auth/inconnue').expect(404);
    expect(r.body.error).toBe('not_found');
    for (const ok of ['/', '/decouvrir', '/partenaires/abc', '/rejoindre/XYZ', '/app', '/app/portefeuille', '/partenaire/1/membres', '/confidentialite']) {
      expect(SPA_ROUTES.test(ok), ok).toBe(true);
    }
    for (const ko of ['/users', '/api/admin/users', '/.env', '/.git/config', '/package.json', '/wp-admin']) expect(SPA_ROUTES.test(ko), ko).toBe(false);
  });
});
