import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fcfa, FREQ } from '../../lib/format';
import { PartnerLogo, type Brand } from '../../components/Brand';
import { Badge, Button, ErrorBox, Loading, Progress, useAction } from '../../components/ui';

interface TontinePreview { id: string; kind: 'argent' | 'bien'; good_label: string | null; good_price: number | null; partner: Brand | null; name: string; description: string | null;
  organizer: string; contribution_amount: number; frequency: string; members: number; max_members: number; guarantee_amount: number; pot: number; status: string }
interface CoffrePreview { partner: Brand | null; name: string; organizer: string; contribution_amount: number | null; frequency: string; members: number; category: string }

/** Lien d'invitation (QR code, WhatsApp) : aperçu sans compte, adhésion après connexion. */
export default function Rejoindre() {
  const { code } = useParams();
  const { me, ready } = useAuth();
  const nav = useNavigate();
  const act = useAction();
  const [t, setT] = useState<TontinePreview | null>(null);
  const [c, setC] = useState<CoffrePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try { setT(await api(`/public/tontines/${code}`)); return; } catch { /* pas une tontine */ }
      if (me) { try { setC(await api(`/cagnottes/${code}/preview`)); return; } catch { /* rien */ } }
      setError(me ? 'Invitation introuvable ou expirée.' : 'Invitation introuvable. Si c’est un coffre de groupe, connectez-vous pour le voir.');
    })();
  }, [code, me, ready]);

  const login = `/connexion?next=${encodeURIComponent(`/rejoindre/${code}`)}`;
  async function join() {
    if (!me) { nav(login); return; }
    const target = t ? 'tontines' : 'cagnottes';
    const ok = await act(() => api(`/${target}/${code}/join`, { body: {} }), 'Bienvenue dans le groupe !');
    if (ok) nav(t ? `/app/tontines/${code}` : `/app/coffres/${code}`);
  }

  if (error) return <div className="container section stack" style={{ maxWidth: 560 }}><ErrorBox error={error} />{!me && <Link className="btn" to={login}>Se connecter</Link>}</div>;
  if (!t && !c) return <Loading />;
  const g = (t ?? c)!;
  const accent = g.partner?.color ?? '#2F2C8F';
  return (
    <div className="container section" style={{ maxWidth: 560 }}>
      <div className="card stack" style={{ borderTop: `5px solid ${accent}` }}>
        {g.partner && <div className="row"><PartnerLogo name={g.partner.name} logo={g.partner.logo} color={g.partner.color} /><div><b>{g.partner.name}</b><div className="xs">Partenaire Smart Tontine</div></div></div>}
        <div className="stack-sm">
          <Badge tone={t?.kind === 'bien' ? 'warn' : 'brand'}>{t ? (t.kind === 'bien' ? 'Tontine de bien' : 'Tontine') : 'Coffre de groupe'}</Badge>
          <h1>{g.name}</h1>
          <p className="muted">Organisée par {g.organizer}</p>
          {t?.description && <p>{t.description}</p>}
        </div>
        {t && (
          <>
            {t.kind === 'bien' && <div className="notice">Chaque membre reçoit à son tour : <b>{t.good_label}</b> ({fcfa(t.good_price)}), payé au fournisseur à la réception.</div>}
            <div className="kpis">
              <div className="kpi"><span className="xs">Cotisation</span><b>{fcfa(t.contribution_amount)}</b><span className="xs">par {FREQ[t.frequency]}</span></div>
              <div className="kpi"><span className="xs">Pot</span><b>{fcfa(t.pot)}</b><span className="xs">à votre tour</span></div>
              <div className="kpi"><span className="xs">Caution</span><b>{fcfa(t.guarantee_amount)}</b><span className="xs">rendue en fin de cycle</span></div>
            </div>
            <Progress value={(100 * t.members) / t.max_members} />
            <p className="xs">{t.members}/{t.max_members} membres</p>
            {t.status !== 'recruiting' && <div className="notice warn">Cette tontine a déjà démarré : les adhésions sont fermées.</div>}
          </>
        )}
        {c && <p>{c.members} membres{c.contribution_amount ? ` · cotisation ${fcfa(c.contribution_amount)} / ${FREQ[c.frequency]}` : ''}</p>}
        {(!t || t.status === 'recruiting') && (
          <Button size="block" style={{ background: accent }} onClick={join}>{me ? (t ? `Rejoindre et verser la caution (${fcfa(t.guarantee_amount)})` : 'Rejoindre le coffre') : 'Se connecter pour rejoindre'}</Button>
        )}
        {me && t && <p className="xs center">La caution est prélevée sur votre jeton. Solde insuffisant ? <Link to="/app/portefeuille">Déposer</Link></p>}
      </div>
    </div>
  );
}
