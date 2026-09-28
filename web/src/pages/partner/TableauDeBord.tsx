import { Link } from 'react-router';
import { date, fcfa, FREQ, pct, TONTINE_STATUS } from '../../lib/format';
import { Badge, Empty, Kpi, PageHead } from '../../components/ui';
import { usePartner } from './context';

export default function TableauDeBord() {
  const { dash: d } = usePartner();
  const base = `/partenaire/${d.partner.id}`;
  const active = d.tontines.filter((t) => t.status === 'active');
  const defaulters = d.tontines.reduce((s, t) => s + t.defaulters, 0);
  const toShip = d.orders.filter((o) => o.status === 'pending');
  const due = d.invoices.filter((i) => i.status === 'due');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="stack">
      <PageHead title="Tableau de bord" sub={`Frais de gestion : ${pct(d.partner.management_fee_rate, 1)} de chaque pot`}>
        <Link className="btn" to={`${base}/groupes?creer=tontine`}>+ Nouvelle tontine</Link>
      </PageHead>
      <div className="kpis">
        <Kpi label="Membres actifs" value={d.activeMembers} hint="base de la licence du mois" />
        <Kpi label="Collecté ce mois" value={fcfa(d.collectedThisMonth)} hint="cotisations de vos tontines" />
        <Kpi label="Frais de gestion perçus" value={fcfa(d.managementFeesEarned)} hint="depuis l’ouverture" />
        <Kpi label="Solde du compte" value={fcfa(d.balance)} hint={d.role === 'owner' ? <Link to={`${base}/finances`}>Finances</Link> : undefined} />
        <Kpi label="Licence estimée" value={fcfa(d.estimatedInvoice)} hint="ce mois-ci" />
      </div>
      {(defaulters > 0 || toShip.length > 0 || due.length > 0) && (
        <div className="stack-sm">
          {defaulters > 0 && <div className="notice warn">⚠️ {defaulters} membre{defaulters > 1 ? 's' : ''} défaillant{defaulters > 1 ? 's' : ''} dans vos tontines. <Link to={`${base}/membres`}>Voir les membres</Link></div>}
          {toShip.length > 0 && <div className="notice">📦 {toShip.length} commande{toShip.length > 1 ? 's' : ''} à expédier. <Link to={`${base}/commandes`}>Gérer les commandes</Link></div>}
          {due.length > 0 && <div className="notice warn">🧾 {due.length} facture{due.length > 1 ? 's' : ''} de licence en attente : alimentez le compte partenaire.</div>}
        </div>
      )}
      <div className="card stack-sm">
        <div className="row between"><h2>Tontines en cours</h2><Link to={`${base}/groupes`} className="small">Tous les groupes</Link></div>
        {!active.length ? <Empty>Aucune tontine en cours.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Tontine</th><th>Tour</th><th>Échéance</th><th>Cotisations</th><th>Défaillants</th></tr></thead>
            <tbody>{active.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/app/tontines/${t.id}`}><b>{t.name}</b></Link><div className="xs">{fcfa(t.contribution_amount)} / {FREQ[t.frequency]}</div></td>
                <td>{t.current_round?.number ?? '—'}</td>
                <td>{t.current_round ? <>{date(t.current_round.due_date)} {t.current_round.due_date < today && <Badge tone="danger">Échu</Badge>}</> : '—'}</td>
                <td>{t.current_round ? `${t.current_round.paid}/${t.members}` : '—'}</td>
                <td>{t.defaulters ? <Badge tone="danger">{t.defaulters}</Badge> : <Badge tone="ok">0</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <div className="grid-2">
        <div className="card stack-sm"><h2>En recrutement</h2>
          {d.tontines.filter((t) => t.status === 'recruiting').map((t) => (
            <div key={t.id} className="list-row"><Link className="grow" to={`/app/tontines/${t.id}`}><b className="small">{t.name}</b></Link><span className="small">{t.members}/{t.max_members}</span><Badge tone={TONTINE_STATUS.recruiting[1]}>{t.visibility === 'public' ? 'Publique' : 'Privée'}</Badge></div>
          ))}
          {!d.tontines.some((t) => t.status === 'recruiting') && <Empty>Aucune tontine en recrutement.</Empty>}
        </div>
        <div className="card stack-sm"><h2>Coffres</h2>
          {d.coffres.map((c) => <div key={c.id} className="list-row"><Link className="grow" to={`/app/coffres/${c.id}`}><b className="small">{c.name}</b></Link><span className="xs">{c.members} membres</span><span className="amount">{fcfa(c.balance)}</span></div>)}
          {!d.coffres.length && <Empty>Aucun coffre.</Empty>}
        </div>
      </div>
    </div>
  );
}
