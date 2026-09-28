import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { fcfa, FREQ, parseAmount } from '../../lib/format';
import { PartnerTag, type Brand } from '../../components/Brand';
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Modal, PageHead, Select } from '../../components/ui';

export interface Coffre { id: string; name: string; category: string; visibility: string; contribution_amount: number | null; frequency: string; target_amount: number | null;
  status: string; balance: number; role: string; partner: Brand | null; members: number }
export const CATEGORIES: Record<string, string> = { association: 'Association', dahira: 'Dahira', religieux: 'Religieux', famille: 'Famille', gie: 'GIE', asc: 'ASC', projet: 'Projet', autre: 'Autre' };

export default function Coffres() {
  const { data, loading } = useApi<Coffre[]>('/cagnottes');
  const [creating, setCreating] = useState(false);
  return (
    <div className="stack">
      <PageHead title="Coffres de groupe" sub="Caisse commune d’association, de famille ou de GIE : cotisations suivies, retraits à double validation.">
        <Button onClick={() => setCreating(true)}>+ Nouveau coffre</Button>
      </PageHead>
      {loading ? <Loading /> : !data?.length ? <Empty>Aucun coffre de groupe.</Empty> : (
        <div className="grid">{data.map((c) => (
          <Link key={c.id} to={`/app/coffres/${c.id}`} className="card card-link stack-sm">
            <div className="row between"><Badge tone="brand">{CATEGORIES[c.category] ?? c.category}</Badge>{c.role === 'admin' && <Badge tone="info">Administrateur</Badge>}</div>
            <h3>{c.name}</h3>
            <p className="price" style={{ fontSize: 22 }}>{fcfa(c.balance)}</p>
            <span className="xs">{c.members} membres{c.contribution_amount ? ` · ${fcfa(c.contribution_amount)} / ${FREQ[c.frequency]}` : ''}</span>
            <PartnerTag partner={c.partner} />
          </Link>
        ))}</div>
      )}
      {creating && <CreateCoffre onClose={() => setCreating(false)} />}
    </div>
  );
}

export function CreateCoffre({ onClose, partnerId, onCreated }: { onClose: () => void; partnerId?: string; onCreated?: () => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', category: 'association', contribution: '', frequency: 'monthly', target: '', approvals: '2', visibility: 'private' });
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Nouveau coffre de groupe" onClose={onClose}>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault(); setError(null);
        try {
          const c = await api<{ id: string }>('/cagnottes', { body: { name: f.name, category: f.category, frequency: f.frequency, visibility: f.visibility, partnerId,
            contributionAmount: parseAmount(f.contribution) || undefined, targetAmount: parseAmount(f.target) || undefined, requiredApprovals: Number(f.approvals) } });
          if (onCreated) onCreated(); else nav(`/app/coffres/${c.id}`);
        } catch (err) { setError((err as Error).message); }
      }}>
        <Field label="Nom"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Caisse de solidarité" /></Field>
        <div className="form-grid">
          <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Cotisation attendue (F)"><Input inputMode="numeric" value={f.contribution} onChange={(e) => setF({ ...f, contribution: e.target.value })} placeholder="facultatif" /></Field>
          <Field label="Fréquence"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}><option value="weekly">Semaine</option><option value="monthly">Mois</option><option value="free">Libre</option></Select></Field>
          <Field label="Objectif (F)"><Input inputMode="numeric" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="facultatif" /></Field>
          <Field label="Validations pour un retrait"><Select value={f.approvals} onChange={(e) => setF({ ...f, approvals: e.target.value })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} administrateur{n > 1 ? 's' : ''}</option>)}</Select></Field>
          <Field label="Visibilité"><Select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}><option value="private">Privé</option><option value="public">Public</option></Select></Field>
        </div>
        <ErrorBox error={error} />
        <Button size="block">Créer le coffre</Button>
      </form>
    </Modal>
  );
}
