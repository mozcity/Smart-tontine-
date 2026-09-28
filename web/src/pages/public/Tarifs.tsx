import { Link } from 'react-router';
import { useApi } from '../../lib/useApi';
import { fcfa, pct } from '../../lib/format';
import { Loading } from '../../components/ui';

/** Grille tarifaire lue en direct depuis l'API : aucun prix n'est codé en dur dans le site. */
export default function Tarifs() {
  const { data: p } = useApi<any>('/public/pricing');
  if (!p) return <Loading />;
  const rows: [string, string, string][] = [
    ['Inscription, dépôt, cotisation, épargne, rappels', 'Gratuit', '—'],
    ['Pot de tontine versé', `${pct(p.tontine.commissionRate)} du pot`, 'Bénéficiaire du tour'],
    ['Retrait vers Mobile Money', `${pct(p.withdrawal.rate)} (min. ${fcfa(p.withdrawal.min)}, max. ${fcfa(p.withdrawal.max)})`, 'Membre'],
    ['Cotisation en retard', `${pct(p.tontine.latePenaltyRate)} de la cotisation, reversés au bénéficiaire`, 'Retardataire'],
    ['Retrait d’un coffre de groupe', pct(p.cagnotteWithdrawal.rate), 'Bénéficiaire'],
    ['Rupture anticipée d’e-caisse', pct(p.ecaisseEarlyBreak.rate), 'Membre'],
    ['Transfert entre membres', 'Gratuit', '—'],
    ['Smart Tontine+', `${fcfa(p.plus.monthlyPrice)} / mois : ${p.plus.freeWithdrawalsPerMonth} retraits offerts, support prioritaire`, 'Membre'],
    ['Organisateur Pro', `${fcfa(p.pro.monthlyPrice)} / mois : plus de ${p.pro.freeOrganizerLimit} groupes, exports`, 'Organisateur'],
    ['Avance sur tontine, microcrédit', `${pct(p.credit.microcredit.monthlyRate, 1)} / mois sur capital restant dû (${pct(p.credit.microcredit.monthlyRate * 12)} / an)`, 'Emprunteur'],
    ['Licence partenaire', `${fcfa(p.partner.perMemberMonthly)} par membre actif / mois, minimum ${fcfa(p.partner.minimumMonthly)}`, 'Partenaire'],
    ['Frais de gestion du partenaire', `0 à ${pct(p.partner.maxManagementFeeRate)} du pot, affichés avant l’adhésion`, 'Membres du partenaire'],
    ['Commission fournisseur (biens)', `${pct(p.goods.supplierCommissionRate)} du prix, à la réception`, 'Commerçant'],
  ];
  return (
    <div className="container section stack">
      <div><span className="eyebrow">Tarifs</span><h1>Des frais simples et affichés</h1><p className="muted" style={{ marginTop: 6 }}>Chaque frais est affiché avant validation. Aucun frais caché.</p></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Opération</th><th>Prix</th><th>Qui paie</th></tr></thead>
          <tbody>{rows.map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td><td className="muted">{c}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="grid-2">
        <div className="card stack-sm"><h3>Plafonds par niveau de vérification</h3>
          <table><thead><tr><th>Niveau</th><th>Solde max.</th><th>Dépôts / mois</th></tr></thead>
            <tbody>{Object.entries(p.limits as Record<string, { balance: number; monthlyInflow: number }>).map(([k, v]) => (
              <tr key={k}><td>KYC {k}</td><td>{fcfa(v.balance)}</td><td>{fcfa(v.monthlyInflow)}</td></tr>))}</tbody></table>
        </div>
        <div className="card stack-sm"><h3>Crédit responsable</h3><p className="muted small">Les crédits sont accordés par nos SFD partenaires agréés, sous le taux d’usure ({pct(p.credit.usuryApr)} / an). Avance jusqu’à {pct(p.credit.advance.maxShareOfPot)} du futur pot ; microcrédit de {fcfa(p.credit.microcredit.minAmount)} à {fcfa(p.credit.microcredit.maxAmount)} dès un score de {p.credit.microcredit.minScore}.</p>
          <Link to="/connexion" className="btn green">Voir mon score</Link></div>
      </div>
    </div>
  );
}
