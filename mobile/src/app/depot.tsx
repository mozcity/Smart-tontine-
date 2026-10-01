import { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownToLine } from 'lucide-react-native';
import { ChannelPicker } from '@/components/ChannelPicker';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount } from '@/lib/format';
import { AmountInput, Button, Card, P, Recap, Screen, notifyError, notifyOk } from '@/components/ui';

export default function Depot() {
  const { refresh } = useAuth();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [loading, setLoading] = useState(false);
  const a = parseAmount(amount);

  async function submit() {
    setLoading(true);
    try {
      const r = await api<{ paymentUrl?: string; reference: string }>('/wallet/deposits', { body: { amount: a, channel } });
      // Fournisseur simulé (développement, démonstration) : confirmation immédiate.
      if (r.paymentUrl?.includes('example.test')) {
        await api(`/wallet/deposits/${r.reference}/simulate`, { body: {} });
        await refresh();
        notifyOk('Dépôt confirmé (démo)', `${fcfa(a)} sont sur ton jeton.`);
        router.back();
        return;
      }
      if (r.paymentUrl) await Linking.openURL(r.paymentUrl).catch(() => undefined);
      notifyOk('Paiement en cours', 'Valide le paiement sur ton application Mobile Money. Ton jeton sera crédité dès confirmation.');
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 18 }}>
        <AmountInput value={amount} onChange={setAmount} />
        <ChannelPicker value={channel} onChange={setChannel} />
        {a >= 100 && <Recap rows={[['Tu déposes', fcfa(a)], ['Frais', 'Gratuit'], ['Crédité sur ton jeton', fcfa(a), true]]} />}
        <Button title={a >= 100 ? `Déposer ${fcfa(a)}` : 'Déposer'} icon={ArrowDownToLine} variant="green" onPress={submit} loading={loading} disabled={a < 100} />
      </Card>
      <P muted style={{ textAlign: 'center' }}>Dépôt gratuit dès 100 F. Tu valides le paiement sur ton téléphone.</P>
    </Screen>
  );
}
