import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, notifyError } from '@/components/ui';

const MAX_CHARS = 300_000; // limite acceptée par l'API (≈ 220 Ko d'image)

/** Choix d'une image dans la galerie, recadrée et compressée, renvoyée en data URL (logo, photo de bien). */
export function ImageField({ label, value, onChange, aspect = [1, 1] }: {
  label: string; value: string | null; onChange: (v: string | null) => void; aspect?: [number, number];
}) {
  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.4, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
    if (uri.length > MAX_CHARS) { notifyError(new Error('Image trop lourde : recadre-la ou choisis-en une plus petite.')); return; }
    onChange(uri);
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink2 }}>{label}</Text>
      <Pressable onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityRole="button">
        {value
          ? <Image source={{ uri: value }} style={{ width: 64, height: 64, borderRadius: 10 }} />
          : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>🖼️</Text></View>}
        <Text style={{ color: colors.brand, fontWeight: '700' }}>{value ? 'Changer l\'image' : 'Choisir une image'}</Text>
        {value && <Text onPress={() => onChange(null)} style={{ color: colors.danger }}>Retirer</Text>}
      </Pressable>
    </View>
  );
}
