import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { runJobs } from '../src/jobs.js';
import { app, fund, resetDb, signup } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => { await pool.end(); });

describe('coffres de groupe (associations, dahiras…)', () => {
  it('se rejoint par code quand il est public et suit les cotisations payées / partielles / impayées', async () => {
    const [tresoriere, membre, absent, curieux] = [await signup('Ndeye'), await signup('Modou'), await signup('Astou'), await signup('Pape')];
    for (const u of [tresoriere, membre]) await fund(u, 20_000);
    const c = await tresoriere.auth(request(app).post('/cagnottes')).send({
      name: 'Dahira des Parcelles', category: 'dahira', visibility: 'public', frequency: 'monthly', contributionAmount: 5_000,
    }).expect(201);
    const preview = await membre.auth(request(app).get(`/cagnottes/${c.body.id}/preview`)).expect(200);
    expect(preview.body).toMatchObject({ category: 'dahira', members: 1 });
    for (const u of [membre, absent]) await u.auth(request(app).post(`/cagnottes/${c.body.id}/join`)).expect(201);
    await membre.auth(request(app).post(`/cagnottes/${c.body.id}/join`)).expect(409);

    await tresoriere.auth(request(app).post(`/cagnottes/${c.body.id}/contribute`)).send({ amount: 5_000 }).expect(201);
    await membre.auth(request(app).post(`/cagnottes/${c.body.id}/contribute`)).send({ amount: 2_000 }).expect(201);

    const table = await tresoriere.auth(request(app).get(`/cagnottes/${c.body.id}/cotisations?periods=3`)).expect(200);
    const current = (name: string) => table.body.members.find((m: any) => m.name === name).periods.at(-1);
    expect(table.body.members[0].periods).toHaveLength(3);
    expect(current('Ndeye')).toMatchObject({ paid: 5_000, status: 'paye' });
    expect(current('Modou')).toMatchObject({ paid: 2_000, status: 'partiel' });
    expect(current('Astou')).toMatchObject({ paid: 0, status: 'impaye' });
    // Les mois précédant l'adhésion ne comptent pas comme impayés.
    expect(table.body.members.find((m: any) => m.name === 'Astou').periods[0].status).toBe('na');
    await curieux.auth(request(app).get(`/cagnottes/${c.body.id}/cotisations`)).expect(404);
  });

  it('refuse de rejoindre un coffre privé sans invitation', async () => {
    const [a, b] = [await signup('Fatim'), await signup('Ibou')];
    const c = await a.auth(request(app).post('/cagnottes')).send({ name: 'Famille Diop', category: 'famille' }).expect(201);
    await b.auth(request(app).post(`/cagnottes/${c.body.id}/join`)).expect(403);
  });
});

describe('rappels automatiques', () => {
  it('prévient la veille les membres qui n\'ont pas cotisé, une seule fois', async () => {
    const [a, b, c] = [await signup('Mame'), await signup('Khady'), await signup('Serigne')];
    for (const u of [a, b, c]) await fund(u, 50_000);
    const t = await a.auth(request(app).post('/tontines')).send({ name: 'Tontine du marché', contributionAmount: 10_000, frequency: 'weekly', maxMembers: 3 }).expect(201);
    for (const u of [b, c]) await u.auth(request(app).post(`/tontines/${t.body.id}/join`)).expect(201);
    await a.auth(request(app).post(`/tontines/${t.body.id}/start`)).send({}).expect(200);
    await pool.query('UPDATE tontine_rounds SET due_date = CURRENT_DATE + 1 WHERE tontine_id = $1 AND number = 1', [t.body.id]);
    await a.auth(request(app).post(`/tontines/${t.body.id}/rounds/1/contribute`)).expect(201);

    const first = await runJobs();
    expect(first.reminders).toBe(2);
    const second = await runJobs();
    expect(second.reminders).toBe(0);
    const notifs = await b.auth(request(app).get('/me/notifications')).expect(200);
    expect(notifs.body.some((n: any) => n.title === 'Rappel de cotisation' && n.body.includes('demain'))).toBe(true);
  });
});
