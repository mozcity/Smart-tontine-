import { useState } from 'react';
import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { api } from '@/lib/api';
import { fcfa, parseAmount } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { usePin } from '@/lib/pin';
import { AmountInput, Button, Card, Field, P, Recap, Screen, notifyError, notifyOk } from '@/components/ui';

export default function Transfert() {
  const { me, refresh } = useAuth();
  const askPin = usePin();
  const [toPhone, setToPhone] = useState('+226');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const a = parseAmount(amount);
  const phone = toPhone.replace(/\s/g, '');

  async function submit() {
    const pin = await askPin(`Envoyer ${fcfa(a)} au ${phone}`);
    if (!pin) return;
    setLoading(true);
    try {
      const r = await api<{ to: string }>('/wallet/transfers', { body: { toPhone: phone, amount: a, note: note || undefined, pin } });
      notifyOk('Transfert réussi', `${fcfa(a)} envoyés à ${r.to ?? phone}`);
      await refresh();
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 18 }}>
        <Field label="Numéro du destinataire" value={toPhone} onChangeText={setToPhone} keyboardType="phone-pad" />
        <AmountInput value={amount} onChange={setAmount} chips={[1000, 5000, 10000].filter((c) => c <= (me?.wallet_balance ?? 0))} />
        <Field label="Motif (facultatif)" value={note} onChangeText={setNote} placeholder="Pour la cotisation de juin" />
        {a >= 100 && <Recap rows={[['Destinataire', phone], ['Frais', 'Gratuit'], ['Montant envoyé', fcfa(a), true]]} />}
        <Button title="Envoyer" icon={Send} variant="green" onPress={submit} loading={loading} disabled={a < 100 || phone.length < 10} />
      </Card>
      <P muted style={{ textAlign: 'center' }}>Gratuit et immédiat entre membres Smart Tontine.</P>
    </Screen>
  );
}
