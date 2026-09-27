import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface Contrat {
  id: string; title: string; kind: string; principal: number; repaid: number; status: string;
  creator_id: string; counterparty_id: string; creditor_id: string; debtor_id: string; creditor_name: string; debtor_name: string;
  echeances: { id: string; due_on: string; amount: number; paid_at: string | null }[];
}
const STATUS: Record<string, string> = { draft: '✍️ À signer', active: '🟢 Actif', completed: '✅ Soldé', cancelled: 'Annulé' };

export default function Contrats() {
  const { me } = useAuth();
  const list = useApi<Contrat[]>('/contrats');
  const [form, setForm] = useState({ phone: '+225', title: '', amount: '', months: '2', role: 'creditor' as 'creditor' | 'debtor' });
  const [pin, setPin] = useState('');

  async function create() {
    const principal = parseAmount(form.amount);
    const n = Math.max(1, Number(form.months) || 1);
    const base = Math.floor(principal / n);
    const echeances = Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i + 1);
      return { dueOn: d.toISOString().slice(0, 10), amount: i === n - 1 ? principal - base * (n - 1) : base };
    });
    try {
      await api('/contrats', { body: { counterpartyPhone: form.phone.replace(/\s/g, ''), title: form.title, kind: 'pret', myRole: form.role, principal, echeances } });
      setForm({ ...form, title: '', amount: '' });
      await list.reload();
    } catch (e) { notifyError(e); }
  }

  async function run(path: string, body: unknown = {}) {
    try { await api(path, { body }); await list.reload(); } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <Card>
        <H2>Nouveau contrat de prêt</H2>
        <P>Prête ou emprunte entre proches, en toute transparence : signature des deux côtés, échéancier, rappels.</P>
        <Segmented options={[{ value: 'creditor', label: 'Je prête' }, { value: 'debtor', label: "J'emprunte" }]} value={form.role} onChange={(role) => setForm({ ...form, role })} />
        <Field label="Numéro de l'autre personne" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
        <Field label="Objet" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Prêt pour le commerce" />
        <Field label="Montant (FCFA)" value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} keyboardType="number-pad" />
        <Field label="Nombre de mensualités" value={form.months} onChangeText={(months) => setForm({ ...form, months })} keyboardType="number-pad" />
        <Button title="Proposer le contrat" onPress={create} disabled={form.title.length < 2 || parseAmount(form.amount) < 500} />
      </Card>

      <Field label="Code PIN (signature et remboursements)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />
      {list.data?.length === 0 && <Empty text="Aucun contrat." />}
      {list.data?.map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{c.title}</Text>
            <Text>{STATUS[c.status]}</Text>
          </Row>
          <P>{c.creditor_name} → {c.debtor_name} · {fcfa(c.principal)} · remboursé {fcfa(c.repaid)}</P>
          {c.status === 'draft' && c.counterparty_id === me?.id && <Button title="Signer" variant="green" onPress={() => run(`/contrats/${c.id}/sign`, { pin })} disabled={pin.length !== 4} />}
          {c.status === 'draft' && <Button title="Annuler" variant="ghost" onPress={() => run(`/contrats/${c.id}/cancel`)} />}
          {c.echeances?.map((e) => (
            <Row key={e.id} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: e.paid_at ? colors.green : colors.ink2 }}>{e.paid_at ? '✅' : '🗓️'} {shortDate(e.due_on)} — {fcfa(e.amount)}</Text>
              {c.status === 'active' && !e.paid_at && c.debtor_id === me?.id && (
                <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={() => pin.length === 4 ? run(`/contrats/${c.id}/echeances/${e.id}/pay`, { pin }) : notifyError(new Error('Saisis ton code PIN'))}>Payer</Text>
              )}
            </Row>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
