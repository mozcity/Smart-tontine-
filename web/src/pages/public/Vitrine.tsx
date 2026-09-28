import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/useApi';
import { fcfa, FREQ, PARTNER_TYPES } from '../../lib/format';
import { PartnerLogo } from '../../components/Brand';
import { GoodCard, type Good } from '../../components/Cards';
import { Badge, Empty, ErrorBox, Loading } from '../../components/ui';

interface Showcase {
  id: string; name: string; type: string; description: string | null; logo: string | null; primary_color: string; city: string | null; phone: string | null;
  tontines: { id: string; name: string; kind: string; contribution_amount: number; frequency: string; max_members: number; members: number; good_label: string | null; good_price: number | null }[];
  goods: Good[];
}

/** Vitrine publique d'un partenaire, partageable par lien. */
export default function Vitrine() {
  const { id } = useParams();
  const { data: p, error, loading } = useApi<Showcase>(`/public/partners/${id}`);
  if (loading) return <Loading />;
  if (error || !p) return <div className="container section"><ErrorBox error={error ?? 'Partenaire introuvable'} /></div>;
  const brand = { id: p.id, name: p.name, logo: p.logo, color: p.primary_color };
  return (
    <>
      <section style={{ background: p.primary_color, color: '#fff', padding: '48px 0' }}>
        <div className="container row" style={{ gap: 20 }}>
          <PartnerLogo name={p.name} logo={p.logo} color="rgba(255,255,255,.2)" size="lg" />
          <div className="stack-sm"><h1>{p.name}</h1><p style={{ opacity: .85 }}>{PARTNER_TYPES[p.type]}{p.city ? ` · ${p.city}` : ''}{p.phone ? ` · ${p.phone}` : ''}</p>
            {p.description && <p style={{ opacity: .9, maxWidth: 640 }}>{p.description}</p>}</div>
        </div>
      </section>
      <div className="container section stack">
        <h2>Tontines ouvertes</h2>
        {p.tontines.length === 0 ? <Empty>Aucune tontine ouverte en ce moment.</Empty> : (
          <div className="grid">
            {p.tontines.map((t) => (
              <Link key={t.id} to={`/rejoindre/${t.id}`} className="card card-link stack-sm">
                <Badge tone={t.kind === 'bien' ? 'warn' : 'brand'}>{t.kind === 'bien' ? '🛍️ Bien' : '💰 Argent'}</Badge>
                <h3>{t.name}</h3>
                {t.good_label && <p className="small muted">{t.good_label} · {fcfa(t.good_price)}</p>}
                <p><span className="amount">{fcfa(t.contribution_amount)}</span> <span className="muted small">/ {FREQ[t.frequency]}</span></p>
                <span className="xs">{t.members}/{t.max_members} membres</span>
              </Link>
            ))}
          </div>
        )}
        {p.goods.length > 0 && <><h2>Catalogue</h2><div className="grid">{p.goods.map((g) => <GoodCard key={g.id} g={{ ...g, partner: brand }} />)}</div></>}
      </div>
    </>
  );
}
