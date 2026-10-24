import crypto from 'node:crypto';
import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  auditLogs,
  banners,
  blockedKeywords,
  categories,
  chatMessages,
  consultSessions,
  notifications,
  payments,
  payoutAccounts,
  rechargePacks,
  refreshTokens,
  reports,
  reviews,
  settings,
  supportTickets,
  ticketMessages,
  users,
  vendorCategories,
  vendors,
  walletTransactions,
  wallets,
  withdrawals,
} from '../../db/schema';
import { clearKeywordCache } from '../../lib/contentFilter';
import { decryptField } from '../../lib/crypto';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { emitToUser } from '../../lib/realtime';
import { clearSettingsCache, DEFAULT_SETTINGS, getSettings } from '../../lib/settings';
import { escapeLike } from '../../lib/sql';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { sendUpload } from '../uploads/routes';
import { postTxn } from '../wallet/ledger';
import { audit } from './audit';

/** Admin panel ki saari APIs. Har route par ADMIN role zaroori; har badlav audit log mein. */
export const adminRouter = Router();
adminRouter.use('/admin', requireRole('ADMIN'));

const like = (s: string) => `%${escapeLike(s)}%`;
const count = sql<number>`count(*)::int`;

async function notify(userId: string, title: string, bodyText: string, data?: Record<string, unknown>) {
  await db.insert(notifications).values({ userId, title, body: bodyText, data: data ?? null });
  emitToUser(userId, 'notification', { title, body: bodyText, data });
}

// ======================= Dashboard =======================

adminRouter.get('/admin/me', async (req, res) => {
  const [u] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, authId(req)));
  res.json(u);
});

adminRouter.get('/admin/dashboard', async (_req, res) => {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const d14 = new Date(startToday.getTime() - 13 * 86400_000);

  const [[u], [v], [sess], [rev30], [recharge30], [wd], [tk], [rp]] = await Promise.all([
    db
      .select({ total: count, today: sql<number>`count(*) filter (where ${users.createdAt} >= ${startToday.toISOString()}::timestamptz)::int` })
      .from(users)
      .where(and(eq(users.role, 'USER'), isNull(users.deletedAt))),
    db
      .select({
        approved: sql<number>`count(*) filter (where ${vendors.status} = 'APPROVED')::int`,
        pending: sql<number>`count(*) filter (where ${vendors.status} = 'PENDING')::int`,
        online: sql<number>`count(*) filter (where ${vendors.status} = 'APPROVED' and ${vendors.isOnline})::int`,
      })
      .from(vendors),
    db
      .select({
        active: sql<number>`count(*) filter (where ${consultSessions.status} = 'ACTIVE')::int`,
        today: sql<number>`count(*) filter (where ${consultSessions.status} = 'COMPLETED' and ${consultSessions.endedAt} >= ${startToday.toISOString()}::timestamptz)::int`,
      })
      .from(consultSessions),
    db
      .select({
        gross: sql<number>`coalesce(sum(${consultSessions.chargedAmount} - ${consultSessions.refundedAmount}),0)::int`,
        vendorShare: sql<number>`coalesce(sum(${consultSessions.vendorEarning}),0)::int`,
        minutes: sql<number>`coalesce(sum(ceil(${consultSessions.billedSeconds} / 60.0)),0)::int`,
      })
      .from(consultSessions)
      .where(and(eq(consultSessions.status, 'COMPLETED'), gte(consultSessions.endedAt, d30))),
    db
      .select({ amount: sql<number>`coalesce(sum(${payments.amount}),0)::int`, gst: sql<number>`coalesce(sum(${payments.gstAmount}),0)::int`, n: count })
      .from(payments)
      .where(and(eq(payments.status, 'PAID'), gte(payments.paidAt, d30))),
    db.select({ n: count, amount: sql<number>`coalesce(sum(${withdrawals.amount}),0)::int` }).from(withdrawals).where(eq(withdrawals.status, 'PENDING')),
    db.select({ n: count }).from(supportTickets).where(eq(supportTickets.status, 'OPEN')),
    db.select({ n: count }).from(reports).where(eq(reports.status, 'OPEN')),
  ]);

  // Pichhle 14 din ka din-wise hisaab (IST)
  const day = (col: SQL | unknown) => sql<string>`to_char((${col} at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')`;
  const [rechargeSeries, sessionSeries, userSeries] = await Promise.all([
    db
      .select({ day: day(payments.paidAt), amount: sql<number>`sum(${payments.amount})::int` })
      .from(payments)
      .where(and(eq(payments.status, 'PAID'), gte(payments.paidAt, d14)))
      .groupBy(sql`1`),
    db
      .select({
        day: day(consultSessions.endedAt),
        gross: sql<number>`sum(${consultSessions.chargedAmount})::int`,
        commission: sql<number>`sum(${consultSessions.chargedAmount} - ${consultSessions.vendorEarning})::int`,
        sessions: count,
      })
      .from(consultSessions)
      .where(and(eq(consultSessions.status, 'COMPLETED'), gte(consultSessions.endedAt, d14)))
      .groupBy(sql`1`),
    db
      .select({ day: day(users.createdAt), n: count })
      .from(users)
      .where(and(eq(users.role, 'USER'), gte(users.createdAt, d14)))
      .groupBy(sql`1`),
  ]);
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(d14.getTime() + i * 86400_000 + 5.5 * 3600_000).toISOString().slice(0, 10);
    const r = rechargeSeries.find((x) => x.day === d);
    const s = sessionSeries.find((x) => x.day === d);
    const nu = userSeries.find((x) => x.day === d);
    return { day: d, recharge: r?.amount ?? 0, gross: s?.gross ?? 0, commission: s?.commission ?? 0, sessions: s?.sessions ?? 0, newUsers: nu?.n ?? 0 };
  });

  res.json({
    users: u,
    vendors: v,
    sessions: sess,
    last30: { gross: rev30.gross, commission: rev30.gross - rev30.vendorShare, minutes: rev30.minutes, recharge: recharge30.amount, gst: recharge30.gst, payments: recharge30.n },
    pending: { withdrawals: wd.n, withdrawalAmount: wd.amount, tickets: tk.n, reports: rp.n, vendorApprovals: v.pending },
    series,
  });
});

