import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { auditLogs, chatMessages, consultSessions, notifications, reports, supportTickets, users, walletTransactions, wallets } from '../src/db/schema';
import { totpCode } from '../src/lib/totp';
import { hashPassword, randomReferralCode } from '../src/lib/crypto';
import { purgeOldChats, sweepCompliance } from '../src/modules/compliance/jobs';
import { finalizeSession, sweepSessions } from '../src/modules/sessions/service';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeAdmin, makeVendor, P, rechargeVia, setSettings } from './helpers';

async function activeSession(rate = 2000, opts: { pan?: boolean } = {}) {
  const user = await loginViaOtp();
  await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
  const v = await makeVendor({ chatRate: rate, pan: opts.pan });
  const vl = await loginViaOtp(v.phone, 'vendor');
  const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'CHAT', pricingAck: true });
  expect(req.status).toBe(201);
  const acc = await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(vl.accessToken));
  expect(acc.status).toBe(200);
  const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
  return { user, v, vl, s };
}

describe('Grievance (IT Rules 2026)', () => {
  it('Grievance Officer public endpoint aur app config mein; admin set kar sakta hai', async () => {
    const admin = await makeAdmin();
    const up = await api()
      .patch(`${P}/admin/settings`)
      .set(bearer(admin.accessToken))
      .send({ grievanceOfficerName: 'Aaryan Singh', grievanceOfficerEmail: 'grievance@bondty.com', grievanceOfficerPhone: '+91 9250119045', grievanceAddress: 'Kanpur, UP' });
    expect(up.status).toBe(200);
    expect((await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ grievanceOfficerEmail: 'galat' })).status).toBe(400);
    const g = await api().get(`${P}/grievance`);
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ officerName: 'Aaryan Singh', email: 'grievance@bondty.com', resolveWithinDays: 7, unlawfulContentWithinHours: 36 });
    const cfg = await api().get(`${P}/app/config`);
    expect(cfg.body.grievance.officerName).toBe('Aaryan Singh');
    expect(cfg.body.moods.length).toBeGreaterThan(3);
    expect(cfg.body.settings.liveRoomsEnabled).toBeTypeOf('boolean');
  });

  it('ticket par turant pavti, 7 din ki deadline; ghair-kanooni content 36 ghante; admin ko SLA list', async () => {
    const user = await loginViaOtp();
    const t = await api().post(`${P}/support/tickets`).set(bearer(user.accessToken)).send({ subject: 'Refund nahi mila', message: 'Kal ka session' , category: 'PAYMENT' });
    expect(t.status).toBe(201);
    expect(t.body.ticketNo).toMatch(/^GR-/);
    expect(t.body.acknowledgedAt).toBeTruthy();
    const due = new Date(t.body.dueAt).getTime() - new Date(t.body.createdAt).getTime();
    expect(Math.round(due / 86400_000)).toBe(7);
    const u2 = await api().post(`${P}/support/tickets`).set(bearer(user.accessToken)).send({ subject: 'Ashleel profile photo', message: 'Is listener ki photo', category: 'UNLAWFUL_CONTENT' });
    expect(Math.round((new Date(u2.body.dueAt).getTime() - new Date(u2.body.createdAt).getTime()) / 3600_000)).toBe(36);
    const n = await db.select().from(notifications).where(eq(notifications.userId, user.user.id));
    expect(n.some((x) => x.title === 'Aapki shikayat mil gayi')).toBe(true);

    // Ek ticket ko purana karke overdue banao
    await db.update(supportTickets).set({ dueAt: new Date(Date.now() - 3600_000) }).where(eq(supportTickets.id, t.body.id));
    const admin = await makeAdmin();
    const list = await api().get(`${P}/admin/grievances`).set(bearer(admin.accessToken));
    expect(list.status).toBe(200);
    const mine = list.body.items.find((x: { id: string }) => x.id === t.body.id);
    expect(mine.overdue).toBe(true);
    const ov = await api().get(`${P}/admin/compliance/overview`).set(bearer(admin.accessToken));
    expect(ov.body.tickets.overdue).toBeGreaterThanOrEqual(1);
    expect(ov.body.checks.find((c: { key: string }) => c.key === 'tickets_sla').ok).toBe(false);
    await api().post(`${P}/admin/tickets/${t.body.id}/close`).set(bearer(admin.accessToken));
    const [closed] = await db.select().from(supportTickets).where(eq(supportTickets.id, t.body.id));
    expect(closed.closedAt).toBeTruthy();
    // User doosre ka ticket list mein nahi dekh sakta; admin API user ke liye band
    expect((await api().get(`${P}/admin/grievances`).set(bearer(user.accessToken))).status).toBe(403);
  });

  it('report par 36 ghante ki deadline', async () => {
    const user = await loginViaOtp();
    const v = await makeVendor();
    const r = await api().post(`${P}/reports`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, reason: 'HARASSMENT' });
    const [row] = await db.select().from(reports).where(eq(reports.id, r.body.id));
    expect(Math.round((row.dueAt!.getTime() - row.createdAt.getTime()) / 3600_000)).toBe(36);
  });
});

