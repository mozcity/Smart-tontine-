import { ArrowDownLeft, ArrowUpRight, HandCoins, Lock, PiggyBank, RefreshCcw, Repeat, ShoppingBag, Sparkles, Users } from 'lucide-react-native';
import { Text } from 'react-native';
import { fcfa, shortDate, TX_LABELS } from '@/lib/format';
import { ListItem, colors, type Icon } from '@/components/ui';

const ICONS: [RegExp, Icon][] = [
  [/^tontine/, RefreshCcw], [/^loan|^contrat/, HandCoins], [/^cagnotte/, Users], [/^goods/, ShoppingBag], [/^ecaisse|^projet|^challenge/, PiggyBank],
  [/guarantee/, Lock], [/referral|reward|subscription/, Sparkles], [/transfer/, Repeat],
];

/** Ligne d'historique : icône selon l'opération, montant vert pour une entrée. */
export function HistoryRow({ type, description, amount, created_at, last }: { type: string; description: string; amount: number; created_at: string; last?: boolean }) {
  const positive = amount > 0;
  const icon = ICONS.find(([re]) => re.test(type))?.[1] ?? (positive ? ArrowDownLeft : ArrowUpRight);
  return (
    <ListItem icon={icon} tone={positive ? 'green' : 'brand'} title={TX_LABELS[type] ?? description} subtitle={`${shortDate(created_at)} · ${description}`} last={last}
      right={<Text style={{ fontWeight: '800', color: positive ? colors.greenDark : colors.ink, fontVariant: ['tabular-nums'] }}>{positive ? '+' : '−'}{fcfa(Math.abs(amount))}</Text>} />
  );
}
