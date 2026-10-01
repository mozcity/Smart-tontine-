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
 * cette interface. Le webhook déclenche le traitement ; la décision repose sur `verify` quand il existe.
 */
export interface VerificationResult {
  status: 'success' | 'failed' | 'pending';
  /** Montant réellement encaissé selon l'agrégateur (contrôlé avant tout crédit). */
  amount?: number;
  providerRef?: string;
}

export interface PaymentProvider {
  name: string;
  collect(req: CollectionRequest): Promise<CollectionResult>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
  /** Interroge l'agrégateur serveur-à-serveur : un webhook seul ne suffit jamais à créditer un compte. */
  verify?(reference: string): Promise<VerificationResult>;
}
