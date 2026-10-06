import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../src/db.js';
import { rateLimit } from '../src/lib/rateLimit.js';
import { errorHandler } from '../src/lib/errors.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

async function admin() {
  const a = await signup('Admin Web');
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [a.id]);
  return a;
}

async function activePartner(owner: User, body: Record<string, unknown>) {
  const p = await owner.auth(request(app).post('/partners')).send(body).expect(201);
  await (await admin()).auth(request(app).patch(`/admin/api/partners/${p.body.id}`)).send({ status: 'active' }).expect(200);
  return p.body.id as string;
}

describe('sécurité du compte', () => {
  it('R5 — verrouille le PIN après 5 erreurs et refuse toute sortie d\'argent pendant 30 minutes', async () => {
    const u = await signup('Fatim PIN');
    await fund(u, 20_000);
    for (let i = 1; i <= 4; i++) {
      const r = await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1000, channel: 'wave', pin: '0000' }).expect(400);
      expect(r.body.message).toContain(`${5 - i} essai`);
    }
    const locked = await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1000, channel: 'wave', pin: '0000' }).expect(423);
    expect(locked.body.error).toBe('pin_locked');
    // Même le bon PIN est refusé pendant le verrouillage, et le solde n'a pas bougé.
    await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1000, channel: 'wave', pin: '4826' }).expect(423);
    expect(await balance(u)).toBe(20_000);
    const notes = await u.auth(request(app).get('/me/notifications')).expect(200);
    expect(notes.body.some((n: any) => n.title.includes('verrouillé'))).toBe(true);

    // Fin du verrouillage : le bon PIN fonctionne et remet le compteur à zéro.
    await pool.query("UPDATE users SET pin_locked_until = now() - interval '1 minute' WHERE id = $1", [u.id]);
    await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 1000, channel: 'wave', pin: '4826' }).expect(201);
    const row = await pool.query('SELECT pin_failed_attempts FROM users WHERE id = $1', [u.id]);
    expect(row.rows[0].pin_failed_attempts).toBe(0);
  });

  it('applique le plafond mensuel de dépôts du niveau KYC', async () => {
    const u = await signup('Plafond KYC');
    for (let i = 0; i < 3; i++) {
      await fund(u, 150_000);
      await u.auth(request(app).post('/wallet/withdrawals')).send({ amount: 148_000, channel: 'wave', pin: '4826' }).expect(201);
    }
    // 450 000 F déjà déposés ce mois-ci : KYC 0 plafonné à 500 000 F.
    const r = await u.auth(request(app).post('/wallet/deposits')).send({ amount: 100_000, channel: 'wave' }).expect(400);
    expect(r.body.error).toBe('kyc_monthly_limit');
    await pool.query('UPDATE users SET kyc_level = 1 WHERE id = $1', [u.id]);
    await u.auth(request(app).post('/wallet/deposits')).send({ amount: 100_000, channel: 'wave' }).expect(201);
  });

  it('limite le débit par adresse IP', async () => {
    const mini = express();
    mini.get('/x', rateLimit({ name: 't', windowMs: 60_000, max: 3 }), (_req, res) => { res.json({ ok: true }); });
    mini.use(errorHandler);
    for (let i = 0; i < 3; i++) await request(mini).get('/x').expect(200);
    const r = await request(mini).get('/x').expect(429);
    expect(r.headers['retry-after']).toBeDefined();
  });
});

describe('site public (sans compte)', () => {
  it('R8 — tarifs, chiffres clés, tontines publiques, catalogue et vitrines, puis adhésion après inscription', async () => {
    const owner = await signup('Commerçant Web');
    const pid = await activePartner(owner, { name: 'Ets Kaboré Électro', type: 'commercant', city: 'Ouagadougou' });
    const good = await owner.auth(request(app).post(`/goods/partners/${pid}`)).send({ name: 'Réfrigérateur 150 L', category: 'electromenager', price: 90_000 }).expect(201);
    const t = await owner.auth(request(app).post('/tontines'))
      .send({ name: 'Frigo pour 3', frequency: 'weekly', maxMembers: 3, kind: 'bien', goodId: good.body.id, partnerId: pid, visibility: 'public' }).expect(201);
    await owner.auth(request(app).post('/tontines'))
      .send({ name: 'Tontine privée', contributionAmount: 5000, frequency: 'weekly', maxMembers: 3, partnerId: pid }).expect(201);

    const pricing = await request(app).get('/public/pricing').expect(200);
    expect(pricing.body.tontine.commissionRate).toBe(0.01);
    const stats = await request(app).get('/public/stats').expect(200);
    expect(stats.body.partners).toBeGreaterThanOrEqual(1);
    expect(stats.body).not.toHaveProperty('phone');

    const list = await request(app).get('/public/tontines?kind=bien').expect(200);
    expect(list.body.map((x: any) => x.name)).toEqual(['Frigo pour 3']);
    expect(list.body[0].partner.name).toBe('Ets Kaboré Électro');
    const preview = await request(app).get(`/public/tontines/${t.body.id}`).expect(200);
    expect(preview.body).toMatchObject({ kind: 'bien', good_price: 90_000, members: 0, max_members: 3 });
    await request(app).get('/public/tontines/pas-un-uuid').expect(404);

    const goods = await request(app).get('/public/goods?search=frigo').expect(200);
    expect(goods.body).toHaveLength(0);
    expect((await request(app).get('/public/goods?category=electromenager').expect(200)).body[0].name).toBe('Réfrigérateur 150 L');
    const partners = await request(app).get('/public/partners').expect(200);
    expect(partners.body.find((p: any) => p.id === pid)).toMatchObject({ open_tontines: 1, goods: 1 });
    const vitrine = await request(app).get(`/public/partners/${pid}`).expect(200);
    expect(vitrine.body.tontines).toHaveLength(1); // la tontine privée n'apparaît pas

    // Le visiteur s'inscrit puis adhère depuis le lien.
    const visitor = await signup('Visiteur Devenu Membre');
    await fund(visitor, 40_000);
    await visitor.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    expect((await request(app).get(`/public/tontines/${t.body.id}`).expect(200)).body.members).toBe(1);
    // Les chiffres clés comptent les pots réellement versés.
    const before = (await request(app).get('/public/stats').expect(200)).body.pots_paid as number;
    expect(before).toBe(0);
  });

  it('R9 — une demande « Devenir partenaire » arrive dans le back-office', async () => {
    await request(app).post('/public/leads').send({ kind: 'partenaire', name: 'A', phone: '12' }).expect(400);
    await request(app).post('/public/leads').send({ kind: 'sfd', name: 'Robot', phone: '+22670112233', website: 'spam' }).expect(400);
    const r = await request(app).post('/public/leads').send({
      kind: 'sfd', name: 'Awa Ouédraogo', organization: 'Caisse Populaire de Tanghin', partnerType: 'sfd',
      phone: '+226 70 11 22 33', email: 'awa@example.bf', city: 'Ouagadougou', members: 3500, message: 'Numériser nos groupes',
    }).expect(201);
    const member = await signup('Simple membre');
    await member.auth(request(app).get('/admin/api/leads')).expect(403);
    const a = await admin();
    const leads = await a.auth(request(app).get('/admin/api/leads?status=new')).expect(200);
    expect(leads.body.find((l: any) => l.id === r.body.id)).toMatchObject({ organization: 'Caisse Populaire de Tanghin', members: 3500 });
    await a.auth(request(app).patch(`/admin/api/leads/${r.body.id}`)).send({ status: 'contacted' }).expect(200);
    const after = await a.auth(request(app).get('/admin/api/leads?status=contacted')).expect(200);
    expect(after.body[0].handler).toBe('Admin Web');
  });
});

