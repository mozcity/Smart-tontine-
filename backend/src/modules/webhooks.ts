import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { hmac, safeEqual } from '../lib/crypto.js';
import { verifyAndSettle } from './wallet.js';

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
 * Notification CinetPay (formulaire ou JSON, champ cpm_trans_id). Son contenu n'est pas considéré comme
 * fiable : on ne retient que la référence, puis on interroge CinetPay (/v2/payment/check) avant de créditer.
 */
router.post('/cinetpay', async (req, res) => {
  const { cpm_trans_id: ref } = z.object({ cpm_trans_id: z.string().min(3).max(80) }).parse(req.body);
  const result = await verifyAndSettle(ref);
  res.json({ ok: true, status: result.status });
});
