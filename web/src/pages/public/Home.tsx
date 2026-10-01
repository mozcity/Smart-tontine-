import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, Banknote, Bell, Building2, Check, HandCoins, Lock, NotebookPen, Plus, ShieldCheck, ShoppingBag, Smartphone, Sparkles, TrendingUp, Users, X, type LucideIcon } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import { fcfa, num, pct } from '../../lib/format';
import { TontineCard, type PublicTontine } from '../../components/Cards';
import { PartnerLogo } from '../../components/Brand';
import { Badge, Ico, Ring, type IcoTone } from '../../components/ui';

interface Stats { members: number; active_tontines: number; pots_paid: number; pots_amount: number; partners: number }

const FEATURES: [LucideIcon, IcoTone, string, string][] = [
  [ShieldCheck, 'green', 'Caution anti-impayé', 'Tour échu + 3 jours : la caution du retardataire est utilisée et le bénéficiaire est payé. Le groupe ne perd jamais.'],
  [ShoppingBag, 'gold', 'Tontines de biens', 'Moto, réfrigérateur, téléphone : cotisez pour un bien du catalogue, payé au commerçant seulement à la réception.'],
  [HandCoins, 'blue', 'Avance sur tontine', 'Besoin d’argent avant votre tour ? Recevez jusqu’à 50 % de votre futur pot, remboursés automatiquement.'],
  [TrendingUp, 'brand', 'Score et microcrédit', 'Chaque cotisation à l’heure fait monter votre score et ouvre le crédit de nos SFD partenaires agréés.'],
  [Users, 'green', 'Coffres de groupe', 'Associations, dahiras, GIE, familles : caisse commune, suivi payé / impayé, retraits à double validation.'],
  [Building2, 'brand', 'Espaces partenaires', 'Associations, commerçants, entreprises et SFD organisent leurs tontines à leur nom et à leur logo.'],
];