// ======================= Vendors =======================

adminRouter.get('/admin/vendors', async (req, res) => {
  const q = query(req, pagination.extend({ status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(), search: z.string().trim().max(60).optional() }));
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(vendors.status, q.status));
  if (q.search) conds.push(or(ilike(vendors.displayName, like(q.search)), ilike(users.phone, like(q.search)))!);
  const where = conds.length ? and(...conds) : undefined;
  const items = await db
    .select({
      id: vendors.id,
      displayName: vendors.displayName,
      headline: vendors.headline,
      avatarUrl: vendors.avatarUrl,
      status: vendors.status,
      isOnline: vendors.isOnline,
      ratingAvg: vendors.ratingAvg,
      ratingCount: vendors.ratingCount,
      totalMinutes: vendors.totalMinutes,
      submittedAt: vendors.submittedAt,
      createdAt: vendors.createdAt,
      phone: users.phone,
    })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where)
    .orderBy(desc(sql`${vendors.status} = 'PENDING'`), desc(vendors.submittedAt), desc(vendors.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: count }).from(vendors).innerJoin(users, eq(users.id, vendors.userId)).where(where);
  res.json({ items, total, page: q.page, limit: q.limit });
});

adminRouter.get('/admin/vendors/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const [row] = await db.select({ v: vendors, phone: users.phone, userStatus: users.status }).from(vendors).innerJoin(users, eq(users.id, vendors.userId)).where(eq(vendors.id, id)).limit(1);
  if (!row) throw notFound('Vendor');
  const [cats, [payout], [w], recent] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(vendorCategories).innerJoin(categories, eq(categories.id, vendorCategories.categoryId)).where(eq(vendorCategories.vendorId, id)),
    db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, id)),
    db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, row.v.userId)),
    db
      .select({ id: consultSessions.id, type: consultSessions.type, status: consultSessions.status, chargedAmount: consultSessions.chargedAmount, billedSeconds: consultSessions.billedSeconds, requestedAt: consultSessions.requestedAt })
      .from(consultSessions)
      .where(eq(consultSessions.vendorId, id))
      .orderBy(desc(consultSessions.requestedAt))
      .limit(10),
  ]);
  res.json({
    ...row.v,
    phone: row.phone,
    userStatus: row.userStatus,
    categories: cats,
    walletBalance: w?.balance ?? 0,
    payout: payout ? { method: payout.method, upiId: payout.upiId, accountHolder: payout.accountHolder, accountLast4: payout.accountLast4, ifsc: payout.ifsc } : null,
    recentSessions: recent,
  });
});

