import { and, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { chatMessages, notifications, scheduledCalls, settings, users, vendors } from '../../db/schema';
import { logger } from '../../lib/logger';
import { pushToUser, pushToUsers } from '../../lib/push';
import { emitToUser } from '../../lib/realtime';
import { clearSettingsCache, getSettings } from '../../lib/settings';

const DEFAULT_NOTICE_TITLE = 'Bondty ke niyam: ek yaad';
const DEFAULT_NOTICE_BODY =
  'Bondty par ashleel, nafrat bhari, dhamki wali ya kisi ki nijta todne wali baat mana hai. Aisa karne par account band ho sakta hai aur kanooni kaarvai bhi. Shikayat ke liye Settings > Shikayat / Grievance Officer dekhein.';

/**
 * IT Rules 2026: users ko kam se kam har 3 mahine niyam aur unke todne ke nateeje batane hain.
 * Sab active users + vendors ko in-app notification + push.
 */
export async function sendPolicyNotice(title = DEFAULT_NOTICE_TITLE, body = DEFAULT_NOTICE_BODY) {
  const data = JSON.stringify({ type: 'policy' });
  const r = await db.execute(sql`
    insert into notifications (user_id, title, body, data)
    select id, ${title}, ${body}, ${data}::jsonb from users
    where deleted_at is null and status = 'ACTIVE' and role in ('USER','VENDOR')
    returning user_id`);
  const ids = (r.rows as { user_id: string }[]).map((x) => x.user_id);
  for (let i = 0; i < ids.length; i += 500) void pushToUsers(ids.slice(i, i + 500), { title, body: body.slice(0, 150), data: { type: 'policy' } });
  const value = new Date().toISOString();
  await db.insert(settings).values({ key: 'lastPolicyNoticeAt', value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  clearSettingsCache();
  return ids.length;
}

/** IST ki aaj ki tareekh (YYYY-MM-DD) aur samay (minute) */
export function istNow(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return { day: ist.toISOString().slice(0, 10), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

let lastHourly = 0;

/**
 * Har sweep mein (5 sec): scheduled call reminder + missed, raat 9:30 ka check-in reminder.
 * Har ghante: chat retention (purane messages delete), 90 din wala policy notice.
 */
export async function sweepCompliance(now = new Date(), force = false) {
  await sweepScheduledCalls(now);
  await sweepCheckinReminders(now);
  if (force || now.getTime() - lastHourly > 3600_000) {
    lastHourly = now.getTime();
    await purgeOldChats(now);
    const s = await getSettings();
    const last = s.lastPolicyNoticeAt ? new Date(s.lastPolicyNoticeAt).getTime() : 0;
    if (s.policyNoticeAuto && (!last || now.getTime() - last > 90 * 86400_000)) {
      // Pehli baar (last khaali) par turant nahi: launch ke baad 90 din ka ghadi shuru
      if (!last) {
        const value = now.toISOString();
        await db.insert(settings).values({ key: 'lastPolicyNoticeAt', value }).onConflictDoNothing();
        clearSettingsCache();
      } else {
        const n = await sendPolicyNotice();
        logger.info({ n }, 'Policy notice bheja (90 din)');
      }
    }
  }
}

/**
 * DPDP (data minimisation): chat messages `chatRetentionDays` ke baad delete.
 * Jis session par khuli shikayat (report) ya takedown ho, uske messages jaanch tak rakhe jaate hain.
 */
export async function purgeOldChats(now = new Date()) {
  const s = await getSettings();
  const cutoff = new Date(now.getTime() - s.chatRetentionDays * 86400_000);
  const r = await db
    .delete(chatMessages)
    .where(
      and(
        lt(chatMessages.createdAt, cutoff),
        sql`not exists(select 1 from reports rp where rp.session_id = ${chatMessages.sessionId} and rp.status = 'OPEN')`,
      ),
    )
    .returning({ id: chatMessages.id });
  if (r.length) logger.info({ deleted: r.length }, 'Purane chat messages delete (retention)');
  return r.length;
}

async function notify(userId: string, title: string, body: string, data: Record<string, string>) {
  await db.insert(notifications).values({ userId, title, body, data });
  emitToUser(userId, 'notification', { title, body, data });
  void pushToUser(userId, { title, body, data });
}

/** Call se 10 minute pehle dono ko yaad; samay nikal jaane par MISSED */
export async function sweepScheduledCalls(now = new Date()) {
  const soon = new Date(now.getTime() + 10 * 60_000);
  const due = await db
    .update(scheduledCalls)
    .set({ remindedAt: now })
    .where(and(eq(scheduledCalls.status, 'CONFIRMED'), isNull(scheduledCalls.remindedAt), lte(scheduledCalls.scheduledAt, soon)))
    .returning();
  for (const c of due) {
    const [v] = await db.select({ userId: vendors.userId, name: vendors.displayName }).from(vendors).where(eq(vendors.id, c.vendorId)).limit(1);
    const when = c.scheduledAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    await notify(c.userId, 'Aapki call jaldi shuru hogi', `${v?.name ?? 'Aapke listener'} ke saath ${when} par. App khol kar "Shuru karein" dabayein`, { type: 'scheduled_call', id: c.id });
    if (v) await notify(v.userId, 'Booked call 10 minute mein', `${when} par ek booked call hai. Online ho jaayein`, { type: 'scheduled_call', id: c.id });
  }
  // Samay + duration nikal gaya, session nahi hua
  const missed = await db
    .update(scheduledCalls)
    .set({ status: 'MISSED' })
    .where(
      and(
        inArray(scheduledCalls.status, ['PENDING', 'CONFIRMED']),
        sql`${scheduledCalls.scheduledAt} + make_interval(mins => ${scheduledCalls.durationMin}) < ${now.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: scheduledCalls.id });
  return { reminded: due.length, missed: missed.length };
}

/** Raat 9:30 (IST) ke baad: jisne reminder chalu kiya aur aaj check-in nahi kiya, use ek baar yaad */
export async function sweepCheckinReminders(now = new Date()) {
  const { day, minutes } = istNow(now);
  if (minutes < 21 * 60 + 30 || minutes > 23 * 60) return 0;
  const rows = await db
    .update(users)
    .set({ checkinRemindedOn: day })
    .where(
      and(
        eq(users.checkinReminder, true),
        isNull(users.deletedAt),
        eq(users.status, 'ACTIVE'),
        sql`(${users.checkinRemindedOn} is null or ${users.checkinRemindedOn} < ${day}::date)`,
        sql`not exists(select 1 from mood_checkins m where m.user_id = ${users.id} and m.day = ${day}::date)`,
      ),
    )
    .returning({ id: users.id });
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    void pushToUsers(ids.slice(i, i + 500), { title: 'Aaj ka din kaisa raha?', body: '1 tap mein apna mood batayein. Baat karni ho to listener online hain', data: { type: 'checkin' } });
  }
  return ids.length;
}
