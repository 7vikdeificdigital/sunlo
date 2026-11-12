import { Router } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  categories,
  consultSessions,
  payoutAccounts,
  reviews,
  uploads,
  users,
  vendorCategories,
  vendors,
  walletTransactions,
  wallets,
  withdrawals,
} from '../../db/schema';
import { encryptField } from '../../lib/crypto';
import { notifyFavoritesOnline, notifyRecentChatters } from '../../lib/favNotify';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { getSettings } from '../../lib/settings';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { vendorSessions } from '../sessions/service';
import { avatarUrl } from '../uploads/routes';
import { giftVendorEarning } from '../gifts/stats';
import { postTxn } from '../wallet/ledger';
import { maskName } from '../vendors/routes';

/** Vendor app ke saare kaam. Har route par VENDOR role zaroori. */
export const vendorSelfRouter = Router();
vendorSelfRouter.use('/vendor', requireRole('VENDOR'));

async function myVendor(userId: string) {
  const [v] = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
  if (!v) throw forbidden('Vendor profile nahi mila');
  return v;
}

function maskedPayout(p: typeof payoutAccounts.$inferSelect | undefined) {
  if (!p) return null;
  return p.method === 'UPI'
    ? { method: 'UPI' as const, upiId: p.upiId }
    : { method: 'BANK' as const, accountHolder: p.accountHolder, accountLast4: p.accountLast4, ifsc: p.ifsc };
}

// ---------------- Profile ----------------

vendorSelfRouter.get('/vendor/me', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  const [cats, [payout], [w], [u], s] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(vendorCategories).innerJoin(categories, eq(categories.id, vendorCategories.categoryId)).where(eq(vendorCategories.vendorId, v.id)),
    db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, v.id)),
    db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)),
    db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)),
    getSettings(),
  ]);
  const { kycUploadId, panEnc, ...rest } = v;
  res.json({
    ...rest,
    pan: v.panLast4 ? { last4: v.panLast4, name: v.panName, addedAt: v.panAddedAt } : null,
    tds: { enabled: s.tdsEnabled, pctWithPan: s.tdsBps / 100, pctWithoutPan: s.tdsNoPanBps / 100 },
    phone: u?.phone,
    hasKyc: Boolean(kycUploadId),
    categories: cats,
    payout: maskedPayout(payout),
    walletBalance: w?.balance ?? 0,
    limits: { minRatePerMinPaise: s.minRatePerMinPaise, maxRatePerMinPaise: s.maxRatePerMinPaise, minWithdrawalPaise: s.minWithdrawalPaise, commissionPct: s.commissionPct },
  });
});

const profileSchema = z
  .object({
    displayName: z.string().trim().min(3).max(50),
    headline: z.string().trim().min(5).max(80),
    bio: z.string().trim().max(1500),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    experienceYears: z.number().int().min(0).max(60),
    languages: z.array(z.string().trim().min(2).max(30)).min(1).max(8),
    tags: z.array(z.string().trim().min(2).max(30)).max(8),
    categoryIds: z.array(z.string().uuid()).min(1).max(4),
    avatarUploadId: z.string().uuid(),
    kycDocType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID']),
    kycUploadId: z.string().uuid(),
  })
  .partial()
  .strict(); // status, rating, approval jaise fields vendor khud nahi badal sakta

async function ownUpload(userId: string, id: string, kind: 'AVATAR' | 'KYC') {
  const [u] = await db.select({ id: uploads.id }).from(uploads).where(and(eq(uploads.id, id), eq(uploads.ownerId, userId), eq(uploads.kind, kind))).limit(1);
  if (!u) throw badRequest('BAD_UPLOAD', 'File nahi mili, dobara upload karein');
}

vendorSelfRouter.patch('/vendor/me', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  if (v.status === 'SUSPENDED') throw forbidden('Aapki profile suspend hai. Support se sampark karein.');
  const { categoryIds, avatarUploadId, kycUploadId, ...data } = body(req, profileSchema);
  if (v.status === 'PENDING' && (kycUploadId || data.kycDocType)) throw conflict('UNDER_REVIEW', 'Review ke dauran document nahi badal sakte');
  if (avatarUploadId) await ownUpload(userId, avatarUploadId, 'AVATAR');
  if (kycUploadId) await ownUpload(userId, kycUploadId, 'KYC');
  if (categoryIds) {
    const found = await db.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, categoryIds), eq(categories.isActive, true)));
    if (found.length !== new Set(categoryIds).size) throw badRequest('BAD_CATEGORY', 'Category sahi nahi hai');
  }
  await db.transaction(async (tx) => {
    await tx
      .update(vendors)
      .set({
        ...data,
        ...(avatarUploadId ? { avatarUrl: avatarUrl(avatarUploadId) } : {}),
        ...(kycUploadId ? { kycUploadId } : {}),
      })
      .where(eq(vendors.id, v.id));
    if (categoryIds) {
      await tx.delete(vendorCategories).where(eq(vendorCategories.vendorId, v.id));
      await tx.insert(vendorCategories).values([...new Set(categoryIds)].map((categoryId) => ({ vendorId: v.id, categoryId })));
    }
  });
  res.json({ ok: true });
});

