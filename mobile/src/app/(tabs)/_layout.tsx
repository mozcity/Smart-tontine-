import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { HandCoins, Home, PieChart, RefreshCcw, UserRound } from 'lucide-react-native';
import { colors, type Icon } from '@/components/ui';

// Onglet actif : icône dans une pastille indigo clair, comme les applications bancaires récentes.
const icon = (I: Icon) => ({ focused }: { focused: boolean }) => (
  <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.brandSoft : 'transparent' }}>
    <I size={21} color={focused ? colors.brand : colors.muted} strokeWidth={focused ? 2.4 : 2} />
  </View>
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontWeight: '600', fontSize: 11.5 },
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, height: 66, paddingTop: 6, paddingBottom: 8 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon(Home) }} />
      <Tabs.Screen name="tontines" options={{ title: 'Tontines', tabBarIcon: icon(RefreshCcw) }} />
      <Tabs.Screen name="credit" options={{ title: 'Crédit', tabBarIcon: icon(HandCoins) }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: icon(PieChart) }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}
