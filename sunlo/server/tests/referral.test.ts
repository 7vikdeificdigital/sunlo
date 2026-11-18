import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users, walletTransactions, wallets } from '../src/db/schema';
import { randomReferralCode } from '../src/lib/crypto';
import { clearSettingsCache } from '../src/lib/settings';
import { settings } from '../src/db/schema';
import { devOtpOutbox } from '../src/modules/auth/sms';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, newPhone, P, rechargeVia } from './helpers';
import { notifications } from '../src/db/schema';

async function setSetting(key: string, value: unknown) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  clearSettingsCache();
}

async function referralCodeOf(userId: string) {
  const [u] = await db.select({ c: users.referralCode }).from(users).where(eq(users.id, userId));
  return u.c;
}

async function loginWithRef(referralCode: string, phone = newPhone()) {
  await api().post(`${P}/auth/otp/request`).send({ phone });
  const code = devOtpOutbox.get(phone)!;
  const r = await api().post(`${P}/auth/otp/verify`).send({ phone, code, app: 'user', referralCode });
  return { phone, res: r };
}

describe('Referral: dono ko bonus jab dost ka pehla recharge >= Rs 100', () => {
  it('signup par bonus nahi; Rs 100 ke recharge par dono ko 50 coins, history aur notification', async () => {
    await setSetting('referralEnabled', true);
    await setSetting('referralBonusPaise', 5000);
    await setSetting('referrerBonusPaise', 5000);
    await setSetting('referralMinRechargePaise', 10000);
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);

    const chk = await api().get(`${P}/auth/referral/${code}`);
    expect(chk.body).toEqual({ valid: true, bonusPaise: 5000, minRechargePaise: 10000 });

    const { res } = await loginWithRef(code.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.referralBonusPaise).toBe(0);
    const bId = res.body.user.id;
    expect(await balanceOf(bId)).toBe(0); // signup par kuch nahi
    expect(await balanceOf(a.user.id)).toBe(0);

    // Rs 50 ka recharge: minimum se kam, bonus nahi
    await rechargeVia(res.body.accessToken, (await ensurePack(5000, 0)).id);
    expect(await balanceOf(bId)).toBe(5000);
    expect(await balanceOf(a.user.id)).toBe(0);

    // Rs 100 ka recharge: dono ko +5000 paise (50 coins)
    await rechargeVia(res.body.accessToken, (await ensurePack(10000, 0)).id);
    expect(await balanceOf(bId)).toBe(5000 + 10000 + 5000);
    expect(await balanceOf(a.user.id)).toBe(5000);

    // Dobara bada recharge: bonus ek hi baar milta hai
    await rechargeVia(res.body.accessToken, (await ensurePack(20000, 0)).id);
    expect(await balanceOf(bId)).toBe(5000 + 10000 + 5000 + 20000);
    expect(await balanceOf(a.user.id)).toBe(5000);

    const tx = await db.select().from(walletTransactions);
    expect(tx.filter((t) => t.type === 'REFERRAL_BONUS' && t.amount === 5000).length).toBe(2);
    const notes = await db.select().from(notifications);
    expect(notes.some((n) => n.userId === bId && n.body === '50 coins bonus from referral added to your account')).toBe(true);
    expect(notes.some((n) => n.userId === a.user.id && n.body === '50 coins received from referral')).toBe(true);
  });

  it('galat code: login chalta hai, bonus nahi, check valid=false', async () => {
    const chk = await api().get(`${P}/auth/referral/ZZZZZZZZ`);
    expect(chk.body.valid).toBe(false);
    const { res } = await loginWithRef('ZZZZZZZZ');
    expect(res.status).toBe(200);
    await rechargeVia(res.body.accessToken, (await ensurePack(10000, 0)).id);
    expect(await balanceOf(res.body.user.id)).toBe(10000);
  });

  it('purana user code daale to bonus nahi', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    const phone = newPhone();
    const [b] = await db.insert(users).values({ phone, role: 'USER', referralCode: randomReferralCode() }).returning();
    await db.insert(wallets).values({ userId: b.id });
    const { res } = await loginWithRef(code, phone);
    expect(res.body.isNewUser).toBe(false);
    await rechargeVia(res.body.accessToken, (await ensurePack(10000, 0)).id);
    expect(await balanceOf(b.id)).toBe(10000);
    expect(await balanceOf(a.user.id)).toBe(0);
  });

  it('referralEnabled band ho to bonus nahi', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    const { res } = await loginWithRef(code);
    await setSetting('referralEnabled', false);
    try {
      await rechargeVia(res.body.accessToken, (await ensurePack(10000, 0)).id);
      expect(await balanceOf(res.body.user.id)).toBe(10000);
      expect(await balanceOf(a.user.id)).toBe(0);
    } finally {
      await setSetting('referralEnabled', true);
    }
  });

  it('blocked user ka code kaam nahi karta', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    await db.update(users).set({ status: 'BLOCKED' }).where(eq(users.id, a.user.id));
    expect((await api().get(`${P}/auth/referral/${code}`)).body.valid).toBe(false);
  });
});

