import path from 'node:path';
import { fileURLToPath } from 'node:url';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const env = process.env.NODE_ENV ?? 'development';

/**
 * Configuration refusée en production. Les mécanismes de démonstration ne doivent jamais l'atteindre
 * (audit du 05/10/2026) : paiements simulés (route /simulate), SMS dans la console (code OTP renvoyé), secret faible.
 */
export function productionConfigErrors(e: NodeJS.ProcessEnv): string[] {
  const errors = ['JWT_SECRET', 'PAYMENT_WEBHOOK_SECRET', 'DATABASE_URL', 'KYC_ENCRYPTION_KEY']
    .filter((name) => !e[name]).map((name) => `${name} est obligatoire en production`);
  if ((e.PAYMENT_PROVIDER ?? 'mock') === 'mock') errors.push('PAYMENT_PROVIDER=mock interdit en production');
  if ((e.SMS_PROVIDER ?? 'console').split(',').map((x) => x.trim()).includes('console')) errors.push('SMS_PROVIDER=console interdit en production');
  if (e.JWT_SECRET && e.JWT_SECRET.length < 32) errors.push('JWT_SECRET doit faire au moins 32 caractères en production');
  if (e.OTP_DEV_ECHO === 'true') errors.push('OTP_DEV_ECHO interdit en production');
  return errors;
}

if (env === 'production') {
  const errors = productionConfigErrors(process.env);
  if (errors.length) throw new Error(`Configuration de production refusée :\n- ${errors.join('\n- ')}`);
}

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://smarttontine:smarttontine@localhost:5432/smarttontine'),
  jwtSecret: required('JWT_SECRET', 'dev-secret'),
  // Jeton d'accès court ; la session dure via le jeton de renouvellement (30 jours, lib/session.ts).
  accessTtlSeconds: 30 * 60,
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  paymentWebhookSecret: required('PAYMENT_WEBHOOK_SECRET', 'dev-webhook'),
  smsProvider: process.env.SMS_PROVIDER ?? 'console',
  otpTtlMinutes: 5,
  otpMaxAttempts: 3,           // essais par code, puis code invalidé
  otpMaxFailuresPerHour: 10,   // essais ratés par numéro et par heure, tous codes confondus
  // Code OTP renvoyé dans la réponse : développement local seulement, avec le faux fournisseur SMS.
  otpDevEcho: env !== 'production' && (process.env.SMS_PROVIDER ?? 'console') === 'console' && process.env.OTP_DEV_ECHO !== 'false',
  pinMaxAttempts: 5,
  pinLockMinutes: 30,
  // Double authentification obligatoire pour le back-office (toujours en production, sauf ADMIN_MFA_REQUIRED=false explicite).
  adminMfaRequired: (process.env.ADMIN_MFA_REQUIRED ?? (env === 'production' ? 'true' : 'false')) === 'true',
  // Plateforme web (build Vite) servie par l'API si le dossier existe ; sinon hébergée à part (CDN).
  webDist: process.env.WEB_DIST ?? '',
};

// Racine du projet, que le code tourne depuis src/ (tsx) ou dist/src/ (build).
const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, path.basename(path.dirname(here)) === 'dist' ? '../..' : '..');