async function setVendorStatus(id: string, from: string[], to: 'APPROVED' | 'REJECTED' | 'SUSPENDED', extra: Partial<typeof vendors.$inferInsert> = {}) {
  const [v] = await db
    .update(vendors)
    .set({ status: to, ...extra })
    .where(and(eq(vendors.id, id), inArray(vendors.status, from as ('DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED')[])))
    .returning();
  if (!v) throw conflict('INVALID_STATE', 'Is halat mein yeh kaam nahi ho sakta');
  return v;
}

adminRouter.post('/admin/vendors/:id/approve', async (req, res) => {
  const { id } = params(req, idParam);
  const v = await setVendorStatus(id, ['PENDING'], 'APPROVED', { approvedAt: new Date(), rejectionReason: null });
  await audit(req, 'vendor.approve', 'vendor', id);
  await notify(v.userId, 'Profile approve ho gayi! 🎉', 'Ab aap online hokar users se baat kar sakte hain.', { type: 'vendor_status', status: 'APPROVED' });
  res.json({ status: v.status });
});

adminRouter.post('/admin/vendors/:id/reject', async (req, res) => {
  const { id } = params(req, idParam);
  const { reason } = body(req, z.object({ reason: z.string().trim().min(5).max(500) }));
  const v = await setVendorStatus(id, ['PENDING'], 'REJECTED', { rejectionReason: reason });
  await audit(req, 'vendor.reject', 'vendor', id, { reason });
  await notify(v.userId, 'Profile mein badlav chahiye', reason, { type: 'vendor_status', status: 'REJECTED' });
  res.json({ status: v.status });
});

adminRouter.post('/admin/vendors/:id/suspend', async (req, res) => {
  const { id } = params(req, idParam);
  const { reason } = body(req, z.object({ reason: z.string().trim().min(5).max(500) }));
  const v = await setVendorStatus(id, ['APPROVED'], 'SUSPENDED', { isOnline: false, rejectionReason: reason });
  await audit(req, 'vendor.suspend', 'vendor', id, { reason });
  await notify(v.userId, 'Profile suspend ki gayi', reason, { type: 'vendor_status', status: 'SUSPENDED' });
  res.json({ status: v.status });
});

adminRouter.post('/admin/vendors/:id/reinstate', async (req, res) => {
  const { id } = params(req, idParam);
  const v = await setVendorStatus(id, ['SUSPENDED'], 'APPROVED', { rejectionReason: null });
  await audit(req, 'vendor.reinstate', 'vendor', id);
  await notify(v.userId, 'Profile phir se chalu', 'Aap dobara online ho sakte hain.', { type: 'vendor_status', status: 'APPROVED' });
  res.json({ status: v.status });
});

/** KYC document dekhna: sirf admin, aur har baar audit log mein */
adminRouter.get('/admin/uploads/:id', async (req, res) => {
  const { id } = params(req, idParam);
  await audit(req, 'upload.view', 'upload', id);
  await sendUpload(res, id, { allowKyc: true });
});

// ======================= Users =======================

adminRouter.get('/admin/users', async (req, res) => {
  const q = query(req, pagination.extend({ search: z.string().trim().max(60).optional(), status: z.enum(['ACTIVE', 'BLOCKED']).optional() }));
  const conds: SQL[] = [eq(users.role, 'USER'), isNull(users.deletedAt)];
  if (q.status) conds.push(eq(users.status, q.status));
  if (q.search) conds.push(or(ilike(users.name, like(q.search)), ilike(users.phone, like(q.search)), ilike(users.email, like(q.search)))!);
  const where = and(...conds);
  const items = await db
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, status: users.status, createdAt: users.createdAt, balance: wallets.balance })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: count }).from(users).where(where);
  res.json({ items, total, page: q.page, limit: q.limit });
});

adminRouter.get('/admin/users/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const [u] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, gender: users.gender, status: users.status, role: users.role, createdAt: users.createdAt, referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!u) throw notFound('User');
  const [w] = await db.select().from(wallets).where(eq(wallets.userId, id)).limit(1);
  const [txns, sess] = await Promise.all([
    w ? db.select().from(walletTransactions).where(eq(walletTransactions.walletId, w.id)).orderBy(desc(walletTransactions.createdAt)).limit(30) : [],
    db
      .select({ id: consultSessions.id, type: consultSessions.type, status: consultSessions.status, chargedAmount: consultSessions.chargedAmount, requestedAt: consultSessions.requestedAt, vendorName: vendors.displayName })
      .from(consultSessions)
      .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
      .where(eq(consultSessions.userId, id))
      .orderBy(desc(consultSessions.requestedAt))
      .limit(20),
  ]);
  res.json({ ...u, walletBalance: w?.balance ?? 0, transactions: txns, sessions: sess });
});

