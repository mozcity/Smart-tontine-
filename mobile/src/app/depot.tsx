import { useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { ChannelPicker } from '@/components/ChannelPicker';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { parseAmount } from '@/lib/format';
import { Button, Card, Field, P, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

export default function Depot() {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('wave');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const r = await api<{ paymentUrl?: string; reference: string }>('/wallet/deposits', { body: { amount: parseAmount(amount), channel } });
      // Fournisseur simulé (développement, démonstration) : confirmation immédiate, sans ouvrir de page de paiement.
      if (r.paymentUrl?.includes('example.test')) {
        await api(`/wallet/deposits/${r.reference}/simulate`, { body: {} });
        notifyOk('Dépôt confirmé (démo)', 'Ton jeton est crédité.');
        router.back();
        return;
      }
      if (r.paymentUrl) await Linking.openURL(r.paymentUrl).catch(() => undefined);
      notifyOk('Paiement en cours', 'Valide le paiement sur ton application Mobile Money. Ton jeton sera crédité dès confirmation.');
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <Card>
        <P>Recharge ton jeton gratuitement depuis ton compte Mobile Money.</P>
        <Field label="Montant (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="10 000" />
        <Row style={{ flexWrap: 'wrap' }}>
          {[5000, 10000, 25000, 50000].map((v) => (
            <Pressable key={v} onPress={() => setAmount(String(v))} style={{ backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 }}>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>{v.toLocaleString('fr-FR')}</Text>
            </Pressable>
          ))}
        </Row>
        <ChannelPicker value={channel} onChange={setChannel} />
        <Button title="Déposer" variant="green" onPress={submit} loading={loading} disabled={parseAmount(amount) < 100} />
        <P muted>Dépôt gratuit · minimum 100 FCFA</P>
      </Card>
    </Screen>
  );
}
