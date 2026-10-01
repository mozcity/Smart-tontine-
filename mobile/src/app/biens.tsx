import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { usePin } from '@/lib/pin';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Progress, Row, Screen, Segmented, colors, notifyError, notifyOk } from '@/components/ui';
import { PartnerBrand, type Brand } from '@/components/PartnerBrand';

interface Good { id: string; name: string; description: string | null; category: string; price: number; image: string | null; stock: number | null; partner: Brand }
interface Plan { id: string; label: string; target_amount: number; balance: number; progress: number; status: string; frequency: string; installment_amount: number | null; good_name: string | null; image: string | null }
interface Order { id: string; good_name: string; image: string | null; amount: number; status: string; delivery_note: string | null; created_at: string; partner: Brand }

const CATEGORIES = [
  { value: '', label: 'Tout' }, { value: 'moto', label: 'Motos' }, { value: 'electromenager', label: 'Électroménager' },
  { value: 'telephone', label: 'Téléphones' }, { value: 'mobilier', label: 'Mobilier' }, { value: 'cuisine', label: 'Cuisine' },
  { value: 'textile', label: 'Pagnes' }, { value: 'alimentaire', label: 'Vivres' }, { value: 'materiel_pro', label: 'Matériel pro' },
];
const FREQ: Record<string, string> = { daily: 'par jour', weekly: 'par semaine', monthly: 'par mois', free: 'à ton rythme' };
const ORDER: Record<string, string> = { pending: 'Commandé', shipped: 'Expédié / prêt', delivered: 'Reçu', cancelled: 'Annulé, remboursé' };

