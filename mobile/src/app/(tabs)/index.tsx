import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { fcfa } from '@/lib/format';
import { HistoryRow } from '@/components/HistoryRow';
import { Card, Empty, H2, Row, Screen, Segmented, colors } from '@/components/ui';

interface Wallet { balance: number; totalSavings: number; netWorth: number }
interface History { entries: { id: string; type: string; description: string; amount: number; created_at: string }[]; pending: { id: string; amount: number }[] }
interface News { id: string; title: string; summary: string }

const SHORTCUTS: { label: string; glyph: string; href: Href; isNew?: boolean }[] = [
  { label: 'Transfert', glyph: '💸', href: '/transfert' },
  { label: 'Retrait', glyph: '🏧', href: '/retrait' },
  { label: 'Challenge', glyph: '🚀', href: '/challenges' },
  { label: 'Cagnotte', glyph: '🐷', href: '/cagnottes', isNew: true },
];

const SECTIONS = [
  { value: 'portefeuille', label: 'Portefeuille' },
  { value: 'projet', label: 'Projet' },
  { value: 'ecaisse', label: 'E-caisse' },
  { value: 'contrats', label: 'Contrats' },
] as const;
const SECTION_ROUTES: Record<string, Href> = { projet: '/projets', ecaisse: '/ecaisse', contrats: '/contrats' };

export default function Home() {
  const { me } = useAuth();
  const wallet = useApi<Wallet>('/wallet');
  const history = useApi<History>('/wallet/history?limit=5');
  const news = useApi<News[]>('/me/news');
  const firstName = me?.full_name?.split(' ')[0] ?? '';

  return (
    <Screen onRefresh={() => { void wallet.reload(); void history.reload(); }} refreshing={wallet.loading && !!wallet.data}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.brand }}>⚡ SMARTFIN</Text>
        <Pressable onPress={() => router.push('/support')} accessibilityLabel="Aide et support"><Text style={{ fontSize: 22 }}>💬</Text></Pressable>
      </Row>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>👋 Hello, {firstName || 'toi'}</Text>

      <Segmented options={[...SECTIONS]} value="portefeuille" onChange={(v) => { if (SECTION_ROUTES[v]) router.push(SECTION_ROUTES[v]); }} />

      <Row style={{ alignItems: 'stretch' }}>
        <View style={{ flex: 1, backgroundColor: colors.brand, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: '#C9C8F0', fontSize: 12 }}>Mon jeton</Text>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2 }}>{fcfa(wallet.data?.balance)}</Text>
          {!!wallet.data?.totalSavings && (
            <Text style={{ color: '#C9C8F0', fontSize: 12, marginTop: 4 }}>+ {fcfa(wallet.data.totalSavings)} épargnés</Text>
          )}
        </View>
        <Pressable onPress={() => router.push('/depot')} style={{ width: 76, backgroundColor: colors.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Faire un dépôt">
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>+</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Dépôt</Text>
        </Pressable>
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        {SHORTCUTS.map((sc) => (
          <Pressable key={sc.label} onPress={() => router.push(sc.href)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: '90%', aspectRatio: 1, backgroundColor: colors.brandSoft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>{sc.glyph}</Text>
              {sc.isNew && <Text style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.danger, color: '#fff', fontSize: 9, fontWeight: '800', paddingHorizontal: 5, borderRadius: 4 }}>NEW</Text>}
            </View>
            <Text style={{ fontSize: 12, color: colors.ink2 }}>{sc.label}</Text>
          </Pressable>
        ))}
      </Row>

      <H2>News & Tuto</H2>
      {news.data?.slice(0, 2).map((n) => (
        <Card key={n.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg }}>
          <Text style={{ fontSize: 32 }}>📬</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{n.title}</Text>
            <Text style={{ fontSize: 12, color: colors.ink2 }}>{n.summary}</Text>
          </View>
        </Card>
      ))}

      <Row style={{ justifyContent: 'space-between' }}>
        <H2>Historique portefeuille</H2>
        <Pressable onPress={() => router.push('/historique')}><Text style={{ color: colors.brand, fontWeight: '600' }}>voir plus</Text></Pressable>
      </Row>
      {history.data?.entries.length === 0 && <Empty text="Aucune opération pour l'instant. Fais ton premier dépôt !" />}
      {history.data?.entries.map((e) => <HistoryRow key={e.id + e.created_at} {...e} />)}
    </Screen>
  );
}
