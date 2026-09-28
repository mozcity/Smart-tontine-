import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, parseAmount, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H2, P, Row, Screen, Segmented, colors, notifyError, notifyOk } from '@/components/ui';
import { ImageField } from '@/components/ImageField';
import { PartnerBrand } from '@/components/PartnerBrand';
import { CreateTontineForm } from '@/components/CreateTontineForm';

interface Dashboard {
  partner: { id: string; name: string; type: string; logo: string | null; primary_color: string; status: string; management_fee_rate: string };
  role: 'owner' | 'manager'; balance: number; activeMembers: number; estimatedInvoice: number; collectedThisMonth: number; managementFeesEarned: number;
  tontines: { id: string; name: string; kind: string; visibility: string; status: string; contribution_amount: number; members: number; max_members: number; defaulters: number; good_label: string | null;
    current_round: { number: number; due_date: string; paid: number } | null }[];
  coffres: { id: string; name: string; category: string; status: string; balance: number; members: number }[];
  orders: { id: string; good_name: string; beneficiary: string; phone: string; amount: number; status: string; created_at: string }[];
  invoices: { id: string; month: string; active_members: number; amount: number; status: string }[];
  staff: { id: string; full_name: string | null; phone: string; role: string }[];
}

const TABS = [
  { value: 'groupes', label: 'Groupes' }, { value: 'biens', label: 'Biens' }, { value: 'equipe', label: 'Équipe' }, { value: 'compte', label: 'Compte' },
] as const;
const CATEGORIES = ['moto', 'electromenager', 'telephone', 'mobilier', 'cuisine', 'textile', 'alimentaire', 'materiel_pro', 'autre'];
const ORDER: Record<string, string> = { pending: 'À préparer', shipped: 'Expédié', delivered: 'Reçu ✅', cancelled: 'Annulé' };

