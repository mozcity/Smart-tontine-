import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(secret, salt, 32).toString('hex')}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(secret, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function referralCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function reference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function hmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
