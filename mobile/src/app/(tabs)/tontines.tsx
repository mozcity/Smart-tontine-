import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { PartnerBrand, type Brand } from '@/components/PartnerBrand';
import { CreateTontineForm } from '@/components/CreateTontineForm';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fcfa, shortDate } from '@/lib/format';
import { Button, Card, Empty, Field, H1, H2, P, Row, Screen, Segmented, colors, notifyError } from '@/components/ui';

interface TontineItem {
  id: string; name: string; kind: 'argent' | 'bien'; good_label: string | null; partner: Brand | null; contribution_amount: number; frequency: 'weekly' | 'monthly'; max_members: number; members: number;
  status: 'recruiting' | 'active' | 'completed' | 'cancelled'; my_turn: string | null; position: number | null;
  current_round: { number: number; due_date: string; beneficiary_id: string; paid: boolean } | null;
}
interface PublicTontine {
  id: string; name: string; kind: 'argent' | 'bien'; contribution_amount: number; frequency: string; max_members: number; members: number;
  guarantee_amount: number; good_label: string | null; good_price: number | null; good_image: string | null; partner: Brand | null;
}
interface Preview { id: string; name: string; organizer: string; contribution_amount: number; frequency: string; members: number; max_members: number; guarantee_amount: number; pot: number; status: string }

const FREQ: Record<string, string> = { weekly: 'semaine', monthly: 'mois' };
const STATUS: Record<string, string> = { recruiting: '👥 Recrutement', active: '🟢 En cours', completed: '✅ Terminée', cancelled: 'Annulée' };

export default function Tontines() {
  const { me } = useAuth();
  const list = useApi<TontineItem[]>('/tontines');
  const [mode, setMode] = useState<'discover' | 'join' | 'create'>('discover');
  const [kindFilter, setKindFilter] = useState<'tous' | 'argent' | 'bien'>('tous');
  const discover = useApi<PublicTontine[]>(`/tontines/public${kindFilter === 'tous' ? '' : `?kind=${kindFilter}`}`);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  async function lookup() {
    try { setPreview(await api<Preview>(`/tontines/${code.trim().split('/').pop()}/preview`)); } catch (e) { notifyError(e); }
  }
  async function join() {
    try { await api(`/tontines/${preview!.id}/join`, { body: {} }); setPreview(null); setCode(''); await list.reload(); } catch (e) { notifyError(e); }
  }
  return (
    <Screen onRefresh={list.reload}>
      <H1>Mes tontines</H1>
      <P>Cotise à chaque tour et reçois tout le pot quand vient ton tour. Chaque cotisation à l'heure fait monter ton score de crédit.</P>
      {list.data?.length === 0 && <Empty text="Tu ne participes à aucune tontine pour l'instant." />}
      {list.data?.map((t) => {
        const r = t.current_round;
        const mine = r?.beneficiary_id === me?.id;
        return (
          <Pressable key={t.id} onPress={() => router.push({ pathname: '/tontine/[id]', params: { id: t.id } })}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{t.kind === 'bien' ? '🛵' : '🔄'} {t.name}</Text>
                <Text style={{ fontSize: 12 }}>{STATUS[t.status]}</Text>
              </Row>
              {t.partner && <PartnerBrand brand={t.partner} size="sm" />}
              <P>{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · {t.members}/{t.max_members} membres · {t.kind === 'bien' ? `bien : ${t.good_label}` : `pot ${fcfa(t.contribution_amount * t.max_members)}`}</P>
              {t.status === 'active' && r && (
                <View style={{ backgroundColor: r.paid ? colors.greenSoft : colors.dangerSoft, borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>
                    Tour {r.number} · échéance {shortDate(r.due_date)} {mine ? '· 🎉 c\'est ton tour' : ''}
                  </Text>
                  <Text style={{ color: r.paid ? colors.green : colors.danger }}>{r.paid ? '✔ Cotisation payée' : '⏳ Cotisation à payer'}</Text>
                </View>
              )}
              {t.my_turn && t.status === 'active' && <P muted>Ton tour : n° {t.position} le {shortDate(t.my_turn)}</P>}
            </Card>
          </Pressable>
        );
      })}

      <Segmented options={[{ value: 'discover', label: 'Découvrir' }, { value: 'join', label: 'Code' }, { value: 'create', label: 'Créer' }]} value={mode} onChange={setMode} />
      {mode === 'discover' && (
        <>
          <P>Tontines publiques ouvertes à tous, organisées par des membres ou des partenaires.</P>
          <Segmented options={[{ value: 'tous', label: 'Toutes' }, { value: 'argent', label: '💰 Argent' }, { value: 'bien', label: '🛵 Biens' }]} value={kindFilter} onChange={setKindFilter} />
          {discover.data?.length === 0 && <Empty text="Aucune tontine publique en recrutement pour l'instant." />}
          {discover.data?.map((t) => (
            <Card key={t.id}>
              {t.partner && <PartnerBrand brand={t.partner} size="sm" />}
              <Row style={{ alignItems: 'flex-start' }}>
                {t.good_image ? <Image source={{ uri: t.good_image }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{t.kind === 'bien' ? '🛵' : '🔄'} {t.name}</Text>
                  {t.kind === 'bien' && <P>Bien : {t.good_label} ({fcfa(t.good_price)})</P>}
                  <P muted>{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · {t.members}/{t.max_members} membres · caution {fcfa(t.guarantee_amount)}</P>
                </View>
              </Row>
              <Button title="Voir et rejoindre" variant="ghost" onPress={() => router.push({ pathname: '/rejoindre/[code]', params: { code: t.id } })} />
            </Card>
          ))}
        </>
      )}
      {mode === 'join' && (
        <Card>
          <H2>Rejoindre avec un code</H2>
          <Field label="Code ou lien d'invitation reçu de l'organisateur" value={code} onChangeText={setCode} autoCapitalize="none" />
          <Button title="Voir la tontine" variant="ghost" onPress={lookup} disabled={code.trim().length < 10} />
          {preview && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{preview.name}</Text>
              <P>Organisée par {preview.organizer} · {fcfa(preview.contribution_amount)} / {FREQ[preview.frequency]}</P>
              <P>{preview.members}/{preview.max_members} membres · pot de {fcfa(preview.pot)}</P>
              <P muted>Caution bloquée à l'adhésion : {fcfa(preview.guarantee_amount)}, rendue en fin de tontine si tu cotises à chaque tour.</P>
              <Button title="Rejoindre et bloquer la caution" variant="green" onPress={join} disabled={preview.status !== 'recruiting'} />
            </View>
          )}
        </Card>
      )}
      {mode === 'create' && (
        <CreateTontineForm onCreated={(id) => router.push({ pathname: '/tontine/[id]', params: { id } })} />
      )}
    </Screen>
  );
}
