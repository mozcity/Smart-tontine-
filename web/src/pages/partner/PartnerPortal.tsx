import { useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { pct, PARTNER_TYPES } from '../../lib/format';
import { PartnerLogo } from '../../components/Brand';
import { Building2, Home } from 'lucide-react';
import { Shell } from '../../components/Shell';
import { Badge, Button, ErrorBox, Field, Input, Loading, PageHead, Select, Textarea } from '../../components/ui';
import { LogoPicker } from './LogoPicker';
import PartnerSpace from './PartnerSpace';

interface Mine { id: string; name: string; type: string; logo: string | null; primary_color: string; status: string; role: string }

export default function PartnerPortal() {
  return (
    <Routes>
      <Route index element={<Spaces />} />
      <Route path=":id/*" element={<PartnerSpace />} />
    </Routes>
  );
}

const STATUS: Record<string, ['ok' | 'warn' | 'danger', string]> = { active: ['ok', 'Validé'], pending: ['warn', 'En attente de validation'], suspended: ['danger', 'Suspendu'] };

function Spaces() {
  const { data, loading } = useApi<Mine[]>('/partners/mine');
  const [creating, setCreating] = useState(false);
  return (
    <Shell items={[{ to: '/partenaire', label: 'Mes espaces', icon: Building2, end: true }, { to: '/app', label: 'Mon espace membre', icon: Home }]}>
      <div className="stack">
        <PageHead title="Portail partenaire" sub="Organisez vos tontines, coffres et ventes de biens à votre marque.">
          {!!data?.length && <Button onClick={() => setCreating(!creating)}>+ Nouvel espace</Button>}
        </PageHead>
        {loading ? <Loading /> : (
          <>
            {!!data?.length && <div className="grid">{data.map((p) => (
              <Link key={p.id} to={`/partenaire/${p.id}`} className="card card-link stack-sm" style={{ borderTop: `4px solid ${p.primary_color}` }}>
                <div className="row"><PartnerLogo name={p.name} logo={p.logo} color={p.primary_color} /><div><h3>{p.name}</h3><span className="xs">{PARTNER_TYPES[p.type]} · {p.role === 'owner' ? 'Propriétaire' : 'Gestionnaire'}</span></div></div>
                <Badge tone={STATUS[p.status][0]}>{STATUS[p.status][1]}</Badge>
              </Link>
            ))}</div>}
            {(creating || !data?.length) && <CreateSpace />}
          </>
        )}
      </div>
    </Shell>
  );
}

function CreateSpace() {
  const nav = useNavigate();
  const pricing = useApi<any>('/public/pricing');
  const [f, setF] = useState({ name: '', type: 'association', description: '', city: '', phone: '', primaryColor: '#2F2C8F', fee: '0', logo: null as string | null });
  const [error, setError] = useState<string | null>(null);
  const max = pricing.data?.partner.maxManagementFeeRate ?? 0.03;
  return (
    <div className="card stack">
      <div><h2>Créer mon espace partenaire</h2><p className="muted small" style={{ marginTop: 4 }}>Votre espace est validé par Smart Tontine (pièces : identité du responsable, récépissé d’association, RCCM ou agrément SFD) avant de pouvoir créer des groupes et vendre.</p></div>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault(); setError(null);
        try {
          const p = await api<{ id: string }>('/partners', { body: { name: f.name, type: f.type, description: f.description || undefined, city: f.city || undefined, phone: f.phone || undefined,
            primaryColor: f.primaryColor, managementFeeRate: Number(f.fee) / 100, logo: f.logo ?? undefined } });
          nav(`/partenaire/${p.id}`);
        } catch (err) { setError((err as Error).message); }
      }}>
        <LogoPicker name={f.name} value={f.logo} color={f.primaryColor} onChange={(logo) => setF({ ...f, logo })} />
        <div className="form-grid">
          <Field label="Nom *"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(PARTNER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Ville"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Couleur"><Input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value.toUpperCase() })} style={{ padding: 4 }} /></Field>
          <Field label="Frais de gestion (%)" hint={`0 à ${pct(max)} de chaque pot, affichés aux membres.`}><Input type="number" min={0} max={max * 100} step={0.5} value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></Field>
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <ErrorBox error={error} />
        <Button>Créer l’espace</Button>
      </form>
    </div>
  );
}
