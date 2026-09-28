import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H1, H2, P, Progress, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

interface Offers {
  score: number;
  factors: { label: string; points: number }[];
  microcredit: { eligible: boolean; reasons: string[]; maxAmount: number; minAmount: number; durations: number[]; monthlyRate: number; apr: number };
  advances: { roundId: string; tontine: string; round: number; dueDate: string; pot: number; months: number; monthlyRate: number; maxAmount: number; eligible: boolean; reasons: string[] }[];
}
interface Loan {
  id: string; product: 'avance_tontine' | 'microcredit'; purpose: string; principal: number; interest: number; status: string; outstanding: number;
  installments: { id: string; number: number; due_date: string; principal: number; interest: number; penalty: number; paid_at: string | null }[];
}

const band = (s: number) => (s >= 750 ? { label: 'Excellent', color: colors.green } : s >= 550 ? { label: 'Bon', color: colors.brand } : s >= 400 ? { label: 'En construction', color: '#B26B00' } : { label: 'Faible', color: colors.danger });

export default function Credit() {
  const { me, refresh } = useAuth();
  const offers = useApi<Offers>('/credit/offers');
  const loans = useApi<Loan[]>('/credit/loans');
  const [pin, setPin] = useState('');
  const [advance, setAdvance] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(3);
  const [purpose, setPurpose] = useState('');
  const [sim, setSim] = useState<{ totalInterest: number; schedule: { interest: number; principal: number }[] } | null>(null);

  useEffect(() => {
    const a = parseAmount(amount);
    if (a < 1000) { setSim(null); return; }
    const t = setTimeout(() => { api(`/credit/simulate?amount=${a}&months=${months}`).then(setSim).catch(() => setSim(null)); }, 300);
    return () => clearTimeout(t);
  }, [amount, months]);

  async function run(path: string, body: Record<string, unknown>, ok: string) {
    try {
      if (!me?.has_pin) await api('/auth/me/pin', { method: 'PUT', body: { pin } });
      await api(path, { body: { ...body, pin } });
      notifyOk(ok);
      await Promise.all([offers.reload(), loans.reload(), refresh()]);
    } catch (e) { notifyError(e); }
  }

  const o = offers.data;
  const b = band(o?.score ?? 0);
  const active = loans.data?.filter((l) => l.status !== 'repaid') ?? [];

  return (
    <Screen onRefresh={() => { void offers.reload(); void loans.reload(); }}>
      <H1>Crédit</H1>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <P muted>Mon score Smart Tontine</P>
            <Text style={{ fontSize: 34, fontWeight: '900', color: b.color }}>{o?.score ?? '—'}<Text style={{ fontSize: 14, color: colors.muted }}> / 1000</Text></Text>
          </View>
          <Text style={{ fontWeight: '700', color: b.color }}>{b.label}</Text>
        </Row>
        <Progress value={(o?.score ?? 0) / 10} />
        {o?.factors.map((f) => (
          <Row key={f.label} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.ink2, flex: 1, fontSize: 13 }}>{f.label}</Text>
            <Text style={{ fontWeight: '700', color: f.points >= 0 ? colors.green : colors.danger }}>{f.points > 0 ? '+' : ''}{f.points}</Text>
          </Row>
        ))}
        <P muted>Cotise à l'heure dans tes tontines, tiens tes e-caisses et rembourse tes crédits pour faire monter ton score.</P>
      </Card>

      <Field label="Code PIN (pour tout crédit ou remboursement)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />

      <H2>Avance sur ma tontine</H2>
      {o?.advances.length === 0 && (
        <Pressable onPress={() => router.push('/tontines')}><Empty text="Rejoins une tontine pour pouvoir avancer ton tour 👉" /></Pressable>
      )}
      {o?.advances.map((a) => (
        <Card key={a.roundId}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>« {a.tontine} » — ton tour n° {a.round} le {shortDate(a.dueDate)}</Text>
          <P>Reçois jusqu'à {fcfa(a.maxAmount)} maintenant. Frais : {(a.monthlyRate * 100).toFixed(1).replace('.', ',')} % par mois ({a.months} mois), remboursés automatiquement sur ton pot.</P>
          {a.eligible ? (
            <>
              <Field label="Montant (FCFA)" value={advance[a.roundId] ?? ''} onChangeText={(v) => setAdvance({ ...advance, [a.roundId]: v })} keyboardType="number-pad" />
              {parseAmount(advance[a.roundId] ?? '') > 0 && <P muted>Frais : {fcfa(Math.ceil(parseAmount(advance[a.roundId] ?? '') * a.monthlyRate * a.months))}</P>}
              <Button title="Recevoir l'avance" variant="green" disabled={pin.length !== 4}
                onPress={() => run('/credit/advances', { roundId: a.roundId, amount: parseAmount(advance[a.roundId] ?? '') }, 'Avance versée sur ton jeton')} />
            </>
          ) : a.reasons.map((r) => <P key={r}>• {r}</P>)}
        </Card>
      ))}

      <H2>Microcrédit</H2>
      <Card>
        {o?.microcredit.eligible ? (
          <>
            <P>Jusqu'à {fcfa(o.microcredit.maxAmount)} · taux {(o.microcredit.apr * 100).toFixed(0)} % / an sur le capital restant dû · sans frais de dossier</P>
            <Field label="Montant (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            <Row style={{ flexWrap: 'wrap' }}>
              {o.microcredit.durations.map((m) => (
                <Pressable key={m} onPress={() => setMonths(m)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: months === m ? colors.green : colors.brandSoft }}>
                  <Text style={{ color: months === m ? '#fff' : colors.brand, fontWeight: '600' }}>{m} mois</Text>
                </Pressable>
              ))}
            </Row>
            {sim && <P>Mensualité ≈ {fcfa(sim.schedule[0].principal + sim.schedule[0].interest)} · coût total {fcfa(sim.totalInterest)}</P>}
            <Field label="Objet du crédit" value={purpose} onChangeText={setPurpose} placeholder="Stock pour mon commerce" />
            <Button title="Demander le crédit" variant="green" disabled={pin.length !== 4 || purpose.length < 3 || parseAmount(amount) < o.microcredit.minAmount}
              onPress={() => run('/credit/loans', { amount: parseAmount(amount), months, purpose }, 'Crédit versé sur ton jeton 💰')} />
          </>
        ) : (
          <>
            <P>Pas encore disponible :</P>
            {o?.microcredit.reasons.map((r) => <P key={r}>• {r}</P>)}
          </>
        )}
      </Card>

      <H2>Mes crédits</H2>
      {active.length === 0 && <Empty text="Aucun crédit en cours." />}
      {active.map((l) => {
        const next = l.installments.find((i) => !i.paid_at);
        const paid = l.installments.filter((i) => i.paid_at).length;
        return (
          <Card key={l.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{l.product === 'avance_tontine' ? '🔄' : '💰'} {l.purpose}</Text>
              <Text style={{ color: l.status === 'defaulted' ? colors.danger : colors.ink2 }}>{l.status === 'defaulted' ? 'En défaut' : 'En cours'}</Text>
            </Row>
            <Progress value={(100 * paid) / l.installments.length} />
            <P>Reste à payer : {fcfa(l.outstanding)} · {paid}/{l.installments.length} échéances</P>
            {next && <P muted>Prochaine échéance : {fcfa(next.principal + next.interest + next.penalty)} le {shortDate(next.due_date)}{next.penalty ? ' (pénalité incluse)' : ''}</P>}
            {l.product === 'avance_tontine'
              ? <P muted>Remboursée automatiquement lors du versement de ton pot.</P>
              : <Button title="Payer l'échéance" disabled={pin.length !== 4} onPress={() => run(`/credit/loans/${l.id}/repay`, {}, 'Échéance payée ✅')} />}
          </Card>
        );
      })}
      <P muted>Crédits accordés et financés par notre partenaire de microfinance agréé. Emprunter engage : vérifie ta capacité de remboursement.</P>
    </Screen>
  );
}
