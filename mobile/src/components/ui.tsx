import { createContext, useCallback, useContext, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  View, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Delete, Inbox, Lock } from 'lucide-react-native';

// Charte Smart Tontine (reprise de l'affiche) : indigo profond (confiance) + vert « argent » (gain).
export const colors = {
  brand: '#3029D1',
  brandDark: '#201B92',
  brand500: '#4A44E0',
  brandSoft: '#F0EFFF',
  brandLine: '#DDD9FF',
  green: '#278326', // vert des boutons et textes : contraste 4,8:1 avec le blanc (AA)
  greenBright: '#59DE17', // vert vif de la marque, décoratif (anneaux, icônes)
  greenDark: '#23721F',
  greenSoft: '#ECF8EC',
  gold: '#9A6406',
  goldSoft: '#FEF6E4',
  info: '#2563EB',
  infoSoft: '#EAF1FE',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  surface2: '#F1F2F8',
  ink: '#121729',
  ink2: '#4E5272',
  muted: '#686C8A',
  line: '#E8E9F1',
  lineStrong: '#D5D7E3',
  danger: '#C53030',
  dangerSoft: '#FDEEEE',
};

export type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
export type Tone = 'brand' | 'green' | 'gold' | 'red' | 'blue' | 'muted';
const TONES: Record<Tone, [string, string]> = {
  brand: [colors.brandSoft, colors.brand], green: [colors.greenSoft, colors.greenDark], gold: [colors.goldSoft, colors.gold],
  red: [colors.dangerSoft, colors.danger], blue: [colors.infoSoft, colors.info], muted: [colors.surface2, colors.ink2],
};

const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#15162C', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 1px 2px rgba(21,22,44,.04), 0 6px 20px -10px rgba(21,22,44,.14)' } as ViewStyle,
}) as ViewStyle;

export function Screen({ children, onRefresh, refreshing = false, edges = ['top'] }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 56, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) => (
  <View style={[s.card, style as ViewStyle]}>{children}</View>
);

export const H1 = ({ children, style }: { children: ReactNode; style?: TextStyle }) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: { children: ReactNode; style?: TextStyle }) => <Text style={[s.h2, style]}>{children}</Text>;
export const P = ({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: TextStyle }) => (
  <Text style={[s.p, muted && { color: colors.muted, fontSize: 13 }, style]}>{children}</Text>
);

/** En-tête de section : titre + lien d'action à droite. */
export const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
    <Text style={s.h2}>{title}</Text>
    {action && <Pressable onPress={onAction} hitSlop={10}><Text style={{ color: colors.brand, fontWeight: '600' }}>{action}</Text></Pressable>}
  </View>
);

type Variant = 'primary' | 'green' | 'ghost' | 'danger' | 'soft' | 'white';
const BTN: Record<Variant, [string, string, string?]> = {
  primary: [colors.brand, '#fff'], green: [colors.green, '#fff'], ghost: ['#fff', colors.ink, colors.lineStrong],
  danger: [colors.danger, '#fff'], soft: [colors.brandSoft, colors.brand], white: ['#fff', colors.brand],
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon: I, size, style }: {
  title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; icon?: Icon; size?: 'sm'; style?: ViewStyle;
}) {
  const [bg, fg, border] = BTN[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, size === 'sm' && s.btnSm, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        border ? { borderWidth: 1, borderColor: border } : null, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {I && <I size={size === 'sm' ? 16 : 19} color={fg} strokeWidth={2.2} />}
          <Text style={[s.btnText, size === 'sm' && { fontSize: 13.5 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, focus && { borderColor: colors.brand500 }, style]}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }} />
      {hint && <Text style={{ fontSize: 12, color: colors.muted }}>{hint}</Text>}
    </View>
  );
}

