import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { fcfa, GOOD_CATEGORIES, parseAmount } from '../../lib/format';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHead, Select, Textarea, useAction } from '../../components/ui';
import { usePartner } from './context';

interface G { id: string; name: string; description: string | null; category: string; price: number; image: string | null; stock: number | null; active: boolean; orders: number }

export default function Catalogue() {
  const { dash } = usePartner();
  const { data, reload } = useApi<G[]>(`/partners/${dash.partner.id}/goods`);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<G | null>(null);
  const act = useAction();
  const active = dash.partner.status === 'active';
  return (
    <div className="stack">
      <PageHead title="Catalogue" sub="Biens proposés en tontine de biens et en plan d’achat. Vous êtes payé à la réception (commission de 3 %).">
        <Button disabled={!active} onClick={() => setAdding(true)}>+ Ajouter un bien</Button>
      </PageHead>
      <div className="card">
        {!data?.length ? <Empty>Aucun bien au catalogue.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th /><th>Bien</th><th>Catégorie</th><th className="right">Prix</th><th>Stock</th><th>Commandes</th><th>Statut</th><th /></tr></thead>
            <tbody>{data.map((g) => (
              <tr key={g.id} style={g.active ? undefined : { opacity: .55 }}>
                <td>{g.image ? <img src={g.image} alt="" className="logo" /> : <span className="logo" style={{ background: 'var(--brand-soft)' }} />}</td>
                <td><b>{g.name}</b>{g.description && <div className="xs">{g.description}</div>}</td>
                <td>{GOOD_CATEGORIES[g.category]}</td>
                <td className="right amount">{fcfa(g.price)}</td>
                <td>{g.stock ?? '∞'}</td><td>{g.orders}</td>
                <td>{g.active ? <Badge tone="ok">En vente</Badge> : <Badge tone="muted">Retiré</Badge>}</td>
                <td className="right nowrap">
                  <button className="linkbtn small" onClick={() => setEdit(g)}>Modifier</button>{' · '}
                  <button className="linkbtn small" onClick={async () => { if (await act(() => api(`/goods/${g.id}`, { method: 'PATCH', body: { active: !g.active } }), g.active ? 'Bien retiré de la vente' : 'Bien remis en vente')) void reload(); }}>{g.active ? 'Retirer' : 'Remettre'}</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {adding && <GoodForm partnerId={dash.partner.id} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void reload(); }} />}
      {edit && <GoodForm partnerId={dash.partner.id} good={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); void reload(); }} />}
    </div>
  );
}

function GoodForm({ partnerId, good, onClose, onDone }: { partnerId: string; good?: G; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: good?.name ?? '', description: good?.description ?? '', category: good?.category ?? 'electromenager', price: good ? String(good.price) : '', stock: good?.stock != null ? String(good.stock) : '', image: good?.image ?? null as string | null });
  const [error, setError] = useState<string | null>(null);
  async function pickImage(file: File) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode().catch(() => null);
    const scale = Math.min(1, 640 / Math.max(img.width, img.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    setF({ ...f, image: canvas.toDataURL('image/jpeg', 0.8) });
  }
  return (
    <Modal title={good ? `Modifier « ${good.name} »` : 'Nouveau bien'} onClose={onClose}>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault(); setError(null);
        try {
          if (good) await api(`/goods/${good.id}`, { method: 'PATCH', body: { price: parseAmount(f.price), stock: f.stock === '' ? undefined : Number(f.stock), description: f.description || undefined } });
          else await api(`/goods/partners/${partnerId}`, { body: { name: f.name, description: f.description || undefined, category: f.category, price: parseAmount(f.price), stock: f.stock === '' ? undefined : Number(f.stock), image: f.image ?? undefined } });
          onDone();
        } catch (err) { setError((err as Error).message); }
      }}>
        {!good && <Field label="Nom du bien"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
        <div className="form-grid">
          {!good && <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(GOOD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>}
          <Field label="Prix (F)"><Input required inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Stock" hint="Vide = illimité"><Input inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {!good && <Field label="Photo"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const x = e.target.files?.[0]; if (x) void pickImage(x); }} /></Field>}
        {f.image && !good && <img src={f.image} alt="" style={{ maxHeight: 140, borderRadius: 10, objectFit: 'cover' }} />}
        <ErrorBox error={error} />
        <Button size="block">{good ? 'Enregistrer' : 'Ajouter au catalogue'}</Button>
      </form>
    </Modal>
  );
}
