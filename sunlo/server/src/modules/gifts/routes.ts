import express, { Router } from 'express';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { consultSessions, users, vendors, wallets } from '../../db/schema';
import { badRequest, HttpError, notFound } from '../../lib/errors';
import { emitToSession, emitToUser } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { body, idParam, params } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { audit } from '../admin/audit';
import { postTxn } from '../wallet/ledger';
import { giftSends, gifts } from './schema';

const MAX_SVGA_BYTES = 6 * 1024 * 1024;
const MAX_THUMB_BYTES = 400 * 1024;

/** SVGA = zlib (0x78) ya ZIP ('PK') container. Aur kuch ho to reject. */
function looksLikeSvga(buf: Buffer) {
  if (buf.length < 16) return false;
  if (buf[0] === 0x78) return true;
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}
/** WebM (transparent video) = EBML header 1A 45 DF A3 */
const looksLikeWebm = (buf: Buffer) => buf.length > 16 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
const looksLikePng = (buf: Buffer) => buf.length > 16 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';

const publicCols = {
  id: gifts.id,
  name: gifts.name,
  icon: gifts.icon,
  price: gifts.price,
  svgaVersion: gifts.svgaVersion,
  mediaType: gifts.mediaType,
  hasThumb: sql<boolean>`${gifts.thumbData} is not null`,
  isActive: gifts.isActive,
  sortOrder: gifts.sortOrder,
};
type GiftRow = { id: string; name: string; icon: string; price: number; svgaVersion: number; mediaType: string | null; hasThumb: boolean; isActive: boolean; sortOrder: number };
const shape = (g: GiftRow) => ({
  id: g.id,
  name: g.name,
  icon: g.icon,
  price: g.price,
  svgaUrl: g.svgaVersion > 0 ? `/gifts/${g.id}/svga?v=${g.svgaVersion}` : null, // animation file (svga ya webm), API_URL ke saath jodein
  mediaType: g.svgaVersion > 0 ? (g.mediaType ?? 'svga') : null,
  thumbUrl: g.hasThumb ? `/gifts/${g.id}/thumb?v=${g.svgaVersion}` : null,
});

// ---------- Public: animation file (login ke bina, taaki player seedha le sake) ----------
export const giftsPublic = Router();
giftsPublic.get('/gifts/:id/svga', async (req, res) => {
  const { id } = params(req, idParam);
  const [g] = await db.select({ d: gifts.svgaData, t: gifts.mediaType }).from(gifts).where(eq(gifts.id, id)).limit(1);
  if (!g?.d) throw notFound('Animation');
  res.setHeader('Content-Type', g.t === 'webm' ? 'video/webm' : 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(g.d);
});
giftsPublic.get('/gifts/:id/thumb', async (req, res) => {
  const { id } = params(req, idParam);
  const [g] = await db.select({ d: gifts.thumbData }).from(gifts).where(eq(gifts.id, id)).limit(1);
  if (!g?.d) throw notFound('Preview');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(g.d);
});

// ---------- Private (login zaroori) ----------
export const giftsPrivate = Router();

giftsPrivate.get('/gifts', async (_req, res) => {
  const rows = await db.select(publicCols).from(gifts).where(eq(gifts.isActive, true)).orderBy(asc(gifts.sortOrder), asc(gifts.price));
  res.json({ items: rows.map(shape) });
});

giftsPrivate.post('/sessions/:id/gifts', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  const { giftId } = body(req, z.object({ giftId: z.string().uuid() }));
  const userId = authId(req);
  const st = await getSettings();
  const pct = st.giftCommissionPct;

  const out = await db.transaction(async (tx) => {
    const [sess] = await tx
      .select()
      .from(consultSessions)
      .where(and(eq(consultSessions.id, id), eq(consultSessions.userId, userId)))
      .for('update')
      .limit(1);
    if (!sess) throw notFound('Session');
    if (sess.status !== 'ACTIVE' || !sess.acceptedAt) throw new HttpError(409, 'INVALID_STATE', 'Gift sirf chalte hue session mein bhej sakte hain');
    const [g] = await tx.select(publicCols).from(gifts).where(and(eq(gifts.id, giftId), eq(gifts.isActive, true))).limit(1);
    if (!g) throw notFound('Gift');

    // Gift ke baad bhi chal chuke samay + agle 1 minute ka balance bacha rehna chahiye (vendor ki kamai na ghate)
    const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const balance = w?.balance ?? 0;
    const usedMin = Math.ceil((Date.now() - sess.acceptedAt.getTime()) / 60000);
    const reserve = sess.ratePerMin * (usedMin + 1);
    if (balance - g.price < reserve) {
      throw new HttpError(402, 'INSUFFICIENT_BALANCE', 'Gift ke baad call ke liye balance kam padega. Pehle recharge karein', {
        balance,
        price: g.price,
        needed: g.price + reserve,
      });
    }

    const fee = Math.round((g.price * pct) / 100);
    const earning = g.price - fee;
    const [send] = await tx
      .insert(giftSends)
      .values({ sessionId: sess.id, userId, vendorId: sess.vendorId, giftId: g.id, giftName: g.name, price: g.price, commissionPct: pct, vendorEarning: earning })
      .returning();
    await postTxn(tx, { userId, type: 'SESSION_CHARGE', amount: -g.price, referenceType: 'gift', referenceId: send.id, note: `Gift: ${g.name}` });
    const [v] = await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, sess.vendorId)).limit(1);
    if (earning > 0 && v) {
      await postTxn(tx, { userId: v.userId, type: 'SESSION_EARNING', amount: earning, referenceType: 'gift', referenceId: send.id, note: `Gift mila: ${g.name}` });
    }
    // Balance kam hua hai, isliye session ki seema usi hisaab se (kabhi badhti nahi)
    const affordableSec = Math.floor((balance - g.price) / sess.ratePerMin) * 60;
    const newMax = Math.min(sess.maxSeconds ?? affordableSec, affordableSec);
    if (newMax !== sess.maxSeconds) await tx.update(consultSessions).set({ maxSeconds: newMax }).where(eq(consultSessions.id, sess.id));
    return { send, gift: g, vendorUserId: v?.userId ?? null, acceptedAt: sess.acceptedAt, maxSeconds: newMax, earning };
  });

  const [u] = await db.select({ n: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const fromUser = u?.n || 'Ek user';
  const sh = shape(out.gift);
  const payload = { sessionId: id, giftId: out.gift.id, name: out.gift.name, icon: out.gift.icon, price: out.gift.price, svgaUrl: sh.svgaUrl, mediaType: sh.mediaType, thumbUrl: sh.thumbUrl, from: fromUser };
  emitToSession(id, 'gift', payload);
  emitToUser(userId, 'gift', payload); // room join na bhi ho to dikhe
  if (out.vendorUserId) emitToUser(out.vendorUserId, 'gift', payload);
  emitToSession(id, 'session:update', { id, maxSeconds: out.maxSeconds, endsAt: new Date(out.acceptedAt.getTime() + out.maxSeconds * 1000) });
  res.status(201).json({ ok: true, gift: payload });
});