/** Profile poori karke admin ke paas approval ke liye bhejna */
vendorSelfRouter.post('/vendor/me/submit', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  if (!['DRAFT', 'REJECTED'].includes(v.status)) throw conflict('INVALID_STATE', 'Profile pehle se review mein ya approved hai');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(vendorCategories).where(eq(vendorCategories.vendorId, v.id));
  const missing: string[] = [];
  if (v.displayName.length < 3) missing.push('naam');
  if (v.headline.length < 5) missing.push('headline');
  if (v.bio.length < 50) missing.push('parichay (kam se kam 50 akshar)');
  if (!v.languages.length) missing.push('bhasha');
  if (!n) missing.push('category');
  if (!v.kycUploadId || !v.kycDocType) missing.push('ID document');
  if (!v.avatarUrl) missing.push('profile photo');
  if (!v.panLast4) missing.push('PAN (TDS ke liye)');
  if (missing.length) throw badRequest('INCOMPLETE_PROFILE', `Yeh bharna baaki hai: ${missing.join(', ')}`, { missing });
  await db.update(vendors).set({ status: 'PENDING', submittedAt: new Date(), rejectionReason: null }).where(eq(vendors.id, v.id));
  res.json({ status: 'PENDING' });
});

const rateSchema = z
  .object({
    chatRatePerMin: z.number().int(),
    callRatePerMin: z.number().int(),
    videoRatePerMin: z.number().int(),
    chatEnabled: z.boolean(),
    callEnabled: z.boolean(),
    videoEnabled: z.boolean(),
  })
  .partial()
  .strict();

/** Rate admin ki seema (min/max) ke andar hi */
vendorSelfRouter.patch('/vendor/rates', async (req, res) => {
  const v = await myVendor(authId(req));
  const data = body(req, rateSchema);
  const s = await getSettings();
  for (const k of ['chatRatePerMin', 'callRatePerMin', 'videoRatePerMin'] as const) {
    const r = data[k];
    if (r !== undefined && (r < s.minRatePerMinPaise || r > s.maxRatePerMinPaise)) {
      throw badRequest('RATE_OUT_OF_RANGE', `Rate Rs ${s.minRatePerMinPaise / 100} se Rs ${s.maxRatePerMinPaise / 100} per minute ke beech rakhein`);
    }
  }
  const [up] = await db.update(vendors).set(data).where(eq(vendors.id, v.id)).returning();
  if (!up.chatEnabled && !up.callEnabled && !up.videoEnabled) {
    await db.update(vendors).set({ chatEnabled: true }).where(eq(vendors.id, v.id));
  }
  res.json({ ok: true });
});

vendorSelfRouter.patch('/vendor/status', async (req, res) => {
  const v = await myVendor(authId(req));
  const { isOnline } = body(req, z.object({ isOnline: z.boolean() }));
  if (isOnline && v.status !== 'APPROVED') throw forbidden('Approval ke baad hi online ho sakte hain');
  await db.update(vendors).set({ isOnline }).where(eq(vendors.id, v.id));
  if (isOnline && !v.isOnline) {
    void notifyFavoritesOnline(v.id, v.displayName);
    void notifyRecentChatters(v.id, v.displayName);
  }
  res.json({ isOnline });
});

// ---------------- Sessions & earnings ----------------

vendorSelfRouter.get('/vendor/sessions', async (req, res) => {
  const { page, limit } = query(req, pagination);
  res.json({ items: await vendorSessions(authId(req), page, limit), page, limit });
});

