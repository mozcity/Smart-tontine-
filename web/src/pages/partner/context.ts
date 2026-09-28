import { createContext, useContext } from 'react';

export interface Dashboard {
  partner: { id: string; name: string; type: string; description: string | null; logo: string | null; primary_color: string; phone: string | null; city: string | null;
    management_fee_rate: string; status: 'pending' | 'active' | 'suspended'; created_at: string };
  role: 'owner' | 'manager'; balance: number; activeMembers: number; estimatedInvoice: number; collectedThisMonth: number; managementFeesEarned: number;
  tontines: { id: string; name: string; kind: string; visibility: string; status: string; contribution_amount: number; frequency: string; max_members: number;
    good_label: string | null; members: number; defaulters: number; current_round: { number: number; due_date: string; paid: number } | null }[];
  coffres: { id: string; name: string; category: string; status: string; balance: number; members: number }[];
  orders: { id: string; good_name: string; beneficiary: string | null; phone: string; amount: number; status: string; created_at: string; shipped_at: string | null; delivery_note: string | null }[];
  invoices: { id: string; month: string; active_members: number; amount: number; status: 'paid' | 'due'; created_at: string }[];
  staff: { id: string; full_name: string | null; phone: string; role: 'owner' | 'manager' }[];
}

export const PartnerCtx = createContext<{ dash: Dashboard; reload: () => Promise<void> } | null>(null);
export function usePartner() {
  const c = useContext(PartnerCtx);
  if (!c) throw new Error('PartnerCtx manquant');
  return c;
}
