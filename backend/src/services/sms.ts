import { createHmac } from 'node:crypto';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../lib/errors.js';

// Envoi des SMS (OTP, rappels) : Orange SMS API au Burkina en priorité, Twilio en secours pour les
// autres pays ou en cas de panne. Chaque envoi est journalisé (sms_log) avec son accusé de réception.

export type SmsKind = 'otp' | 'reminder' | 'notification';

export interface SmsSender {
  name: string;
  /** Pays servis (indicatifs). Absent : tous. */
  prefixes?: string[];
  send(phone: string, text: string, logId: string): Promise<{ providerRef?: string }>;
}

// ───── Encodage : rester en GSM 03.38 (160 caractères) plutôt qu'en UCS-2 (70) ─────
const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXT = '^{}\\[~]|€';
const REPLACE: Record<string, string> = {
  'â': 'a', 'á': 'a', 'ã': 'a', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'í': 'i', 'ô': 'o', 'ó': 'o', 'õ': 'o', 'û': 'u', 'ú': 'u',
  'ç': 'c', 'ÿ': 'y', 'À': 'A', 'Â': 'A', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Î': 'I', 'Ï': 'I', 'Ô': 'O', 'Ù': 'U', 'Û': 'U',
  'œ': 'oe', 'Œ': 'OE', '’': "'", '‘': "'", '«': '"', '»': '"', '“': '"', '”': '"', '–': '-', '—': '-', '…': '...',
  ' ': ' ', ' ': ' ',
};

/** Translittère vers l'alphabet GSM 7 bits (accents français, guillemets typographiques) ; retire les émojis. */
export function toGsm7(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (GSM7.includes(ch) || GSM7_EXT.includes(ch)) out += ch;
    else if (REPLACE[ch] !== undefined) out += REPLACE[ch];
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (base.length === 1 && GSM7.includes(base)) out += base;
    }
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

export function segmentsOf(text: string): { segments: number; encoding: 'gsm7' | 'ucs2' } {
  const gsm = [...text].every((c) => GSM7.includes(c) || GSM7_EXT.includes(c));
  if (gsm) {
    const len = [...text].reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0);
    return { segments: len <= 160 ? 1 : Math.ceil(len / 153), encoding: 'gsm7' };
  }
  const len = text.length; // unités UTF-16
  return { segments: len <= 70 ? 1 : Math.ceil(len / 67), encoding: 'ucs2' };
}

// ───── Fournisseurs ─────
const consoleSender: SmsSender = {
  name: 'console',
  async send(phone, text) { if (config.env !== 'test') console.log(`[SMS → ${phone}] ${text}`); return {}; },
};

