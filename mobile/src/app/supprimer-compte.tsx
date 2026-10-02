import { useState } from 'react';
import { router } from 'expo-router';
import { AlertTriangle, CheckCircle2, Trash2, XCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePin } from '@/lib/pin';
import { useApi } from '@/lib/useApi';
import { Button, Card, H2, IconBadge, P, Row, Screen, colors, notifyError, notifyOk } from '@/components/ui';

/** Suppression du compte (exigée par Google Play et l'App Store), avec ce qui reste à régler avant. */
export default function SupprimerCompte() {
  const { signOut } = useAuth();
  const askPin = usePin();
  const check = useApi<{ possible: boolean; blockers: string[] }>('/me/deletion');
  const [loading, setLoading] = useState(false);

  async function confirm() {
    const pin = await askPin('Supprimer définitivement ton compte Smart Tontine');
    if (!pin) return;
    setLoading(true);
    try {
      await api('/me/deletion', { body: { pin } });
      notifyOk('Compte supprimé', 'Merci d’avoir utilisé Smart Tontine.');
      await signOut();
      router.replace('/login');
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <Screen edges={[]} onRefresh={check.reload}>
      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 12 }}><IconBadge icon={AlertTriangle} tone="red" /><H2 style={{ flex: 1 }}>Supprimer mon compte</H2></Row>
        <P>Ton nom, ton e-mail, ton PIN et tes données de budget sont effacés, et ton numéro est libéré.</P>
        <P muted>La loi (lutte contre le blanchiment, LBC/FT) impose de garder 10 ans l’historique de tes opérations et ton dossier d’identité. Ils ne sont plus rattachés à un compte actif.</P>
      </Card>

      {check.data && !check.data.possible && (
        <Card style={{ gap: 10 }}>
          <H2>Avant de supprimer ton compte</H2>
          {check.data.blockers.map((b) => (
            <Row key={b} style={{ gap: 10, alignItems: 'flex-start' }}>
              <XCircle size={18} color={colors.danger} />
              <P style={{ flex: 1 }}>{b}</P>
            </Row>
          ))}
        </Card>
      )}
      {check.data?.possible && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 }}>
          <CheckCircle2 size={18} color={colors.green} />
          <P style={{ flex: 1 }}>Ton compte est prêt à être supprimé.</P>
        </View>
      )}
      <Button title="Supprimer définitivement" icon={Trash2} variant="danger" onPress={confirm} loading={loading} disabled={!check.data?.possible} />
    </Screen>
  );
}
