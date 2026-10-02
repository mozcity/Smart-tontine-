import { HttpError } from '../../lib/errors.js';
import type { Channel, PaymentProvider, VerificationResult } from './types.js';

// Intégration CinetPay, API v1 (agrégateur UEMOA : Orange Money, Moov, Wave, MTN…).
// Référence : SDK officiel github.com/cinetpay/cinetpay-go (endpoints /v1/oauth/login, /v1/payment, /v1/transfer).
// Identifiants par pays ; la clé « sk_test_… » cible le bac à sable, « sk_live_… » la production.

const SANDBOX_URL = 'https://api.cinetpay.net';
const LIVE_URL = 'https://api.cinetpay.co';
const TOKEN_TTL_MS = 23 * 3600_000; // jeton valable 24 h côté CinetPay
const TIMEOUT_MS = 20_000;

/** Indicatif → pays CinetPay. */
const COUNTRIES: Record<string, string> = {
  '+226': 'BF', '+225': 'CI', '+221': 'SN', '+223': 'ML', '+228': 'TG', '+229': 'BJ', '+227': 'NE',
};

/** Moyens de paiement ouverts par pays (constantes du SDK). */
const METHODS: Record<string, string[]> = {
  BF: ['OM_BF', 'MOOV_BF', 'WAVE_BF'],
  CI: ['OM_CI', 'MOOV_CI', 'MTN_CI', 'WAVE_CI'],
  SN: ['OM_SN', 'FREE_SN', 'EXPRESSO_SN', 'WAVE_SN'],
  ML: ['OM_ML', 'MOOV_ML'],
  TG: ['MOOV_TG', 'TMONEY_TG'],
  BJ: ['MOOV_BJ', 'MTN_BJ'],
  NE: ['AIRTEL_NE', 'MOOV_NE', 'ZAMANI_NE'],
};
const OPERATOR: Record<Exclude<Channel, 'card'>, string> = { orange_money: 'OM', moov_money: 'MOOV', wave: 'WAVE', mtn_momo: 'MTN' };

const SUCCESS_CODES = new Set([100, 200, 2001, 2002]);
/** Statuts de transaction : une réponse qui en porte un décrit l'opération, ce n'est pas une erreur d'appel. */
const TX_STATUSES = new Set(['SUCCESS', 'FAILED', 'PENDING', 'INITIATED', 'INSUFFICIENT_BALANCE', 'TRANSACTION_EXIST']);
const FINAL_OK = new Set(['SUCCESS']);
const FINAL_KO = new Set(['FAILED', 'INSUFFICIENT_BALANCE', 'CANCELED', 'CANCELLED', 'REFUSED', 'EXPIRED']);

export function countryOf(phone: string): string | undefined {
  const p = phone.replace(/\s/g, '');
  return COUNTRIES[p.slice(0, 4)];
}

/** Moyen de paiement CinetPay pour un canal et un numéro, ou undefined si l'opérateur n'est pas servi dans ce pays. */
export function paymentMethod(channel: Channel, phone: string): string | undefined {
  const country = countryOf(phone);
  if (!country || channel === 'card') return undefined;
  const m = `${OPERATOR[channel]}_${country}`;
  return METHODS[country]?.includes(m) ? m : undefined;
}

export class CinetPayError extends Error {
  constructor(public code: number | undefined, public status: string | undefined, message: string, public httpStatus?: number) {
    super(`CinetPay ${code ?? httpStatus ?? ''} ${status ?? ''} : ${message}`.trim());
  }
}

export interface CinetPayOptions {
  /** Identifiants par pays (BF, CI…). */
  credentials: Record<string, { apiKey: string; apiPassword: string }>;
  notifyUrl: string;
  successUrl: string;
  failedUrl: string;
  /** Surcharge de l'URL (tests, proxy). Sinon déduite du préfixe de la clé. */
  baseUrl?: string;
}

