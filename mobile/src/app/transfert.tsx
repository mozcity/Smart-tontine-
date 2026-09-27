import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { fcfa, parseAmount } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, P, Screen, notifyError, notifyOk } from '@/components/ui';

export default function Transfert() {
  const { me } = useAuth();
  const [toPhone, setToPhone] = useState('+225');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      if (!me?.has_pin) await api('/auth/me/pin', { method: 'PUT', body: { pin } });
      const r = await api<{ to: string }>('/wallet/transfers', { body: { toPhone: toPhone.replace(/\s/g, ''), amount: parseAmount(amount), note: note || undefined, pin } });
      notifyOk('Transfert réussi', `${fcfa(parseAmount(amount))} envoyés à ${r.to ?? toPhone}`);
      router.back();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <Card>
        <P>Envoie de l'argent gratuitement à un autre utilisateur SMARTFIN.</P>
        <Field label="Numéro du destinataire" value={toPhone} onChangeText={setToPhone} keyboardType="phone-pad" />
        <Field label="Montant (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        <Field label="Motif (facultatif)" value={note} onChangeText={setNote} />
        <Field label={me?.has_pin ? 'Code PIN' : 'Choisis ton code PIN (4 chiffres)'} value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />
        <Button title="Envoyer" variant="green" onPress={submit} loading={loading} disabled={parseAmount(amount) < 100 || pin.length !== 4} />
      </Card>
    </Screen>
  );
}
