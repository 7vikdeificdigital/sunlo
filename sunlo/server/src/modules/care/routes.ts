import { Router } from 'express';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { moodCheckins, notifications, scheduledCalls, users, vendors, wallets } from '../../db/schema';
import { decryptField, encryptField } from '../../lib/crypto';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../../lib/errors';
import { pushToUser } from '../../lib/push';
import { emitToUser } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { body, idParam, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { istNow } from '../compliance/jobs';
import { requestSession } from '../sessions/service';
import { visibleVendor } from '../vendors/service';

/** Trendy "care" features: call schedule karna + roz ka mood check-in */
export const careRouter = Router();

async function notify(userId: string, title: string, bodyText: string, data: Record<string, string>) {
  await db.insert(notifications).values({ userId, title, body: bodyText, data });
  emitToUser(userId, 'notification', { title, body: bodyText, data });
  void pushToUser(userId, { title, body: bodyText, data });
}

const fmt = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const OPEN = ['PENDING', 'CONFIRMED'];
const rateOf = (v: typeof vendors.$inferSelect, t: 'CHAT' | 'AUDIO' | 'VIDEO') => (t === 'CHAT' ? v.chatRatePerMin : t === 'AUDIO' ? v.callRatePerMin : v.videoRatePerMin);

// ======================= Call schedule (user) =======================

careRouter.post('/scheduled-calls', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const input = body(
    req,
    z.object({
      vendorId: z.string().uuid(),
      type: z.enum(['CHAT', 'AUDIO', 'VIDEO']),
      scheduledAt: z.string().datetime({ offset: true }),
      durationMin: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
      note: z.string().trim().max(200).optional(),
    }),
  );
  const at = new Date(input.scheduledAt);
  const now = Date.now();
  if (at.getTime() < now + 30 * 60_000) throw badRequest('TOO_SOON', 'Kam se kam 30 minute baad ka samay chunein');
  if (at.getTime() > now + 14 * 86400_000) throw badRequest('TOO_FAR', '14 din ke andar ka samay chunein');
  const st = await getSettings();
  if (input.type === 'VIDEO' && !st.videoCallsEnabled) throw new HttpError(403, 'FEATURE_OFF', 'Video call abhi band hai');

  const [v] = await db.select().from(vendors).where(and(eq(vendors.id, input.vendorId), visibleVendor)).limit(1);
  if (!v) throw notFound('Profile');
  if (v.userId === userId) throw badRequest('SELF_SESSION', 'Apne aap se call nahi ho sakti');
  const enabled = input.type === 'CHAT' ? v.chatEnabled : input.type === 'AUDIO' ? v.callEnabled : v.videoEnabled;
  if (!enabled) throw badRequest('SERVICE_DISABLED', 'Yeh abhi yeh seva nahi de rahe');
  const [blocked] = await db.execute(sql`select 1 from user_blocks where user_id = ${userId} and vendor_id = ${v.id} limit 1`).then((r) => r.rows);
  if (blocked) throw forbidden('Aapne inhe block kiya hai');

  const [{ mine }] = await db
    .select({ mine: sql<number>`count(*)::int` })
    .from(scheduledCalls)
    .where(and(eq(scheduledCalls.userId, userId), inArray(scheduledCalls.status, OPEN), gte(scheduledCalls.scheduledAt, new Date(now - 3600_000))));
  if (mine >= 3) throw conflict('TOO_MANY_BOOKINGS', 'Ek saath 3 se zyada booking nahi. Pehle wali poori ya cancel karein');

  // Listener ka samay pehle se booked to nahi?
  const end = new Date(at.getTime() + input.durationMin * 60_000);
  const [clash] = await db
    .select({ id: scheduledCalls.id })
    .from(scheduledCalls)
    .where(
      and(
        eq(scheduledCalls.vendorId, v.id),
        inArray(scheduledCalls.status, OPEN),
        sql`${scheduledCalls.scheduledAt} < ${end.toISOString()}::timestamptz`,
        sql`${scheduledCalls.scheduledAt} + make_interval(mins => ${scheduledCalls.durationMin}) > ${at.toISOString()}::timestamptz`,
      ),
    )
    .limit(1);
  if (clash) throw conflict('SLOT_TAKEN', 'Is samay listener pehle se booked hain. Doosra samay chunein');

  const [row] = await db
    .insert(scheduledCalls)
    .values({ userId, vendorId: v.id, type: input.type, scheduledAt: at, durationMin: input.durationMin, note: input.note })
    .returning();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  await notify(v.userId, 'Nayi call booking', `${u?.name?.split(' ')[0] ?? 'Ek user'} ne ${fmt(at)} (${input.durationMin} min) book kiya hai. Confirm karein`, { type: 'scheduled_call', id: row.id });

  const rate = rateOf(v, input.type);
  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  res.status(201).json({ ...row, estimatedCost: rate * input.durationMin, ratePerMin: rate, balance: w?.balance ?? 0, balanceEnough: (w?.balance ?? 0) >= rate * input.durationMin });
});

