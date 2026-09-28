import { Link } from 'react-router';
import { useApi } from '../../lib/useApi';
import { fcfa, num, pct } from '../../lib/format';
import { TontineCard, type PublicTontine } from '../../components/Cards';
import { PartnerLogo } from '../../components/Brand';
import { Badge } from '../../components/ui';

interface Stats { members: number; active_tontines: number; pots_paid: number; pots_amount: number; partners: number }

export default function Home() {
  const stats = useApi<Stats>('/public/stats');
  const tontines = useApi<PublicTontine[]>('/public/tontines');
  const partners = useApi<{ id: string; name: string; logo: string | null; primary_color: string; type: string; city: string | null }[]>('/public/partners');
  const pricing = useApi<any>('/public/pricing');
  const p = pricing.data;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow" style={{ color: '#9BE196' }}>Burkina Faso · Orange Money · Moov Money · Wave</span>
            <h1 style={{ marginTop: 12 }}>La tontine en ligne sûre, adossée à la microfinance.</h1>
            <p className="lead">Cotisez depuis votre téléphone, recevez votre pot à votre tour. Plus de trésorier qui garde la caisse : une caution protège le groupe, et votre régularité vous ouvre le crédit.</p>
            <div className="row">
              <Link to="/connexion" className="btn green lg">Créer ma tontine</Link>
              <Link to="/decouvrir" className="btn white lg">Rejoindre une tontine</Link>
            </div>
          </div>
          <div className="phone-mock stack">
            <div className="row between"><b>Tontine du marché</b><Badge tone="ok">Tour 3/10</Badge></div>
            <div className="card tight hero-card kpi"><span className="xs">Pot de ce tour</span><b style={{ fontSize: 26 }}>100 000 F</b><span className="xs">Versé automatiquement à Awa le 15/10</span></div>
            {[['Awa', true], ['Boukary', true], ['Céline', false], ['Drissa', true]].map(([n, ok]) => (
              <div key={String(n)} className="row between small"><span>{String(n)}</span><Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'Payé' : 'Rappel envoyé'}</Badge></div>
            ))}
            <div className="notice ok small">🛡️ Caution active : un impayé est couvert automatiquement.</div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="stat-band">
          <div className="card"><b>{num(stats.data?.members)}</b><span className="muted small">membres</span></div>
          <div className="card"><b>{num(stats.data?.active_tontines)}</b><span className="muted small">tontines actives</span></div>
          <div className="card"><b>{num(stats.data?.pots_paid)}</b><span className="muted small">pots versés</span></div>
          <div className="card"><b>{num(stats.data?.partners)}</b><span className="muted small">partenaires</span></div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Comment ça marche</span><h2>Votre tontine, sans espèces ni cahier</h2></div>
          <div className="grid">
            {[
              ['Créez ou rejoignez', 'Choisissez la cotisation, la fréquence et le nombre de membres. Invitez par lien, QR code ou WhatsApp.'],
              ['Versez la caution', 'Une cotisation bloquée à l’adhésion. Elle couvre un impayé et vous est rendue en fin de cycle.'],
              ['Cotisez en un clic', 'Orange Money, Moov Money ou Wave. Rappels automatiques la veille et le jour J.'],
              ['Recevez votre pot', 'Ordre tiré au sort de façon vérifiable. Le pot est versé automatiquement dès la dernière cotisation.'],
            ].map(([t, d], i) => (
              <div key={t} className="card stack-sm"><span className="step-num">{i + 1}</span><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Tout pour épargner ensemble</span><h2>Plus qu’une tontine</h2></div>
          <div className="grid">
            {[
              ['🛡️', 'Caution anti-impayé', 'Tour échu + 3 jours : la caution du retardataire est utilisée, le bénéficiaire est payé.'],
              ['🛍️', 'Tontines de biens', 'Moto, réfrigérateur, téléphone : cotisez pour un bien du catalogue, payé au fournisseur à la réception.'],
              ['⚡', 'Avance sur tontine', 'Besoin d’argent avant votre tour ? Jusqu’à 50 % de votre futur pot, remboursés sur le pot.'],
              ['📈', 'Microcrédit', 'Vos cotisations à l’heure construisent votre score Smart Tontine et ouvrent le crédit de nos SFD partenaires.'],
              ['👥', 'Coffres de groupe', 'Associations, dahiras, GIE, familles : caisse commune, suivi payé / impayé, retraits à double validation.'],
              ['🏢', 'Espaces partenaires', 'Associations, commerçants, entreprises et SFD organisent leurs tontines à leur logo.'],
            ].map(([i, t, d]) => (
              <div key={t} className="stack-sm"><span className="feature-icon">{i}</span><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container stack">
          <div className="row between"><div><span className="eyebrow">Découvrir</span><h2>Tontines publiques ouvertes</h2></div><Link to="/decouvrir" className="btn ghost">Tout voir</Link></div>
          {tontines.data && tontines.data.length > 0
            ? <div className="grid">{tontines.data.slice(0, 6).map((t) => <TontineCard key={t.id} t={t} />)}</div>
            : <p className="muted">Aucune tontine publique ouverte pour le moment. <Link to="/connexion">Créez la vôtre</Link>.</p>}
        </div>
      </section>

      {partners.data && partners.data.length > 0 && (
        <section className="section alt">
          <div className="container stack">
            <div className="section-title" style={{ marginBottom: 12 }}><span className="eyebrow">Ils organisent sur Smart Tontine</span><h2>Nos partenaires</h2></div>
            <div className="row" style={{ justifyContent: 'center', gap: 20 }}>
              {partners.data.map((x) => (
                <Link key={x.id} to={`/partenaires/${x.id}`} className="row card tight card-link" style={{ gap: 10 }}>
                  <PartnerLogo name={x.name} logo={x.logo} color={x.primary_color} /><div><b>{x.name}</b><div className="xs">{x.city}</div></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Tarifs transparents</span><h2>Gratuit pour cotiser</h2><p>Inscription, dépôt, cotisation, épargne et rappels sont gratuits.</p></div>
          {p && (
            <div className="grid">
              <div className="card stack-sm center"><span className="muted">Pot de tontine reçu</span><span className="price">{pct(p.tontine.commissionRate)}</span><span className="xs">du pot, au bénéficiaire du tour</span></div>
              <div className="card stack-sm center"><span className="muted">Retrait Mobile Money</span><span className="price">{pct(p.withdrawal.rate)}</span><span className="xs">min. {fcfa(p.withdrawal.min)}, max. {fcfa(p.withdrawal.max)}</span></div>
              <div className="card stack-sm center"><span className="muted">Smart Tontine+</span><span className="price">{fcfa(p.plus.monthlyPrice)}</span><span className="xs">par mois : retraits offerts, support prioritaire</span></div>
              <div className="card stack-sm center"><span className="muted">Organisateur Pro</span><span className="price">{fcfa(p.pro.monthlyPrice)}</span><span className="xs">par mois : groupes illimités, exports</span></div>
            </div>
          )}
          <p className="center" style={{ marginTop: 20 }}><Link to="/tarifs">Voir la grille complète →</Link></p>
        </div>
      </section>

      <section className="container">
        <div className="cta-band row between">
          <div className="stack-sm" style={{ maxWidth: 620 }}>
            <h2 style={{ fontSize: 26 }}>Association, commerçant, entreprise ou SFD ?</h2>
            <p>Organisez vos tontines et vos caisses à votre logo, suivez les cotisations en temps réel, vendez vos biens en tontine. Licence dès {p ? fcfa(p.partner.perMemberMonthly) : '75 F'} par membre actif et par mois.</p>
          </div>
          <Link to="/devenir-partenaire" className="btn white lg">Devenir partenaire</Link>
        </div>
      </section>
    </>
  );
}
