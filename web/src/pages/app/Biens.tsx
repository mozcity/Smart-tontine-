import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { date, fcfa, FREQ, ORDER_STATUS, parseAmount } from '../../lib/format';
import { GoodCard, type Good } from '../../components/Cards';
import { PartnerTag, type Brand } from '../../components/Brand';
import { Badge, Button, Empty, Field, Input, Modal, PageHead, Progress, Segmented, Select, useAction, useUi } from '../../components/ui';

interface Plan { id: string; label: string; target_amount: number; balance: number; progress: number; frequency: string; installment_amount: number | null; status: string; good_name: string | null; created_at: string }
interface Order { id: string; good_name: string; amount: number; status: string; created_at: string; shipped_at: string | null; delivery_note: string | null; partner: Brand }
type Tab = 'catalogue' | 'plans' | 'commandes';

export default function Biens() {
  const [tab, setTab] = useState<Tab>('catalogue');
  const goods = useApi<Good[]>('/goods');
  const plans = useApi<Plan[]>('/goods/plans');
  const orders = useApi<Order[]>('/goods/orders');
  const [newPlan, setNewPlan] = useState<Good | 'libre' | null>(null);
  const act = useAction();
  const { askPin } = useUi();
  const toConfirm = orders.data?.filter((o) => o.status === 'shipped').length ?? 0;

  return (
    <div className="stack">
      <PageHead title="Biens" sub="Épargnez pour un bien seul (plan d’achat) ou en groupe (tontine de bien). Payé au fournisseur à la réception.">
        <Button variant="ghost" onClick={() => setNewPlan('libre')}>Plan pour un bien libre</Button>
      </PageHead>
      <Segmented<Tab> value={tab} onChange={setTab} options={[['catalogue', 'Catalogue'], ['plans', `Mes plans d’achat (${plans.data?.filter((p) => p.status === 'active').length ?? 0})`], ['commandes', `Mes commandes${toConfirm ? ` · ${toConfirm} à confirmer` : ''}`]]} />
      {tab === 'catalogue' && (!goods.data?.length ? <Empty>Catalogue vide pour le moment.</Empty> : (
        <div className="grid">{goods.data.map((g) => <GoodCard key={g.id} g={g} action={<Button size="sm" onClick={() => setNewPlan(g)}>Épargner pour ce bien</Button>} />)}</div>
      ))}
      {tab === 'plans' && (!plans.data?.length ? <Empty>Aucun plan d’achat.</Empty> : (
        <div className="grid">{plans.data.map((p) => <PlanCard key={p.id} p={p} onDone={() => { void plans.reload(); void orders.reload(); }} />)}</div>
      ))}
      {tab === 'commandes' && (!orders.data?.length ? <Empty>Aucune commande.</Empty> : (
        <div className="card">{orders.data.map((o) => {
          const [l, tone] = ORDER_STATUS[o.status] ?? [o.status, 'muted'];
          return (
            <div key={o.id} className="list-row" style={{ flexWrap: 'wrap' }}>
              <div className="grow"><b>{o.good_name}</b> <Badge tone={tone}>{l}</Badge><div className="xs">{fcfa(o.amount)} au séquestre · commandé le {date(o.created_at)}{o.delivery_note ? ` · « ${o.delivery_note} »` : ''}</div><PartnerTag partner={o.partner} /></div>
              {['pending', 'shipped'].includes(o.status) && (
                <Button size="sm" variant="green" onClick={async () => {
                  const pin = await askPin(`Je confirme avoir reçu « ${o.good_name} ». Le fournisseur sera payé.`);
                  if (pin && await act(() => api(`/goods/orders/${o.id}/confirm`, { body: { pin } }), 'Réception confirmée, fournisseur payé ✅')) void orders.reload();
                }}>J’ai reçu le bien</Button>
              )}
            </div>
          );
        })}<p className="xs" style={{ marginTop: 8 }}>Sans réclamation, la réception est confirmée automatiquement 7 jours après l’expédition.</p></div>
      ))}
      {newPlan && <NewPlan good={newPlan === 'libre' ? null : newPlan} onClose={() => setNewPlan(null)} onDone={() => { setNewPlan(null); setTab('plans'); void plans.reload(); }} />}
    </div>
  );
}

function PlanCard({ p, onDone }: { p: Plan; onDone: () => void }) {
  const [amount, setAmount] = useState(p.installment_amount ? String(p.installment_amount) : '');
  const act = useAction();
  return (
    <div className="card stack-sm">
      <div className="row between"><h3>{p.label}</h3><Badge tone={p.status === 'active' ? 'info' : p.status === 'completed' ? 'ok' : 'muted'}>{{ active: 'En cours', completed: 'Atteint', cancelled: 'Annulé' }[p.status]}</Badge></div>
      <p><span className="amount">{fcfa(p.balance)}</span> <span className="muted small">/ {fcfa(p.target_amount)}</span></p>
      <Progress value={p.progress} />
      <span className="xs">{p.good_name ? 'Bien du catalogue : commande automatique à l’objectif' : 'Bien libre : l’argent revient sur votre jeton à l’objectif'} · rythme {FREQ[p.frequency]}</span>
      {p.status === 'active' && (
        <div className="row">
          <Input style={{ width: 130 }} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant" />
          <Button size="sm" disabled={parseAmount(amount) < 100} onClick={async () => { if (await act(() => api(`/goods/plans/${p.id}/pay`, { body: { amount: parseAmount(amount) } }), 'Versement effectué ✅')) onDone(); }}>Verser</Button>
          <button className="linkbtn small" onClick={async () => { if (confirm('Annuler ce plan ? L’épargne revient sur votre jeton.') && await act(() => api(`/goods/plans/${p.id}/cancel`, { body: {} }), 'Plan annulé, épargne rendue')) onDone(); }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

function NewPlan({ good, onClose, onDone }: { good: Good | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ label: '', target: '', frequency: 'weekly', installment: '' });
  const act = useAction();
  return (
    <Modal title={good ? `Plan d’achat : ${good.name}` : 'Plan pour un bien libre'} onClose={onClose}>
      {good ? <p className="muted">Objectif : <b>{fcfa(good.price)}</b>. À l’objectif, le bien est commandé automatiquement auprès de {good.partner?.name}.</p> : (
        <div className="form-grid">
          <Field label="Bien"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Machine à coudre" /></Field>
          <Field label="Prix (F)"><Input inputMode="numeric" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        </div>
      )}
      <div className="form-grid">
        <Field label="Rythme"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}><option value="daily">Chaque jour</option><option value="weekly">Chaque semaine</option><option value="monthly">Chaque mois</option><option value="free">Libre</option></Select></Field>
        <Field label="Versement prévu (F)"><Input inputMode="numeric" value={f.installment} onChange={(e) => setF({ ...f, installment: e.target.value })} /></Field>
      </div>
      <Button size="block" onClick={async () => {
        const ok = await act(() => api('/goods/plans', { body: good
          ? { goodId: good.id, frequency: f.frequency, installmentAmount: parseAmount(f.installment) || undefined }
          : { label: f.label, targetAmount: parseAmount(f.target), frequency: f.frequency, installmentAmount: parseAmount(f.installment) || undefined } }), 'Plan d’achat créé ✅');
        if (ok) onDone();
      }}>Créer le plan</Button>
    </Modal>
  );
}