careRouter.get('/scheduled-calls', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const rows = await db
    .select({ c: scheduledCalls, vendorName: vendors.displayName, vendorAvatar: vendors.avatarUrl, isOnline: vendors.isOnline })
    .from(scheduledCalls)
    .innerJoin(vendors, eq(vendors.id, scheduledCalls.vendorId))
    .where(and(eq(scheduledCalls.userId, userId), gte(scheduledCalls.scheduledAt, new Date(Date.now() - 7 * 86400_000))))
    .orderBy(asc(scheduledCalls.scheduledAt))
    .limit(50);
  res.json({ items: rows.map((r) => ({ ...r.c, vendor: { id: r.c.vendorId, displayName: r.vendorName, avatarUrl: r.vendorAvatar, isOnline: r.isOnline }, canStart: canStart(r.c) })) });
});

/** Booked samay se 10 minute pehle se lekar duration khatam hone tak "Shuru karein" */
function canStart(c: typeof scheduledCalls.$inferSelect, now = Date.now()) {
  return c.status === 'CONFIRMED' && now >= c.scheduledAt.getTime() - 10 * 60_000 && now <= c.scheduledAt.getTime() + c.durationMin * 60_000;
}

careRouter.post('/scheduled-calls/:id/start', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  const [c] = await db.select().from(scheduledCalls).where(and(eq(scheduledCalls.id, id), eq(scheduledCalls.userId, userId))).limit(1);
  if (!c) throw notFound('Booking');
  if (!canStart(c)) throw conflict('NOT_TIME_YET', c.status === 'CONFIRMED' ? 'Booked samay se 10 minute pehle shuru kar sakte hain' : 'Yeh booking ab shuru nahi ho sakti');
  const session = await requestSession(userId, { vendorId: c.vendorId, type: c.type, intake: { topic: 'Booked call', ...(c.note ? { note: c.note } : {}) }, pricingAck: true, scheduledCallId: c.id });
  await db.update(scheduledCalls).set({ sessionId: session.id }).where(eq(scheduledCalls.id, c.id));
  res.status(201).json({ session });
});

careRouter.post('/scheduled-calls/:id/cancel', async (req, res) => {
  const actorId = authId(req);
  const { id } = params(req, idParam);
  const [row] = await db
    .select({ c: scheduledCalls, vendorUserId: vendors.userId })
    .from(scheduledCalls)
    .innerJoin(vendors, eq(vendors.id, scheduledCalls.vendorId))
    .where(eq(scheduledCalls.id, id))
    .limit(1);
  if (!row || (row.c.userId !== actorId && row.vendorUserId !== actorId)) throw notFound('Booking');
  const [up] = await db
    .update(scheduledCalls)
    .set({ status: 'CANCELLED' })
    .where(and(eq(scheduledCalls.id, id), inArray(scheduledCalls.status, OPEN)))
    .returning();
  if (!up) throw conflict('INVALID_STATE', 'Yeh booking ab cancel nahi ho sakti');
  const other = actorId === row.c.userId ? row.vendorUserId : row.c.userId;
  await notify(other, 'Booking cancel hui', `${fmt(row.c.scheduledAt)} wali call cancel ho gayi`, { type: 'scheduled_call', id });
  res.json(up);
});

// ======================= Call schedule (vendor) =======================

async function myVendorId(userId: string) {
  const [v] = await db.select({ id: vendors.id, status: vendors.status }).from(vendors).where(eq(vendors.userId, userId)).limit(1);
  if (!v || v.status !== 'APPROVED') throw forbidden('Aapki profile abhi approved nahi hai');
  return v.id;
}

careRouter.get('/vendor/scheduled-calls', requireRole('VENDOR'), async (req, res) => {
  const vendorId = await myVendorId(authId(req));
  const rows = await db
    .select({ c: scheduledCalls, userName: users.name })
    .from(scheduledCalls)
    .innerJoin(users, eq(users.id, scheduledCalls.userId))
    .where(and(eq(scheduledCalls.vendorId, vendorId), gte(scheduledCalls.scheduledAt, new Date(Date.now() - 7 * 86400_000))))
    .orderBy(asc(scheduledCalls.scheduledAt))
    .limit(100);
  // Vendor ko user ka sirf pehla naam
  res.json({ items: rows.map((r) => ({ ...r.c, userName: r.userName?.split(' ')[0] ?? 'User' })) });
});

careRouter.post('/vendor/scheduled-calls/:id/confirm', requireRole('VENDOR'), async (req, res) => {
  const vendorId = await myVendorId(authId(req));
  const { id } = params(req, idParam);
  const [up] = await db
    .update(scheduledCalls)
    .set({ status: 'CONFIRMED' })
    .where(and(eq(scheduledCalls.id, id), eq(scheduledCalls.vendorId, vendorId), eq(scheduledCalls.status, 'PENDING')))
    .returning();
  if (!up) throw conflict('INVALID_STATE', 'Yeh booking ab confirm nahi ho sakti');
  await notify(up.userId, 'Booking confirm ✅', `Aapki call ${fmt(up.scheduledAt)} par pakki. 10 minute pehle yaad dilayenge`, { type: 'scheduled_call', id });
  res.json(up);
});