async function setUserStatus(req: Parameters<typeof audit>[0], id: string, status: 'ACTIVE' | 'BLOCKED', reason?: string) {
  const [u] = await db
    .update(users)
    .set({ status, ...(status === 'BLOCKED' ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}) })
    .where(and(eq(users.id, id), inArray(users.role, ['USER', 'VENDOR'])))
    .returning({ id: users.id, role: users.role });
  if (!u) throw notFound('User');
  if (status === 'BLOCKED') {
    // Turant logout: saare refresh token band
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
    if (u.role === 'VENDOR') await db.update(vendors).set({ isOnline: false }).where(eq(vendors.userId, id));
  }
  await audit(req, status === 'BLOCKED' ? 'user.block' : 'user.unblock', 'user', id, reason ? { reason } : undefined);
}

adminRouter.post('/admin/users/:id/block', async (req, res) => {
  const { id } = params(req, idParam);
  const { reason } = body(req, z.object({ reason: z.string().trim().min(3).max(300) }));
  await setUserStatus(req, id, 'BLOCKED', reason);
  res.json({ status: 'BLOCKED' });
});

adminRouter.post('/admin/users/:id/unblock', async (req, res) => {
  const { id } = params(req, idParam);
  await setUserStatus(req, id, 'ACTIVE');
  res.json({ status: 'ACTIVE' });
});

/** Wallet mein haath se badlav (jaise compensation). Note zaroori, audit mein darj. */
adminRouter.post('/admin/users/:id/wallet-adjust', async (req, res) => {
  const { id } = params(req, idParam);
  const { amount, note } = body(
    req,
    z.object({ amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 10_000_000, 'Raqam sahi nahi'), note: z.string().trim().min(5).max(300) }),
  );
  const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), inArray(users.role, ['USER', 'VENDOR']))).limit(1);
  if (!u) throw notFound('User');
  const refId = crypto.randomUUID();
  const txn = await db.transaction(async (tx) => {
    const t = await postTxn(tx, { userId: id, type: 'ADJUSTMENT', amount, referenceType: 'admin', referenceId: refId, note });
    await audit(req, 'wallet.adjust', 'user', id, { amount, note }, tx);
    return t;
  });
  await notify(id, amount > 0 ? 'Wallet mein paise jode gaye' : 'Wallet se paise kate', note, { type: 'wallet' });
  res.json(txn);
});

// ======================= Sessions =======================

adminRouter.get('/admin/sessions', async (req, res) => {
  const q = query(
    req,
    pagination.extend({
      status: z.enum(['REQUESTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'MISSED']).optional(),
      type: z.enum(['CHAT', 'AUDIO', 'VIDEO']).optional(),
      vendorId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    }),
  );
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(consultSessions.status, q.status));
  if (q.type) conds.push(eq(consultSessions.type, q.type));
  if (q.vendorId) conds.push(eq(consultSessions.vendorId, q.vendorId));
  if (q.userId) conds.push(eq(consultSessions.userId, q.userId));
  const where = conds.length ? and(...conds) : undefined;
  const items = await db
    .select({
      id: consultSessions.id,
      type: consultSessions.type,
      status: consultSessions.status,
      ratePerMin: consultSessions.ratePerMin,
      billedSeconds: consultSessions.billedSeconds,
      chargedAmount: consultSessions.chargedAmount,
      vendorEarning: consultSessions.vendorEarning,
      refundedAmount: consultSessions.refundedAmount,
      requestedAt: consultSessions.requestedAt,
      endReason: consultSessions.endReason,
      userName: users.name,
      userId: users.id,
      vendorName: vendors.displayName,
      vendorId: vendors.id,
    })
    .from(consultSessions)
    .innerJoin(users, eq(users.id, consultSessions.userId))
    .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
    .where(where)
    .orderBy(desc(consultSessions.requestedAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: count }).from(consultSessions).where(where);
  res.json({ items, total, page: q.page, limit: q.limit });
});

/** Session + chat transcript: shikayat ki jaanch ke liye. Har baar dekhna audit log mein. */
adminRouter.get('/admin/sessions/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const [row] = await db
    .select({ s: consultSessions, userName: users.name, vendorName: vendors.displayName, vendorUserId: vendors.userId })
    .from(consultSessions)
    .innerJoin(users, eq(users.id, consultSessions.userId))
    .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
    .where(eq(consultSessions.id, id))
    .limit(1);
  if (!row) throw notFound('Session');
  const messages = await db
    .select({ id: chatMessages.id, senderId: chatMessages.senderId, body: chatMessages.body, flagged: chatMessages.flagged, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt));
  await audit(req, 'session.transcript.view', 'session', id);
  res.json({ ...row.s, userName: row.userName, vendorName: row.vendorName, vendorUserId: row.vendorUserId, messages });
});

