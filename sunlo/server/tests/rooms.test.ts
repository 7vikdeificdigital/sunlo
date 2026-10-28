import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/db/client';
import { vendors } from '../src/db/schema';
import { roomMembers, rooms } from '../src/modules/rooms/schema';
import { sweepRooms } from '../src/modules/rooms/service';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia } from './helpers';

describe('Live rooms', () => {
  beforeAll(async () => {
    await db.update(vendors).set({ isOnline: false });
  });

  async function funded(amount = 100000) {
    const user = await loginViaOtp();
    const pack = await ensurePack(amount, 0);
    await rechargeVia(user.accessToken, pack.id);
    return user;
  }
  async function host() {
    const m = await makeVendor();
    const t = await loginViaOtp(m.phone, 'vendor');
    return { ...m, token: t.accessToken };
  }

  it('host room banata hai, user list mein dekh kar join karta hai', async () => {
    const h = await host();
    const r = await api().post(`${P}/vendor/rooms`).set(bearer(h.token)).send({ title: 'Raat ki baatein', type: 'AUDIO', ratePerMin: 1 });
    expect(r.status).toBe(201);
    expect(r.body.ratePerMin).toBe(3000); // client ka rate nahi, vendor ka call rate
    const dup = await api().post(`${P}/vendor/rooms`).set(bearer(h.token)).send({ title: 'Doosra', type: 'VIDEO', });
    expect(dup.status).toBe(409);

    const user = await funded();
    const list = await api().get(`${P}/rooms`).set(bearer(user.accessToken));
    expect(list.body.items.map((x: { id: string }) => x.id)).toContain(r.body.id);
    const j = await api().post(`${P}/rooms/${r.body.id}/join`).set(bearer(user.accessToken));
    expect(j.status).toBe(201);
    expect(j.body.maxSeconds).toBe(Math.floor(100000 / 3000) * 60);
    const tok = await api().post(`${P}/rooms/${r.body.id}/rtc-token`).set(bearer(user.accessToken));
    expect([200, 503]).toContain(tok.status); // Agora keys test env mein na hon to 503
    const cur = await api().get(`${P}/vendor/rooms/current`).set(bearer(h.token));
    expect(cur.body.listeners).toHaveLength(1);
    // turant nikla to ek minute ka hisaab
    await api().post(`${P}/rooms/${r.body.id}/leave`).set(bearer(user.accessToken));
  });

  it('paid room: balance kam ho to nahi, warna leave par minute ke hisaab se katta hai, host ko commission ke baad', async () => {
    const h = await host();
    const r = await api().post(`${P}/vendor/rooms`).set(bearer(h.token)).send({ title: 'Paid room', type: 'VIDEO' });
    expect(r.status).toBe(201);
    const poor = await loginViaOtp();
    const no = await api().post(`${P}/rooms/${r.body.id}/join`).set(bearer(poor.accessToken));
    expect(no.status).toBe(402);

    const user = await funded();
    const before = await balanceOf(user.user.id);
    const j = await api().post(`${P}/rooms/${r.body.id}/join`).set(bearer(user.accessToken));
    expect(j.status).toBe(201);
    expect(j.body.maxSeconds).toBe(Math.floor(before / 4000) * 60);
    // 3 minute pehle ghusa tha
    await db.update(roomMembers).set({ joinedAt: new Date(Date.now() - 170_000) }).where(and(eq(roomMembers.userId, user.user.id), isNull(roomMembers.leftAt)));
    const lv = await api().post(`${P}/rooms/${r.body.id}/leave`).set(bearer(user.accessToken));
    expect(lv.body.chargedAmount).toBe(12000);
    expect(await balanceOf(user.user.id)).toBe(before - 12000);
    expect(await balanceOf(h.user.id)).toBeGreaterThan(0);
  });

  it('ek user ek hi room mein; kick ke baad dobara nahi; host end kare to sab bahar', async () => {
    const h1 = await host();
    const h2 = await host();
    const a = (await api().post(`${P}/vendor/rooms`).set(bearer(h1.token)).send({ title: 'Room A', type: 'AUDIO', })).body;
    const b = (await api().post(`${P}/vendor/rooms`).set(bearer(h2.token)).send({ title: 'Room B', type: 'AUDIO', })).body;
    const u = await funded();
    expect((await api().post(`${P}/rooms/${a.id}/join`).set(bearer(u.accessToken))).status).toBe(201);
    expect((await api().post(`${P}/rooms/${b.id}/join`).set(bearer(u.accessToken))).status).toBe(409);
    expect((await api().post(`${P}/vendor/rooms/${a.id}/kick`).set(bearer(h1.token)).send({ userId: u.user.id })).status).toBe(200);
    expect((await api().post(`${P}/rooms/${a.id}/join`).set(bearer(u.accessToken))).status).toBe(403);
    // doosre room mein ab ja sakta hai; host end karta hai
    expect((await api().post(`${P}/rooms/${b.id}/join`).set(bearer(u.accessToken))).status).toBe(201);
    expect((await api().post(`${P}/vendor/rooms/${b.id}/end`).set(bearer(h2.token))).status).toBe(200);
    const [row] = await db.select().from(rooms).where(eq(rooms.id, b.id));
    expect(row.status).toBe('ENDED');
    expect((await api().post(`${P}/rooms/${b.id}/join`).set(bearer(u.accessToken))).status).toBe(409);
  });

  it('room mein gift: host ko kamai, sweep balance khatam wale ko bahar karta hai', async () => {
    const h = await host();
    const r = (await api().post(`${P}/vendor/rooms`).set(bearer(h.token)).send({ title: 'Gift room', type: 'AUDIO' })).body;
    const u = await funded(50000);
    await api().post(`${P}/rooms/${r.id}/join`).set(bearer(u.accessToken));
    const gl = await api().get(`${P}/gifts`).set(bearer(u.accessToken));
    const g = gl.body.items[0];
    const bal = await balanceOf(u.user.id);
    const gs = await api().post(`${P}/rooms/${r.id}/gifts`).set(bearer(u.accessToken)).send({ giftId: g.id });
    expect(gs.status).toBe(201);
    expect(await balanceOf(u.user.id)).toBe(bal - g.price);
    expect(await balanceOf(h.user.id)).toBeGreaterThan(0);
    // balance khatam hone ka samay beet gaya
    await db.update(roomMembers).set({ joinedAt: new Date(Date.now() - 100 * 3600_000) }).where(and(eq(roomMembers.userId, u.user.id), isNull(roomMembers.leftAt)));
    const sw = await sweepRooms();
    expect(sw.kicked).toBeGreaterThanOrEqual(1);
    const [m] = await db.select().from(roomMembers).where(eq(roomMembers.userId, u.user.id));
    expect(m.leaveReason).toBe('BALANCE_EXHAUSTED');
  });

  it('host room mein ho to usse 1:1 request nahi ja sakti', async () => {
    const h = await host();
    await api().post(`${P}/vendor/rooms`).set(bearer(h.token)).send({ title: 'Busy room', type: 'AUDIO', });
    const u = await funded();
    const r = await api().post(`${P}/sessions`).set(bearer(u.accessToken)).send({ vendorId: h.vendor.id, type: 'CHAT' });
    expect(r.status).toBe(409);
    expect(r.body.error?.code ?? r.body.code).toBe('VENDOR_BUSY');
  });
});
