import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { PinProvider, colors } from '@/components/ui';

function RootStack() {
  const { ready, me } = useAuth();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}><ActivityIndicator color="#fff" /></View>;
  }
  return (
    <Stack screenOptions={{ headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '700', color: colors.ink }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg }, contentStyle: { backgroundColor: colors.bg } }}>
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
        <Stack.Screen name="cagnottes" options={{ title: 'Coffres de groupe' }} />
        <Stack.Screen name="cagnotte/[id]" options={{ title: 'Coffre de groupe' }} />
        <Stack.Screen name="tontine/[id]" options={{ title: 'Tontine' }} />
        <Stack.Screen name="rejoindre/[code]" options={{ title: 'Invitation' }} />
        <Stack.Screen name="biens" options={{ title: 'Biens matériels' }} />
        <Stack.Screen name="partenaire/index" options={{ title: 'Espace partenaire' }} />
        <Stack.Screen name="partenaire/[id]" options={{ title: 'Mon espace partenaire' }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
        <Stack.Screen name="support" options={{ title: 'Aide & support' }} />
        <Stack.Screen name="identite" options={{ title: 'Mon identité' }} />
        <Stack.Screen name="supprimer-compte" options={{ title: 'Supprimer mon compte' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PinProvider>
          <StatusBar style="dark" />
          <RootStack />
        </PinProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