describe('Feature switches', () => {
  afterAll(async () => setSettings({ liveRoomsEnabled: true, randomVideoEnabled: true, videoCallsEnabled: true, giftsEnabled: true }));

  it('Live Rooms band: room nahi banta, list khaali; random video band; video call band', async () => {
    await setSettings({ liveRoomsEnabled: false, randomVideoEnabled: false, videoCallsEnabled: false });
    const v = await makeVendor();
    const vl = await loginViaOtp(v.phone, 'vendor');
    const room = await api().post(`${P}/vendor/rooms`).set(bearer(vl.accessToken)).send({ title: 'Raat ki baatein', type: 'AUDIO' });
    expect(room.status).toBe(403);
    expect(room.body.error.code).toBe('FEATURE_OFF');
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    expect((await api().get(`${P}/rooms`).set(bearer(user.accessToken))).body.items).toEqual([]);
    const rv = await api().post(`${P}/random/connect`).set(bearer(user.accessToken)).send({ type: 'VIDEO' });
    expect(rv.status).toBe(403);
    expect((await api().get(`${P}/random/overview`).set(bearer(user.accessToken))).body.VIDEO.online).toBe(0);
    const vid = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: v.vendor.id, type: 'VIDEO' });
    expect(vid.status).toBe(403);
  });
});

describe('Keemat saaf (CCPA) + raseed + TDS', () => {
  afterAll(async () => setSettings({ tdsEnabled: false }));

  it('quote: rate, GST, gol-gaanth note, kitne minute milenge', async () => {
    const user = await loginViaOtp();
    await rechargeVia(user.accessToken, (await ensurePack(100000, 0)).id);
    const v = await makeVendor({ chatRate: 2000 });
    const q = await api().get(`${P}/sessions/quote`).query({ vendorId: v.vendor.id, type: 'CHAT' }).set(bearer(user.accessToken));
    expect(q.status).toBe(200);
    expect(q.body).toMatchObject({ ratePerMin: 2000, gstPct: 18, ratePerMinInclGst: 2360, maxMinutes: 50, requiredBalance: 10000, freeTrial: null });
    expect(q.body.roundingNote).toContain('minute');
  });

  it('session ke baad raseed; vendor ki kamai se 0.1% TDS (PAN) / 5% (bina PAN); ledger barabar', async () => {
    await setSettings({ tdsEnabled: true });
    const { user, vl, v, s } = await activeSession(2000);
    expect(s.pricingAckAt).toBeTruthy();
    await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 125_000));
    const ur = await api().get(`${P}/sessions/${s.id}/receipt`).set(bearer(user.accessToken));
    expect(ur.status).toBe(200);
    expect(ur.body).toMatchObject({ billedMinutes: 3, ratePerMin: 2000, grossAmount: 6000, charged: 6000, net: 6000, freeMinutes: 0 });
    expect(ur.body).not.toHaveProperty('tds');
    const vr = await api().get(`${P}/sessions/${s.id}/receipt`).set(bearer(vl.accessToken));
    expect(vr.body).toMatchObject({ earning: 4200, commission: 1800, tds: 6, net: 4194 });
    expect(await balanceOf(v.user.id)).toBe(4194);
    const [w] = await db.select().from(wallets).where(eq(wallets.userId, v.user.id));
    const tdsRows = await db.select().from(walletTransactions).where(and(eq(walletTransactions.walletId, w.id), eq(walletTransactions.type, 'TDS')));
    expect(tdsRows).toHaveLength(1);
    expect(tdsRows[0].amount).toBe(-6);

    const noPan = await activeSession(2000, { pan: false });
    await finalizeSession(noPan.s.id, 'USER_ENDED', undefined, new Date(noPan.s.acceptedAt!.getTime() + 125_000));
    expect(await balanceOf(noPan.v.user.id)).toBe(4200 - 300); // 5% of 6000

    // Vendor statement
    const month = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
    const st = await api().get(`${P}/vendor/statement`).query({ month }).set(bearer(vl.accessToken));
    expect(st.status).toBe(200);
    expect(st.body).toMatchObject({ gross: 6000, earning: 4200, tds: 6, net: 4194, commission: 1800 });
    expect(st.body.pan).toBe('XXXXXX234F');
    // Raseed sirf participants ko
    const stranger = await loginViaOtp();
    expect((await api().get(`${P}/sessions/${s.id}/receipt`).set(bearer(stranger.accessToken))).status).toBe(404);
  });

  it('PAN ke bina withdrawal nahi', async () => {
    const v = await makeVendor({ pan: false });
    const vl = await loginViaOtp(v.phone, 'vendor');
    await api().put(`${P}/vendor/payout-account`).set(bearer(vl.accessToken)).send({ method: 'UPI', upiId: 'test.vendor@okhdfc' });
    const w = await api().post(`${P}/vendor/withdrawals`).set(bearer(vl.accessToken)).send({ amount: 50000 });
    expect(w.status).toBe(400);
    expect(w.body.error.code).toBe('PAN_REQUIRED');
  });

  it('balance khatam hone se 1 minute pehle ek baar chetavani', async () => {
    const { s } = await activeSession(2000);
    const max = s.maxSeconds!;
    const r1 = await sweepSessions(new Date(s.acceptedAt!.getTime() + (max - 120) * 1000));
    const [a] = await db.select().from(consultSessions).where(eq(consultSessions.id, s.id));
    expect(a.lowBalanceWarnedAt).toBeNull();
    await sweepSessions(new Date(s.acceptedAt!.getTime() + (max - 50) * 1000));
    const [b] = await db.select().from(consultSessions).where(eq(consultSessions.id, s.id));
    expect(b.lowBalanceWarnedAt).toBeTruthy();
    expect(r1.warned).toBe(0);
    await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 60_000));
  });

  it('TDS report (JSON + CSV mein poora PAN, audit ke saath)', async () => {
    const admin = await makeAdmin();
    const from = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    const j = await api().get(`${P}/admin/tds-report`).query({ from, to }).set(bearer(admin.accessToken));
    expect(j.status).toBe(200);
    expect(j.body.totals.tds).toBeGreaterThanOrEqual(306);
    expect(JSON.stringify(j.body)).not.toContain('ABCDE1234F');
    const c = await api().get(`${P}/admin/tds-report`).query({ from, to, format: 'csv' }).set(bearer(admin.accessToken));
    expect(c.status).toBe(200);
    expect(c.text).toContain('ABCDE1234F');
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.adminId, admin.user.id), eq(auditLogs.action, 'tds.export')));
    expect(logs).toHaveLength(1);
  });
});