export default function Biens() {
  const { me } = useAuth();
  const [tab, setTab] = useState<'catalogue' | 'plans' | 'commandes'>('catalogue');
  const [category, setCategory] = useState('');
  const catalog = useApi<Good[]>(`/goods${category ? `?category=${category}` : ''}`);
  const plans = useApi<Plan[]>('/goods/plans');
  const orders = useApi<Order[]>('/goods/orders');
  const [pay, setPay] = useState<Record<string, string>>({});
  const askPin = usePin();
  const [custom, setCustom] = useState({ label: '', price: '', frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' });

  async function run(path: string, body: Record<string, unknown>, ok?: string) {
    try {
      await api(path, { body });
      if (ok) notifyOk(ok);
      await Promise.all([plans.reload(), orders.reload(), catalog.reload()]);
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={() => { void catalog.reload(); void plans.reload(); void orders.reload(); }}>
      <P>Moto, frigo, téléphone, matériel : épargne seul avec un plan d'achat, ou à plusieurs avec une tontine de bien. Le fournisseur n'est payé que quand tu confirmes la réception.</P>
      <Segmented options={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'plans', label: 'Mes plans' }, { value: 'commandes', label: 'Commandes' }]} value={tab} onChange={setTab} />

      {tab === 'catalogue' && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c.value} onPress={() => setCategory(c.value)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: category === c.value ? colors.brand : colors.brandSoft }}>
                <Text style={{ color: category === c.value ? '#fff' : colors.brand, fontSize: 12, fontWeight: '600' }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          {catalog.data?.length === 0 && <Empty text="Aucun bien dans cette catégorie pour l'instant." />}
          {catalog.data?.map((g) => (
            <Card key={g.id}>
              <PartnerBrand brand={g.partner} size="sm" />
              <Row style={{ alignItems: 'flex-start' }}>
                {g.image ? <Image source={{ uri: g.image }} style={{ width: 72, height: 72, borderRadius: 10 }} /> : <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Package size={32} color={colors.gold} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink }}>{g.name}</Text>
                  <Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(g.price)}</Text>
                  {g.description ? <P muted>{g.description}</P> : null}
                  {g.stock !== null && <P muted>{g.stock > 0 ? `${g.stock} en stock` : 'Sur commande'}</P>}
                </View>
              </Row>
              <Row>
                <View style={{ flex: 1 }}><Button title="Épargner seul" variant="green" onPress={() => run('/goods/plans', { goodId: g.id, frequency: 'weekly' }, 'Plan d\'achat créé : retrouve-le dans « Mes plans »')} /></View>
                <View style={{ flex: 1 }}><Button title="En tontine" variant="ghost" onPress={() => router.push('/tontines')} /></View>
              </Row>
            </Card>
          ))}
          <P muted>« En tontine » : dans l'onglet Tontines → Créer → Tontine de bien, choisis ce bien et invite ton groupe (privé ou public).</P>
        </>
      )}

      {tab === 'plans' && (
        <>
          {plans.data?.filter((p) => p.status === 'active').length === 0 && <Empty text="Aucun plan d'achat en cours." />}
          {plans.data?.map((p) => (
            <Card key={p.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{p.label}</Text>
                <Text style={{ color: colors.ink2 }}>{p.status === 'active' ? `${p.progress} %` : p.status === 'completed' ? 'Atteint' : 'Annulé'}</Text>
              </Row>
              <Progress value={p.progress} />
              <P>{fcfa(p.balance)} / {fcfa(p.target_amount)} · {FREQ[p.frequency]}{p.installment_amount ? ` (${fcfa(p.installment_amount)})` : ''}</P>
              {p.status === 'active' && (
                <>
                  <Field label="Verser (FCFA)" value={pay[p.id] ?? ''} onChangeText={(v) => setPay({ ...pay, [p.id]: v })} keyboardType="number-pad" />
                  <Row>
                    <View style={{ flex: 1 }}><Button title="Épargner" variant="green" onPress={() => run(`/goods/plans/${p.id}/pay`, { amount: parseAmount(pay[p.id] ?? '') })} /></View>
                    <View style={{ flex: 1 }}><Button title="Annuler le plan" variant="ghost" onPress={() => run(`/goods/plans/${p.id}/cancel`, {}, 'Plan annulé : ton épargne est sur ton jeton')} /></View>
                  </Row>
                  {p.good_name ? <P muted>Objectif atteint = commande automatique au fournisseur.</P> : <P muted>Objectif atteint = l'argent revient sur ton jeton pour acheter toi-même.</P>}
                </>
              )}
            </Card>
          ))}
          <Card>
            <H2>Plan pour un autre bien</H2>
            <Field label="Bien" value={custom.label} onChangeText={(label) => setCustom({ ...custom, label })} placeholder="Machine à coudre" />
            <Field label="Prix (FCFA)" value={custom.price} onChangeText={(price) => setCustom({ ...custom, price })} keyboardType="number-pad" />
            <Segmented options={[{ value: 'daily', label: 'Chaque jour' }, { value: 'weekly', label: 'Chaque semaine' }, { value: 'monthly', label: 'Chaque mois' }]} value={custom.frequency} onChange={(frequency) => setCustom({ ...custom, frequency })} />
            <Button title="Créer le plan" disabled={custom.label.length < 2 || parseAmount(custom.price) < 1000}
              onPress={() => run('/goods/plans', { label: custom.label, targetAmount: parseAmount(custom.price), frequency: custom.frequency }, 'Plan d\'achat créé')} />
          </Card>
        </>
      )}

      {tab === 'commandes' && (
        <>
          {orders.data?.length === 0 && <Empty text="Aucune commande." />}
          {orders.data?.map((o) => (
            <Card key={o.id}>
              <PartnerBrand brand={o.partner} size="sm" />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{o.good_name}</Text>
                <Text style={{ color: colors.ink2 }}>{ORDER[o.status]}</Text>
              </Row>
              <P muted>{fcfa(o.amount)} au séquestre · commandé le {shortDate(o.created_at)}{o.delivery_note ? ` · ${o.delivery_note}` : ''}</P>
              {(o.status === 'pending' || o.status === 'shipped') && (
                <Button title="J'ai reçu mon bien" variant="green"
                  onPress={async () => { const pin = await askPin('Je confirme avoir reçu mon bien : le fournisseur sera payé.'); if (pin) await run(`/goods/orders/${o.id}/confirm`, { pin }, 'Merci ! Le fournisseur est payé.'); }} />
              )}
            </Card>
          ))}
          <P muted>Sans réclamation, une commande expédiée est confirmée automatiquement 7 jours après l'expédition.</P>
        </>
      )}
    </Screen>
  );
}
