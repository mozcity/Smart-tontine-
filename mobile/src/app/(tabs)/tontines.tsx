import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Compass, KeyRound, Plus, RefreshCcw, ShoppingBag } from 'lucide-react-native';
import { PartnerBrand, type Brand } from '@/components/PartnerBrand';
import { CreateTontineForm } from '@/components/CreateTontineForm';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, shortDate } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, H1, H2, IconBadge, P, Progress, Recap, Ring, Screen, Segmented, colors, notifyError, type Tone } from '@/components/ui';

interface TontineItem {
  id: string; name: string; kind: 'argent' | 'bien'; good_label: string | null; partner: Brand | null; contribution_amount: number; frequency: 'weekly' | 'monthly'; max_members: number; members: number;
  status: 'recruiting' | 'active' | 'completed' | 'cancelled'; my_turn: string | null; position: number | null;
  current_round: { number: number; due_date: string; beneficiary_id: string; paid: boolean } | null;
}
interface PublicTontine {
  id: string; name: string; kind: 'argent' | 'bien'; contribution_amount: number; frequency: string; max_members: number; members: number;
  guarantee_amount: number; good_label: string | null; good_price: number | null; good_image: string | null; partner: Brand | null;
}
interface Preview { id: string; name: string; organizer: string; contribution_amount: number; frequency: string; members: number; max_members: number; guarantee_amount: number; pot: number; status: string }

const FREQ: Record<string, string> = { weekly: 'semaine', monthly: 'mois' };
const STATUS: Record<string, [string, Tone]> = { recruiting: ['Recrutement', 'blue'], active: ['En cours', 'green'], completed: ['Terminée', 'muted'], cancelled: ['Annulée', 'muted'] };
type Mode = 'mine' | 'discover' | 'join' | 'create';

