import { Router } from 'express';
import { asc, eq, sql } from 'drizzle-orm';
import agora from 'agora-token';

const { RtcRole, RtcTokenBuilder } = agora;
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { vendors, chatMessages, reviews } from '../../db/schema';
import { numericUid } from '../../lib/crypto';
import { badRequest, conflict, unavailable } from '../../lib/errors';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import * as svc from './service';

export const sessionsRouter = Router();

const intakeSchema = z
  .object({
    topic: z.string().trim().max(60).optional(), // jaise "Career", "Rishte"
    note: z.string().trim().max(500).optional(), // pehle se batana ho to
  })
  .strict();

// ---- User ----
sessionsRouter.post('/sessions', requireRole('USER'), async (req, res) => {
  const input = body(
    req,
    z.object({ vendorId: z.string().uuid(), type: z.enum(['CHAT', 'AUDIO', 'VIDEO']), intake: intakeSchema.optional() }),
  );
  res.status(201).json(await svc.requestSession(authId(req), input));
});

sessionsRouter.get('/sessions', requireRole('USER'), async (req, res) => {
  const q = query(req, pagination.extend({ type: z.enum(['CHAT', 'AUDIO', 'VIDEO']).optional() }));
  res.json({ items: await svc.userSessions(authId(req), q.type, q.page, q.limit), page: q.page, limit: q.limit });
});

sessionsRouter.get('/sessions/open', requireRole('USER'), async (req, res) => {
  res.json({ session: await svc.openSessionForUser(authId(req)) });
});

sessionsRouter.post('/sessions/:id/cancel', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.cancelByUser(authId(req), id));
});

sessionsRouter.post('/sessions/:id/review', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  const { rating, comment } = body(req, z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }));
  const { session } = await svc.getParticipantSession(userId, id);
  if (session.userId !== userId) throw badRequest('NOT_ALLOWED', 'Sirf customer review de sakta hai');
  if (session.status !== 'COMPLETED' || session.billedSeconds <= 0) throw conflict('INVALID_STATE', 'Poora hua session hi review ho sakta hai');
  await db.transaction(async (tx) => {
    const ins = await tx
      .insert(reviews)
      .values({ sessionId: id, userId, vendorId: session.vendorId, rating, comment })
      .onConflictDoNothing()
      .returning();
    if (!ins.length) throw conflict('ALREADY_REVIEWED', 'Is session ka review pehle de chuke hain');
    await tx
      .update(vendors)
      .set({
        ratingAvg: sql`(${vendors.ratingAvg} * ${vendors.ratingCount} + ${rating}) / (${vendors.ratingCount} + 1)`,
        ratingCount: sql`${vendors.ratingCount} + 1`,
      })
      .where(eq(vendors.id, session.vendorId));
  });
  res.status(201).json({ ok: true });
});

// ---- Dono (user + us session ka vendor) ----
sessionsRouter.get('/sessions/:id', async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.getSessionDetail(authId(req), id));
});

sessionsRouter.post('/sessions/:id/end', async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.endSession(authId(req), id));
});

sessionsRouter.get('/sessions/:id/messages', async (req, res) => {
  const { id } = params(req, idParam);
  await svc.getParticipantSession(authId(req), id);
  const items = await db
    .select({ id: chatMessages.id, senderId: chatMessages.senderId, body: chatMessages.body, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt))
    .limit(1000);
  res.json({ items });
});

/** Audio/Video call ke liye Agora token: sirf ACTIVE session ke dono participants ko, session ke samay tak */
sessionsRouter.post('/sessions/:id/rtc-token', async (req, res) => {
  const actorId = authId(req);
  const { id } = params(req, idParam);
  const { session } = await svc.getParticipantSession(actorId, id);
  if (session.type === 'CHAT') throw badRequest('NOT_A_CALL', 'Yeh call session nahi hai');
  if (session.status !== 'ACTIVE' || !session.acceptedAt) throw conflict('INVALID_STATE', 'Call abhi chalu nahi hai');
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) throw unavailable('CALLS_NOT_CONFIGURED', 'Calling service set nahi hai');
  const endsAt = session.acceptedAt.getTime() + (session.maxSeconds ?? 0) * 1000;
  const ttl = Math.max(60, Math.ceil((endsAt - Date.now()) / 1000) + 120);
  const uid = numericUid(actorId);
  const token = RtcTokenBuilder.buildTokenWithUid(env.AGORA_APP_ID, env.AGORA_APP_CERTIFICATE, id, uid, RtcRole.PUBLISHER, ttl, ttl);
  res.json({ appId: env.AGORA_APP_ID, channel: id, uid, token, expiresInSec: ttl });
});

// ---- Vendor ----
export const vendorSessionsRouter = Router();
vendorSessionsRouter.use('/vendor', requireRole('VENDOR'));

vendorSessionsRouter.get('/vendor/sessions/pending', async (req, res) => {
  res.json({ items: await svc.pendingForVendor(authId(req)) });
});
vendorSessionsRouter.post('/vendor/sessions/:id/accept', async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.acceptByVendor(authId(req), id));
});
vendorSessionsRouter.post('/vendor/sessions/:id/reject', async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.rejectByVendor(authId(req), id));
});
