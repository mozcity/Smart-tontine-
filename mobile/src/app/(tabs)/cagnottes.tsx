import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount } from '@/lib/format';
import { Button, Card, Empty, Field, H1, H2, P, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface Item { id: string; name: string; balance: number; members: number; role: string; target_amount: number | null }

export default function Cagnottes() {
  const list = useApi<Item[]>('/cagnottes');
  const [name, setName] = useState('');
  const [contribution, setContribution] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'free'>('monthly');

  async function create() {
    try {
      const c = await api<{ id: string }>('/cagnottes', { body: { name, frequency, contributionAmount: parseAmount(contribution) || undefined } });
      setName(''); setContribution('');
      router.push({ pathname: '/cagnotte/[id]', params: { id: c.id } });
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <H1>Cagnotte+</H1>
      <P>Épargne à plusieurs, avec double validation et suivi en temps réel. Idéal pour les tontines modernes !</P>
      {list.data?.length === 0 && <Empty text="Tu ne fais partie d'aucune cagnotte." />}
      {list.data?.map((c) => (
        <Pressable key={c.id} onPress={() => router.push({ pathname: '/cagnotte/[id]', params: { id: c.id } })}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>🐷 {c.name}</Text>
              <Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(c.balance)}</Text>
            </Row>
            <P muted>{c.members} membre(s) · {c.role === 'admin' ? 'administrateur' : 'membre'}</P>
          </Card>
        </Pressable>
      ))}
      <Card>
        <H2>Créer une cagnotte</H2>
        <Field label="Nom" value={name} onChangeText={setName} placeholder="Tontine des collègues" />
        <Field label="Cotisation par membre (FCFA, facultatif)" value={contribution} onChangeText={setContribution} keyboardType="number-pad" />
        <Segmented options={[{ value: 'weekly', label: 'Hebdo' }, { value: 'monthly', label: 'Mensuelle' }, { value: 'free', label: 'Libre' }]} value={frequency} onChange={setFrequency} />
        <Button title="Créer" variant="green" onPress={create} disabled={name.length < 2} />
      </Card>
    </Screen>
  );
}