export default function Tontines() {
  const list = useApi<TontineItem[]>('/tontines');
  const [mode, setMode] = useState<Mode>('mine');
  const [kindFilter, setKindFilter] = useState<'tous' | 'argent' | 'bien'>('tous');
  const discover = useApi<PublicTontine[]>(mode === 'discover' ? `/tontines/public${kindFilter === 'tous' ? '' : `?kind=${kindFilter}`}` : null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  async function lookup() {
    try { setPreview(await api<Preview>(`/tontines/${code.trim().split('/').pop()}/preview`)); } catch (e) { notifyError(e); }
  }
  async function join() {
    try { await api(`/tontines/${preview!.id}/join`, { body: {} }); const id = preview!.id; setPreview(null); setCode(''); await list.reload(); router.push({ pathname: '/tontine/[id]', params: { id } }); } catch (e) { notifyError(e); }
  }
  const open = (id: string) => router.push({ pathname: '/tontine/[id]', params: { id } });

  return (
    <Screen onRefresh={list.reload}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <H1>Tontines</H1>
        <Pressable onPress={() => setMode('create')} accessibilityLabel="Créer une tontine"
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>
      <Segmented options={[{ value: 'mine', label: 'Les miennes' }, { value: 'discover', label: 'Découvrir' }, { value: 'join', label: 'Code' }, { value: 'create', label: 'Créer' }]} value={mode} onChange={setMode} />

      {mode === 'mine' && (list.data?.length === 0
        ? <Card><EmptyState icon={RefreshCcw} title="Aucune tontine" text="Crée ta tontine en 1 minute ou rejoins une tontine publique." action={<View style={{ flexDirection: 'row', gap: 8 }}><Button title="Créer" icon={Plus} size="sm" variant="green" onPress={() => setMode('create')} /><Button title="Découvrir" icon={Compass} size="sm" variant="ghost" onPress={() => setMode('discover')} /></View>} /></Card>
        : list.data?.map((t) => {
          const r = t.current_round;
          const n = t.status === 'recruiting' ? t.members : r?.number ?? (t.status === 'completed' ? t.max_members : 0);
          const [label, tone] = STATUS[t.status];
          return (
            <Pressable key={t.id} onPress={() => open(t.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Ring value={(100 * n) / t.max_members} size={58} stroke={6}><Text style={{ fontWeight: '800', fontSize: 13, color: colors.ink }}>{n}/{t.max_members}</Text></Ring>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }} numberOfLines={1}>{t.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5 }}>{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · {t.kind === 'bien' ? t.good_label : `pot ${fcfa(t.contribution_amount * t.max_members)}`}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}><Badge label={label} tone={tone} />{t.kind === 'bien' && <Badge label="Bien" tone="gold" />}</View>
                  </View>
                </View>
                {t.status === 'active' && r && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: r.paid ? colors.greenSoft : colors.goldSoft, borderRadius: 12, padding: 10 }}>
                    <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>Tour {r.number} · avant le {shortDate(r.due_date)}</Text>
                    <Text style={{ color: r.paid ? colors.greenDark : colors.gold, fontWeight: '700', fontSize: 13 }}>{r.paid ? 'Payé' : 'À payer'}</Text>
                  </View>
                )}
                {t.my_turn && t.status === 'active' && <P muted>Ton pot : tour n° {t.position}, le {shortDate(t.my_turn)}</P>}
                {t.partner && <PartnerBrand brand={t.partner} size="sm" />}
              </Card>
            </Pressable>
          );
        }))}

      {mode === 'discover' && (
        <>
          <Segmented options={[{ value: 'tous', label: 'Toutes' }, { value: 'argent', label: 'Argent' }, { value: 'bien', label: 'Biens' }]} value={kindFilter} onChange={setKindFilter} />
          {discover.data?.length === 0 && <Card><EmptyState icon={Compass} title="Rien pour l'instant" text="Aucune tontine publique en recrutement. Crée la tienne !" /></Card>}
          {discover.data?.map((t) => (
            <Pressable key={t.id} onPress={() => router.push({ pathname: '/rejoindre/[code]', params: { code: t.id } })}>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {t.good_image ? <Image source={{ uri: t.good_image }} style={{ width: 52, height: 52, borderRadius: 14 }} /> : <IconBadge icon={t.kind === 'bien' ? ShoppingBag : RefreshCcw} tone={t.kind === 'bien' ? 'gold' : 'brand'} size={52} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15.5 }} numberOfLines={2}>{t.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5 }}>{t.kind === 'bien' ? `${t.good_label} · ${fcfa(t.good_price)}` : `Pot de ${fcfa(t.contribution_amount * t.max_members)}`}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', color: colors.ink }}>{fcfa(t.contribution_amount)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5 }}>/ {FREQ[t.frequency]}</Text>
                  </View>
                </View>
                <Progress value={(100 * t.members) / t.max_members} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{t.max_members - t.members} place{t.max_members - t.members > 1 ? 's' : ''} · caution {fcfa(t.guarantee_amount)}</Text>
                  {t.partner && <PartnerBrand brand={t.partner} size="sm" />}
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {mode === 'join' && (
        <Card style={{ gap: 14 }}>
          <IconBadge icon={KeyRound} size={48} />
          <H2>Rejoindre avec un code</H2>
          <Field label="Code ou lien reçu de l'organisateur" value={code} onChangeText={setCode} autoCapitalize="none" placeholder="Colle ici le lien d'invitation" />
          <Button title="Voir la tontine" variant="soft" onPress={lookup} disabled={code.trim().length < 10} />
          {preview && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 17 }}>{preview.name}</Text>
              <P muted>Organisée par {preview.organizer}</P>
              <Recap rows={[['Cotisation', `${fcfa(preview.contribution_amount)} / ${FREQ[preview.frequency]}`], ['Membres', `${preview.members}/${preview.max_members}`], ['Caution (rendue à la fin)', fcfa(preview.guarantee_amount)], ['Pot à ton tour', fcfa(preview.pot), true]]} />
              <Button title={`Rejoindre et bloquer ${fcfa(preview.guarantee_amount)}`} variant="green" onPress={join} disabled={preview.status !== 'recruiting'} />
            </View>
          )}
        </Card>
      )}
      {mode === 'create' && (
        <CreateTontineForm onCreated={(id) => { setMode('mine'); void list.reload(); open(id); }} />
      )}
    </Screen>
  );
}
