import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { io as ioClient, type Socket } from 'socket.io-client';
import { db } from '../src/db/client';
import { consultSessions, walletTransactions, wallets } from '../src/db/schema';
import { computeBilling, finalizeSession, sweepSessions } from '../src/modules/sessions/service';
import { attachSocket } from '../src/modules/sessions/socket';
import { app, api, balanceOf, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia } from './helpers';

describe('computeBilling', () => {
  const s = { ratePerMin: 2000, commissionPct: 30, maxSeconds: 600 };
  it('har shuru hua minute ginaa jaata hai', () => {
    expect(computeBilling(s, 0).charge).toBe(0);
    expect(computeBilling(s, 1).charge).toBe(2000);
    expect(computeBilling(s, 60).charge).toBe(2000);
    expect(computeBilling(s, 61).charge).toBe(4000);
  });
  it('maxSeconds se zyada kabhi nahi', () => {
    const b = computeBilling(s, 5000);
    expect(b.billedSeconds).toBe(600);
    expect(b.charge).toBe(20000);
  });
  it('commission ke baad vendor ka hissa', () => {
    const b = computeBilling(s, 125);
    expect(b.charge).toBe(6000);
    expect(b.vendorEarning).toBe(4200);
  });
});

async function setupPair(rate = 2000) {
  const user = await loginViaOtp();
  const pack = await ensurePack(100000, 0); // Rs 1000 -> 50 min @ Rs 20
  await rechargeVia(user.accessToken, pack.id);
  const astro = await makeVendor({ chatRate: rate });
  const astroLogin = await loginViaOtp(astro.phone, 'vendor');
  return { user, astro, astroLogin };
}

describe('Chat session ka poora flow + billing', () => {
  it('kam balance par session request nahi', async () => {
    const poor = await loginViaOtp();
    const astro = await makeVendor({ chatRate: 2000 });
    const r = await api().post(`${P}/sessions`).set(bearer(poor.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    expect(r.status).toBe(402);
    expect(r.body.error.details.required).toBe(10000);
  });

  it('request -> accept -> 2m5s -> end: 3 minute ka paisa, 70% vendor ko, hisaab barabar', async () => {
    const { user, astro, astroLogin } = await setupPair(2000);
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    expect(req.status).toBe(201);
    expect(req.body.status).toBe('REQUESTED');

    // doosra session ek saath nahi
    const again = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    expect(again.status).toBe(409);

    const acc = await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(astroLogin.accessToken));
    expect(acc.status).toBe(200);
    expect(acc.body.status).toBe('ACTIVE');
    expect(acc.body.maxSeconds).toBe(50 * 60);

    const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
    const done = await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 125_000));
    expect(done.status).toBe('COMPLETED');
    expect(done.chargedAmount).toBe(6000);

    expect(await balanceOf(user.user.id)).toBe(100000 - 6000);
    expect(await balanceOf(astro.user.id)).toBe(4200);

    // dobara end -> 409, koi double charge nahi
    const end2 = await api().post(`${P}/sessions/${s.id}/end`).set(bearer(user.accessToken));
    expect(end2.status).toBe(409);
    expect(await balanceOf(user.user.id)).toBe(94000);

    // ledger = wallet balance
    const [w] = await db.select().from(wallets).where(eq(wallets.userId, user.user.id));
    const [{ sum }] = await db
      .select({ sum: sql<number>`coalesce(sum(amount),0)::int` })
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, w.id));
    expect(sum).toBe(w.balance);

    // review: ek hi baar
    const r1 = await api().post(`${P}/sessions/${s.id}/review`).set(bearer(user.accessToken)).send({ rating: 5, comment: 'Bahut achha' });
    const r2 = await api().post(`${P}/sessions/${s.id}/review`).set(bearer(user.accessToken)).send({ rating: 1 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
  });

  it('balance khatam hote hi server session khud band karta hai', async () => {
    const { user, astro, astroLogin } = await setupPair(2000);
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(astroLogin.accessToken));
    const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
    await sweepSessions(new Date(s.acceptedAt!.getTime() + 51 * 60_000));
    const [after] = await db.select().from(consultSessions).where(eq(consultSessions.id, s.id));
    expect(after.status).toBe('COMPLETED');
    expect(after.endReason).toBe('BALANCE_EXHAUSTED');
    expect(after.chargedAmount).toBe(100000);
    expect(await balanceOf(user.user.id)).toBe(0);
  });

  it('session ke beech recharge karne par samay badhta hai', async () => {
    const { user, astro, astroLogin } = await setupPair(2000);
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    const acc = await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(astroLogin.accessToken));
    expect(acc.body.maxSeconds).toBe(50 * 60);
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const d = await api().get(`${P}/sessions/${req.body.id}`).set(bearer(user.accessToken));
    expect(d.body.maxSeconds).toBe(100 * 60);
    await api().post(`${P}/sessions/${req.body.id}/end`).set(bearer(user.accessToken));
  });

  it('dusre user ka session koi nahi dekh/band kar sakta; dusra vendor accept nahi kar sakta', async () => {
    const { user, astro } = await setupPair();
    const stranger = await loginViaOtp();
    const otherAstro = await makeVendor();
    const otherAstroLogin = await loginViaOtp(otherAstro.phone, 'vendor');
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    expect((await api().get(`${P}/sessions/${req.body.id}`).set(bearer(stranger.accessToken))).status).toBe(404);
    expect((await api().get(`${P}/sessions/${req.body.id}/messages`).set(bearer(stranger.accessToken))).status).toBe(404);
    expect((await api().post(`${P}/sessions/${req.body.id}/end`).set(bearer(stranger.accessToken))).status).toBe(404);
    expect((await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(otherAstroLogin.accessToken))).status).toBe(404);
    await api().post(`${P}/sessions/${req.body.id}/cancel`).set(bearer(user.accessToken));
  });

  it('offline vendor ko request nahi', async () => {
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const astro = await makeVendor({ online: false });
    const r = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    expect(r.status).toBe(409);
  });

  it('call token sirf ACTIVE call ke participants ko', async () => {
    const { user, astro, astroLogin } = await setupPair();
    const stranger = await loginViaOtp();
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'AUDIO' });
    expect(req.status).toBe(201);
    expect((await api().post(`${P}/sessions/${req.body.id}/rtc-token`).set(bearer(user.accessToken))).status).toBe(409);
    await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(astroLogin.accessToken));
    const t = await api().post(`${P}/sessions/${req.body.id}/rtc-token`).set(bearer(user.accessToken));
    expect(t.status).toBe(200);
    expect(t.body.channel).toBe(req.body.id);
    expect(t.body.token.length).toBeGreaterThan(50);
    expect((await api().post(`${P}/sessions/${req.body.id}/rtc-token`).set(bearer(stranger.accessToken))).status).toBe(404);
    await api().post(`${P}/sessions/${req.body.id}/end`).set(bearer(user.accessToken));
  });
});