/** Refund: user ko paisa wapas; vendor ki us hisse ki kamai (jitna wallet mein ho) wapas li jaati hai */
adminRouter.post('/admin/sessions/:id/refund', async (req, res) => {
  const { id } = params(req, idParam);
  const { amount, reason } = body(req, z.object({ amount: z.number().int().positive().optional(), reason: z.string().trim().min(5).max(300) }));
  const result = await db.transaction(async (tx) => {
    const [s] = await tx.select().from(consultSessions).where(eq(consultSessions.id, id)).for('update').limit(1);
    if (!s) throw notFound('Session');
    if (s.status !== 'COMPLETED' || s.chargedAmount <= 0) throw conflict('INVALID_STATE', 'Sirf poore hue, paid session ka refund ho sakta hai');
    if (s.refundedAmount > 0) throw conflict('ALREADY_REFUNDED', 'Is session ka refund pehle ho chuka hai');
    const refund = amount ?? s.chargedAmount;
    if (refund > s.chargedAmount) throw badRequest('AMOUNT_TOO_HIGH', 'Refund session ki raqam se zyada nahi ho sakta');
    await postTxn(tx, { userId: s.userId, type: 'REFUND', amount: refund, referenceType: 'session', referenceId: s.id, note: `Refund: ${reason}` });
    const share = Math.round((s.vendorEarning * refund) / s.chargedAmount);
    let clawback = 0;
    if (share > 0) {
      const [v] = await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, s.vendorId));
      const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, v.userId));
      clawback = Math.min(share, w?.balance ?? 0);
      if (clawback > 0)
        await postTxn(tx, { userId: v.userId, type: 'ADJUSTMENT', amount: -clawback, referenceType: 'session_refund', referenceId: s.id, note: `Refund adjustment: ${reason}` });
    }
    await tx.update(consultSessions).set({ refundedAmount: refund }).where(eq(consultSessions.id, s.id));
    await audit(req, 'session.refund', 'session', s.id, { refund, clawback, reason }, tx);
    return { refund, clawback, userId: s.userId };
  });
  await notify(result.userId, 'Refund mila', `Rs ${(result.refund / 100).toFixed(2)} aapke wallet mein wapas jode gaye.`, { type: 'wallet', sessionId: id });
  res.json(result);
});

// ======================= Payments & withdrawals =======================

adminRouter.get('/admin/payments', async (req, res) => {
  const q = query(req, pagination.extend({ status: z.enum(['CREATED', 'PAID', 'FAILED']).optional() }));
  const where = q.status ? eq(payments.status, q.status) : undefined;
  const items = await db
    .select({ p: payments, userName: users.name, phone: users.phone })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: count }).from(payments).where(where);
  res.json({ items: items.map((r) => ({ ...r.p, userName: r.userName, phone: r.phone })), total, page: q.page, limit: q.limit });
});

adminRouter.get('/admin/withdrawals', async (req, res) => {
  const q = query(req, pagination.extend({ status: z.enum(['PENDING', 'PAID', 'REJECTED']).optional() }));
  const where = q.status ? eq(withdrawals.status, q.status) : undefined;
  const items = await db
    .select({ w: withdrawals, vendorName: vendors.displayName })
    .from(withdrawals)
    .innerJoin(vendors, eq(vendors.id, withdrawals.vendorId))
    .where(where)
    .orderBy(desc(sql`${withdrawals.status} = 'PENDING'`), desc(withdrawals.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: count }).from(withdrawals).where(where);
  res.json({ items: items.map((r) => ({ ...r.w, vendorName: r.vendorName })), total, page: q.page, limit: q.limit });
});

/** Paisa bhejne ke liye poora account number (decrypt). Sirf pending withdrawal par, har baar audit. */
adminRouter.get('/admin/withdrawals/:id/payout-details', async (req, res) => {
  const { id } = params(req, idParam);
  const [w] = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
  if (!w) throw notFound('Withdrawal');
  if (w.status !== 'PENDING') throw conflict('INVALID_STATE', 'Sirf pending withdrawal ke liye');
  const [p] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, w.vendorId)).limit(1);
  if (!p) throw notFound('Payout account');
  await audit(req, 'payout.view', 'withdrawal', id);
  res.json(
    p.method === 'UPI'
      ? { method: 'UPI', upiId: p.upiId }
      : { method: 'BANK', accountHolder: p.accountHolder, accountNumber: p.accountNumberEnc ? decryptField(p.accountNumberEnc) : null, ifsc: p.ifsc },
  );
});

