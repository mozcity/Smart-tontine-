import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { errorHandler, notFound } from './lib/errors.js';
import { requireAuth, requireMfa, requireRole } from './lib/auth.js';
import { pricing } from './pricing.js';
import { config, projectRoot } from './config.js';
import { rateLimit } from './lib/rateLimit.js';
import { router as auth } from './modules/auth.js';
import { router as wallet } from './modules/wallet.js';
import { router as ecaisse } from './modules/ecaisse.js';
import { router as cagnotte } from './modules/cagnotte.js';
import { router as budget } from './modules/budget.js';
import { router as projets } from './modules/projets.js';
import { router as challenges } from './modules/challenges.js';
import { router as contrats } from './modules/contrats.js';
import { router as account } from './modules/account.js';
import { router as admin } from './modules/admin.js';
import { router as devTools } from './modules/dev.js';
import { router as webhooks } from './modules/webhooks.js';
import { router as tontines } from './modules/tontine.js';
import { router as credit } from './modules/credit.js';
import { router as partners } from './modules/partners.js';
import { router as goods } from './modules/goods.js';
import { router as publicApi } from './modules/public.js';
import { router as kyc } from './modules/kyc.js';

/** Politique de sécurité du contenu, reprise à l'identique par nginx (web/security-headers.conf). */
/** Pages de l'application web (même liste que web/nginx.conf). */
export const SPA_ROUTES = /^\/(?:|decouvrir|tarifs|devenir-partenaire|connexion|legal|confidentialite|suppression-compte|partenaires(?:\/[^/]+)?|rejoindre\/[^/]+|app(?:\/.*)?|partenaire(?:\/.*)?)\/?$/;

export const CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Derrière le reverse proxy (TLS), l'adresse du client vient de X-Forwarded-For.
  app.set('trust proxy', 1);
  const limitsOn = config.env !== 'test';
  // CSP stricte : aucun script en ligne ni externe (back-office et plateforme web servis par l'API).
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: CSP },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
  }));
  // Les jetons voyagent dans l'en-tête Authorization (pas de cookie) ; en production, origines limitées à CORS_ORIGINS.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors(origins.length ? { origin: origins, credentials: true } : undefined));
  // Le corps brut est conservé pour vérifier la signature HMAC des webhooks.
  // Corps plus gros (jusqu'à 2 Mo) seulement là où l'on envoie des photos : dossier KYC, logos, biens.
  app.use(['/me/kyc', '/partners', '/goods'], express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } }));

  app.get('/health', (_req, res) => { res.json({ ok: true, service: 'smart-tontine-api' }); });
  app.get('/pricing', (_req, res) => { res.json(pricing); });

  app.use('/public', rateLimit({ name: 'public', windowMs: 60_000, max: 120, enabled: limitsOn }), publicApi);
  // Vérification OTP : 10 essais par minute et par adresse IP, en plus des limites par numéro.
  app.use('/auth/otp/verify', rateLimit({ name: 'otp-verify', windowMs: 60_000, max: 10, enabled: limitsOn }));
  app.use('/auth', rateLimit({ name: 'auth', windowMs: 60_000, max: 30, enabled: limitsOn }), auth);
  app.use('/webhooks/sms/twilio', express.urlencoded({ extended: false, limit: '20kb' }));
  app.use('/webhooks', rateLimit({ name: 'webhooks', windowMs: 60_000, max: 300, enabled: limitsOn }), webhooks);
  app.use('/wallet', requireAuth, wallet);
  app.use('/ecaisses', requireAuth, ecaisse);
  app.use('/tontines', requireAuth, tontines);
  app.use('/credit', requireAuth, credit);
  app.use('/partners', requireAuth, partners);
  app.use('/goods', requireAuth, goods);
  app.use('/cagnottes', requireAuth, cagnotte);
  app.use('/budget', requireAuth, budget);
  app.use('/projets', requireAuth, projets);
  app.use('/challenges', requireAuth, challenges);
  app.use('/contrats', requireAuth, contrats);
  app.use('/me/kyc', requireAuth, kyc);
  app.use('/me', requireAuth, account);
  app.use('/admin/api', requireAuth, requireRole('support', 'admin'), requireMfa, admin);
  // Outillage de démonstration (impayé, avance) : absent du build de production.
  if (!config.isProd) app.use('/dev', requireAuth, devTools);
  app.use('/admin', express.static(path.join(projectRoot, 'public', 'admin')));

  // Plateforme web (site public, espace membre, portail partenaire) : build Vite servi par l'API
  // sur le même domaine, avec repli sur index.html pour les routes de l'application monopage.
  const webDist = config.webDist ? path.resolve(config.webDist) : path.join(projectRoot, '..', 'web', 'dist');
  if (existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    // Routes connues de l'application → 200 ; toute autre page → index.html avec un vrai statut 404 (pas de « soft 404 »).
    app.get(/^\/(?!(?:auth|wallet|tontines|credit|partners|goods|cagnottes|budget|projets|challenges|contrats|me|admin|public|webhooks|health|pricing|dev)(?:\/|$)).*/,
      (req, res, next) => (req.accepts('html')
        ? res.status(SPA_ROUTES.test(req.path) ? 200 : 404).sendFile(path.join(webDist, 'index.html'))
        : next()));
  }

  app.use((_req, _res, next) => next(notFound('Route')));
  app.use(errorHandler);
  return app;
}
