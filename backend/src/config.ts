import path from 'node:path';
import { fileURLToPath } from 'node:url';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const env = process.env.NODE_ENV ?? 'development';

if (env === 'production') {
  for (const name of ['JWT_SECRET', 'PAYMENT_WEBHOOK_SECRET', 'DATABASE_URL']) {
    if (!process.env[name]) throw new Error(`${name} est obligatoire en production`);
  }
}

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://smarttontine:smarttontine@localhost:5432/smarttontine'),
  jwtSecret: required('JWT_SECRET', 'dev-secret'),
  jwtTtl: '30d',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  paymentWebhookSecret: required('PAYMENT_WEBHOOK_SECRET', 'dev-webhook'),
  smsProvider: process.env.SMS_PROVIDER ?? 'console',
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,
  pinMaxAttempts: 5,
  pinLockMinutes: 30,
  // Plateforme web (build Vite) servie par l'API si le dossier existe ; sinon hébergée à part (CDN).
  webDist: process.env.WEB_DIST ?? '',
};

// Racine du projet, que le code tourne depuis src/ (tsx) ou dist/src/ (build).
const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, path.basename(path.dirname(here)) === 'dist' ? '../..' : '..');