describe('DPDP: umar, sahmati, data export, mitana, chat retention', () => {
  it('janm-tithi se 18+ jaanch: naabaalig ki tareekh save nahi', async () => {
    const user = await loginViaOtp();
    const me = await api().get(`${P}/me`).set(bearer(user.accessToken));
    expect(me.body.needsDob).toBe(true);
    expect(me.body.needsConsent).toBe(true);
    const y = new Date().getFullYear();
    const minor = await api().patch(`${P}/me`).set(bearer(user.accessToken)).send({ dateOfBirth: `${y - 15}-01-01` });
    expect(minor.status).toBe(403);
    expect(minor.body.error.code).toBe('AGE_BELOW_18');
    const [u] = await db.select().from(users).where(eq(users.id, user.user.id));
    expect(u.dateOfBirth).toBeNull();
    expect((await api().patch(`${P}/me`).set(bearer(user.accessToken)).send({ dateOfBirth: '2001-02-30' })).status).toBe(400);
    const ok = await api().patch(`${P}/me`).set(bearer(user.accessToken)).send({ dateOfBirth: `${y - 25}-06-15`, name: 'Ravi Kumar' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.ageConfirmed).toBe(true);
  });

  it('privacy notice par sahmati (sirf current version)', async () => {
    const user = await loginViaOtp();
    expect((await api().post(`${P}/me/consent`).set(bearer(user.accessToken)).send({ version: 'purana' })).status).toBe(400);
    const cfg = await api().get(`${P}/app/config`);
    const ok = await api().post(`${P}/me/consent`).set(bearer(user.accessToken)).send({ version: cfg.body.settings.policyVersion });
    expect(ok.status).toBe(200);
    expect(ok.body.user.consentVersion).toBe(cfg.body.settings.policyVersion);
    expect((await api().get(`${P}/me`).set(bearer(user.accessToken))).body.needsConsent).toBe(false);
  });

  it('data export: apni jaankari; doosre ke messages nahi', async () => {
    const { user, vl, s } = await activeSession(2000);
    await db.insert(chatMessages).values([
      { sessionId: s.id, senderId: user.user.id, body: 'meri baat' },
      { sessionId: s.id, senderId: vl.user.id, body: 'listener ki baat' },
    ]);
    await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 61_000));
    await api().post(`${P}/checkins`).set(bearer(user.accessToken)).send({ mood: 4, note: 'aaj achha laga' });
    const ex = await api().get(`${P}/me/export`).set(bearer(user.accessToken));
    expect(ex.status).toBe(200);
    expect(ex.headers['content-disposition']).toContain('attachment');
    expect(ex.body.sessions).toHaveLength(1);
    expect(ex.body.myChatMessages.map((m: { body: string }) => m.body)).toEqual(['meri baat']);
    expect(JSON.stringify(ex.body)).not.toContain('listener ki baat');
    expect(ex.body.moodCheckins[0].note).toBe('aaj achha laga');
    expect(ex.body.wallet.transactions.length).toBeGreaterThan(0);
  });

  it('sahmati wapas = account aur personal data mitana; login band', async () => {
    const user = await loginViaOtp();
    await api().post(`${P}/checkins`).set(bearer(user.accessToken)).send({ mood: 3 });
    expect((await api().post(`${P}/me/consent/withdraw`).set(bearer(user.accessToken)).send({})).status).toBe(400);
    const w = await api().post(`${P}/me/consent/withdraw`).set(bearer(user.accessToken)).send({ confirm: true });
    expect(w.status).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, user.user.id));
    expect(u.phone).toBeNull();
    expect(u.deletedAt).toBeTruthy();
    const [{ n }] = await db.execute(sql`select count(*)::int as n from mood_checkins where user_id = ${user.user.id}`).then((r) => r.rows as { n: number }[]);
    expect(n).toBe(0);
    expect((await api().get(`${P}/me`).set(bearer(user.accessToken))).status).toBe(401);
  });

  it('chat retention: purane messages delete; khuli shikayat wale session ke rahenge', async () => {
    const a = await activeSession(2000);
    const b = await activeSession(2000);
    const old = new Date(Date.now() - 100 * 86400_000);
    await db.insert(chatMessages).values([
      { sessionId: a.s.id, senderId: a.user.user.id, body: 'purani A', createdAt: old },
      { sessionId: b.s.id, senderId: b.user.user.id, body: 'purani B', createdAt: old },
      { sessionId: a.s.id, senderId: a.user.user.id, body: 'nayi A' },
    ]);
    await db.insert(reports).values({ reporterId: b.user.user.id, vendorId: b.v.vendor.id, sessionId: b.s.id, reason: 'HARASSMENT' });
    await purgeOldChats();
    const left = await db.select({ body: chatMessages.body }).from(chatMessages).where(sql`${chatMessages.sessionId} in (${a.s.id}, ${b.s.id})`);
    expect(left.map((x) => x.body).sort()).toEqual(['nayi A', 'purani B']);
    await finalizeSession(a.s.id, 'USER_ENDED');
    await finalizeSession(b.s.id, 'USER_ENDED');
  });
});

