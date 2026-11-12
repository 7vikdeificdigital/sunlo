import { Router } from 'express';
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  chatMessages,
  consultSessions,
  payments,
  reports,
  reviews,
  supportTickets,
  takedowns,
  users,
  vendors,
  walletTransactions,
  wallets,
} from '../../db/schema';
import { decryptField, encryptField } from '../../lib/crypto';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors';
import { getSettings } from '../../lib/settings';
import { newTotpSecret, otpauthUrl, verifyTotp } from '../../lib/totp';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { audit } from '../admin/audit';
import { logoutAll } from '../auth/service';
import { closeRoom } from '../rooms/service';
import { InsufficientBalanceError, postTxn } from '../wallet/ledger';
import { refundAtProvider } from '../wallet/payments';
import { sendPolicyNotice } from './jobs';

/**
 * Sarkari niyamon ke liye admin tools:
 * - Takedown (IT Rules 2026: court/sarkari order par 3 ghante mein)
 * - Shikayat SLA overview (7 din / 36 ghante)
 * - TDS report (Sec 393 / 194-O)
 * - Recharge refund original source par (RBI closed-system PPI)
 * - Admin 2FA, har 3 mahine ka policy notice
 */
export const complianceRouter = Router();
complianceRouter.use('/admin', requireRole('ADMIN'));

// ======================= Admin 2FA =======================

complianceRouter.post('/admin/2fa/setup', async (req, res) => {
  const id = authId(req);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (u.totpEnabledAt) throw conflict('TOTP_ALREADY_ON', '2FA pehle se chalu hai');
  const secret = newTotpSecret();
  await db.update(users).set({ totpSecretEnc: encryptField(secret) }).where(eq(users.id, id));
  res.json({ secret, otpauthUrl: otpauthUrl(secret, u.email ?? 'admin') });
});

complianceRouter.post('/admin/2fa/enable', async (req, res) => {
  const id = authId(req);
  const { code } = body(req, z.object({ code: z.string().trim() }));
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u.totpSecretEnc) throw badRequest('TOTP_NOT_SETUP', 'Pehle 2FA setup karein');
  if (!verifyTotp(decryptField(u.totpSecretEnc), code)) throw badRequest('TOTP_INVALID', 'Code galat hai');
  await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, id));
  await audit(req, 'admin.2fa.enable', 'user', id);
  res.json({ ok: true, totpEnabled: true });
});

complianceRouter.post('/admin/2fa/disable', async (req, res) => {
  const id = authId(req);
  const { code } = body(req, z.object({ code: z.string().trim() }));
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u.totpEnabledAt || !u.totpSecretEnc) throw badRequest('TOTP_OFF', '2FA chalu nahi hai');
  if (!verifyTotp(decryptField(u.totpSecretEnc), code)) throw badRequest('TOTP_INVALID', 'Code galat hai');
  await db.update(users).set({ totpEnabledAt: null, totpSecretEnc: null }).where(eq(users.id, id));
  await audit(req, 'admin.2fa.disable', 'user', id);
  res.json({ ok: true, totpEnabled: false });
});

// ======================= Overview =======================