// ---------- Admin ----------
giftsPrivate.use('/admin/gifts', requireRole('ADMIN'));
const giftBody = z.object({
  name: z.string().trim().min(2).max(30),
  icon: z.string().trim().min(1).max(8),
  price: z.number().int().min(100).max(10_000_000),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

giftsPrivate.get('/admin/gifts', async (_req, res) => {
  const rows = await db.select(publicCols).from(gifts).orderBy(asc(gifts.sortOrder), asc(gifts.price));
  const since = new Date(Date.now() - 30 * 86400_000);
  const [t] = await db
    .select({ n: sql<number>`count(*)::int`, gross: sql<number>`coalesce(sum(${giftSends.price}),0)::int`, vendor: sql<number>`coalesce(sum(${giftSends.vendorEarning}),0)::int` })
    .from(giftSends)
    .where(gte(giftSends.createdAt, since));
  const recent = await db
    .select({
      id: giftSends.id,
      sessionId: giftSends.sessionId,
      giftName: giftSends.giftName,
      price: giftSends.price,
      commissionPct: giftSends.commissionPct,
      vendorEarning: giftSends.vendorEarning,
      createdAt: giftSends.createdAt,
      userName: users.name,
      vendorName: vendors.displayName,
    })
    .from(giftSends)
    .innerJoin(users, eq(users.id, giftSends.userId))
    .innerJoin(vendors, eq(vendors.id, giftSends.vendorId))
    .orderBy(desc(giftSends.createdAt))
    .limit(40);
  res.json({
    items: rows.map((g) => ({ ...g, hasSvga: g.svgaVersion > 0 })),
    recent,
    last30: { count: t?.n ?? 0, gross: t?.gross ?? 0, commission: (t?.gross ?? 0) - (t?.vendor ?? 0) },
    commissionPct: (await getSettings()).giftCommissionPct,
  });
});

giftsPrivate.post('/admin/gifts', async (req, res) => {
  const data = body(req, giftBody);
  const [g] = await db.insert(gifts).values(data).returning({ id: gifts.id });
  await audit(req, 'gift.create', 'gift', g.id, data);
  res.status(201).json(g);
});

giftsPrivate.patch('/admin/gifts/:id', async (req, res) => {
  const { id } = params(req, idParam);
  const data = body(req, giftBody.partial());
  const [g] = await db.update(gifts).set(data).where(eq(gifts.id, id)).returning({ id: gifts.id });
  if (!g) throw notFound('Gift');
  await audit(req, 'gift.update', 'gift', id, data);
  res.json(g);
});

// Bada body: app.ts ka chhota JSON limit is path par skip hota hai
giftsPrivate.post('/admin/gifts/:id/svga', express.json({ limit: '8mb' }), async (req, res) => {
  const { id } = params(req, idParam);
  const { dataBase64 } = body(req, z.object({ dataBase64: z.string().min(16).max(Math.ceil((MAX_SVGA_BYTES * 4) / 3) + 16) }));
  const b64 = dataBase64.replace(/^data:[^,]*;base64,/, '');
  if (!/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(b64)) throw badRequest('BAD_FILE', 'File sahi nahi hai');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_SVGA_BYTES) throw badRequest('FILE_TOO_LARGE', 'File 6 MB se badi hai');
  const kind = looksLikeWebm(buf) ? 'webm' : looksLikeSvga(buf) ? 'svga' : null;
  if (!kind) throw badRequest('BAD_FILE', 'Yeh SVGA ya WebM file nahi lag rahi');
  const [g] = await db
    .update(gifts)
    .set({ svgaData: buf, mediaType: kind, svgaVersion: sql`${gifts.svgaVersion} + 1` })
    .where(eq(gifts.id, id))
    .returning({ id: gifts.id });
  if (!g) throw notFound('Gift');
  await audit(req, 'gift.svga', 'gift', id, { bytes: buf.length });
  res.json({ ok: true });
});

giftsPrivate.post('/admin/gifts/:id/thumb', express.json({ limit: '1mb' }), async (req, res) => {
  const { id } = params(req, idParam);
  const { dataBase64 } = body(req, z.object({ dataBase64: z.string().min(16).max(Math.ceil((MAX_THUMB_BYTES * 4) / 3) + 16) }));
  const buf = Buffer.from(dataBase64.replace(/^data:[^,]*;base64,/, ''), 'base64');
  if (buf.length > MAX_THUMB_BYTES || !looksLikePng(buf)) throw badRequest('BAD_FILE', 'Preview PNG honi chahiye (max 400 KB)');
  const [g] = await db.update(gifts).set({ thumbData: buf }).where(eq(gifts.id, id)).returning({ id: gifts.id });
  if (!g) throw notFound('Gift');
  await audit(req, 'gift.thumb', 'gift', id, { bytes: buf.length });
  res.json({ ok: true });
});

giftsPrivate.delete('/admin/gifts/:id/svga', async (req, res) => {
  const { id } = params(req, idParam);
  await db.update(gifts).set({ svgaData: null, svgaVersion: 0, mediaType: null }).where(eq(gifts.id, id));
  await audit(req, 'gift.svga.remove', 'gift', id);
  res.json({ ok: true });
});

// ---------- Session ke gifts (admin) ----------
giftsPrivate.get('/admin/sessions/:id/gifts', requireRole('ADMIN'), async (req, res) => {
  const { id } = params(req, idParam);
  const rows = await db
    .select({ id: giftSends.id, giftName: giftSends.giftName, price: giftSends.price, commissionPct: giftSends.commissionPct, vendorEarning: giftSends.vendorEarning, createdAt: giftSends.createdAt })
    .from(giftSends)
    .where(eq(giftSends.sessionId, id))
    .orderBy(asc(giftSends.createdAt));
  const gross = rows.reduce((a, r) => a + r.price, 0);
  const vendor = rows.reduce((a, r) => a + r.vendorEarning, 0);
  res.json({ items: rows, total: { count: rows.length, gross, vendor, commission: gross - vendor } });
});

// ---------- Vendor: mile hue gifts ----------
giftsPrivate.get('/vendor/gifts', requireRole('VENDOR'), async (req, res) => {
  const [v] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, authId(req))).limit(1);
  if (!v) throw notFound('Vendor');
  const rows = await db
    .select({
      id: giftSends.id,
      sessionId: giftSends.sessionId,
      giftId: giftSends.giftId,
      giftName: giftSends.giftName,
      price: giftSends.price,
      vendorEarning: giftSends.vendorEarning,
      createdAt: giftSends.createdAt,
      userName: users.name,
      version: gifts.svgaVersion,
      hasThumb: sql<boolean>`${gifts.thumbData} is not null`,
    })
    .from(giftSends)
    .innerJoin(users, eq(users.id, giftSends.userId))
    .leftJoin(gifts, eq(gifts.id, giftSends.giftId))
    .where(eq(giftSends.vendorId, v.id))
    .orderBy(desc(giftSends.createdAt))
    .limit(100);
  const [t] = await db
    .select({ n: sql<number>`count(*)::int`, coins: sql<number>`coalesce(sum(${giftSends.price}),0)::int`, earning: sql<number>`coalesce(sum(${giftSends.vendorEarning}),0)::int` })
    .from(giftSends)
    .where(eq(giftSends.vendorId, v.id));
  res.json({
    total: { count: t?.n ?? 0, price: t?.coins ?? 0, earning: t?.earning ?? 0 },
    items: rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      giftName: r.giftName,
      price: r.price,
      vendorEarning: r.vendorEarning,
      createdAt: r.createdAt,
      userName: r.userName,
      thumbUrl: r.hasThumb ? `/gifts/${r.giftId}/thumb?v=${r.version ?? 0}` : null,
    })),
  });
});
