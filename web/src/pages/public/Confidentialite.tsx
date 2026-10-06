import { usePageMeta } from '../../lib/seo';
import { Link } from 'react-router';

/**
 * Politique de confidentialité, à l'adresse /confidentialite (URL déclarée sur Google Play et l'App Store).
 * Texte de travail fidèle au fonctionnement réel de l'application ; validation juridique avant publication.
 */
const SECTIONS: [string, React.ReactNode][] = [
  ['Qui sommes-nous ?', <>Smart Tontine est un service de tontine et d’épargne en ligne opéré au Burkina Faso. Les fonds des membres sont cantonnés auprès d’un établissement agréé par la BCEAO ; les crédits sont accordés par des systèmes financiers décentralisés (SFD) agréés. Contact du délégué à la protection des données : <b>dpo@smarttontine.app</b>.</>],
  ['Données collectées', <ul>
    <li><b>Compte</b> : numéro de téléphone (identifiant de connexion), nom, e-mail facultatif, code PIN (stocké sous forme chiffrée irréversible).</li>
    <li><b>Identité (KYC)</b> : photo de la pièce d’identité, selfie, justificatif de domicile — uniquement si vous demandez à relever vos plafonds.</li>
    <li><b>Opérations</b> : dépôts, retraits, cotisations, transferts, crédits, achats de biens, avec leur date et leur montant.</li>
    <li><b>Groupes</b> : tontines et coffres que vous rejoignez, vos cotisations dans ces groupes.</li>
    <li><b>Usage</b> : événements techniques (connexion, écrans clés) pour améliorer le service. Pas de publicité ciblée, pas de revente.</li>
  </ul>],
  ['Ce que nous ne collectons pas', <>Ni contacts du téléphone, ni position GPS, ni micro. L’appareil photo n’est utilisé que lorsque vous photographiez votre pièce d’identité ou un bien.</>],
  ['Pourquoi', <ul>
    <li>Exécuter le service : tenir votre portefeuille, faire tourner les tontines, verser les pots.</li>
    <li>Obligations légales : connaissance client et lutte contre le blanchiment (LBC/FT, BCEAO).</li>
    <li>Sécurité : prévention de la fraude, codes de connexion par SMS.</li>
    <li>Crédit : calcul d’un score à partir de votre régularité de cotisation, transmis au SFD seulement si vous demandez un crédit.</li>
  </ul>],
  ['Avec qui ces données sont partagées', <ul>
    <li><b>Membres de vos groupes</b> : votre nom et vos cotisations dans ce groupe. Votre numéro leur apparaît masqué (+226 70 •• •• 56) ; seul l’organisateur du groupe le voit en entier.</li>
    <li><b>Agrégateur de paiement</b> (CinetPay) et opérateurs Mobile Money : ce qui est nécessaire à chaque paiement.</li>
    <li><b>Fournisseurs SMS</b> (Orange, Twilio) : votre numéro et le texte du message.</li>
    <li><b>Établissement agréé et SFD partenaires</b> : pour la garde des fonds et les crédits que vous demandez.</li>
    <li><b>Partenaires</b> (association, commerçant…) : seulement pour les groupes qu’ils organisent et que vous avez rejoints.</li>
    <li><b>Autorités</b> : sur réquisition légale.</li>
  </ul>],
  ['Durée de conservation', <>Données de compte : tant que le compte est ouvert. Opérations financières et dossier d’identité : <b>10 ans</b> après la fin de la relation (obligation LBC/FT). Journaux de SMS : 12 mois. Événements d’usage : 24 mois.</>],
  ['Sécurité', <>Connexions chiffrées (HTTPS), pièces d’identité chiffrées au repos, PIN et secrets chiffrés, sessions courtes, double authentification pour le personnel, contrôle des droits sur chaque opération, tests d’intrusion réguliers.</>],
  ['Vos droits', <>Accès, rectification, opposition et suppression : depuis l’application (Profil) ou par écrit à <b>dpo@smarttontine.app</b>. Vous pouvez saisir la Commission de l’Informatique et des Libertés (CIL) du Burkina Faso.</>],
  ['Supprimer votre compte', <>Dans l’application : <b>Profil → Supprimer mon compte</b>. Sur le web : <Link to="/suppression-compte">page de suppression du compte</Link>. Les données soumises à une obligation légale de conservation sont gardées le temps requis, puis effacées.</>],
];

export default function Confidentialite() {
  usePageMeta("Politique de confidentialité", "Données collectées, finalités, partage, durées de conservation, sécurité et vos droits sur Smart Tontine.", { path: '/confidentialite' });
  return (
    <div className="container section stack" style={{ maxWidth: 820 }}>
      <h1>Politique de confidentialité</h1>
      <p className="muted">Dernière mise à jour : 2 octobre 2026</p>
      {SECTIONS.map(([t, d]) => <section key={t} className="card stack-sm"><h2>{t}</h2><div className="muted">{d}</div></section>)}
    </div>
  );
}