vendorSelfRouter.get('/vendor/earnings', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  const [w] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const since = (days: number) => new Date(Date.now() - days * 86400_000);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const stat = async (from: Date) => {
    const [r] = await db
      .select({
        earning: sql<number>`coalesce(sum(${consultSessions.vendorEarning}),0)::int`,
        minutes: sql<number>`coalesce(sum(ceil(${consultSessions.billedSeconds} / 60.0)),0)::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(consultSessions)
      .where(and(eq(consultSessions.vendorId, v.id), eq(consultSessions.status, 'COMPLETED'), gte(consultSessions.endedAt, from)));
    return { earning: r.earning, minutes: r.minutes, sessions: r.sessions };
  };
  const [today, week, month] = await Promise.all([stat(startToday), stat(since(7)), stat(since(30))]);
  const [gT, gW, gM] = await Promise.all([startToday, since(7), since(30)].map((d) => giftVendorEarning(v.id, d)));
  today.earning += gT;
  week.earning += gW;
  month.earning += gM;
  const txns = w
    ? await db
        .select({ id: walletTransactions.id, type: walletTransactions.type, amount: walletTransactions.amount, balanceAfter: walletTransactions.balanceAfter, note: walletTransactions.note, createdAt: walletTransactions.createdAt })
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, w.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(50)
    : [];
  res.json({ balance: w?.balance ?? 0, today, week, month, transactions: txns });
});

// ---------------- Payout account ----------------

const payoutSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('UPI'), upiId: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/, 'UPI ID sahi nahi hai') }).strict(),
  z
    .object({
      method: z.literal('BANK'),
      accountHolder: z.string().trim().min(3).max(80),
      accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Account number 9-18 ankon ka hota hai'),
      ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC code sahi nahi hai'),
    })
    .strict(),
]);

vendorSelfRouter.get('/vendor/payout-account', async (req, res) => {
  const v = await myVendor(authId(req));
  const [p] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, v.id)).limit(1);
  res.json({ payout: maskedPayout(p) });
});

vendorSelfRouter.put('/vendor/payout-account', async (req, res) => {
  const v = await myVendor(authId(req));
  const data = body(req, payoutSchema);
  const [pending] = await db.select({ id: withdrawals.id }).from(withdrawals).where(and(eq(withdrawals.vendorId, v.id), eq(withdrawals.status, 'PENDING'))).limit(1);
  if (pending) throw conflict('WITHDRAWAL_PENDING', 'Pending withdrawal ke dauran account nahi badal sakte');
  const row =
    data.method === 'UPI'
      ? { method: 'UPI' as const, upiId: data.upiId, accountHolder: null, accountNumberEnc: null, accountLast4: null, ifsc: null }
      : {
          method: 'BANK' as const,
          upiId: null,
          accountHolder: data.accountHolder,
          accountNumberEnc: encryptField(data.accountNumber), // DB mein encrypted
          accountLast4: data.accountNumber.slice(-4),
          ifsc: data.ifsc,
        };
  const [saved] = await db
    .insert(payoutAccounts)
    .values({ vendorId: v.id, ...row })
    .onConflictDoUpdate({ target: payoutAccounts.vendorId, set: row })
    .returning();
  res.json({ payout: maskedPayout(saved) });
});

// ---------------- Withdrawals ----------------

vendorSelfRouter.get('/vendor/withdrawals', async (req, res) => {
  const v = await myVendor(authId(req));
  const items = await db
    .select({ id: withdrawals.id, amount: withdrawals.amount, status: withdrawals.status, payoutSnapshot: withdrawals.payoutSnapshot, reference: withdrawals.reference, note: withdrawals.note, createdAt: withdrawals.createdAt, processedAt: withdrawals.processedAt })
    .from(withdrawals)
    .where(eq(withdrawals.vendorId, v.id))
    .orderBy(desc(withdrawals.createdAt))
    .limit(50);
  res.json({ items });
});

/** Paisa turant wallet se "hold" (WITHDRAWAL) ho jaata hai; admin reject kare to wapas (REFUND) */
vendorSelfRouter.post('/vendor/withdrawals', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  if (v.status !== 'APPROVED') throw forbidden('Sirf approved vendor withdrawal kar sakte hain');
  const { amount } = body(req, z.object({ amount: z.number().int().positive() }));
  const s = await getSettings();
  if (amount < s.minWithdrawalPaise) throw badRequest('AMOUNT_TOO_LOW', `Kam se kam Rs ${s.minWithdrawalPaise / 100} nikal sakte hain`);
  if (!v.panLast4) throw badRequest('PAN_REQUIRED', 'Withdrawal ke liye pehle PAN jodein (TDS ke liye zaroori)');
  const [p] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.vendorId, v.id)).limit(1);
  if (!p) throw badRequest('NO_PAYOUT_ACCOUNT', 'Pehle bank ya UPI details jodein');
  try {
    const w = await db.transaction(async (tx) => {
      const [row] = await tx.insert(withdrawals).values({ vendorId: v.id, amount, payoutSnapshot: maskedPayout(p)!, panLast4: v.panLast4 }).returning();
      await postTxn(tx, { userId, type: 'WITHDRAWAL', amount: -amount, referenceType: 'withdrawal', referenceId: row.id, note: 'Withdrawal request' });
      return row;
    });
    res.status(201).json(w);
  } catch (e) {
    const c = (e as { cause?: { code?: string; constraint?: string } }).cause ?? (e as { code?: string; constraint?: string });
    if (c?.code === '23505' && c?.constraint === 'withdrawal_one_pending_uq') throw conflict('WITHDRAWAL_PENDING', 'Ek withdrawal pehle se pending hai');
    throw e;
  }
});

// ---------------- PAN (TDS) ----------------

/** PAN: poora encrypted rakhte hain, wapas sirf last 4. PAN ke bina TDS 5% katta hai, PAN ke saath 0.1% */
vendorSelfRouter.put('/vendor/pan', async (req, res) => {
  const v = await myVendor(authId(req));
  const { pan, name } = body(
    req,
    z.object({
      pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN sahi nahi hai (jaise ABCDE1234F)'),
      name: z.string().trim().min(3).max(80),
    }),
  );
  const [pending] = await db.select({ id: withdrawals.id }).from(withdrawals).where(and(eq(withdrawals.vendorId, v.id), eq(withdrawals.status, 'PENDING'))).limit(1);
  if (pending) throw conflict('WITHDRAWAL_PENDING', 'Pending withdrawal ke dauran PAN nahi badal sakte');
  await db.update(vendors).set({ panEnc: encryptField(pan), panLast4: pan.slice(-4), panName: name, panAddedAt: new Date() }).where(eq(vendors.id, v.id));
  res.json({ pan: { last4: pan.slice(-4), name } });
});

/**
 * Mahine ka kamai statement: gross (user ne kitna diya + free trial), commission, TDS, net, payout.
 * month = YYYY-MM (IST)
 */
vendorSelfRouter.get('/vendor/statement', async (req, res) => {
  const userId = authId(req);
  const v = await myVendor(userId);
  const { month } = query(req, z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }));
  const [y, m] = month.split('-').map(Number);
  const from = new Date(`${month}-01T00:00:00+05:30`);
  const to = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01T00:00:00+05:30`);
  const [w] = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const [sess] = await db
    .select({
      sessions: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(ceil(${consultSessions.billedSeconds} / 60.0)),0)::int`,
      gross: sql<number>`coalesce(sum(${consultSessions.chargedAmount} + ${consultSessions.promoAmount}),0)::int`,
      free: sql<number>`coalesce(sum(${consultSessions.promoAmount}),0)::int`,
    })
    .from(consultSessions)
    .where(and(eq(consultSessions.vendorId, v.id), eq(consultSessions.status, 'COMPLETED'), gte(consultSessions.endedAt, from), sql`${consultSessions.endedAt} < ${to.toISOString()}::timestamptz`));
  const ledger = w
    ? (
        await db.execute(sql`
          select type, coalesce(sum(amount),0)::int as total from wallet_transactions
          where wallet_id = ${w.id} and created_at >= ${from.toISOString()}::timestamptz and created_at < ${to.toISOString()}::timestamptz
          group by type`)
      ).rows as { type: string; total: number }[]
    : [];
  const sum = (t: string) => Number(ledger.find((r) => r.type === t)?.total ?? 0);
  const gifts = (
    await db.execute(sql`select coalesce(sum(price),0)::int as gross from gift_sends where vendor_id = ${v.id} and created_at >= ${from.toISOString()}::timestamptz and created_at < ${to.toISOString()}::timestamptz`)
  ).rows[0] as { gross: number };
  const earning = sum('SESSION_EARNING');
  const tds = -sum('TDS');
  const grossAll = sess.gross + Number(gifts.gross);
  res.json({
    month,
    pan: v.panLast4 ? `XXXXXX${v.panLast4}` : null,
    sessions: sess.sessions,
    minutes: sess.minutes,
    gross: grossAll,
    sessionGross: sess.gross,
    giftGross: Number(gifts.gross),
    freeTrialPaidByPlatform: sess.free,
    commission: grossAll - earning,
    earning,
    tds,
    net: earning - tds,
    adjustments: sum('ADJUSTMENT'),
    withdrawn: -sum('WITHDRAWAL') - sum('REFUND'),
    note: 'TDS ka certificate (Form 16A jaisa) har quarter ke baad milega. PAN sahi rakhein.',
  });
});

// ---------------- Reviews ----------------

vendorSelfRouter.get('/vendor/reviews', async (req, res) => {
  const v = await myVendor(authId(req));
  const items = await db
    .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, reply: reviews.reply, createdAt: reviews.createdAt, userName: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.vendorId, v.id))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
  res.json({ items: items.map((r) => ({ ...r, userName: maskName(r.userName) })), ratingAvg: v.ratingAvg, ratingCount: v.ratingCount });
});

vendorSelfRouter.post('/vendor/reviews/:id/reply', async (req, res) => {
  const v = await myVendor(authId(req));
  const { id } = params(req, idParam);
  const { reply } = body(req, z.object({ reply: z.string().trim().min(1).max(500) }));
  const up = await db.update(reviews).set({ reply }).where(and(eq(reviews.id, id), eq(reviews.vendorId, v.id))).returning({ id: reviews.id });
  if (!up.length) throw notFound('Review');
  res.json({ ok: true });
});
