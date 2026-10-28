import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import agora from 'agora-token';
import { z } from 'zod';
import { db } from '../../db/client';
import { users, vendors, wallets } from '../../db/schema';
import { env } from '../../config/env';
import { numericUid } from '../../lib/crypto';
import { conflict, forbidden, HttpError, notFound, unavailable } from '../../lib/errors';
import { emitToRoom, emitToUser } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { body, idParam, params } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { giftSends, gifts } from '../gifts/schema';
import { postTxn } from '../wallet/ledger';
import { roomMembers, rooms } from './schema';
import * as svc from './service';

const { RtcRole, RtcTokenBuilder } = agora;
export const roomsRouter = Router();

const createBody = z.object({
  title: z.string().trim().min(3).max(60),
  type: z.enum(['AUDIO', 'VIDEO']),
});

// ---- Host (vendor app) ----
roomsRouter.post('/vendor/rooms', requireRole('VENDOR'), async (req, res) => {
  res.status(201).json(await svc.createRoom(authId(req), body(req, createBody)));
});
roomsRouter.get('/vendor/rooms/current', requireRole('VENDOR'), async (req, res) => {
  res.json((await svc.currentRoomForHost(authId(req))) ?? { room: null, listeners: [] });
});
roomsRouter.post('/vendor/rooms/:id/end', requireRole('VENDOR'), async (req, res) => {
  const { id } = params(req, idParam);
  await svc.endRoom(authId(req), id);
  res.json({ ok: true });
});
roomsRouter.post('/vendor/rooms/:id/kick', requireRole('VENDOR'), async (req, res) => {
  const { id } = params(req, idParam);
  const { userId } = body(req, z.object({ userId: z.string().uuid() }));
  await svc.kick(authId(req), id, userId);
  res.json({ ok: true });
});

// ---- User ----
roomsRouter.get('/rooms', requireRole('USER'), async (req, res) => {
  res.json({ items: await svc.listLiveRooms(authId(req)) });
});
roomsRouter.get('/rooms/:id', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.roomDetail(authId(req), id));
});
roomsRouter.post('/rooms/:id/join', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  res.status(201).json(await svc.joinRoom(authId(req), id));
});
roomsRouter.post('/rooms/:id/leave', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  res.json(await svc.leaveRoom(authId(req), id));
});

/** Agora token: host = bolne wala (publisher), sunne wale = sirf audience (subscriber) */
roomsRouter.post('/rooms/:id/rtc-token', async (req, res) => {
  const actorId = authId(req);
  const { id } = params(req, idParam);
  const p = await svc.isRoomParticipant(actorId, id);
  if (!p) throw forbidden('Aap is room mein nahi hain');
  if (!p.live) throw conflict('ROOM_ENDED', 'Room khatam ho chuka hai');
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) throw unavailable('CALLS_NOT_CONFIGURED', 'Calling service set nahi hai');
  const ttl = 4 * 3600;
  const uid = numericUid(actorId);
  const channel = `room-${id}`;
  const token = RtcTokenBuilder.buildTokenWithUid(env.AGORA_APP_ID, env.AGORA_APP_CERTIFICATE, channel, uid, p.host ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER, ttl, ttl);
  res.json({ appId: env.AGORA_APP_ID, channel, uid, token, expiresInSec: ttl, role: p.host ? 'HOST' : 'AUDIENCE' });
});

/** Room mein gift: host ko, commission ke baad */
roomsRouter.post('/rooms/:id/gifts', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  const { giftId } = body(req, z.object({ giftId: z.string().uuid() }));
  const userId = authId(req);
  const pct = (await getSettings()).giftCommissionPct;

  const out = await db.transaction(async (tx) => {
    const [m] = await tx.select().from(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId), isNull(roomMembers.leftAt))).for('update').limit(1);
    if (!m) throw new HttpError(409, 'INVALID_STATE', 'Gift sirf room ke andar se bhej sakte hain');
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, id)).limit(1);
    if (!room || room.status !== 'LIVE') throw new HttpError(409, 'ROOM_ENDED', 'Room khatam ho chuka hai');
    const [g] = await tx.select().from(gifts).where(and(eq(gifts.id, giftId), eq(gifts.isActive, true))).limit(1);
    if (!g) throw notFound('Gift');

    const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const balance = w?.balance ?? 0;
    const usedMin = Math.ceil((Date.now() - m.joinedAt.getTime()) / 60000);
    const reserve = room.ratePerMin > 0 ? room.ratePerMin * (usedMin + 1) : 0;
    if (balance - g.price < reserve) {
      throw new HttpError(402, 'INSUFFICIENT_BALANCE', 'Gift ke baad room ke liye balance kam padega. Pehle recharge karein', { balance, price: g.price, needed: g.price + reserve });
    }
    const fee = Math.round((g.price * pct) / 100);
    const earning = g.price - fee;
    const [send] = await tx
      .insert(giftSends)
      .values({ sessionId: null, roomId: id, userId, vendorId: room.hostVendorId, giftId: g.id, giftName: g.name, price: g.price, commissionPct: pct, vendorEarning: earning })
      .returning();
    await postTxn(tx, { userId, type: 'SESSION_CHARGE', amount: -g.price, referenceType: 'gift', referenceId: send.id, note: `Room gift: ${g.name}` });
    const [h] = await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, room.hostVendorId)).limit(1);
    if (earning > 0 && h) await postTxn(tx, { userId: h.userId, type: 'SESSION_EARNING', amount: earning, referenceType: 'gift', referenceId: send.id, note: `Room gift mila: ${g.name}` });
    let newMax = m.maxSeconds;
    if (room.ratePerMin > 0) {
      const affordable = Math.floor((balance - g.price) / room.ratePerMin) * 60;
      newMax = Math.min(m.maxSeconds ?? affordable, affordable);
      if (newMax !== m.maxSeconds) await tx.update(roomMembers).set({ maxSeconds: newMax }).where(eq(roomMembers.id, m.id));
    }
    await tx.update(rooms).set({ totalEarned: sql`${rooms.totalEarned} + ${earning}` }).where(eq(rooms.id, id));
    return { g, sendId: send.id, hostUserId: h?.userId ?? null, joinedAt: m.joinedAt, newMax };
  });

  const [u] = await db.select({ n: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const payload = {
    id: out.sendId,
    roomId: id,
    giftId: out.g.id,
    name: out.g.name,
    icon: out.g.icon,
    price: out.g.price,
    svgaUrl: out.g.svgaVersion > 0 ? `/gifts/${out.g.id}/svga?v=${out.g.svgaVersion}` : null,
    mediaType: out.g.svgaVersion > 0 ? (out.g.mediaType ?? 'svga') : null,
    thumbUrl: out.g.thumbData ? `/gifts/${out.g.id}/thumb?v=${out.g.svgaVersion}` : null,
    from: u?.n?.split(' ')[0] || 'Ek user',
    fromId: userId,
  };
  emitToRoom(id, 'gift', payload);
  if (out.hostUserId) emitToUser(out.hostUserId, 'gift', payload);
  emitToUser(userId, 'room:limit', { roomId: id, endsAt: out.newMax != null ? new Date(out.joinedAt.getTime() + out.newMax * 1000) : null });
  res.status(201).json({ ok: true, gift: payload, endsAt: out.newMax != null ? new Date(out.joinedAt.getTime() + out.newMax * 1000) : null });
});
