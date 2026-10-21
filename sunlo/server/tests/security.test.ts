import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { privateRouters } from '../src/app';
import { db } from '../src/db/client';
import { users, wallets } from '../src/db/schema';
import { devOtpOutbox } from '../src/modules/auth/sms';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeVendor, newPhone, P } from './helpers';

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

describe('Har private API bina login ke band hai', () => {
  // Purane system ki sabse badi kami: admin APIs (vendor delete, withdrawal release...) bina login khuli thi
  const routes: { method: string; path: string }[] = [];
  for (const r of privateRouters) {
    for (const layer of (r as unknown as { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      for (const m of Object.keys(layer.route.methods)) {
        routes.push({ method: m, path: layer.route.path.replace(/:id/g, '00000000-0000-4000-8000-000000000000') });
      }
    }
  }

  it('kam se kam 30 private routes mile', () => {
    expect(routes.length).toBeGreaterThanOrEqual(30);
  });

  it.each(routes)('$method $path -> 401 bina token', async ({ method, path }) => {
    const res = await (api() as unknown as Record<string, (u: string) => import('supertest').Test>)[method](`${P}${path}`).send({});
    expect(res.status).toBe(401);
  });

  it('galat / dusre secret se bana token -> 401', async () => {
    const fake = jwt.sign({ role: 'ADMIN', tv: 0 }, 'attacker-secret-attacker-secret-attacker', { subject: '00000000-0000-4000-8000-000000000000' });
    expect((await api().get(`${P}/me`).set(bearer(fake))).status).toBe(401);
    expect((await api().get(`${P}/me`).set(bearer('garbage.token.here'))).status).toBe(401);
  });

  it("'alg: none' wala token -> 401", async () => {
    const none = jwt.sign({ role: 'ADMIN', tv: 0 }, '', { algorithm: 'none', subject: 'x' });
    expect((await api().get(`${P}/me`).set(bearer(none))).status).toBe(401);
  });
});

describe('OTP login', () => {
  it('OTP kabhi response mein nahi aata', async () => {
    const phone = newPhone();
    const r = await api().post(`${P}/auth/otp/request`).send({ phone });
    expect(r.status).toBe(200);
    const code = devOtpOutbox.get(phone)!;
    expect(JSON.stringify(r.body)).not.toContain(code);
    expect(r.body).not.toHaveProperty('otp');
  });

  it('galat OTP par login nahi; 5 galat koshish ke baad sahi OTP bhi band', async () => {
    const phone = newPhone();
    await api().post(`${P}/auth/otp/request`).send({ phone });
    const code = devOtpOutbox.get(phone)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await api().post(`${P}/auth/otp/verify`).send({ phone, code: wrong, app: 'user' });
      expect(r.status).toBe(400);
    }
    const locked = await api().post(`${P}/auth/otp/verify`).send({ phone, code, app: 'user' });
    expect(locked.status).toBe(429);
  });

  it('ek OTP sirf ek baar', async () => {
    const s = await loginViaOtp();
    const code = devOtpOutbox.get(s.phone)!;
    const again = await api().post(`${P}/auth/otp/verify`).send({ phone: s.phone, code, app: 'user' });
    expect(again.status).toBe(400);
  });

  it('30 second se pehle dobara OTP nahi', async () => {
    const phone = newPhone();
    expect((await api().post(`${P}/auth/otp/request`).send({ phone })).status).toBe(200);
    expect((await api().post(`${P}/auth/otp/request`).send({ phone })).status).toBe(429);
  });

  it('naya user ka wallet 0 se banta hai; login response mein password/tokenVersion nahi', async () => {
    const s = await loginViaOtp();
    expect(s.isNewUser).toBe(true);
    expect(await balanceOf(s.user.id)).toBe(0);
    expect(JSON.stringify(s.user)).not.toMatch(/passwordHash|tokenVersion|status/);
  });

  it('normal user vendor app se login nahi kar sakta', async () => {
    const s = await loginViaOtp();
    await api().post(`${P}/auth/otp/request`).send({ phone: s.phone }).catch(() => undefined);
    // 30s gap rule ke kaaran seedha DB se OTP purana karo
    await db.execute(sql`update otp_codes set created_at = now() - interval '1 minute' where phone = ${s.phone}`);
    await api().post(`${P}/auth/otp/request`).send({ phone: s.phone });
    const r = await api().post(`${P}/auth/otp/verify`).send({ phone: s.phone, code: devOtpOutbox.get(s.phone), app: 'vendor' });
    expect(r.status).toBe(403);
  });
});

describe('Token aur account control', () => {
  it('refresh token rotate hota hai; purana dobara use karne par poori login family band', async () => {
    const s = await loginViaOtp();
    const r1 = await api().post(`${P}/auth/refresh`).send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(s.refreshToken);
    // chor purana token use kare
    const reuse = await api().post(`${P}/auth/refresh`).send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);
    // ab naya wala bhi band (family revoke)
    const r2 = await api().post(`${P}/auth/refresh`).send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(401);
  });

  it('block kiya user turant bahar', async () => {
    const s = await loginViaOtp();
    expect((await api().get(`${P}/me`).set(bearer(s.accessToken))).status).toBe(200);
    await db.update(users).set({ status: 'BLOCKED' }).where(eq(users.id, s.user.id));
    expect((await api().get(`${P}/me`).set(bearer(s.accessToken))).status).toBe(403);
  });

  it('logout-all ke baad purana access token kaam nahi karta', async () => {
    const s = await loginViaOtp();
    expect((await api().post(`${P}/auth/logout-all`).set(bearer(s.accessToken))).status).toBe(200);
    expect((await api().get(`${P}/me`).set(bearer(s.accessToken))).status).toBe(401);
  });

  it('user apna role/status khud nahi badal sakta', async () => {
    const s = await loginViaOtp();
    const r = await api().patch(`${P}/me`).set(bearer(s.accessToken)).send({ role: 'ADMIN' });
    expect(r.status).toBe(400);
    const r2 = await api().patch(`${P}/me`).set(bearer(s.accessToken)).send({ name: 'Ravi Kumar', status: 'ACTIVE' });
    expect(r2.status).toBe(400);
    const [u] = await db.select().from(users).where(eq(users.id, s.user.id));
    expect(u.role).toBe('USER');
  });

  it('user vendor wali API nahi chala sakta (403)', async () => {
    const s = await loginViaOtp();
    expect((await api().get(`${P}/vendor/sessions/pending`).set(bearer(s.accessToken))).status).toBe(403);
    expect((await api().patch(`${P}/vendor/status`).set(bearer(s.accessToken)).send({ isOnline: true })).status).toBe(403);
  });

  it('admin login: galat password par generic error, koi default admin nahi', async () => {
    const r = await api().post(`${P}/auth/admin/login`).send({ email: 'superadmin@gmail.com', password: 'admin123' });
    expect(r.status).toBe(401);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.email, 'superadmin@gmail.com'));
    expect(n).toBe(0);
  });
});

