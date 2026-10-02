import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { hmac, safeEqual } from '../lib/crypto.js';
import { one, pool } from '../db.js';
import { checkWithdrawal, verifyAndSettle } from './wallet.js';
import { recordDelivery, twilioSignature } from '../services/sms.js';

export const router = Router();

/**
 * Notification signée en HMAC-SHA256 (en-tête x-smarttontine-signature), pour un agrégateur ou un
 * relais interne. Si le fournisseur sait vérifier une transaction, c'est sa réponse qui fait foi.
 */
router.post('/payments', async (req, res) => {
  const raw = (req as any).rawBody as string | undefined;
  const signature = String(req.headers['x-smarttontine-signature'] ?? '');
  if (!raw || !safeEqual(signature, hmac(config.paymentWebhookSecret, raw))) {
    throw new HttpError(401, 'bad_signature', 'Signature invalide');
  }
  const body = z.object({
    reference: z.string(),
    status: z.enum(['success', 'failed']),
    providerRef: z.string().optional(),
  }).parse(req.body);
  const result = await verifyAndSettle(body.reference, { success: body.status === 'success', providerRef: body.providerRef });
  res.json(result);
});

/**
 * Notification CinetPay API v1 (JSON : notify_token, merchant_transaction_id, transaction_id), pour les dépôts
 * comme pour les retraits. Le jeton est comparé en temps constant à celui reçu à l'initialisation ; le statut
 * n'est jamais lu dans la notification : il est redemandé à CinetPay avant toute écriture comptable.
 */
router.post('/cinetpay', async (req, res) => {
  const body = z.object({
    notify_token: z.string().min(8).max(512),
    merchant_transaction_id: z.string().min(3).max(64),
  }).parse(req.body);
  const tx = await one(pool, "SELECT type, meta FROM transactions WHERE reference = $1 AND type IN ('deposit', 'withdrawal')",
    [body.merchant_transaction_id]);
  const expected = typeof tx?.meta?.notifyToken === 'string' ? tx.meta.notifyToken : '';
  // Référence inconnue et jeton faux reçoivent la même réponse : rien à apprendre en sondant.
  if (!tx || !expected || !safeEqual(body.notify_token, expected)) throw new HttpError(401, 'bad_token', 'Notification refusée');
  const result = tx.type === 'deposit'
    ? await verifyAndSettle(body.merchant_transaction_id)
    : await checkWithdrawal(body.merchant_transaction_id);
  res.json({ ok: true, status: result.status });
});

/**
 * Accusés de réception Orange SMS. Orange ne signe pas ses notifications : l'URL déclarée contient un jeton
 * secret (SMS_WEBHOOK_TOKEN), comparé en temps constant.
 */
router.post('/sms/orange/:token', async (req, res) => {
  const expected = process.env.SMS_WEBHOOK_TOKEN ?? '';
  if (!expected || !safeEqual(String(req.params.token), expected)) throw new HttpError(401, 'bad_token', 'Notification refusée');
  const n = z.object({ deliveryInfoNotification: z.object({
    callbackData: z.string().uuid(),
    deliveryInfo: z.object({ deliveryStatus: z.string().max(40) }).passthrough(),
  }) }).parse(req.body).deliveryInfoNotification;
  const st = n.deliveryInfo.deliveryStatus;
  // DeliveredToNetwork / MessageWaiting sont intermédiaires : seuls les statuts finaux sont enregistrés.
  if (st === 'DeliveredToTerminal' || st === 'DeliveryImpossible') {
    await recordDelivery('orange', { logId: n.callbackData }, st === 'DeliveredToTerminal', st === 'DeliveryImpossible' ? st : undefined);
  }
  res.json({ ok: true });
});

/** Accusés de réception Twilio, authentifiés par la signature X-Twilio-Signature. */
router.post('/sms/twilio', async (req, res) => {
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const url = `${process.env.PUBLIC_API_URL ?? 'https://api.smarttontine.app'}/webhooks/sms/twilio`;
  const params = Object.fromEntries(Object.entries(req.body ?? {}).map(([k, v]) => [k, String(v)]));
  if (!token || !safeEqual(String(req.headers['x-twilio-signature'] ?? ''), twilioSignature(token, url, params))) {
    throw new HttpError(401, 'bad_signature', 'Signature invalide');
  }
  const { MessageSid, MessageStatus, ErrorCode } = z.object({
    MessageSid: z.string().max(64), MessageStatus: z.string().max(20), ErrorCode: z.string().max(10).optional(),
  }).parse(params);
  if (MessageStatus === 'delivered' || MessageStatus === 'undelivered' || MessageStatus === 'failed') {
    await recordDelivery('twilio', { providerRef: MessageSid }, MessageStatus === 'delivered', ErrorCode ? `Twilio ${ErrorCode}` : undefined);
  }
  res.type('text/xml').send('<Response/>');
});
