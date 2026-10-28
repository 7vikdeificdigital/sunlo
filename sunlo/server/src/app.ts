import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isProd } from './config/env';
import { logger } from './lib/logger';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimit';
import { adminRouter } from './modules/admin/routes';
import { authPrivate, authPublic } from './modules/auth/routes';
import { giftsPrivate, giftsPublic } from './modules/gifts/routes';
import { roomsRouter } from './modules/rooms/routes';
import { randomRouter } from './modules/random/routes';
import { miscPrivate, miscPublic } from './modules/misc/routes';
import { sessionsRouter, vendorSessionsRouter } from './modules/sessions/routes';
import { filesPublic, uploadsRouter } from './modules/uploads/routes';
import { usersRouter } from './modules/users/routes';
import { vendorSelfRouter } from './modules/vendor/routes';
import { vendorsPublic, vendorsUserRouter } from './modules/vendors/routes';
import { paymentsPublic, walletRouter } from './modules/wallet/routes';

export const API_PREFIX = '/api/v1';

/**
 * BINA LOGIN wale routers. Naya public route jodne ke liye use yahan jodna padega.
 * Baaki SAB routes neeche `requireAuth` ke peeche hain: default band, khula sirf jaan-boojh kar.
 */
export const publicRouters = [miscPublic, authPublic, vendorsPublic, filesPublic, giftsPublic];

/** LOGIN ZAROORI wale routers (tests inki har route ko bina token check karte hain) */
export { adminRouter };
export const privateRouters = [
  authPrivate,
  usersRouter,
  vendorsUserRouter,
  walletRouter,
  sessionsRouter,
  uploadsRouter,
  miscPrivate,
  vendorSessionsRouter,
  vendorSelfRouter,
  adminRouter,
  giftsPrivate,
  randomRouter,
  roomsRouter,
];

export const corsOrigins = (): string[] | true =>
  env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : isProd ? [] : true;

export function buildApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigins(), credentials: false }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(API_PREFIX, apiLimiter);

  // Razorpay webhook ko raw body chahiye (signature check), isliye JSON parser se pehle
  app.use(API_PREFIX, paymentsPublic);

  // Aam JSON limit 100kb; sirf upload route apna bada limit khud lagata hai
  const json = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path === `${API_PREFIX}/uploads` || /\/admin\/gifts\/[^/]+\/(svga|thumb)$/.test(req.path) ? next() : json(req, res, next)));

  const api = Router();
  for (const r of publicRouters) api.use(r);

  const protectedApi = Router();
  protectedApi.use(requireAuth);
  for (const r of privateRouters) protectedApi.use(r);
  api.use(protectedApi);

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
