import { useState } from 'react';
import { api, download } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { CHANNELS, dateTime, fcfa, parseAmount, TX_LABELS } from '../../lib/format';
import { Badge, Button, Empty, Field, Input, Kpi, PageHead, Select, useAction, useUi } from '../../components/ui';
import { usePartner } from './context';

interface Entry { id: string; created_at: string; reference: string; type: string; description: string; amount: number; balance_after: number }

export default function Finances() {
  const { dash, reload } = usePartner();
  const id = dash.partner.id;
  const [range, setRange] = useState({ from: '', to: '' });
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
  const st = useApi<Entry[]>(`/partners/${id}/statement${qs ? `?${qs}` : ''}`);
  const [topup, setTopup] = useState('');
  const [w, setW] = useState({ amount: '', channel: 'orange_money', phone: dash.partner.phone ?? '' });
  const act = useAction();
  const { askPin } = useUi();
  const refresh = async () => { await reload(); await st.reload(); };
  const due = dash.invoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="stack">
      <PageHead title="Finances" sub="Compte partenaire : frais de gestion, ventes, licence. Les fonds des membres ne transitent jamais par ce compte.">
        <Button variant="ghost" onClick={() => act(() => download(`/partners/${id}/statement.csv${qs ? `?${qs}` : ''}`, `releve-${dash.partner.name}.csv`), 'Relevé exporté')}>Exporter le relevé (CSV)</Button>
      </PageHead>
      <div className="kpis">
        <div className="card tight kpi hero-card" style={{ background: dash.partner.primary_color }}><span className="xs">Solde du compte partenaire</span><b>{fcfa(dash.balance)}</b></div>
        <Kpi label="Frais de gestion perçus" value={fcfa(dash.managementFeesEarned)} />
        <Kpi label="Licence estimée ce mois" value={fcfa(dash.estimatedInvoice)} hint={`${dash.activeMembers} membres actifs`} />
        <Kpi label="Factures dues" value={fcfa(due)} hint={due ? 'réglées dès l’alimentation du compte' : 'à jour'} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack-sm">
          <h2>Retirer vers Mobile Money</h2>
          <div className="form-grid">
            <Field label="Montant (F)"><Input inputMode="numeric" value={w.amount} onChange={(e) => setW({ ...w, amount: e.target.value })} /></Field>
            <Field label="Opérateur"><Select value={w.channel} onChange={(e) => setW({ ...w, channel: e.target.value })}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Numéro"><Input value={w.phone} onChange={(e) => setW({ ...w, phone: e.target.value })} /></Field>
          </div>
          <p className="xs">Frais de retrait : 1 % (min. 100 F).</p>
          <Button disabled={parseAmount(w.amount) < 100} onClick={async () => {
            const pin = await askPin(`Retrait de ${fcfa(parseAmount(w.amount))} du compte « ${dash.partner.name} »`);
            if (pin && await act(() => api(`/partners/${id}/withdraw`, { body: { amount: parseAmount(w.amount), channel: w.channel, phone: w.phone || undefined, pin } }), 'Retrait envoyé')) { setW({ ...w, amount: '' }); await refresh(); }
          }}>Retirer</Button>
        </div>
        <div className="card stack-sm">
          <h2>Alimenter le compte</h2>
          <p className="muted small">Depuis votre jeton personnel, pour payer la licence. Les factures dues sont réglées automatiquement.</p>
          <div className="row"><Input style={{ width: 160 }} inputMode="numeric" value={topup} onChange={(e) => setTopup(e.target.value)} placeholder={due ? String(due) : 'Montant'} />
            <Button disabled={parseAmount(topup) < 100} onClick={async () => { if (await act(() => api(`/partners/${id}/topup`, { body: { amount: parseAmount(topup) } }), 'Compte alimenté')) { setTopup(''); await refresh(); } }}>Alimenter</Button></div>
          <h3 style={{ marginTop: 12 }}>Factures de licence</h3>
          {!dash.invoices.length ? <Empty>Aucune facture pour l’instant (facturation le 1er du mois).</Empty> : dash.invoices.map((i) => (
            <div key={i.id} className="list-row"><span className="grow">{i.month} · {i.active_members} membres actifs</span><span className="amount">{fcfa(i.amount)}</span><Badge tone={i.status === 'paid' ? 'ok' : 'warn'}>{i.status === 'paid' ? 'Payée' : 'Due'}</Badge></div>
          ))}
        </div>
      </div>
      <div className="card stack-sm">
        <div className="row between"><h2>Relevé du compte</h2>
          <div className="row">
            <Field label="Du"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="Au"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          </div></div>
        {!st.data?.length ? <Empty>Aucune opération sur la période.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Opération</th><th>Référence</th><th className="right">Montant</th><th className="right">Solde</th></tr></thead>
            <tbody>{st.data.map((e) => (
              <tr key={e.id}><td className="nowrap">{dateTime(e.created_at)}</td><td><b className="small">{TX_LABELS[e.type] ?? e.type}</b><div className="xs">{e.description}</div></td>
                <td className="xs">{e.reference}</td><td className={`right amount ${e.amount > 0 ? 'pos' : 'neg'}`}>{e.amount > 0 ? '+' : ''}{fcfa(e.amount)}</td><td className="right">{fcfa(e.balance_after)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
