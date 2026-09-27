import { Text, View } from 'react-native';
import { fcfa, shortDate, TX_LABELS } from '@/lib/format';
import { Card, colors } from '@/components/ui';

export function HistoryRow({ type, description, amount, created_at }: { type: string; description: string; amount: number; created_at: string }) {
  const positive = amount > 0;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: positive ? colors.greenSoft : colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{positive ? '⬇️' : '⬆️'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: colors.ink }}>{TX_LABELS[type] ?? description}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{description}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: '700', color: positive ? colors.green : colors.danger }}>{positive ? '+' : ''}{fcfa(amount)}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{shortDate(created_at)}</Text>
      </View>
    </Card>
  );
}
