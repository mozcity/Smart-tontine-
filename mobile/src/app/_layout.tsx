import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/components/ui';

function RootStack() {
  const { ready, me } = useAuth();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}><ActivityIndicator color="#fff" /></View>;
  }
  return (
    <Stack screenOptions={{ headerTintColor: colors.brand, headerTitleStyle: { fontWeight: '700' }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!me}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="depot" options={{ title: 'Dépôt', presentation: 'modal' }} />
        <Stack.Screen name="retrait" options={{ title: 'Retrait', presentation: 'modal' }} />
        <Stack.Screen name="transfert" options={{ title: 'Transfert', presentation: 'modal' }} />
        <Stack.Screen name="ecaisse" options={{ title: 'E-caisse' }} />
        <Stack.Screen name="projets" options={{ title: 'Mes projets' }} />
        <Stack.Screen name="contrats" options={{ title: 'Contrats' }} />
        <Stack.Screen name="challenges" options={{ title: 'Challenges' }} />
        <Stack.Screen name="cagnottes" options={{ title: 'Cagnotte+' }} />
        <Stack.Screen name="cagnotte/[id]" options={{ title: 'Cagnotte+' }} />
        <Stack.Screen name="tontine/[id]" options={{ title: 'Tontine' }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
        <Stack.Screen name="support" options={{ title: 'Aide & support' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
