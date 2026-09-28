import { Image, Text, View } from 'react-native';
import { colors } from '@/components/ui';

export interface Brand { id: string; name: string; logo: string | null; color: string; type?: string }

/** Bandeau de marque d'un partenaire : son logo et sa couleur sur les groupes qu'il organise. */
export function PartnerBrand({ brand, size = 'md' }: { brand: Brand | null | undefined; size?: 'sm' | 'md' }) {
  if (!brand) return null;
  const logo = size === 'sm' ? 22 : 40;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.color, borderRadius: 10, padding: size === 'sm' ? 4 : 10, alignSelf: size === 'sm' ? 'flex-start' : 'stretch' }}>
      {brand.logo
        ? <Image source={{ uri: brand.logo }} style={{ width: logo, height: logo, borderRadius: 6, backgroundColor: '#fff' }} accessibilityLabel={`Logo ${brand.name}`} />
        : <View style={{ width: logo, height: logo, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: brand.color, fontWeight: '900' }}>{brand.name.slice(0, 1)}</Text>
          </View>}
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size === 'sm' ? 12 : 16 }} numberOfLines={1}>{brand.name}</Text>
        {size === 'md' && <Text style={{ color: '#ffffffcc', fontSize: 11 }}>Organisé avec Smart Tontine</Text>}
      </View>
    </View>
  );
}

export const brandColor = (brand: Brand | null | undefined) => brand?.color ?? colors.brand;
