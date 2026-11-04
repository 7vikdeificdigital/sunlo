import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { deviceTokens } from '../src/db/schema';
import { pushToUser } from '../src/lib/push';
import { api, bearer, loginViaOtp, P } from './helpers';

describe('Push (FCM)', () => {
  it('device token judta hai, dobara bhejne par duplicate nahi, logout par hat jaata hai', async () => {
    const u = await loginViaOtp();
    const token = 'fcm_token_' + 'x'.repeat(40) + Date.now();
    const a = await api().post(`${P}/me/devices`).set(bearer(u.accessToken)).send({ token, platform: 'android' });
    expect(a.status).toBe(200);
    await api().post(`${P}/me/devices`).set(bearer(u.accessToken)).send({ token, platform: 'android' });
    expect(await db.select().from(deviceTokens).where(eq(deviceTokens.token, token))).toHaveLength(1);
    const d = await api().delete(`${P}/me/devices`).set(bearer(u.accessToken)).send({ token });
    expect(d.status).toBe(200);
    expect(await db.select().from(deviceTokens).where(eq(deviceTokens.token, token))).toHaveLength(0);
  });

  it('Firebase set na ho to push chupchaap skip, koi error nahi', async () => {
    const u = await loginViaOtp();
    await api().post(`${P}/me/devices`).set(bearer(u.accessToken)).send({ token: 'fcm_token_' + 'y'.repeat(40) + Date.now(), platform: 'android' });
    await expect(pushToUser(u.user.id, { title: 't', body: 'b' })).resolves.toBeUndefined();
  });
});
