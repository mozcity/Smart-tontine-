import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { hmac, safeEqual } from '../lib/crypto.js';
import { settleDeposit } from './wallet.js';

export const router = Router();

/**
 * Notification de l'agrégateur de paiement. Le corps brut est signé en HMAC-SHA256
 * (en-tête x-smartfin-signature). Pour CinetPay, placer ici l'appel de vérification
 * /v2/payment/check avant de créditer : ne jamais faire confiance au seul webhook.
 */
router.post('/payments', async (req, res) => {
  const raw = (req as any).rawBody as string | undefined;
  const signature = String(req.headers['x-smartfin-signature'] ?? '');
  if (!raw || !safeEqual(signature, hmac(config.paymentWebhookSecret, raw))) {
    throw new HttpError(401, 'bad_signature', 'Signature invalide');
  }
  const body = z.object({
    reference: z.string(),
    status: z.enum(['success', 'failed']),
    providerRef: z.string().optional(),
  }).parse(req.body);
  const result = await settleDeposit(body.reference, body.status === 'success', body.providerRef);
  res.json(result);
});
