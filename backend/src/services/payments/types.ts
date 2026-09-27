export type Channel = 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'card';

export interface CollectionRequest {
  reference: string;
  amount: number;
  phone: string;
  channel: Channel;
  description: string;
}

export interface CollectionResult {
  providerRef?: string;
  /** URL de paiement à ouvrir dans l'app (Wave, page CinetPay…) */
  paymentUrl?: string;
}

export interface PayoutRequest {
  reference: string;
  amount: number;
  phone: string;
  channel: Channel;
}

export interface PayoutResult {
  status: 'completed' | 'pending' | 'failed';
  providerRef?: string;
}

/**
 * Tout agrégateur (CinetPay, PayDunya, Wave Business, Orange Money API…) implémente
 * cette interface. La confirmation définitive d'un encaissement arrive toujours par webhook.
 */
export interface PaymentProvider {
  name: string;
  collect(req: CollectionRequest): Promise<CollectionResult>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
}