/** Orange SMS API « Afrique et Moyen-Orient » (developer.orange.com/apis/sms) : OAuth client_credentials, jeton 1 h. */
export function orangeSender(opts: { clientId: string; clientSecret: string; senderAddress: string; senderName?: string;
  countryPrefix: string; receiptUrl?: string; baseUrl?: string }): SmsSender {
  const base = opts.baseUrl ?? 'https://api.orange.com';
  let token: { value: string; expires: number } | undefined;
  async function getToken(force = false) {
    if (!force && token && token.expires > Date.now()) return token.value;
    const res = await fetch(`${base}/oauth/v3/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded', accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Orange SMS : authentification refusée (${res.status})`);
    const data = (await res.json()) as { access_token: string; expires_in: string | number };
    token = { value: data.access_token, expires: Date.now() + (Number(data.expires_in) - 60) * 1000 };
    return token.value;
  }
  return {
    name: 'orange',
    prefixes: [opts.countryPrefix],
    async send(phone, text, logId) {
      const sender = encodeURIComponent(opts.senderAddress);
      const body = JSON.stringify({ outboundSMSMessageRequest: {
        address: `tel:${phone}`, senderAddress: opts.senderAddress,
        ...(opts.senderName ? { senderName: opts.senderName } : {}),
        outboundSMSTextMessage: { message: text },
        clientCorrelator: logId.replace(/-/g, '').slice(0, 30),
        ...(opts.receiptUrl ? { receiptRequest: { notifyURL: opts.receiptUrl, callbackData: logId } } : {}),
      } });
      const post = async (t: string) => fetch(`${base}/smsmessaging/v1/outbound/${sender}/requests`, {
        method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body,
        signal: AbortSignal.timeout(10_000),
      });
      let res = await post(await getToken());
      if (res.status === 401) res = await post(await getToken(true)); // jeton expiré
      if (!res.ok) throw new Error(`Orange SMS : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { outboundSMSMessageRequest?: { resourceURL?: string } };
      return { providerRef: data.outboundSMSMessageRequest?.resourceURL?.split('/').pop() ?? logId };
    },
  };
}

/** Twilio Programmable Messaging (POST /2010-04-01/Accounts/{sid}/Messages.json). */
export function twilioSender(opts: { accountSid: string; authToken: string; from?: string; messagingServiceSid?: string;
  statusCallback?: string; baseUrl?: string }): SmsSender {
  const base = opts.baseUrl ?? 'https://api.twilio.com';
  return {
    name: 'twilio',
    async send(phone, text) {
      const form = new URLSearchParams({ To: phone, Body: text });
      if (opts.messagingServiceSid) form.set('MessagingServiceSid', opts.messagingServiceSid);
      else if (opts.from) form.set('From', opts.from);
      if (opts.statusCallback) form.set('StatusCallback', opts.statusCallback);
      const res = await fetch(`${base}/2010-04-01/Accounts/${opts.accountSid}/Messages.json`, {
        method: 'POST',
        headers: { authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
      if (!res.ok) throw new Error(`Twilio : ${data.code ?? res.status} ${data.message ?? ''}`.trim());
      return { providerRef: data.sid };
    },
  };
}

/** Signature X-Twilio-Signature : HMAC-SHA1 (jeton du compte) de l'URL suivie des paramètres triés, en base64. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

// ───── Sélection et envoi ─────
function fromEnv(): SmsSender[] {
  const api = process.env.PUBLIC_API_URL ?? 'https://api.smarttontine.app';
  const names = config.smsProvider.split(',').map((s) => s.trim()).filter(Boolean);
  return names.map((name) => {
    if (name === 'orange') {
      if (!process.env.ORANGE_SMS_CLIENT_ID || !process.env.ORANGE_SMS_CLIENT_SECRET) throw new Error('SMS_PROVIDER=orange : ORANGE_SMS_CLIENT_ID et ORANGE_SMS_CLIENT_SECRET sont obligatoires');
      return orangeSender({
        clientId: process.env.ORANGE_SMS_CLIENT_ID, clientSecret: process.env.ORANGE_SMS_CLIENT_SECRET,
        senderAddress: process.env.ORANGE_SMS_SENDER ?? 'tel:+2260000', senderName: process.env.ORANGE_SMS_SENDER_NAME || undefined,
        countryPrefix: process.env.ORANGE_SMS_COUNTRY_PREFIX ?? '+226',
        receiptUrl: process.env.SMS_WEBHOOK_TOKEN ? `${api}/webhooks/sms/orange/${process.env.SMS_WEBHOOK_TOKEN}` : undefined,
      });
    }
    if (name === 'twilio') {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) throw new Error('SMS_PROVIDER=twilio : TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont obligatoires');
      return twilioSender({
        accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM || undefined, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || undefined,
        statusCallback: `${api}/webhooks/sms/twilio`,
      });
    }
    if (name === 'console') return consoleSender;
    throw new Error(`SMS_PROVIDER inconnu : ${name}`);
  });
}

let senders: SmsSender[] | undefined;
export function setSmsSenders(list: SmsSender[] | undefined) { senders = list; }
const chain = () => (senders ??= fromEnv());

/**
 * Envoie un SMS par le premier fournisseur qui sert ce numéro, puis les suivants en secours.
 * Un OTP non envoyé est une erreur (l'utilisateur doit le savoir) ; un rappel non envoyé est seulement journalisé.
 */
export async function sendSms(phone: string, text: string, kind: SmsKind = 'notification') {
  const body = toGsm7(text);
  const { segments, encoding } = segmentsOf(body);
  const stored = kind === 'otp' ? body.replace(/\d{4,8}/g, '••••••') : body;
  const log = (await pool.query(
    'INSERT INTO sms_log (phone, kind, body, segments, encoding) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [phone, kind, stored, segments, encoding])).rows[0];
  const attempts: { provider: string; error: string }[] = [];
  for (const s of chain().filter((s) => !s.prefixes || s.prefixes.some((p) => phone.startsWith(p)))) {
    try {
      const r = await s.send(phone, body, log.id);
      await pool.query("UPDATE sms_log SET status = 'sent', provider = $2, provider_ref = $3, attempts = $4 WHERE id = $1",
        [log.id, s.name, r.providerRef ?? null, JSON.stringify(attempts)]);
      return { id: log.id as string, provider: s.name, segments };
    } catch (e) {
      attempts.push({ provider: s.name, error: String((e as Error).message).slice(0, 300) });
    }
  }
  await pool.query("UPDATE sms_log SET status = 'failed', error = $2, attempts = $3 WHERE id = $1",
    [log.id, attempts.at(-1)?.error ?? 'aucun fournisseur pour ce numéro', JSON.stringify(attempts)]);
  console.error(`SMS non envoyé (${kind}) vers ${phone.slice(0, 7)}…`, attempts);
  if (kind === 'otp') throw new HttpError(503, 'sms_unavailable', 'Impossible d\'envoyer le SMS pour le moment. Réessaie dans un instant.');
  return { id: log.id as string, provider: undefined, segments };
}

/** Accusé de réception : met à jour le journal (statuts finaux uniquement, jamais de retour en arrière). */
export async function recordDelivery(provider: string, ref: { logId?: string; providerRef?: string }, delivered: boolean, detail?: string) {
  const status = delivered ? 'delivered' : 'undelivered';
  const r = await pool.query(
    `UPDATE sms_log SET status = $1::text, delivered_at = CASE WHEN $1::text = 'delivered' THEN now() END, error = COALESCE($4, error)
     WHERE provider = $2 AND status = 'sent' AND ${ref.logId ? 'id::text = $3' : 'provider_ref = $3'}`,
    [status, provider, ref.logId ?? ref.providerRef, detail ?? null]);
  return r.rowCount ?? 0;
}

/** Compatibilité : `sms.send(phone, text)` pour les appels existants. */
export const sms = { send: (phone: string, text: string, kind: SmsKind = 'notification') => sendSms(phone, text, kind) };
