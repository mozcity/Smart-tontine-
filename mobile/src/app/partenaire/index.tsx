import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Button, Card, Empty, Field, H2, P, Screen, colors, notifyError } from '@/components/ui';
import { ImageField } from '@/components/ImageField';
import { PartnerBrand } from '@/components/PartnerBrand';

interface Mine { id: string; name: string; type: string; logo: string | null; primary_color: string; status: string; role: string }

const TYPES = [
  { value: 'association', label: '🤝 Association / GIE' }, { value: 'commercant', label: '🏪 Commerçant (vend des biens)' },
  { value: 'entreprise', label: 'Entreprise (salariés)' }, { value: 'tontinier', label: 'Tontinier professionnel' },
  { value: 'sfd', label: '🏦 SFD / microfinance' }, { value: 'autre', label: 'Autre' },
];
const COLORS = ['#2F2C8F', '#1F6F43', '#C0392B', '#D35400', '#8E44AD', '#16A085', '#2C3E50', '#B7950B'];
const STATUS: Record<string, string> = { pending: 'En attente de validation', active: 'Actif', suspended: 'Suspendu' };

export default function PartnerHome() {
  const mine = useApi<Mine[]>('/partners/mine');
  const [form, setForm] = useState({ name: '', type: 'association', description: '', city: 'Ouagadougou', phone: '', fee: '0', color: COLORS[0] });
  const [logo, setLogo] = useState<string | null>(null);

  async function create() {
    try {
      const p = await api<{ id: string }>('/partners', { body: {
        name: form.name, type: form.type, description: form.description || undefined, city: form.city || undefined,
        phone: form.phone || undefined, primaryColor: form.color, logo: logo ?? undefined,
        managementFeeRate: Math.min(3, Math.max(0, Number(form.fee.replace(',', '.')) || 0)) / 100,
      } });
      router.push({ pathname: '/partenaire/[id]', params: { id: p.id } });
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={mine.reload}>
      <P>Association, commerçant, entreprise, tontinier ou SFD : organise tes tontines et coffres sous ton nom et ton logo, gère plusieurs groupes et ton équipe, vends tes biens en tontine.</P>
      {mine.data?.length === 0 && <Empty text="Tu n'as pas encore d'espace partenaire." />}
      {mine.data?.map((p) => (
        <Pressable key={p.id} onPress={() => router.push({ pathname: '/partenaire/[id]', params: { id: p.id } })}>
          <Card>
            <PartnerBrand brand={{ id: p.id, name: p.name, logo: p.logo, color: p.primary_color }} />
            <P muted>{STATUS[p.status]} · {p.role === 'owner' ? 'propriétaire' : 'gestionnaire'}</P>
          </Card>
        </Pressable>
      ))}

      <Card>
        <H2>Créer mon espace partenaire</H2>
        <Field label="Nom affiché aux membres" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Association Wend-Panga" />
        <View style={{ gap: 6 }}>
          {TYPES.map((t) => (
            <Pressable key={t.value} onPress={() => setForm({ ...form, type: t.value })}
              style={{ padding: 10, borderRadius: 10, borderWidth: 2, borderColor: form.type === t.value ? colors.green : colors.line }}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <ImageField label="Logo" value={logo} onChange={setLogo} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink2 }}>Couleur de la marque</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => setForm({ ...form, color: c })} accessibilityLabel={`Couleur ${c}`}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: form.color === c ? 3 : 0, borderColor: colors.ink }} />
          ))}
        </View>
        <PartnerBrand brand={{ id: 'apercu', name: form.name || 'Aperçu de ta marque', logo, color: form.color }} />
        <Field label="Description" value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline />
        <Field label="Ville" value={form.city} onChangeText={(city) => setForm({ ...form, city })} />
        <Field label="Téléphone de contact" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
        <Field label="Tes frais de gestion sur chaque pot (0 à 3 %)" value={form.fee} onChangeText={(fee) => setForm({ ...form, fee })} keyboardType="decimal-pad" />
        <P muted>Licence Smart Tontine : 75 F par membre actif et par mois (minimum 10 000 F), sans limite de groupes. L'espace est activé après vérification de ton identité et de ta structure.</P>
        <Button title="Créer l'espace partenaire" variant="green" onPress={create} disabled={form.name.length < 2} />
      </Card>
    </Screen>
  );
}
