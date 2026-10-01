import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { HandCoins, RefreshCcw, TrendingUp } from 'lucide-react-native';
import { usePin } from '@/lib/pin';
import { AmountInput, Badge, Button, Card, EmptyState, Field, H1, IconBadge, P, Progress, Recap, Ring, Row, Screen, SectionHeader, colors, notifyError, notifyOk } from '@/components/ui';

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

const band = (s: number) => (s >= 750 ? { label: 'Excellent', color: colors.green } : s >= 550 ? { label: 'Bon', color: colors.brand500 } : s >= 400 ? { label: 'En construction', color: '#E09A1B' } : { label: 'Faible', color: colors.danger });

export default function Credit() {
  const { refresh } = useAuth();
  const askPin = usePin();
  const offers = useApi<Offers>('/credit/offers');
  const loans = useApi<Loan[]>('/credit/loans');
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

  async function run(path: string, body: Record<string, unknown>, ok: string, reason: string) {
    const pin = await askPin(reason);
    if (!pin) return;
    try {
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
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring value={(o?.score ?? 0) / 10} size={104} stroke={10} color={b.color}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink }}>{o?.score ?? '—'}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>/ 1000</Text>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 17 }}>Score Smart Tontine</Text>
            <Badge label={b.label} tone={b.label === 'Excellent' ? 'green' : b.label === 'Bon' ? 'brand' : b.label === 'Faible' ? 'red' : 'gold'} />
            <P muted>Cotise à l'heure, épargne et rembourse : ton score monte.</P>
          </View>
        </View>
        <View style={{ backgroundColor: colors.surface2, borderRadius: 14, padding: 12, gap: 6 }}>
          {o?.factors.map((f) => (
            <Row key={f.label} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: colors.ink2, flex: 1, fontSize: 13 }}>{f.label}</Text>
              <Text style={{ fontWeight: '700', color: f.points > 0 ? colors.greenDark : f.points < 0 ? colors.danger : colors.muted }}>{f.points > 0 ? '+' : ''}{f.points}</Text>
            </Row>
          ))}
        </View>
      </Card>

      <SectionHeader title="Avance sur ma tontine" />
      {o?.advances.length === 0 && (
        <Card><EmptyState icon={RefreshCcw} title="Pas encore d'avance possible" text="Rejoins une tontine : tu pourras recevoir une partie de ton pot avant ton tour." action={<Button title="Voir les tontines" size="sm" variant="soft" onPress={() => router.push('/tontines')} />} /></Card>
      )}
      {o?.advances.map((a) => (
        <Card key={a.roundId}>
          <Row><IconBadge icon={RefreshCcw} size={40} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={1}>{a.tontine}</Text><Text style={{ color: colors.muted, fontSize: 12.5 }}>Ton tour n° {a.round} le {shortDate(a.dueDate)} · pot {fcfa(a.pot)}</Text></View></Row>
          <P>Reçois jusqu'à {fcfa(a.maxAmount)} maintenant. Frais : {(a.monthlyRate * 100).toFixed(1).replace('.', ',')} % par mois ({a.months} mois), remboursés automatiquement sur ton pot.</P>
          {a.eligible ? (
            <>
              <AmountInput value={advance[a.roundId] ?? ''} onChange={(v) => setAdvance({ ...advance, [a.roundId]: v })} chips={[Math.floor(a.maxAmount / 2 / 1000) * 1000, a.maxAmount].filter((c) => c >= 1000)} />
              {parseAmount(advance[a.roundId] ?? '') > 0 && <Recap rows={[['Tu reçois maintenant', fcfa(parseAmount(advance[a.roundId] ?? ''))], ['Frais', fcfa(Math.ceil(parseAmount(advance[a.roundId] ?? '') * a.monthlyRate * a.months))], ['Retenu sur ton pot', fcfa(parseAmount(advance[a.roundId] ?? '') + Math.ceil(parseAmount(advance[a.roundId] ?? '') * a.monthlyRate * a.months)), true]]} />}
              <Button title="Recevoir l'avance" icon={HandCoins} variant="green" disabled={parseAmount(advance[a.roundId] ?? '') < 1 || parseAmount(advance[a.roundId] ?? '') > a.maxAmount}
                onPress={() => run('/credit/advances', { roundId: a.roundId, amount: parseAmount(advance[a.roundId] ?? '') }, 'Avance versée sur ton jeton', `Avance de ${fcfa(parseAmount(advance[a.roundId] ?? ''))} sur « ${a.tontine} »`)} />
            </>
          ) : a.reasons.map((r) => <Badge key={r} label={r} tone="gold" />)}
        </Card>
      ))}

      <SectionHeader title="Microcrédit" />
      <Card style={{ gap: 14 }}>
        {o?.microcredit.eligible ? (
          <>
            <P>Jusqu'à {fcfa(o.microcredit.maxAmount)} · taux {(o.microcredit.apr * 100).toFixed(0)} % / an sur le capital restant dû · sans frais de dossier</P>
            <AmountInput value={amount} onChange={setAmount} chips={[25000, 50000, 100000].filter((c) => c <= o.microcredit.maxAmount)} />
            <Row style={{ flexWrap: 'wrap' }}>
              {o.microcredit.durations.map((m) => (
                <Pressable key={m} onPress={() => setMonths(m)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: months === m ? colors.green : colors.brandSoft }}>
                  <Text style={{ color: months === m ? '#fff' : colors.brand, fontWeight: '600' }}>{m} mois</Text>
                </Pressable>
              ))}
            </Row>
            {sim && <P>Mensualité ≈ {fcfa(sim.schedule[0].principal + sim.schedule[0].interest)} · coût total {fcfa(sim.totalInterest)}</P>}
            <Field label="Objet du crédit" value={purpose} onChangeText={setPurpose} placeholder="Stock pour mon commerce" />
            <Button title="Demander le crédit" icon={HandCoins} variant="green" disabled={purpose.length < 3 || parseAmount(amount) < o.microcredit.minAmount || parseAmount(amount) > o.microcredit.maxAmount}
              onPress={() => run('/credit/loans', { amount: parseAmount(amount), months, purpose }, 'Crédit versé sur ton jeton', `Microcrédit de ${fcfa(parseAmount(amount))} sur ${months} mois`)} />
          </>
        ) : (
          <>
            <Row><IconBadge icon={TrendingUp} tone="gold" /><Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>Pas encore disponible</Text></Row>
            {o?.microcredit.reasons.map((r) => <P key={r}>• {r}</P>)}
            {o?.microcredit.reasons.some((r) => /identité/i.test(r)) && <Button title="Vérifier mon identité" size="sm" variant="soft" onPress={() => router.push('/identite')} />}
          </>
        )}
      </Card>

      <SectionHeader title="Mes crédits" />
      {active.length === 0 && <Card><EmptyState icon={HandCoins} title="Aucun crédit en cours" /></Card>}
      {active.map((l) => {
        const next = l.installments.find((i) => !i.paid_at);
        const paid = l.installments.filter((i) => i.paid_at).length;
        return (
          <Card key={l.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{l.purpose}</Text>
              <Text style={{ color: l.status === 'defaulted' ? colors.danger : colors.ink2 }}>{l.status === 'defaulted' ? 'En défaut' : 'En cours'}</Text>
            </Row>
            <Progress value={(100 * paid) / l.installments.length} />
            <P>Reste à payer : {fcfa(l.outstanding)} · {paid}/{l.installments.length} échéances</P>
            {next && <P muted>Prochaine échéance : {fcfa(next.principal + next.interest + next.penalty)} le {shortDate(next.due_date)}{next.penalty ? ' (pénalité incluse)' : ''}</P>}
            {l.product === 'avance_tontine'
              ? <P muted>Remboursée automatiquement lors du versement de ton pot.</P>
              : <Button title="Payer l'échéance" onPress={() => run(`/credit/loans/${l.id}/repay`, {}, 'Échéance payée', `Payer l'échéance de ${fcfa(next ? next.principal + next.interest + next.penalty : 0)}`)} />}
          </Card>
        );
      })}
      <P muted>Crédits accordés et financés par notre partenaire de microfinance agréé. Emprunter engage : vérifie ta capacité de remboursement.</P>
    </Screen>
  );
}
