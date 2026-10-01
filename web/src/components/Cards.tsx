import { Bike, CookingPot, Package, Refrigerator, Shirt, Smartphone, Sofa, Wheat, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { fcfa, FREQ, GOOD_CATEGORIES } from '../lib/format';
import { PartnerTag, type Brand } from './Brand';
import { Badge, Progress } from './ui';

export interface PublicTontine {
  id: string; name: string; description?: string | null; kind: 'argent' | 'bien'; contribution_amount: number; frequency: string;
  max_members: number; members: number; guarantee_amount?: number; good_label: string | null; good_price: number | null;
  good_image?: string | null; partner: Brand | null;
}

export function TontineCard({ t }: { t: PublicTontine }) {
  const free = t.max_members - t.members;
  return (
    <Link to={`/rejoindre/${t.id}`} className="card card-link stack-sm">
      <div className="row between">
        <Badge tone={t.kind === 'bien' ? 'warn' : 'brand'}>{t.kind === 'bien' ? 'Tontine de bien' : 'Tontine'}</Badge>
        <span className="xs">{free > 0 ? `${free} place${free > 1 ? 's' : ''}` : 'Complète'}</span>
      </div>
      <h3>{t.name}</h3>
      {t.kind === 'bien' && t.good_label && <p className="small muted">{t.good_label} · {fcfa(t.good_price)}</p>}
      <p><span className="amount">{fcfa(t.contribution_amount)}</span> <span className="muted small">/ {FREQ[t.frequency]}</span></p>
      <Progress value={(100 * t.members) / t.max_members} />
      <div className="row between">
        <span className="xs">{t.members}/{t.max_members} membres · pot {fcfa(t.contribution_amount * t.max_members)}</span>
        <PartnerTag partner={t.partner} />
      </div>
    </Link>
  );
}

export interface Good { id: string; name: string; description: string | null; category: string; price: number; image: string | null; stock: number | null; partner?: Brand }

const CAT_ICON: Record<string, LucideIcon> = { moto: Bike, electromenager: Refrigerator, telephone: Smartphone, mobilier: Sofa, cuisine: CookingPot, textile: Shirt, alimentaire: Wheat, materiel_pro: Wrench, autre: Package };

export function GoodCard({ g, action }: { g: Good; action?: React.ReactNode }) {
  return (
    <div className="card stack-sm">
      {g.image ? <img className="good-img" src={g.image} alt={g.name} /> : <div className="good-img" aria-hidden="true">{(() => { const I = CAT_ICON[g.category] ?? Package; return <I size={44} strokeWidth={1.5} />; })()}</div>}
      <div className="row between"><Badge tone="muted">{GOOD_CATEGORIES[g.category] ?? g.category}</Badge>{g.stock !== null && <span className="xs">{g.stock > 0 ? `${g.stock} en stock` : 'Rupture'}</span>}</div>
      <h3>{g.name}</h3>
      {g.description && <p className="small muted">{g.description}</p>}
      <p className="price" style={{ fontSize: 22 }}>{fcfa(g.price)}</p>
      <PartnerTag partner={g.partner} />
      {action}
    </div>
  );
}