complianceRouter.get('/admin/compliance/overview', async (_req, res) => {
  const now = new Date();
  const s = await getSettings();
  const [[t], [r], [pan], [td], [adm]] = await Promise.all([
    db
      .select({
        open: sql<number>`count(*)::int`,
        overdue: sql<number>`count(*) filter (where ${supportTickets.dueAt} < ${now.toISOString()}::timestamptz)::int`,
        dueSoon: sql<number>`count(*) filter (where ${supportTickets.dueAt} between ${now.toISOString()}::timestamptz and ${new Date(now.getTime() + 86400_000).toISOString()}::timestamptz)::int`,
      })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'OPEN')),
    db
      .select({
        open: sql<number>`count(*)::int`,
        overdue: sql<number>`count(*) filter (where ${reports.dueAt} < ${now.toISOString()}::timestamptz)::int`,
      })
      .from(reports)
      .where(eq(reports.status, 'OPEN')),
    db
      .select({ missing: sql<number>`count(*) filter (where ${vendors.panLast4} is null)::int`, approved: sql<number>`count(*)::int` })
      .from(vendors)
      .where(eq(vendors.status, 'APPROVED')),
    db
      .select({ total: sql<number>`count(*)::int`, late: sql<number>`count(*) filter (where ${takedowns.actionedAt} > ${takedowns.dueAt})::int` })
      .from(takedowns),
    db
      .select({ total: sql<number>`count(*)::int`, with2fa: sql<number>`count(*) filter (where ${users.totpEnabledAt} is not null)::int` })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt))),
  ]);
  const last = s.lastPolicyNoticeAt ? new Date(s.lastPolicyNoticeAt) : null;
  const checks = [
    { key: 'grievance_officer', ok: Boolean(s.grievanceOfficerName && (s.grievanceOfficerEmail || s.supportEmail) && s.grievanceOfficerPhone), label: 'Grievance Officer ka naam, email, phone set hai' },
    { key: 'tickets_sla', ok: t.overdue === 0, label: `Shikayat 7 din mein (${t.overdue} der se)` },
    { key: 'reports_sla', ok: r.overdue === 0, label: `Report 36 ghante mein (${r.overdue} der se)` },
    { key: 'policy_notice', ok: Boolean(last && now.getTime() - last.getTime() < 92 * 86400_000), label: 'Pichhle 3 mahine mein users ko niyamon ka notice' },
    { key: 'live_rooms_off', ok: !s.liveRoomsEnabled, label: 'Live Rooms band (moderation taiyaar hone tak)' },
    { key: 'random_video_off', ok: !s.randomVideoEnabled, label: 'Random video band' },
    { key: 'vendor_pan', ok: pan.missing === 0, label: `Sab approved listener ka PAN (${pan.missing} baaki)` },
    { key: 'admin_2fa', ok: adm.total > 0 && adm.with2fa === adm.total, label: `Sab admin par 2FA (${adm.with2fa}/${adm.total})` },
    { key: 'chat_retention', ok: s.chatRetentionDays <= 180, label: `Chat ${s.chatRetentionDays} din baad delete` },
  ];
  res.json({ tickets: t, reports: r, vendorsWithoutPan: pan.missing, takedowns: td, admins: adm, lastPolicyNoticeAt: last, checks });
});

// ======================= Shikayat SLA list =======================

complianceRouter.get('/admin/grievances', async (req, res) => {
  const q = query(req, pagination.extend({ overdue: z.enum(['true', 'false']).optional() }));
  const now = new Date();
  const conds = [eq(supportTickets.status, 'OPEN')];
  if (q.overdue === 'true') conds.push(lt(supportTickets.dueAt, now));
  const items = await db
    .select({ t: supportTickets, userName: users.name, role: users.role })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .where(and(...conds))
    .orderBy(asc(supportTickets.dueAt))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  res.json({
    items: items.map((x) => ({
      ...x.t,
      userName: x.userName,
      role: x.role,
      overdue: Boolean(x.t.dueAt && x.t.dueAt < now),
      hoursLeft: x.t.dueAt ? Math.round((x.t.dueAt.getTime() - now.getTime()) / 3600_000) : null,
    })),
  });
});

// ======================= Takedown (3 ghante) =======================

const TARGETS = ['USER', 'VENDOR', 'MESSAGE', 'ROOM', 'VOICE_NOTE', 'REVIEW'] as const;

complianceRouter.get('/admin/takedowns', async (req, res) => {
  const { page, limit } = query(req, pagination);
  const items = await db
    .select({ t: takedowns, adminEmail: users.email })
    .from(takedowns)
    .innerJoin(users, eq(users.id, takedowns.actionedBy))
    .orderBy(desc(takedowns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ items: items.map((x) => ({ ...x.t, adminEmail: x.adminEmail, late: x.t.actionedAt > x.t.dueAt })) });
});

/** Order milte hi: content/account turant hatao + record (kab mila, kab hataya, kis order par) */
complianceRouter.post('/admin/takedowns', async (req, res) => {
  const input = body(
    req,
    z.object({
      targetType: z.enum(TARGETS),
      targetId: z.string().uuid(),
      authority: z.string().trim().min(3).max(120),
      orderRef: z.string().trim().min(2).max(120),
      note: z.string().trim().max(500).optional(),
      receivedAt: z.string().datetime({ offset: true }).optional(),
    }),
  );
  const now = new Date();
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : now;
  if (receivedAt.getTime() > now.getTime() + 60_000) throw badRequest('BAD_TIME', 'Order milne ka samay bhavishya mein nahi ho sakta');
  await executeTakedown(input.targetType, input.targetId);
  const [row] = await db
    .insert(takedowns)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      authority: input.authority,
      orderRef: input.orderRef,
      note: input.note,
      receivedAt,
      dueAt: new Date(receivedAt.getTime() + 3 * 3600_000),
      actionedAt: new Date(),
      actionedBy: authId(req),
    })
    .returning();
  await audit(req, 'takedown', input.targetType.toLowerCase(), input.targetId, { authority: input.authority, orderRef: input.orderRef });
  res.status(201).json({ ...row, late: row.actionedAt > row.dueAt });
});

