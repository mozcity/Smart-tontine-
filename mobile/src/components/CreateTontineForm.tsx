import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fcfa, parseAmount } from '@/lib/format';
import { Button, Card, Field, H2, P, Segmented, colors, notifyError } from '@/components/ui';

export interface Good { id: string; name: string; price: number; image: string | null; category: string; partner: { name: string } }

/**
 * Création d'une tontine : d'argent ou de bien (catalogue ou bien libre), privée ou publique,
 * personnelle ou organisée au nom d'un partenaire (`partnerId`).
 */
export function CreateTontineForm({ partnerId, onCreated }: { partnerId?: string; onCreated: (id: string) => void }) {
  const catalog = useApi<Good[]>('/goods');
  const [kind, setKind] = useState<'argent' | 'bien'>('argent');
  const [goodMode, setGoodMode] = useState<'catalogue' | 'libre'>('catalogue');
  const [good, setGood] = useState<Good | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', members: '5', frequency: 'monthly' as 'weekly' | 'monthly',
    order: 'random' as 'random' | 'fixed', visibility: 'private' as 'private' | 'public', goodLabel: '', goodPrice: '' });
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const members = Number(form.members) || 0;

  // Estimation affichée : le serveur calcule la cotisation exacte (pot net ≥ prix du bien).
  const price = kind === 'bien' ? (goodMode === 'catalogue' ? good?.price ?? 0 : parseAmount(form.goodPrice)) : 0;
  const estimate = price && members ? Math.ceil(price / (members * 0.99) / 25) * 25 : 0;

  async function create() {
    try {
      const body: Record<string, unknown> = {
        name: form.name || (good?.name ?? form.goodLabel), frequency: form.frequency, maxMembers: members,
        orderMode: form.order, visibility: form.visibility, kind, partnerId,
      };
      if (kind === 'argent') body.contributionAmount = parseAmount(form.amount);
      else if (goodMode === 'catalogue') body.goodId = good?.id;
      else { body.goodLabel = form.goodLabel; body.goodPrice = parseAmount(form.goodPrice); }
      const t = await api<{ id: string }>('/tontines', { body });
      onCreated(t.id);
    } catch (e) { notifyError(e); }
  }

  const ready = members >= 2 && (kind === 'argent'
    ? form.name.length >= 2 && parseAmount(form.amount) >= 500
    : goodMode === 'catalogue' ? !!good : form.goodLabel.length >= 2 && parseAmount(form.goodPrice) >= 1000);

  return (
    <Card>
      <H2>{partnerId ? 'Nouvelle tontine du partenaire' : 'Créer une tontine'}</H2>
      <Segmented options={[{ value: 'argent', label: '💰 Tontine d\'argent' }, { value: 'bien', label: '🛵 Tontine de bien' }]} value={kind} onChange={setKind} />
      {kind === 'bien' && (
        <>
          <P>Chaque membre reçoit le bien à son tour. Avec un bien du catalogue, le paiement passe par un séquestre et le fournisseur n'est payé qu'à la réception.</P>
          <Segmented options={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'libre', label: 'Autre bien' }]} value={goodMode} onChange={setGoodMode} />
          {goodMode === 'catalogue' ? (
            <View style={{ gap: 8 }}>
              {catalog.data?.length === 0 && <P muted>Le catalogue est vide pour l'instant.</P>}
              {catalog.data?.map((g) => (
                <Pressable key={g.id} onPress={() => setGood(g)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, borderWidth: 2, borderColor: good?.id === g.id ? colors.green : colors.line }}>
                  {g.image ? <Image source={{ uri: g.image }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <Text style={{ fontSize: 28 }}>📦</Text>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{g.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.ink2 }}>{g.partner.name}</Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(g.price)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Field label="Bien" value={form.goodLabel} onChangeText={(goodLabel) => set({ goodLabel })} placeholder="Moulin à grains, pagnes, moto…" />
              <Field label="Prix du bien (FCFA)" value={form.goodPrice} onChangeText={(goodPrice) => set({ goodPrice })} keyboardType="number-pad" />
            </>
          )}
        </>
      )}
      <Field label="Nom de la tontine" value={form.name} onChangeText={(name) => set({ name })} placeholder={kind === 'bien' ? 'Tontine moto des collègues' : 'Tontine du marché'} />
      {kind === 'argent' && <Field label="Cotisation par tour (FCFA)" value={form.amount} onChangeText={(amount) => set({ amount })} keyboardType="number-pad" placeholder="10 000" />}
      <Field label="Nombre de membres" value={form.members} onChangeText={(m) => set({ members: m })} keyboardType="number-pad" />
      <Segmented options={[{ value: 'weekly', label: 'Hebdomadaire' }, { value: 'monthly', label: 'Mensuelle' }]} value={form.frequency} onChange={(frequency) => set({ frequency })} />
      <Segmented options={[{ value: 'random', label: 'Ordre tiré au sort' }, { value: 'fixed', label: 'Ordre fixé' }]} value={form.order} onChange={(order) => set({ order })} />
      <Segmented options={[{ value: 'private', label: '🔒 Privée (sur invitation)' }, { value: 'public', label: '🌍 Publique' }]} value={form.visibility} onChange={(visibility) => set({ visibility })} />
      {kind === 'argent' && parseAmount(form.amount) > 0 && <P>Pot à chaque tour : {fcfa(parseAmount(form.amount) * members)} (commission Smart Tontine 1 %)</P>}
      {kind === 'bien' && estimate > 0 && <P>Cotisation ≈ {fcfa(estimate)} par membre et par tour · {members} membres = {members} biens</P>}
      <Button title="Créer la tontine" variant="green" onPress={create} disabled={!ready} />
    </Card>
  );
}
