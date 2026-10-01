import { api } from '../../lib/api';
import { date, fcfa, ORDER_STATUS } from '../../lib/format';
import { Badge, Button, Empty, PageHead, useAction } from '../../components/ui';
import { usePartner } from './context';

export default function Commandes() {
  const { dash, reload } = usePartner();
  const act = useAction();
  const run = async (fn: () => Promise<unknown>, msg: string) => { if (await act(fn, msg)) await reload(); };
  return (
    <div className="stack">
      <PageHead title="Commandes" sub="Le prix est au séquestre. Vous êtes payé (moins 3 %) quand le client confirme la réception, ou automatiquement 7 jours après l’expédition." />
      <div className="card">
        {!dash.orders.length ? <Empty>Aucune commande.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Bien</th><th>Client</th><th className="right">Montant</th><th>Statut</th><th /></tr></thead>
            <tbody>{dash.orders.map((o) => { const [l, tone] = ORDER_STATUS[o.status] ?? [o.status, 'muted']; return (
              <tr key={o.id}>
                <td>{date(o.created_at)}</td><td><b>{o.good_name}</b>{o.delivery_note && <div className="xs">« {o.delivery_note} »</div>}</td>
                <td>{o.beneficiary ?? '—'}<div className="xs">{o.phone}</div></td>
                <td className="right amount">{fcfa(o.amount)}</td>
                <td><Badge tone={tone}>{l}</Badge>{o.shipped_at && <div className="xs">expédiée le {date(o.shipped_at)}</div>}</td>
                <td className="right nowrap">{o.status === 'pending' && <>
                  <Button size="sm" onClick={() => { const note = prompt('Message au client (lieu de retrait, livreur…)', 'Votre bien est prêt, passez le récupérer en boutique.'); if (note !== null) return run(() => api(`/goods/orders/${o.id}/ship`, { body: { note: note || undefined } }), 'Client prévenu'); }}>Expédier / prêt</Button>{' '}
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Annuler la commande ? Le client est remboursé intégralement.')) return run(() => api(`/goods/orders/${o.id}/cancel`, { body: {} }), 'Commande annulée, client remboursé'); }}>Annuler</Button></>}</td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