describe('Real-time chat (Socket.IO)', () => {
  let server: http.Server;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = http.createServer(app);
    attachSocket(server, true);
    await new Promise<void>((r) => server.listen(0, r));
    url = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await new Promise((r) => server.close(r));
  });

  const connect = (token?: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = ioClient(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', (e) => reject(e));
    });
  const emit = <T>(s: Socket, ev: string, data: unknown) => new Promise<T>((r) => s.emit(ev, data, r));

  it('bina token connect nahi', async () => {
    await expect(connect()).rejects.toThrow('UNAUTHORIZED');
  });

  it('participants baat kar sakte hain; phone number chhup jaata hai; bahar wala room join nahi kar sakta', async () => {
    const { user, astro, astroLogin } = await setupPair();
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: astro.vendor.id, type: 'CHAT' });
    await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(astroLogin.accessToken));

    const us = await connect(user.accessToken);
    const as = await connect(astroLogin.accessToken);
    expect((await emit<{ ok: boolean }>(us, 'session:join', { sessionId: req.body.id })).ok).toBe(true);
    expect((await emit<{ ok: boolean }>(as, 'session:join', { sessionId: req.body.id })).ok).toBe(true);

    const got = new Promise<{ body: string }>((r) => as.once('chat:message', r));
    const ack = await emit<{ ok: boolean; masked: boolean }>(us, 'chat:send', {
      sessionId: req.body.id,
      body: 'Namaste, mera number 98765 43210 hai, whatsapp karna',
    });
    expect(ack.ok).toBe(true);
    expect(ack.masked).toBe(true);
    const m = await got;
    expect(m.body).not.toContain('98765');
    expect(m.body.toLowerCase()).not.toContain('whatsapp');

    const stranger = await loginViaOtp();
    const ss = await connect(stranger.accessToken);
    expect((await emit<{ ok: boolean }>(ss, 'session:join', { sessionId: req.body.id })).ok).toBe(false);
    expect((await emit<{ ok: boolean }>(ss, 'chat:send', { sessionId: req.body.id, body: 'hi' })).ok).toBe(false);

    await api().post(`${P}/sessions/${req.body.id}/end`).set(bearer(user.accessToken));
    // session khatam hone ke baad message nahi
    expect((await emit<{ ok: boolean }>(us, 'chat:send', { sessionId: req.body.id, body: 'hello?' })).ok).toBe(false);
  });
});