export function Progress({ value, color = colors.greenBright }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Anneau de progression (tours d'une tontine, score). */
export function Ring({ value, size = 56, stroke = 6, color = colors.greenBright, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${Math.round(v)} %`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - v / 100)} />
      </Svg>
      {children}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={[s.segment, o.value === value && s.segmentOn]}>
          <Text numberOfLines={1} style={[s.segmentText, o.value === value && { color: colors.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>
);

/** Pastille d'icône colorée. */
export const IconBadge = ({ icon: I, tone = 'brand', size = 42, round }: { icon: Icon; tone?: Tone; size?: number; round?: boolean }) => (
  <View style={{ width: size, height: size, borderRadius: round ? size / 2 : size * 0.3, backgroundColor: TONES[tone][0], alignItems: 'center', justifyContent: 'center' }}>
    <I size={size * 0.48} color={TONES[tone][1]} strokeWidth={2} />
  </View>
);

export const Badge = ({ label, tone = 'muted' }: { label: string; tone?: Tone }) => (
  <View style={{ backgroundColor: TONES[tone][0], paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' }}>
    <Text style={{ color: TONES[tone][1], fontSize: 12, fontWeight: '700' }}>{label}</Text>
  </View>
);

/** Ligne de liste : icône, titre, sous-titre, élément à droite. */
export function ListItem({ icon, tone, title, subtitle, right, onPress, last }: { icon?: Icon; tone?: Tone; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; last?: boolean }) {
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      {icon && <IconBadge icon={icon} tone={tone} round size={40} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: '600', color: colors.ink, fontSize: 15 }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable> : body;
}

export function EmptyState({ icon = Inbox, title, text, action }: { icon?: Icon; title?: string; text?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <IconBadge icon={icon} size={56} round />
      {title && <Text style={[s.h2, { textAlign: 'center', marginTop: 4 }]}>{title}</Text>}
      {text && <Text style={[s.p, { textAlign: 'center', color: colors.muted, maxWidth: 300 }]}>{text}</Text>}
      {action}
    </View>
  );
}
export const Empty = ({ text }: { text: string }) => <EmptyState text={text} />;

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Saisie d'un montant en grand, avec montants rapides. */
export function AmountInput({ value, onChange, chips = [5000, 10000, 25000, 50000], label = 'Montant' }: { value: string; onChange: (v: string) => void; chips?: number[]; label?: string }) {
  const n = Number(value.replace(/\D/g, '')) || 0;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, borderBottomWidth: 2, borderBottomColor: colors.lineStrong, paddingBottom: 6 }}>
        <TextInput value={n ? fmt(n) : ''} onChangeText={(t) => onChange(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.lineStrong}
          style={[{ flex: 1, fontSize: 38, fontWeight: '800', color: colors.ink, letterSpacing: -1, padding: 0 }, Platform.OS === 'web' && ({ outlineWidth: 0 } as TextStyle)]} accessibilityLabel={label} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.muted }}>F CFA</Text>
      </View>
      {chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chips.map((c) => (
            <Pressable key={c} onPress={() => onChange(String(c))} style={[s.chip, n === c && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}>
              <Text style={{ fontWeight: '600', color: n === c ? colors.brand : colors.ink2, fontSize: 13 }}>{fmt(c)} F</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Récapitulatif avant validation (frais, total…). */
export const Recap = ({ rows }: { rows: [string, string, boolean?][] }) => (
  <View style={{ backgroundColor: colors.surface2, borderRadius: 14, padding: 14, gap: 8 }}>
    {rows.map(([k, v, strong]) => (
      <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.ink2, fontSize: 13.5 }}>{k}</Text>
        <Text style={{ color: colors.ink, fontWeight: strong ? '800' : '600', fontSize: strong ? 15 : 13.5 }}>{v}</Text>
      </View>
    ))}
  </View>
);

export function notifyError(e: unknown) {
  const msg = (e as Error).message ?? 'Erreur';
  if (Platform.OS === 'web') globalThis.alert?.(msg); else Alert.alert('Oups', msg);
}

export function notifyOk(title: string, msg = '') {
  if (Platform.OS === 'web') globalThis.alert?.(`${title}\n${msg}`); else Alert.alert(title, msg);
}

// ───── Clavier du code PIN (feuille coulissante) ─────
type PinRequest = { title: string; reason: string; resolve: (v: string | null) => void };
const PinCtx = createContext<((title: string, reason: string) => Promise<string | null>) | null>(null);

function PinSheet({ req, onDone }: { req: PinRequest; onDone: (v: string | null) => void }) {
  const [pin, setPin] = useState('');
  useEffect(() => { if (pin.length === 4) { const t = setTimeout(() => onDone(pin), 150); return () => clearTimeout(t); } }, [pin, onDone]);
  const press = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', '<'];
  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => onDone(null)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(13,14,30,.45)' }} onPress={() => onDone(null)} accessibilityLabel="Fermer" />
      <View style={s.sheet}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <IconBadge icon={Lock} size={52} round />
          <Text style={s.h2}>{req.title}</Text>
          <Text style={[s.p, { textAlign: 'center' }]}>{req.reason}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginVertical: 14 }} accessibilityLabel={`${pin.length} chiffres sur 4`}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: i < pin.length ? colors.brand : colors.lineStrong, backgroundColor: i < pin.length ? colors.brand : 'transparent' }} />)}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          {keys.map((k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === 'x' ? 'Annuler' : k === '<' ? 'Effacer' : k}
              onPress={() => (k === 'x' ? onDone(null) : k === '<' ? setPin((p) => p.slice(0, -1)) : press(k))}
              style={({ pressed }) => [s.key, (k === 'x' || k === '<') && { backgroundColor: 'transparent' }, pressed && { backgroundColor: colors.brandLine }]}>
              {k === '<' ? <Delete size={24} color={colors.ink} /> : <Text style={{ fontSize: k === 'x' ? 15 : 24, fontWeight: k === 'x' ? '600' : '700', color: colors.ink }}>{k === 'x' ? 'Annuler' : k}</Text>}
            </Pressable>
          ))}
        </View>
        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 12 }}>Ne communique jamais ton code PIN, même au support.</Text>
      </View>
    </Modal>
  );
}

export function PinProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<PinRequest | null>(null);
  const ask = useCallback((title: string, reason: string) => new Promise<string | null>((resolve) => setReq({ title, reason, resolve })), []);
  const done = useCallback((v: string | null) => setReq((r) => { r?.resolve(v); return null; }), []);
  return <PinCtx.Provider value={ask}>{children}{req && <PinSheet key={req.title + req.reason} req={req} onDone={done} />}</PinCtx.Provider>;
}

export function usePinPad() {
  const c = useContext(PinCtx);
  if (!c) throw new Error('PinProvider manquant');
  return c;
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line, ...shadow },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  p: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 52, flexDirection: 'row', gap: 8 },
  btnSm: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11 },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  track: { height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 13, padding: 4, gap: 2 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: '#fff', ...shadow },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  chip: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34 },
  key: { width: '31%', height: 60, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
