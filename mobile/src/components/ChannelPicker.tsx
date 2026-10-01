import { Pressable, Text, View } from 'react-native';
import { colors } from '@/components/ui';

// Opérateurs Mobile Money : pastille aux couleurs de l'opérateur (repère visuel immédiat).
export const CHANNELS = [
  { value: 'orange_money', label: 'Orange Money', short: 'OM', color: '#FF7900', fg: '#fff' },
  { value: 'moov_money', label: 'Moov Money', short: 'MV', color: '#0066B3', fg: '#fff' },
  { value: 'wave', label: 'Wave', short: 'W', color: '#1DC8F2', fg: '#fff' },
  { value: 'mtn_momo', label: 'MTN MoMo', short: 'MTN', color: '#FFCB05', fg: '#111' },
] as const;

export function ChannelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink2 }}>Opérateur Mobile Money</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {CHANNELS.map((c) => {
          const on = value === c.value;
          return (
            <Pressable key={c.value} onPress={() => onChange(c.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={{ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5,
                borderColor: on ? colors.brand : colors.lineStrong, backgroundColor: on ? colors.brandSoft : '#fff' }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.fg, fontWeight: '800', fontSize: 11 }}>{c.short}</Text>
              </View>
              <Text style={{ fontWeight: '600', color: colors.ink, fontSize: 13.5 }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
