import { usePageMeta } from '../../lib/seo';
/** Pages légales : la structure est prête, le texte définitif doit être validé par le juriste (cahier des charges F-PUB-06). */
export default function Legal() {
  usePageMeta("Informations légales", "Conditions générales, fonds cantonnés auprès d'un établissement agréé BCEAO, crédit par des SFD agréés, tontines de biens.", { path: '/legal' });
  const sections: [string, string][] = [
    ['Conditions générales d’utilisation', 'Objet du service, inscription et vérification d’identité (KYC), fonctionnement des tontines (caution, ordre de passage, pénalités de retard, clôture des tours échus), tarifs, responsabilités, suspension du compte, droit applicable (Burkina Faso, UEMOA).'],
    ['Fonds des membres', 'Les fonds sont cantonnés auprès d’un établissement agréé par la BCEAO. Smart Tontine agit comme prestataire technique ; les partenaires ne détiennent jamais l’argent des membres.'],
    ['Crédit', 'Les avances et microcrédits sont accordés par des Systèmes Financiers Décentralisés (SFD) agréés, sous le taux d’usure. Smart Tontine distribue l’offre et calcule le score.'],
    ['Tontines de biens', 'Épargne collective en vue de l’achat d’un bien. Le prix est payé au séquestre puis au fournisseur à la réception confirmée. Ce n’est pas une vente à crédit ; Smart Tontine n’avance jamais le prix d’un bien. Garantie et livraison relèvent du fournisseur.'],
    ['Données personnelles', 'Traitement déclaré à la Commission de l’Informatique et des Libertés (CIL). Données minimales, conservées 10 ans pour les opérations financières (LBC/FT). Détail dans la politique de confidentialité (/confidentialite) ; suppression du compte depuis l’application ou sur /suppression-compte.'],
  ];
  return (
    <div className="container section stack" style={{ maxWidth: 820 }}>
      <h1>Informations légales</h1>
      <div className="notice warn small">Version de travail : textes à finaliser et valider juridiquement avant l’ouverture au public.</div>
      {sections.map(([t, d]) => <div key={t} className="card stack-sm"><h2>{t}</h2><p className="muted">{d}</p></div>)}
    </div>
  );
}
