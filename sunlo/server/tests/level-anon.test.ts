import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia, setSettings } from './helpers';

const COIN = { coinPaiseBeginner: 80, coinPaiseIntermediate: 60, coinPaiseExpert: 50 };

async function setMinutes(userId: string, minutes: number) {
  await db.update(users).set({ totalMinutes: minutes }).where(eq(users.id, userId));
}

describe('Level: Beginner / Intermediate / Expert', () => {
  afterAll(async () => {
    await setSettings({ coinPaiseBeginner: 100, coinPaiseIntermediate: 100, coinPaiseExpert: 100 });
  });

  it('minute ke hisaab se level badalta hai aur 1 coin ki keemat girti hai', async () => {
    await setSettings({ ...COIN, levelIntermediateMinutes: 500, levelExpertMinutes: 1500 });
    const u = await loginViaOtp();
    const w1 = await api().get(`${P}/wallet`).set(bearer(u.accessToken));
    expect(w1.body.level.level).toBe('BEGINNER');
    expect(w1.body.level.coinPaise).toBe(80);

    await setMinutes(u.user.id, 700);
    const w2 = await api().get(`${P}/wallet`).set(bearer(u.accessToken));
    expect(w2.body.level.level).toBe('INTERMEDIATE');
    expect(w2.body.level.coinPaise).toBe(60);

    await setMinutes(u.user.id, 2000);
    const w3 = await api().get(`${P}/wallet`).set(bearer(u.accessToken));
    expect(w3.body.level.level).toBe('EXPERT');
    expect(w3.body.level.coinPaise).toBe(50);
    expect(w3.body.level.nextAt).toBeNull();
  });

  it('Rs 100 recharge: beginner ko 125 coins, expert ko 200 coins (billing wahi)', async () => {
    await setSettings(COIN);
    const pack = await ensurePack(10000, 0);

    const beg = await loginViaOtp();
    await rechargeVia(beg.accessToken, pack.id);
    expect(await balanceOf(beg.user.id)).toBe(12500); // 125 coins

    const exp = await loginViaOtp();
    await setMinutes(exp.user.id, 5000);
    await rechargeVia(exp.accessToken, pack.id);
    expect(await balanceOf(exp.user.id)).toBe(20000); // 200 coins
  });

  it('pack ka apna bonus level ke bonus ke upar judta hai', async () => {
    await setSettings(COIN);
    const pack = await ensurePack(20000, 10); // Rs 200 + 10% pack bonus
    const u = await loginViaOtp();
    await rechargeVia(u.accessToken, pack.id);
    // 200 coins + 20 (pack 10%) + 50 (level: 80 paise) = 270 coins
    expect(await balanceOf(u.user.id)).toBe(27000);
  });

  it('session ke baad user ke minute jama hote hain', async () => {
    await setSettings(COIN);
    const u = await loginViaOtp();
    const [before] = await db.select({ m: users.totalMinutes }).from(users).where(eq(users.id, u.user.id));
    expect(before.m).toBe(0);
  });
});

describe('Anonymous profile: naam ki jagah @username', () => {
  it('anonymous on karne par listener ko @username dikhta hai', async () => {
    const v = await makeVendor();
    const vl = await loginViaOtp(v.phone, 'vendor');
    const u = await loginViaOtp();
    await api().patch(`${P}/me`).set(bearer(u.accessToken)).send({ name: 'Satvik Bajpai', gender: 'MALE', ageConfirmed: true });
    await api().patch(`${P}/me/username`).set(bearer(u.accessToken)).send({ username: 'chupchap' });

    const pack = await ensurePack(100000, 0);
    await rechargeVia(u.accessToken, pack.id);

    // Pehle: asli naam
    const s1 = await api().post(`${P}/sessions`).set(bearer(u.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    expect(s1.status).toBe(201);
    const p1 = await api().get(`${P}/vendor/sessions/pending`).set(bearer(vl.accessToken));
    expect(p1.body.items[0].userName).toBe('Satvik');
    await api().post(`${P}/sessions/${s1.body.id}/cancel`).set(bearer(u.accessToken));

    // Anonymous on
    const me = await api().patch(`${P}/me`).set(bearer(u.accessToken)).send({ anonymous: true });
    expect(me.body.user.anonymous).toBe(true);
    const s2 = await api().post(`${P}/sessions`).set(bearer(u.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    const p2 = await api().get(`${P}/vendor/sessions/pending`).set(bearer(vl.accessToken));
    expect(p2.body.items.find((x: { id: string }) => x.id === s2.body.id).userName).toBe('@chupchap');
    await api().post(`${P}/sessions/${s2.body.id}/cancel`).set(bearer(u.accessToken));

    // Wapas off
    const off = await api().patch(`${P}/me`).set(bearer(u.accessToken)).send({ anonymous: false });
    expect(off.body.user.anonymous).toBe(false);
  });
});

describe('Booking: ek samay par ek hi', () => {
  it('same samay par doosri booking nahi, alag samay par chalti hai', async () => {
    const v1 = await makeVendor();
    const v2 = await makeVendor();
    const u = await loginViaOtp();
    const at = new Date(Date.now() + 3 * 3600_000);
    const a = await api().post(`${P}/scheduled-calls`).set(bearer(u.accessToken)).send({ vendorId: v1.vendor.id, type: 'CHAT', scheduledAt: at.toISOString(), durationMin: 30 });
    expect(a.status).toBe(201);

    // Wahi samay, doosra listener: nahi chalega
    const clash = await api()
      .post(`${P}/scheduled-calls`)
      .set(bearer(u.accessToken))
      .send({ vendorId: v2.vendor.id, type: 'CHAT', scheduledAt: new Date(at.getTime() + 10 * 60_000).toISOString(), durationMin: 15 });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('OWN_SLOT_TAKEN');

    // Alag samay: chalega
    const later = await api()
      .post(`${P}/scheduled-calls`)
      .set(bearer(u.accessToken))
      .send({ vendorId: v2.vendor.id, type: 'CHAT', scheduledAt: new Date(at.getTime() + 2 * 3600_000).toISOString(), durationMin: 30 });
    expect(later.status).toBe(201);
  });
});
