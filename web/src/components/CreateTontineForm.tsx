import { useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { fcfa, parseAmount } from '../lib/format';
import type { Good } from './Cards';
import { Button, ErrorBox, Field, Input, Segmented, Select, Textarea } from './ui';

/** Création d'une tontine d'argent ou de bien, par un membre ou au nom d'un partenaire. */
export function CreateTontineForm({ partnerId, managementFeeRate = 0, onCreated }: { partnerId?: string; managementFeeRate?: number; onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<'argent' | 'bien'>('argent');
  const [f, setF] = useState({ name: '', description: '', amount: '', frequency: 'monthly', maxMembers: '10', orderMode: 'random', visibility: 'private',
    goodId: '', goodLabel: '', goodPrice: '', guarantee: '', joinAsMember: !partnerId });
  const [error, setError] = useState<string | null>(null);
  const goods = useApi<Good[]>(kind === 'bien' ? '/goods' : null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const members = Number(f.maxMembers) || 0;
  const price = f.goodId ? goods.data?.find((g) => g.id === f.goodId)?.price ?? 0 : parseAmount(f.goodPrice);
  const autoContribution = kind === 'bien' && price && members ? Math.ceil(price / (members * (1 - 0.01 - managementFeeRate)) / 25) * 25 : 0;

  async function submit() {
    setError(null);
    try {
      const t = await api<{ id: string }>('/tontines', { body: {
        name: f.name, description: f.description || undefined, frequency: f.frequency, maxMembers: members, orderMode: f.orderMode,
        visibility: f.visibility, kind, partnerId, joinAsMember: f.joinAsMember,
        contributionAmount: kind === 'argent' ? parseAmount(f.amount) : undefined,
        guaranteeAmount: f.guarantee ? parseAmount(f.guarantee) : undefined,
        goodId: kind === 'bien' && f.goodId ? f.goodId : undefined,
        goodLabel: kind === 'bien' && !f.goodId ? f.goodLabel : undefined,
        goodPrice: kind === 'bien' && !f.goodId ? parseAmount(f.goodPrice) : undefined,
      } });
      onCreated(t.id);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Segmented value={kind} onChange={setKind} options={[['argent', '💰 Tontine d’argent'], ['bien', '🛍️ Tontine de bien']]} />
      <Field label="Nom de la tontine"><Input required value={f.name} onChange={set('name')} placeholder={kind === 'bien' ? 'Une moto pour chacun' : 'Tontine du marché'} /></Field>
      {kind === 'bien' && (
        <>
          <Field label="Bien"><Select value={f.goodId} onChange={set('goodId')}>
            <option value="">Bien libre (je saisis le nom et le prix)</option>
            {goods.data?.map((g) => <option key={g.id} value={g.id}>{g.name} — {fcfa(g.price)} ({g.partner?.name})</option>)}
          </Select></Field>
          {!f.goodId && <div className="form-grid">
            <Field label="Nom du bien"><Input required value={f.goodLabel} onChange={set('goodLabel')} /></Field>
            <Field label="Prix (F)"><Input required inputMode="numeric" value={f.goodPrice} onChange={set('goodPrice')} /></Field>
          </div>}
        </>
      )}
      <div className="form-grid">
        {kind === 'argent'
          ? <Field label="Cotisation (F)"><Input required inputMode="numeric" value={f.amount} onChange={set('amount')} placeholder="10 000" /></Field>
          : <Field label="Cotisation calculée" hint="Pour que le pot couvre le prix après commission."><Input disabled value={autoContribution ? fcfa(autoContribution) : '—'} /></Field>}
        <Field label="Fréquence"><Select value={f.frequency} onChange={set('frequency')}><option value="weekly">Chaque semaine</option><option value="monthly">Chaque mois</option></Select></Field>
        <Field label="Nombre de membres"><Input required inputMode="numeric" value={f.maxMembers} onChange={(e) => setF({ ...f, maxMembers: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Ordre de passage"><Select value={f.orderMode} onChange={set('orderMode')}><option value="random">Tirage au sort</option><option value="fixed">Ordre fixé par l'organisateur</option></Select></Field>
        <Field label="Visibilité"><Select value={f.visibility} onChange={set('visibility')}><option value="private">Privée (sur invitation)</option><option value="public">Publique (dans Découvrir)</option></Select></Field>
        <Field label="Caution (F)" hint="Par défaut : une cotisation."><Input inputMode="numeric" value={f.guarantee} onChange={set('guarantee')} placeholder="auto" /></Field>
      </div>
      <Field label="Description (facultatif)"><Textarea value={f.description} onChange={set('description')} /></Field>
      {partnerId && <label className="check"><input type="checkbox" checked={f.joinAsMember} onChange={(e) => setF({ ...f, joinAsMember: e.target.checked })} /> Je cotise moi-même dans cette tontine</label>}
      {members > 0 && (kind === 'argent' ? parseAmount(f.amount) > 0 : autoContribution > 0) && (
        <div className="notice small">Pot de chaque tour : <b>{fcfa((kind === 'argent' ? parseAmount(f.amount) : autoContribution) * members)}</b>, versé automatiquement moins 1 % de commission{managementFeeRate ? ` et ${(managementFeeRate * 100).toFixed(1).replace('.', ',')} % de frais de gestion` : ''}.</div>
      )}
      <ErrorBox error={error} />
      <Button size="block">Créer la tontine</Button>
    </form>
  );
}
