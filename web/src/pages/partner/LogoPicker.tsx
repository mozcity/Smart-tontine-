import { useRef } from 'react';
import { PartnerLogo } from '../../components/Brand';
import { useUi } from '../../components/ui';

/** Choix du logo : l'image est recadrée au carré et réduite (256 px) avant l'envoi, pour rester sous 300 Ko. */
export function LogoPicker({ name, value, color, onChange }: { name: string; value: string | null; color: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useUi();
  async function pick(file: File) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode().catch(() => null);
    if (!img.width) { toast('Image illisible', true); return; }
    const side = Math.min(img.width, img.height);
    const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    URL.revokeObjectURL(img.src);
    let data = canvas.toDataURL('image/png');
    if (data.length > 290_000) data = canvas.toDataURL('image/jpeg', 0.85);
    onChange(data);
  }
  return (
    <div className="row">
      <PartnerLogo name={name || '?'} logo={value} color={color} size="lg" />
      <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>{value ? 'Changer le logo' : 'Ajouter un logo'}</button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
    </div>
  );
}
