import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H1, H2, P, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface TontineItem {
  id: string; name: string; contribution_amount: number; frequency: 'weekly' | 'monthly'; max_members: number; members: number;
  status: 'recruiting' | 'active' | 'completed' | 'cancelled'; my_turn: string | null; position: number | null;
  current_round: { number: number; due_date: string; beneficiary_id: string; paid: boolean } | null;
}
interface Preview { id: string; name: string; organizer: string; contribution_amount: number; frequency: string; members: number; max_members: number; guarantee_amount: number; pot: number; status: string }

const FREQ: Record<string, string> = { weekly: 'semaine', monthly: 'mois' };
const STATUS: Record<string, string> = { recruiting: '👥 Recrutement', active: '🟢 En cours', completed: '✅ Terminée', cancelled: 'Annulée' };

export default function Tontines() {
  const { me } = useAuth();
  const list = useApi<TontineItem[]>('/tontines');
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', members: '5', frequency: 'monthly' as 'weekly' | 'monthly', order: 'random' as 'random' | 'fixed' });

  async function lookup() {
    try { setPreview(await api<Preview>(`/tontines/${code.trim().split('/').pop()}/preview`)); } catch (e) { notifyError(e); }
  }
  async function join() {
    try { await api(`/tontines/${preview!.id}/join`, { body: {} }); setPreview(null); setCode(''); await list.reload(); } catch (e) { notifyError(e); }
  }
  async function create() {
    try {
      const t = await api<{ id: string }>('/tontines', { body: {
        name: form.name, contributionAmount: parseAmount(form.amount), maxMembers: Number(form.members), frequency: form.frequency, orderMode: form.order,
      } });
      router.push({ pathname: '/tontine/[id]', params: { id: t.id } });
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <H1>Mes tontines</H1>
      <P>Cotise à chaque tour et reçois tout le pot quand vient ton tour. Chaque cotisation à l'heure fait monter ton score de crédit.</P>
      {list.data?.length === 0 && <Empty text="Tu ne participes à aucune tontine pour l'instant." />}
      {list.data?.map((t) => {
        const r = t.current_round;
        const mine = r?.beneficiary_id === me?.id;
        return (
          <Pressable key={t.id} onPress={() => router.push({ pathname: '/tontine/[id]', params: { id: t.id } })}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>🔄 {t.name}</Text>
                <Text style={{ fontSize: 12 }}>{STATUS[t.status]}</Text>
              </Row>
              <P>{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · {t.members}/{t.max_members} membres · pot {fcfa(t.contribution_amount * t.max_members)}</P>
              {t.status === 'active' && r && (
                <View style={{ backgroundColor: r.paid ? colors.greenSoft : colors.dangerSoft, borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>
                    Tour {r.number} · échéance {shortDate(r.due_date)} {mine ? '· 🎉 c\'est ton tour' : ''}
                  </Text>
                  <Text style={{ color: r.paid ? colors.green : colors.danger }}>{r.paid ? '✔ Cotisation payée' : '⏳ Cotisation à payer'}</Text>
                </View>
              )}
              {t.my_turn && t.status === 'active' && <P muted>Ton tour : n° {t.position} le {shortDate(t.my_turn)}</P>}
            </Card>
          </Pressable>
        );
      })}

      <Segmented options={[{ value: 'join', label: 'Rejoindre' }, { value: 'create', label: 'Créer' }]} value={mode} onChange={setMode} />
      {mode === 'join' ? (
        <Card>
          <H2>Rejoindre avec un code</H2>
          <Field label="Code ou lien d'invitation reçu de l'organisateur" value={code} onChangeText={setCode} autoCapitalize="none" />
          <Button title="Voir la tontine" variant="ghost" onPress={lookup} disabled={code.trim().length < 10} />
          {preview && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{preview.name}</Text>
              <P>Organisée par {preview.organizer} · {fcfa(preview.contribution_amount)} / {FREQ[preview.frequency]}</P>
              <P>{preview.members}/{preview.max_members} membres · pot de {fcfa(preview.pot)}</P>
              <P muted>Caution bloquée à l'adhésion : {fcfa(preview.guarantee_amount)}, rendue en fin de tontine si tu cotises à chaque tour.</P>
              <Button title="Rejoindre et bloquer la caution" variant="green" onPress={join} disabled={preview.status !== 'recruiting'} />
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <H2>Créer une tontine</H2>
          <Field label="Nom" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Tontine des collègues" />
          <Field label="Cotisation par tour (FCFA)" value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} keyboardType="number-pad" placeholder="25 000" />
          <Field label="Nombre de membres" value={form.members} onChangeText={(members) => setForm({ ...form, members })} keyboardType="number-pad" />
          <Segmented options={[{ value: 'weekly', label: 'Hebdomadaire' }, { value: 'monthly', label: 'Mensuelle' }]} value={form.frequency} onChange={(frequency) => setForm({ ...form, frequency })} />
          <Segmented options={[{ value: 'random', label: 'Ordre tiré au sort' }, { value: 'fixed', label: 'Ordre fixé' }]} value={form.order} onChange={(order) => setForm({ ...form, order })} />
          {parseAmount(form.amount) > 0 && <P>Pot à chaque tour : {fcfa(parseAmount(form.amount) * (Number(form.members) || 0))} (commission Smart Tontine 1 %)</P>}
          <Button title="Créer la tontine" variant="green" onPress={create} disabled={form.name.length < 2 || parseAmount(form.amount) < 500 || Number(form.members) < 2} />
        </Card>
      )}
    </Screen>
  );
}
