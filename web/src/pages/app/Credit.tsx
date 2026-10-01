import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { date, fcfa, parseAmount, pct } from '../../lib/format';
import { Badge, Button, Empty, Field, Input, Kpi, PageHead, Ring, Select, useAction, useUi } from '../../components/ui';

interface Offers {
  score: number; factors: { label: string; points: number }[];
  microcredit: { eligible: boolean; reasons: string[]; maxAmount: number; minAmount: number; durations: number[]; monthlyRate: number; apr: number };
  advances: { roundId: string; tontine: string; round: number; dueDate: string; pot: number; months: number; monthlyRate: number; maxAmount: number; eligible: boolean; reasons: string[] }[];
}
interface Loan { id: string; product: string; purpose: string; principal: number; interest: number; status: string; outstanding: number; created_at: string;
  installments: { number: number; due_date: string; principal: number; interest: number; penalty: number; paid_at: string | null }[] | null }

export default function Credit() {
  const offers = useApi<Offers>('/credit/offers');
  const loans = useApi<Loan[]>('/credit/loans');
  const o = offers.data;
  const reload = () => { void offers.reload(); void loans.reload(); };
  return (
    <div className="stack">
      <PageHead title="Crédit" sub="Vos cotisations à l’heure construisent votre score. Crédits accordés par nos SFD partenaires agréés." />
      {o && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card stack">
            <div className="row nowrap" style={{ gap: 20 }}>
              <Ring value={o.score / 10} size={118} stroke={11} color={o.score >= 550 ? 'var(--green-500)' : 'var(--brand-500)'}
                label={<span style={{ textAlign: 'center', lineHeight: 1.1 }}><b style={{ fontSize: 28, display: 'block' }}>{o.score}</b><span className="xs">/ 1000</span></span>} />
              <div className="stack-sm grow">
                <h2>Score Smart Tontine</h2>
                <Badge tone={o.score >= 700 ? 'ok' : o.score >= 550 ? 'info' : 'warn'}>{o.score >= 700 ? 'Excellent' : o.score >= 550 ? 'Bon : microcrédit possible' : 'En construction'}</Badge>
                <p className="small muted">Calculé sur votre régularité dans les tontines, votre épargne et votre identité.</p>
              </div>
            </div>
            <div className="summary">{o.factors.map((f) => <div key={f.label} className="row between"><span className="muted small">{f.label}</span><b className={`small ${f.points < 0 ? 'neg' : f.points > 0 ? 'pos' : ''}`}>{f.points > 0 ? '+' : ''}{f.points}</b></div>)}</div>
          </div>
          <Microcredit offer={o.microcredit} onDone={reload} />
        </div>
      )}
      <div className="card stack-sm">
        <h2>Avance sur tontine</h2>
        <p className="muted small">Recevez tout de suite une partie de votre futur pot ; elle est remboursée automatiquement quand le pot vous est versé.</p>
        {!o?.advances.length ? <Empty>Aucun tour à venir : rejoignez une tontine pour débloquer l’avance.</Empty> : o.advances.map((a) => <Advance key={a.roundId} a={a} onDone={reload} />)}
      </div>
      <div className="card stack-sm">
        <h2>Mes crédits</h2>
        {!loans.data?.length ? <Empty>Aucun crédit.</Empty> : loans.data.map((l) => <LoanRow key={l.id} l={l} onDone={reload} />)}
      </div>
    </div>
  );
}

