import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowDownToLine, ArrowUpFromLine, Bell, Eye, EyeOff, FileSignature, History, Lock, PartyPopper, RefreshCcw, Rocket, Send, ShoppingBag, Target, Users } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { fcfa, shortDate } from '@/lib/format';
import { HistoryRow } from '@/components/HistoryRow';
import { Badge, Button, Card, EmptyState, IconBadge, Ring, Screen, SectionHeader, colors, notifyError, type Icon, type Tone } from '@/components/ui';

interface Wallet { balance: number; totalSavings: number; netWorth: number }
interface History { entries: { id: string; type: string; description: string; amount: number; created_at: string }[] }
interface TontineItem { id: string; name: string; status: string; contribution_amount: number; max_members: number; members: number; my_turn: string | null;
  current_round: { number: number; due_date: string; beneficiary_id: string; paid: boolean } | null }

const SHORTCUTS: { label: string; icon: Icon; href: Href; tone: Tone }[] = [
  { label: 'Tontines', icon: RefreshCcw, href: '/tontines', tone: 'brand' },
  { label: 'Biens', icon: ShoppingBag, href: '/biens', tone: 'gold' },
  { label: 'Coffres', icon: Users, href: '/cagnottes', tone: 'green' },
  { label: 'E-caisse', icon: Lock, href: '/ecaisse', tone: 'blue' },
  { label: 'Projets', icon: Target, href: '/projets', tone: 'green' },
  { label: 'Challenges', icon: Rocket, href: '/challenges', tone: 'gold' },
  { label: 'Contrats', icon: FileSignature, href: '/contrats', tone: 'brand' },
  { label: 'Historique', icon: History, href: '/historique', tone: 'blue' },
];

function daysLabel(d: string): [string, Tone] {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(`${d}T00:00:00`).getTime() - t.getTime()) / 86_400_000);
  if (n < 0) return [`en retard de ${-n} j`, 'red'];
  if (n === 0) return ["aujourd'hui", 'gold'];
  if (n === 1) return ['demain', 'gold'];
  return [`dans ${n} j`, n <= 3 ? 'gold' : 'muted'];
}

