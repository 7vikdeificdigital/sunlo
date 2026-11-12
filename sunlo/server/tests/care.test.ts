import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { consultSessions, moodCheckins, scheduledCalls, users, vendors } from '../src/db/schema';
import { istNow, sweepCheckinReminders, sweepScheduledCalls } from '../src/modules/compliance/jobs';
import { finalizeSession } from '../src/modules/sessions/service';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeVendor, P, rechargeVia, setSettings } from './helpers';

describe('Pehle 5 minute free', () => {
  beforeAll(async () => setSettings({ freeTrialMinutes: 5, freeTrialMaxRatePaise: 2000, tdsEnabled: false }));
  afterAll(async () => setSettings({ freeTrialMinutes: 0 }));

  it('naya user bina balance ke 5 min free; vendor ko poori kamai; dobara nahi', async () => {
    const user = await loginViaOtp();
    const v = await makeVendor({ chatRate: 2000 });
    const vl = await loginViaOtp(v.phone, 'vendor');
    const q = await api().get(`${P}/sessions/quote`).query({ vendorId: v.vendor.id, type: 'CHAT' }).set(bearer(user.accessToken));
    expect(q.body.freeTrial.minutes).toBe(5);
    expect(q.body.requiredBalance).toBe(0);
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    expect(req.status).toBe(201);
    expect(req.body.freeSeconds).toBe(300);
    const acc = await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(vl.accessToken));
    expect(acc.body.status).toBe('ACTIVE');
    expect(acc.body.maxSeconds).toBe(300);
    const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
    const done = await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 170_000));
    expect(done.chargedAmount).toBe(0);
    expect(done.promoAmount).toBe(6000);
    expect(await balanceOf(v.user.id)).toBe(4200);
    const rec = await api().get(`${P}/sessions/${s.id}/receipt`).set(bearer(user.accessToken));
    expect(rec.body).toMatchObject({ freeMinutes: 3, charged: 0, grossAmount: 6000 });

    // Trial ek hi baar: ab balance chahiye
    const again = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    expect(again.status).toBe(402);
  });

  it('trial ke baad paid minute katte hain; mehenge listener aur video par trial nahi', async () => {
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const v = await makeVendor({ chatRate: 2000 });
    const vl = await loginViaOtp(v.phone, 'vendor');
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    const acc = await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(vl.accessToken));
    expect(acc.body.maxSeconds).toBe(300 + 50 * 60);
    const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
    const done = await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 6.5 * 60_000));
    expect(done.chargedAmount).toBe(4000); // 7 minute mein 5 free, 2 paid
    expect(done.promoAmount).toBe(10000);
    expect(await balanceOf(user.user.id)).toBe(96000);
    expect(await balanceOf(v.user.id)).toBe(Math.round(14000 * 0.7));

    const u2 = await loginViaOtp();
    const pricey = await makeVendor({ chatRate: 5000 });
    expect((await api().get(`${P}/sessions/quote`).query({ vendorId: pricey.vendor.id, type: 'CHAT' }).set(bearer(u2.accessToken))).body.freeTrial).toBeNull();
    expect((await api().get(`${P}/sessions/quote`).query({ vendorId: v.vendor.id, type: 'VIDEO' }).set(bearer(u2.accessToken))).body.freeTrial).toBeNull();
  });

  it('account delete karke usi number se dobara trial nahi', async () => {
    const user = await loginViaOtp();
    const v = await makeVendor({ chatRate: 1500 });
    const vl = await loginViaOtp(v.phone, 'vendor');
    const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT' });
    expect(req.status).toBe(201);
    await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(vl.accessToken));
    await finalizeSession(req.body.id, 'USER_ENDED');
    await api().delete(`${P}/me`).set(bearer(user.accessToken));
    await db.execute(sql`update otp_codes set created_at = now() - interval '2 minutes' where phone = ${user.phone}`); // OTP resend gap
    const again = await loginViaOtp(user.phone);
    expect(again.isNewUser).toBe(true);
    const q = await api().get(`${P}/sessions/quote`).query({ vendorId: v.vendor.id, type: 'CHAT' }).set(bearer(again.accessToken));
    expect(q.body.freeTrial).toBeNull();
  });
});

