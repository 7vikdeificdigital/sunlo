import { inArray } from 'drizzle-orm';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from '../db/client';
import { deviceTokens } from '../db/schema';
import { getFirebaseApp } from './firebase';
import { logger } from './logger';

type Push = { title: string; body: string; data?: Record<string, string> };

/**
 * Push notification (FCM). Kabhi error nahi phenkta: Firebase set na ho, token purana ho, net ho ya na ho,
 * asli kaam (session, payment) par koi asar nahi padta. Purane/band tokens apne aap hata diye jaate hain.
 */
export async function pushToUsers(userIds: string[], msg: Push): Promise<void> {
  if (!userIds.length) return;
  try {
    const rows = await db.select({ token: deviceTokens.token }).from(deviceTokens).where(inArray(deviceTokens.userId, userIds)).limit(1000);
    const tokens = rows.map((r) => r.token);
    if (!tokens.length) return;
    let messaging;
    try {
      messaging = getMessaging(getFirebaseApp());
    } catch {
      return; // Firebase service account set nahi
    }
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title: msg.title, body: msg.body },
        data: msg.data ?? {},
        android: { priority: 'high', ttl: 60_000, notification: { sound: 'default' } },
      });
      const dead: string[] = [];
      res.responses.forEach((r, k) => {
        const code = r.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(chunk[k]!);
      });
      if (dead.length) await db.delete(deviceTokens).where(inArray(deviceTokens.token, dead));
    }
  } catch (err) {
    logger.warn({ err: String(err) }, 'push bhejne mein dikkat');
  }
}

export const pushToUser = (userId: string, msg: Push) => pushToUsers([userId], msg);

