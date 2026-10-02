// Habille les captures pour les fiches des stores : fond de marque, accroche, écran arrondi.
//   node store/cadrer.cjs   (après store/captures.cjs)
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const DIR = path.join(__dirname, 'captures');
const OUT = path.join(DIR, 'finales');
const INTER = path.join(__dirname, '..', '..', 'web', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
const CAPTIONS = {
  '1-accueil': ['Votre argent et vos tontines', 'au même endroit'],
  '2-tontine': ['Cotisez en un geste,', 'recevez le pot à votre tour'],
  '3-tontines': ['Créez ou rejoignez', 'une tontine en 1 minute'],
  '4-depot': ['Déposez par Orange Money,', 'Moov Money ou Wave'],
  '5-credit': ['Cotisez à l’heure,', 'débloquez une avance'],
  '6-biens': ['Moto, frigo, téléphone :', 'épargnez pour vos biens'],
};
const SIZES = { ios: [1290, 2796], android: [1080, 1920] };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const font = fs.readFileSync(INTER).toString('base64');
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [kind, [w, h]] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const [name, [l1, l2]] of Object.entries(CAPTIONS)) {
      const shot = fs.readFileSync(path.join(DIR, `${kind}-${name}.png`)).toString('base64');
      const u = w / 100; // unité relative à la largeur
      await page.setContent(`<!doctype html><html><head><style>
        @font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
        body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,sans-serif;
             background:radial-gradient(circle at 20% 0%,#4A46C4 0,#2F2C8F 45%,#1C1A5C 100%);display:flex;flex-direction:column;align-items:center}
        h1{color:#fff;font-size:${5.6 * u}px;line-height:1.15;font-weight:800;letter-spacing:-.03em;text-align:center;margin:${9 * u}px ${6 * u}px ${6 * u}px}
        h1 span{color:#7FE07A}
        img{width:${78 * u}px;border-radius:${6 * u}px;box-shadow:0 ${3 * u}px ${8 * u}px rgba(0,0,0,.45);border:${0.8 * u}px solid rgba(255,255,255,.18)}
      </style></head><body><h1>${l1}<br><span>${l2}</span></h1><img src="data:image/png;base64,${shot}"></body></html>`);
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(OUT, `${kind}-${name}.png`);
      await page.screenshot({ path: file });
      console.log('✓', path.relative(__dirname, file));
    }
    await page.close();
  }
  await browser.close();
})();