describe('Mood se match', () => {
  beforeAll(async () => {
    await db.update(vendors).set({ isOnline: false });
  });

  it('mood + "sirf mahila listener": topic wala female listener; topic na mile to bhi sirf female', async () => {
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const femaleBreakup = await makeVendor({ gender: 'FEMALE', tags: ['Breakup', 'Rishte'] });
    await makeVendor({ gender: 'MALE', tags: ['breakup'] });
    const femaleOther = await makeVendor({ gender: 'FEMALE', tags: ['Cooking'] });
    const r = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', mood: 'breakup', listenerGender: 'FEMALE' });
    expect(r.status).toBe(201);
    expect(r.body.session.vendorId).toBe(femaleBreakup.vendor.id);
    expect(r.body.match).toEqual({ mood: 'breakup', onTopic: true });
    const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, r.body.session.id));
    expect((s.intake as { topic: string }).topic).toBe('Breakup / dil toota');
    await api().post(`${P}/sessions/${s.id}/cancel`).set(bearer(user.accessToken));

    const r2 = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', mood: 'homesick', listenerGender: 'FEMALE', exclude: [femaleBreakup.vendor.id] });
    expect(r2.status).toBe(201);
    expect(r2.body.session.vendorId).toBe(femaleOther.vendor.id);
    expect(r2.body.match.onTopic).toBe(false);
    await api().post(`${P}/sessions/${r2.body.session.id}/cancel`).set(bearer(user.accessToken));

    const none = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', listenerGender: 'FEMALE', exclude: [femaleBreakup.vendor.id, femaleOther.vendor.id] });
    expect(none.status).toBe(409);
    expect((await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'CHAT', mood: 'galat' })).status).toBe(400);
  });
});