describe('Unique ID, username aur naam ka lock', () => {
  it('har user ko unique publicId + default username milta hai', async () => {
    const a = await loginViaOtp();
    const b = await loginViaOtp();
    const ma = (await api().get(`${P}/me`).set(bearer(a.accessToken))).body.user;
    const mb = (await api().get(`${P}/me`).set(bearer(b.accessToken))).body.user;
    expect(ma.publicId).toBeGreaterThan(50000000);
    expect(mb.publicId).not.toBe(ma.publicId);
    expect(ma.username).toBe(`user${ma.publicId}`);
    expect(ma.publicCode).toBe(`BOU${ma.publicId}`);
  });

  it('vendor ko BOL wali alag unique ID milti hai', async () => {
    const v1 = await loginViaOtp(undefined, 'vendor');
    const v2 = await loginViaOtp(undefined, 'vendor');
    const m1 = (await api().get(`${P}/vendor/me`).set(bearer(v1.accessToken))).body;
    const m2 = (await api().get(`${P}/vendor/me`).set(bearer(v2.accessToken))).body;
    expect(m1.publicCode).toMatch(/^BOL\d{8}$/);
    expect(m2.publicCode).not.toBe(m1.publicCode);
  });

  it('username badal sakta hai (unique, case-insensitive), ID nahi', async () => {
    const a = await loginViaOtp();
    const b = await loginViaOtp();
    const r1 = await api().patch(`${P}/me/username`).set(bearer(a.accessToken)).send({ username: 'Rahul_99' });
    expect(r1.status).toBe(200);
    expect(r1.body.user.username).toBe('rahul_99');
    const taken = await api().patch(`${P}/me/username`).set(bearer(b.accessToken)).send({ username: 'RAHUL_99' });
    expect(taken.status).toBe(409);
    expect(taken.body.error?.code ?? taken.body.code).toBe('USERNAME_TAKEN');
    expect((await api().patch(`${P}/me/username`).set(bearer(b.accessToken)).send({ username: 'a' })).status).toBe(400);
    expect((await api().patch(`${P}/me/username`).set(bearer(b.accessToken)).send({ username: 'admin' })).status).toBe(400);
    const r2 = await api().patch(`${P}/me/username`).set(bearer(a.accessToken)).send({ username: 'rahul.new' });
    expect(r2.body.user.username).toBe('rahul.new');
    expect(r2.body.user.publicId).toBe(r1.body.user.publicId);
  });

  it('naam ek baar save hone ke baad nahi badalta', async () => {
    const a = await loginViaOtp();
    const r1 = await api().patch(`${P}/me`).set(bearer(a.accessToken)).send({ name: 'Rahul Sharma' });
    expect(r1.body.user.name).toBe('Rahul Sharma');
    const r2 = await api().patch(`${P}/me`).set(bearer(a.accessToken)).send({ name: 'Kuch Aur' });
    expect(r2.status).toBe(200);
    expect(r2.body.user.name).toBe('Rahul Sharma');
  });
});