export function cinetpayProvider(opts: CinetPayOptions): PaymentProvider {
  const tokens = new Map<string, { token: string; expires: number }>();
  const inflight = new Map<string, Promise<string>>();

  const creds = (country: string) => {
    const c = opts.credentials[country];
    if (!c) throw new HttpError(400, 'country_not_supported', `Paiements non ouverts pour ce pays (${country})`);
    return c;
  };
  const baseUrl = (country: string) =>
    opts.baseUrl ?? (creds(country).apiKey.startsWith('sk_live_') ? LIVE_URL : SANDBOX_URL);

  async function call(country: string, method: 'GET' | 'POST', path: string, body?: unknown, token?: string) {
    const res = await fetch(baseUrl(country) + path, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    const code = data.code !== undefined ? Number(data.code) : undefined;
    // Même règle que le SDK : erreur si HTTP ≥ 400, ou code inattendu accompagné d'une description.
    if (res.status >= 400 || (code !== undefined && !SUCCESS_CODES.has(code) && (data.description || data.message) && !TX_STATUSES.has(String(data.status).toUpperCase()))) {
      throw new CinetPayError(code, data.status, String(data.description ?? data.message ?? 'erreur'), res.status);
    }
    return data;
  }

  async function login(country: string): Promise<string> {
    const pending = inflight.get(country);
    if (pending) return pending;
    const p = (async () => {
      const { apiKey, apiPassword } = creds(country);
      let data: Record<string, any>;
      try {
        data = await call(country, 'POST', '/v1/oauth/login', { api_key: apiKey, api_password: apiPassword });
      } catch (e) {
        // Ne jamais laisser fuiter les identifiants dans les journaux.
        throw new CinetPayError((e as CinetPayError).code, undefined, `authentification refusée (${country})`);
      }
      const token = data.access_token ?? data.data?.access_token;
      if (!token) throw new CinetPayError(data.code, data.status, 'jeton absent de la réponse');
      tokens.set(country, { token, expires: Date.now() + TOKEN_TTL_MS });
      return token as string;
    })();
    inflight.set(country, p);
    try { return await p; } finally { inflight.delete(country); }
  }

  /** Appel authentifié ; un jeton expiré (1002/1003) est renouvelé une fois. */
  async function authed(country: string, method: 'GET' | 'POST', path: string, body?: unknown) {
    const cached = tokens.get(country);
    const token = cached && cached.expires > Date.now() ? cached.token : await login(country);
    try {
      return await call(country, method, path, body, token);
    } catch (e) {
      if (e instanceof CinetPayError && (e.code === 1003 || e.code === 1002 || e.httpStatus === 401)) {
        tokens.delete(country);
        return call(country, method, path, body, await login(country));
      }
      throw e;
    }
  }

  const toVerdict = (data: Record<string, any>): VerificationResult => {
    const st = String(data.status ?? '').toUpperCase();
    const code = Number(data.code);
    const status = FINAL_OK.has(st) || code === 100 ? 'success' : FINAL_KO.has(st) || code === 2010 || code === 2005 ? 'failed' : 'pending';
    const amount = data.amount !== undefined && data.amount !== '' ? Number(data.amount) : undefined;
    return { status, amount: Number.isFinite(amount) ? amount : undefined, providerRef: data.transaction_id || undefined };
  };

  // Le pays (donc les identifiants) d'une vérification se déduit du numéro enregistré avec l'opération.
  const defaultCountry = Object.keys(opts.credentials)[0];
  const refCountry = (phone?: string) => (phone && countryOf(phone)) || defaultCountry;

  return {
    name: 'cinetpay',
    limits: { collect: 2_500_000, payout: 1_500_000 },

    supports(channel, phone, direction) {
      const country = countryOf(phone);
      if (!country || !opts.credentials[country]) return false;
      if (channel === 'card') return direction === 'collect';
      return paymentMethod(channel, phone) !== undefined;
    },

    async collect(req) {
      const country = countryOf(req.phone);
      if (!country) throw new HttpError(400, 'country_not_supported', 'Numéro hors zone couverte');
      const method = paymentMethod(req.channel, req.phone);
      const digits = req.phone.replace(/\D/g, '');
      const data = await authed(country, 'POST', '/v1/payment', {
        currency: 'XOF',
        merchant_transaction_id: req.reference,
        amount: req.amount,
        lang: 'fr',
        designation: req.description.slice(0, 100),
        client_email: req.customer?.email ?? `client${digits}@smarttontine.app`,
        client_first_name: (req.customer?.firstName || 'Client').padEnd(2, '.'),
        client_last_name: (req.customer?.lastName || 'Smart Tontine').padEnd(2, '.'),
        success_url: opts.successUrl,
        failed_url: opts.failedUrl,
        notify_url: opts.notifyUrl,
        channel: 'PUSH',
        ...(method ? { payment_method: method, client_phone_number: req.phone } : {}),
      });
      return { providerRef: data.transaction_id ?? data.payment_token, paymentUrl: data.payment_url, notifyToken: data.notify_token };
    },

    async verify(reference, hint) {
      return toVerdict(await authed(refCountry(hint?.phone), 'GET', `/v1/payment/${encodeURIComponent(reference)}`));
    },

    async payout(req) {
      const country = countryOf(req.phone);
      const method = paymentMethod(req.channel, req.phone);
      if (!country || !method) return { status: 'failed', reason: 'channel_not_supported' };
      try {
        const data = await authed(country, 'POST', '/v1/transfer', {
          currency: 'XOF',
          merchant_transaction_id: req.reference,
          phone_number: req.phone,
          amount: req.amount,
          payment_method: method,
          reason: 'Retrait Smart Tontine',
          notify_url: opts.notifyUrl,
        });
        const v = toVerdict(data);
        return {
          status: v.status === 'success' ? 'completed' : v.status,
          providerRef: data.transaction_id, notifyToken: data.notify_token,
          reason: v.status === 'failed' ? String(data.status ?? 'FAILED') : undefined,
        };
      } catch (e) {
        // Refus explicite avant toute exécution (solde marchand, destinataire inconnu ou bloqué, paramètres) :
        // le retrait n'a pas eu lieu, il peut être annulé. Toute autre erreur reste « inconnue ».
        if (e instanceof CinetPayError && [2005, 2006, 2007, 2011, 1004].includes(e.code ?? 0)) {
          return { status: 'failed', reason: e.status ?? String(e.code) };
        }
        throw e;
      }
    },

    async payoutStatus(reference, hint) {
      return toVerdict(await authed(refCountry(hint?.phone), 'GET', `/v1/transfer/${encodeURIComponent(reference)}`));
    },
  };
}

/** Lit les identifiants depuis l'environnement : CINETPAY_API_KEY / CINETPAY_API_PASSWORD (pays CINETPAY_COUNTRY,
 * Burkina par défaut), et CINETPAY_API_KEY_CI / CINETPAY_API_PASSWORD_CI… pour les autres pays. */
export function cinetpayCredentialsFromEnv(env = process.env) {
  const out: CinetPayOptions['credentials'] = {};
  const main = (env.CINETPAY_COUNTRY ?? 'BF').toUpperCase();
  if (env.CINETPAY_API_KEY && env.CINETPAY_API_PASSWORD) out[main] = { apiKey: env.CINETPAY_API_KEY, apiPassword: env.CINETPAY_API_PASSWORD };
  for (const c of Object.keys(METHODS)) {
    const k = env[`CINETPAY_API_KEY_${c}`], pw = env[`CINETPAY_API_PASSWORD_${c}`];
    if (k && pw) out[c] = { apiKey: k, apiPassword: pw };
  }
  return out;
}