describe('Takedown, refund-to-source, admin 2FA, policy notice', () => {
  it('court order par user block + message hataya; record 3 ghante ki deadline ke saath', async () => {
    const admin = await makeAdmin();
    const { user, s } = await activeSession(2000);
    const [m] = await db.insert(chatMessages).values({ sessionId: s.id, senderId: user.user.id, body: 'ghair-kanooni baat' }).returning();
    const t1 = await api()
      .post(`${P}/admin/takedowns`)
      .set(bearer(admin.accessToken))
      .send({ targetType: 'MESSAGE', targetId: m.id, authority: 'Delhi High Court', orderRef: 'W.P.(C) 123/2026' });
    expect(t1.status).toBe(201);
    expect(t1.body.late).toBe(false);
    expect(new Date(t1.body.dueAt).getTime() - new Date(t1.body.receivedAt).getTime()).toBe(3 * 3600_000);
    const [m2] = await db.select().from(chatMessages).where(eq(chatMessages.id, m.id));
    expect(m2.body).toContain('hataya');
    await finalizeSession(s.id, 'USER_ENDED');
    const t2 = await api()
      .post(`${P}/admin/takedowns`)
      .set(bearer(admin.accessToken))
      .send({ targetType: 'USER', targetId: user.user.id, authority: 'MeitY', orderRef: 'Sec 69A/2026/7', receivedAt: new Date(Date.now() - 4 * 3600_000).toISOString() });
    expect(t2.body.late).toBe(true);
    expect((await api().get(`${P}/me`).set(bearer(user.accessToken))).status).toBeGreaterThanOrEqual(401);
    const list = await api().get(`${P}/admin/takedowns`).set(bearer(admin.accessToken));
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    expect((await api().post(`${P}/admin/takedowns`).set(bearer(admin.accessToken)).send({ targetType: 'REVIEW', targetId: '00000000-0000-4000-8000-000000000000', authority: 'MeitY', orderRef: 'x1' })).status).toBe(404);
  });

  it('recharge ka refund original source par: coins hatte hain, do baar nahi, kharch hue coins par nahi', async () => {
    const admin = await makeAdmin();
    const user = await loginViaOtp();
    const pay = await rechargeVia(user.accessToken, (await ensurePack(50000, 10)).id);
    expect(await balanceOf(user.user.id)).toBe(55000);
    const r = await api().post(`${P}/admin/payments/${pay.paymentId}/refund-to-source`).set(bearer(admin.accessToken)).send({ reason: 'User ne galti se recharge kiya' });
    expect(r.status).toBe(200);
    expect(r.body.refundedRs).toBe(590);
    expect(await balanceOf(user.user.id)).toBe(0);
    const again = await api().post(`${P}/admin/payments/${pay.paymentId}/refund-to-source`).set(bearer(admin.accessToken)).send({ reason: 'Dobara koshish' });
    expect(again.status).toBe(409);

    const pay2 = await rechargeVia(user.accessToken, (await ensurePack(50000, 0)).id);
    await db.update(wallets).set({ balance: 1000 }).where(eq(wallets.userId, user.user.id)); // coins kharch ho gaye
    const used = await api().post(`${P}/admin/payments/${pay2.paymentId}/refund-to-source`).set(bearer(admin.accessToken)).send({ reason: 'Refund chahiye' });
    expect(used.status).toBe(409);
    expect(used.body.error.code).toBe('COINS_USED');
  });

  it('admin 2FA: chalu hone ke baad bina code login nahi', async () => {
    const email = `twofa${Date.now()}@test.local`;
    const password = 'Str0ng!Passw0rd#';
    await db.insert(users).values({ email, passwordHash: await hashPassword(password), role: 'ADMIN', name: 'Admin', referralCode: randomReferralCode() });
    const l1 = await api().post(`${P}/auth/admin/login`).send({ email, password });
    const setup = await api().post(`${P}/admin/2fa/setup`).set(bearer(l1.body.accessToken));
    expect(setup.status).toBe(200);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    expect((await api().post(`${P}/admin/2fa/enable`).set(bearer(l1.body.accessToken)).send({ code: '000000' })).status).toBe(400);
    const en = await api().post(`${P}/admin/2fa/enable`).set(bearer(l1.body.accessToken)).send({ code: totpCode(setup.body.secret) });
    expect(en.status).toBe(200);
    const noCode = await api().post(`${P}/auth/admin/login`).send({ email, password });
    expect(noCode.status).toBe(401);
    expect(noCode.body.error.code).toBe('TOTP_REQUIRED');
    expect((await api().post(`${P}/auth/admin/login`).send({ email, password, totp: '123456' })).body.error.code).toBe('TOTP_INVALID');
    const withCode = await api().post(`${P}/auth/admin/login`).send({ email, password, totp: totpCode(setup.body.secret) });
    expect(withCode.status).toBe(200);
  });

  it('policy notice sab users ko; 90 din wala auto notice', async () => {
    const admin = await makeAdmin();
    const user = await loginViaOtp();
    const r = await api().post(`${P}/admin/policy-notice`).set(bearer(admin.accessToken)).send({});
    expect(r.status).toBe(200);
    expect(r.body.sent).toBeGreaterThan(0);
    const n = await db.select().from(notifications).where(and(eq(notifications.userId, user.user.id), sql`${notifications.data}->>'type' = 'policy'`));
    expect(n).toHaveLength(1);
    // 91 din baad sweep khud bhejta hai
    await setSettings({ lastPolicyNoticeAt: new Date(Date.now() - 91 * 86400_000).toISOString() });
    await sweepCompliance(new Date(), true);
    const n2 = await db.select().from(notifications).where(and(eq(notifications.userId, user.user.id), sql`${notifications.data}->>'type' = 'policy'`));
    expect(n2).toHaveLength(2);
  });
});

beforeAll(async () => {
  await setSettings({ freeTrialMinutes: 0 });
});
