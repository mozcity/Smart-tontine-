import { Tabs } from 'expo-router/tabs';
import { Text } from 'react-native';
import { colors } from '@/components/ui';

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Synthèse', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="cagnottes" options={{ title: 'Cagnotte', tabBarIcon: icon('🐷') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
