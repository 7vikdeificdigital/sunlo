import { Router } from 'express';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  chatMessages,
  consultSessions,
  deviceTokens,
  moodCheckins,
  payments,
  refreshTokens,
  reviews,
  scheduledCalls,
  supportTickets,
  users,
  vendors,
  walletTransactions,
  wallets,
} from '../../db/schema';
import { decryptField } from '../../lib/crypto';
import { badRequest, HttpError, notFound } from '../../lib/errors';
import { getSettings } from '../../lib/settings';
import { body } from '../../lib/validate';
import { authId } from '../../middleware/auth';
import { publicUser } from '../auth/service';

export const usersRouter = Router();

usersRouter.get('/me', async (req, res) => {
  const id = authId(req);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) throw notFound('User');
  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, id)).limit(1);
  const s = await getSettings();
  res.json({ user: publicUser(u), walletBalance: w?.balance ?? 0, needsConsent: u.consentVersion !== s.policyVersion, needsDob: !u.dateOfBirth });
});

/** IST ke hisaab se aaj ki umar (saal) */
export function ageOn(dob: string, now = new Date()) {
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Janm-tithi YYYY-MM-DD mein')
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Janm-tithi sahi nahi hai')
  .refine((v) => Number(v.slice(0, 4)) >= 1900, 'Janm-tithi sahi nahi hai');

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    email: z.string().trim().toLowerCase().email().max(120).nullable(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    language: z.enum(['en', 'hi']),
    ageConfirmed: z.literal(true), // "Main 18 saal ya usse bada hoon"
    dateOfBirth: dobSchema, // DPDP: sirf checkbox kaafi nahi, janm-tithi se 18+ ki jaanch
    checkinReminder: z.boolean(), // roz raat mood check-in ki yaad (user ki marzi)
  })
  .partial()
  .strict(); // role, status, phone jaise fields user khud kabhi nahi badal sakta

usersRouter.patch('/me', async (req, res) => {
  const id = authId(req);
  const { ageConfirmed, dateOfBirth, ...data } = body(req, profileSchema);
  if (dateOfBirth && ageOn(dateOfBirth) < 18) {
    // Naabaalig ki janm-tithi save nahi karte; app sirf 18+ ke liye hai
    throw new HttpError(403, 'AGE_BELOW_18', 'Bondty sirf 18 saal ya usse bade logon ke liye hai');
  }
  const [u] = await db
    .update(users)
    .set({ ...data, ...(dateOfBirth ? { dateOfBirth } : {}), ...(ageConfirmed || dateOfBirth ? { ageConfirmedAt: new Date() } : {}) })
    .where(eq(users.id, id))
    .returning();
  res.json({ user: publicUser(u) });
});

// ---------------- DPDP: sahmati (consent) ----------------

/** Privacy notice padh kar sahmati: app current policyVersion bhejti hai */
usersRouter.post('/me/consent', async (req, res) => {
  const id = authId(req);
  const { version } = body(req, z.object({ version: z.string().trim().min(2).max(20) }));
  const s = await getSettings();
  if (version !== s.policyVersion) throw badRequest('OLD_POLICY', 'Naya privacy notice aaya hai. App refresh karke dobara padhein');
  const [u] = await db.update(users).set({ consentVersion: version, consentAt: new Date() }).where(eq(users.id, id)).returning();
  res.json({ user: publicUser(u) });
});

/**
 * Account delete / sahmati wapas lena: personal jaankari hata di jaati hai.
 * Wallet, payment aur TDS ka hisaab-kitaab kanoon ke liye record mein rehta hai (bina naam/phone ke).
 */
async function eraseAccount(id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        phone: null,
        email: null,
        name: null,
        avatarUrl: null,
        dateOfBirth: null,
        totpSecretEnc: null,
        totpEnabledAt: null,
        checkinReminder: false,
        deletedAt: new Date(),
      })
      .where(eq(users.id, id));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
    await tx.delete(deviceTokens).where(eq(deviceTokens.userId, id));
    await tx.delete(moodCheckins).where(eq(moodCheckins.userId, id));
    await tx
      .update(scheduledCalls)
      .set({ status: 'CANCELLED' })
      .where(and(eq(scheduledCalls.userId, id), inArray(scheduledCalls.status, ['PENDING', 'CONFIRMED'])));
    // Vendor ho to profile turant band
    await tx.update(vendors).set({ isOnline: false, status: 'SUSPENDED' }).where(eq(vendors.userId, id));
  });
}

