// Rendu image par image de index.html puis assemblage MP4 (ffmpeg).
//   node render.mjs                → smart-tontine-presentation.mp4 (1920×1080, 30 i/s)
//   node render.mjs --stills 3,9,15 → aperçus PNG aux instants donnés
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = Number(process.env.FPS ?? 30);
const out = process.env.OUT ?? path.join(dir, 'smart-tontine-presentation.mp4');
const frames = process.env.FRAMES ?? path.join(dir, '.frames');
const args = process.argv.slice(2);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + path.join(dir, 'index.html'));
await p.evaluate(() => window.ready);
if (args[0] === '--stills') {
  for (const t of args[1].split(',').map(Number)) {
    await p.evaluate((x) => window.seek(x), t);
    await p.screenshot({ path: path.join(dir, `.still-${String(t).replace('.', '_')}.png`) });
  }
} else {
  const duration = await p.evaluate(() => window.DURATION);
  rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
  const n = Math.round(duration * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((x) => window.seek(x), i / FPS);
    await p.screenshot({ path: path.join(frames, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (i % 150 === 0) console.log(`image ${i}/${n}`);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('vidéo :', out);
}
console.log(errs.length ? errs.join('\n') : 'aucune erreur');
await b.close();