adminRouter.post('/admin/withdrawals/:id/mark-paid', async (req, res) => {
  const { id } = params(req, idParam);
  const { reference } = body(req, z.object({ reference: z.string().trim().min(4).max(100) }));
  const [w] = await db
    .update(withdrawals)
    .set({ status: 'PAID', reference, processedBy: authId(req), processedAt: new Date() })
    .where(and(eq(withdrawals.id, id), eq(withdrawals.status, 'PENDING')))
    .returning();
  if (!w) throw conflict('INVALID_STATE', 'Yeh withdrawal pending nahi hai');
  await audit(req, 'withdrawal.paid', 'withdrawal', id, { reference, amount: w.amount });
  const [v] = await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, w.vendorId));
  await notify(v.userId, 'Payment bhej diya gaya', `Rs ${(w.amount / 100).toFixed(2)} aapke account mein bheje gaye. Ref: ${reference}`, { type: 'withdrawal' });
  res.json(w);
});

adminRouter.post('/admin/withdrawals/:id/reject', async (req, res) => {
  const { id } = params(req, idParam);
  const { note } = body(req, z.object({ note: z.string().trim().min(5).max(300) }));
  const w = await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(withdrawals).where(eq(withdrawals.id, id)).for('update').limit(1);
    if (!cur || cur.status !== 'PENDING') throw conflict('INVALID_STATE', 'Yeh withdrawal pending nahi hai');
    const [v] = await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, cur.vendorId));
    await postTxn(tx, { userId: v.userId, type: 'REFUND', amount: cur.amount, referenceType: 'withdrawal', referenceId: cur.id, note: `Withdrawal wapas: ${note}` });
    const [up] = await tx.update(withdrawals).set({ status: 'REJECTED', note, processedBy: authId(req), processedAt: new Date() }).where(eq(withdrawals.id, id)).returning();
    await audit(req, 'withdrawal.reject', 'withdrawal', id, { note, amount: cur.amount }, tx);
    return { ...up, vendorUserId: v.userId };
  });
  await notify(w.vendorUserId, 'Withdrawal wapas hua', `${note}. Raqam aapke wallet mein wapas hai.`, { type: 'withdrawal' });
  res.json(w);
});

// ======================= Catalog & settings =======================

const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  description: z.string().trim().max(200).default(''),
  icon: z.string().trim().regex(/^[a-z0-9-]{2,40}$/).default('chatbubbles-outline'),
  kind: z.enum(['LISTENER', 'EXPERT']),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

adminRouter.get('/admin/categories', async (_req, res) => {
  const items = await db
    .select({ c: categories, vendors: sql<number>`(select count(*)::int from vendor_categories vc where vc.category_id = ${categories.id})` })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  res.json({ items: items.map((r) => ({ ...r.c, vendors: r.vendors })) });
});

adminRouter.post('/admin/categories', async (req, res) => {
  const data = body(req, categorySchema);
  const [c] = await db.insert(categories).values(data).returning();
  await audit(req, 'category.create', 'category', c.id, data);
  res.status(201).json(c);
});

adminRouter.patch('/admin/categories/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const data = body(req, categorySchema.partial().strict());
  const [c] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
  if (!c) throw notFound('Category');
  await audit(req, 'category.update', 'category', id, data);
  res.json(c);
});

/** Har setting ka apna validation: admin panel se galat value (jaise 150% commission) nahi ja sakti */
const settingsSchema = z
  .object({
    appName: z.string().trim().min(2).max(40),
    gstPct: z.number().int().min(0).max(28),
    commissionPct: z.number().int().min(0).max(90),
    minSessionMinutes: z.number().int().min(1).max(30),
    requestTimeoutSec: z.number().int().min(20).max(300),
    minRechargePaise: z.number().int().min(100).max(1_000_000),
    maxRechargePaise: z.number().int().min(1000).max(100_000_000),
    minRatePerMinPaise: z.number().int().min(100).max(100_000),
    maxRatePerMinPaise: z.number().int().min(100).max(1_000_000),
    minWithdrawalPaise: z.number().int().min(100).max(10_000_000),
    supportEmail: z.string().trim().email(),
    maskContactInfoInChat: z.boolean(),
  })
  .partial()
  .strict();

