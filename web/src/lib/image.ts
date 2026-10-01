/**
 * Réduit une photo (appareil photo du téléphone : souvent 3 à 8 Mo) en JPEG de moins de `maxChars`
 * caractères base64, pour l'envoyer à l'API. La taille et la qualité baissent jusqu'à tenir.
 */
export async function compressImage(file: File, maxSide = 1280, maxChars = 480_000): Promise<string> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch { throw new Error('Image illisible : choisissez une photo JPEG ou PNG'); }
  let side = maxSide;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.65, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length <= maxChars) { URL.revokeObjectURL(img.src); return data; }
    }
    side = Math.round(side * 0.75);
  }
  URL.revokeObjectURL(img.src);
  throw new Error('Photo trop lourde');
}
