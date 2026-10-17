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
if (failures.length) {
  console.error('Design handoff checks FAILED:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Design handoff checks passed: ' + Object.keys(tokens.colors).length + ' colors, 5 spacing tokens, 5 text styles and 8 project files.');
  console.log('Scope: static checks only. No visual, accessibility, payment, security or build certification.');
}