async function executeTakedown(type: (typeof TARGETS)[number], id: string) {
  switch (type) {
    case 'USER': {
      const [u] = await db.update(users).set({ status: 'BLOCKED' }).where(eq(users.id, id)).returning({ id: users.id });
      if (!u) throw notFound('User');
      await logoutAll(id);
      await db.update(vendors).set({ isOnline: false }).where(eq(vendors.userId, id));
      return;
    }
    case 'VENDOR': {
      const [v] = await db.update(vendors).set({ status: 'SUSPENDED', isOnline: false }).where(eq(vendors.id, id)).returning({ userId: vendors.userId });
      if (!v) throw notFound('Vendor');
      const live = await db.execute(sql`select id from rooms where host_vendor_id = ${id} and status = 'LIVE'`);
      for (const r of live.rows as { id: string }[]) await closeRoom(r.id, 'TAKEDOWN');
      return;
    }
    case 'MESSAGE': {
      const [m] = await db
        .update(chatMessages)
        .set({ body: '[Kanooni aadesh par hataya gaya]', flagged: true })
        .where(eq(chatMessages.id, id))
        .returning({ id: chatMessages.id });
      if (!m) throw notFound('Message');
      return;
    }
    case 'ROOM': {
      await closeRoom(id, 'TAKEDOWN');
      return;
    }
    case 'VOICE_NOTE': {
      const r = await db.execute(sql`update voice_notes set status = 'CLOSED' where id = ${id} returning id`);
      if (!r.rows.length) throw notFound('Voice note');
      return;
    }
    case 'REVIEW': {
      const [r] = await db.update(reviews).set({ isHidden: true }).where(eq(reviews.id, id)).returning({ id: reviews.id });
      if (!r) throw notFound('Review');
      return;
    }
  }
}

// ======================= Policy notice (har 3 mahine) =======================

complianceRouter.post('/admin/policy-notice', async (req, res) => {
  const { title, message } = body(
    req,
    z.object({ title: z.string().trim().min(3).max(80).optional(), message: z.string().trim().min(10).max(500).optional() }),
  );
  const sent = await sendPolicyNotice(title, message);
  await audit(req, 'policy.notice', 'settings', null, { sent });
  res.json({ ok: true, sent });
});

// ======================= TDS report =======================

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // shamil nahi (exclusive)
  format: z.enum(['json', 'csv']).default('json'),
});

/**
 * Har vendor ka gross, kamai aur kaata gaya TDS (TDS return / Form 140 ke liye).
 * CSV mein poora PAN aata hai, isliye har download audit log mein jaata hai.
 */
