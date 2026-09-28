import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { CHANNELS, dateTime, fcfa, parseAmount, TX_LABELS } from '../../lib/format';
import { Badge, Button, Empty, Field, Input, Kpi, PageHead, Segmented, Select, useAction, useUi } from '../../components/ui';

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
        <div className="card tight kpi hero-card"><span className="xs">Solde disponible</span><b>{fcfa(wallet.data?.balance)}</b></div>
        <Kpi label="Épargne bloquée" value={fcfa(wallet.data?.totalSavings)} />
        <Kpi label="Patrimoine Smart Tontine" value={fcfa(wallet.data?.netWorth)} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <Segmented<Tab> value={tab} onChange={(v) => setParams({ action: v })} options={[['depot', 'Déposer'], ['retrait', 'Retirer'], ['transfert', 'Envoyer']]} />
          {tab === 'depot' && <Depot onDone={reloadAll} />}
          {tab === 'retrait' && <Retrait onDone={reloadAll} />}
          {tab === 'transfert' && <Transfert onDone={reloadAll} />}
        </div>
        <div className="card stack-sm">
          <h2>Historique</h2>
          {history.data?.pending.map((p) => (
            <div key={p.id} className="list-row"><div className="grow"><b className="small">{TX_LABELS[p.type] ?? p.type}</b><div className="xs">{p.reference} · {dateTime(p.created_at)}</div></div><Badge tone="warn">En attente</Badge><span className="amount">{fcfa(p.amount)}</span></div>
          ))}
          {!history.data?.entries.length && !history.data?.pending.length ? <Empty>Aucune opération.</Empty> : history.data?.entries.map((e) => (
            <div key={e.id} className="list-row">
              <div className="grow"><b className="small">{TX_LABELS[e.type] ?? e.type}</b><div className="xs">{e.description} · {dateTime(e.created_at)}</div></div>
              <span className={`amount ${e.amount > 0 ? 'pos' : ''}`}>{e.amount > 0 ? '+' : ''}{fcfa(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Field label="Opérateur"><Select value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>;
}

function Depot({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [pending, setPending] = useState<{ reference: string; paymentUrl?: string } | null>(null);
  const act = useAction();
  const demo = pending?.paymentUrl?.includes('example.test');
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Montant (F)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10 000" /></Field>
        <ChannelSelect value={channel} onChange={setChannel} />
      </div>
      <Button variant="green" disabled={parseAmount(amount) < 100} onClick={() => act(async () => {
        const r = await api<{ reference: string; paymentUrl?: string }>('/wallet/deposits', { body: { amount: parseAmount(amount), channel } });
        setPending(r);
        if (r.paymentUrl && !r.paymentUrl.includes('example.test')) window.open(r.paymentUrl, '_blank', 'noopener');
      })}>Déposer {parseAmount(amount) ? fcfa(parseAmount(amount)) : ''}</Button>
      {pending && (
        <div className="notice stack-sm">
          <span>Paiement {pending.reference} en attente de confirmation par {CHANNELS[channel]}. Votre jeton est crédité dès la confirmation.</span>
          {demo && <Button size="sm" onClick={() => act(async () => { await api(`/wallet/deposits/${pending.reference}/simulate`, { body: {} }); setPending(null); setAmount(''); onDone(); }, 'Dépôt confirmé ✅')}>Simuler la confirmation (démo)</Button>}
        </div>
      )}
    </div>
  );
}

function Retrait({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('orange_money');
  const [quote, setQuote] = useState<{ fee: number; total: number } | null>(null);
  const { askPin } = useUi();
  const act = useAction();
  const a = parseAmount(amount);
  useEffect(() => {
    if (a < 100) { setQuote(null); return; }
    const h = setTimeout(() => { api<{ fee: number; total: number }>(`/wallet/withdrawals/quote?amount=${a}`).then(setQuote).catch(() => setQuote(null)); }, 300);
    return () => clearTimeout(h);
  }, [a]);
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Montant (F)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <ChannelSelect value={channel} onChange={setChannel} />
      </div>
      {quote && <div className="notice small">Frais : <b>{fcfa(quote.fee)}</b> · Total débité : <b>{fcfa(quote.total)}</b></div>}
      <Button disabled={a < 100} onClick={async () => {
        const pin = await askPin(`Retrait de ${fcfa(a)} vers ${CHANNELS[channel]}`);
        if (pin && await act(() => api('/wallet/withdrawals', { body: { amount: a, channel, pin } }), 'Retrait envoyé ✅')) { setAmount(''); onDone(); }
      }}>Retirer</Button>
    </div>
  );
}

function Transfert({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ toPhone: '+226', amount: '', note: '' });
  const { askPin } = useUi();
  const act = useAction();
  const a = parseAmount(f.amount);
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Téléphone du membre"><Input inputMode="tel" value={f.toPhone} onChange={(e) => setF({ ...f, toPhone: e.target.value.replace(/\s/g, '') })} /></Field>
        <Field label="Montant (F)"><Input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      </div>
      <Field label="Message (facultatif)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <p className="xs">Transfert gratuit et immédiat entre membres Smart Tontine.</p>
      <Button disabled={a < 100 || f.toPhone.length < 10} onClick={async () => {
        const pin = await askPin(`Envoyer ${fcfa(a)} à ${f.toPhone}`);
        if (pin && await act(() => api('/wallet/transfers', { body: { toPhone: f.toPhone, amount: a, note: f.note || undefined, pin } }), 'Transfert effectué ✅')) { setF({ ...f, amount: '', note: '' }); onDone(); }
      }}>Envoyer</Button>
    </div>
  );
}
