import { Router } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { deviceTokens, refreshTokens, users, vendors, wallets } from '../../db/schema';
import { notFound } from '../../lib/errors';
import { body } from '../../lib/validate';
import { authId } from '../../middleware/auth';
import { publicUser } from '../auth/service';

export const usersRouter = Router();

usersRouter.get('/me', async (req, res) => {
  const id = authId(req);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) throw notFound('User');
  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, id)).limit(1);
  res.json({ user: publicUser(u), walletBalance: w?.balance ?? 0 });
});

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    email: z.string().trim().toLowerCase().email().max(120).nullable(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    language: z.enum(['en', 'hi']),
    ageConfirmed: z.literal(true), // "Main 18 saal ya usse bada hoon"
  })
  .partial()
  .strict(); // role, status, phone jaise fields user khud kabhi nahi badal sakta

usersRouter.patch('/me', async (req, res) => {
  const id = authId(req);
  const { ageConfirmed, ...data } = body(req, profileSchema);
  const [u] = await db
    .update(users)
    .set({ ...data, ...(ageConfirmed ? { ageConfirmedAt: new Date() } : {}) })
    .where(eq(users.id, id))
    .returning();
  res.json({ user: publicUser(u) });
});

/** Account delete: personal jaankari hata di jaati hai, wallet/payment ka hisaab-kitaab record rehta hai */
usersRouter.delete('/me', async (req, res) => {
  const id = authId(req);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ phone: null, email: null, name: null, avatarUrl: null, deletedAt: new Date() })
      .where(eq(users.id, id));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
    await tx.delete(deviceTokens).where(eq(deviceTokens.userId, id));
    // Vendor ho to profile turant band
    await tx.update(vendors).set({ isOnline: false, status: 'SUSPENDED' }).where(eq(vendors.userId, id));
  });
  res.json({ ok: true });
});

/** Push notification ke liye device token (FCM) */
usersRouter.post('/me/devices', async (req, res) => {
  const id = authId(req);
  const { token, platform } = body(req, z.object({ token: z.string().min(10).max(4096), platform: z.enum(['android', 'ios', 'web']) }));
  await db
    .insert(deviceTokens)
    .values({ userId: id, token, platform })
    .onConflictDoUpdate({ target: deviceTokens.token, set: { userId: id, platform } });
  res.json({ ok: true });
});
