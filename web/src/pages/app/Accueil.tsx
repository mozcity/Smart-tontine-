import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { date, dateTime, fcfa } from '../../lib/format';
import { PartnerTag } from '../../components/Brand';
import { Badge, Button, Empty, Kpi, PageHead, useAction } from '../../components/ui';
import type { MyTontine } from './types';

interface Wallet { balance: number; totalSavings: number; netWorth: number }
interface Notif { id: string; title: string; body: string; created_at: string; read_at: string | null }

export default function Accueil() {
  const { me, refresh } = useAuth();
  const wallet = useApi<Wallet>('/wallet');
  const tontines = useApi<MyTontine[]>('/tontines');
  const notifs = useApi<Notif[]>('/me/notifications');
  const score = useApi<{ score: number }>('/credit/offers');
  const act = useAction();
  const due = tontines.data?.filter((t) => t.status === 'active' && t.current_round && !t.current_round.paid) ?? [];
  const nextTurn = tontines.data?.filter((t) => t.my_turn && t.status === 'active').sort((a, b) => a.my_turn!.localeCompare(b.my_turn!))[0];

  async function pay(t: MyTontine) {
    const ok = await act(() => api(`/tontines/${t.id}/rounds/${t.current_round!.number}/contribute`, { body: {} }), 'Cotisation payée ✅');
    if (ok) { void tontines.reload(); void wallet.reload(); void refresh(); }
  }

  return (
    <div className="stack">
      <PageHead title={`Bonjour ${me?.full_name?.split(' ')[0] ?? ''} 👋`} sub="Voici l’essentiel de vos tontines et de votre épargne.">
        <Link to="/app/portefeuille?action=depot" className="btn green">Déposer</Link>
        <Link to="/app/tontines?creer=1" className="btn ghost">Créer une tontine</Link>
      </PageHead>
      <div className="kpis">
        <div className="card tight kpi hero-card"><span className="xs">Mon jeton</span><b>{fcfa(wallet.data?.balance)}</b><span className="xs">disponible</span></div>
        <Kpi label="Épargne bloquée" value={fcfa(wallet.data?.totalSavings)} hint="e-caisses, projets, challenges" />
        <Kpi label="Score Smart Tontine" value={score.data ? `${score.data.score} / 1000` : '—'} hint={<Link to="/app/credit">Voir mes offres de crédit</Link>} />
        <Kpi label="Mon prochain pot" value={nextTurn ? date(nextTurn.my_turn) : '—'} hint={nextTurn?.name ?? 'Aucun tour à venir'} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack-sm">
          <div className="row between"><h2>À payer</h2><Link to="/app/tontines" className="small">Toutes mes tontines</Link></div>
          {due.length === 0 ? <Empty>Vous êtes à jour de vos cotisations. 👏</Empty> : due.map((t) => {
            const late = t.current_round!.due_date < new Date().toISOString().slice(0, 10);
            return (
              <div key={t.id} className="list-row">
                <div className="grow"><Link to={`/app/tontines/${t.id}`}><b>{t.name}</b></Link>
                  <div className="xs">Tour {t.current_round!.number} · échéance {date(t.current_round!.due_date)} {late && <Badge tone="danger">En retard</Badge>}</div>
                  <PartnerTag partner={t.partner} /></div>
                <span className="amount">{fcfa(t.contribution_amount)}</span>
                <Button size="sm" variant="green" onClick={() => pay(t)}>Payer</Button>
              </div>
            );
          })}
        </div>
        <div className="card stack-sm">
          <div className="row between"><h2>Notifications</h2>
            {notifs.data?.some((n) => !n.read_at) && <button className="linkbtn small" onClick={async () => { await api('/me/notifications/read', { body: {} }); void notifs.reload(); }}>Tout marquer comme lu</button>}</div>
          {!notifs.data?.length ? <Empty>Aucune notification.</Empty> : notifs.data.slice(0, 8).map((n) => (
            <div key={n.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              {!n.read_at && <span className="dot" style={{ background: 'var(--green)', marginTop: 8 }} />}
              <div className="grow"><b className="small">{n.title}</b><p className="small muted">{n.body}</p></div>
              <span className="xs nowrap">{dateTime(n.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
