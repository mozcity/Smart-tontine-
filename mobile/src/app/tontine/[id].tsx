import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PartnerBrand, brandColor, type Brand } from '@/components/PartnerBrand';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, shortDate } from '@/lib/format';
import { Button, Card, H1, H2, P, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';
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

  if (!data) return <Screen><P>Chargement…</P></Screen>;
  const name = (uid: string) => data.members.find((m) => m.id === uid)?.full_name ?? '—';
  const isOrganizer = data.manager;
  const ORDER: Record<string, string> = { pending: '📦 Commandé, en préparation', shipped: '🚚 Expédié / prêt', delivered: '✅ Reçu', cancelled: 'Annulé (remboursé)' };
  const current = data.rounds.find((r) => r.status === 'open');
  const iPaid = (r: Detail['rounds'][number]) => r.contributions?.some((c) => c.userId === me?.id);

  return (
    <Screen onRefresh={reload}>
      <PartnerBrand brand={data.partner} />
      <H1>{data.kind === 'bien' ? '🛵' : '🔄'} {data.name}</H1>
      <Card style={{ backgroundColor: brandColor(data.partner) }}>
        <Text style={{ color: '#ffffffcc' }}>{data.kind === 'bien' ? 'Bien reçu à chaque tour' : 'Pot à chaque tour'}</Text>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{data.kind === 'bien' ? data.good_label : fcfa(data.pot)}</Text>
        {data.kind === 'bien' && <Text style={{ color: '#ffffffcc' }}>Valeur {fcfa(data.good_price)} · {data.good_id ? 'fournisseur partenaire, paiement au séquestre' : 'pot versé au bénéficiaire pour l\'achat'}</Text>}
        <Text style={{ color: '#C9C8F0', fontSize: 12 }}>
          {fcfa(data.contribution_amount)} par {data.frequency === 'weekly' ? 'semaine' : 'mois'} · caution {fcfa(data.guarantee_amount)}
          {data.me?.position ? ` · ton tour : n° ${data.me.position}` : ''} · {data.visibility === 'public' ? 'publique' : 'privée'}
        </Text>
      </Card>

      {data.status === 'recruiting' && (
        <Card>
          <H2>En attente de membres ({data.members.length}/{data.max_members})</H2>
          <P>Chaque membre bloque une caution qui couvre un éventuel impayé.</P>
          {isOrganizer && <Button title="Démarrer la tontine" variant="green" loading={busy} disabled={data.members.length < 2}
            onPress={() => run(`/tontines/${id}/start`, () => 'Tontine démarrée : l\'ordre de passage est fixé')} />}
        </Card>
      )}

      {data.status === 'recruiting' && (
        <InviteCard code={data.id} name={data.name} amountLabel={`${fcfa(data.contribution_amount)} par ${data.frequency === 'weekly' ? 'semaine' : 'mois'}`} />
      )}

      {current && data.status === 'active' && (
        <Card>
          <H2>Tour {current.number} — pour {current.beneficiary_id === me?.id ? 'toi 🎉' : name(current.beneficiary_id)}</H2>
          <P>Échéance le {shortDate(current.due_date)} · {current.contributions?.length ?? 0}/{data.members.length} cotisations reçues</P>
          {!data.me ? <P muted>Tu gères cette tontine sans y cotiser.</P> : iPaid(current)
            ? <Text style={{ color: colors.green, fontWeight: '700' }}>✔ Ta cotisation est payée</Text>
            : <Button title={`Cotiser ${fcfa(data.contribution_amount)}${today() > current.due_date ? ' (+5 % de retard)' : ''}`} variant="green" loading={busy}
                onPress={() => run(`/tontines/${id}/rounds/${current.number}/contribute`, (r) => r.status === 'paid_out' ? 'Tour complet : le pot a été versé !' : 'Cotisation enregistrée ✅')} />}
          {isOrganizer && today() > current.due_date && (
            <Button title="Clôturer le tour (cautions des retardataires)" variant="ghost" onPress={() => run(`/tontines/${id}/rounds/${current.number}/close`)} />
          )}
        </Card>
      )}

      {data.orders.length > 0 && (
        <>
          <H2>Livraisons des biens</H2>
          <Card>
            {data.orders.map((o) => (
              <Row key={o.id} style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.ink }}>{o.beneficiary_id === me?.id ? 'Toi' : name(o.beneficiary_id)}</Text>
                <Text style={{ color: colors.ink2 }}>{ORDER[o.status]}</Text>
              </Row>
            ))}
            {data.orders.some((o) => o.beneficiary_id === me?.id && o.status !== 'delivered' && o.status !== 'cancelled') &&
              <Button title="Confirmer la réception dans « Mes biens »" variant="ghost" onPress={() => router.push('/biens')} />}
          </Card>
        </>
      )}

      <H2>Calendrier</H2>
      {data.rounds.map((r) => (
        <Card key={r.id} style={{ paddingVertical: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>Tour {r.number} · {r.beneficiary_id === me?.id ? 'Toi' : name(r.beneficiary_id)}</Text>
            <Text style={{ color: r.status === 'paid_out' ? colors.green : colors.ink2 }}>{r.status === 'paid_out' ? `✅ ${fcfa(r.payout_amount)}` : shortDate(r.due_date)}</Text>
          </Row>
          {r.status === 'open' && <P muted>{r.contributions?.length ?? 0}/{data.members.length} cotisations · {iPaid(r) ? 'payé' : 'à payer'}</P>}
        </Card>
      ))}

      <H2>Membres</H2>
      <Card>
        {data.members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.ink }}>{m.position ? `${m.position}. ` : ''}{m.full_name ?? m.phone}{m.id === data.organizer_id ? ' 👑' : ''}</Text>
            <Text style={{ color: m.status === 'defaulter' ? colors.danger : colors.green }}>{m.status === 'defaulter' ? 'impayé' : 'à jour'}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