complianceRouter.get('/admin/tds-report', async (req, res) => {
  const q = query(req, periodSchema);
  const from = new Date(`${q.from}T00:00:00+05:30`);
  const to = new Date(`${q.to}T00:00:00+05:30`);
  if (!(from < to)) throw badRequest('BAD_RANGE', '"from" tareekh "to" se pehle honi chahiye');
  const rows = await db
    .select({
      vendorId: vendors.id,
      displayName: vendors.displayName,
      panName: vendors.panName,
      panLast4: vendors.panLast4,
      panEnc: vendors.panEnc,
      earning: sql<number>`coalesce(sum(${walletTransactions.amount}) filter (where ${walletTransactions.type} = 'SESSION_EARNING'),0)::int`,
      tds: sql<number>`coalesce(-sum(${walletTransactions.amount}) filter (where ${walletTransactions.type} = 'TDS'),0)::int`,
      entries: sql<number>`count(*) filter (where ${walletTransactions.type} = 'TDS')::int`,
    })
    .from(walletTransactions)
    .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
    .innerJoin(vendors, eq(vendors.userId, wallets.userId))
    .where(and(inArray(walletTransactions.type, ['SESSION_EARNING', 'TDS']), gte(walletTransactions.createdAt, from), lt(walletTransactions.createdAt, to)))
    .groupBy(vendors.id)
    .orderBy(desc(sql`3`));
  // Gross (commission se pehle) = sessions ka charge + free trial + gifts; TDS note mein gross likha hota hai, yahan dobara jodte hain
  const gross = await db.execute(sql`
    select v.id as vendor_id,
      coalesce((select sum(cs.charged_amount + cs.promo_amount) from consult_sessions cs where cs.vendor_id = v.id and cs.status = 'COMPLETED' and cs.ended_at >= ${from.toISOString()}::timestamptz and cs.ended_at < ${to.toISOString()}::timestamptz),0)::int
      + coalesce((select sum(gs.price) from gift_sends gs where gs.vendor_id = v.id and gs.created_at >= ${from.toISOString()}::timestamptz and gs.created_at < ${to.toISOString()}::timestamptz),0)::int
      + coalesce((select sum(rm.charged_amount) from room_members rm join rooms r on r.id = rm.room_id where r.host_vendor_id = v.id and rm.left_at >= ${from.toISOString()}::timestamptz and rm.left_at < ${to.toISOString()}::timestamptz),0)::int as gross
    from vendors v`);
  const grossBy = new Map((gross.rows as { vendor_id: string; gross: number }[]).map((g) => [g.vendor_id, Number(g.gross)]));
  const items = rows.map((r) => ({
    vendorId: r.vendorId,
    displayName: r.displayName,
    panName: r.panName,
    panLast4: r.panLast4,
    gross: grossBy.get(r.vendorId) ?? 0,
    earning: r.earning,
    tds: r.tds,
  }));
  const totals = items.reduce((a, b) => ({ gross: a.gross + b.gross, earning: a.earning + b.earning, tds: a.tds + b.tds }), { gross: 0, earning: 0, tds: 0 });
  if (q.format === 'csv') {
    await audit(req, 'tds.export', 'report', null, { from: q.from, to: q.to, vendors: items.length });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const panOf = (enc: string | null) => {
      try {
        return enc ? decryptField(enc) : '';
      } catch {
        return '';
      }
    };
    const lines = [
      ['vendor_id', 'display_name', 'pan_name', 'pan', 'gross_rs', 'earning_rs', 'tds_rs'].join(','),
      ...rows.map((r) =>
        [r.vendorId, r.displayName, r.panName, panOf(r.panEnc), ((grossBy.get(r.vendorId) ?? 0) / 100).toFixed(2), (r.earning / 100).toFixed(2), (r.tds / 100).toFixed(2)].map(esc).join(','),
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tds-${q.from}-to-${q.to}.csv"`);
    return void res.send(lines.join('\n'));
  }
  res.json({ from: q.from, to: q.to, items, totals });
});

// ======================= Recharge refund original source par =======================

complianceRouter.post('/admin/payments/:id/refund-to-source', async (req, res) => {
  const { id } = params(req, idParam);
  const { reason } = body(req, z.object({ reason: z.string().trim().min(5).max(300) }));
  const [p] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!p) throw notFound('Payment');
  if (p.status !== 'PAID') throw conflict('INVALID_STATE', 'Sirf safal payment ka refund ho sakta hai');
  const coins = p.amount + p.bonus;
  // Pehle coins wallet se ghatao (bina use hue hone chahiye); ledger unique hai to do baar refund sambhav nahi
  try {
    await db.transaction(async (tx) => {
      await postTxn(tx, { userId: p.userId, type: 'PAYMENT_REFUND', amount: -coins, referenceType: 'payment', referenceId: p.id, note: `Recharge refund (source par): ${reason}` });
    });
  } catch (e) {
    if (e instanceof InsufficientBalanceError) throw new HttpError(409, 'COINS_USED', 'Is recharge ke coins kharch ho chuke hain; poora refund nahi ho sakta. Session refund use karein');
    const c = (e as { cause?: { code?: string } }).cause ?? (e as { code?: string });
    if (c?.code === '23505') throw conflict('ALREADY_REFUNDED', 'Is payment ka refund pehle ho chuka hai');
    throw e;
  }
  let refundId: string;
  try {
    ({ refundId } = await refundAtProvider(p, reason));
  } catch (err) {
    // Provider fail: coins wapas wallet mein
    await db.transaction(async (tx) => {
      await postTxn(tx, { userId: p.userId, type: 'ADJUSTMENT', amount: coins, referenceType: 'payment_refund_failed', referenceId: p.id, note: 'Refund fail, coins wapas' });
    });
    throw err;
  }
  await audit(req, 'payment.refund_to_source', 'payment', id, { reason, refundId, coins, amount: p.totalPayable });
  res.json({ ok: true, refundId, refundedRs: p.totalPayable / 100, coinsRemoved: coins });
});

// ======================= Chat retention ka status =======================

complianceRouter.get('/admin/compliance/retention', async (_req, res) => {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - s.chatRetentionDays * 86400_000);
  const [r] = await db
    .select({ due: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(consultSessions, eq(consultSessions.id, chatMessages.sessionId))
    .where(lt(chatMessages.createdAt, cutoff));
  res.json({ chatRetentionDays: s.chatRetentionDays, messagesPastRetention: r.due });
});
