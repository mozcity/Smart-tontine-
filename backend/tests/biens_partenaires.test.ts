import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { runJobs } from '../src/jobs.js';
import { invoicePartners } from '../src/modules/partners.js';
import { app, balance, fund, ledgerBalanced, resetDb, signup, type User } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const sys = async (code: string) => (await pool.query('SELECT balance FROM accounts WHERE code = $1', [code])).rows[0].balance as number;
const partnerBalance = async (id: string) =>
  (await pool.query('SELECT a.balance FROM partners p JOIN accounts a ON a.id = p.account_id WHERE p.id = $1', [id])).rows[0].balance as number;

async function approvedPartner(owner: User, body: Record<string, unknown>) {
  const p = await owner.auth(request(app).post('/partners')).send(body).expect(201);
  expect(p.body.status).toBe('pending');
  const admin = await signup('Admin ST');
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.id]);
  await admin.auth(request(app).patch(`/admin/api/partners/${p.body.id}`)).send({ status: 'active' }).expect(200);
  return p.body.id as string;
}

describe('espace partenaire (marque blanche)', () => {
  it('organise plusieurs groupes sous son logo, prélève ses frais de gestion et suit tout depuis son tableau de bord', async () => {
    const owner = await signup('Mariam Tontinière');
    const pending = await owner.auth(request(app).post('/partners'))
      .send({ name: 'Tontine Wend-Kuuni', type: 'tontinier', logo: LOGO, primaryColor: '#C0392B', managementFeeRate: 0.02 }).expect(201);
    await owner.auth(request(app).post('/tontines'))
      .send({ name: 'Test', contributionAmount: 10_000, frequency: 'weekly', maxMembers: 3, partnerId: pending.body.id }).expect(409);
    await owner.auth(request(app).post('/partners')).send({ name: 'Frais trop élevés', type: 'tontinier', managementFeeRate: 0.05 }).expect(400);

    const admin = await signup('Admin Plateforme');
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.id]);
    await owner.auth(request(app).patch(`/admin/api/partners/${pending.body.id}`)).send({ status: 'active' }).expect(403);
    await admin.auth(request(app).patch(`/admin/api/partners/${pending.body.id}`)).send({ status: 'active' }).expect(200);
    const pid = pending.body.id as string;

    const manager = await signup('Rasmané Gestionnaire');
    await owner.auth(request(app).post(`/partners/${pid}/staff`)).send({ phone: manager.phone }).expect(201);

    // Plus de 2 groupes sans abonnement Pro : couverts par la licence partenaire.
    await manager.auth(request(app).post('/cagnottes')).send({ name: 'Caisse de solidarité', category: 'association', partnerId: pid }).expect(201);
    await manager.auth(request(app).post('/cagnottes')).send({ name: 'Caisse des fêtes', category: 'association', partnerId: pid }).expect(201);
    const t = await manager.auth(request(app).post('/tontines')).send({
      name: 'Tontine hebdo du marché', contributionAmount: 10_000, frequency: 'weekly', maxMembers: 3, partnerId: pid, visibility: 'public',
    }).expect(201);
    expect(t.body.partner_id).toBe(pid);

    const members = [await signup('Alimata'), await signup('Boukary'), await signup('Céline')];
    const pub = await members[0].auth(request(app).get('/tontines/public')).expect(200);
    const listed = pub.body.find((x: any) => x.id === t.body.id);
    expect(listed.partner).toMatchObject({ name: 'Tontine Wend-Kuuni', color: '#C0392B', logo: LOGO });
    for (const m of members) {
      await fund(m, 40_000);
      await m.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    }
    await members[0].auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(403);
    await manager.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(200);
    for (const round of [1, 2, 3]) {
      let last: any;
      for (const m of members) last = await m.auth(request(app).post(`/tontines/${t.body.id}/rounds/${round}/contribute`)).expect(201);
      expect(last.body).toMatchObject({ status: 'paid_out', pot: 30_000, commission: 300, managementFee: 600, net: 29_100 });
    }
    expect(await partnerBalance(pid)).toBe(1_800);

    const detail = await manager.auth(request(app).get(`/tontines/${t.body.id}`)).expect(200); // équipe non membre
    expect(detail.body).toMatchObject({ manager: true, me: null });
    expect(detail.body.partner.name).toBe('Tontine Wend-Kuuni');

    const dash = await owner.auth(request(app).get(`/partners/${pid}/dashboard`)).expect(200);
    expect(dash.body).toMatchObject({ balance: 1_800, managementFeesEarned: 1_800 });
    expect(dash.body.tontines).toHaveLength(1);
    expect(dash.body.coffres).toHaveLength(2);
    expect(dash.body.staff).toHaveLength(2);
    await members[0].auth(request(app).get(`/partners/${pid}/dashboard`)).expect(403);

    // Licence : forfait minimum de 10 000 F ; facture due puis réglée en alimentant le compte.
    await pool.query("UPDATE partners SET created_at = now() - interval '40 days' WHERE id = $1", [pid]);
    const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    expect(await invoicePartners(month)).toBeGreaterThanOrEqual(1);
    expect(await invoicePartners(month)).toBe(0); // une seule facture par mois
    let inv = (await owner.auth(request(app).get(`/partners/${pid}/dashboard`)).expect(200)).body.invoices[0];
    expect(inv).toMatchObject({ month, amount: 10_000, status: 'due' });
    await fund(owner, 20_000);
    await owner.auth(request(app).post(`/partners/${pid}/topup`)).send({ amount: 10_000 }).expect(200);
    inv = (await owner.auth(request(app).get(`/partners/${pid}/dashboard`)).expect(200)).body.invoices[0];
    expect(inv.status).toBe('paid');
    expect(await partnerBalance(pid)).toBe(1_800);

    await owner.auth(request(app).post(`/partners/${pid}/withdraw`)).send({ amount: 1_000, channel: 'orange_money', pin: '4826' }).expect(201);
    expect(await partnerBalance(pid)).toBe(1_800 - 1_000 - 100);
    expect(await ledgerBalanced()).toBe(true);
  });
});