adminRouter.get('/admin/settings', async (_req, res) => {
  res.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS });
});

adminRouter.patch('/admin/settings', async (req, res) => {
  const data = body(req, settingsSchema);
  const merged = { ...(await getSettings()), ...data };
  if (merged.minRatePerMinPaise > merged.maxRatePerMinPaise) throw badRequest('BAD_RANGE', 'Min rate, max rate se zyada nahi ho sakta');
  if (merged.minRechargePaise > merged.maxRechargePaise) throw badRequest('BAD_RANGE', 'Min recharge, max se zyada nahi ho sakta');
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      await tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    }
    await audit(req, 'settings.update', 'settings', null, data, tx);
  });
  clearSettingsCache();
  res.json({ settings: await getSettings() });
});

const packSchema = z.object({
  amount: z.number().int().min(100).max(100_000_000),
  bonusPct: z.number().int().min(0).max(100).default(0),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

adminRouter.get('/admin/recharge-packs', async (_req, res) => {
  res.json({ items: await db.select().from(rechargePacks).orderBy(asc(rechargePacks.sortOrder), asc(rechargePacks.amount)) });
});
adminRouter.post('/admin/recharge-packs', async (req, res) => {
  const data = body(req, packSchema);
  const [p] = await db.insert(rechargePacks).values(data).returning();
  await audit(req, 'pack.create', 'recharge_pack', p.id, data);
  res.status(201).json(p);
});
adminRouter.patch('/admin/recharge-packs/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const data = body(req, packSchema.partial().strict());
  const [p] = await db.update(rechargePacks).set(data).where(eq(rechargePacks.id, id)).returning();
  if (!p) throw notFound('Pack');
  await audit(req, 'pack.update', 'recharge_pack', id, data);
  res.json(p);
});

const bannerSchema = z.object({
  title: z.string().trim().min(3).max(60),
  subtitle: z.string().trim().max(100).nullable().default(null),
  link: z.enum(['wallet', 'listeners', 'experts', 'support']).nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

adminRouter.get('/admin/banners', async (_req, res) => {
  res.json({ items: await db.select().from(banners).orderBy(asc(banners.sortOrder)) });
});
adminRouter.post('/admin/banners', async (req, res) => {
  const data = body(req, bannerSchema);
  const [b] = await db.insert(banners).values(data).returning();
  await audit(req, 'banner.create', 'banner', b.id, data);
  res.status(201).json(b);
});
adminRouter.patch('/admin/banners/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const data = body(req, bannerSchema.partial().strict());
  const [b] = await db.update(banners).set(data).where(eq(banners.id, id)).returning();
  if (!b) throw notFound('Banner');
  await audit(req, 'banner.update', 'banner', id, data);
  res.json(b);
});
adminRouter.delete('/admin/banners/:id', async (req, res) => {
  const { id } = params(req, idParam);
  await db.delete(banners).where(eq(banners.id, id));
  await audit(req, 'banner.delete', 'banner', id);
  res.json({ ok: true });
});

adminRouter.get('/admin/keywords', async (_req, res) => {
  res.json({ items: await db.select().from(blockedKeywords).orderBy(asc(blockedKeywords.word)) });
});
adminRouter.post('/admin/keywords', async (req, res) => {
  const { word } = body(req, z.object({ word: z.string().trim().toLowerCase().min(2).max(40) }));
  const [k] = await db.insert(blockedKeywords).values({ word }).onConflictDoNothing().returning();
  clearKeywordCache();
  await audit(req, 'keyword.add', 'keyword', k?.id ?? null, { word });
  res.status(201).json(k ?? { word });
});
adminRouter.delete('/admin/keywords/:id', async (req, res) => {
  const { id } = params(req, idParam);
  await db.delete(blockedKeywords).where(eq(blockedKeywords.id, id));
  clearKeywordCache();
  await audit(req, 'keyword.delete', 'keyword', id);
  res.json({ ok: true });
});

// ======================= Support, reports, reviews =======================

adminRouter.get('/admin/tickets', async (req, res) => {
  const q = query(req, pagination.extend({ status: z.enum(['OPEN', 'CLOSED']).optional() }));
  const where = q.status ? eq(supportTickets.status, q.status) : undefined;
  const items = await db
    .select({ t: supportTickets, userName: users.name, phone: users.phone, role: users.role })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .where(where)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  res.json({ items: items.map((r) => ({ ...r.t, userName: r.userName, phone: r.phone, role: r.role })) });
});

adminRouter.get('/admin/tickets/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const [t] = await db.select({ t: supportTickets, userName: users.name, phone: users.phone, role: users.role }).from(supportTickets).innerJoin(users, eq(users.id, supportTickets.userId)).where(eq(supportTickets.id, id));
  if (!t) throw notFound('Ticket');
  const messages = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, id)).orderBy(asc(ticketMessages.createdAt));
  res.json({ ...t.t, userName: t.userName, phone: t.phone, role: t.role, messages });
});

