import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ArrowUpFromLine } from 'lucide-react-native';
import { api } from '@/lib/api';
import { fcfa, parseAmount } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { usePin } from '@/lib/pin';
import { AmountInput, Button, Card, P, Recap, Screen, notifyError, notifyOk } from '@/components/ui';
import { ChannelPicker } from '@/components/ChannelPicker';

export default function Retrait() {
  const { me, refresh } = useAuth();
  const askPin = usePin();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [quote, setQuote] = useState<{ fee: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const a = parseAmount(amount);
  const balance = me?.wallet_balance ?? 0;
  const tooMuch = !!quote && quote.total > balance;

  useEffect(() => {
    if (a < 100) { setQuote(null); return; }
    const t = setTimeout(() => { api(`/wallet/withdrawals/quote?amount=${a}`).then(setQuote).catch(() => setQuote(null)); }, 250);
    return () => clearTimeout(t);
  }, [a]);

  async function submit() {
    const pin = await askPin(`Retrait de ${fcfa(a)} vers ton compte Mobile Money`);
    if (!pin) return;
    setLoading(true);
    try {
      const r = await api<{ fee: number }>('/wallet/withdrawals', { body: { amount: a, channel, pin } });
      notifyOk('Retrait envoyé', `${fcfa(a)} arrivent sur ton compte (frais : ${fcfa(r.fee)}).`);
      await refresh();
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 18 }}>
        <P muted>Solde disponible : {fcfa(balance)}</P>
        <AmountInput value={amount} onChange={setAmount} label="Montant à recevoir" chips={[5000, 10000, 25000].filter((c) => c < balance)} />
        <ChannelPicker value={channel} onChange={setChannel} />
        {quote && <Recap rows={[['Tu reçois', fcfa(a)], ['Frais', quote.fee ? fcfa(quote.fee) : 'Offerts'], ['Débité de ton jeton', fcfa(quote.total), true]]} />}
        {tooMuch && <P style={{ color: '#D63B3B' }}>Solde insuffisant.</P>}
        <Button title="Retirer" icon={ArrowUpFromLine} onPress={submit} loading={loading} disabled={a < 100 || tooMuch} />
      </Card>
      <P muted style={{ textAlign: 'center' }}>{me?.plan === 'plus' ? 'Smart Tontine+ : 3 retraits offerts chaque mois.' : 'Frais : 1 % (min. 100 F). Avec Smart Tontine+ (500 F/mois), 3 retraits offerts chaque mois.'}</P>
    </Screen>
  );
}
