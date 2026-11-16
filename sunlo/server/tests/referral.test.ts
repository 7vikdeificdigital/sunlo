import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users, walletTransactions, wallets } from '../src/db/schema';
import { randomReferralCode } from '../src/lib/crypto';
import { clearSettingsCache } from '../src/lib/settings';
import { settings } from '../src/db/schema';
import { devOtpOutbox } from '../src/modules/auth/sms';
import { api, balanceOf, loginViaOtp, newPhone, P } from './helpers';

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

describe('Referral code', () => {
  it('sahi code se naye user ko 50 coins (5000 paise) milte hain', async () => {
    await setSetting('referralEnabled', true);
    await setSetting('referralBonusPaise', 5000);
    await setSetting('referrerBonusPaise', 0);
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);

    const chk = await api().get(`${P}/auth/referral/${code}`);
    expect(chk.body).toEqual({ valid: true, bonusPaise: 5000 });

    const { res } = await loginWithRef(code.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.referralBonusPaise).toBe(5000);
    expect(await balanceOf(res.body.user.id)).toBe(5000);
    expect(await balanceOf(a.user.id)).toBe(0); // code dene wale ko kuch nahi (default)
    const tx = await db.select().from(walletTransactions);
    expect(tx.filter((t) => t.type === 'REFERRAL_BONUS' && t.amount === 5000).length).toBeGreaterThanOrEqual(1);
  });

  it('galat code: login chalta hai par bonus nahi, aur check valid=false', async () => {
    const chk = await api().get(`${P}/auth/referral/ZZZZZZZZ`);
    expect(chk.body).toEqual({ valid: false, bonusPaise: 0 });
    const { res } = await loginWithRef('ZZZZZZZZ');
    expect(res.status).toBe(200);
    expect(res.body.referralBonusPaise).toBe(0);
    expect(await balanceOf(res.body.user.id)).toBe(0);
  });

  it('purana user code daale to bonus dobara nahi milta', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    // pehle se bana hua user (OTP ki 30 second wali rok se bachne ke liye seedha DB mein)
    const phone = newPhone();
    const [b] = await db.insert(users).values({ phone, role: 'USER', referralCode: randomReferralCode() }).returning();
    await db.insert(wallets).values({ userId: b.id });
    const { res } = await loginWithRef(code, phone);
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.referralBonusPaise).toBe(0);
    expect(await balanceOf(b.id)).toBe(0);
  });

  it('referralEnabled band ho to bonus nahi', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    await setSetting('referralEnabled', false);
    try {
      expect((await api().get(`${P}/auth/referral/${code}`)).body.valid).toBe(false);
      const { res } = await loginWithRef(code);
      expect(res.body.referralBonusPaise).toBe(0);
      expect(await balanceOf(res.body.user.id)).toBe(0);
    } finally {
      await setSetting('referralEnabled', true);
    }
  });

  it('referrer bonus setting chalu ho to code dene wale ko bhi coins', async () => {
    await setSetting('referrerBonusPaise', 2000);
    try {
      const a = await loginViaOtp();
      const code = await referralCodeOf(a.user.id);
      const { res } = await loginWithRef(code);
      expect(res.body.referralBonusPaise).toBe(5000);
      expect(await balanceOf(a.user.id)).toBe(2000);
    } finally {
      await setSetting('referrerBonusPaise', 0);
    }
  });

  it('blocked user ka code kaam nahi karta', async () => {
    const a = await loginViaOtp();
    const code = await referralCodeOf(a.user.id);
    await db.update(users).set({ status: 'BLOCKED' }).where(eq(users.id, a.user.id));
    expect((await api().get(`${P}/auth/referral/${code}`)).body.valid).toBe(false);
  });
});
