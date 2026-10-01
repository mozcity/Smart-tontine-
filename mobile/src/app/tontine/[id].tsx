import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PartnerBrand, brandColor, type Brand } from '@/components/PartnerBrand';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, fcfaShort, shortDate } from '@/lib/format';
import { CalendarClock, CheckCircle2, Circle, Package, PartyPopper, Play } from 'lucide-react-native';
import { Badge, Button, Card, H2, IconBadge, ListItem, P, Progress, Ring, Screen, SectionHeader, colors, notifyError, notifyOk, type Tone } from '@/components/ui';
import { InviteCard } from '@/components/InviteCard';

interface Detail {
  id: string; name: string; description: string | null; status: string; organizer_id: string; contribution_amount: number;
  frequency: 'weekly' | 'monthly'; max_members: number; guarantee_amount: number; balance: number; pot: number;
  me: { position: number | null; status: string; guarantee_status: string } | null;
  manager: boolean; partner: Brand | null; kind: 'argent' | 'bien'; visibility: 'private' | 'public';
  good_label: string | null; good_price: number | null; good_id: string | null;
  orders: { id: string; status: string; amount: number; beneficiary_id: string }[];
  members: { id: string; full_name: string | null; phone: string; position: number | null; status: string }[];
  rounds: { id: string; number: number; beneficiary_id: string; due_date: string; status: string; payout_amount: number | null;
    contributions: { userId: string; source: string; late: boolean }[] | null }[];
}

const today = () => new Date().toISOString().slice(0, 10);

