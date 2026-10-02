import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Notice, useAction, useUi } from '../../components/ui';

/** Suppression du compte, accessible par URL (exigence Google Play) ; l'action elle-même demande d'être connecté. */
export default function SuppressionCompte() {
  const { me, signOut } = useAuth();
  const { askPin } = useUi();
  const act = useAction();
  const navigate = useNavigate();
  const [check, setCheck] = useState<{ possible: boolean; blockers: string[] } | null>(null);
  useEffect(() => { if (me) api('/me/deletion').then(setCheck).catch(() => setCheck(null)); }, [me]);

  return (
    <div className="container section stack" style={{ maxWidth: 720 }}>
      <h1>Supprimer mon compte Smart Tontine</h1>
      <div className="card stack-sm">
        <h2>Ce qui est supprimé</h2>
        <p className="muted">Votre nom, votre e-mail, votre code PIN, vos notifications et votre budget. Votre numéro est libéré.</p>
        <h2>Ce qui est conservé</h2>
        <p className="muted">L’historique de vos opérations et votre dossier d’identité, pendant 10 ans, comme l’impose la lutte contre le blanchiment (BCEAO). Ils ne sont plus rattachés à un compte actif. Voir la <Link to="/confidentialite">politique de confidentialité</Link>.</p>
        <h2>Avant de supprimer</h2>
        <p className="muted">Retirez votre argent, terminez vos tontines en cours et remboursez un crédit éventuel.</p>
      </div>

      {!me && (
        <div className="card stack-sm">
          <p>Depuis l’application : <b>Profil → Supprimer mon compte</b>. Ou connectez-vous ici :</p>
          <Button onClick={() => navigate('/connexion?next=/suppression-compte')}>Me connecter pour supprimer mon compte</Button>
          <p className="muted small">Vous n’avez plus accès à votre numéro ? Écrivez à <b>dpo@smarttontine.app</b> avec votre nom complet : nous vérifierons votre identité avant de traiter la demande.</p>
        </div>
      )}

      {me && check && !check.possible && (
        <Notice tone="warn">
          <b>Encore quelques étapes :</b>
          <ul className="stack-sm" style={{ marginTop: 8, listStyle: 'none', padding: 0 }}>
            {check.blockers.map((b) => <li key={b} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><XCircle size={16} style={{ flex: 'none', marginTop: 3 }} /><span>{b}</span></li>)}
          </ul>
        </Notice>
      )}
      {me && check?.possible && <Notice tone="ok"><span className="row nowrap"><CheckCircle2 size={16} /> Votre compte est prêt à être supprimé.</span></Notice>}
      {me && (
        <Button variant="danger" icon={Trash2} disabled={!check?.possible} onClick={async () => {
          const pin = await askPin('Supprimer définitivement mon compte');
          if (pin && await act(() => api('/me/deletion', { body: { pin } }), 'Compte supprimé')) { signOut(); navigate('/'); }
        }}>Supprimer définitivement mon compte</Button>
      )}
    </div>
  );
}
