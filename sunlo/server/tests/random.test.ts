import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { vendors } from '../src/db/schema';
import { api, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia } from './helpers';

describe('Random Connect', () => {
  beforeAll(async () => {
    // Is file ke liye baaki sab vendors offline, taaki sirf apne banaye hue vendors hi chunein
    await db.update(vendors).set({ isOnline: false });
  });

  async function funded() {
    const user = await loginViaOtp();
    const pack = await ensurePack(100000, 0);
    await rechargeVia(user.accessToken, pack.id);
    return user;
  }

  it('overview: online listeners ki ginti aur sabse kam rate', async () => {
    const user = await funded();
    await makeVendor({ chatRate: 2500 });
    await makeVendor({ chatRate: 1800 });
    const r = await api().get(`${P}/random/overview`).set(bearer(user.accessToken));
    expect(r.status).toBe(200);
    expect(r.body.CHAT.online).toBe(2);
    expect(r.body.CHAT.minRate).toBe(1800);
    expect(r.body.AUDIO.minRate).toBe(3000);
    expect(r.body.people).toHaveLength(2);
    expect(r.body.people[0]).toHaveProperty('name');
  });

  it('ek random listener ko request jaati hai, exclude wale ko nahi', async () => {
    await db.update(vendors).set({ isOnline: false });
    const user = await funded();
    const a = await makeVendor();
    const b = await makeVendor();
    const r = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT' });
    expect(r.status).toBe(201);
    expect(r.body.session.status).toBe('REQUESTED');
    expect([a.vendor.id, b.vendor.id]).toContain(r.body.session.vendorId);
    const first = r.body.session.vendorId as string;

    // pehla cancel karke dobara, ab usse exclude karke: doosra hi milna chahiye
    await api().post(`${P}/sessions/${r.body.session.id}/cancel`).set(bearer(user.accessToken));
    const r2 = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', exclude: [first] });
    expect(r2.status).toBe(201);
    expect(r2.body.session.vendorId).not.toBe(first);

    // dono excluded: koi nahi
    await api().post(`${P}/sessions/${r2.body.session.id}/cancel`).set(bearer(user.accessToken));
    const r3 = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', exclude: [a.vendor.id, b.vendor.id] });
    expect(r3.status).toBe(409);
    expect(r3.body.error.code).toBe('NO_ONE_AVAILABLE');
  });

  it('pending request wala listener doosre user ko nahi milta', async () => {
    await db.update(vendors).set({ isOnline: false });
    const u1 = await funded();
    const u2 = await funded();
    await makeVendor();
    const r1 = await api().post(`${P}/random/connect`).set(bearer(u1.accessToken)).send({ type: 'AUDIO' });
    expect(r1.status).toBe(201);
    const r2 = await api().post(`${P}/random/connect`).set(bearer(u2.accessToken)).send({ type: 'AUDIO' });
    expect(r2.status).toBe(409);
  });

  it('kam balance par 402, aur offline/disabled seva wale nahi chunte', async () => {
    await db.update(vendors).set({ isOnline: false });
    const poor = await loginViaOtp();
    await makeVendor({ chatRate: 2000 });
    const r = await api().post(`${P}/random/connect`).set(bearer(poor.accessToken)).send({ type: 'CHAT' });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe('INSUFFICIENT_BALANCE');

    const rich = await funded();
    const off = await makeVendor({ online: false });
    await db.update(vendors).set({ isOnline: false }).where(eq(vendors.id, off.vendor.id));
    await db.update(vendors).set({ isOnline: false });
    const r2 = await api().post(`${P}/random/connect`).set(bearer(rich.accessToken)).send({ type: 'VIDEO' });
    expect(r2.status).toBe(409);
  });

  it('vendor is endpoint ko nahi chala sakta', async () => {
    const v = await makeVendor();
    const login = await loginViaOtp(v.phone, 'vendor');
    const r = await api().post(`${P}/random/connect`).set(bearer(login.accessToken)).send({ type: 'CHAT' });
    expect(r.status).toBe(403);
  });
});