export default function Home() {
  const { me, refresh } = useAuth();
  const wallet = useApi<Wallet>('/wallet');
  const history = useApi<History>('/wallet/history?limit=5');
  const tontines = useApi<TontineItem[]>('/tontines');
  const credit = useApi<{ score: number }>('/credit/offers');
  const [hidden, setHidden] = useState(false);
  const money = (n?: number) => (hidden ? '•••• F' : fcfa(n));
  const active = tontines.data?.filter((t) => t.status !== 'completed') ?? [];
  const due = active.filter((t) => t.status === 'active' && t.current_round && !t.current_round.paid);
  const next = active.filter((t) => t.my_turn).sort((a, b) => a.my_turn!.localeCompare(b.my_turn!))[0];
  const firstName = me?.full_name?.split(' ')[0] ?? '';
  const initials = (me?.full_name ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const reload = () => { void wallet.reload(); void history.reload(); void tontines.reload(); void credit.reload(); void refresh(); };

  async function pay(t: TontineItem) {
    try { await api(`/tontines/${t.id}/rounds/${t.current_round!.number}/contribute`, { body: {} }); reload(); } catch (e) { notifyError(e); }
  }

  const BalanceBtn = ({ label, icon: I, href, primary }: { label: string; icon: Icon; href: Href; primary?: boolean }) => (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12,
        backgroundColor: primary ? '#fff' : 'rgba(255,255,255,.14)', opacity: pressed ? 0.8 : 1 })}>
      <I size={17} color={primary ? colors.brand : '#fff'} strokeWidth={2.3} />
      <Text style={{ color: primary ? colors.brand : '#fff', fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen onRefresh={reload} refreshing={wallet.loading && !!wallet.data}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.push('/profil')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Mon profil">
          <Text style={{ color: '#fff', fontWeight: '800' }}>{initials}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Bonjour 👋</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.ink }}>{firstName || 'Bienvenue'}</Text>
        </View>
        <Pressable onPress={() => router.push('/profil')} hitSlop={8} accessibilityLabel="Notifications"
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={21} color={colors.ink} />
        </Pressable>
      </View>

      <View style={{ backgroundColor: colors.brand, borderRadius: 24, padding: 20, gap: 16, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -60, top: -70, width: 200, height: 200, borderRadius: 100, borderWidth: 24, borderColor: 'rgba(58,169,53,.3)' }} />
        <View style={{ position: 'absolute', left: -40, bottom: -90, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,.05)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,.75)', fontWeight: '600' }}>Mon jeton</Text>
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityLabel={hidden ? 'Afficher les montants' : 'Masquer les montants'}>
            {hidden ? <EyeOff size={20} color="#fff" /> : <Eye size={20} color="#fff" />}
          </Pressable>
        </View>
        <View>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>{money(wallet.data?.balance)}</Text>
          <Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginTop: 2 }}>+ {money(wallet.data?.totalSavings)} d'épargne bloquée</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BalanceBtn label="Déposer" icon={ArrowDownToLine} href="/depot" primary />
          <BalanceBtn label="Retirer" icon={ArrowUpFromLine} href="/retrait" />
          <BalanceBtn label="Envoyer" icon={Send} href="/transfert" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {SHORTCUTS.map((sc) => (
          <Pressable key={sc.label} onPress={() => router.push(sc.href)} style={({ pressed }) => ({ width: '25%', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })} accessibilityRole="button">
            <IconBadge icon={sc.icon} tone={sc.tone} size={52} />
            <Text style={{ fontSize: 12, color: colors.ink, fontWeight: '600' }}>{sc.label}</Text>
          </Pressable>
        ))}
      </View>

      {due.length > 0 && <SectionHeader title="À payer" />}
      {due.map((t) => {
        const [label, tone] = daysLabel(t.current_round!.due_date);
        return (
          <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge icon={RefreshCcw} tone={tone === 'red' ? 'red' : 'brand'} round />
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/tontine/[id]', params: { id: t.id } })}>
              <Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={1}>{t.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}><Text style={{ color: colors.muted, fontSize: 12.5 }}>Tour {t.current_round!.number}</Text><Badge label={label} tone={tone} /></View>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{fcfa(t.contribution_amount)}</Text>
              <Button title="Payer" size="sm" variant="green" onPress={() => pay(t)} />
            </View>
          </Card>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/credit')}>
          <Card style={{ alignItems: 'center', gap: 6 }}>
            <Ring value={(credit.data?.score ?? 0) / 10} size={64} stroke={7} color={colors.brand500}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{credit.data?.score ?? '…'}</Text>
            </Ring>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13 }}>Mon score</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: 'center' }}>Ouvre l'accès au crédit</Text>
          </Card>
        </Pressable>
        <Card style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <IconBadge icon={PartyPopper} tone="gold" size={64} round />
          <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13 }}>Mon prochain pot</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: 'center' }} numberOfLines={2}>{next ? `${shortDate(next.my_turn!)} · ${fcfa(next.contribution_amount * next.max_members)}` : 'Aucun tour prévu'}</Text>
        </Card>
      </View>

      {active.length > 0 && (
        <>
          <SectionHeader title="Mes tontines" action="Tout voir" onAction={() => router.push('/tontines')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }} style={{ marginHorizontal: -2 }}>
            {active.map((t) => {
              const n = t.status === 'recruiting' ? t.members : t.current_round?.number ?? 0;
              return (
                <Pressable key={t.id} onPress={() => router.push({ pathname: '/tontine/[id]', params: { id: t.id } })}>
                  <Card style={{ width: 230, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ring value={(100 * n) / t.max_members} size={52} stroke={6}><Text style={{ fontWeight: '800', fontSize: 12, color: colors.ink }}>{n}/{t.max_members}</Text></Ring>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={1}>{t.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{fcfa(t.contribution_amount)}</Text>
                      <View style={{ marginTop: 4 }}><Badge label={t.status === 'recruiting' ? 'Recrutement' : t.current_round?.paid ? 'Payé' : 'À payer'} tone={t.status === 'recruiting' ? 'blue' : t.current_round?.paid ? 'green' : 'gold'} /></View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Activité récente" action="Tout voir" onAction={() => router.push('/historique')} />
      <Card style={{ paddingVertical: 4 }}>
        {history.data?.entries.length === 0
          ? <EmptyState icon={ArrowDownToLine} title="Aucune opération" text="Fais ton premier dépôt depuis Orange Money, Moov Money ou Wave : c'est gratuit." action={<Button title="Déposer" icon={ArrowDownToLine} variant="green" size="sm" onPress={() => router.push('/depot')} />} />
          : history.data?.entries.map((e, i, a) => <HistoryRow key={e.id + e.created_at} {...e} last={i === a.length - 1} />)}
      </Card>
    </Screen>
  );
}