adminRouter.post('/admin/tickets/:id/reply', async (req, res) => {
  const { id } = params(req, idParam);
  const { message } = body(req, z.object({ message: z.string().trim().min(1).max(2000) }));
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
  if (!t) throw notFound('Ticket');
  const [m] = await db.insert(ticketMessages).values({ ticketId: id, senderId: authId(req), isStaff: true, body: message }).returning();
  await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, id));
  await audit(req, 'ticket.reply', 'ticket', id);
  await notify(t.userId, 'Support ka jawab aaya', message.slice(0, 120), { type: 'ticket', ticketId: id });
  res.status(201).json(m);
});

adminRouter.post('/admin/tickets/:id/close', async (req, res) => {
  const { id } = params(req, idParam);
  const [t] = await db.update(supportTickets).set({ status: 'CLOSED' }).where(eq(supportTickets.id, id)).returning();
  if (!t) throw notFound('Ticket');
  await audit(req, 'ticket.close', 'ticket', id);
  res.json(t);
});

adminRouter.get('/admin/reports', async (req, res) => {
  const q = query(req, pagination.extend({ status: z.enum(['OPEN', 'RESOLVED']).optional() }));
  const where = q.status ? eq(reports.status, q.status) : undefined;
  const items = await db
    .select({ r: reports, reporterName: users.name, vendorName: vendors.displayName })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .innerJoin(vendors, eq(vendors.id, reports.vendorId))
    .where(where)
    .orderBy(desc(reports.createdAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  res.json({ items: items.map((x) => ({ ...x.r, reporterName: x.reporterName, vendorName: x.vendorName })) });
});

adminRouter.post('/admin/reports/:id/resolve', async (req, res) => {
  const { id } = params(req, idParam);
  const { resolution, warnVendor } = body(req, z.object({ resolution: z.string().trim().min(5).max(500), warnVendor: z.boolean().default(true) }));
  const [r] = await db
    .update(reports)
    .set({ status: 'RESOLVED', resolution, resolvedBy: authId(req), resolvedAt: new Date() })
    .where(and(eq(reports.id, id), eq(reports.status, 'OPEN')))
    .returning();
  if (!r) throw conflict('INVALID_STATE', 'Report pehle hi resolve ho chuki hai');
  await audit(req, 'report.resolve', 'report', id, { resolution, warnVendor });
  // Reporter (user) ko batao ki shikayat par kaarvai ho gayi
  await notify(r.reporterId, 'Aapki shikayat par kaarvai hui ✅', resolution, { type: 'report_resolved', reportId: id });
  // Vendor ko chetavani
  if (warnVendor) {
    const [v] = await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, r.vendorId));
    if (v) await notify(v.userId, 'Aapke khilaaf shikayat par chetavani ⚠️', resolution, { type: 'warning', reportId: id });
  }
  res.json(r);
});

adminRouter.get('/admin/reviews', async (req, res) => {
  const { page, limit } = query(req, pagination);
  const items = await db
    .select({ r: reviews, userName: users.name, vendorName: vendors.displayName })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .innerJoin(vendors, eq(vendors.id, reviews.vendorId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ items: items.map((x) => ({ ...x.r, userName: x.userName, vendorName: x.vendorName })) });
});

adminRouter.post('/admin/reviews/:id/visibility', async (req, res) => {
  const { id } = params(req, idParam);
  const { hidden } = body(req, z.object({ hidden: z.boolean() }));
  const [r] = await db.update(reviews).set({ isHidden: hidden }).where(eq(reviews.id, id)).returning();
  if (!r) throw notFound('Review');
  await audit(req, hidden ? 'review.hide' : 'review.show', 'review', id);
  res.json(r);
});

// ======================= Audit =======================

adminRouter.get('/admin/audit-logs', async (req, res) => {
  const { page, limit } = query(req, pagination);
  const items = await db
    .select({ a: auditLogs, adminEmail: users.email })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.adminId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ items: items.map((x) => ({ ...x.a, adminEmail: x.adminEmail })), page, limit });
});
