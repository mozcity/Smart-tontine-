import { Link } from 'react-router';

export default function NotFound() {
  return <div className="container section center stack"><h1>Page introuvable</h1><p className="muted">Le lien est peut-être incomplet ou expiré.</p><p><Link className="btn" to="/">Retour à l'accueil</Link></p></div>;
}
