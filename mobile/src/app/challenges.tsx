import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Progress, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

interface Data {
  catalog: { id: string; code: string; title: string; description: string; target_amount: number; duration_days: number; reward_points: number; reward_fcfa: number }[];
  mine: { id: string; code: string; title: string; status: string; balance: number; target_amount: number; progress: number; ends_at: string }[];
}

export default function Challenges() {
  const { data, reload } = useApi<Data>('/challenges');
  const board = useApi<{ name: string; points: number }[]>('/challenges/leaderboard');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  async function run(path: string, body: unknown = {}, done?: (r: any) => void) {
    try { const r = await api(path, { body }); done?.(r); await reload(); } catch (e) { notifyError(e); }
  }

  const active = data?.mine.filter((m) => m.status === 'active') ?? [];
  const joined = new Set(active.map((m) => m.code));
  const toCollect = data?.mine.filter((m) => m.status !== 'active' && m.balance > 0) ?? [];

  return (
    <Screen onRefresh={reload}>
      <H2>Mes défis en cours</H2>
      {active.length === 0 && <Empty text="Relève ton premier défi ci-dessous 👇" />}
      {[...active, ...toCollect].map((m) => (
        <Card key={m.id}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{m.title}</Text>
          <Progress value={m.progress} />
          <P>{fcfa(m.balance)} / {fcfa(m.target_amount)} · fin le {shortDate(m.ends_at)}</P>
          {m.status === 'active' && (
            <>
              <Field label="Épargner (FCFA)" value={amounts[m.id] ?? ''} onChangeText={(v) => setAmounts({ ...amounts, [m.id]: v })} keyboardType="number-pad" />
              <Button title="J'épargne" variant="green" onPress={() => run(`/challenges/participations/${m.id}/save`, { amount: parseAmount(amounts[m.id] ?? '') },
                (r) => r.status === 'completed' && notifyOk('Challenge réussi 🏆', `+${r.reward.points} points`))} />
            </>
          )}
          <Button title={m.status === 'active' ? 'Abandonner et récupérer' : 'Récupérer mon épargne'} variant="ghost" onPress={() => run(`/challenges/participations/${m.id}/withdraw`)} />
        </Card>
      ))}

      <H2>Défis disponibles</H2>
      {data?.catalog.map((c) => (
        <Card key={c.id}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{c.title}</Text>
          <P>{c.description}</P>
          <P muted>Objectif {fcfa(c.target_amount)} · {c.duration_days} jours · 🏅 {c.reward_points} pts{c.reward_fcfa ? ` + ${fcfa(c.reward_fcfa)} offerts` : ''}</P>
          {!joined.has(c.code) && <Button title="Relever le défi" onPress={() => run(`/challenges/${c.code}/join`)} />}
        </Card>
      ))}

      <H2>Classement</H2>
      <Card>
        {board.data?.length ? board.data.map((b, i) => (
          <Row key={i} style={{ justifyContent: 'space-between' }}><Text>{i + 1}. {b.name}</Text><Text style={{ fontWeight: '700' }}>{b.points} pts</Text></Row>
        )) : <Empty text="Sois le premier du classement !" />}
      </Card>
    </Screen>
  );
}