export default function PartnerDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { data, reload } = useApi<Dashboard>(`/partners/${id}/dashboard`);
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('groupes');
  const [creating, setCreating] = useState<'tontine' | 'coffre' | null>(null);
  const [coffre, setCoffre] = useState({ name: '', amount: '' });
  const [good, setGood] = useState({ name: '', price: '', category: 'moto', stock: '' });
  const [goodImage, setGoodImage] = useState<string | null>(null);
  const [staffPhone, setStaffPhone] = useState('+226');
  const [money, setMoney] = useState({ topup: '', withdraw: '', pin: '' });
  const [logo, setLogo] = useState<string | null>(null);

  async function run(path: string, body: Record<string, unknown>, ok?: string, method?: string) {
    try { await api(path, { body, method }); if (ok) notifyOk(ok); await reload(); } catch (e) { notifyError(e); }
  }

  if (!data) return <Screen><P>Chargement…</P></Screen>;
  const p = data.partner;
  const brand = { id: p.id, name: p.name, logo: p.logo, color: p.primary_color };
  const active = p.status === 'active';
  const owner = data.role === 'owner';

  return (
    <Screen onRefresh={reload}>
      <PartnerBrand brand={brand} />
      {!active && (
        <Card style={{ backgroundColor: '#FFF4E0' }}>
          <P>{p.status === 'pending' ? '⏳ Espace en cours de validation par Smart Tontine (vérification de ta structure). Tu pourras ensuite créer tes groupes et ton catalogue.' : '⛔ Espace suspendu : contacte le support.'}</P>
        </Card>
      )}
      <Row>
        <Card style={{ flex: 1 }}><P muted>Membres actifs</P><Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink }}>{data.activeMembers}</Text></Card>
        <Card style={{ flex: 1 }}><P muted>Collecté ce mois</P><Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{fcfa(data.collectedThisMonth)}</Text></Card>
      </Row>
      <Row>
        <Card style={{ flex: 1 }}><P muted>Compte partenaire</P><Text style={{ fontWeight: '800', fontSize: 16, color: colors.green }}>{fcfa(data.balance)}</Text></Card>
        <Card style={{ flex: 1 }}><P muted>Frais de gestion perçus</P><Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{fcfa(data.managementFeesEarned)}</Text></Card>
      </Row>
      <Segmented options={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'groupes' && (
        <>
          <Row>
            <View style={{ flex: 1 }}><Button title="+ Tontine" variant="green" disabled={!active} onPress={() => setCreating(creating === 'tontine' ? null : 'tontine')} /></View>
            <View style={{ flex: 1 }}><Button title="+ Coffre de groupe" variant="ghost" disabled={!active} onPress={() => setCreating(creating === 'coffre' ? null : 'coffre')} /></View>
          </Row>
          {creating === 'tontine' && (
            <CreateTontineForm partnerId={p.id} onCreated={(tid) => { setCreating(null); void reload(); router.push({ pathname: '/tontine/[id]', params: { id: tid } }); }} />
          )}
          {creating === 'coffre' && (
            <Card>
              <H2>Nouveau coffre de groupe</H2>
              <Field label="Nom" value={coffre.name} onChangeText={(name) => setCoffre({ ...coffre, name })} placeholder="Caisse de solidarité" />
              <Field label="Cotisation mensuelle attendue (facultatif)" value={coffre.amount} onChangeText={(amount) => setCoffre({ ...coffre, amount })} keyboardType="number-pad" />
              <Button title="Créer le coffre" disabled={coffre.name.length < 2} onPress={async () => {
                await run('/cagnottes', { name: coffre.name, category: p.type === 'association' ? 'association' : 'autre', partnerId: p.id,
                  frequency: 'monthly', contributionAmount: parseAmount(coffre.amount) || undefined, visibility: 'private' }, 'Coffre créé');
                setCreating(null); setCoffre({ name: '', amount: '' });
              }} />
            </Card>
          )}
          <H2>Tontines ({data.tontines.length})</H2>
          {data.tontines.length === 0 && <Empty text="Aucune tontine pour l'instant." />}
          {data.tontines.map((t) => (
            <Pressable key={t.id} onPress={() => router.push({ pathname: '/tontine/[id]', params: { id: t.id } })}>
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{t.kind === 'bien' ? '🛵' : '🔄'} {t.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.ink2 }}>{t.visibility === 'public' ? '🌍' : '🔒'} {t.status === 'recruiting' ? 'Recrutement' : t.status === 'active' ? 'En cours' : 'Terminée'}</Text>
                </Row>
                <P muted>{t.members}/{t.max_members} membres · {fcfa(t.contribution_amount)} par tour{t.good_label ? ` · ${t.good_label}` : ''}{t.defaulters ? ` · ⚠️ ${t.defaulters} impayé(s)` : ''}</P>
                {t.current_round && <P muted>Tour {t.current_round.number} · {t.current_round.paid}/{t.members} cotisations · échéance {shortDate(t.current_round.due_date)}</P>}
              </Card>
            </Pressable>
          ))}
          <H2>Coffres de groupe ({data.coffres.length})</H2>
          {data.coffres.map((c) => (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/cagnotte/[id]', params: { id: c.id } })}>
              <Card><Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', color: colors.ink }}>🐷 {c.name}</Text><Text style={{ fontWeight: '800', color: colors.brand }}>{fcfa(c.balance)}</Text></Row>
                <P muted>{c.members} membre(s)</P></Card>
            </Pressable>
          ))}
        </>
      )}

      {tab === 'biens' && (
        <>
          <H2>Commandes à livrer</H2>
          {data.orders.length === 0 && <Empty text="Aucune commande." />}
          {data.orders.map((o) => (
            <Card key={o.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{o.good_name}</Text>
                <Text style={{ color: colors.ink2 }}>{ORDER[o.status]}</Text>
              </Row>
              <P muted>{o.beneficiary ?? o.phone} · {o.phone} · {fcfa(o.amount)} au séquestre · {shortDate(o.created_at)}</P>
              {o.status === 'pending' && (
                <Row>
                  <View style={{ flex: 1 }}><Button title="Marquer expédié / prêt" variant="green" onPress={() => run(`/goods/orders/${o.id}/ship`, {}, 'Client prévenu')} /></View>
                  <View style={{ flex: 1 }}><Button title="Annuler (rupture)" variant="ghost" onPress={() => run(`/goods/orders/${o.id}/cancel`, { reason: 'Rupture de stock' }, 'Client remboursé')} /></View>
                </Row>
              )}
            </Card>
          ))}
          <Card>
            <H2>Ajouter un bien au catalogue</H2>
            <P muted>Tes biens apparaissent dans le catalogue Smart Tontine et peuvent être financés en tontine ou en plan d'achat. Commission Smart Tontine : 3 % par vente, payée à la réception.</P>
            <Field label="Nom du bien" value={good.name} onChangeText={(name) => setGood({ ...good, name })} placeholder="Moto Sanili 125" />
            <Field label="Prix (FCFA)" value={good.price} onChangeText={(price) => setGood({ ...good, price })} keyboardType="number-pad" />
            <Field label="Stock (facultatif)" value={good.stock} onChangeText={(stock) => setGood({ ...good, stock })} keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setGood({ ...good, category: c })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: good.category === c ? colors.brand : colors.brandSoft }}>
                  <Text style={{ color: good.category === c ? '#fff' : colors.brand, fontSize: 12 }}>{c.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </View>
            <ImageField label="Photo" value={goodImage} onChange={setGoodImage} aspect={[4, 3]} />
            <Button title="Publier le bien" disabled={!active || good.name.length < 2 || parseAmount(good.price) < 1000} onPress={async () => {
              await run(`/goods/partners/${p.id}`, { name: good.name, price: parseAmount(good.price), category: good.category,
                stock: good.stock ? parseAmount(good.stock) : undefined, image: goodImage ?? undefined }, 'Bien publié');
              setGood({ name: '', price: '', category: 'moto', stock: '' }); setGoodImage(null);
            }} />
          </Card>
        </>
      )}

      {tab === 'equipe' && (
        <>
          <Card>
            {data.staff.map((s) => (
              <Row key={s.id} style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.ink }}>{s.full_name ?? s.phone}{s.id === me?.id ? ' (toi)' : ''}</Text>
                <Text style={{ color: colors.ink2 }}>{s.role === 'owner' ? 'Propriétaire' : 'Gestionnaire'}</Text>
              </Row>
            ))}
          </Card>
          {owner && (
            <Card>
              <H2>Ajouter un gestionnaire</H2>
              <P muted>Il pourra créer et gérer les groupes, démarrer les tontines et livrer les commandes.</P>
              <Field label="Numéro Smart Tontine" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" />
              <Button title="Ajouter" onPress={() => run(`/partners/${p.id}/staff`, { phone: staffPhone.replace(/\s/g, '') }, 'Gestionnaire ajouté')} />
            </Card>
          )}
          {owner && (
            <Card>
              <H2>Marque</H2>
              <ImageField label="Nouveau logo" value={logo} onChange={setLogo} />
              <Button title="Mettre à jour le logo" variant="ghost" disabled={!logo} onPress={() => run(`/partners/${p.id}`, { logo }, 'Logo mis à jour', 'PATCH')} />
              <P muted>Tes frais de gestion actuels : {(Number(p.management_fee_rate) * 100).toFixed(1).replace('.', ',')} % de chaque pot.</P>
            </Card>
          )}
        </>
      )}

      {tab === 'compte' && (
        <>
          <Card>
            <H2>Licence Smart Tontine</H2>
            <P>Estimation du mois : {fcfa(data.estimatedInvoice)} ({data.activeMembers} membres actifs × 75 F, minimum 10 000 F).</P>
            {data.invoices.map((i) => (
              <Row key={i.id} style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.ink }}>{i.month} · {i.active_members} membres</Text>
                <Text style={{ color: i.status === 'paid' ? colors.green : colors.danger }}>{fcfa(i.amount)} {i.status === 'paid' ? '✔' : 'à régler'}</Text>
              </Row>
            ))}
          </Card>
          {owner && (
            <Card>
              <H2>Alimenter / retirer</H2>
              <Field label="Alimenter depuis mon jeton (FCFA)" value={money.topup} onChangeText={(topup) => setMoney({ ...money, topup })} keyboardType="number-pad" />
              <Button title="Alimenter le compte partenaire" variant="ghost" disabled={parseAmount(money.topup) < 100}
                onPress={() => run(`/partners/${p.id}/topup`, { amount: parseAmount(money.topup) }, 'Compte alimenté (factures dues réglées)')} />
              <Field label="Retirer vers Orange Money (FCFA)" value={money.withdraw} onChangeText={(withdraw) => setMoney({ ...money, withdraw })} keyboardType="number-pad" />
              <Field label="Code PIN" value={money.pin} onChangeText={(pin) => setMoney({ ...money, pin })} keyboardType="number-pad" secureTextEntry maxLength={4} />
              <Button title="Retirer (frais 1 %)" disabled={parseAmount(money.withdraw) < 100 || money.pin.length !== 4}
                onPress={() => run(`/partners/${p.id}/withdraw`, { amount: parseAmount(money.withdraw), channel: 'orange_money', pin: money.pin }, 'Retrait envoyé')} />
            </Card>
          )}
          {owner && <Statement partnerId={p.id} />}
        </>
      )}
    </Screen>
  );
}

interface Entry { id: string; created_at: string; type: string; description: string; amount: number; balance_after: number }

/** Relevé du compte partenaire : les 20 dernières écritures (l'export CSV complet est sur le portail web). */
function Statement({ partnerId }: { partnerId: string }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  useEffect(() => { api<Entry[]>(`/partners/${partnerId}/statement`).then(setRows).catch(() => setRows([])); }, [partnerId]);
  return (
    <Card>
      <H2>Relevé du compte</H2>
      {!rows ? <P muted>Chargement…</P> : rows.length === 0 ? <Empty text="Aucune opération." /> : rows.slice(0, 20).map((e) => (
        <Row key={e.id} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '600' }}>{e.description}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{shortDate(e.created_at)} · solde {fcfa(e.balance_after)}</Text>
          </View>
          <Text style={{ color: e.amount > 0 ? colors.green : colors.danger, fontWeight: '700' }}>{e.amount > 0 ? '+' : ''}{fcfa(e.amount)}</Text>
        </Row>
      ))}
      <P muted>Export CSV et filtres par période : portail partenaire web.</P>
    </Card>
  );
}
