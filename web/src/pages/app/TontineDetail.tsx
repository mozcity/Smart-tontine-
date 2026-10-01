import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { date, fcfa, FREQ, ORDER_STATUS, pct, TONTINE_STATUS } from '../../lib/format';
import { PartnerLogo, type Brand } from '../../components/Brand';
import { InviteBox } from '../../components/InviteBox';
import { CalendarClock, Coins, PartyPopper, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Button, ErrorBox, Kpi, Loading, PageHead, useAction } from '../../components/ui';

interface Member { id: string; full_name: string | null; phone: string; position: number | null; status: string; guarantee_status: string }
interface Round { id: string; number: number; beneficiary_id: string; due_date: string; status: string; payout_amount: number | null;
  contributions: { userId: string; source: string; late: boolean; paidAt: string }[] | null }
interface Detail {
  id: string; name: string; description: string | null; kind: string; status: string; visibility: string; frequency: string; order_mode: string;
  contribution_amount: number; guarantee_amount: number; max_members: number; balance: number; pot: number; organizer_id: string;
  good_label: string | null; good_price: number | null; partner: (Brand & { management_fee_rate?: string }) | null; manager: boolean;
  me: { status: string; position: number | null } | null; members: Member[]; rounds: Round[];
  orders: { id: string; status: string; amount: number; beneficiary_id: string }[];
}

