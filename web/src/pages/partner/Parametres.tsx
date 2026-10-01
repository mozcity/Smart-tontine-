import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { pct } from '../../lib/format';
import { Button, Field, Input, PageHead, Textarea, useAction } from '../../components/ui';
import { InviteBox } from '../../components/InviteBox';
import { LogoPicker } from './LogoPicker';
import { usePartner } from './context';

export default function Parametres() {
  const { dash, reload } = usePartner();
  const p = dash.partner;
  const pricing = useApi<any>('/public/pricing');
  const max = pricing.data?.partner.maxManagementFeeRate ?? 0.03;
  const [f, setF] = useState({ name: p.name, description: p.description ?? '', city: p.city ?? '', phone: p.phone ?? '', primaryColor: p.primary_color, fee: String(Number(p.management_fee_rate) * 100), logo: p.logo });
  const act = useAction();
  const vitrine = `${window.location.origin}/partenaires/${p.id}`;
  return (
    <div className="stack">
      <PageHead title="Marque et paramètres" sub="Votre nom, votre logo et vos couleurs apparaissent sur vos groupes, dans « Découvrir » et sur les invitations." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => api(`/partners/${p.id}`, { method: 'PATCH', body: { name: f.name, description: f.description || undefined, city: f.city || undefined, phone: f.phone || undefined,
            primaryColor: f.primaryColor, managementFeeRate: Number(f.fee) / 100, logo: f.logo && f.logo !== p.logo ? f.logo : undefined } }), 'Paramètres enregistrés')) await reload();
        }}>
          <LogoPicker name={f.name} value={f.logo} color={f.primaryColor} onChange={(logo) => setF({ ...f, logo })} />
          <div className="form-grid">
            <Field label="Nom"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Couleur"><Input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value.toUpperCase() })} style={{ padding: 4 }} /></Field>
            <Field label="Ville"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Frais de gestion (%)" hint={`0 à ${pct(max)} ; s’applique aux nouveaux pots.`}><Input type="number" min={0} max={max * 100} step={0.5} value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Button>Enregistrer</Button>
        </form>
        <div className="card stack-sm">
          <h2>Ma vitrine publique</h2>
          {p.status === 'active'
            ? <><p className="muted small">Partagez-la : vos tontines publiques et votre catalogue, sans compte. <Link to={`/partenaires/${p.id}`}>Ouvrir</Link></p><InviteBox id={p.id} name={p.name} url={vitrine} /></>
            : <p className="muted small">Disponible après la validation de votre espace.</p>}
        </div>
      </div>
    </div>
  );
}
