import type { Brand } from '../../components/Brand';

export interface MyTontine {
  id: string; name: string; kind: 'argent' | 'bien'; visibility: string; good_label: string | null; good_price: number | null;
  contribution_amount: number; frequency: string; max_members: number; status: string; organizer_id: string; position: number | null;
  partner: Brand | null; members: number; my_turn: string | null;
  current_round: { number: number; due_date: string; beneficiary_id: string; paid: boolean } | null;
}
