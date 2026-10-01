import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount } from '@/lib/format';
import { Button, Card, Empty, Field, H1, H2, P, Progress, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface Summary {
  month: string; income: number; expense: number; balance: number;
  categories: { category: string; planned: number; spent: number; remaining: number; alert: 'attention' | 'depasse' | null }[];
  entries: { id: string; kind: string; category: string; amount: number; note: string | null; occurred_on: string }[];
}

const shift = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default function Budget() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, reload } = useApi<Summary>(`/budget/summary?month=${month}`);
  const cats = useApi<string[]>('/budget/categories');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Alimentation');
  const [amount, setAmount] = useState('');
  const [planCat, setPlanCat] = useState('Alimentation');
  const [planAmount, setPlanAmount] = useState('');

  async function addEntry() {
    try {
      await api('/budget/entries', { body: { kind, category: kind === 'income' ? 'Revenus' : category, amount: parseAmount(amount) } });
      setAmount(''); await reload();
    } catch (e) { notifyError(e); }
  }

  async function setPlan() {
    const items = (data?.categories ?? []).filter((c) => c.planned > 0 && c.category !== planCat).map((c) => ({ category: c.category, planned: c.planned }));
    items.push({ category: planCat, planned: parseAmount(planAmount) });
    try { await api(`/budget/plans/${month}`, { method: 'PUT', body: { items } }); setPlanAmount(''); await reload(); } catch (e) { notifyError(e); }
  }

  const [y, m] = month.split('-').map(Number);
  return (
    <Screen onRefresh={reload}>
      <H1>Budget</H1>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text onPress={() => setMonth(shift(month, -1))} style={{ fontSize: 22, color: colors.brand, padding: 6 }}>‹</Text>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{MONTHS[m - 1]} {y}</Text>
        <Text onPress={() => setMonth(shift(month, 1))} style={{ fontSize: 22, color: colors.brand, padding: 6 }}>›</Text>
      </Row>
      <Row>
        <Card style={{ flex: 1 }}><P muted>Revenus</P><Text style={{ fontWeight: '800', color: colors.green }}>{fcfa(data?.income)}</Text></Card>
        <Card style={{ flex: 1 }}><P muted>Dépenses</P><Text style={{ fontWeight: '800', color: colors.danger }}>{fcfa(data?.expense)}</Text></Card>
      </Row>
      <Card style={{ backgroundColor: colors.brand }}>
        <Text style={{ color: '#C9C8F0' }}>Reste à vivre</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{fcfa(data?.balance)}</Text>
      </Card>

      <H2>Par catégorie</H2>
      {data?.categories.length === 0 && <Empty text="Fixe un plafond par catégorie pour éviter les mauvaises surprises." />}
      {data?.categories.map((c) => (
        <Card key={c.category}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{c.category}</Text>
            <Text style={{ color: c.alert === 'depasse' ? colors.danger : colors.ink2 }}>{fcfa(c.spent)}{c.planned ? ` / ${fcfa(c.planned)}` : ''}</Text>
          </Row>
          {c.planned > 0 && <Progress value={(100 * c.spent) / c.planned} />}
          {c.alert === 'attention' && <P>Plus de 80 % du budget utilisé</P>}
          {c.alert === 'depasse' && <P>🚨 Budget dépassé de {fcfa(-c.remaining)}</P>}
        </Card>
      ))}

      <Card>
        <H2>Ajouter une opération</H2>
        <Segmented options={[{ value: 'expense', label: 'Dépense' }, { value: 'income', label: 'Revenu' }]} value={kind} onChange={setKind} />
        {kind === 'expense' && <CategoryChips cats={cats.data ?? []} value={category} onChange={setCategory} />}
        <Field label="Montant (FCFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        <Button title="Enregistrer" variant="green" onPress={addEntry} disabled={parseAmount(amount) <= 0} />
      </Card>

      <Card>
        <H2>Fixer un plafond mensuel</H2>
        <CategoryChips cats={cats.data ?? []} value={planCat} onChange={setPlanCat} />
        <Field label="Plafond (FCFA)" value={planAmount} onChangeText={setPlanAmount} keyboardType="number-pad" />
        <Button title="Enregistrer le plafond" onPress={setPlan} disabled={parseAmount(planAmount) <= 0} />
      </Card>
    </Screen>
  );
}

function CategoryChips({ cats, value, onChange }: { cats: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {cats.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: c === value ? colors.brand : colors.brandSoft }}>
          <Text style={{ color: c === value ? '#fff' : colors.brand, fontSize: 12, fontWeight: '600' }}>{c}</Text>
        </Pressable>
      ))}
    </View>
  );
}
