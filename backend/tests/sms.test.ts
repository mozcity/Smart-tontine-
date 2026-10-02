import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db.js';
import { orangeSender, segmentsOf, setSmsSenders, toGsm7, twilioSender, twilioSignature } from '../src/services/sms.js';
import { app, resetDb } from './helpers.js';

/** Faux Orange SMS API + faux Twilio, mêmes routes et formats que les API réelles. */
const fake = { orangeDown: false, orangeTokens: 0, expireOrange: false, twilioDown: false, orange: [] as any[], twilio: [] as URLSearchParams[] };
let server: Server;
let base = '';

beforeAll(async () => {
  await resetDb();
  server = createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const send = (code: number, data: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url === '/oauth/v3/token') {
      if (req.headers.authorization !== `Basic ${Buffer.from('cid:csecret').toString('base64')}` || raw !== 'grant_type=client_credentials') return send(401, {});
      fake.orangeTokens++;
      return send(200, { token_type: 'Bearer', access_token: `ot-${fake.orangeTokens}`, expires_in: '3600' });
    }
    if (req.url?.startsWith('/smsmessaging/v1/outbound/tel%3A%2B2260000/requests')) {
      if (fake.orangeDown) return send(503, { requestError: { serviceException: { messageId: 'SVC0001' } } });
      if (fake.expireOrange || req.headers.authorization !== `Bearer ot-${fake.orangeTokens}`) { fake.expireOrange = false; return send(401, { code: 42 }); }
      const body = JSON.parse(raw);
      fake.orange.push(body);
      return send(201, { outboundSMSMessageRequest: { ...body.outboundSMSMessageRequest, resourceURL: `${base}/smsmessaging/v1/outbound/tel%3A%2B2260000/requests/OR-${fake.orange.length}` } });
    }
    if (req.url === '/2010-04-01/Accounts/AC123/Messages.json') {
      if (fake.twilioDown) return send(500, { code: 20500, message: 'Internal Server Error' });
      const form = new URLSearchParams(raw);
      fake.twilio.push(form);
      return send(201, { sid: `SM${fake.twilio.length}`, status: 'queued', num_segments: '1' });
    }
    send(404, {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.SMS_WEBHOOK_TOKEN = 'jeton-accuses-orange-0123456789';
  process.env.TWILIO_AUTH_TOKEN = 'twilio-auth-token';
  process.env.PUBLIC_API_URL = 'https://api.smarttontine.test';
  setSmsSenders([
    orangeSender({ clientId: 'cid', clientSecret: 'csecret', senderAddress: 'tel:+2260000', senderName: 'SmartTontine', countryPrefix: '+226',
      receiptUrl: 'https://api.smarttontine.test/webhooks/sms/orange/x', baseUrl: base }),
    twilioSender({ accountSid: 'AC123', authToken: 'twilio-auth-token', from: '+15005550006',
      statusCallback: 'https://api.smarttontine.test/webhooks/sms/twilio', baseUrl: base }),
  ]);
});
afterEach(() => { fake.orangeDown = false; fake.twilioDown = false; });
afterAll(async () => { setSmsSenders(undefined); server.close(); await pool.end(); });

const lastLog = async () => (await pool.query('SELECT * FROM sms_log ORDER BY created_at DESC LIMIT 1')).rows[0];

describe('SMS', () => {
  it('reste en GSM 7 bits sur un seul SMS : accents, guillemets, émojis', () => {
    const t = toGsm7('Smart Tontine : ta cotisation de 5 000 F est due demain à « Tontine des mamans » — tu es prête ? 🎉');
    expect(t).toBe('Smart Tontine : ta cotisation de 5 000 F est due demain à " Tontine des mamans " - tu es prete ?');
    expect(segmentsOf(t)).toEqual({ segments: 1, encoding: 'gsm7' });
    expect(segmentsOf('é'.repeat(161)).segments).toBe(2);
    expect(segmentsOf('€'.repeat(80)).segments).toBe(1); // caractère étendu compté double
    expect(segmentsOf('漢'.repeat(71))).toEqual({ segments: 2, encoding: 'ucs2' });
  });

  it('OTP au Burkina : Orange, jeton en cache et renouvelé, code jamais journalisé', async () => {
    const phone = '+22670000001';
    const r = await request(app).post('/auth/otp/request').send({ phone }).expect(200);
    const sent = fake.orange.at(-1).outboundSMSMessageRequest;
    expect(sent).toMatchObject({ address: `tel:${phone}`, senderAddress: 'tel:+2260000', senderName: 'SmartTontine' });
    expect(sent.outboundSMSTextMessage.message).toContain(r.body.devCode);
    const log = await lastLog();
    expect(log).toMatchObject({ provider: 'orange', status: 'sent', kind: 'otp', segments: 1, encoding: 'gsm7' });
    expect(log.body).not.toContain(r.body.devCode);
    expect(sent.receiptRequest.callbackData).toBe(log.id);

    const tokens = fake.orangeTokens;
    await request(app).post('/auth/otp/request').send({ phone: '+22670000002' }).expect(200);
    expect(fake.orangeTokens).toBe(tokens); // jeton réutilisé
    fake.expireOrange = true;
    await request(app).post('/auth/otp/request').send({ phone: '+22670000003' }).expect(200);
    expect(fake.orangeTokens).toBe(tokens + 1); // 401 → nouveau jeton, nouvel essai
  });

  it('bascule sur Twilio si Orange est en panne, et pour les autres pays', async () => {
    fake.orangeDown = true;
    await request(app).post('/auth/otp/request').send({ phone: '+22670000004' }).expect(200);
    let log = await lastLog();
    expect(log).toMatchObject({ provider: 'twilio', status: 'sent', provider_ref: `SM${fake.twilio.length}` });
    expect(log.attempts[0]).toMatchObject({ provider: 'orange' });
    expect(fake.twilio.at(-1)!.get('StatusCallback')).toBe('https://api.smarttontine.test/webhooks/sms/twilio');

    fake.orangeDown = false;
    const before = fake.orange.length;
    await request(app).post('/auth/otp/request').send({ phone: '+2250700000005' }).expect(200);
    expect(fake.orange.length).toBe(before); // Orange Burkina ne sert pas la Côte d'Ivoire
    log = await lastLog();
    expect(log.provider).toBe('twilio');
  });

  it('OTP impossible à envoyer : erreur explicite (503) et échec journalisé', async () => {
    fake.orangeDown = true; fake.twilioDown = true;
    const r = await request(app).post('/auth/otp/request').send({ phone: '+22670000006' }).expect(503);
    expect(r.body.error).toBe('sms_unavailable');
    const log = await lastLog();
    expect(log.status).toBe('failed');
    expect(log.attempts).toHaveLength(2);
  });

  it('accusés de réception : Orange par jeton secret, Twilio par signature', async () => {
    await request(app).post('/auth/otp/request').send({ phone: '+22670000007' }).expect(200);
    const orangeLog = await lastLog();
    const dr = { deliveryInfoNotification: { callbackData: orangeLog.id, deliveryInfo: { address: 'tel:+22670000007', deliveryStatus: 'DeliveredToTerminal' } } };
    await request(app).post('/webhooks/sms/orange/mauvais-jeton').send(dr).expect(401);
    await request(app).post(`/webhooks/sms/orange/${process.env.SMS_WEBHOOK_TOKEN}`).send(dr).expect(200);
    expect((await pool.query('SELECT status, delivered_at FROM sms_log WHERE id = $1', [orangeLog.id])).rows[0].status).toBe('delivered');

    await request(app).post('/auth/otp/request').send({ phone: '+2250700000008' }).expect(200);
    const tw = await lastLog();
    const params = { MessageSid: tw.provider_ref, MessageStatus: 'undelivered', ErrorCode: '30005' };
    const url = 'https://api.smarttontine.test/webhooks/sms/twilio';
    await request(app).post('/webhooks/sms/twilio').type('form').set('x-twilio-signature', 'faux').send(params).expect(401);
    await request(app).post('/webhooks/sms/twilio').type('form')
      .set('x-twilio-signature', twilioSignature('twilio-auth-token', url, params)).send(params).expect(200);
    expect((await pool.query('SELECT status, error FROM sms_log WHERE id = $1', [tw.id])).rows[0]).toEqual({ status: 'undelivered', error: 'Twilio 30005' });
  });
});
