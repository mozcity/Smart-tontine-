import type { PaymentProvider } from './types.js';

/** Fournisseur factice pour le développement et les tests : les retraits réussissent immédiatement. */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async collect(req) {
    return { providerRef: `MOCK-${req.reference}`, paymentUrl: `https://pay.example.test/checkout/${req.reference}` };
  },
  async payout(req) {
    return { status: 'completed', providerRef: `MOCK-PAYOUT-${req.reference}` };
  },
};
