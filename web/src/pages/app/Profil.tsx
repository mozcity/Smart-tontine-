import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { date, dateTime, fcfa } from '../../lib/format';
import { Badge, Button, Empty, Field, Input, PageHead, Textarea, useAction, useUi } from '../../components/ui';

interface Ticket { id: string; subject: string; body: string; status: string; created_at: string; messages: { id: string; body: string; author_id: string; created_at: string }[] | null }

export default function Profil() {
  const { me, refresh } = useAuth();
  const pricing = useApi<any>('/public/pricing');
  const tickets = useApi<Ticket[]>('/me/support/tickets');
  const act = useAction();
  const { toast } = useUi();
  const [f, setF] = useState({ fullName: me?.full_name ?? '', email: me?.email ?? '' });
  const [pin, setPin] = useState({ current: '', next: '' });
  const [t, setT] = useState({ subject: '', body: '' });
  if (!me) return null;
  const p = pricing.data;
  const invite = `${window.location.origin}/connexion?parrain=${me.referral_code}`;

  return (
    <div className="stack">
      <PageHead title="Profil et aide" sub={`${me.phone} · vérification KYC niveau ${me.kyc_level}`} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack-sm">
          <h2>Mes informations</h2>
          <Field label="Nom complet"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Button onClick={async () => { if (await act(() => api('/auth/me', { method: 'PATCH', body: { fullName: f.fullName || undefined, email: f.email || undefined } }), 'Profil enregistré')) void refresh(); }}>Enregistrer</Button>
          <p className="xs">Vérification d’identité : niveau {me.kyc_level}. {me.kyc_level < 2 && <Link to="/app/identite">Relever mes plafonds et débloquer le crédit →</Link>}</p>
        </div>
        <div className="card stack-sm">
          <h2>Code PIN</h2>
          <p className="muted small">Demandé pour chaque sortie d’argent. Verrouillé 30 minutes après 5 erreurs.</p>
          <div className="form-grid">
            {me.has_pin && <Field label="PIN actuel"><Input type="password" inputMode="numeric" maxLength={4} value={pin.current} onChange={(e) => setPin({ ...pin, current: e.target.value.replace(/\D/g, '') })} /></Field>}
            <Field label="Nouveau PIN"><Input type="password" inputMode="numeric" maxLength={4} value={pin.next} onChange={(e) => setPin({ ...pin, next: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <Button disabled={pin.next.length !== 4} onClick={async () => { if (await act(() => api('/auth/me/pin', { method: 'PUT', body: { pin: pin.next, currentPin: pin.current || undefined } }), 'Code PIN modifié')) { setPin({ current: '', next: '' }); void refresh(); } }}>{me.has_pin ? 'Changer le PIN' : 'Créer le PIN'}</Button>
        </div>
        <div className="card stack-sm">
          <div className="row between"><h2>Smart Tontine+</h2>{me.plan === 'plus' && <Badge tone="ok">Actif</Badge>}</div>
          <p className="muted small">{p ? `${fcfa(p.plus.monthlyPrice)} / mois : ${p.plus.freeWithdrawalsPerMonth} retraits offerts par mois (y compris le pot), support prioritaire.` : ''}</p>
          {me.plan === 'plus'
            ? <Button variant="ghost" onClick={async () => { if (await act(() => api('/me/plan/cancel', { body: {} }), 'Abonnement non reconduit')) void refresh(); }}>Ne pas reconduire</Button>
            : <Button variant="green" onClick={async () => { if (await act(() => api('/me/plan/subscribe', { body: {} }), 'Bienvenue dans Smart Tontine+ ✨')) void refresh(); }}>S’abonner</Button>}
        </div>
        <div className="card stack-sm">
          <div className="row between"><h2>Organisateur Pro</h2>{me.is_pro && <Badge tone="ok">Actif jusqu’au {date(me.pro_renews_at)}</Badge>}</div>
          <p className="muted small">{p ? `${fcfa(p.pro.monthlyPrice)} / mois : plus de ${p.pro.freeOrganizerLimit} tontines ou coffres gérés à la fois, exports CSV.` : ''}</p>
          {me.is_pro
            ? <Button variant="ghost" onClick={async () => { if (await act(() => api('/me/pro/cancel', { body: {} }), 'Pro non reconduit')) void refresh(); }}>Ne pas reconduire</Button>
            : <Button onClick={async () => { if (await act(() => api('/me/pro/subscribe', { body: {} }), 'Vous êtes Organisateur Pro 🚀')) void refresh(); }}>Passer Pro</Button>}
        </div>
        <div className="card stack-sm">
          <h2>Parrainage</h2>
          <p className="muted small">Votre code : <b style={{ fontSize: 18, color: 'var(--brand)' }}>{me.referral_code}</b>{p ? ` · ${fcfa(p.referral.referrerBonus)} offerts au premier dépôt de votre filleul (dès ${fcfa(p.referral.minFirstDeposit)}).` : ''}</p>
          <div className="row"><Button size="sm" onClick={() => navigator.clipboard.writeText(invite).then(() => toast('Lien copié'))}>Copier mon lien</Button>
            <a className="btn sm green" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Rejoins-moi sur Smart Tontine, la tontine en ligne sûre : ${invite}`)}`}>WhatsApp</a></div>
        </div>
      </div>
      <div className="card stack-sm">
        <h2>Support</h2>
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <form className="stack-sm" onSubmit={async (e) => { e.preventDefault(); if (await act(() => api('/me/support/tickets', { body: t }), 'Demande envoyée, nous vous répondons vite.')) { setT({ subject: '', body: '' }); void tickets.reload(); } }}>
            <Field label="Sujet"><Input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} /></Field>
            <Field label="Votre message"><Textarea value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} /></Field>
            <Button disabled={t.subject.length < 3 || t.body.length < 3}>Envoyer</Button>
          </form>
          <div>{!tickets.data?.length ? <Empty>Aucune demande.</Empty> : tickets.data.map((x) => (
            <details key={x.id} className="list-row" style={{ display: 'block' }}>
              <summary className="row between" style={{ cursor: 'pointer' }}><b className="small">{x.subject}</b><Badge tone={x.status === 'closed' ? 'muted' : x.status === 'pending' ? 'ok' : 'warn'}>{{ open: 'Ouvert', pending: 'Répondu', closed: 'Clos' }[x.status] ?? x.status}</Badge></summary>
              <p className="small" style={{ marginTop: 8 }}>{x.body}</p>
              {x.messages?.map((m) => <p key={m.id} className="small" style={{ marginTop: 6, paddingLeft: 10, borderLeft: `3px solid ${m.author_id === me.id ? 'var(--line)' : 'var(--green)'}` }}>{m.body} <span className="xs">{dateTime(m.created_at)}</span></p>)}
            </details>
          ))}</div>
        </div>
      </div>
    </div>
  );
}
