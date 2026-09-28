import { useState } from 'react';
import { useParams } from 'react-router';
import { api, download } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { date, fcfa, FREQ, parseAmount } from '../../lib/format';
import { InviteBox } from '../../components/InviteBox';
import { Badge, Button, ErrorBox, Field, Input, Kpi, Loading, PageHead, useAction } from '../../components/ui';
import { CATEGORIES } from './Coffres';

interface Detail { id: string; name: string; description: string | null; category: string; balance: number; contribution_amount: number | null; frequency: string;
  target_amount: number | null; required_approvals: number; status: string;
  members: { id: string; full_name: string | null; phone: string; role: string; contributed: number }[];
  withdrawals: { id: string; amount: number; reason: string | null; status: string; created_at: string; approvals: { userId: string; decision: string }[] | null }[] }
interface Cotisations { expected: number; members: { userId: string; name: string; periods: { period: string; paid: number; status: string }[] }[] }
const STATUS: Record<string, [string, 'ok' | 'warn' | 'danger' | 'muted']> = { paye: ['Payé', 'ok'], partiel: ['Partiel', 'warn'], impaye: ['Impayé', 'danger'], na: ['—', 'muted'] };

export default function CoffreDetail() {
  const { id } = useParams();
  const { me, refresh } = useAuth();
  const { data: c, error, reload } = useApi<Detail>(`/cagnottes/${id}`);
  const cot = useApi<Cotisations>(`/cagnottes/${id}/cotisations?periods=6`);
  const act = useAction();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('+226');
  const [w, setW] = useState({ amount: '', reason: '', beneficiaryPhone: '' });
  if (error) return <ErrorBox error={error} />;
  if (!c) return <Loading />;
  const admin = c.members.find((m) => m.id === me?.id)?.role === 'admin';
  const run = async (fn: () => Promise<unknown>, msg: string) => { if (await act(fn, msg)) { await reload(); void cot.reload(); void refresh(); } };

  return (
    <div className="stack">
      <PageHead title={c.name} sub={<>{CATEGORIES[c.category]} · {c.members.length} membres {admin && <Badge tone="info">Administrateur</Badge>}</>} />
      <div className="kpis">
        <div className="card tight kpi hero-card"><span className="xs">Solde du coffre</span><b>{fcfa(c.balance)}</b></div>
        <Kpi label="Cotisation attendue" value={c.contribution_amount ? fcfa(c.contribution_amount) : 'Libre'} hint={c.contribution_amount ? `par ${FREQ[c.frequency]}` : undefined} />
        <Kpi label="Objectif" value={c.target_amount ? fcfa(c.target_amount) : '—'} />
        <Kpi label="Retraits" value={`${c.required_approvals} validation${c.required_approvals > 1 ? 's' : ''}`} hint="d’administrateurs" />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack-sm">
          <h2>Cotiser</h2>
          <div className="row"><Input style={{ width: 160 }} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={c.contribution_amount ? String(c.contribution_amount) : 'Montant'} />
            <Button variant="green" disabled={parseAmount(amount || String(c.contribution_amount ?? '')) < 100} onClick={() => run(() => api(`/cagnottes/${c.id}/contribute`, { body: { amount: parseAmount(amount || String(c.contribution_amount)) } }), 'Cotisation versée ✅')}>Cotiser</Button></div>
        </div>
        <div className="card stack-sm"><h2>Inviter</h2><InviteBox id={c.id} name={c.name} /></div>
      </div>
      {cot.data && (
        <div className="card stack-sm">
          <div className="row between"><h2>Suivi des cotisations</h2>
            {admin && <Button size="sm" variant="ghost" onClick={() => act(() => download(`/cagnottes/${c.id}/cotisations.csv`, `cotisations-${c.name}.csv`))}>Exporter (CSV)</Button>}</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Membre</th>{cot.data.members[0]?.periods.map((p) => <th key={p.period}>{date(p.period).slice(3)}</th>)}</tr></thead>
            <tbody>{cot.data.members.map((m) => (
              <tr key={m.userId}><td><b>{m.name}</b></td>{m.periods.map((p) => { const [l, tone] = STATUS[p.status]; return <td key={p.period}><Badge tone={tone}>{l}</Badge>{p.paid > 0 && <div className="xs">{fcfa(p.paid)}</div>}</td>; })}</tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack-sm">
          <h2>Membres</h2>
          {c.members.map((m) => <div key={m.id} className="list-row"><div className="grow"><b className="small">{m.full_name ?? m.phone}</b> {m.role === 'admin' && <Badge tone="info">Admin</Badge>}<div className="xs">{m.phone}</div></div><span className="amount">{fcfa(m.contributed)}</span></div>)}
          {admin && <div className="row"><Input style={{ width: 180 }} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))} aria-label="Téléphone" />
            <Button size="sm" onClick={() => run(() => api(`/cagnottes/${c.id}/members`, { body: { phone } }), 'Membre ajouté')}>Ajouter</Button>
            <Button size="sm" variant="ghost" onClick={() => run(() => api(`/cagnottes/${c.id}/members`, { body: { phone, role: 'admin' } }), 'Administrateur ajouté')}>… comme admin</Button></div>}
        </div>
        <div className="card stack-sm">
          <h2>Retraits</h2>
          {c.withdrawals.map((x) => {
            const mine = x.approvals?.find((a) => a.userId === me?.id);
            return (
              <div key={x.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                <div className="grow"><b>{fcfa(x.amount)}</b> <Badge tone={x.status === 'executed' ? 'ok' : x.status === 'rejected' ? 'danger' : 'warn'}>{{ pending: 'En attente', executed: 'Exécuté', rejected: 'Refusé' }[x.status] ?? x.status}</Badge>
                  <div className="xs">{x.reason ?? '—'} · {date(x.created_at)} · {x.approvals?.filter((a) => a.decision === 'approve').length ?? 0}/{c.required_approvals} validations</div></div>
                {admin && x.status === 'pending' && !mine && <>
                  <Button size="sm" variant="green" onClick={() => run(() => api(`/cagnottes/withdrawals/${x.id}/decision`, { body: { decision: 'approve' } }), 'Retrait validé')}>Valider</Button>
                  <Button size="sm" variant="ghost" onClick={() => run(() => api(`/cagnottes/withdrawals/${x.id}/decision`, { body: { decision: 'reject' } }), 'Retrait refusé')}>Refuser</Button></>}
              </div>
            );
          })}
          {admin && (
            <div className="stack-sm" style={{ marginTop: 8 }}>
              <div className="form-grid">
                <Field label="Montant (F)"><Input inputMode="numeric" value={w.amount} onChange={(e) => setW({ ...w, amount: e.target.value })} /></Field>
                <Field label="Bénéficiaire (tél.)"><Input value={w.beneficiaryPhone} onChange={(e) => setW({ ...w, beneficiaryPhone: e.target.value })} placeholder="moi par défaut" /></Field>
              </div>
              <Field label="Motif"><Input value={w.reason} onChange={(e) => setW({ ...w, reason: e.target.value })} /></Field>
              <Button size="sm" disabled={parseAmount(w.amount) < 100} onClick={() => run(() => api(`/cagnottes/${c.id}/withdrawals`, { body: { amount: parseAmount(w.amount), reason: w.reason || undefined, beneficiaryPhone: w.beneficiaryPhone || undefined } }), 'Demande de retrait créée')}>Demander un retrait</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
