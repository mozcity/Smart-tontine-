import { useState } from 'react';
import { Banknote, Check, ChevronLeft, ChevronRight, Globe, Lock, Minus, Plus, Shuffle, ListOrdered, ShoppingBag } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { fcfa, parseAmount } from '../lib/format';
import type { Good } from './Cards';
import { AmountInput, Button, ErrorBox, Field, Input, Segmented, Select, Textarea } from './ui';

type Kind = 'argent' | 'bien';

/** Création d'une tontine en 3 étapes (type → règles → récapitulatif), par un membre ou au nom d'un partenaire. */
export function CreateTontineForm({ partnerId, managementFeeRate = 0, onCreated }: { partnerId?: string; managementFeeRate?: number; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind>('argent');
  const [f, setF] = useState({ name: '', description: '', amount: '', frequency: 'monthly', maxMembers: 10, orderMode: 'random', visibility: 'private',
    goodId: '', goodLabel: '', goodPrice: '', guarantee: '', joinAsMember: !partnerId });
  const [error, setError] = useState<string | null>(null);
  const goods = useApi<Good[]>(kind === 'bien' ? '/goods' : null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const members = f.maxMembers;
  const good = goods.data?.find((g) => g.id === f.goodId);
  const price = f.goodId ? good?.price ?? 0 : parseAmount(f.goodPrice);
  const contribution = kind === 'bien'
    ? (price && members ? Math.ceil(price / (members * (1 - 0.01 - managementFeeRate)) / 25) * 25 : 0)
    : parseAmount(f.amount);
  const pot = contribution * members;
  const guarantee = f.guarantee ? parseAmount(f.guarantee) : contribution;
  const per = f.frequency === 'weekly' ? 'semaine' : 'mois';
  const valid = [true, f.name.trim().length >= 2 && contribution >= 500 && members >= 2 && (kind === 'argent' || price > 0), true];

  async function submit() {
    setError(null);
    try {
      const t = await api<{ id: string }>('/tontines', { body: {
        name: f.name, description: f.description || undefined, frequency: f.frequency, maxMembers: members, orderMode: f.orderMode,
        visibility: f.visibility, kind, partnerId, joinAsMember: f.joinAsMember,
        contributionAmount: kind === 'argent' ? contribution : undefined,
        guaranteeAmount: f.guarantee ? parseAmount(f.guarantee) : undefined,
        goodId: kind === 'bien' && f.goodId ? f.goodId : undefined,
        goodLabel: kind === 'bien' && !f.goodId ? f.goodLabel : undefined,
        goodPrice: kind === 'bien' && !f.goodId ? parseAmount(f.goodPrice) : undefined,
      } });
      onCreated(t.id);
    } catch (e) { setError((e as Error).message); }
  }

  const Choice = ({ on, onClick, icon: I, title, text }: { on: boolean; onClick: () => void; icon: typeof Banknote; title: string; text: string }) => (
    <button type="button" className={`choice ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className={`ico sm ${on ? '' : ''}`}><I size={17} /></span><span><b>{title}</b><span className="xs">{text}</span></span>
    </button>
  );

  return (
    <div className="stack">
      <div className="steps" aria-label={`Étape ${step + 1} sur 3`}>
        {['Type', 'Règles', 'Vérifier'].map((l, i) => (
          <div key={l} style={{ display: 'contents' }}>
            {i > 0 && <span className="bar" />}
            <span className={`step ${i === step ? 'on' : i < step ? 'done' : ''}`}><b>{i < step ? <Check size={14} /> : i + 1}</b>{l}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="stack">
          <span className="small" style={{ fontWeight: 650 }}>Que cotise-t-on ?</span>
          <div className="choice-grid">
            <Choice on={kind === 'argent'} onClick={() => setKind('argent')} icon={Banknote} title="De l’argent" text="Chacun reçoit le pot à son tour." />
            <Choice on={kind === 'bien'} onClick={() => setKind('bien')} icon={ShoppingBag} title="Un bien" text="Moto, frigo, téléphone… livré à son tour." />
          </div>
          <span className="small" style={{ fontWeight: 650 }}>Qui peut rejoindre ?</span>
          <div className="choice-grid">
            <Choice on={f.visibility === 'private'} onClick={() => setF({ ...f, visibility: 'private' })} icon={Lock} title="Sur invitation" text="Lien, QR code ou WhatsApp." />
            <Choice on={f.visibility === 'public'} onClick={() => setF({ ...f, visibility: 'public' })} icon={Globe} title="Tout le monde" text="Visible dans « Découvrir »." />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <Field label="Nom de la tontine"><Input autoFocus required value={f.name} onChange={set('name')} placeholder={kind === 'bien' ? 'Une moto pour chacun' : 'Tontine du marché'} /></Field>
          {kind === 'bien' && (
            <>
              <Field label="Bien"><Select value={f.goodId} onChange={set('goodId')}>
                <option value="">Bien libre (je saisis le nom et le prix)</option>
                {goods.data?.map((g) => <option key={g.id} value={g.id}>{g.name} — {fcfa(g.price)} ({g.partner?.name})</option>)}
              </Select></Field>
              {!f.goodId && <div className="form-grid">
                <Field label="Nom du bien"><Input value={f.goodLabel} onChange={set('goodLabel')} /></Field>
                <Field label="Prix (F)"><Input inputMode="numeric" value={f.goodPrice} onChange={set('goodPrice')} /></Field>
              </div>}
            </>
          )}
          {kind === 'argent' && <AmountInput label="Cotisation par membre et par tour" value={f.amount} onChange={(amount) => setF({ ...f, amount })} chips={[5000, 10000, 25000, 50000]} />}
          <div className="form-grid">
            <div className="field"><span>Fréquence</span><Segmented value={f.frequency} onChange={(frequency) => setF({ ...f, frequency })} options={[['weekly', 'Chaque semaine'], ['monthly', 'Chaque mois']]} /></div>
            <div className="field"><span>Nombre de membres</span>
              <div className="row nowrap">
                <button type="button" className="icon-btn" style={{ border: '1px solid var(--line-strong)' }} aria-label="Moins" onClick={() => setF({ ...f, maxMembers: Math.max(2, members - 1) })}><Minus size={18} /></button>
                <b style={{ fontSize: 22, minWidth: 40, textAlign: 'center' }}>{members}</b>
                <button type="button" className="icon-btn" style={{ border: '1px solid var(--line-strong)' }} aria-label="Plus" onClick={() => setF({ ...f, maxMembers: Math.min(50, members + 1) })}><Plus size={18} /></button>
              </div>
            </div>
          </div>
          <span className="small" style={{ fontWeight: 650 }}>Ordre de passage</span>
          <div className="choice-grid">
            <Choice on={f.orderMode === 'random'} onClick={() => setF({ ...f, orderMode: 'random' })} icon={Shuffle} title="Tirage au sort" text="Équitable et vérifiable." />
            <Choice on={f.orderMode === 'fixed'} onClick={() => setF({ ...f, orderMode: 'fixed' })} icon={ListOrdered} title="Ordre fixé" text="Vous décidez au démarrage." />
          </div>
          <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--brand-ink)' }}>Options avancées</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <Field label="Caution (F)" hint="Par défaut une cotisation : elle couvre un impayé et est rendue en fin de cycle."><Input inputMode="numeric" value={f.guarantee} onChange={set('guarantee')} placeholder={contribution ? String(contribution) : 'auto'} /></Field>
              <Field label="Description"><Textarea value={f.description} onChange={set('description')} /></Field>
              {partnerId && <label className="check"><input type="checkbox" checked={f.joinAsMember} onChange={(e) => setF({ ...f, joinAsMember: e.target.checked })} /> Je cotise moi-même dans cette tontine</label>}
            </div>
          </details>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <div className="card hero-card tight stack-sm">
            <span className="xs">{kind === 'bien' ? `Tontine de bien · ${good?.name ?? f.goodLabel}` : 'Tontine d’argent'} · {f.visibility === 'public' ? 'publique' : 'sur invitation'}</span>
            <h2 style={{ fontSize: 22 }}>{f.name}</h2>
            <div className="row" style={{ gap: 24 }}>
              <div><span className="xs">Cotisation</span><div className="amount" style={{ fontSize: 20 }}>{fcfa(contribution)}<span className="xs"> / {per}</span></div></div>
              <div><span className="xs">Pot à chaque tour</span><div className="amount" style={{ fontSize: 20 }}>{fcfa(pot)}</div></div>
            </div>
          </div>
          <div className="summary">
            {([
              ['Membres', `${members} personnes`],
              ['Durée', `${members} ${per}${members > 1 && per === 'semaine' ? 's' : ''} (un tour par ${per})`],
              ['Ordre de passage', f.orderMode === 'random' ? 'Tirage au sort au démarrage' : 'Fixé par l’organisateur'],
              ['Caution par membre', `${fcfa(guarantee)} (rendue en fin de cycle)`],
              ['Commission Smart Tontine', `1 % du pot, soit ${fcfa(Math.round(pot * 0.01))} par tour`],
              ...(managementFeeRate ? [['Frais de gestion du partenaire', `${(managementFeeRate * 100).toFixed(1).replace('.', ',')} % du pot`]] : []),
            ] as [string, string][]).map(([k, v]) => <div key={k} className="row between"><span className="muted small">{k}</span><span className="small" style={{ fontWeight: 600 }}>{v}</span></div>)}
          </div>
          {kind === 'bien' && <p className="xs">Une tontine de bien démarre quand elle est complète ; le bien est payé au fournisseur à la réception confirmée.</p>}
          <ErrorBox error={error} />
        </div>
      )}

      <div className="row between">
        {step > 0 ? <Button variant="ghost" icon={ChevronLeft} onClick={() => setStep(step - 1)}>Retour</Button> : <span />}
        {step < 2
          ? <Button disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continuer <ChevronRight size={18} /></Button>
          : <Button variant="green" icon={Check} onClick={submit}>Créer la tontine</Button>}
      </div>
    </div>
  );
}
