export interface Brand { id: string; name: string; logo: string | null; color: string; type?: string }

const initials = (name: string) => name.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Logo du partenaire (image) ou, à défaut, ses initiales sur sa couleur. */
export function PartnerLogo({ name, logo, color, size }: { name: string; logo?: string | null; color?: string | null; size?: 'sm' | 'lg' }) {
  const cls = `logo ${size ?? ''}`;
  if (logo) return <img className={cls} src={logo} alt={`Logo ${name}`} />;
  return <span className={cls} style={{ background: color ?? '#2F2C8F' }} aria-hidden="true">{initials(name) || '★'}</span>;
}

export function PartnerTag({ partner }: { partner: Brand | null | undefined }) {
  if (!partner) return null;
  return <span className="row small" style={{ gap: 6 }}><PartnerLogo name={partner.name} logo={partner.logo} color={partner.color} size="sm" /><span className="muted">{partner.name}</span></span>;
}