describe('SQL injection', () => {
  it('search mein SQL daalne par bhi kuch toot-ta nahi, data leak nahi', async () => {
    await makeVendor();
    for (const s of ["' OR 1=1 --", "%' UNION SELECT password_hash FROM users --", '\\', '%', '_']) {
      const r = await api().get(`${P}/vendors`).query({ search: s });
      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
    }
  });
});

describe('Payments', () => {
  it('recharge ki raqam server tay karta hai; GST + bonus sahi; double verify par double credit nahi', async () => {
    const s = await loginViaOtp();
    const pack = await ensurePack(100000, 10); // Rs 1000 + 10%
    const r = await api().post(`${P}/wallet/recharge`).set(bearer(s.accessToken)).send({ packId: pack.id });
    expect(r.status).toBe(201);
    expect(r.body.amount).toBe(100000);
    expect(r.body.bonus).toBe(10000);
    expect(r.body.gstAmount).toBe(18000);
    expect(r.body.totalPayable).toBe(118000);
    const v1 = await api().post(`${P}/wallet/recharge/verify`).set(bearer(s.accessToken)).send({ paymentId: r.body.paymentId, mockResult: 'success' });
    const v2 = await api().post(`${P}/wallet/recharge/verify`).set(bearer(s.accessToken)).send({ paymentId: r.body.paymentId, mockResult: 'success' });
    expect(v1.body.status).toBe('PAID');
    expect(v2.body.status).toBe('PAID');
    expect(await balanceOf(s.user.id)).toBe(110000);
  });

  it('ek saath 5 verify requests: phir bhi sirf ek baar credit', async () => {
    const s = await loginViaOtp();
    const pack = await ensurePack(50000, 0);
    const r = await api().post(`${P}/wallet/recharge`).set(bearer(s.accessToken)).send({ packId: pack.id });
    await Promise.all(
      Array.from({ length: 5 }, () =>
        api().post(`${P}/wallet/recharge/verify`).set(bearer(s.accessToken)).send({ paymentId: r.body.paymentId, mockResult: 'success' }),
      ),
    );
    expect(await balanceOf(s.user.id)).toBe(50000);
  });

  it('raqam/extra fields bhej kar wallet nahi bhar sakte', async () => {
    const s = await loginViaOtp();
    const pack = await ensurePack(5000, 0);
    const r = await api().post(`${P}/wallet/recharge`).set(bearer(s.accessToken)).send({ packId: pack.id, amount: 99999999 });
    expect(r.status).toBe(400);
    const tooSmall = await api().post(`${P}/wallet/recharge`).set(bearer(s.accessToken)).send({ amount: 100 });
    expect(tooSmall.status).toBe(400);
  });

  it('kisi aur ka payment verify nahi kar sakte', async () => {
    const a = await loginViaOtp();
    const b = await loginViaOtp();
    const pack = await ensurePack(5000, 0);
    const r = await api().post(`${P}/wallet/recharge`).set(bearer(a.accessToken)).send({ packId: pack.id });
    const v = await api().post(`${P}/wallet/recharge/verify`).set(bearer(b.accessToken)).send({ paymentId: r.body.paymentId, mockResult: 'success' });
    expect(v.status).toBe(404);
    expect(await balanceOf(b.user.id)).toBe(0);
  });

  it('payment page galat token par nahi khulta', async () => {
    const s = await loginViaOtp();
    const pack = await ensurePack(5000, 0);
    const r = await api().post(`${P}/wallet/recharge`).set(bearer(s.accessToken)).send({ packId: pack.id });
    const ok = await api().get(`${P}${r.body.checkoutPath}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-security-policy']).toContain("default-src 'none'");
    const bad = await api().get(`${P}/pay/${r.body.paymentId}`).query({ t: 'x'.repeat(40) });
    expect(bad.status).toBe(403);
  });

  it('wallet kabhi negative nahi ho sakta (DB constraint)', async () => {
    const s = await loginViaOtp();
    await expect(db.update(wallets).set({ balance: -1 }).where(eq(wallets.userId, s.user.id))).rejects.toThrow();
  });
});
