import { config } from '../../config.js';
import { mockProvider } from './mock.js';
import { cinetpayProvider } from './cinetpay.js';
import type { PaymentProvider } from './types.js';

let provider: PaymentProvider | undefined;

export function paymentProvider(): PaymentProvider {
  if (provider) return provider;
  if (config.paymentProvider === 'cinetpay') {
    const base = process.env.PUBLIC_API_URL ?? 'https://api.smartfin.app';
    provider = cinetpayProvider({
      apiKey: process.env.CINETPAY_API_KEY ?? '',
      siteId: process.env.CINETPAY_SITE_ID ?? '',
      notifyUrl: `${base}/webhooks/payments`,
      returnUrl: 'smartfin://depot/retour',
    });
  } else {
    provider = mockProvider;
  }
  return provider;
}

export function setPaymentProvider(p: PaymentProvider) {
  provider = p;
}

export type { Channel, PaymentProvider } from './types.js';
