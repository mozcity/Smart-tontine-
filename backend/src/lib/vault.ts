import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

// Chiffrement au repos des pièces d'identité (audit du 05/10/2026) : AES-256-GCM, clé KYC_ENCRYPTION_KEY
// (obligatoire en production). Le préfixe « enc:v1: » distingue les valeurs chiffrées des anciennes en clair.
const PREFIX = 'enc:v1:';
const key = () => createHash('sha256').update(process.env.KYC_ENCRYPTION_KEY ?? `kyc:${config.jwtSecret}`).digest();

export function seal(value: string): string;
export function seal(value: string | null | undefined): string | null;
export function seal(value: string | null | undefined): string | null {
  if (value == null) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return PREFIX + [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function unseal(value: string | null | undefined): string | null {
  if (value == null || !value.startsWith(PREFIX)) return value ?? null;
  const [iv, tag, enc] = value.slice(PREFIX.length).split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
