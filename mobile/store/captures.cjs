// Captures d'écran des stores à partir de l'app (version web Expo, port 8081) et d'un compte de démonstration.
//   TOKEN=<jeton> node store/captures.cjs
// App Store : iPhone 6,9 po (1290 × 2796). Google Play : téléphone 1080 × 1920.
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = path.join(__dirname, 'captures');
const SCREENS = [
  ['1-accueil', '/'],
  ['2-tontine', `/tontine/${process.env.TONTINE_ID}`],
  ['3-tontines', '/tontines'],
  ['4-depot', '/depot'],
  ['5-credit', '/credit'],
  ['6-biens', '/biens'],
];
const DEVICES = { ios: { width: 430, height: 932, scale: 3 }, android: { width: 360, height: 640, scale: 3 } };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [kind, d] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    await ctx.addInitScript((t) => localStorage.setItem('smarttontine_token', t), process.env.TOKEN);
    const page = await ctx.newPage();
    for (const [name, route] of SCREENS) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `${kind}-${name}.png`) });
      console.log('✓', kind, name);
    }
    await ctx.close();
  }
  await browser.close();
})();
