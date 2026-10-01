import { Share, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { shortDate } from '@/lib/format';
import { Button, Card, H1, H2, P, Row, Screen, colors, notifyError } from '@/components/ui';

export default function Profil() {
  const { me, refresh, signOut } = useAuth();
  const notifs = useApi<{ id: string; title: string; body: string; created_at: string; read_at: string | null }[]>('/me/notifications');

  async function subscribePro() {
    try { await api('/me/pro/subscribe', { body: {} }); await refresh(); } catch (e) { notifyError(e); }
  }

  async function subscribe() {
    try { await api('/me/plan/subscribe', { body: {} }); await refresh(); } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={() => { void refresh(); void notifs.reload(); }}>
      <H1>{me?.full_name ?? 'Mon profil'}</H1>
      <P muted>{me?.phone} · vérification d'identité niveau {me?.kyc_level} · 🏅 {me?.points} points</P>
      {(me?.kyc_level ?? 0) < 2 && <Button title="🪪 Vérifier mon identité (plafonds, crédit)" variant="ghost" onPress={() => router.push('/identite')} />}

      <Card style={{ backgroundColor: me?.plan === 'plus' ? colors.green : colors.brand }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>Smart Tontine+ {me?.plan === 'plus' ? '✓ actif' : ''}</Text>
        <Text style={{ color: '#fff' }}>3 retraits offerts par mois (dont ton pot de tontine) · support prioritaire — 500 F / mois</Text>
        {me?.plan !== 'plus' && <Button title="Passer à Smart Tontine+" variant="green" onPress={subscribe} />}
      </Card>

      <Card style={{ borderColor: colors.brand, borderWidth: 2 }}>
        <H2>Organisateur Pro {me?.is_pro ? '✓' : ''}</H2>
        <P>Pour les trésoriers de tontines, d'associations, de GIE : gère plus de 2 groupes à la fois et exporte les cotisations (CSV) pour tes assemblées. 2 000 F / mois.</P>
        {me?.is_pro
          ? <P muted>Actif jusqu'au {me.pro_renews_at ? shortDate(me.pro_renews_at) : '—'} (renouvellement automatique).</P>
          : <Button title="Devenir Organisateur Pro" onPress={subscribePro} />}
      </Card>

      <Card>
        <H2>Parraine tes proches 🎁</H2>
        <P>Gagne 500 F quand un filleul fait son premier dépôt de 5 000 F ou plus.</P>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 3, color: colors.brand }}>{me?.referral_code}</Text>
          <Button title="Partager" variant="ghost" onPress={() => Share.share({ message: `Rejoins-moi sur Smart Tontine pour gérer ton argent sans stress ! Mon code parrain : ${me?.referral_code} — https://smarttontine.app` })} />
        </Row>
      </Card>

      <H2>Notifications</H2>
      {notifs.data?.slice(0, 8).map((n) => (
        <Card key={n.id}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{n.read_at ? '' : '🔵 '}{n.title}</Text>
          <P>{n.body}</P>
          <P muted>{shortDate(n.created_at)}</P>
        </Card>
      ))}

      <Button title="🏢 Espace partenaire (association, commerçant, entreprise…)" onPress={() => router.push('/partenaire')} />
      <Button title="🛵 Mes biens : plans d'achat et commandes" variant="ghost" onPress={() => router.push('/biens')} />
      <Button title="🚀 Challenges d'épargne" variant="ghost" onPress={() => router.push('/challenges')} />
      <Button title="Mes contrats de prêt entre proches" variant="ghost" onPress={() => router.push('/contrats')} />
      <Button title="Aide & support" variant="ghost" onPress={() => router.push('/support')} />
      <Button title="Se déconnecter" variant="danger" onPress={signOut} />
    </Screen>
  );
}