describe('portail partenaire', () => {
  it('R7 — membres, catalogue complet, relevé du compte et export CSV conformes au grand livre', async () => {
    const owner = await signup('Présidente Association');
    const pid = await activePartner(owner, { name: 'Association Wend-Panga', type: 'association', managementFeeRate: 0.02 });
    const manager = await signup('Trésorier');
    await owner.auth(request(app).post(`/partners/${pid}/staff`)).send({ phone: manager.phone }).expect(201);
    const t = await manager.auth(request(app).post('/tontines'))
      .send({ name: 'Tontine des femmes', contributionAmount: 10_000, frequency: 'weekly', maxMembers: 2, partnerId: pid }).expect(201);
    const [a, b] = [await signup('Awa'), await signup('Bintou')];
    for (const m of [a, b]) { await fund(m, 30_000); await m.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201); }
    await manager.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({ orderMode: 'fixed' }).expect(200);
    for (const m of [a, b]) await m.auth(request(app).post(`/tontines/${t.body.id}/rounds/1/contribute`)).expect(201);

    const members = await manager.auth(request(app).get(`/partners/${pid}/members`)).expect(200);
    expect(members.body).toHaveLength(2);
    expect(members.body[0]).toMatchObject({ contributed: 10_000, defaulter: false });
    expect(members.body[0].groups[0].name).toBe('Tontine des femmes');
    await a.auth(request(app).get(`/partners/${pid}/members`)).expect(403);

    const g = await manager.auth(request(app).post(`/goods/partners/${pid}`)).send({ name: 'Pagnes', category: 'textile', price: 15_000 }).expect(201);
    await manager.auth(request(app).patch(`/goods/${g.body.id}`)).send({ active: false }).expect(200);
    const goods = await manager.auth(request(app).get(`/partners/${pid}/goods`)).expect(200);
    expect(goods.body[0]).toMatchObject({ name: 'Pagnes', active: false, orders: 0 });

    // Relevé : réservé au propriétaire ; frais de gestion 2 % du pot de 20 000 F = 400 F.
    await manager.auth(request(app).get(`/partners/${pid}/statement`)).expect(403);
    await fund(owner, 5000);
    await owner.auth(request(app).post(`/partners/${pid}/topup`)).send({ amount: 5000 }).expect(200);
    const st = await owner.auth(request(app).get(`/partners/${pid}/statement`)).expect(200);
    expect(st.body.map((e: any) => e.amount)).toEqual([5000, 400]);
    expect(st.body[0].balance_after).toBe(5400);
    const bal = await pool.query('SELECT a.balance FROM partners p JOIN accounts a ON a.id = p.account_id WHERE p.id = $1', [pid]);
    expect(bal.rows[0].balance).toBe(5400);
    const today = new Date().toISOString().slice(0, 10);
    expect((await owner.auth(request(app).get(`/partners/${pid}/statement?from=2000-01-01&to=2000-12-31`)).expect(200)).body).toHaveLength(0);
    expect((await owner.auth(request(app).get(`/partners/${pid}/statement?from=${today}`)).expect(200)).body).toHaveLength(2);

    const csv = await owner.auth(request(app).get(`/partners/${pid}/statement.csv`)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    const lines = csv.text.replace('﻿', '').split('\n');
    expect(lines[0]).toBe('date;reference;type;libelle;montant;solde');
    expect(lines[1]).toContain('"partner_topup"');
    expect(lines[1].endsWith('"5000";"5400"')).toBe(true);
    expect((await request(app).get('/public/stats').expect(200)).body).toMatchObject({ pots_paid: 1, pots_amount: 20_000 });
    expect(await ledgerBalanced()).toBe(true);
  });
});