export default function TontineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { data, reload } = useApi<Detail>(`/tontines/${id}`);
  const [busy, setBusy] = useState(false);

  async function run(path: string, ok?: (r: any) => string) {
    setBusy(true);
    try { const r = await api(path, { body: {} }); if (ok) notifyOk(ok(r)); await reload(); } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  if (!data) return <Screen edges={[]}><P>Chargement…</P></Screen>;
  const name = (uid: string) => (uid === me?.id ? 'Toi' : data.members.find((m) => m.id === uid)?.full_name ?? '—');
  const isOrganizer = data.manager;
  const ORDER: Record<string, [string, Tone]> = { pending: ['En préparation', 'gold'], shipped: ['Expédié / prêt', 'blue'], delivered: ['Reçu', 'green'], cancelled: ['Annulé (remboursé)', 'muted'] };
  const current = data.rounds.find((r) => r.status === 'open');
  const done = data.rounds.filter((r) => r.status === 'paid_out').length;
  const iPaid = (r: Detail['rounds'][number]) => r.contributions?.some((c) => c.userId === me?.id);
  const accent = brandColor(data.partner);
  const late = !!current && today() > current.due_date;

  return (
    <Screen onRefresh={reload} edges={[]}>
      {data.partner && <PartnerBrand brand={data.partner} />}
      <View style={{ backgroundColor: accent, borderRadius: 24, padding: 20, gap: 14, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -50, top: -60, width: 170, height: 170, borderRadius: 85, borderWidth: 22, borderColor: 'rgba(255,255,255,.08)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Ring value={data.status === 'recruiting' ? (100 * data.members.length) / data.max_members : (100 * done) / data.max_members} size={66} stroke={7} color="#8BE086">
            <Text style={{ color: '#fff', fontWeight: '800' }}>{data.status === 'recruiting' ? `${data.members.length}/${data.max_members}` : `${done}/${data.max_members}`}</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }} numberOfLines={2}>{data.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 12.5, marginTop: 2 }}>{data.status === 'recruiting' ? 'membres inscrits' : 'tours versés'} · {data.visibility === 'public' ? 'publique' : 'sur invitation'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[[data.kind === 'bien' ? 'Bien à chaque tour' : 'Pot à chaque tour', data.kind === 'bien' ? data.good_label ?? '' : fcfaShort(data.pot)],
            ['Cotisation', `${fcfaShort(data.contribution_amount)} / ${data.frequency === 'weekly' ? 'sem.' : 'mois'}`],
            ['Ton tour', data.me?.position ? `n° ${data.me.position}` : '—']].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 14, padding: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>{k}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {data.status === 'recruiting' && (
        <Card>
          <H2>En attente de membres</H2>
          <P>Chaque membre bloque une caution de {fcfa(data.guarantee_amount)} qui couvre un éventuel impayé.{data.kind === 'bien' ? ' Une tontine de bien démarre complète.' : ''}</P>
          {isOrganizer && <Button title="Démarrer la tontine" icon={Play} variant="green" loading={busy} disabled={data.members.length < 2}
            onPress={() => run(`/tontines/${id}/start`, () => 'Tontine démarrée : l\'ordre de passage est fixé')} />}
        </Card>
      )}
      {data.status === 'recruiting' && (
        <InviteCard code={data.id} name={data.name} amountLabel={`${fcfa(data.contribution_amount)} par ${data.frequency === 'weekly' ? 'semaine' : 'mois'}`} />
      )}

      {current && data.status === 'active' && (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge icon={current.beneficiary_id === me?.id ? PartyPopper : CalendarClock} tone={current.beneficiary_id === me?.id ? 'gold' : late ? 'red' : 'brand'} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16 }}>Tour {current.number} · pour {name(current.beneficiary_id)}</Text>
              <Text style={{ color: late ? colors.danger : colors.muted, fontSize: 12.5 }}>{late ? 'Échéance dépassée' : 'Échéance'} le {shortDate(current.due_date)} · {current.contributions?.length ?? 0}/{data.members.length} cotisations</Text>
            </View>
          </View>
          <Progress value={(100 * (current.contributions?.length ?? 0)) / data.members.length} />
          {!data.me ? <P muted>Tu gères cette tontine sans y cotiser.</P> : iPaid(current)
            ? <Badge label="Ta cotisation est payée" tone="green" />
            : <Button title={`Cotiser ${fcfa(data.contribution_amount)}${late ? ' (+5 % de retard)' : ''}`} variant="green" loading={busy}
                onPress={() => run(`/tontines/${id}/rounds/${current.number}/contribute`, (r) => r.status === 'paid_out' ? 'Tour complet : le pot a été versé !' : 'Cotisation enregistrée')} />}
          {isOrganizer && late && (
            <Button title="Clôturer le tour (cautions des retardataires)" variant="ghost" onPress={() => run(`/tontines/${id}/rounds/${current.number}/close`)} />
          )}
        </Card>
      )}

      {data.orders.length > 0 && (
        <>
          <SectionHeader title="Livraisons des biens" />
          <Card style={{ paddingVertical: 4 }}>
            {data.orders.map((o, i) => (
              <ListItem key={o.id} icon={Package} tone="gold" title={name(o.beneficiary_id)} subtitle={fcfa(o.amount)} last={i === data.orders.length - 1}
                right={<Badge label={ORDER[o.status][0]} tone={ORDER[o.status][1]} />} />
            ))}
            {data.orders.some((o) => o.beneficiary_id === me?.id && o.status !== 'delivered' && o.status !== 'cancelled') &&
              <Button title="Confirmer la réception" variant="soft" onPress={() => router.push('/biens')} />}
          </Card>
        </>
      )}

      {data.rounds.length > 0 && <SectionHeader title="Calendrier" />}
      {data.rounds.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {data.rounds.map((r, i) => {
            const paid = r.status === 'paid_out';
            const isCurrent = r.id === current?.id;
            return (
              <ListItem key={r.id} icon={paid ? CheckCircle2 : isCurrent ? CalendarClock : Circle} tone={paid ? 'green' : isCurrent ? 'brand' : 'muted'}
                title={`Tour ${r.number} · ${name(r.beneficiary_id)}`} subtitle={paid ? `Versé le ${shortDate(r.due_date)}` : `${shortDate(r.due_date)}${isCurrent ? ` · ${r.contributions?.length ?? 0}/${data.members.length} cotisations` : ''}`}
                right={paid ? <Text style={{ fontWeight: '800', color: colors.greenDark }}>{fcfa(r.payout_amount)}</Text> : isCurrent ? <Badge label="En cours" tone="blue" /> : undefined}
                last={i === data.rounds.length - 1} />
            );
          })}
        </Card>
      )}

      <SectionHeader title={`Membres (${data.members.length}/${data.max_members})`} />
      <Card style={{ paddingVertical: 4 }}>
        {data.members.map((m, i) => (
          <View key={m.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }, i < data.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.brand, fontWeight: '800' }}>{(m.full_name ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: colors.ink }}>{m.id === me?.id ? 'Toi' : m.full_name ?? m.phone}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{m.position ? `Tour n° ${m.position}` : 'Ordre fixé au démarrage'}{m.id === data.organizer_id ? ' · organisateur' : ''}</Text>
            </View>
            <Badge label={m.status === 'defaulter' ? 'Impayé' : 'À jour'} tone={m.status === 'defaulter' ? 'red' : 'green'} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
