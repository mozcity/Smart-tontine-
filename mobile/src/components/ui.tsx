import type { ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  View, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Charte Smart Tontine (reprise de l'affiche) : indigo profond + vert « argent ».
export const colors = {
  brand: '#2F2C8F',
  brandDark: '#211F6B',
  green: '#3AA935',
  bg: '#F5F6FB',
  card: '#FFFFFF',
  ink: '#1C1D33',
  ink2: '#5B5F7D',
  muted: '#9296AE',
  line: '#E6E8F2',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  greenSoft: '#EAF7E9',
  brandSoft: '#ECEBFA',
};

export function Screen({ children, onRefresh, refreshing = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text style={[s.p, muted && { color: colors.muted }]}>{children}</Text>
);

export function Button({ title, onPress, variant = 'primary', loading, disabled }: {
  title: string; onPress: () => void; variant?: 'primary' | 'green' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean;
}) {
  const bg = { primary: colors.brand, green: colors.green, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = variant === 'ghost' ? colors.brand : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.line }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={s.input} {...props} />
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={s.track} accessibilityLabel={`${pct} %`}>
      <View style={[s.fill, { width: `${pct}%` }]} />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segment, o.value === value && s.segmentOn]}>
          <Text style={[s.segmentText, o.value === value && { color: '#fff' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>
);

export const Empty = ({ text }: { text: string }) => <Text style={[s.p, { color: colors.muted, textAlign: 'center', paddingVertical: 16 }]}>{text}</Text>;

export function notifyError(e: unknown) {
  const msg = (e as Error).message ?? 'Erreur';
  if (Platform.OS === 'web') globalThis.alert?.(msg); else Alert.alert('Oups', msg);
}

export function notifyOk(title: string, msg = '') {
  if (Platform.OS === 'web') globalThis.alert?.(`${title}\n${msg}`); else Alert.alert(title, msg);
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  h1: { fontSize: 22, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  p: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnText: { fontSize: 15, fontWeight: '700' },
  track: { height: 8, backgroundColor: colors.brandSoft, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.green, borderRadius: 4 },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.green, borderColor: colors.green },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.ink },
});
