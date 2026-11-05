import { and, eq, gte, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { consultSessions, favorites } from '../db/schema';
import { pushToUsers } from './push';

const last = new Map<string, number>();
const GAP_MS = 30 * 60_000;

/** Vendor online aaye to uske favourite karne waale users ko push (30 min mein ek baar se zyada nahi). */
export async function notifyFavoritesOnline(vendorId: string, name: string): Promise<void> {
  const now = Date.now();
  if (now - (last.get(vendorId) ?? 0) < GAP_MS) return;
  last.set(vendorId, now);
  try {
    const rows = await db.select({ userId: favorites.userId }).from(favorites).where(eq(favorites.vendorId, vendorId)).limit(500);
    await pushToUsers(rows.map((r) => r.userId), {
      title: `${name || 'Aapka favourite listener'} online hain`,
      body: 'Abhi baat karne ka mauka hai, tap karke connect karein',
      data: { type: 'vendor_online', vendorId },
    });
  } catch {
    /* push kabhi kaam nahi rokta */
  }
}

const lastRecent = new Map<string, number>();

/** Jin users ne pichhle 24 ghante mein is vendor se baat ki thi, unhe "ab online hain" push (30 min mein ek baar). */
export async function notifyRecentChatters(vendorId: string, name: string): Promise<void> {
  const now = Date.now();
  if (now - (lastRecent.get(vendorId) ?? 0) < GAP_MS) return;
  lastRecent.set(vendorId, now);
  try {
    const since = new Date(now - 24 * 3600_000);
    const rows = await db
      .selectDistinct({ userId: consultSessions.userId })
      .from(consultSessions)
      .where(and(eq(consultSessions.vendorId, vendorId), eq(consultSessions.status, 'COMPLETED'), gt(consultSessions.billedSeconds, 0), gte(consultSessions.endedAt, since)))
      .limit(200);
    const fav = await db.select({ userId: favorites.userId }).from(favorites).where(eq(favorites.vendorId, vendorId)).limit(500);
    const skip = new Set(fav.map((f) => f.userId)); // favourites ko alag push already ja chuka
    await pushToUsers(rows.map((r) => r.userId).filter((u) => !skip.has(u)), {
      title: `${name || 'Aapke listener'} wapas online aa gaye`,
      body: 'Aapki pichhli baat yahin se aage badha sakte hain',
      data: { type: 'vendor_online', vendorId },
    });
  } catch {
    /* push kabhi kaam nahi rokta */
  }
}
