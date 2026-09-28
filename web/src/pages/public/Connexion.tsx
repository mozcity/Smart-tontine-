import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, ErrorBox, Field, Input, Select } from '../../components/ui';

const COUNTRIES = [['+226', '🇧🇫 Burkina Faso'], ['+225', '🇨🇮 Côte d’Ivoire'], ['+223', '🇲🇱 Mali'], ['+227', '🇳🇪 Niger'], ['+221', '🇸🇳 Sénégal'], ['+229', '🇧🇯 Bénin'], ['+228', '🇹🇬 Togo']];

/** Connexion / inscription par OTP SMS, puis création du code PIN si besoin. */
export default function Connexion() {
  const [params] = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/app';
  const nav = useNavigate();
  const { signIn, refresh } = useAuth();
  const [step, setStep] = useState<'phone' | 'code' | 'pin'>('phone');
  const [country, setCountry] = useState('+226');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [referral, setReferral] = useState(params.get('parrain') ?? '');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const phone = country + local.replace(/\D/g, '');

  async function requestCode() {
    setError(null);
    try {
      const r = await api<{ devCode?: string }>('/auth/otp/request', { body: { phone } });
      setDevCode(r.devCode ?? null);
      setStep('code');
    } catch (e) { setError((e as Error).message); }
  }

  async function verify() {
    setError(null);
    try {
      const r = await api<{ token: string; isNew: boolean }>('/auth/otp/verify', {
        body: { phone, code, fullName: fullName.trim() || undefined, referralCode: referral.trim() || undefined, channel: 'web' },
      });
      await signIn(r.token);
      const me = await api<{ has_pin: boolean }>('/auth/me');
      if (!me.has_pin) setStep('pin'); else nav(next, { replace: true });
    } catch (e) { setError((e as Error).message); }
  }

  async function savePin() {
    setError(null);
    if (pin !== pin2) { setError('Les deux codes PIN sont différents'); return; }
    try { await api('/auth/me/pin', { method: 'PUT', body: { pin } }); await refresh(); nav(next, { replace: true }); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <div className="card stack">
        {step === 'phone' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void requestCode(); }}>
            <div><h1>Connexion</h1><p className="muted" style={{ marginTop: 6 }}>Recevez un code par SMS. Pas encore de compte ? Il est créé automatiquement.</p></div>
            <Field label="Numéro de téléphone">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Pays" style={{ width: 170 }}>
                  {COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l} {c}</option>)}
                </Select>
                <Input autoFocus inputMode="tel" placeholder="70 00 00 00" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Numéro" />
              </div>
            </Field>
            <ErrorBox error={error} />
            <Button size="block" disabled={local.replace(/\D/g, '').length < 8}>Recevoir le code</Button>
          </form>
        )}
        {step === 'code' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <div><h1>Code reçu par SMS</h1><p className="muted" style={{ marginTop: 6 }}>Envoyé au {phone}. <button type="button" className="linkbtn" onClick={() => setStep('phone')}>Modifier</button></p></div>
            {devCode && <div className="notice warn small">Mode démonstration : le code est <b>{devCode}</b> (jamais affiché en production).</div>}
            <Field label="Code à 6 chiffres"><Input autoFocus className="pin-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Votre nom" hint="Seulement pour un nouveau compte."><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" /></Field>
            <Field label="Code de parrainage (facultatif)"><Input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} /></Field>
            <ErrorBox error={error} />
            <Button size="block" disabled={code.length !== 6}>Valider</Button>
          </form>
        )}
        {step === 'pin' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void savePin(); }}>
            <div><h1>Créez votre code PIN</h1><p className="muted" style={{ marginTop: 6 }}>4 chiffres, demandés pour chaque sortie d'argent. Ne le communiquez à personne.</p></div>
            <Field label="Code PIN"><Input autoFocus className="pin-input" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Confirmez le code PIN"><Input className="pin-input" type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></Field>
            <ErrorBox error={error} />
            <Button size="block" disabled={pin.length !== 4 || pin2.length !== 4}>Enregistrer</Button>
          </form>
        )}
        <p className="xs center">En continuant, vous acceptez les <Link to="/legal">conditions d'utilisation</Link>.</p>
      </div>
    </div>
  );
}
