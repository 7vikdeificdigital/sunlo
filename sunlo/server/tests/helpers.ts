import request from 'supertest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app';
import { db } from '../src/db/client';
import { rechargePacks, users, vendors, wallets } from '../src/db/schema';
import { hashPassword } from '../src/lib/crypto';
import { randomReferralCode } from '../src/lib/crypto';
import { devOtpOutbox } from '../src/modules/auth/sms';

export const app = buildApp();
export const api = () => request(app);
export const P = '/api/v1';

let phoneCounter = 0;
export const newPhone = () => `+9177${String(Date.now()).slice(-6)}${String(++phoneCounter).padStart(2, '0')}`;

export async function loginViaOtp(phone = newPhone(), appKind: 'user' | 'vendor' = 'user') {
  const r1 = await api().post(`${P}/auth/otp/request`).send({ phone });
  if (r1.status !== 200) throw new Error(`otp request failed ${r1.status} ${JSON.stringify(r1.body)}`);
  const code = devOtpOutbox.get(phone)!;
  const r2 = await api().post(`${P}/auth/otp/verify`).send({ phone, code, app: appKind });
  if (r2.status !== 200) throw new Error(`otp verify failed ${r2.status} ${JSON.stringify(r2.body)}`);
  return { phone, ...r2.body } as { phone: string; accessToken: string; refreshToken: string; user: { id: string }; isNewUser: boolean };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Test ke liye ek approved, online vendor (phone ke saath, taaki vendor app se login ho sake) */
export async function makeVendor(opts: { chatRate?: number; online?: boolean } = {}) {
  const phone = newPhone();
  const [u] = await db.insert(users).values({ phone, role: 'VENDOR', name: 'Test Vendor', referralCode: randomReferralCode() }).returning();
  await db.insert(wallets).values({ userId: u.id });
  const [v] = await db
    .insert(vendors)
    .values({
      userId: u.id,
      status: 'APPROVED',
      displayName: `Test Vendor ${phoneCounter}`,
      headline: 'Test listener',
      chatRatePerMin: opts.chatRate ?? 2000,
      callRatePerMin: 3000,
      videoRatePerMin: 4000,
      isOnline: opts.online ?? true,
    })
    .returning();
  return { vendor: v, user: u, phone };
}

let adminCounter = 0;
export async function makeAdmin() {
  const email = `admin${Date.now()}${++adminCounter}@test.local`;
  const password = 'Str0ng!Passw0rd#';
  await db.insert(users).values({ email, passwordHash: await hashPassword(password), role: 'ADMIN', name: 'Admin', referralCode: randomReferralCode() });
  const r = await api().post(`${P}/auth/admin/login`).send({ email, password });
  if (r.status !== 200) throw new Error('admin login failed ' + JSON.stringify(r.body));
  return r.body as { accessToken: string; user: { id: string } };
}

export async function ensurePack(amount = 100000, bonusPct = 10) {
  const [p] = await db.insert(rechargePacks).values({ amount, bonusPct, sortOrder: 0 }).returning();
  return p;
}

export async function balanceOf(userId: string) {
  const [w] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  return w?.balance ?? 0;
}

/** Mock payment se wallet recharge (asli flow: recharge -> verify) */
export async function rechargeVia(token: string, packId: string) {
  const r = await api().post(`${P}/wallet/recharge`).set(bearer(token)).send({ packId });
  if (r.status !== 201) throw new Error(`recharge failed ${JSON.stringify(r.body)}`);
  const v = await api().post(`${P}/wallet/recharge/verify`).set(bearer(token)).send({ paymentId: r.body.paymentId, mockResult: 'success' });
  if (v.body.status !== 'PAID') throw new Error('verify failed');
  return r.body as { paymentId: string; amount: number; bonus: number; gstAmount: number; totalPayable: number };
}
