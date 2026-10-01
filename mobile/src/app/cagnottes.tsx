import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface Item { id: string; name: string; category: string; balance: number; members: number; role: string; contribution_amount: number | null; frequency: string }

const CATEGORIES: { value: string; label: string; glyph: string }[] = [
  { value: 'association', label: 'Association', glyph: '🤝' },
  { value: 'dahira', label: 'Dahira', glyph: '🕌' },
  { value: 'religieux', label: 'Église / mosquée', glyph: '⛪' },
  { value: 'famille', label: 'Famille', glyph: '👨‍👩‍👧' },
  { value: 'gie', label: 'GIE', glyph: '🧺' },
  { value: 'asc', label: 'ASC', glyph: '⚽' },
  { value: 'projet', label: 'Projet commun', glyph: '' },
  { value: 'autre', label: 'Autre', glyph: '' },
];
const glyph = (c: string) => CATEGORIES.find((x) => x.value === c)?.glyph ?? '';

export default function Cagnottes() {
  const list = useApi<Item[]>('/cagnottes');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('association');
  const [contribution, setContribution] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'free'>('monthly');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [code, setCode] = useState('');

  async function create() {
    try {
      const c = await api<{ id: string }>('/cagnottes', {
        body: { name, category, visibility, frequency, contributionAmount: parseAmount(contribution) || undefined },
      });
      setName(''); setContribution('');
      router.push({ pathname: '/cagnotte/[id]', params: { id: c.id } });
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <P>La caisse de ton association, de ton dahira, de ta famille ou de ton GIE : chaque cotisation est visible par tous, et chaque retrait exige deux validations.</P>
      {list.data?.length === 0 && <Empty text="Tu ne fais partie d'aucun coffre de groupe." />}
      {list.data?.map((c) => (
        <Pressable key={c.id} onPress={() => router.push({ pathname: '/cagnotte/[id]', params: { id: c.id } })}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{glyph(c.category)} {c.name}</Text>
              <Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(c.balance)}</Text>
            </Row>
            <P muted>{c.members} membre(s) · {c.role === 'admin' ? 'administrateur' : 'membre'}{c.contribution_amount ? ` · ${fcfa(c.contribution_amount)} / ${c.frequency === 'weekly' ? 'semaine' : 'mois'}` : ''}</P>
          </Card>
        </Pressable>
      ))}

      <Card>
        <H2>Rejoindre avec un code</H2>
        <Field label="Code ou lien d'invitation" value={code} onChangeText={setCode} autoCapitalize="none" />
        <Button title="Continuer" variant="ghost" disabled={code.trim().length < 10}
          onPress={() => router.push({ pathname: '/rejoindre/[code]', params: { code: code.trim().split('/').pop()! } })} />
      </Card>

      <Card>
        <H2>Créer un coffre de groupe</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.value} onPress={() => setCategory(c.value)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: category === c.value ? colors.brand : colors.brandSoft }}>
              <Text style={{ color: category === c.value ? '#fff' : colors.brand, fontSize: 12, fontWeight: '600' }}>{c.glyph} {c.label}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Nom" value={name} onChangeText={setName} placeholder="Dahira des Parcelles Assainies" />
        <Field label="Cotisation attendue par membre (FCFA, facultatif)" value={contribution} onChangeText={setContribution} keyboardType="number-pad" />
        <Segmented options={[{ value: 'weekly', label: 'Hebdo' }, { value: 'monthly', label: 'Mensuelle' }, { value: 'free', label: 'Libre' }]} value={frequency} onChange={setFrequency} />
        <Segmented options={[{ value: 'private', label: 'Sur invitation' }, { value: 'public', label: 'Ouvert avec le code' }]} value={visibility} onChange={setVisibility} />
        <Button title="Créer" variant="green" onPress={create} disabled={name.length < 2} />
      </Card>
    </Screen>
  );
}
