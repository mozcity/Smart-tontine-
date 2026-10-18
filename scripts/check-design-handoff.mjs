// Dependency-free design handoff checks. Does not claim visual or financial validation.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = (path) => resolve(root, path);
const tokens = JSON.parse(readFileSync(file('design-system/figma-tokens.json'), 'utf8'));
const failures = [];
const hex = /^#[0-9A-Fa-f]{6}$/;

for (const [name, value] of Object.entries(tokens.colors ?? {})) {
  if (typeof value !== 'string' || !hex.test(value)) failures.push('Invalid color: ' + name);
}
for (const name of ['indigo','green','white','background','text','border','success','warning','error']) {
  if (!tokens.colors?.[name]) failures.push('Missing color: ' + name);
}
for (const name of ['xs','sm','md','lg','xl']) {
  if (!Number.isInteger(tokens.spacing?.[name]) || tokens.spacing[name] <= 0) failures.push('Invalid spacing: ' + name);
}
for (const name of ['display','heading','title','body','caption']) {
  const t = tokens.typography?.[name];
  if (!t || !(t.size > 0) || !(t.lineHeight >= t.size)) failures.push('Invalid typography: ' + name);
}
for (const path of [
  'web/package.json',
  'web/src/styles.css',
  'mobile/package.json',
  'mobile/src/app/(tabs)/index.tsx',
  'mobile/src/app/(tabs)/tontines.tsx',
  'mobile/src/app/(tabs)/credit.tsx',
  'mobile/src/app/(tabs)/profil.tsx',
  'backend/package.json'
]) {
  if (!existsSync(file(path))) failures.push('Missing project file: ' + path);
}

// Screenshot reference: IMG_7993.png (390 × 844). Guard against palette drift.
const expected = {
  indigo: '#2F2C8F', background: '#F6F7FB', text: '#15162C',
  greenAction: '#278326', greenDecorative: '#3AA935', white: '#FFFFFF',
};
for (const [key, value] of Object.entries(expected)) {
  if (tokens.colors?.[key]?.toUpperCase() !== value.toUpperCase()) failures.push('Screenshot token mismatch: ' + key);
}
const mobileUI = readFileSync(file('mobile/src/components/ui.tsx'), 'utf8');
const webCSS = readFileSync(file('web/src/styles.css'), 'utf8');
const home = readFileSync(file('mobile/src/app/(tabs)/index.tsx'), 'utf8');
for (const [name, needle] of [
  ['mobile brand', "brand: '#2F2C8F'"],
  ['mobile background', "bg: '#F6F7FB'"],
  ['mobile ink', "ink: '#15162C'"],
  ['mobile action green', "green: '#278326'"],
]) if (!mobileUI.includes(needle)) failures.push('Mobile screenshot mismatch: ' + name);
for (const [name, needle] of [
  ['web brand', '--brand-600: #2F2C8F'],
  ['web background', '--bg: #F6F7FB'],
  ['web ink', '--ink: #15162C'],
  ['web action green', '--green-600: #278326'],
]) if (!webCSS.includes(needle)) failures.push('Web screenshot mismatch: ' + name);
for (const label of ['Mon jeton','Déposer','Retirer','Envoyer','Tontines','Biens','Coffres','E-caisse','Projets','Challenges','Contrats','Historique','À payer','Mon score','Mon prochain pot','Mes tontines']) {
  if (!home.includes(label)) failures.push('Home screen missing: ' + label);
}
const luminance = (hex) => {
  const [r,g,b] = hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return 0.2126*r+0.7152*g+0.0722*b;
};
const ratio = (a,b) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
for (const [name, fg, bg] of [['brand white',expected.white,expected.indigo],['action white',expected.white,expected.greenAction],['text background',expected.text,expected.background]]) {
  if (ratio(fg,bg)<4.5) failures.push('WCAG AA normal text contrast failed: '+name);
}

if (failures.length) {
  console.error('Design handoff checks FAILED:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Design handoff checks passed: ' + Object.keys(tokens.colors).length + ' colors, 5 spacing tokens, 5 text styles and 8 project files.');
  console.log('Scope: static checks only. No visual, accessibility, payment, security or build certification.');
}