function Microcredit({ offer, onDone }: { offer: Offers['microcredit']; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(offer.durations[2] ?? offer.durations[0]);
  const [purpose, setPurpose] = useState('');
  const [sim, setSim] = useState<{ schedule: { number: number; dueDate: string; principal: number; interest: number }[]; totalInterest: number } | null>(null);
  const { askPin } = useUi();
  const act = useAction();
  const a = parseAmount(amount);
  useEffect(() => {
    if (a < offer.minAmount) { setSim(null); return; }
    const h = setTimeout(() => { api(`/credit/simulate?amount=${a}&months=${months}`).then(setSim).catch(() => setSim(null)); }, 300);
    return () => clearTimeout(h);
  }, [a, months, offer.minAmount]);
  return (
    <div className="card stack-sm">
      <h2>Microcrédit</h2>
      {!offer.eligible ? (
        <><p className="muted small">Pas encore accessible :</p>{offer.reasons.map((r) => <div key={r} className="notice warn small">{r}{/identité/i.test(r) && <> — <Link to="/app/identite">vérifier mon identité</Link></>}</div>)}</>
      ) : (
        <>
          <p className="small">Jusqu’à <b>{fcfa(offer.maxAmount)}</b> · {pct(offer.monthlyRate, 1)} par mois sur capital restant dû ({pct(offer.apr)} / an)</p>
          <div className="form-grid">
            <Field label="Montant (F)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Durée"><Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{offer.durations.map((d) => <option key={d} value={d}>{d} mois</option>)}</Select></Field>
          </div>
          <Field label="Objet du crédit"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Stock de marchandises" /></Field>
          {sim && <div className="notice small">{sim.schedule.length} échéance{sim.schedule.length > 1 ? 's' : ''} ≈ {fcfa(sim.schedule[0].principal + sim.schedule[0].interest)} · intérêts totaux {fcfa(sim.totalInterest)}</div>}
          <Button disabled={a < offer.minAmount || a > offer.maxAmount || purpose.trim().length < 3} onClick={async () => {
            const pin = await askPin(`Microcrédit de ${fcfa(a)} sur ${months} mois`);
            if (pin && await act(() => api('/credit/loans', { body: { amount: a, months, purpose, pin } }), 'Crédit accordé et versé sur votre jeton')) { setAmount(''); setPurpose(''); onDone(); }
          }}>Demander</Button>
        </>
      )}
    </div>
  );
}

function Advance({ a, onDone }: { a: Offers['advances'][number]; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const { askPin } = useUi();
  const act = useAction();
  const v = parseAmount(amount);
  return (
    <div className="list-row" style={{ flexWrap: 'wrap' }}>
      <div className="grow"><b>{a.tontine}</b> · tour {a.round}<div className="xs">Pot {fcfa(a.pot)} le {date(a.dueDate)} · avance max. {fcfa(a.maxAmount)} · {pct(a.monthlyRate, 1)}/mois</div>
        {!a.eligible && a.reasons.map((r) => <div key={r} className="xs neg">{r}</div>)}</div>
      {a.eligible && <>
        <Input style={{ width: 130 }} inputMode="numeric" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button size="sm" disabled={v < 1 || v > a.maxAmount} onClick={async () => {
          const pin = await askPin(`Avance de ${fcfa(v)} sur « ${a.tontine} »`);
          if (pin && await act(() => api('/credit/advances', { body: { roundId: a.roundId, amount: v, pin } }), 'Avance versée sur votre jeton')) { setAmount(''); onDone(); }
        }}>Obtenir</Button>
      </>}
    </div>
  );
}

function LoanRow({ l, onDone }: { l: Loan; onDone: () => void }) {
  const { askPin } = useUi();
  const act = useAction();
  const next = l.installments?.find((i) => !i.paid_at);
  const tone = l.status === 'active' ? 'info' : l.status === 'repaid' ? 'ok' : l.status === 'defaulted' ? 'danger' : 'muted';
  return (
    <div className="list-row" style={{ flexWrap: 'wrap' }}>
      <div className="grow"><b>{l.purpose}</b> <Badge tone={tone}>{{ active: 'En cours', repaid: 'Remboursé', defaulted: 'En défaut' }[l.status] ?? l.status}</Badge>
        <div className="xs">{l.product === 'avance_tontine' ? 'Avance sur tontine' : 'Microcrédit'} · {fcfa(l.principal)} + {fcfa(l.interest)} d’intérêts · accordé le {date(l.created_at)}</div>
        {next && <div className="xs">Prochaine échéance : {fcfa(next.principal + next.interest + next.penalty)} le {date(next.due_date)}</div>}</div>
      <Kpi label="Reste dû" value={fcfa(l.outstanding)} />
      {l.status === 'active' && l.product === 'microcredit' && next && (
        <Button size="sm" variant="ghost" onClick={async () => {
          const pin = await askPin(`Payer l’échéance ${next.number} (${fcfa(next.principal + next.interest + next.penalty)})`);
          if (pin && await act(() => api(`/credit/loans/${l.id}/repay`, { body: { pin } }), 'Échéance payée')) onDone();
        }}>Payer l’échéance</Button>
      )}
    </div>
  );
}
