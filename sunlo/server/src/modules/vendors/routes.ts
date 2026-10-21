import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { consultSessions, favorites, reports, reviews, userBlocks, users, vendors } from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { optionalAuth } from '../../middleware/optionalAuth';
import * as svc from './service';

// ----- Public (bina login) -----
export const vendorsPublic = Router();

vendorsPublic.get('/vendors', optionalAuth, async (req, res) => {
  const q = query(
    req,
    pagination.extend({
      service: z.enum(['chat', 'call', 'video']).optional(),
      search: z.string().trim().max(60).optional(),
      categoryId: z.string().uuid().optional(),
      language: z.string().trim().max(30).optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      online: z.enum(['true', 'false']).optional(),
      sort: z.enum(['recommended', 'rating', 'experience', 'price_low', 'price_high']).default('recommended'),
    }),
  );
  res.json(await svc.listVendors({ ...q, onlineOnly: q.online === 'true', viewerId: req.auth?.id }));
});

vendorsPublic.get('/vendors/:id', optionalAuth, async (req, res) => {
  const { id } = params(req, idParam);
  const v = await svc.getVendor(id, req.auth?.id);
  if (!v) throw notFound('Profile');
  res.json(v);
});

vendorsPublic.get('/vendors/:id/reviews', async (req, res) => {
  const { id } = params(req, idParam);
  const { page, limit } = query(req, pagination);
  const items = await db
    .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, reply: reviews.reply, createdAt: reviews.createdAt, userName: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(and(eq(reviews.vendorId, id), eq(reviews.isHidden, false)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ items: items.map((r) => ({ ...r, userName: maskName(r.userName) })), page, limit });
});

export function maskName(name: string | null) {
  if (!name) return 'User';
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}

// ----- User (login zaroori) -----
export const vendorsUserRouter = Router();
vendorsUserRouter.use(['/vendors', '/me/favorites', '/me/blocked', '/reports'], requireRole('USER'));

async function ensureVisible(id: string) {
  const [v] = await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.id, id), svc.visibleVendor)).limit(1);
  if (!v) throw notFound('Profile');
}

vendorsUserRouter.post('/vendors/:id/favorite', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  await ensureVisible(id);
  await db.transaction(async (tx) => {
    const ins = await tx.insert(favorites).values({ userId, vendorId: id }).onConflictDoNothing().returning();
    if (ins.length) await tx.update(vendors).set({ favoritesCount: sql`${vendors.favoritesCount} + 1` }).where(eq(vendors.id, id));
  });
  res.json({ favorite: true });
});

vendorsUserRouter.delete('/vendors/:id/favorite', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  await db.transaction(async (tx) => {
    const del = await tx.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.vendorId, id))).returning();
    if (del.length) await tx.update(vendors).set({ favoritesCount: sql`greatest(${vendors.favoritesCount} - 1, 0)` }).where(eq(vendors.id, id));
  });
  res.json({ favorite: false });
});

vendorsUserRouter.post('/vendors/:id/block', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  await ensureVisible(id);
  await db.insert(userBlocks).values({ userId, vendorId: id }).onConflictDoNothing();
  res.json({ blocked: true });
});

vendorsUserRouter.delete('/vendors/:id/block', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  await db.delete(userBlocks).where(and(eq(userBlocks.userId, userId), eq(userBlocks.vendorId, id)));
  res.json({ blocked: false });
});

vendorsUserRouter.get('/me/favorites', async (req, res) => {
  res.json({ items: await svc.favoritesList(authId(req)) });
});

export const REPORT_REASONS = ['INAPPROPRIATE_BEHAVIOUR', 'ASKED_FOR_MONEY_OR_CONTACT', 'SPAM_OR_FAKE', 'HARASSMENT', 'OTHER'] as const;

/** Vendor ki shikayat: admin panel mein jaati hai */
vendorsUserRouter.post('/reports', async (req, res) => {
  const userId = authId(req);
  const input = body(
    req,
    z.object({
      vendorId: z.string().uuid(),
      sessionId: z.string().uuid().optional(),
      reason: z.enum(REPORT_REASONS),
      details: z.string().trim().max(1000).optional(),
    }),
  );
  const [v] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
  if (!v) throw notFound('Profile');
  if (input.sessionId) {
    const [s] = await db
      .select({ id: consultSessions.id })
      .from(consultSessions)
      .where(and(eq(consultSessions.id, input.sessionId), eq(consultSessions.userId, userId), eq(consultSessions.vendorId, input.vendorId)))
      .limit(1);
    if (!s) throw badRequest('BAD_SESSION', 'Yeh session aapka nahi hai');
  }
  const [r] = await db.insert(reports).values({ reporterId: userId, ...input }).returning({ id: reports.id });
  res.status(201).json({ id: r.id, ok: true });
});
