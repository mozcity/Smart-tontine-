import { usePageMeta } from '../../lib/seo';
import { Banknote, ShoppingBag, Tag } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApi } from '../../lib/useApi';
import { GOOD_CATEGORIES } from '../../lib/format';
import { GoodCard, TontineCard, type Good, type PublicTontine } from '../../components/Cards';
import { Empty, Input, Loading, Segmented, Select } from '../../components/ui';

type Tab = 'argent' | 'bien' | 'catalogue';

export default function Decouvrir() {
  usePageMeta("Tontines publiques à rejoindre", "Rejoignez une tontine publique d'argent ou de biens près de chez vous : montants, rythme et places disponibles affichés.", { path: '/decouvrir' });
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) ?? 'argent';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const q = encodeURIComponent(search.trim());
  const tontines = useApi<PublicTontine[]>(tab === 'catalogue' ? null : `/public/tontines?kind=${tab}${q ? `&search=${q}` : ''}`);
  const goods = useApi<Good[]>(tab === 'catalogue' ? `/public/goods?${category ? `category=${category}&` : ''}${q ? `search=${q}` : ''}` : null);

  return (
    <div className="container section stack">
      <div><span className="eyebrow">Découvrir</span><h1>Tontines ouvertes et catalogue</h1>
        <p className="muted" style={{ marginTop: 6 }}>Rejoignez une tontine publique en quelques secondes, ou choisissez un bien à financer en tontine ou en plan d'achat.</p></div>
      <div className="row between">
        <Segmented<Tab> value={tab} onChange={(v) => setParams({ onglet: v })}
          options={[['argent', 'Tontines d’argent', Banknote], ['bien', 'Tontines de biens', ShoppingBag], ['catalogue', 'Catalogue', Tag]]} />
        <div className="row">
          {tab === 'catalogue' && (
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie" style={{ width: 190 }}>
              <option value="">Toutes catégories</option>
              {Object.entries(GOOD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" style={{ width: 220 }} />
        </div>
      </div>
      {tab === 'catalogue'
        ? goods.loading && !goods.data ? <Loading /> : goods.data?.length
          ? <div className="grid">{goods.data.map((g) => <GoodCard key={g.id} g={g} />)}</div>
          : <Empty>Aucun bien ne correspond.</Empty>
        : tontines.loading && !tontines.data ? <Loading /> : tontines.data?.length
          ? <div className="grid">{tontines.data.map((t) => <TontineCard key={t.id} t={t} />)}</div>
          : <Empty>Aucune tontine publique ouverte pour le moment.</Empty>}
      {tab === 'catalogue' && <p className="notice small">Pour acheter un bien : ouvrez un compte, puis créez un plan d'achat individuel ou une tontine de bien depuis votre espace.</p>}
    </div>
  );
}