const FAQ: [string, string][] = [
  ['Où est mon argent ?', 'Les fonds des membres sont cantonnés auprès d’un établissement agréé par la BCEAO. Ni Smart Tontine ni l’organisateur ne peuvent s’en servir : chaque franc est tracé dans un grand livre vérifié chaque jour.'],
  ['Que se passe-t-il si un membre ne paie pas ?', 'Des rappels partent la veille et le jour de l’échéance. Trois jours après, sa caution est utilisée automatiquement : le bénéficiaire reçoit son pot en entier et le retardataire perd des points de score.'],
  ['Combien ça coûte ?', 'Inscription, dépôt, cotisation et rappels sont gratuits. Smart Tontine prélève 1 % du pot quand il est versé, et 1 % sur les retraits vers Mobile Money.'],
  ['Comment est choisi l’ordre de passage ?', 'Par tirage au sort au démarrage (aléa cryptographique, impossible à truquer), ou dans un ordre fixé par l’organisateur si le groupe le préfère.'],
  ['Je n’ai pas de smartphone, puis-je participer ?', 'Oui : l’application web fonctionne sur tout téléphone avec navigateur. Un accès par code USSD est prévu pour les téléphones simples.'],
];

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
            <span className="pill"><b>Nouveau</b> Tontines de biens : motos, frigos, téléphones</span>
            <h1 style={{ marginTop: 20 }}>La tontine en ligne, <em>sûre</em> et sans espèces.</h1>
            <p className="lead">Cotisez par Orange Money, Moov Money ou Wave et recevez votre pot à votre tour. Une caution protège le groupe, et votre régularité vous ouvre le crédit.</p>
            <div className="row">
              <Link to="/connexion" className="btn green lg">Créer ma tontine <ArrowRight size={18} /></Link>
              <Link to="/decouvrir" className="btn lg" style={{ background: 'rgba(255,255,255,.12)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}>Rejoindre une tontine</Link>
            </div>
            <div className="trust">
              <span><ShieldCheck size={17} /> Fonds cantonnés BCEAO</span>
              <span><Lock size={17} /> Code PIN et chiffrement</span>
              <span><BadgeCheck size={17} /> Gratuit pour cotiser</span>
            </div>
          </div>
          <div className="phone-mock" aria-hidden="true">
            <div className="screen">
              <div className="row between"><b style={{ fontSize: 14 }}>Bonjour Awa</b><Bell size={18} color="var(--muted)" /></div>
              <div className="card hero-card tight" style={{ padding: 16 }}>
                <span className="xs">Mon jeton</span>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em' }}>148 500 F</div>
                <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  <span className="btn white sm" style={{ position: 'relative', zIndex: 1 }}><Plus size={14} />Déposer</span>
                  <span className="btn sm" style={{ background: 'rgba(255,255,255,.16)', position: 'relative', zIndex: 1 }}>Envoyer</span>
                </div>
              </div>
              <div className="card tight row nowrap" style={{ padding: 12 }}>
                <Ring value={30} size={46} stroke={5} label="3/10" />
                <div className="grow"><b className="small">Tontine du marché</b><div className="xs">Pot de 100 000 F · le 15/10</div></div>
                <Badge tone="ok" plain>Payé</Badge>
              </div>
              <div className="card tight row nowrap" style={{ padding: 12 }}>
                <span className="ico gold sm"><ShoppingBag size={16} /></span>
                <div className="grow"><b className="small">Moto Sanili 125</b><div className="xs">Tontine de bien · tour 2/10</div></div>
                <Badge tone="warn" plain>Demain</Badge>
              </div>
              <div className="notice ok small" style={{ padding: '10px 12px' }}><ShieldCheck size={16} /> Caution active : un impayé est couvert.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="stat-band">
          {([[stats.data?.members, 'membres'], [stats.data?.active_tontines, 'tontines actives'], [stats.data?.pots_paid, 'pots versés'], [stats.data?.partners, 'partenaires']] as [number | undefined, string][]).map(([v, l]) => (
            <div key={l} className="card"><b>{num(v)}</b><span className="muted small">{l}</span></div>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Comment ça marche</span><h2>Votre tontine en 4 étapes</h2><p>Les règles que vous connaissez déjà, sans cahier, sans espèces, sans trésorier qui garde la caisse.</p></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            {([[Users, 'Créez ou rejoignez', 'Cotisation, fréquence, nombre de membres. Invitez par lien, QR code ou WhatsApp.'],
              [ShieldCheck, 'Versez la caution', 'Une cotisation bloquée à l’adhésion : elle couvre un impayé et vous est rendue à la fin.'],
              [Smartphone, 'Cotisez en un clic', 'Orange Money, Moov Money ou Wave. Rappels automatiques la veille et le jour J.'],
              [Banknote, 'Recevez votre pot', 'Versé automatiquement dès la dernière cotisation du tour, sur votre jeton.']] as [LucideIcon, string, string][]).map(([I, t, d], i) => (
              <div key={t} className="feature">
                <div className="row between"><Ico icon={I} /><span className="step-num" style={{ width: 30, height: 30, fontSize: 13 }}>{i + 1}</span></div>
                <h3>{t}</h3><p className="muted small">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container grid-2" style={{ alignItems: 'center', gap: 48 }}>
          <div className="stack">
            <span className="eyebrow">Pourquoi Smart Tontine</span>
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, letterSpacing: '-.03em' }}>Fini le cahier, les relances et les soupçons</h2>
            <p className="muted" style={{ fontSize: 17 }}>Tout le monde voit qui a payé, l’argent ne passe jamais par la poche du trésorier, et un impayé ne pénalise plus le bénéficiaire.</p>
            <Link to="/connexion" className="btn lg" style={{ alignSelf: 'flex-start' }}>Essayer gratuitement <ArrowRight size={18} /></Link>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead><tr><th style={{ padding: '14px 18px' }} /><th><span className="row" style={{ gap: 6 }}><NotebookPen size={15} />Cahier</span></th><th style={{ color: 'var(--brand-ink)' }}><span className="row" style={{ gap: 6 }}><Sparkles size={15} />Smart Tontine</span></th></tr></thead>
              <tbody>
                {['Caisse sécurisée', 'Suivi en temps réel', 'Impayé couvert', 'Rappels automatiques', 'Ouvre le crédit'].map((r) => (
                  <tr key={r}><td style={{ padding: '13px 18px', fontWeight: 600 }}>{r}</td><td><X size={18} color="var(--danger)" /></td><td><Check size={18} color="var(--green-500)" strokeWidth={3} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Tout pour épargner ensemble</span><h2>Plus qu’une tontine</h2></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {FEATURES.map(([I, tone, t, d]) => <div key={t} className="feature"><Ico icon={I} tone={tone} /><h3>{t}</h3><p className="muted small">{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container stack">
          <div className="row between"><div><span className="eyebrow">Découvrir</span><h2 style={{ fontSize: 28, fontWeight: 800 }}>Tontines publiques ouvertes</h2></div><Link to="/decouvrir" className="btn ghost">Tout voir <ArrowRight size={16} /></Link></div>
          {tontines.data && tontines.data.length > 0
            ? <div className="grid">{tontines.data.slice(0, 6).map((t) => <TontineCard key={t.id} t={t} />)}</div>
            : <p className="muted">Aucune tontine publique ouverte pour le moment. <Link to="/connexion">Créez la vôtre</Link>.</p>}
          {partners.data && partners.data.length > 0 && (
            <div className="row" style={{ marginTop: 18, gap: 14 }}>
              <span className="xs" style={{ fontWeight: 650 }}>ILS ORGANISENT SUR SMART TONTINE</span>
              {partners.data.map((x) => (
                <Link key={x.id} to={`/partenaires/${x.id}`} className="row nowrap card tight card-link" style={{ gap: 10, padding: '8px 14px' }}>
                  <PartnerLogo name={x.name} logo={x.logo} color={x.primary_color} size="sm" /><b className="small">{x.name}</b>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Tarifs transparents</span><h2>Gratuit pour cotiser</h2><p>Vous ne payez que quand vous recevez de l’argent.</p></div>
          {p && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {([['Pot de tontine reçu', pct(p.tontine.commissionRate), 'du pot, au bénéficiaire du tour'],
                ['Retrait Mobile Money', pct(p.withdrawal.rate), `min. ${fcfa(p.withdrawal.min)}, max. ${fcfa(p.withdrawal.max)}`],
                ['Smart Tontine+', fcfa(p.plus.monthlyPrice), 'par mois : retraits offerts, support prioritaire'],
                ['Organisateur Pro', fcfa(p.pro.monthlyPrice), 'par mois : groupes illimités, exports']] as [string, string, string][]).map(([t, v, d]) => (
                <div key={t} className="feature center" style={{ alignItems: 'center' }}><span className="muted small" style={{ fontWeight: 600 }}>{t}</span><span className="price">{v}</span><span className="xs">{d}</span></div>
              ))}
            </div>
          )}
          <p className="center" style={{ marginTop: 22 }}><Link to="/tarifs">Voir la grille complète <ArrowRight size={14} style={{ verticalAlign: -2 }} /></Link></p>
        </div>
      </section>

      <section className="section alt">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="section-title"><span className="eyebrow">Questions fréquentes</span><h2>Vous vous demandez…</h2></div>
          <div className="faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}<Plus size={20} /></summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="container" style={{ marginTop: 80 }}>
        <div className="cta-band row between">
          <div className="stack-sm" style={{ maxWidth: 620 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>Association, commerçant, entreprise ou SFD ?</h2>
            <p style={{ opacity: .9 }}>Organisez vos tontines et vos caisses à votre logo, suivez les cotisations en temps réel, vendez vos biens en tontine. Licence dès {p ? fcfa(p.partner.perMemberMonthly) : '75 F'} par membre actif et par mois.</p>
          </div>
          <Link to="/devenir-partenaire" className="btn white lg">Devenir partenaire <ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