describe('tontines de biens matériels', () => {
  it('finance un bien du catalogue par une tontine de groupe, via séquestre, jusqu\'au paiement du fournisseur', async () => {
    const commercant = await signup('Ets Ouédraogo Équipement');
    const pid = await approvedPartner(commercant, { name: 'Ets Ouédraogo Équipement', type: 'commercant', city: 'Ouagadougou' });
    const good = await commercant.auth(request(app).post(`/goods/partners/${pid}`))
      .send({ name: 'Réfrigérateur 150 L', category: 'electromenager', price: 90_000, stock: 5 }).expect(201);
    const catalog = await commercant.auth(request(app).get('/goods?category=electromenager')).expect(200);
    expect(catalog.body.some((g: any) => g.id === good.body.id && g.partner.name === 'Ets Ouédraogo Équipement')).toBe(true);

    const [a, b, c] = [await signup('Djénéba'), await signup('Ousséni'), await signup('Pascaline')];
    for (const u of [a, b, c]) await fund(u, 150_000);
    const t = await a.auth(request(app).post('/tontines'))
      .send({ name: 'Tontine frigo', kind: 'bien', goodId: good.body.id, frequency: 'monthly', maxMembers: 3, orderMode: 'fixed', visibility: 'public' }).expect(201);
    // Cotisation calculée pour que le pot net couvre le prix : 90 000 / (3 × 0,99) arrondi aux 25 F.
    expect(t.body).toMatchObject({ kind: 'bien', good_label: 'Réfrigérateur 150 L', good_price: 90_000, contribution_amount: 30_325 });
    await b.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    await a.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({ order: [a.id, b.id] }).expect(400); // pas complète
    await c.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    await a.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({ order: [a.id, b.id, c.id] }).expect(200);

    // Pas d'avance sur une tontine de biens.
    const offers = await c.auth(request(app).get('/credit/offers')).expect(200);
    expect(offers.body.advances.some((o: any) => o.tontineId === t.body.id)).toBe(false);

    const before = await balance(a);
    let payout: any;
    for (const u of [a, b, c]) payout = await u.auth(request(app).post(`/tontines/${t.body.id}/rounds/1/contribute`)).expect(201);
    expect(payout.body.orderId).toBeTruthy();
    expect(await balance(a)).toBe(before - 30_325 + (90_975 - 910) - 90_000); // le reste du pot reste sur le jeton
    expect(await sys('SYS_ESCROW')).toBe(90_000);

    const orders = await a.auth(request(app).get('/goods/orders')).expect(200);
    expect(orders.body[0]).toMatchObject({ status: 'pending', amount: 90_000, good_name: 'Réfrigérateur 150 L' });
    await a.auth(request(app).post(`/goods/orders/${orders.body[0].id}/ship`)).send({}).expect(403);
    await commercant.auth(request(app).post(`/goods/orders/${orders.body[0].id}/ship`)).send({ note: 'Livré à Tanghin' }).expect(200);
    const done = await a.auth(request(app).post(`/goods/orders/${orders.body[0].id}/confirm`)).send({ pin: '4826' }).expect(200);
    expect(done.body).toMatchObject({ status: 'delivered', paidToSupplier: 87_300, commission: 2_700 });
    expect(await partnerBalance(pid)).toBe(87_300);
    expect(await sys('SYS_ESCROW')).toBe(0);
    const stock = await pool.query('SELECT stock FROM goods WHERE id = $1', [good.body.id]);
    expect(stock.rows[0].stock).toBe(4);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('accepte un bien libre (nom + prix) : le pot est versé au bénéficiaire pour l\'acheter', async () => {
    const [a, b] = [await signup('Nafissatou'), await signup('Hamidou')];
    for (const u of [a, b]) await fund(u, 100_000);
    const t = await a.auth(request(app).post('/tontines'))
      .send({ name: 'Moulin à grains', kind: 'bien', goodLabel: 'Moulin à grains', goodPrice: 60_000, frequency: 'monthly', maxMembers: 2 }).expect(201);
    expect(t.body.contribution_amount).toBe(30_325);
    await a.auth(request(app).post('/tontines')).send({ name: 'Sans prix', kind: 'bien', frequency: 'monthly', maxMembers: 2 }).expect(400);
    await b.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    await a.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(200);
    let r: any;
    for (const u of [a, b]) r = await u.auth(request(app).post(`/tontines/${t.body.id}/rounds/1/contribute`)).expect(201);
    expect(r.body).toMatchObject({ status: 'paid_out', orderId: null });
    expect(r.body.net).toBeGreaterThanOrEqual(60_000);
  });
});

describe('plans d\'achat individuels', () => {
  it('libère l\'épargne quand l\'objectif est atteint (bien libre)', async () => {
    const u = await signup('Aïcha');
    await fund(u, 60_000);
    const plan = await u.auth(request(app).post('/goods/plans')).send({ label: 'Machine à coudre', targetAmount: 40_000, frequency: 'weekly', installmentAmount: 5_000 }).expect(201);
    const p1 = await u.auth(request(app).post(`/goods/plans/${plan.body.id}/pay`)).send({ amount: 25_000 }).expect(200);
    expect(p1.body).toMatchObject({ status: 'active', progress: 63 });
    const p2 = await u.auth(request(app).post(`/goods/plans/${plan.body.id}/pay`)).send({ amount: 20_000 }).expect(200);
    expect(p2.body).toMatchObject({ status: 'completed', released: 40_000 });
    expect(await balance(u)).toBe(60_000);
  });

  it('commande automatiquement un bien du catalogue, puis rembourse si le fournisseur annule', async () => {
    const vendeur = await signup('Boutique Faso Moto');
    const pid = await approvedPartner(vendeur, { name: 'Faso Moto', type: 'commercant' });
    const good = await vendeur.auth(request(app).post(`/goods/partners/${pid}`)).send({ name: 'Téléphone Android', category: 'telephone', price: 45_000 }).expect(201);
    const u = await signup('Ibrahim');
    await fund(u, 50_000);
    const plan = await u.auth(request(app).post('/goods/plans')).send({ goodId: good.body.id, frequency: 'monthly' }).expect(201);
    expect(plan.body).toMatchObject({ label: 'Téléphone Android', target_amount: 45_000 });
    const paid = await u.auth(request(app).post(`/goods/plans/${plan.body.id}/pay`)).send({ amount: 50_000 }).expect(200);
    expect(paid.body.status).toBe('completed');
    expect(await balance(u)).toBe(5_000);
    await vendeur.auth(request(app).post(`/goods/orders/${paid.body.orderId}/cancel`)).send({ reason: 'Rupture de stock' }).expect(200);
    expect(await balance(u)).toBe(50_000);
    expect(await ledgerBalanced()).toBe(true);
  });

  it('confirme automatiquement une commande expédiée sans réclamation après 7 jours', async () => {
    const vendeur = await signup('Quincaillerie du Centre');
    const pid = await approvedPartner(vendeur, { name: 'Quincaillerie du Centre', type: 'commercant' });
    const good = await vendeur.auth(request(app).post(`/goods/partners/${pid}`)).send({ name: 'Brouette', category: 'materiel_pro', price: 20_000 }).expect(201);
    const u = await signup('Karim');
    await fund(u, 20_000);
    const plan = await u.auth(request(app).post('/goods/plans')).send({ goodId: good.body.id }).expect(201);
    const paid = await u.auth(request(app).post(`/goods/plans/${plan.body.id}/pay`)).send({ amount: 20_000 }).expect(200);
    await vendeur.auth(request(app).post(`/goods/orders/${paid.body.orderId}/ship`)).send({}).expect(200);
    await pool.query("UPDATE goods_orders SET shipped_at = now() - interval '8 days' WHERE id = $1", [paid.body.orderId]);
    const jobs = await runJobs();
    expect(jobs.ordersAutoConfirmed).toBe(1);
    expect(await partnerBalance(pid)).toBe(19_400);
    expect(await ledgerBalanced()).toBe(true);
  });
});
