import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Field, Input, PageHead, Select, useAction } from '../../components/ui';
import { usePartner } from './context';

export default function Equipe() {
  const { dash, reload } = usePartner();
  const { me } = useAuth();
  const [f, setF] = useState({ phone: '+226', role: 'manager' });
  const act = useAction();
  return (
    <div className="stack">
      <PageHead title="Équipe" sub="Les gestionnaires démarrent les tontines, clôturent les tours et livrent les commandes. Seuls les propriétaires gèrent les finances, l’équipe et la marque." />
      <div className="card stack-sm">
        {dash.staff.map((s) => (
          <div key={s.id} className="list-row">
            <div className="grow"><b>{s.full_name ?? '—'}</b> {s.id === me?.id && <span className="xs">(moi)</span>}<div className="xs">{s.phone}</div></div>
            <Badge tone={s.role === 'owner' ? 'brand' : 'info'}>{s.role === 'owner' ? 'Propriétaire' : 'Gestionnaire'}</Badge>
            {s.id !== me?.id && <button className="linkbtn small" onClick={async () => { if (confirm(`Retirer ${s.full_name ?? s.phone} de l’équipe ?`) && await act(() => api(`/partners/${dash.partner.id}/staff/${s.id}`, { method: 'DELETE' }), 'Membre retiré')) await reload(); }}>Retirer</button>}
          </div>
        ))}
      </div>
      <div className="card stack-sm">
        <h2>Ajouter un membre de l’équipe</h2>
        <p className="muted small">La personne doit avoir un compte Smart Tontine (inscription gratuite par SMS).</p>
        <div className="form-grid">
          <Field label="Téléphone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\s/g, '') })} /></Field>
          <Field label="Rôle"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="manager">Gestionnaire</option><option value="owner">Propriétaire</option></Select></Field>
        </div>
        <Button disabled={f.phone.length < 10} onClick={async () => { if (await act(() => api(`/partners/${dash.partner.id}/staff`, { body: f }), 'Ajouté à l’équipe')) { setF({ ...f, phone: '+226' }); await reload(); } }}>Ajouter</Button>
      </div>
    </div>
  );
}
