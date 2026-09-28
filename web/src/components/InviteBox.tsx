import { QRCodeSVG } from 'qrcode.react';
import { useUi } from './ui';

/** Invitation : lien, QR code, WhatsApp et code à saisir dans l'app. */
export function InviteBox({ id, name, url }: { id: string; name: string; url?: string }) {
  const { toast } = useUi();
  const link = url ?? `${window.location.origin}/rejoindre/${id}`;
  const text = url ? `Découvre « ${name} » sur Smart Tontine : ${link}` : `Rejoins « ${name} » sur Smart Tontine : ${link}`;
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
      <QRCodeSVG value={link} size={132} fgColor="#211F6B" />
      <div className="stack-sm grow">
        <span className="xs">{url ? 'Lien à partager' : "Lien d'invitation"}</span>
        <code className="small" style={{ wordBreak: 'break-all' }}>{link}</code>
        <div className="row">
          <button className="btn sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Lien copié'))}>Copier le lien</button>
          <a className="btn sm green" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        {!url && <span className="xs">Code (dans l'app : Tontines → Code) : <b>{id}</b></span>}
      </div>
    </div>
  );
}