usersRouter.delete('/me', async (req, res) => {
  await eraseAccount(authId(req));
  res.json({ ok: true });
});

/** DPDP: sahmati wapas = data processing band = account aur personal data mitana */
usersRouter.post('/me/consent/withdraw', async (req, res) => {
  body(req, z.object({ confirm: z.literal(true) }));
  await eraseAccount(authId(req));
  res.json({ ok: true, erased: true });
});

/** DPDP: "mera data mujhe do" — apni saari jaankari ek JSON file mein */
usersRouter.get('/me/export', async (req, res) => {
  const id = authId(req);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) throw notFound('User');
  const [w] = await db.select().from(wallets).where(eq(wallets.userId, id)).limit(1);
  const since = new Date(Date.now() - 365 * 86400_000);
  const [txns, pays, sess, revs, tickets, moods, calls] = await Promise.all([
    w
      ? db
          .select({ type: walletTransactions.type, amount: walletTransactions.amount, balanceAfter: walletTransactions.balanceAfter, note: walletTransactions.note, createdAt: walletTransactions.createdAt })
          .from(walletTransactions)
          .where(eq(walletTransactions.walletId, w.id))
          .orderBy(desc(walletTransactions.createdAt))
          .limit(5000)
      : Promise.resolve([]),
    db
      .select({ amount: payments.amount, bonus: payments.bonus, gst: payments.gstAmount, total: payments.totalPayable, status: payments.status, provider: payments.provider, paidAt: payments.paidAt, createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.userId, id))
      .orderBy(desc(payments.createdAt))
      .limit(2000),
    db
      .select({ id: consultSessions.id, type: consultSessions.type, status: consultSessions.status, listener: vendors.displayName, requestedAt: consultSessions.requestedAt, billedSeconds: consultSessions.billedSeconds, charged: consultSessions.chargedAmount, free: consultSessions.promoAmount, refunded: consultSessions.refundedAmount })
      .from(consultSessions)
      .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
      .where(eq(consultSessions.userId, id))
      .orderBy(desc(consultSessions.requestedAt))
      .limit(2000),
    db.select({ rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt }).from(reviews).where(eq(reviews.userId, id)).limit(2000),
    db.select({ subject: supportTickets.subject, category: supportTickets.category, status: supportTickets.status, createdAt: supportTickets.createdAt }).from(supportTickets).where(eq(supportTickets.userId, id)).limit(500),
    db.select().from(moodCheckins).where(eq(moodCheckins.userId, id)).orderBy(desc(moodCheckins.day)).limit(1000),
    db.select({ type: scheduledCalls.type, scheduledAt: scheduledCalls.scheduledAt, status: scheduledCalls.status }).from(scheduledCalls).where(eq(scheduledCalls.userId, id)).limit(500),
  ]);
  // Sirf apne bheje messages (doosre vendor ke shabd unka data hain), pichhle 1 saal ke
  const myMessages = await db
    .select({ sessionId: chatMessages.sessionId, body: chatMessages.body, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(and(eq(chatMessages.senderId, id), gt(chatMessages.createdAt, since)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(5000);
  res.setHeader('Content-Disposition', `attachment; filename="bondty-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    exportedAt: new Date(),
    profile: { ...publicUser(u) },
    wallet: { balance: w?.balance ?? 0, transactions: txns },
    payments: pays,
    sessions: sess,
    myChatMessages: myMessages,
    reviews: revs,
    supportTickets: tickets,
    moodCheckins: moods.map((m) => ({ day: m.day, mood: m.mood, note: m.noteEnc ? safeDecrypt(m.noteEnc) : null })),
    scheduledCalls: calls,
  });
});

function safeDecrypt(v: string) {
  try {
    return decryptField(v);
  } catch {
    return null;
  }
}

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

/** Logout par: is phone par ab is user ki push na aaye */
usersRouter.delete('/me/devices', async (req, res) => {
  const id = authId(req);
  const { token } = body(req, z.object({ token: z.string().min(10).max(4096) }));
  await db.delete(deviceTokens).where(and(eq(deviceTokens.userId, id), eq(deviceTokens.token, token)));
  res.json({ ok: true });
});
