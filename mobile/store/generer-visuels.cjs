// Génère les icônes, le splash et les visuels des stores à partir du logo Smart Tontine (SVG).
//   node store/generer-visuels.cjs   (Playwright + Chromium)
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const ASSETS = path.join(__dirname, '..', 'assets');
const STORE = __dirname;
const grad = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A46C4"/><stop offset="1" stop-color="#1C1A5C"/></linearGradient>`;
// Anneau (tontine qui tourne) et trois membres ; centre de rotation (32, 33).
const mark = (ring = '#3AA935', dots = '#fff') => `
  <circle cx="32" cy="33" r="16" fill="none" stroke="${ring}" stroke-width="5.5" stroke-dasharray="78 23" stroke-linecap="round" transform="rotate(-60 32 33)"/>
  <circle cx="32" cy="17" r="5" fill="${dots}"/><circle cx="46" cy="41" r="5" fill="${dots}"/><circle cx="18" cy="41" r="5" fill="${dots}"/>`;
const scaled = (s, inner) => `<g transform="translate(32 32) scale(${s}) translate(-32 -33)">${inner}</g>`;
const svg = (size, body, w = size, h = size, vb = '0 0 64 64') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}"><defs>${grad('g')}</defs>${body}</svg>`;

const files = {
  // iOS + icône générique : carré plein, opaque, sans coins arrondis (le système applique le masque).
  [`${ASSETS}/icon.png`]: [1024, svg(1024, `<rect width="64" height="64" fill="url(#g)"/>${scaled(1.12, mark())}`)],
  // Android adaptatif : le motif tient dans la zone sûre (66 % centraux), fond séparé.
  [`${ASSETS}/android-icon-foreground.png`]: [1024, svg(1024, scaled(0.78, mark()))],
  [`${ASSETS}/android-icon-background.png`]: [1024, svg(1024, `<rect width="64" height="64" fill="url(#g)"/>`)],
  [`${ASSETS}/android-icon-monochrome.png`]: [1024, svg(1024, scaled(0.78, mark('#fff', '#fff')))],
  // Splash : logo complet (carré arrondi) sur fond uni, affiché à 200 px de large.
  [`${ASSETS}/splash-icon.png`]: [1024, svg(1024, `<rect x="4" y="4" width="56" height="56" rx="16" fill="url(#g)"/>${scaled(0.9, mark())}`)],
  [`${ASSETS}/favicon.png`]: [48, svg(48, `<rect width="64" height="64" rx="18" fill="url(#g)"/>${mark()}`)],
  // Google Play : icône 512 × 512 et bannière 1024 × 500.
  [`${STORE}/play-icone-512.png`]: [512, svg(512, `<rect width="64" height="64" fill="url(#g)"/>${scaled(1.12, mark())}`)],
};

// Police de la marque (Inter), reprise de la plateforme web.
const INTER = path.join(__dirname, '..', '..', 'web', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
const banner = `<!doctype html><html><head><style>
  @font-face{font-family:Inter;src:url(data:font/woff2;base64,${require('node:fs').readFileSync(INTER).toString('base64')}) format('woff2');font-weight:100 900}
  body{margin:0;width:1024px;height:500px;font-family:Inter,system-ui,sans-serif;background:linear-gradient(135deg,#2F2C8F,#1C1A5C);color:#fff;display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;overflow:hidden}
  h1{font-size:64px;margin:0;letter-spacing:-.03em} p{font-size:28px;margin:14px 0 0;color:#D9D8FF;line-height:1.35} b{color:#7FE07A}
</style></head><body>${svg(220, `<rect width="64" height="64" rx="18" fill="url(#g)"/>${mark()}`)}
<div><h1>Smart Tontine</h1><p>La tontine en ligne, <b>sûre</b> et sans espèces.<br>Orange Money · Moov Money · Wave</p></div></body></html>`;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [file, [size, content]] of Object.entries(files)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${content}</body></html>`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
    await page.close();
    console.log('✓', path.relative(path.join(__dirname, '..'), file));
  }
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.setContent(banner);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${STORE}/play-banniere-1024x500.png` });
  console.log('✓ store/play-banniere-1024x500.png');
  await browser.close();
  // L'App Store refuse les icônes avec canal alpha : celles qui sont opaques sont aplaties en RGB (ffmpeg).
  for (const f of [`${ASSETS}/icon.png`, `${STORE}/play-icone-512.png`, `${STORE}/play-banniere-1024x500.png`]) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', f, '-pix_fmt', 'rgb24', `${f}.rgb.png`]);
    require('node:fs').renameSync(`${f}.rgb.png`, f);
  }
  console.log('✓ icônes opaques aplaties en RGB');
})();
