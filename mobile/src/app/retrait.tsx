import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { fcfa, parseAmount } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, P, Screen, notifyError, notifyOk } from '@/components/ui';
import { ChannelPicker } from '@/components/ChannelPicker';

export default function Retrait() {
  const { me, refresh } = useAuth();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('wave');
  const [pin, setPin] = useState('');
  const [quote, setQuote] = useState<{ fee: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const value = parseAmount(amount);

  useEffect(() => {
    if (value < 100) { setQuote(null); return; }
    const t = setTimeout(() => { api(`/wallet/withdrawals/quote?amount=${value}`).then(setQuote).catch(() => setQuote(null)); }, 300);
    return () => clearTimeout(t);
  }, [value]);

  async function submit() {
    setLoading(true);
    try {
      if (!me?.has_pin) await api('/auth/me/pin', { method: 'PUT', body: { pin } });
      const r = await api<{ fee: number }>('/wallet/withdrawals', { body: { amount: value, channel, pin } });
      notifyOk('Retrait envoyé ✅', `${fcfa(value)} arrivent sur ton compte (frais : ${fcfa(r.fee)}).`);
      await refresh();
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <Card>
        <Field label="Montant à recevoir (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="20 000" />
        <ChannelPicker value={channel} onChange={setChannel} />
        {quote && <P>Frais : {fcfa(quote.fee)} · Total débité : {fcfa(quote.total)}</P>}
        <Field label={me?.has_pin ? 'Code PIN' : 'Choisis ton code PIN (4 chiffres)'} value={pin} onChangeText={setPin}
          keyboardType="number-pad" secureTextEntry maxLength={4} />
        <Button title="Retirer" onPress={submit} loading={loading} disabled={value < 100 || pin.length !== 4} />
        <P muted>{me?.plan === 'plus' ? 'Smart Tontine+ : 3 retraits offerts chaque mois.' : 'Frais : 1 % (min. 100 F). Avec Smart Tontine+ (500 F/mois), 3 retraits offerts chaque mois.'}</P>
      </Card>
    </Screen>
  );
}
