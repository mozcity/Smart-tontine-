import { useCallback } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { useApi } from '../../lib/useApi';
import { PARTNER_TYPES } from '../../lib/format';
import { PartnerLogo } from '../../components/Brand';
import { Building2, Home, Landmark, LayoutDashboard, Package, Palette, RefreshCcw, Tag, UserCog, Users } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { ErrorBox, Loading, Notice } from '../../components/ui';
import { PartnerCtx, type Dashboard } from './context';
import TableauDeBord from './TableauDeBord';
import Groupes from './Groupes';
import Membres from './Membres';
import Catalogue from './Catalogue';
import Commandes from './Commandes';
import Finances from './Finances';
import Equipe from './Equipe';
import Parametres from './Parametres';
import NotFound from '../public/NotFound';

export default function PartnerSpace() {
  const { id } = useParams();
  const { data, error, reload: load } = useApi<Dashboard>(`/partners/${id}/dashboard`);
  const reload = useCallback(async () => { await load(); }, [load]);
  if (error) return <div className="container section"><ErrorBox error={error} /></div>;
  if (!data) return <Loading />;
  const base = `/partenaire/${id}`;
  const owner = data.role === 'owner';
  const pendingOrders = data.orders.filter((o) => o.status === 'pending').length;
  const items: (NavItem | 'sep')[] = [
    { to: base, label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: `${base}/groupes`, label: 'Tontines et coffres', icon: RefreshCcw },
    { to: `${base}/commandes`, label: 'Commandes', icon: Package, count: pendingOrders },
    { to: `${base}/membres`, label: 'Membres', icon: Users },
    { to: `${base}/catalogue`, label: 'Catalogue', icon: Tag },
    ...(owner ? [
      { to: `${base}/finances`, label: 'Finances', icon: Landmark, group: 'Administration' },
      { to: `${base}/equipe`, label: 'Équipe', icon: UserCog, group: 'Administration' },
      { to: `${base}/parametres`, label: 'Marque et paramètres', icon: Palette, group: 'Administration' },
    ] : []),
    'sep',
    { to: '/partenaire', label: 'Tous mes espaces', icon: Building2, end: true },
    { to: '/app', label: 'Mon espace membre', icon: Home },
  ];
  const p = data.partner;
  return (
    <PartnerCtx.Provider value={{ dash: data, reload }}>
      <Shell items={items} tabs={items.slice(0, 4) as NavItem[]} accent={p.primary_color} header={(
        <div className="row card tight" style={{ marginBottom: 8, borderLeft: `4px solid ${p.primary_color}` }}>
          <PartnerLogo name={p.name} logo={p.logo} color={p.primary_color} />
          <div style={{ minWidth: 0 }}><b className="small">{p.name}</b><div className="xs">{PARTNER_TYPES[p.type]} · {owner ? 'Propriétaire' : 'Gestionnaire'}</div></div>
        </div>
      )}>
        {p.status !== 'active' && (
          <div style={{ marginBottom: 16 }}><Notice tone="warn">
            {p.status === 'pending'
              ? 'Espace en attente de validation par Smart Tontine. Vous pourrez créer des groupes et vendre dès la validation (pièces : identité du responsable, récépissé, RCCM ou agrément).'
              : 'Espace suspendu. Contactez le support Smart Tontine.'}
          </Notice></div>
        )}
        <Routes>
          <Route index element={<TableauDeBord />} />
          <Route path="groupes" element={<Groupes />} />
          <Route path="membres" element={<Membres />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="commandes" element={<Commandes />} />
          {owner && <Route path="finances" element={<Finances />} />}
          {owner && <Route path="equipe" element={<Equipe />} />}
          {owner && <Route path="parametres" element={<Parametres />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </PartnerCtx.Provider>
  );
}
