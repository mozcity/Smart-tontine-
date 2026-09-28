import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { errorHandler, notFound } from './lib/errors.js';
import { requireAuth, requireRole } from './lib/auth.js';
import { pricing } from './pricing.js';
import { projectRoot } from './config.js';
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
import { router as webhooks } from './modules/webhooks.js';
import { router as tontines } from './modules/tontine.js';
import { router as credit } from './modules/credit.js';
import { router as partners } from './modules/partners.js';
import { router as goods } from './modules/goods.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  // Le corps brut est conservé pour vérifier la signature HMAC des webhooks.
  app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } }));

  app.get('/health', (_req, res) => { res.json({ ok: true, service: 'smart-tontine-api' }); });
  app.get('/pricing', (_req, res) => { res.json(pricing); });

  app.use('/auth', auth);
  app.use('/webhooks', webhooks);
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
  app.use('/me', requireAuth, account);
  app.use('/admin/api', requireAuth, requireRole('support', 'admin'), admin);
  app.use('/admin', express.static(path.join(projectRoot, 'public', 'admin')));

  app.use((_req, _res, next) => next(notFound('Route')));
  app.use(errorHandler);
  return app;
}
