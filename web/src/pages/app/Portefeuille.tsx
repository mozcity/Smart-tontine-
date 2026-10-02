import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Send, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { CHANNELS, dateTime, fcfa, parseAmount, TX_LABELS } from '../../lib/format';
import { TxRow } from '../../components/TxRow';
import { AmountInput, Badge, Button, EmptyState, Field, Input, Kpi, Notice, OperatorPicker, PageHead, Segmented, Skeleton, useAction, useUi } from '../../components/ui';

interface History { entries: { id: string; reference: string; type: string; description: string; amount: number; created_at: string }[];
  pending: { id: string; reference: string; type: string; amount: number; created_at: string }[] }
type Tab = 'depot' | 'retrait' | 'transfert';

export default function Portefeuille() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('action') as Tab) ?? 'depot';
  const { refresh } = useAuth();
  const wallet = useApi<{ balance: number; totalSavings: number; netWorth: number }>('/wallet');
  const history = useApi<History>('/wallet/history?limit=50');
  const reloadAll = () => { void wallet.reload(); void history.reload(); void refresh(); };

  return (
    <div className="stack">
      <PageHead title="Mon jeton" sub="Votre portefeuille Smart Tontine : déposez, retirez, envoyez." />
      <div className="kpis">
        <div className="card tight hero-card kpi"><span className="xs">Solde disponible</span><b style={{ fontSize: 26 }}>{fcfa(wallet.data?.balance)}</b></div>
        <Kpi label="Épargne bloquée" value={fcfa(wallet.data?.totalSavings)} icon={Clock} tone="gold" />
        <Kpi label="Patrimoine Smart Tontine" value={fcfa(wallet.data?.netWorth)} icon={Wallet} tone="green" />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <Segmented<Tab> value={tab} onChange={(v) => setParams({ action: v })}
            options={[['depot', 'Déposer', ArrowDownToLine], ['retrait', 'Retirer', ArrowUpFromLine], ['transfert', 'Envoyer', Send]]} />
          {tab === 'depot' && <Depot onDone={reloadAll} />}
          {tab === 'retrait' && <Retrait balance={wallet.data?.balance ?? 0} onDone={reloadAll} />}
          {tab === 'transfert' && <Transfert balance={wallet.data?.balance ?? 0} onDone={reloadAll} />}
        </div>
        <div className="card stack-sm">
          <div className="card-head"><h2>Historique</h2></div>
          {!history.data ? <Skeleton h={220} /> : (
            <>
              {history.data.pending.map((p) => (
                <div key={p.id} className="list-row"><span className="ico gold round"><Clock size={18} /></span>
                  <div className="grow"><div className="title small">{TX_LABELS[p.type] ?? p.type}</div><div className="sub">{p.reference} · {dateTime(p.created_at)}</div></div>
                  <Badge tone="warn">En attente</Badge><span className="amount">{fcfa(p.amount)}</span></div>
              ))}
              {!history.data.entries.length && !history.data.pending.length
                ? <EmptyState icon={Wallet} title="Aucune opération">Votre premier dépôt apparaîtra ici.</EmptyState>
                : history.data.entries.map((e) => <TxRow key={e.id + e.created_at} {...e} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Recap({ rows }: { rows: [string, string, boolean?][] }) {
  return <div className="summary">{rows.map(([k, v, strong]) => <div key={k} className="row between"><span className="muted small">{k}</span><span className={strong ? 'amount' : 'small'}>{v}</span></div>)}</div>;
}

function Depot({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [pending, setPending] = useState<{ reference: string; paymentUrl?: string } | null>(null);
  const act = useAction();
  const a = parseAmount(amount);
  const demo = pending?.paymentUrl?.includes('example.test');
  if (pending) {
    return (
      <div className="stack">
        <Notice>Paiement <b>{pending.reference}</b> en attente : validez-le sur votre téléphone ({CHANNELS[channel]}). Votre jeton est crédité dès la confirmation.</Notice>
        {demo && <Button variant="green" size="block" onClick={() => act(async () => { await api(`/wallet/deposits/${pending.reference}/simulate`, { body: {} }); setPending(null); setAmount(''); onDone(); }, 'Dépôt confirmé')}>Simuler la confirmation (démo)</Button>}
        <Button variant="ghost" onClick={() => setPending(null)}>Nouveau dépôt</Button>
      </div>
    );
  }
  return (
    <div className="stack">
      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <OperatorPicker value={channel} onChange={setChannel} />
      {a >= 100 && <Recap rows={[['Vous déposez', fcfa(a)], ['Frais', 'Gratuit'], ['Crédité sur votre jeton', fcfa(a), true]]} />}
      <Button variant="green" size="block" icon={ArrowDownToLine} disabled={a < 100} onClick={() => act(async () => {
        const r = await api<{ reference: string; paymentUrl?: string }>('/wallet/deposits', { body: { amount: a, channel } });
        setPending(r);
        if (r.paymentUrl && !r.paymentUrl.includes('example.test')) window.open(r.paymentUrl, '_blank', 'noopener');
      })}>Déposer {a >= 100 ? fcfa(a) : ''}</Button>
    </div>
  );
}

function Retrait({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [quote, setQuote] = useState<{ fee: number; total: number } | null>(null);
  const { askPin } = useUi();
  const act = useAction();
  const a = parseAmount(amount);
  useEffect(() => {
    if (a < 100) { setQuote(null); return; }
    const h = setTimeout(() => { api<{ fee: number; total: number }>(`/wallet/withdrawals/quote?amount=${a}`).then(setQuote).catch(() => setQuote(null)); }, 250);
    return () => clearTimeout(h);
  }, [a]);
  const tooMuch = !!quote && quote.total > balance;
  return (
    <div className="stack">
      <AmountInput value={amount} onChange={setAmount} chips={[5000, 10000, 25000].filter((c) => c < balance)} autoFocus />
      <OperatorPicker value={channel} onChange={setChannel} />
      {quote && <Recap rows={[['Vous recevez', fcfa(a)], ['Frais (1 %)', quote.fee ? fcfa(quote.fee) : 'Offerts'], ['Débité de votre jeton', fcfa(quote.total), true]]} />}
      {tooMuch && <Notice tone="warn">Solde insuffisant : {fcfa(balance)} disponibles.</Notice>}
      <Button size="block" icon={ArrowUpFromLine} disabled={a < 100 || tooMuch} onClick={async () => {
        const pin = await askPin(`Retrait de ${fcfa(a)} vers ${CHANNELS[channel]}`);
        if (pin && await act(() => api('/wallet/withdrawals', { body: { amount: a, channel, pin } }), 'Retrait envoyé : vous serez notifié dès la confirmation de l’opérateur')) { setAmount(''); onDone(); }
      }}>Retirer</Button>
    </div>
  );
}

function Transfert({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [f, setF] = useState({ toPhone: '+226', amount: '', note: '' });
  const { askPin } = useUi();
  const act = useAction();
  const a = parseAmount(f.amount);
  return (
    <div className="stack">
      <Field label="Numéro du membre"><Input inputMode="tel" value={f.toPhone} onChange={(e) => setF({ ...f, toPhone: e.target.value.replace(/\s/g, '') })} /></Field>
      <AmountInput value={f.amount} onChange={(amount) => setF({ ...f, amount })} chips={[1000, 5000, 10000].filter((c) => c <= balance)} />
      <Field label="Message (facultatif)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Pour la cotisation de juin" /></Field>
      {a >= 100 && <Recap rows={[['Destinataire', f.toPhone], ['Frais', 'Gratuit'], ['Montant envoyé', fcfa(a), true]]} />}
      <Button size="block" icon={Send} disabled={a < 100 || f.toPhone.length < 10 || a > balance} onClick={async () => {
        const pin = await askPin(`Envoyer ${fcfa(a)} à ${f.toPhone}`);
        if (pin && await act(() => api('/wallet/transfers', { body: { toPhone: f.toPhone, amount: a, note: f.note || undefined, pin } }), 'Transfert effectué')) { setF({ ...f, amount: '', note: '' }); onDone(); }
      }}>Envoyer</Button>
    </div>
  );
}
