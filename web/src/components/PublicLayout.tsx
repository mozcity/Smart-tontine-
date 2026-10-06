import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { Menu, X } from 'lucide-react';
import { LogoMark } from './ui';

export function PublicLayout() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <>
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand"><LogoMark /> Smart Tontine</Link>
          <nav className={`nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
            <NavLink to="/decouvrir">Découvrir</NavLink>
            <NavLink to="/partenaires">Partenaires</NavLink>
            <NavLink to="/tarifs">Tarifs</NavLink>
            <NavLink to="/devenir-partenaire">Devenir partenaire</NavLink>
            {!me && <NavLink to="/connexion" className="only-sm">Se connecter</NavLink>}
            {me && <NavLink to="/app" className="only-sm">Mon espace</NavLink>}
          </nav>
          <div className="row hide-sm">
            {me
              ? <Link className="btn" to="/app">Mon espace</Link>
              : <><Link className="btn ghost" to={`/connexion?next=${encodeURIComponent(loc.pathname)}`}>Se connecter</Link><Link className="btn green" to="/connexion">Ouvrir un compte</Link></>}
          </div>
          <button className="icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </header>
      <main id="contenu" tabIndex={-1}><Outlet /></main>
      <footer className="site-footer">
        <div className="container stack">
          <div className="grid">
            <div className="stack-sm">
              <div className="brand"><LogoMark /> Smart Tontine</div>
              <p>La tontine en ligne sûre, adossée à la microfinance. Ouagadougou, Burkina Faso.</p>
            </div>
            <div className="stack-sm"><b style={{ color: '#fff' }}>Produit</b><Link to="/decouvrir">Tontines publiques</Link><Link to="/decouvrir?onglet=catalogue">Catalogue de biens</Link><Link to="/tarifs">Tarifs</Link></div>
            <div className="stack-sm"><b style={{ color: '#fff' }}>Partenaires</b><Link to="/devenir-partenaire">Associations, commerçants, SFD</Link><Link to="/partenaires">Nos partenaires</Link><Link to="/partenaire">Portail partenaire</Link></div>
            <div className="stack-sm"><b style={{ color: '#fff' }}>Aide</b><Link to="/devenir-partenaire?type=contact">Nous contacter</Link><Link to="/legal">Conditions générales</Link><Link to="/confidentialite">Confidentialité</Link><Link to="/suppression-compte">Supprimer mon compte</Link></div>
          </div>
          <p className="xs">© {new Date().getFullYear()} Smart Tontine. Fonds des membres cantonnés auprès d'un établissement agréé par la BCEAO. Crédits accordés par nos SFD partenaires agréés.</p>
        </div>
      </footer>
    </>
  );
}
