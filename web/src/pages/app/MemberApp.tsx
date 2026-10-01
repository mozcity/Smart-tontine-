import { Link, Route, Routes } from 'react-router';
import { ArrowDownToLine, ArrowUpFromLine, Building2, CirclePlus, HandCoins, Home, IdCard, Plus, RefreshCcw, Send, ShoppingBag, UserRound, Users, Wallet } from 'lucide-react';
import { Shell, type NavItem } from '../../components/Shell';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
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

export default function MemberApp() {
  const spaces = useApi<{ id: string }[]>('/partners/mine');
  const { me } = useAuth();
  const items: (NavItem | 'sep')[] = [
    { to: '/app', label: 'Accueil', icon: Home, end: true },
    { to: '/app/tontines', label: 'Tontines', icon: RefreshCcw },
    { to: '/app/portefeuille', label: 'Mon jeton', icon: Wallet },
    { to: '/app/credit', label: 'Crédit', icon: HandCoins },
    { to: '/app/biens', label: 'Biens', icon: ShoppingBag, group: 'Épargner ensemble' },
    { to: '/app/coffres', label: 'Coffres de groupe', icon: Users, group: 'Épargner ensemble' },
    { to: '/app/profil', label: 'Profil et aide', icon: UserRound, group: 'Compte' },
    { to: '/app/identite', label: 'Mon identité', icon: IdCard, group: 'Compte' },
    { to: '/partenaire', label: spaces.data?.length ? 'Portail partenaire' : 'Devenir partenaire', icon: Building2, group: 'Compte' },
  ];
  return (
    <Shell
      items={items}
      tabs={[items[0], items[1], items[2]] as NavItem[]}
      fab={{ label: 'Que voulez-vous faire ?', icon: Plus, actions: [
        { label: 'Déposer', icon: ArrowDownToLine, to: '/app/portefeuille?action=depot', tone: 'green' },
        { label: 'Retirer', icon: ArrowUpFromLine, to: '/app/portefeuille?action=retrait' },
        { label: 'Envoyer', icon: Send, to: '/app/portefeuille?action=transfert', tone: 'blue' },
        { label: 'Créer une tontine', icon: CirclePlus, to: '/app/tontines?creer=1', tone: 'gold' },
        { label: 'Rejoindre', icon: Users, to: '/decouvrir' },
        { label: 'Crédit', icon: HandCoins, to: '/app/credit', tone: 'green' },
      ] }}
      footer={me && me.kyc_level < 1 ? (
        <div className="promo"><b>Vérifiez votre identité</b><span style={{ opacity: .85 }}>Plafonds relevés et accès au crédit en 2 minutes.</span>
          <Link className="btn white sm" to="/app/identite">Commencer</Link></div>
      ) : undefined}
    >
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
