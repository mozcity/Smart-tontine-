import { Link, useNavigate, useSearchParams } from 'react-router';
import { fcfa, FREQ, TONTINE_STATUS } from '../../lib/format';
import { CreateTontineForm } from '../../components/CreateTontineForm';
import { Badge, Button, Empty, Modal, PageHead } from '../../components/ui';
import { CATEGORIES, CreateCoffre } from '../app/Coffres';
import { usePartner } from './context';

export default function Groupes() {
  const { dash: d, reload } = usePartner();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const creating = params.get('creer');
  const active = d.partner.status === 'active';
  return (
    <div className="stack">
      <PageHead title="Tontines et coffres" sub="Tous les groupes organisés au nom de votre espace.">
        <Button disabled={!active} onClick={() => setParams({ creer: 'tontine' })}>+ Tontine</Button>
        <Button variant="ghost" disabled={!active} onClick={() => setParams({ creer: 'coffre' })}>+ Coffre</Button>
      </PageHead>
      <div className="card stack-sm">
        <h2>Tontines ({d.tontines.length})</h2>
        {!d.tontines.length ? <Empty>Aucune tontine.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Nom</th><th>Type</th><th>Cotisation</th><th>Membres</th><th>Visibilité</th><th>Statut</th></tr></thead>
            <tbody>{d.tontines.map((t) => { const [l, tone] = TONTINE_STATUS[t.status] ?? [t.status, 'muted']; return (
              <tr key={t.id}>
                <td><Link to={`/app/tontines/${t.id}`}><b>{t.name}</b></Link></td>
                <td>{t.kind === 'bien' ? `🛍️ ${t.good_label}` : '💰 Argent'}</td>
                <td className="nowrap">{fcfa(t.contribution_amount)} / {FREQ[t.frequency]}</td>
                <td>{t.members}/{t.max_members}{t.defaulters > 0 && <> · <Badge tone="danger">{t.defaulters} défaillant{t.defaulters > 1 ? 's' : ''}</Badge></>}</td>
                <td>{t.visibility === 'public' ? 'Publique' : 'Privée'}</td>
                <td><Badge tone={tone}>{l}</Badge></td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </div>
      <div className="card stack-sm">
        <h2>Coffres de groupe ({d.coffres.length})</h2>
        {!d.coffres.length ? <Empty>Aucun coffre.</Empty> : d.coffres.map((c) => (
          <div key={c.id} className="list-row"><Link className="grow" to={`/app/coffres/${c.id}`}><b>{c.name}</b></Link><Badge tone="brand">{CATEGORIES[c.category] ?? c.category}</Badge><span className="xs">{c.members} membres</span><span className="amount">{fcfa(c.balance)}</span></div>
        ))}
      </div>
      {creating === 'tontine' && (
        <Modal title={`Nouvelle tontine — ${d.partner.name}`} onClose={() => setParams({})}>
          <CreateTontineForm partnerId={d.partner.id} managementFeeRate={Number(d.partner.management_fee_rate)} onCreated={async (id) => { await reload(); nav(`/app/tontines/${id}`); }} />
        </Modal>
      )}
      {creating === 'coffre' && <CreateCoffre partnerId={d.partner.id} onClose={() => setParams({})} onCreated={async () => { setParams({}); await reload(); }} />}
    </div>
  );
}
