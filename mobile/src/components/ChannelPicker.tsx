import { Pressable, Text } from 'react-native';
import { Row, colors } from '@/components/ui';

export const CHANNELS = [
  { value: 'wave', label: 'Wave', glyph: '🐧' },
  { value: 'orange_money', label: 'Orange Money', glyph: '🟠' },
  { value: 'mtn_momo', label: 'MTN MoMo', glyph: '🟡' },
  { value: 'moov_money', label: 'Moov Money', glyph: '🔵' },
] as const;

export function ChannelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      {CHANNELS.map((c) => (
        <Pressable key={c.value} onPress={() => onChange(c.value)}
          style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: value === c.value ? colors.green : colors.line, backgroundColor: '#fff' }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>{c.glyph} {c.label}</Text>
        </Pressable>
      ))}
    </Row>
  );
}
