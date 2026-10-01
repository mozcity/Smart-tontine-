import { ArrowDownLeft, ArrowUpRight, HandCoins, Lock, PiggyBank, RefreshCcw, Repeat, ShoppingBag, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { dateTime, fcfa, TX_LABELS } from '../lib/format';
import type { IcoTone } from './ui';
import { Ico } from './ui';

const ICONS: [RegExp, LucideIcon][] = [
  [/^tontine/, RefreshCcw], [/^loan|^contrat/, HandCoins], [/^cagnotte/, Users], [/^goods/, ShoppingBag], [/^ecaisse|^projet|^challenge/, PiggyBank],
  [/guarantee/, Lock], [/referral|reward/, Sparkles], [/transfer/, Repeat], [/subscription/, Sparkles],
];

/** Ligne d'historique : icône selon l'opération, montant vert (entrée) ou neutre (sortie). */
export function TxRow({ type, description, amount, created_at }: { type: string; description: string; amount: number; created_at: string }) {
  const icon = ICONS.find(([re]) => re.test(type))?.[1] ?? (amount > 0 ? ArrowDownLeft : ArrowUpRight);
  const tone: IcoTone = amount > 0 ? 'green' : 'brand';
  return (
    <div className="list-row">
      <Ico icon={icon} tone={tone} round />
      <div className="grow"><div className="title small ellipsis">{TX_LABELS[type] ?? type}</div><div className="sub ellipsis">{description} · {dateTime(created_at)}</div></div>
      <span className={`amount nowrap ${amount > 0 ? 'pos' : ''}`}>{amount > 0 ? '+' : '−'}{fcfa(Math.abs(amount))}</span>
    </div>
  );
}
