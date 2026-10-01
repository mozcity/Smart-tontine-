import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { fcfa, shortDate } from '@/lib/format';
import { takePhoto } from '@/lib/photo';
import { Button, Card, Field, H1, H2, P, Row, Screen, Segmented, colors, notifyError, notifyOk } from '@/components/ui';

interface Kyc {
  level: number; limits: Record<string, { balance: number; monthlyInflow: number }>; requirements: Record<string, string[]>;
  pending: { level: number; created_at: string } | null;
  last: { status: string; reason: string | null } | null;
}
type PhotoKey = 'idFront' | 'idBack' | 'selfie' | 'proofOfAddress';
const ID_TYPES = [{ value: 'cnib', label: 'CNIB' }, { value: 'passeport', label: 'Passeport' }, { value: 'carte_consulaire', label: 'Carte consulaire' }];

/** Vérification d'identité : pièce + selfie (niveau 1), justificatif (niveau 2). */
export default function Identite() {
  const { me, refresh } = useAuth();
  const { data: k, reload } = useApi<Kyc>('/me/kyc');
  const [idType, setIdType] = useState('cnib');
  const [f, setF] = useState({ idNumber: '', fullName: me?.full_name ?? '' });
  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, string>>>({});
  const [sending, setSending] = useState(false);
  if (!k) return <Screen><P>Chargement…</P></Screen>;
  const level = (k.level + 1) as 1 | 2;
  const ready = photos.idFront && photos.selfie && (idType !== 'cnib' || photos.idBack) && (level === 1 || photos.proofOfAddress)
    && f.idNumber.trim().length >= 4 && f.fullName.trim().length >= 3;

  async function shoot(key: PhotoKey, source: 'camera' | 'library') {
    try { const p = await takePhoto(source); if (p) setPhotos((x) => ({ ...x, [key]: p })); } catch (e) { notifyError(e); }
  }
  async function send() {
    setSending(true);
    try {
      await api('/me/kyc', { body: { level, idType, idNumber: f.idNumber.trim().toUpperCase(), fullName: f.fullName.trim(), ...photos } });
      notifyOk('Dossier envoyé ✅', 'Vérification sous 48 h ouvrées. Tu recevras une notification.');
      await reload(); await refresh();
    } catch (e) { notifyError(e); } finally { setSending(false); }
  }

  const PhotoRow = ({ k: key, label }: { k: PhotoKey; label: string }) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink2 }}>{label}</Text>
      <Row>
        {photos[key]
          ? <Image source={{ uri: photos[key] }} style={{ width: 96, height: 64, borderRadius: 8 }} />
          : <View style={{ width: 96, height: 64, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>📷</Text></View>}
        <Pressable onPress={() => shoot(key, 'camera')} accessibilityRole="button"><Text style={{ color: colors.brand, fontWeight: '700' }}>Prendre la photo</Text></Pressable>
        <Pressable onPress={() => shoot(key, 'library')} accessibilityRole="button"><Text style={{ color: colors.ink2 }}>Galerie</Text></Pressable>
      </Row>
    </View>
  );

  return (
    <Screen onRefresh={reload}>
      <H1>Vérification d'identité</H1>
      <P muted>Niveau actuel : {k.level} · solde max. {fcfa(k.limits[k.level].balance)} · dépôts {fcfa(k.limits[k.level].monthlyInflow)} / mois{k.level >= 1 ? ' · crédit ouvert' : ''}</P>
      {k.pending ? (
        <Card style={{ backgroundColor: colors.brandSoft }}><P>⏳ Dossier de niveau {k.pending.level} envoyé le {shortDate(k.pending.created_at)} : vérification sous 48 h ouvrées.</P></Card>
      ) : k.level >= 2 ? (
        <Card style={{ backgroundColor: colors.greenSoft }}><P>✅ Identité vérifiée au niveau maximal.</P></Card>
      ) : (
        <Card>
          <H2>Passer au niveau {level}</H2>
          <P muted>Débloque : solde jusqu'à {fcfa(k.limits[level].balance)}, {fcfa(k.limits[level].monthlyInflow)} de dépôts par mois{level === 1 ? ' et le crédit' : ''}. À fournir : {k.requirements[level].join(' · ')}.</P>
          {k.last?.status === 'rejected' && <P>⚠️ Dossier précédent refusé : {k.last.reason}</P>}
          <Segmented options={ID_TYPES} value={idType} onChange={setIdType} />
          <Field label="Numéro de la pièce" value={f.idNumber} onChangeText={(idNumber) => setF({ ...f, idNumber })} autoCapitalize="characters" />
          <Field label="Nom complet (comme sur la pièce)" value={f.fullName} onChangeText={(fullName) => setF({ ...f, fullName })} />
          <PhotoRow k="idFront" label="Pièce — recto (4 coins visibles, sans reflet)" />
          {idType === 'cnib' && <PhotoRow k="idBack" label="Pièce — verso" />}
          <PhotoRow k="selfie" label="Selfie en tenant ta pièce" />
          {level === 2 && <PhotoRow k="proofOfAddress" label="Justificatif de domicile ou de revenus (< 3 mois)" />}
          <Button title="Envoyer mon dossier" onPress={send} loading={sending} disabled={!ready} />
          <P muted>Tes documents sont chiffrés et vus uniquement par l'équipe conformité.</P>
        </Card>
      )}
    </Screen>
  );
}