careRouter.post('/vendor/scheduled-calls/:id/decline', requireRole('VENDOR'), async (req, res) => {
  const vendorId = await myVendorId(authId(req));
  const { id } = params(req, idParam);
  const { reason } = body(req, z.object({ reason: z.string().trim().max(200).optional() }));
  const [up] = await db
    .update(scheduledCalls)
    .set({ status: 'DECLINED', declineReason: reason ?? null })
    .where(and(eq(scheduledCalls.id, id), eq(scheduledCalls.vendorId, vendorId), eq(scheduledCalls.status, 'PENDING')))
    .returning();
  if (!up) throw conflict('INVALID_STATE', 'Yeh booking ab decline nahi ho sakti');
  await notify(up.userId, 'Listener us samay free nahi', reason ? `Wajah: ${reason}. Doosra samay chunein` : 'Doosra samay chunein', { type: 'scheduled_call', id });
  res.json(up);
});

// ======================= Mood check-in =======================

const MOOD_LABEL = ['', 'Bahut bura', 'Thoda bura', 'Theek-thaak', 'Achha', 'Bahut achha'];

careRouter.post('/checkins', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { mood, note } = body(req, z.object({ mood: z.number().int().min(1).max(5), note: z.string().trim().max(200).optional() }));
  const { day } = istNow();
  const noteEnc = note ? encryptField(note) : null;
  const [row] = await db
    .insert(moodCheckins)
    .values({ userId, day, mood, noteEnc })
    .onConflictDoUpdate({ target: [moodCheckins.userId, moodCheckins.day], set: { mood, noteEnc } })
    .returning();
  res.status(201).json({ day: row.day, mood: row.mood, label: MOOD_LABEL[row.mood], ...(await summary(userId)) });
});

careRouter.get('/checkins', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { days } = query(req, z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }));
  const { day } = istNow();
  const from = new Date(new Date(`${day}T00:00:00Z`).getTime() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(moodCheckins)
    .where(and(eq(moodCheckins.userId, userId), gte(moodCheckins.day, from)))
    .orderBy(desc(moodCheckins.day));
  const items = rows.map((r) => ({ day: r.day, mood: r.mood, label: MOOD_LABEL[r.mood], note: r.noteEnc ? safeDecrypt(r.noteEnc) : null }));
  const [u] = await db.select({ reminder: users.checkinReminder }).from(users).where(eq(users.id, userId)).limit(1);
  res.json({ items, today: day, checkedInToday: rows.some((r) => r.day === day), reminder: u?.reminder ?? false, ...(await summary(userId)) });
});

careRouter.delete('/checkins', requireRole('USER'), async (req, res) => {
  await db.delete(moodCheckins).where(eq(moodCheckins.userId, authId(req)));
  res.json({ ok: true });
});

function safeDecrypt(v: string) {
  try {
    return decryptField(v);
  } catch {
    return null;
  }
}

/** Streak (lagaatar din), 7 din ka ausat, aur lagaatar udaas din hon to narmi se baat karne / helpline ka sujhav */
async function summary(userId: string) {
  const rows = await db
    .select({ day: moodCheckins.day, mood: moodCheckins.mood })
    .from(moodCheckins)
    .where(eq(moodCheckins.userId, userId))
    .orderBy(desc(moodCheckins.day))
    .limit(120);
  const { day: today } = istNow();
  const dayNum = (d: string) => Math.round(new Date(`${d}T00:00:00Z`).getTime() / 86400_000);
  const t = dayNum(today);
  let streak = 0;
  let expect = rows[0] && dayNum(rows[0].day) === t ? t : t - 1; // aaj nahi kiya to kal tak ki streak
  for (const r of rows) {
    if (dayNum(r.day) === expect) {
      streak++;
      expect--;
    } else break;
  }
  const last7 = rows.filter((r) => dayNum(r.day) > t - 7);
  const avg7 = last7.length ? Math.round((last7.reduce((a, b) => a + b.mood, 0) / last7.length) * 10) / 10 : null;
  const recent = rows.slice(0, 3);
  const lowStreak = recent.length === 3 && recent.every((r) => r.mood <= 2) && dayNum(recent[2].day) >= t - 3;
  return {
    streak,
    avg7,
    suggestion: lowStreak
      ? {
          kind: 'talk',
          text: 'Kuch din se mann bhaari lag raha hai. Kisi se baat karna madad karta hai: ek listener abhi online hai. Bahut mushkil lage to Tele-MANAS 14416 (muft, 24x7) par call karein.',
          helpline: { name: 'Tele-MANAS', phone: '14416' },
        }
      : null,
  };
}
