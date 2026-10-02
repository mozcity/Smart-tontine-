import { Pressable, Share, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Building2, ChevronRight, Crown, FileSignature, Gift, HelpCircle, IdCard, LogOut, MonitorSmartphone, Rocket, Trash2, ShoppingBag, Sparkles, Users } from 'lucide-react-native';
import { api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { shortDate } from '@/lib/format';
import { Badge, Button, Card, H1, ListItem, P, Screen, SectionHeader, colors, notifyError, notifyOk, type Icon, type Tone } from '@/components/ui';

export default function Profil() {
  const { me, refresh, signOut } = useAuth();
  const notifs = useApi<{ id: string; title: string; body: string; created_at: string; read_at: string | null }[]>('/me/notifications');
  const initials = (me?.full_name ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // Téléphone perdu ou prêté : les autres appareils sont déconnectés, celui-ci reçoit un nouveau jeton.
  async function logoutOthers() {
    try {
      const r = await api<{ token: string }>('/auth/logout-all', { body: {} });
      await tokenStore.set(r.token);
      notifyOk('Autres appareils déconnectés', 'Seul ce téléphone reste connecté à ton compte.');
    } catch (e) { notifyError(e); }
  }
  async function call(path: string) { try { await api(path, { body: {} }); await refresh(); } catch (e) { notifyError(e); } }
  const menu: [Icon, Tone, string, string, Href][] = [
    [ShoppingBag, 'gold', 'Mes biens', 'Plans d’achat et commandes', '/biens'],
    [Users, 'green', 'Coffres de groupe', 'Associations, familles, GIE', '/cagnottes'],
    [Rocket, 'gold', 'Challenges d’épargne', 'Défis, points et récompenses', '/challenges'],
    [FileSignature, 'brand', 'Contrats', 'Prêts entre proches signés', '/contrats'],
    [Building2, 'blue', 'Espace partenaire', 'Association, commerçant, entreprise…', '/partenaire'],
    [HelpCircle, 'muted', 'Aide et support', 'Une question ? On te répond', '/support'],
  ];
  const unread = notifs.data?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Screen onRefresh={() => { void refresh(); void notifs.reload(); }}>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{initials}</Text>
        </View>
        <H1 style={{ fontSize: 22 }}>{me?.full_name ?? 'Mon profil'}</H1>
        <P muted>{me?.phone}</P>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Badge label={`Identité niveau ${me?.kyc_level ?? 0}`} tone={(me?.kyc_level ?? 0) >= 1 ? 'green' : 'gold'} />
          <Badge label={`${me?.points ?? 0} points`} tone="brand" />
          {me?.plan === 'plus' && <Badge label="Smart Tontine+" tone="green" />}
        </View>
      </View>

      {(me?.kyc_level ?? 0) < 2 && (
        <Pressable onPress={() => router.push('/identite')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brandSoft, borderColor: colors.brandLine }}>
            <IdCardBadge />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: colors.ink }}>Vérifie ton identité</Text><P muted>Plafonds relevés et accès au crédit en 2 minutes.</P></View>
            <ChevronRight size={20} color={colors.brand} />
          </Card>
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, gap: 8 }}>
          <Sparkles size={22} color={colors.green} />
          <Text style={{ fontWeight: '800', color: colors.ink }}>Smart Tontine+</Text>
          <P muted>3 retraits offerts / mois · 500 F</P>
          {me?.plan === 'plus' ? <Badge label="Actif" tone="green" /> : <Button title="Activer" size="sm" variant="green" onPress={() => call('/me/plan/subscribe')} />}
        </Card>
        <Card style={{ flex: 1, gap: 8 }}>
          <Crown size={22} color={colors.gold} />
          <Text style={{ fontWeight: '800', color: colors.ink }}>Organisateur Pro</Text>
          <P muted>Groupes illimités, exports · 2 000 F</P>
          {me?.is_pro ? <Badge label={`Jusqu’au ${me.pro_renews_at ? shortDate(me.pro_renews_at) : '—'}`} tone="green" /> : <Button title="Passer Pro" size="sm" onPress={() => call('/me/pro/subscribe')} />}
        </Card>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Gift size={26} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>Parraine tes proches</Text>
          <P muted>500 F au premier dépôt de ton filleul · code <Text style={{ fontWeight: '800', color: colors.brand, letterSpacing: 1 }}>{me?.referral_code}</Text></P>
        </View>
        <Button title="Partager" size="sm" variant="soft" onPress={() => Share.share({ message: `Rejoins-moi sur Smart Tontine, la tontine en ligne sûre ! Mon code parrain : ${me?.referral_code}` })} />
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        {menu.map(([I, tone, t, sub, href], i) => (
          <ListItem key={t} icon={I} tone={tone} title={t} subtitle={sub} onPress={() => router.push(href)} last={i === menu.length - 1} right={<ChevronRight size={18} color={colors.muted} />} />
        ))}
      </Card>

      <SectionHeader title={`Notifications${unread ? ` (${unread})` : ''}`} action={unread ? 'Tout lire' : undefined} onAction={async () => { await api('/me/notifications/read', { body: {} }); void notifs.reload(); }} />
      <Card style={{ paddingVertical: 4 }}>
        {!notifs.data?.length ? <P muted>Aucune notification.</P> : notifs.data.slice(0, 6).map((n, i, a) => (
          <View key={n.id} style={[{ paddingVertical: 12, gap: 2 }, i < a.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />}
              <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{n.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{shortDate(n.created_at)}</Text>
            </View>
            <P>{n.body}</P>
          </View>
        ))}
      </Card>

      <Button title="Déconnecter mes autres appareils" icon={MonitorSmartphone} variant="ghost" onPress={logoutOthers} />
      <Button title="Se déconnecter" icon={LogOut} variant="ghost" onPress={signOut} />
      <Button title="Supprimer mon compte" icon={Trash2} variant="ghost" size="sm" onPress={() => router.push('/supprimer-compte')} />
    </Screen>
  );
}

const IdCardBadge = () => (
  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><IdCard size={22} color={colors.brand} /></View>
);
