import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { compressImage } from '../../lib/image';
import { date, fcfa } from '../../lib/format';
import { Button, ErrorBox, Field, Input, Loading, PageHead, Select, useUi } from '../../components/ui';

interface Kyc {
  level: number; limits: Record<string, { balance: number; monthlyInflow: number }>; requirements: Record<string, string[]>;
  pending: { id: string; level: number; created_at: string } | null;
  last: { level: number; status: string; reason: string | null; created_at: string; reviewed_at: string | null } | null;
}
const ID_TYPES: Record<string, string> = { cnib: 'CNIB', passeport: 'Passeport', carte_consulaire: 'Carte consulaire', permis: 'Permis de conduire', carte_electeur: "Carte d'électeur", autre: 'Autre pièce' };

/** Vérification d'identité : pièce + selfie (niveau 1), justificatif de domicile ou de revenus (niveau 2). */
export default function Identite() {
  const { me, refresh } = useAuth();
  const { data: k, reload } = useApi<Kyc>('/me/kyc');
  if (!k) return <Loading />;
  const next = (k.level + 1) as 1 | 2;
  return (
    <div className="stack">
      <PageHead title="Vérification d’identité" sub="Obligatoire pour relever vos plafonds et accéder au crédit. Vos documents sont chiffrés et ne sont vus que par l’équipe conformité." />
      <div className="kpis">
        {[0, 1, 2].map((lvl) => (
          <div key={lvl} className={`card tight kpi ${lvl === k.level ? 'hero-card' : ''}`}>
            <span className="xs">Niveau {lvl}{lvl === k.level ? ' · le vôtre' : ''}</span>
            <b>{fcfa(k.limits[lvl].balance)}</b>
            <span className="xs">solde max. · {fcfa(k.limits[lvl].monthlyInflow)} de dépôts / mois{lvl >= 1 ? ' · crédit' : ''}</span>
          </div>
        ))}
      </div>
      {k.pending ? (
        <div className="notice">⏳ Dossier de niveau {k.pending.level} envoyé le {date(k.pending.created_at)} : vérification sous 48 h ouvrées. Vous recevrez une notification.</div>
      ) : k.level >= 2 ? (
        <div className="notice ok">✅ Identité vérifiée au niveau maximal.</div>
      ) : (
        <>
          {k.last?.status === 'rejected' && <div className="notice warn">Dossier précédent refusé : <b>{k.last.reason}</b>. Corrigez puis renvoyez.</div>}
          <KycForm level={next} requirements={k.requirements[next]} defaultName={me?.full_name ?? ''} onDone={async () => { await reload(); await refresh(); }} />
        </>
      )}
      <p className="xs">Après validation : <Link to="/app/credit">voir mes offres de crédit</Link>.</p>
    </div>
  );
}

function PhotoField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string) => void; hint?: string }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="stack-sm">
        {value ? <img src={value} alt={label} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 10, background: 'var(--bg)' }} />
          : <div className="good-img" style={{ aspectRatio: '16 / 9', fontSize: 30 }} aria-hidden="true">📷</div>}
        <input type="file" accept="image/*" capture="environment" disabled={busy} aria-label={label}
          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onChange(await compressImage(f)); } catch (err) { toast((err as Error).message, true); } finally { setBusy(false); } }} />
      </div>
    </Field>
  );
}

function KycForm({ level, requirements, defaultName, onDone }: { level: 1 | 2; requirements: string[]; defaultName: string; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ idType: 'cnib', idNumber: '', fullName: defaultName, birthDate: '' });
  const [photos, setPhotos] = useState<Record<'idFront' | 'idBack' | 'selfie' | 'proofOfAddress', string | null>>({ idFront: null, idBack: null, selfie: null, proofOfAddress: null });
  const [error, setError] = useState<string | null>(null);
  const { toast } = useUi();
  const set = (k: keyof typeof photos) => (v: string) => setPhotos({ ...photos, [k]: v });
  const ready = photos.idFront && photos.selfie && (f.idType !== 'cnib' || photos.idBack) && (level === 1 || photos.proofOfAddress) && f.idNumber.length >= 4 && f.fullName.length >= 3;
  return (
    <div className="card stack">
      <div><h2>Passer au niveau {level}</h2><p className="muted small" style={{ marginTop: 4 }}>À fournir : {requirements.join(' · ')}.</p></div>
      <div className="form-grid">
        <Field label="Type de pièce"><Select value={f.idType} onChange={(e) => setF({ ...f, idType: e.target.value })}>{Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Numéro de la pièce"><Input value={f.idNumber} onChange={(e) => setF({ ...f, idNumber: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nom complet (comme sur la pièce)"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="Date de naissance"><Input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></Field>
      </div>
      <div className="grid">
        <PhotoField label="Pièce — recto" value={photos.idFront} onChange={set('idFront')} hint="Les 4 coins visibles, sans reflet." />
        <PhotoField label={f.idType === 'cnib' ? 'Pièce — verso' : 'Pièce — verso (si applicable)'} value={photos.idBack} onChange={set('idBack')} />
        <PhotoField label="Selfie en tenant la pièce" value={photos.selfie} onChange={set('selfie')} hint="Visage et pièce bien visibles." />
        {level === 2 && <PhotoField label="Justificatif de domicile ou de revenus" value={photos.proofOfAddress} onChange={set('proofOfAddress')} hint="Facture SONABEL/ONEA, bulletin de salaire… de moins de 3 mois." />}
      </div>
      <ErrorBox error={error} />
      <Button size="block" disabled={!ready} onClick={async () => {
        setError(null);
        try {
          await api('/me/kyc', { body: { level, idType: f.idType, idNumber: f.idNumber, fullName: f.fullName, birthDate: f.birthDate || undefined,
            idFront: photos.idFront, idBack: photos.idBack ?? undefined, selfie: photos.selfie, proofOfAddress: photos.proofOfAddress ?? undefined } });
          toast('Dossier envoyé ✅ Vérification sous 48 h.');
          await onDone();
        } catch (e) { setError((e as Error).message); }
      }}>Envoyer mon dossier</Button>
    </div>
  );
}
