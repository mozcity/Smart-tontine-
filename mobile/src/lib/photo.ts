import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Prend une photo (appareil photo, ou galerie si refusé) puis la réduit en JPEG de moins de `maxChars`
 * caractères base64 : une photo de téléphone (3 à 8 Mo) devient ≈ 200-400 Ko, accepté par l'API.
 */
export async function takePhoto(source: 'camera' | 'library', maxChars = 480_000): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    res = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  for (const [width, compress] of [[1280, 0.7], [1024, 0.6], [800, 0.5], [640, 0.45]] as const) {
    const ref = await ImageManipulator.manipulate(asset.uri).resize(asset.width > asset.height ? { width } : { height: width }).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    const data = `data:image/jpeg;base64,${out.base64}`;
    if (data.length <= maxChars) return data;
  }
  throw new Error('Photo trop lourde, réessaie avec plus de lumière ou de plus près.');
}
