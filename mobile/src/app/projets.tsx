import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Progress, Row, Screen, colors, notifyError } from '@/components/ui';

interface Projet {
  id: string; name: string; balance: number; target_amount: number; progress: number; status: string;
  steps: { id: string; title: string; done_at: string | null }[] | null;
}

export default function Projets() {
  const list = useApi<Projet[]>('/projets');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [steps, setSteps] = useState('');
  const [topup, setTopup] = useState<Record<string, string>>({});

  async function create() {
    try {
      await api('/projets', { body: {
        name, targetAmount: parseAmount(target),
        steps: steps.split(',').map((t) => t.trim()).filter(Boolean).map((title) => ({ title })),
      } });
      setName(''); setTarget(''); setSteps('');
      await list.reload();
    } catch (e) { notifyError(e); }
  }

  async function run(path: string, body?: unknown) {
    try { await api(path, { body: body ?? {} }); await list.reload(); } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <Card>
        <H2>Nouveau projet</H2>
        <P>Voyage, appart, commerce… avance étape par étape.</P>
        <Field label="Nom" value={name} onChangeText={setName} placeholder="Voyage à Assinie" />
        <Field label="Budget total (FCFA)" value={target} onChangeText={setTarget} keyboardType="number-pad" />
        <Field label="Étapes (séparées par des virgules)" value={steps} onChangeText={setSteps} placeholder="Transport, Hôtel, Activités" />
        <Button title="Créer le projet" onPress={create} disabled={name.length < 2 || parseAmount(target) < 1000} />
      </Card>
      {list.data?.length === 0 && <Empty text="Pas encore de projet." />}
      {list.data?.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{p.name}</Text>
            <Text style={{ color: colors.ink2 }}>{p.progress} %</Text>
          </Row>
          <Progress value={p.progress} />
          <P>{fcfa(p.balance)} / {fcfa(p.target_amount)}</P>
          {p.steps?.map((st) => (
            <Text key={st.id} onPress={() => !st.done_at && run(`/projets/${p.id}/steps/${st.id}/done`)} style={{ color: st.done_at ? colors.green : colors.ink2 }}>
              {st.done_at ? '✅' : '⬜'} {st.title}
            </Text>
          ))}
          {p.status === 'active' && (
            <>
              <Field label="Ajouter (FCFA)" value={topup[p.id] ?? ''} onChangeText={(v) => setTopup({ ...topup, [p.id]: v })} keyboardType="number-pad" />
              <Row>
                <Button title="Épargner" variant="green" onPress={() => run(`/projets/${p.id}/contribute`, { amount: parseAmount(topup[p.id] ?? '') })} />
                <Button title="Clôturer" variant="ghost" onPress={() => run(`/projets/${p.id}/close`)} />
              </Row>
            </>
          )}
          {p.status !== 'active' && <P muted>{p.status === 'achieved' ? '🎉 Projet réalisé' : 'Projet clôturé'}</P>}
        </Card>
      ))}
    </Screen>
  );
}
