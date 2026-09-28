import { useState } from 'react';
import { Text, View } from 'react-native';
import { InviteCard } from '@/components/InviteCard';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Field, H1, H2, P, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

interface Cotisations { expected: number; frequency: string; members: { userId: string; name: string; periods: { period: string; paid: number; status: 'paye' | 'partiel' | 'impaye' | 'na' }[] }[] }
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const STATUS_STYLE = { paye: { bg: colors.greenSoft, fg: colors.green, label: '✔' }, partiel: { bg: '#FFF4E0', fg: '#B26B00', label: '½' }, impaye: { bg: colors.dangerSoft, fg: colors.danger, label: '✗' }, na: { bg: colors.bg, fg: colors.muted, label: '–' } };

interface Detail {
  id: string; name: string; visibility: string; frequency: string; description: string | null; balance: number; required_approvals: number; contribution_amount: number | null;
  members: { id: string; full_name: string | null; phone: string; role: string; contributed: number }[];
  withdrawals: { id: string; amount: number; status: string; reason: string | null; beneficiary_id: string; created_at: string; approvals: { userId: string; decision: string }[] | null }[];
}

export default function CagnotteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { data, reload } = useApi<Detail>(`/cagnottes/${id}`);
  const table = useApi<Cotisations>(`/cagnottes/${id}/cotisations?periods=4`);
  const [amount, setAmount] = useState('');
  const [invite, setInvite] = useState('+226');
  const [withdraw, setWithdraw] = useState({ amount: '', phone: '', reason: '' });

  const isAdmin = data?.members.find((m) => m.id === me?.id)?.role === 'admin';
  const nameOf = (uid: string) => data?.members.find((m) => m.id === uid)?.full_name ?? '—';

  async function run(path: string, body: unknown, ok?: string) {
    try { await api(path, { body }); if (ok) notifyOk(ok); await Promise.all([reload(), table.reload()]); } catch (e) { notifyError(e); }
  }

  if (!data) return <Screen><P>Chargement…</P></Screen>;
  return (
    <Screen onRefresh={reload}>
      <H1>🐷 {data.name}</H1>
      <Card style={{ backgroundColor: colors.brand }}>
        <Text style={{ color: '#C9C8F0' }}>Solde du coffre</Text>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{fcfa(data.balance)}</Text>
        <Text style={{ color: '#C9C8F0', fontSize: 12 }}>Chaque retrait exige {data.required_approvals} validations d'administrateurs</Text>
      </Card>

      <Card>
        <H2>Cotiser</H2>
        <Field label="Montant (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder={data.contribution_amount ? String(data.contribution_amount) : '5 000'} />
        <Button title="Cotiser depuis mon jeton" variant="green" onPress={() => run(`/cagnottes/${id}/contribute`, { amount: parseAmount(amount) || data.contribution_amount }, 'Cotisation enregistrée ✅')} />
      </Card>

      {!!table.data?.expected && (
        <>
          <H2>Suivi des cotisations</H2>
          <Card>
            <P muted>Attendu : {fcfa(table.data.expected)} par {table.data.frequency === 'weekly' ? 'semaine' : 'mois'} · ✔ payé · ½ partiel · ✗ impayé · – pas encore membre</P>
            <Row>
              <Text style={{ flex: 1 }} />
              {table.data.members[0]?.periods.map((p) => (
                <Text key={p.period} style={{ width: 44, textAlign: 'center', fontSize: 11, color: colors.muted }}>
                  {table.data!.frequency === 'weekly' ? p.period.slice(8, 10) + '/' + p.period.slice(5, 7) : MONTHS[Number(p.period.slice(5, 7)) - 1]}
                </Text>
              ))}
            </Row>
            {table.data.members.map((m) => (
              <Row key={m.userId}>
                <Text style={{ flex: 1, color: colors.ink }} numberOfLines={1}>{m.name}</Text>
                {m.periods.map((p) => (
                  <View key={p.period} accessibilityLabel={`${p.period} : ${p.status}, ${p.paid} F`}
                    style={{ width: 44, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: STATUS_STYLE[p.status].bg }}>
                    <Text style={{ color: STATUS_STYLE[p.status].fg, fontWeight: '800' }}>{STATUS_STYLE[p.status].label}</Text>
                  </View>
                ))}
              </Row>
            ))}
          </Card>
        </>
      )}

      {isAdmin && <InviteCard code={data.id} name={data.name} amountLabel={data.contribution_amount ? `${fcfa(data.contribution_amount)} de cotisation` : 'coffre de groupe'} />}

      <H2>Membres ({data.members.length})</H2>
      <Card>
        {data.members.map((m) => (
          <Row key={m.id} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.ink }}>{m.full_name ?? m.phone}{m.role === 'admin' ? ' 🛡️' : ''}</Text>
            <Text style={{ fontWeight: '700', color: colors.ink2 }}>{fcfa(m.contributed)}</Text>
          </Row>
        ))}
        {isAdmin && (
          <>
            <Field label="Ajouter un membre (numéro Smart Tontine)" value={invite} onChangeText={setInvite} keyboardType="phone-pad" />
            <Row>
              <Button title="Ajouter membre" variant="ghost" onPress={() => run(`/cagnottes/${id}/members`, { phone: invite.replace(/\s/g, '') })} />
              <Button title="Ajouter admin" variant="ghost" onPress={() => run(`/cagnottes/${id}/members`, { phone: invite.replace(/\s/g, ''), role: 'admin' })} />
            </Row>
          </>
        )}
      </Card>

      <H2>Retraits</H2>
      {data.withdrawals.map((w) => {
        const voted = w.approvals?.some((a) => a.userId === me?.id);
        const approvals = w.approvals?.filter((a) => a.decision === 'approve').length ?? 0;
        return (
          <Card key={w.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700' }}>{fcfa(w.amount)} → {nameOf(w.beneficiary_id)}</Text>
              <Text>{w.status === 'pending' ? `⏳ ${approvals}/${data.required_approvals}` : w.status === 'executed' ? '✅ Versé' : '❌ Refusé'}</Text>
            </Row>
            <P muted>{w.reason ?? 'Sans motif'} · {shortDate(w.created_at)}</P>
            {w.status === 'pending' && isAdmin && !voted && (
              <Row>
                <Button title="Valider" variant="green" onPress={() => run(`/cagnottes/withdrawals/${w.id}/decision`, { decision: 'approve' })} />
                <Button title="Refuser" variant="danger" onPress={() => run(`/cagnottes/withdrawals/${w.id}/decision`, { decision: 'reject' })} />
              </Row>
            )}
          </Card>
        );
      })}
      {isAdmin && (
        <Card>
          <H2>Demander un retrait</H2>
          <Field label="Montant (FCFA)" value={withdraw.amount} onChangeText={(v) => setWithdraw({ ...withdraw, amount: v })} keyboardType="number-pad" />
          <Field label="Bénéficiaire (numéro, vide = moi)" value={withdraw.phone} onChangeText={(v) => setWithdraw({ ...withdraw, phone: v })} keyboardType="phone-pad" />
          <Field label="Motif" value={withdraw.reason} onChangeText={(v) => setWithdraw({ ...withdraw, reason: v })} placeholder="Tour de Awa" />
          <Button title="Soumettre à validation" onPress={() => run(`/cagnottes/${id}/withdrawals`, {
            amount: parseAmount(withdraw.amount), beneficiaryPhone: withdraw.phone.replace(/\s/g, '') || undefined, reason: withdraw.reason || undefined,
          }, 'Demande envoyée aux administrateurs')} />
        </Card>
      )}
    </Screen>
  );
}
