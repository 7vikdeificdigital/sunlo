import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { api, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia } from './helpers';
import { db } from '../src/db/client';
import { withdrawals } from '../src/db/schema';

describe('Store ke liye public pages', () => {
  it.each(['privacy', 'terms', 'delete-account'])('/legal/%s bina login HTML deta hai', async (slug) => {
    const r = await api().get(`${P}/legal/${slug}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.text).toContain('Bondty');
  });
});

describe('Account delete ki suraksha', () => {
  it('vendor ka withdrawal pending ho to delete nahi, payment ke baad ho jaata hai', async () => {
    const { vendor, phone } = await makeVendor();
    const v = await loginViaOtp(phone, 'vendor');
    const [w] = await db.insert(withdrawals).values({ vendorId: vendor.id, amount: 5000, payoutSnapshot: {} }).returning();
    const r1 = await api().delete(`${P}/me`).set(bearer(v.accessToken));
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('WITHDRAWAL_PENDING');
    await db.update(withdrawals).set({ status: 'PAID' }).where(eq(withdrawals.id, w.id));
    const r2 = await api().delete(`${P}/me`).set(bearer(v.accessToken));
    expect(r2.status).toBe(200);
  });

  it('user ki call request khuli ho to delete nahi', async () => {
    const { vendor } = await makeVendor({ chatRate: 1000 });
    const u = await loginViaOtp();
    const pack = await ensurePack(100000, 0);
    await rechargeVia(u.accessToken, pack.id);
    const s = await api().post(`${P}/sessions`).set(bearer(u.accessToken)).send({ vendorId: vendor.id, type: 'CHAT', pricingAck: true });
    expect(s.status).toBe(201);
    const r = await api().delete(`${P}/me`).set(bearer(u.accessToken));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SESSION_OPEN');
  });
});
