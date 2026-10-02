import { config } from '../../config.js';
import { mockProvider } from './mock.js';
import { cinetpayCredentialsFromEnv, cinetpayProvider } from './cinetpay.js';
import type { PaymentProvider } from './types.js';

let provider: PaymentProvider | undefined;

export function paymentProvider(): PaymentProvider {
  if (provider) return provider;
  if (config.paymentProvider === 'cinetpay') {
    const api = process.env.PUBLIC_API_URL ?? 'https://api.smarttontine.app';
    const web = process.env.PUBLIC_WEB_URL ?? 'https://smarttontine.app';
    const credentials = cinetpayCredentialsFromEnv();
    if (!Object.keys(credentials).length) throw new Error('PAYMENT_PROVIDER=cinetpay : CINETPAY_API_KEY et CINETPAY_API_PASSWORD sont obligatoires');
    provider = cinetpayProvider({
      credentials,
      notifyUrl: `${api}/webhooks/cinetpay`,
      successUrl: `${web}/app/portefeuille?depot=ok`,
      failedUrl: `${web}/app/portefeuille?depot=echec`,
      baseUrl: process.env.CINETPAY_BASE_URL || undefined,
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