export default function TontineDetail() {
  const { id } = useParams();
  const { me: user, refresh } = useAuth();
  const { data: t, error, reload } = useApi<Detail>(`/tontines/${id}`);
  const act = useAction();
  const [order, setOrder] = useState<string[] | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!t) return <Loading />;

  const today = new Date().toISOString().slice(0, 10);
  const name = (uid: string) => { const m = t.members.find((x) => x.id === uid); return m ? (m.id === user?.id ? 'Moi' : m.full_name ?? m.phone) : '—'; };
  const current = t.rounds.find((r) => r.status === 'open');
  const iPaid = !!current?.contributions?.some((c) => c.userId === user?.id);
  const [statusLabel, statusTone] = TONTINE_STATUS[t.status] ?? [t.status, 'muted'];
  const accent = t.partner?.color;
  const run = async (fn: () => Promise<unknown>, msg: string) => { if (await act(fn, msg)) { await reload(); void refresh(); } };
  const fixedOrder = order ?? t.members.map((m) => m.id);
  const move = (i: number, d: number) => { const o = [...fixedOrder]; [o[i], o[i + d]] = [o[i + d], o[i]]; setOrder(o); };

  return (
    <div className="stack">
      {t.partner && (
        <div className="partner-banner" style={{ background: accent }}>
          <PartnerLogo name={t.partner.name} logo={t.partner.logo} color="rgba(255,255,255,.2)" /><div><b>{t.partner.name}</b><div className="small" style={{ opacity: .85 }}>Tontine organisée par ce partenaire</div></div>
        </div>
      )}
      <PageHead title={t.name} sub={<>{t.kind === 'bien' ? `${t.good_label} (${fcfa(t.good_price)}) · ` : ''}{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · {t.members.length}/{t.max_members} membres · <Badge tone={statusTone}>{statusLabel}</Badge></>}>
        {t.me && current && !iPaid && <Button variant="green" onClick={() => run(() => api(`/tontines/${t.id}/rounds/${current.number}/contribute`, { body: {} }), 'Cotisation payée')}>Payer ma cotisation ({fcfa(t.contribution_amount)})</Button>}
        {t.me && t.status === 'recruiting' && t.organizer_id !== user?.id && <Button variant="ghost" onClick={() => run(() => api(`/tontines/${t.id}/leave`, { body: {} }), 'Vous avez quitté la tontine, caution rendue')}>Quitter</Button>}
      </PageHead>
      {t.description && <p className="muted">{t.description}</p>}

      <div className="kpis">
        <Kpi icon={Coins} tone="green" label="Pot par tour" value={fcfa(t.pot)} hint={`moins ${pct(0.01)} de commission`} />
        <Kpi icon={ShieldCheck} label="Caution" value={fcfa(t.guarantee_amount)} hint="rendue en fin de cycle" />
        <Kpi icon={CalendarClock} tone="gold" label="Tour en cours" value={current ? `${current.number} / ${t.rounds.length}` : '—'} hint={current ? `échéance ${date(current.due_date)}` : undefined} />
        <Kpi icon={PartyPopper} tone="blue" label="Mon tour" value={t.me?.position ? `n° ${t.me.position}` : '—'} hint={t.me?.position ? date(t.rounds.find((r) => r.beneficiary_id === user?.id)?.due_date) : t.status === 'recruiting' ? 'après le démarrage' : undefined} />
      </div>

      {t.status === 'recruiting' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card stack"><h2>Inviter des membres</h2><InviteBox id={t.id} name={t.name} /></div>
          {t.manager && (
            <div className="card stack">
              <h2>Démarrer la tontine</h2>
              <p className="muted small">{t.order_mode === 'random' ? 'L’ordre de passage sera tiré au sort (aléa cryptographique, vérifiable).' : 'Fixez l’ordre de passage :'}{t.kind === 'bien' ? ' Une tontine de biens démarre complète.' : ''}</p>
              {t.order_mode === 'fixed' && fixedOrder.map((uid, i) => (
                <div key={uid} className="row small"><b>{i + 1}.</b><span className="grow">{name(uid)}</span>
                  <button className="linkbtn" disabled={i === 0} onClick={() => move(i, -1)}>↑</button><button className="linkbtn" disabled={i === fixedOrder.length - 1} onClick={() => move(i, 1)}>↓</button></div>
              ))}
              <Button disabled={t.members.length < 2} onClick={() => run(() => api(`/tontines/${t.id}/start`, { body: t.order_mode === 'fixed' ? { order: fixedOrder } : {} }), 'Tontine démarrée')}>Démarrer maintenant</Button>
            </div>
          )}
        </div>
      )}

      {t.rounds.length > 0 && (
        <div className="card stack-sm">
          <h2>Calendrier des tours</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Tour</th><th>Échéance</th><th>Bénéficiaire</th><th>Cotisations</th><th>Statut</th>{t.manager && <th />}</tr></thead>
            <tbody>{t.rounds.map((r) => {
              const paid = r.contributions?.length ?? 0;
              return (
                <tr key={r.id} style={r.beneficiary_id === user?.id ? { background: 'var(--green-soft)' } : undefined}>
                  <td><b>{r.number}</b></td><td>{date(r.due_date)}</td><td>{name(r.beneficiary_id)}</td>
                  <td>{paid}/{t.members.length}{r.contributions?.some((c) => c.source === 'guarantee') && <span className="xs"> (caution)</span>}</td>
                  <td>{r.status === 'paid_out' ? <Badge tone="ok">Versé {r.payout_amount ? fcfa(r.payout_amount) : ''}</Badge> : r.due_date < today ? <Badge tone="danger">Échu</Badge> : <Badge tone="info">Ouvert</Badge>}</td>
                  {t.manager && <td className="right">{r.status === 'open' && r.due_date < today && <Button size="sm" variant="ghost" onClick={() => run(() => api(`/tontines/${t.id}/rounds/${r.number}/close`, { body: {} }), 'Tour clôturé : cautions utilisées')}>Clôturer</Button>}</td>}
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      )}

      <div className="card stack-sm">
        <h2>Membres</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Membre</th><th>Cotisation du tour</th><th>Caution</th><th>Statut</th></tr></thead>
          <tbody>{t.members.map((m) => {
            const c = current?.contributions?.find((x) => x.userId === m.id);
            return (
              <tr key={m.id}>
                <td>{m.position ?? '—'}</td><td><div className="row nowrap" style={{ gap: 10 }}><Avatar name={m.full_name} size="sm" /><div><b>{m.id === user?.id ? 'Moi' : m.full_name ?? '—'}</b>{t.manager && <div className="xs">{m.phone}</div>}</div></div></td>
                <td>{!current ? '—' : c ? <Badge tone={c.late ? 'warn' : 'ok'}>{c.late ? 'Payé en retard' : 'Payé'}</Badge> : <Badge tone="muted">En attente</Badge>}</td>
                <td>{{ held: 'Bloquée', used: 'Utilisée', returned: 'Rendue' }[m.guarantee_status] ?? m.guarantee_status}</td>
                <td>{m.status === 'defaulter' ? <Badge tone="danger">Défaillant</Badge> : <Badge tone="ok">À jour</Badge>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>

      {t.orders.length > 0 && (
        <div className="card stack-sm">
          <h2>Commandes du bien</h2>
          {t.orders.map((o) => { const [l, tone] = ORDER_STATUS[o.status] ?? [o.status, 'muted']; return (
            <div key={o.id} className="list-row"><span className="grow">{name(o.beneficiary_id)} · {fcfa(o.amount)}</span><Badge tone={tone}>{l}</Badge></div>); })}
          <p className="xs">Le bénéficiaire confirme la réception dans <Link to="/app/biens">Biens → Mes commandes</Link>.</p>
        </div>
      )}
    </div>
  );
}
