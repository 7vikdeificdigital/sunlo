import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { adminRouter } from '../src/app';
import { db } from '../src/db/client';
import { auditLogs, categories, consultSessions, payoutAccounts, users, vendors } from '../src/db/schema';
import { finalizeSession } from '../src/modules/sessions/service';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, makeAdmin, makeVendor, P, rechargeVia } from './helpers';

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

// 1x1 PNG aur chhota PDF (asli file headers)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64').toString('base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
const HTML_AS_PNG = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');

async function category() {
  const [c] = await db
    .insert(categories)
    .values({ name: `Cat ${Date.now()}${Math.random()}`, slug: `cat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, kind: 'LISTENER' })
    .returning();
  return c;
}

describe('Admin APIs sirf admin ke liye', () => {
  const routes: { method: string; path: string }[] = [];
  for (const layer of (adminRouter as unknown as { stack: Layer[] }).stack) {
    if (!layer.route) continue;
    for (const m of Object.keys(layer.route.methods)) routes.push({ method: m, path: layer.route.path.replace(/:id/g, '00000000-0000-4000-8000-000000000000') });
  }

  it('kam se kam 35 admin routes', () => expect(routes.length).toBeGreaterThanOrEqual(35));

  it('USER aur VENDOR token se har admin route 403', async () => {
    const u = await loginViaOtp();
    const v = await loginViaOtp(undefined, 'vendor');
    for (const r of routes) {
      for (const t of [u.accessToken, v.accessToken]) {
        const res = await (api() as unknown as Record<string, (x: string) => import('supertest').Test>)[r.method](`${P}${r.path}`).set(bearer(t)).send({});
        expect(res.status, `${r.method} ${r.path}`).toBe(403);
      }
    }
  });
});

describe('Vendor onboarding → admin approval', () => {
  it('poora flow: signup, upload, submit, approve, online, list mein dikhna', async () => {
    const cat = await category();
    const v = await loginViaOtp(undefined, 'vendor');
    expect(v.isNewUser).toBe(true);
    const me0 = await api().get(`${P}/vendor/me`).set(bearer(v.accessToken));
    expect(me0.body.status).toBe('DRAFT');

    // Approval se pehle online nahi
    expect((await api().patch(`${P}/vendor/status`).set(bearer(v.accessToken)).send({ isOnline: true })).status).toBe(403);
    // Adhoori profile submit nahi hoti
    const early = await api().post(`${P}/vendor/me/submit`).set(bearer(v.accessToken));
    expect(early.status).toBe(400);
    expect(early.body.error.details.missing).toContain('ID document');

    // Upload: nakli file (HTML) reject, asli PNG/PDF accept
    const bad = await api().post(`${P}/uploads`).set(bearer(v.accessToken)).send({ kind: 'AVATAR', dataBase64: HTML_AS_PNG });
    expect(bad.status).toBe(400);
    const pdfAsAvatar = await api().post(`${P}/uploads`).set(bearer(v.accessToken)).send({ kind: 'AVATAR', dataBase64: PDF });
    expect(pdfAsAvatar.status).toBe(400);
    const avatar = await api().post(`${P}/uploads`).set(bearer(v.accessToken)).send({ kind: 'AVATAR', dataBase64: PNG });
    const kyc = await api().post(`${P}/uploads`).set(bearer(v.accessToken)).send({ kind: 'KYC', dataBase64: PDF });
    expect(avatar.status).toBe(201);
    expect(kyc.status).toBe(201);
    // Avatar public, KYC public nahi
    expect((await api().get(`${P}/files/${avatar.body.id}`)).status).toBe(200);
    expect((await api().get(`${P}/files/${kyc.body.id}`)).status).toBe(404);

    // Kisi aur ki upload apni profile mein nahi laga sakte
    const other = await loginViaOtp(undefined, 'vendor');
    const steal = await api().patch(`${P}/vendor/me`).set(bearer(other.accessToken)).send({ kycUploadId: kyc.body.id, kycDocType: 'PAN' });
    expect(steal.status).toBe(400);

    // Vendor apna status khud APPROVED nahi kar sakta
    expect((await api().patch(`${P}/vendor/me`).set(bearer(v.accessToken)).send({ status: 'APPROVED' })).status).toBe(400);

    const patch = await api()
      .patch(`${P}/vendor/me`)
      .set(bearer(v.accessToken))
      .send({
        displayName: 'Meera Listener',
        headline: 'Dhyan se sunne wali listener',
        bio: 'Main pichhle 3 saal se logon ki baat sun rahi hoon. Aap bina jhijhak apni baat keh sakte hain.',
        gender: 'FEMALE',
        experienceYears: 3,
        languages: ['Hindi', 'English'],
        tags: ['Stress'],
        categoryIds: [cat.id],
        avatarUploadId: avatar.body.id,
        kycDocType: 'AADHAAR',
        kycUploadId: kyc.body.id,
      });
    expect(patch.status).toBe(200);
    const submit = await api().post(`${P}/vendor/me/submit`).set(bearer(v.accessToken));
    expect(submit.body.status).toBe('PENDING');

    // Approval se pehle users ko nahi dikhta
    const before = await api().get(`${P}/vendors`).query({ search: 'Meera Listener' });
    expect(before.body.items).toHaveLength(0);

    const admin = await makeAdmin();
    const [vrow] = await db.select().from(vendors).where(eq(vendors.userId, v.user.id));
    const kycView = await api().get(`${P}/admin/uploads/${kyc.body.id}`).set(bearer(admin.accessToken));
    expect(kycView.status).toBe(200);
    expect(kycView.headers['content-type']).toBe('application/pdf');
    const appr = await api().post(`${P}/admin/vendors/${vrow.id}/approve`).set(bearer(admin.accessToken));
    expect(appr.body.status).toBe('APPROVED');
    expect((await api().post(`${P}/admin/vendors/${vrow.id}/approve`).set(bearer(admin.accessToken))).status).toBe(409);

    expect((await api().patch(`${P}/vendor/status`).set(bearer(v.accessToken)).send({ isOnline: true })).body.isOnline).toBe(true);
    const after = await api().get(`${P}/vendors`).query({ search: 'Meera Listener' });
    expect(after.body.items).toHaveLength(1);
    expect(JSON.stringify(after.body)).not.toMatch(/kyc|rejection|payout/i);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, vrow.id));
    expect(logs.map((l) => l.action)).toContain('vendor.approve');
    const views = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'upload.view'), eq(auditLogs.targetId, kyc.body.id)));
    expect(views).toHaveLength(1);
  });

  it('user number vendor app mein (aur ulta) login nahi hota', async () => {
    const u = await loginViaOtp();
    await db.execute(sql`update otp_codes set created_at = now() - interval '1 minute' where phone = ${u.phone}`);
    await expect(loginViaOtp(u.phone, 'vendor')).rejects.toThrow('403');
  });

  it('rate admin ki seema ke bahar nahi', async () => {
    const { phone } = await makeVendor();
    const v = await loginViaOtp(phone, 'vendor');
    expect((await api().patch(`${P}/vendor/rates`).set(bearer(v.accessToken)).send({ chatRatePerMin: 100 })).status).toBe(400);
    expect((await api().patch(`${P}/vendor/rates`).set(bearer(v.accessToken)).send({ chatRatePerMin: 9_999_999 })).status).toBe(400);
    expect((await api().patch(`${P}/vendor/rates`).set(bearer(v.accessToken)).send({ chatRatePerMin: 1500 })).status).toBe(200);
  });
});

async function earnedVendor() {
  const user = await loginViaOtp();
  await rechargeVia(user.accessToken, (await ensurePack(200000, 0)).id); // Rs 2000
  const mv = await makeVendor({ chatRate: 5000 }); // Rs 50/min
  const vend = await loginViaOtp(mv.phone, 'vendor');
  const req = await api().post(`${P}/sessions`).set(bearer(user.accessToken)).send({ vendorId: mv.vendor.id, type: 'CHAT' });
  await api().post(`${P}/vendor/sessions/${req.body.id}/accept`).set(bearer(vend.accessToken));
  const [s] = await db.select().from(consultSessions).where(eq(consultSessions.id, req.body.id));
  await finalizeSession(s.id, 'USER_ENDED', undefined, new Date(s.acceptedAt!.getTime() + 20 * 60_000)); // 20 min = Rs 1000, vendor 700
  return { user, mv, vend, sessionId: s.id };
}

describe('Payout aur withdrawal', () => {
  it('bank account encrypted save; vendor ko sirf last 4; admin ko poora (audit ke saath)', async () => {
    const { mv, vend } = await earnedVendor();
    const put = await api().put(`${P}/vendor/payout-account`).set(bearer(vend.accessToken)).send({ method: 'BANK', accountHolder: 'Test Vendor', accountNumber: '123456789012', ifsc: 'HDFC0001234' });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain('123456789012');
    expect(put.body.payout.accountLast4).toBe('9012');
    const [raw] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, mv.vendor.id));
    expect(raw.accountNumberEnc).not.toContain('123456789012');
    expect((await api().put(`${P}/vendor/payout-account`).set(bearer(vend.accessToken)).send({ method: 'BANK', accountHolder: 'X Y', accountNumber: '12', ifsc: 'BAD' })).status).toBe(400);

    expect(await balanceOf(mv.user.id)).toBe(70000);
    expect((await api().post(`${P}/vendor/withdrawals`).set(bearer(vend.accessToken)).send({ amount: 100 })).status).toBe(400); // min se kam
    expect((await api().post(`${P}/vendor/withdrawals`).set(bearer(vend.accessToken)).send({ amount: 80000 })).status).toBe(402); // balance se zyada
    const w = await api().post(`${P}/vendor/withdrawals`).set(bearer(vend.accessToken)).send({ amount: 60000 });
    expect(w.status).toBe(201);
    expect(await balanceOf(mv.user.id)).toBe(10000);
    expect((await api().post(`${P}/vendor/withdrawals`).set(bearer(vend.accessToken)).send({ amount: 5000 })).status).toBeGreaterThanOrEqual(400);

    const admin = await makeAdmin();
    const det = await api().get(`${P}/admin/withdrawals/${w.body.id}/payout-details`).set(bearer(admin.accessToken));
    expect(det.body.accountNumber).toBe('123456789012');
    const paid = await api().post(`${P}/admin/withdrawals/${w.body.id}/mark-paid`).set(bearer(admin.accessToken)).send({ reference: 'UTR998877' });
    expect(paid.body.status).toBe('PAID');
    expect((await api().post(`${P}/admin/withdrawals/${w.body.id}/reject`).set(bearer(admin.accessToken)).send({ note: 'galti se' })).status).toBe(409);
  });

  it('admin reject kare to paisa vendor ke wallet mein wapas', async () => {
    const { mv, vend } = await earnedVendor();
    await api().put(`${P}/vendor/payout-account`).set(bearer(vend.accessToken)).send({ method: 'UPI', upiId: 'test.vendor@okhdfc' });
    const w = await api().post(`${P}/vendor/withdrawals`).set(bearer(vend.accessToken)).send({ amount: 50000 });
    expect(await balanceOf(mv.user.id)).toBe(20000);
    const admin = await makeAdmin();
    const r = await api().post(`${P}/admin/withdrawals/${w.body.id}/reject`).set(bearer(admin.accessToken)).send({ note: 'UPI ID galat hai' });
    expect(r.body.status).toBe('REJECTED');
    expect(await balanceOf(mv.user.id)).toBe(70000);
  });
});

describe('Admin: refund, block, wallet, settings', () => {
  it('session refund: user ko wapas, vendor ka hissa kata, dobara refund nahi', async () => {
    const { user, mv, sessionId } = await earnedVendor();
    const admin = await makeAdmin();
    expect(await balanceOf(user.user.id)).toBe(100000);
    const r = await api().post(`${P}/admin/sessions/${sessionId}/refund`).set(bearer(admin.accessToken)).send({ reason: 'Vendor ne galat vyavhar kiya' });
    expect(r.body.refund).toBe(100000);
    expect(r.body.clawback).toBe(70000);
    expect(await balanceOf(user.user.id)).toBe(200000);
    expect(await balanceOf(mv.user.id)).toBe(0);
    expect((await api().post(`${P}/admin/sessions/${sessionId}/refund`).set(bearer(admin.accessToken)).send({ reason: 'dobara koshish' })).status).toBe(409);
    const t = await api().get(`${P}/admin/sessions/${sessionId}`).set(bearer(admin.accessToken));
    expect(t.status).toBe(200);
  });

  it('block: user turant bahar; wallet adjust note ke saath', async () => {
    const u = await loginViaOtp();
    const admin = await makeAdmin();
    const adj = await api().post(`${P}/admin/users/${u.user.id}/wallet-adjust`).set(bearer(admin.accessToken)).send({ amount: 2500, note: 'Network issue compensation' });
    expect(adj.status).toBe(200);
    expect(await balanceOf(u.user.id)).toBe(2500);
    expect((await api().post(`${P}/admin/users/${u.user.id}/wallet-adjust`).set(bearer(admin.accessToken)).send({ amount: -99999, note: 'zyada katna' })).status).toBe(402);
    await api().post(`${P}/admin/users/${u.user.id}/block`).set(bearer(admin.accessToken)).send({ reason: 'Spam' });
    expect((await api().get(`${P}/me`).set(bearer(u.accessToken))).status).toBe(401);
    expect((await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken })).status).toBe(401);
    // Admin kisi admin ko block nahi kar sakta (sirf USER/VENDOR)
    const [a] = await db.select().from(users).where(eq(users.id, admin.user.id));
    expect((await api().post(`${P}/admin/users/${a.id}/block`).set(bearer(admin.accessToken)).send({ reason: 'test test' })).status).toBe(404);
  });

  it('settings: galat value reject; sahi value turant lagu', async () => {
    const admin = await makeAdmin();
    expect((await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ commissionPct: 150 })).status).toBe(400);
    expect((await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ minRatePerMinPaise: 50000, maxRatePerMinPaise: 1000 })).status).toBe(400);
    expect((await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ jwtSecret: 'x' })).status).toBe(400);
    const ok = await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ commissionPct: 25 });
    expect(ok.body.settings.commissionPct).toBe(25);
    await api().patch(`${P}/admin/settings`).set(bearer(admin.accessToken)).send({ commissionPct: 30 });
  });

  it('dashboard aur reports chalte hain', async () => {
    const admin = await makeAdmin();
    const d = await api().get(`${P}/admin/dashboard`).set(bearer(admin.accessToken));
    expect(d.status).toBe(200);
    expect(d.body.series).toHaveLength(14);
    const u = await loginViaOtp();
    const { vendor } = await makeVendor();
    const rep = await api().post(`${P}/reports`).set(bearer(u.accessToken)).send({ vendorId: vendor.id, reason: 'ASKED_FOR_MONEY_OR_CONTACT', details: 'Number maang rahe the' });
    expect(rep.status).toBe(201);
    const list = await api().get(`${P}/admin/reports`).query({ status: 'OPEN' }).set(bearer(admin.accessToken));
    expect(list.body.items.some((x: { id: string }) => x.id === rep.body.id)).toBe(true);
    const res = await api().post(`${P}/admin/reports/${rep.body.id}/resolve`).set(bearer(admin.accessToken)).send({ resolution: 'Vendor ko chetavni di' });
    expect(res.body.status).toBe('RESOLVED');
  });
});
