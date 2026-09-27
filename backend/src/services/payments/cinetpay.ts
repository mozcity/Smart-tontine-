import type { PaymentProvider } from './types.js';

// Intégration CinetPay (agrégateur UEMOA : Orange Money, MTN, Moov, Wave, cartes).
// Documentation : https://docs.cinetpay.com — l'encaissement passe par le « Checkout » v2.
const CHANNELS: Record<string, string> = {
  wave: 'WALLET', orange_money: 'MOBILE_MONEY', mtn_momo: 'MOBILE_MONEY', moov_money: 'MOBILE_MONEY', card: 'CREDIT_CARD',
};

export function cinetpayProvider(opts: { apiKey: string; siteId: string; notifyUrl: string; returnUrl: string }): PaymentProvider {
  return {
    name: 'cinetpay',
    async collect(req) {
      const res = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apikey: opts.apiKey,
          site_id: opts.siteId,
          transaction_id: req.reference,
          amount: req.amount,
          currency: 'XOF',
          description: req.description,
          customer_phone_number: req.phone,
          channels: CHANNELS[req.channel] ?? 'ALL',
          notify_url: opts.notifyUrl,
          return_url: opts.returnUrl,
        }),
      });
      const body = (await res.json()) as { code: string; message: string; data?: { payment_url: string; payment_token: string } };
      if (body.code !== '201' || !body.data) throw new Error(`CinetPay : ${body.message}`);
      return { providerRef: body.data.payment_token, paymentUrl: body.data.payment_url };
    },
    async payout() {
      // Les transferts sortants passent par l'API « Transfert » de CinetPay (compte marchand dédié,
      // liste de contacts, solde de transfert). À brancher lors de l'ouverture du compte marchand.
      throw new Error('Payout CinetPay non configuré');
    },
  };
}
