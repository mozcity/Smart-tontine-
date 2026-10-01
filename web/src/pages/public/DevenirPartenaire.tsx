import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { fcfa, pct, PARTNER_TYPES } from '../../lib/format';
import { CheckCircle2, Coins, LayoutDashboard, Palette, ShieldCheck, ShoppingBag, type LucideIcon } from 'lucide-react';
import { Button, ErrorBox, Field, Ico, Input, Segmented, Select, Textarea } from '../../components/ui';

type Kind = 'partenaire' | 'sfd' | 'contact';

export default function DevenirPartenaire() {
  const [params] = useSearchParams();
  const { data: p } = useApi<any>('/public/pricing');
  const [kind, setKind] = useState<Kind>((params.get('type') as Kind) ?? 'partenaire');
  const [f, setF] = useState({ name: '', organization: '', partnerType: 'association', phone: '', email: '', city: '', members: '', message: '', website: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setError(null);
    try {
      await api('/public/leads', { body: {
        kind, name: f.name, phone: f.phone, organization: f.organization || undefined, email: f.email || undefined, city: f.city || undefined,
        partnerType: kind === 'contact' ? undefined : kind === 'sfd' ? 'sfd' : f.partnerType,
        members: f.members ? Number(f.members) : undefined, message: f.message || undefined, website: f.website || undefined,
      } });
      setSent(true);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="container section grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <span className="eyebrow">Partenaires</span>
        <h1>Organisez vos tontines à votre marque</h1>
        <p className="muted">Associations et GIE, commerçants, entreprises, tontiniers professionnels et SFD : un espace à votre nom et à votre logo, sans rien développer.</p>
        {([
          [Palette, 'Votre logo et vos couleurs', 'sur vos groupes, dans « Découvrir » et sur les invitations.'],
          [LayoutDashboard, 'Tableau de bord', 'membres actifs, collecte du mois, impayés, commandes, relevé exportable.'],
          [ShoppingBag, 'Vendez en tontine', 'motos, électroménager, pagnes… payés au séquestre, versés à la réception.'],
          [Coins, 'Vos frais de gestion', `jusqu’à ${p ? pct(p.partner.maxManagementFeeRate) : '3 %'} de chaque pot, versés sur votre compte partenaire.`],
          [ShieldCheck, 'Vous ne manipulez pas d’argent', 'les fonds des membres restent cantonnés chez un établissement agréé.'],
        ] as [LucideIcon, string, string][]).map(([I, t, d]) => <div key={t} className="row nowrap" style={{ alignItems: 'flex-start' }}><Ico icon={I} /><div><b>{t}</b><p className="muted small">{d}</p></div></div>)}
        {p && <div className="notice">Licence : <b>{fcfa(p.partner.perMemberMonthly)}</b> par membre actif et par mois, minimum {fcfa(p.partner.minimumMonthly)}. Déjà inscrit ? <Link to="/partenaire">Créez votre espace directement</Link>.</div>}
      </div>
      <div className="card stack">
        {sent ? (
          <div className="stack center"><span style={{ alignSelf: 'center' }}><Ico icon={CheckCircle2} tone="green" size="lg" round /></span><h2>Merci, demande reçue !</h2><p className="muted">Notre équipe vous rappelle sous 48 h ouvrées.</p><Link to="/" className="btn ghost">Retour à l'accueil</Link></div>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <Segmented<Kind> value={kind} onChange={setKind} options={[['partenaire', 'Partenaire'], ['sfd', 'SFD / microfinance'], ['contact', 'Contact']]} />
            <div className="form-grid">
              <Field label="Votre nom *"><Input required value={f.name} onChange={set('name')} /></Field>
              <Field label="Téléphone *"><Input required inputMode="tel" placeholder="+226 70 00 00 00" value={f.phone} onChange={set('phone')} /></Field>
              {kind !== 'contact' && <Field label={kind === 'sfd' ? 'Institution *' : 'Organisation'}><Input required={kind === 'sfd'} value={f.organization} onChange={set('organization')} /></Field>}
              {kind === 'partenaire' && (
                <Field label="Type"><Select value={f.partnerType} onChange={set('partnerType')}>{Object.entries(PARTNER_TYPES).filter(([k]) => k !== 'sfd').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              )}
              <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
              <Field label="Ville"><Input value={f.city} onChange={set('city')} /></Field>
              {kind !== 'contact' && <Field label={kind === 'sfd' ? 'Nombre de membres / clients' : 'Nombre de membres'}><Input inputMode="numeric" value={f.members} onChange={(e) => setF({ ...f, members: e.target.value.replace(/\D/g, '') })} /></Field>}
            </div>
            <Field label="Message"><Textarea value={f.message} onChange={set('message')} placeholder={kind === 'sfd' ? 'Vos groupes d’épargne, vos besoins de numérisation…' : 'Votre projet'} /></Field>
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} value={f.website} onChange={set('website')} />
            <ErrorBox error={error} />
            <Button size="block" variant="green">Envoyer ma demande</Button>
          </form>
        )}
      </div>
    </div>
  );
}
