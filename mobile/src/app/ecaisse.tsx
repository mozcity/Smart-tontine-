import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

interface Ecaisse { id: string; name: string; balance: number; unlock_at: string; status: 'locked' | 'released' | 'broken' }
const DURATIONS = [{ label: '1 mois', days: 30 }, { label: '3 mois', days: 90 }, { label: '6 mois', days: 180 }, { label: '1 an', days: 365 }];

export default function EcaisseScreen() {
  const list = useApi<Ecaisse[]>('/ecaisses');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState(90);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const unlockAt = new Date(Date.now() + days * 86400_000).toISOString();
      await api('/ecaisses', { body: { name, amount: parseAmount(amount), unlockAt } });
      setName(''); setAmount('');
      notifyOk('Argent bloqué 🔒', `Rendez-vous le ${shortDate(unlockAt)} !`);
      await list.reload();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  async function breakIt(e: Ecaisse) {
    try {
      const r = await api<{ returned: number; penalty: number }>(`/ecaisses/${e.id}/break`, { body: { pin } });
      notifyOk('E-caisse cassée', `${fcfa(r.returned)} rendus (pénalité ${fcfa(r.penalty)})`);
      await list.reload();
    } catch (err) { notifyError(err); }
  }

  const locked = list.data?.filter((e) => e.status === 'locked') ?? [];
  return (
    <Screen onRefresh={list.reload}>
      <Card>
        <H2>Bloque une somme, résiste à la tentation</H2>
        <P>L'argent revient automatiquement sur ton jeton à la date choisie. Besoin avant ? Possible, avec 2 % de pénalité.</P>
        <Field label="Nom de l'objectif" value={name} onChangeText={setName} placeholder="Rentrée scolaire" />
        <Field label="Montant à bloquer (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        <Row style={{ flexWrap: 'wrap' }}>
          {DURATIONS.map((d) => (
            <Pressable key={d.days} onPress={() => setDays(d.days)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: days === d.days ? colors.green : colors.brandSoft }}>
              <Text style={{ color: days === d.days ? '#fff' : colors.brand, fontWeight: '600' }}>{d.label}</Text>
            </Pressable>
          ))}
        </Row>
        <Button title="Bloquer mon argent" variant="green" onPress={create} loading={loading} disabled={name.length < 2 || parseAmount(amount) < 500} />
      </Card>

      <H2>Mes e-caisses</H2>
      {locked.length === 0 && <Empty text="Aucune e-caisse active." />}
      {locked.map((e) => (
        <Card key={e.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>🔒 {e.name}</Text>
            <Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(e.balance)}</Text>
          </Row>
          <P muted>Déblocage le {shortDate(e.unlock_at)}</P>
          <Field label="Code PIN (pour casser la caisse)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />
          <Button title="Casser la caisse (−2 %)" variant="ghost" onPress={() => breakIt(e)} disabled={pin.length !== 4} />
        </Card>
      ))}
    </Screen>
  );
}