describe('Call schedule', () => {
  it('book -> listener confirm -> reminder -> samay par shuru -> accept par COMPLETED', async () => {
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const v = await makeVendor({ chatRate: 2000 });
    const vl = await loginViaOtp(v.phone, 'vendor');
    const soon = await api().post(`${P}/scheduled-calls`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'AUDIO', scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString(), durationMin: 30 });
    expect(soon.status).toBe(400);
    const at = new Date(Date.now() + 2 * 3600_000);
    const b = await api().post(`${P}/scheduled-calls`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'AUDIO', scheduledAt: at.toISOString(), durationMin: 30, note: 'Naukri ke baare mein' });
    expect(b.status).toBe(201);
    expect(b.body).toMatchObject({ status: 'PENDING', estimatedCost: 90000, balanceEnough: true });

    // Usi samay doosri booking nahi
    const u2 = await loginViaOtp();
    const clash = await api().post(`${P}/scheduled-calls`).set(bearer(u2.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT', scheduledAt: new Date(at.getTime() + 10 * 60_000).toISOString(), durationMin: 15 });
    expect(clash.status).toBe(409);

    const vlist = await api().get(`${P}/vendor/scheduled-calls`).set(bearer(vl.accessToken));
    expect(vlist.body.items[0].userName).not.toContain(' ');
    const conf = await api().post(`${P}/vendor/scheduled-calls/${b.body.id}/confirm`).set(bearer(vl.accessToken));
    expect(conf.body.status).toBe('CONFIRMED');
    expect((await api().post(`${P}/scheduled-calls/${b.body.id}/start`).set(bearer(user.accessToken))).status).toBe(409); // abhi samay nahi

    // Samay paas: reminder + shuru
    await db.update(scheduledCalls).set({ scheduledAt: new Date(Date.now() + 5 * 60_000) }).where(eq(scheduledCalls.id, b.body.id));
    const sw = await sweepScheduledCalls();
    expect(sw.reminded).toBe(1);
    expect((await sweepScheduledCalls()).reminded).toBe(0);
    const list = await api().get(`${P}/scheduled-calls`).set(bearer(user.accessToken));
    expect(list.body.items[0].canStart).toBe(true);
    const st = await api().post(`${P}/scheduled-calls/${b.body.id}/start`).set(bearer(user.accessToken));
    expect(st.status).toBe(201);
    await api().post(`${P}/vendor/sessions/${st.body.session.id}/accept`).set(bearer(vl.accessToken));
    const [c] = await db.select().from(scheduledCalls).where(eq(scheduledCalls.id, b.body.id));
    expect(c.status).toBe('COMPLETED');
    expect(c.sessionId).toBe(st.body.session.id);
    await finalizeSession(st.body.session.id, 'USER_ENDED');

    // Kisi aur ki booking cancel nahi kar sakte; samay nikal jaaye to MISSED
    const b2 = await api().post(`${P}/scheduled-calls`).set(bearer(u2.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT', scheduledAt: new Date(Date.now() + 5 * 3600_000).toISOString(), durationMin: 15 });
    expect((await api().post(`${P}/scheduled-calls/${b2.body.id}/cancel`).set(bearer(user.accessToken))).status).toBe(404);
    await db.update(scheduledCalls).set({ scheduledAt: new Date(Date.now() - 3600_000) }).where(eq(scheduledCalls.id, b2.body.id));
    expect((await sweepScheduledCalls()).missed).toBeGreaterThanOrEqual(1);
  });

  it('listener decline kare to user ko wajah; ek user 3 se zyada booking nahi', async () => {
    const user = await loginViaOtp();
    const v = await makeVendor();
    const vl = await loginViaOtp(v.phone, 'vendor');
    const mk = (h: number) =>
      api().post(`${P}/scheduled-calls`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT', scheduledAt: new Date(Date.now() + h * 3600_000).toISOString(), durationMin: 15 });
    const a = await mk(2);
    await mk(4);
    await mk(6);
    expect((await mk(8)).status).toBe(409);
    const d = await api().post(`${P}/vendor/scheduled-calls/${a.body.id}/decline`).set(bearer(vl.accessToken)).send({ reason: 'Us din chhutti' });
    expect(d.body.status).toBe('DECLINED');
    expect(d.body.declineReason).toBe('Us din chhutti');
  });
});

describe('Roz ka mood check-in', () => {
  it('check-in, streak, note encrypted, lagaatar udaas din par narm sujhav', async () => {
    const user = await loginViaOtp();
    const c = await api().post(`${P}/checkins`).set(bearer(user.accessToken)).send({ mood: 2, note: 'neend nahi aayi' });
    expect(c.status).toBe(201);
    expect(c.body.streak).toBe(1);
    expect(c.body.suggestion).toBeNull();
    const [row] = await db.select().from(moodCheckins).where(eq(moodCheckins.userId, user.user.id));
    expect(row.noteEnc).not.toContain('neend');
    // Pichhle 2 din bhi udaas
    const { day } = istNow();
    const back = (n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() - n * 86400_000).toISOString().slice(0, 10);
    await db.insert(moodCheckins).values([
      { userId: user.user.id, day: back(1), mood: 1 },
      { userId: user.user.id, day: back(2), mood: 2 },
    ]);
    const g = await api().get(`${P}/checkins`).set(bearer(user.accessToken));
    expect(g.body.streak).toBe(3);
    expect(g.body.checkedInToday).toBe(true);
    expect(g.body.suggestion.helpline.phone).toBe('14416');
    expect(g.body.items[0].note).toBe('neend nahi aayi');
    // Ek din mein ek hi (update hota hai)
    await api().post(`${P}/checkins`).set(bearer(user.accessToken)).send({ mood: 5 });
    const g2 = await api().get(`${P}/checkins`).set(bearer(user.accessToken));
    expect(g2.body.items.filter((i: { day: string }) => i.day === day)).toHaveLength(1);
    expect(g2.body.suggestion).toBeNull();
    expect((await api().post(`${P}/checkins`).set(bearer(user.accessToken)).send({ mood: 9 })).status).toBe(400);
  });

  it('raat 9:30 IST reminder sirf marzi wale ko, din mein ek baar, check-in kar liya ho to nahi', async () => {
    const yes = await loginViaOtp();
    const done = await loginViaOtp();
    await loginViaOtp(); // reminder band (default)
    await api().patch(`${P}/me`).set(bearer(yes.accessToken)).send({ checkinReminder: true });
    await api().patch(`${P}/me`).set(bearer(done.accessToken)).send({ checkinReminder: true });
    await api().post(`${P}/checkins`).set(bearer(done.accessToken)).send({ mood: 4 });
    await db.update(users).set({ checkinReminder: false }).where(sql`${users.id} not in (${yes.user.id}, ${done.user.id})`);
    // 21:45 IST = 16:15 UTC (aaj)
    const { day } = istNow();
    const at = new Date(`${day}T16:15:00Z`);
    expect(await sweepCheckinReminders(new Date(`${day}T10:00:00Z`))).toBe(0); // dopahar mein nahi
    expect(await sweepCheckinReminders(at)).toBe(1);
    expect(await sweepCheckinReminders(at)).toBe(0);
    const [u] = await db.select().from(users).where(eq(users.id, yes.user.id));
    expect(u.checkinRemindedOn).toBe(day);
  });
});
