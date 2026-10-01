import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowDownToLine, ArrowUpFromLine, CalendarClock, Check, ChevronRight, Eye, EyeOff, HandCoins, IdCard, KeyRound, PartyPopper, RefreshCcw, Send, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { date, dueLabel, fcfa, FREQ, greeting } from '../../lib/format';
import { PartnerTag } from '../../components/Brand';
import { TxRow } from '../../components/TxRow';
import { Badge, Button, EmptyState, Ico, Ring, Skeleton, useAction } from '../../components/ui';
import type { MyTontine } from './types';

interface Wallet { balance: number; totalSavings: number; netWorth: number }
interface History { entries: { id: string; type: string; description: string; amount: number; created_at: string }[] }

const HIDE_KEY = 'smarttontine_hide_balance';

export default function Accueil() {
  const { me, refresh } = useAuth();
  const wallet = useApi<Wallet>('/wallet');
  const tontines = useApi<MyTontine[]>('/tontines');
  const history = useApi<History>('/wallet/history?limit=6');
  const score = useApi<{ score: number }>('/credit/offers');
  const act = useAction();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  const toggle = () => { setHidden(!hidden); try { localStorage.setItem(HIDE_KEY, hidden ? '0' : '1'); } catch { /* */ } };
  const money = (n: number | undefined) => (hidden ? '•••• F' : fcfa(n));

  const active = tontines.data?.filter((t) => t.status !== 'completed') ?? [];
  const due = active.filter((t) => t.status === 'active' && t.current_round && !t.current_round.paid)
    .sort((a, b) => a.current_round!.due_date.localeCompare(b.current_round!.due_date));
  const nextTurn = active.filter((t) => t.my_turn).sort((a, b) => a.my_turn!.localeCompare(b.my_turn!))[0];

  // Parcours « bien démarrer » : affiché tant qu'une étape manque.
  const steps = [
    { done: !!me?.has_pin, label: 'Créer mon code PIN', to: '/app/profil', icon: KeyRound },
    { done: !!history.data?.entries.length, label: 'Faire un premier dépôt', to: '/app/portefeuille?action=depot', icon: ArrowDownToLine },
    { done: !!tontines.data?.length, label: 'Rejoindre ou créer une tontine', to: '/app/tontines', icon: RefreshCcw },
    { done: (me?.kyc_level ?? 0) >= 1, label: 'Vérifier mon identité', to: '/app/identite', icon: IdCard },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  async function pay(t: MyTontine) {
    if (await act(() => api(`/tontines/${t.id}/rounds/${t.current_round!.number}/contribute`, { body: {} }), `Cotisation « ${t.name} » payée`)) {
      void tontines.reload(); void wallet.reload(); void history.reload(); void refresh();
    }
  }

  return (
    <div className="stack-lg">
      <div><span className="xs">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>{greeting()} {me?.full_name?.split(' ')[0] ?? ''}</h1></div>

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'stretch' }}>
        <div className="card hero-card stack" style={{ gridColumn: 'span 1', minHeight: 230, justifyContent: 'space-between' }}>
          <div className="row between">
            <span className="row" style={{ gap: 8, color: 'rgba(255,255,255,.8)', fontWeight: 600 }}><Wallet size={18} /> Mon jeton</span>
            <button className="icon-btn" style={{ color: '#fff' }} onClick={toggle} aria-label={hidden ? 'Afficher les montants' : 'Masquer les montants'}>{hidden ? <EyeOff size={19} /> : <Eye size={19} />}</button>
          </div>
          <div>
            {wallet.data ? <div className="balance">{money(wallet.data.balance)}</div> : <Skeleton h={42} w="60%" />}
            <div className="xs" style={{ marginTop: 6 }}>Épargne bloquée {money(wallet.data?.totalSavings)} · Patrimoine {money(wallet.data?.netWorth)}</div>
          </div>
          <div className="hero-actions">
            <Link to="/app/portefeuille?action=depot" className="btn white"><ArrowDownToLine size={18} />Déposer</Link>
            <Link to="/app/portefeuille?action=retrait" className="btn" style={{ background: 'rgba(255,255,255,.14)' }}><ArrowUpFromLine size={18} />Retirer</Link>
            <Link to="/app/portefeuille?action=transfert" className="btn" style={{ background: 'rgba(255,255,255,.14)' }}><Send size={18} />Envoyer</Link>
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <Link to="/app/credit" className="card card-link tight row nowrap">
            <Ring value={(score.data?.score ?? 0) / 10} size={64} stroke={7} label={score.data?.score ?? '…'} color="var(--brand-500)" />
            <div className="grow"><b>Score Smart Tontine</b><p className="xs">sur 1000 · cotiser à l’heure le fait monter et ouvre le crédit</p></div>
            <ChevronRight size={18} color="var(--muted)" />
          </Link>
          <div className="card tight row nowrap">
            <Ico icon={PartyPopper} tone="gold" />
            <div className="grow"><span className="xs">Mon prochain pot</span>
              {nextTurn ? <><b className="ellipsis" style={{ display: 'block' }}>{nextTurn.name}</b><span className="small muted">{date(nextTurn.my_turn)} · {fcfa(nextTurn.contribution_amount * nextTurn.max_members)}</span></>
                : <p className="small muted">Aucun tour prévu. <Link to="/decouvrir">Rejoindre une tontine</Link></p>}
            </div>
          </div>
        </div>
      </div>

      {doneCount < steps.length && tontines.data && history.data && (
        <div className="card stack-sm">
          <div className="card-head"><h2>Bien démarrer</h2><span className="xs">{doneCount}/{steps.length} étapes</span></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            {steps.map((s) => (
              <Link key={s.label} to={s.to} className="row nowrap card tight card-link" style={{ boxShadow: 'none', opacity: s.done ? .6 : 1 }}>
                {s.done ? <span className="ico green round sm"><Check size={16} /></span> : <span className="ico sm round"><s.icon size={16} /></span>}
                <span className="small" style={{ fontWeight: 600, textDecoration: s.done ? 'line-through' : undefined }}>{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack-sm" aria-labelledby="apayer">
          <div className="card-head"><h2 id="apayer">À payer</h2><Link to="/app/tontines" className="small">Mes tontines</Link></div>
          {!tontines.data ? <Skeleton h={120} /> : due.length === 0
            ? <EmptyState icon={CalendarClock} title="Vous êtes à jour">Aucune cotisation en attente. Bravo pour votre régularité !</EmptyState>
            : due.map((t) => {
              const d = dueLabel(t.current_round!.due_date);
              return (
                <div key={t.id} className="list-row">
                  <Ico icon={RefreshCcw} tone={d.tone === 'danger' ? 'red' : 'brand'} round />
                  <div className="grow"><Link to={`/app/tontines/${t.id}`} className="title ellipsis" style={{ display: 'block', color: 'var(--ink)' }}>{t.name}</Link>
                    <div className="sub">Tour {t.current_round!.number} · <Badge tone={d.tone} plain>{d.text}</Badge></div></div>
                  <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 6 }}>
                    <span className="amount">{fcfa(t.contribution_amount)}</span>
                    <Button size="sm" variant="green" onClick={() => pay(t)}>Payer</Button>
                  </div>
                </div>
              );
            })}
        </section>
        <section className="card stack-sm" aria-labelledby="activite">
          <div className="card-head"><h2 id="activite">Activité récente</h2><Link to="/app/portefeuille" className="small">Tout voir</Link></div>
          {!history.data ? <Skeleton h={160} /> : !history.data.entries.length
            ? <EmptyState icon={Wallet} title="Pas encore d’opération" action={<Link className="btn sm" to="/app/portefeuille?action=depot">Faire un dépôt</Link>}>Déposez depuis Orange Money, Moov Money ou Wave, c’est gratuit.</EmptyState>
            : history.data.entries.map((e) => <TxRow key={e.id + e.created_at} {...e} />)}
        </section>
      </div>

      {active.length > 0 && (
        <section className="stack-sm">
          <div className="row between"><h2>Mes tontines</h2><Link to="/app/tontines" className="small">Tout voir</Link></div>
          <div className="hscroll">
            {active.map((t) => {
              const round = t.current_round?.number ?? 0;
              return (
                <Link key={t.id} to={`/app/tontines/${t.id}`} className="card card-link tight stack-sm">
                  <div className="row nowrap">
                    <Ring value={t.status === 'recruiting' ? (100 * t.members) / t.max_members : (100 * round) / t.max_members} size={52} stroke={6}
                      label={t.status === 'recruiting' ? `${t.members}/${t.max_members}` : `${round}/${t.max_members}`} />
                    <div className="grow"><b className="ellipsis" style={{ display: 'block' }}>{t.name}</b><span className="xs">{fcfa(t.contribution_amount)} / {FREQ[t.frequency]}</span></div>
                  </div>
                  <div className="row between">
                    {t.status === 'recruiting' ? <Badge tone="info">Recrutement</Badge> : t.current_round?.paid ? <Badge tone="ok">Payé</Badge> : <Badge tone="warn">À payer</Badge>}
                    <PartnerTag partner={t.partner} />
                  </div>
                </Link>
              );
            })}
            <Link to="/app/tontines?creer=1" className="card card-link tight" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderStyle: 'dashed', boxShadow: 'none', color: 'var(--brand-ink)', fontWeight: 650 }}>
              <HandCoins size={20} /> Créer une tontine
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
