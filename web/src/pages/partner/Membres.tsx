import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { fcfa } from '../../lib/format';
import { Badge, Empty, Input, Loading, PageHead } from '../../components/ui';
import { usePartner } from './context';

interface M { id: string; full_name: string | null; phone: string; kyc_level: number; groups: { name: string; kind: string; status: string }[]; defaulter: boolean; late_payments: number; contributed: number }

export default function Membres() {
  const { dash } = usePartner();
  const { data, loading } = useApi<M[]>(`/partners/${dash.partner.id}/members`);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'risk'>('all');
  const rows = (data ?? []).filter((m) => (filter === 'all' || m.defaulter || m.late_payments > 0)
    && (!q || `${m.full_name} ${m.phone}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack">
      <PageHead title="Membres" sub={`${data?.length ?? 0} membres dans vos groupes · ${dash.activeMembers} actifs (base de la licence)`}>
        <select className="input" style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'risk')} aria-label="Filtre">
          <option value="all">Tous les membres</option><option value="risk">Retards et défaillances</option>
        </select>
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
      </PageHead>
      <div className="card">
        {loading ? <Loading /> : !rows.length ? <Empty>Aucun membre.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Membre</th><th>Groupes</th><th className="right">Cotisé</th><th>Retards</th><th>Statut</th></tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.id}>
                <td><b>{m.full_name ?? '—'}</b><div className="xs">{m.phone} · KYC {m.kyc_level}</div></td>
                <td className="small">{m.groups.map((g) => `${g.kind === 'coffre' ? 'Coffre' : 'Tontine'} « ${g.name} »`).join(' · ')}</td>
                <td className="right amount">{fcfa(m.contributed)}</td>
                <td>{m.late_payments ? <Badge tone="warn">{m.late_payments}</Badge> : '0'}</td>
                <td>{m.defaulter ? <Badge tone="danger">Défaillant</Badge> : <Badge tone="ok">À jour</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
