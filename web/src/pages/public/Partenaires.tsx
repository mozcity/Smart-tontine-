import { usePageMeta } from '../../lib/seo';
import { Link } from 'react-router';
import { useApi } from '../../lib/useApi';
import { PARTNER_TYPES } from '../../lib/format';
import { PartnerLogo } from '../../components/Brand';
import { Empty, Loading } from '../../components/ui';

interface P { id: string; name: string; type: string; logo: string | null; primary_color: string; city: string | null; description: string | null; open_tontines: number; goods: number }

export default function Partenaires() {
  usePageMeta("Nos partenaires", "Associations, commerçants, entreprises et SFD qui organisent leurs tontines sur Smart Tontine.", { path: '/partenaires' });
  const { data, loading } = useApi<P[]>('/public/partners');
  return (
    <div className="container section stack">
      <div className="row between">
        <div><span className="eyebrow">Réseau</span><h1>Nos partenaires</h1><p className="muted" style={{ marginTop: 6 }}>Associations, commerçants, entreprises, tontiniers et SFD qui organisent leurs tontines sur Smart Tontine.</p></div>
        <Link to="/devenir-partenaire" className="btn green">Devenir partenaire</Link>
      </div>
      {loading ? <Loading /> : !data?.length ? <Empty>Les premiers partenaires arrivent bientôt.</Empty> : (
        <div className="grid">
          {data.map((p) => (
            <Link key={p.id} to={`/partenaires/${p.id}`} className="card card-link stack-sm" style={{ borderTop: `4px solid ${p.primary_color}` }}>
              <div className="row"><PartnerLogo name={p.name} logo={p.logo} color={p.primary_color} /><div><h3>{p.name}</h3><span className="xs">{PARTNER_TYPES[p.type]}{p.city ? ` · ${p.city}` : ''}</span></div></div>
              {p.description && <p className="small muted">{p.description}</p>}
              <p className="small">{p.open_tontines} tontine{p.open_tontines > 1 ? 's' : ''} ouverte{p.open_tontines > 1 ? 's' : ''} · {p.goods} bien{p.goods > 1 ? 's' : ''} au catalogue</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
