import { Route, Routes } from 'react-router';
import { Shell, type NavItem } from '../../components/Shell';
import { useApi } from '../../lib/useApi';
import Accueil from './Accueil';
import Tontines from './Tontines';
import TontineDetail from './TontineDetail';
import Portefeuille from './Portefeuille';
import Credit from './Credit';
import Biens from './Biens';
import Coffres from './Coffres';
import CoffreDetail from './CoffreDetail';
import Profil from './Profil';
import Identite from './Identite';
import NotFound from '../public/NotFound';

const items: (NavItem | 'sep')[] = [
  { to: '/app', label: 'Accueil', icon: '🏠', end: true },
  { to: '/app/tontines', label: 'Mes tontines', icon: '🔄' },
  { to: '/app/portefeuille', label: 'Mon jeton', icon: '💳' },
  { to: '/app/credit', label: 'Crédit', icon: '📈' },
  { to: '/app/biens', label: 'Biens', icon: '🛍️' },
  { to: '/app/coffres', label: 'Coffres de groupe', icon: '👥' },
  'sep',
  { to: '/app/profil', label: 'Profil et aide', icon: '👤' },
  { to: '/app/identite', label: 'Vérification d’identité', icon: '🪪' },
];

export default function MemberApp() {
  const spaces = useApi<{ id: string }[]>('/partners/mine');
  const nav = [...items, { to: '/partenaire', label: spaces.data?.length ? 'Portail partenaire' : 'Devenir partenaire', icon: '🏢' }];
  return (
    <Shell items={nav}>
      <Routes>
        <Route index element={<Accueil />} />
        <Route path="tontines" element={<Tontines />} />
        <Route path="tontines/:id" element={<TontineDetail />} />
        <Route path="portefeuille" element={<Portefeuille />} />
        <Route path="credit" element={<Credit />} />
        <Route path="biens" element={<Biens />} />
        <Route path="coffres" element={<Coffres />} />
        <Route path="coffres/:id" element={<CoffreDetail />} />
        <Route path="profil" element={<Profil />} />
        <Route path="identite" element={<Identite />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
