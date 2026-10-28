import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { consultSessions, userBlocks, users, vendors, wallets } from '../../db/schema';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emitToRoom, emitToUser } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { visibleVendor } from '../vendors/service';
import { InsufficientBalanceError, postTxn } from '../wallet/ledger';
import { roomMembers, rooms } from './schema';

type RoomRow = typeof rooms.$inferSelect;
type MemberRow = typeof roomMembers.$inferSelect;
export type RoomType = 'AUDIO' | 'VIDEO';

function isUnique(e: unknown, constraint: string) {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const c = err?.cause ?? err;
  return c?.code === '23505' && c?.constraint === constraint;
}

const listenerCountSql = sql<number>`(select count(*)::int from room_members rm where rm.room_id = ${rooms.id} and rm.left_at is null)`;

const roomCols = {
  id: rooms.id,
  title: rooms.title,
  type: rooms.type,
  ratePerMin: rooms.ratePerMin,
  maxListeners: rooms.maxListeners,
  status: rooms.status,
  startedAt: rooms.startedAt,
  listeners: listenerCountSql,
  host: { id: vendors.id, userId: vendors.userId, displayName: vendors.displayName, avatarUrl: vendors.avatarUrl, languages: vendors.languages },
};

const shape = (r: { host: { id: string; userId: string; displayName: string; avatarUrl: string | null; languages: string[] } } & Record<string, unknown>) => ({
  ...r,
  host: { id: r.host.id, displayName: r.host.displayName, avatarUrl: r.host.avatarUrl, language: r.host.languages[0] ?? null },
});

async function broadcastCount(roomId: string) {
  const [r] = await db.select({ n: listenerCountSql }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (r) emitToRoom(roomId, 'room:update', { roomId, listeners: r.n });
}

async function myVendor(vendorUserId: string) {
  const [v] = await db.select({ id: vendors.id, status: vendors.status, isOnline: vendors.isOnline }).from(vendors).where(eq(vendors.userId, vendorUserId)).limit(1);
  if (!v) throw forbidden('Vendor profile nahi mila');
  if (v.status !== 'APPROVED') throw forbidden('Aapki profile abhi approved nahi hai');
  return v;
}

// ---------------- Host ----------------

export async function createRoom(vendorUserId: string, input: { title: string; type: RoomType; ratePerMin: number }) {
  const v = await myVendor(vendorUserId);
  const st = await getSettings();
  if (!v.isOnline) throw conflict('VENDOR_OFFLINE', 'Room shuru karne ke liye pehle Online ho jayein');
  if (input.ratePerMin !== 0 && (input.ratePerMin < st.minRatePerMinPaise || input.ratePerMin > st.maxRatePerMinPaise)) {
    throw badRequest('BAD_RATE', 'Rate allowed seema se bahar hai (ya 0 rakhein, free ke liye)');
  }
  const [busy] = await db
    .select({ id: consultSessions.id })
    .from(consultSessions)
    .where(and(eq(consultSessions.vendorId, v.id), inArray(consultSessions.status, ['ACTIVE', 'REQUESTED'])))
    .limit(1);
  if (busy) throw conflict('VENDOR_BUSY', 'Pehle chal raha session ya request khatam karein');
  try {
    const [row] = await db.insert(rooms).values({ hostVendorId: v.id, title: input.title, type: input.type, ratePerMin: input.ratePerMin, commissionPct: st.commissionPct }).returning();
    return row;
  } catch (e) {
    if (isUnique(e, 'rooms_one_live_per_host_uq')) throw conflict('ROOM_ALREADY_LIVE', 'Aapka room pehle se live hai');
    throw e;
  }
}

export async function currentRoomForHost(vendorUserId: string) {
  const v = await myVendor(vendorUserId);
  const [room] = await db.select().from(rooms).where(and(eq(rooms.hostVendorId, v.id), eq(rooms.status, 'LIVE'))).limit(1);
  if (!room) return null;
  const members = await db
    .select({ userId: roomMembers.userId, name: users.name, joinedAt: roomMembers.joinedAt })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(and(eq(roomMembers.roomId, room.id), isNull(roomMembers.leftAt)))
    .orderBy(asc(roomMembers.joinedAt));
  return { room, listeners: members.map((m) => ({ userId: m.userId, name: m.name?.split(' ')[0] ?? 'User', joinedAt: m.joinedAt })) };
}

export async function endRoom(vendorUserId: string, roomId: string, reason = 'HOST_ENDED') {
  const v = await myVendor(vendorUserId);
  return closeRoom(roomId, reason, v.id);
}

/** Sab sunne walon ka hisaab karke room band */
export async function closeRoom(roomId: string, reason: string, onlyHostVendorId?: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room || (onlyHostVendorId && room.hostVendorId !== onlyHostVendorId)) throw notFound('Room');
  if (room.status !== 'LIVE') return room;
  const open = await db.select({ id: roomMembers.id }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.leftAt)));
  for (const m of open) {
    try {
      await finalizeMember(m.id, 'ROOM_ENDED');
    } catch (err) {
      logger.error({ err, memberId: m.id }, 'room member finalize failed');
    }
  }
  const [done] = await db.update(rooms).set({ status: 'ENDED', endedAt: new Date() }).where(and(eq(rooms.id, roomId), eq(rooms.status, 'LIVE'))).returning();
  emitToRoom(roomId, 'room:ended', { roomId, reason });
  return done ?? room;
}

export async function kick(vendorUserId: string, roomId: string, userId: string) {
  const v = await myVendor(vendorUserId);
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.hostVendorId, v.id))).limit(1);
  if (!room) throw notFound('Room');
  const [m] = await db.select({ id: roomMembers.id }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), isNull(roomMembers.leftAt))).limit(1);
  if (!m) throw notFound('Listener');
  await finalizeMember(m.id, 'KICKED');
  emitToUser(userId, 'room:kicked', { roomId, reason: 'KICKED' });
  await broadcastCount(roomId);
}

// ---------------- User ----------------

export async function listLiveRooms(userId: string) {
  const rows = await db
    .select(roomCols)
    .from(rooms)
    .innerJoin(vendors, eq(vendors.id, rooms.hostVendorId))
    .where(
      and(
        eq(rooms.status, 'LIVE'),
        visibleVendor,
        sql`not exists(select 1 from user_blocks ub where ub.user_id = ${userId} and ub.vendor_id = ${vendors.id})`,
      ),
    )
    .orderBy(desc(listenerCountSql), desc(rooms.startedAt))
    .limit(40);
  return rows.map(shape);
}

export async function roomDetail(userId: string, roomId: string) {
  const [r] = await db.select(roomCols).from(rooms).innerJoin(vendors, eq(vendors.id, rooms.hostVendorId)).where(eq(rooms.id, roomId)).limit(1);
  if (!r) throw notFound('Room');
  const [m] = await db.select().from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), isNull(roomMembers.leftAt))).limit(1);
  return { ...shape(r), isMember: !!m, endsAt: m?.maxSeconds != null ? new Date(m.joinedAt.getTime() + m.maxSeconds * 1000) : null };
}

export async function joinRoom(userId: string, roomId: string) {
  const st = await getSettings();
  const [r] = await db.select({ room: rooms, host: vendors }).from(rooms).innerJoin(vendors, eq(vendors.id, rooms.hostVendorId)).where(eq(rooms.id, roomId)).limit(1);
  if (!r || r.room.status !== 'LIVE') throw conflict('ROOM_ENDED', 'Yeh room ab live nahi hai');
  const { room, host } = r;
  if (host.userId === userId) throw badRequest('SELF_ROOM', 'Apne room mein listener ki tarah nahi aa sakte');

  const [blocked] = await db.select({ u: userBlocks.userId }).from(userBlocks).where(and(eq(userBlocks.userId, userId), eq(userBlocks.vendorId, host.id))).limit(1);
  if (blocked) throw forbidden('Aapne inhe block kiya hai');

  const [existing] = await db.select().from(roomMembers).where(and(eq(roomMembers.userId, userId), isNull(roomMembers.leftAt))).limit(1);
  if (existing) {
    if (existing.roomId === roomId) return memberOut(room, existing);
    throw conflict('ALREADY_IN_ROOM', 'Aap pehle se kisi aur room mein hain');
  }
  const [kicked] = await db.select({ id: roomMembers.id }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), eq(roomMembers.leaveReason, 'KICKED'))).limit(1);
  if (kicked) throw forbidden('Host ne aapko is room se hataya hai');

  const [open] = await db.select({ id: consultSessions.id }).from(consultSessions).where(and(eq(consultSessions.userId, userId), inArray(consultSessions.status, ['REQUESTED', 'ACTIVE']))).limit(1);
  if (open) throw conflict('SESSION_ALREADY_OPEN', 'Pehle chal raha chat/call khatam karein');

  const [cnt] = await db.select({ n: sql<number>`count(*)::int` }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.leftAt)));
  if ((cnt?.n ?? 0) >= room.maxListeners) throw conflict('ROOM_FULL', 'Room full hai');

  let maxSeconds: number | null = null;
  if (room.ratePerMin > 0) {
    const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const balance = w?.balance ?? 0;
    const required = room.ratePerMin * Math.min(st.minSessionMinutes, 2);
    if (balance < required) {
      throw new HttpError(402, 'INSUFFICIENT_BALANCE', 'Room mein aane ke liye balance kam hai', { required, balance, shortBy: required - balance });
    }
    maxSeconds = Math.floor(balance / room.ratePerMin) * 60;
  }
  let m: MemberRow;
  try {
    [m] = await db.insert(roomMembers).values({ roomId, userId, maxSeconds }).returning();
  } catch (e) {
    if (isUnique(e, 'room_members_one_open_per_user_uq')) throw conflict('ALREADY_IN_ROOM', 'Aap pehle se kisi room mein hain');
    throw e;
  }
  const [c2] = await db.select({ n: sql<number>`count(*)::int` }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.leftAt)));
  if ((c2?.n ?? 0) > room.peakListeners) await db.update(rooms).set({ peakListeners: c2!.n }).where(eq(rooms.id, roomId));
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  emitToRoom(roomId, 'room:join', { roomId, userId, name: u?.name?.split(' ')[0] ?? 'User' });
  emitToUser(host.userId, 'room:join', { roomId, userId, name: u?.name?.split(' ')[0] ?? 'User' });
  await broadcastCount(roomId);
  return memberOut(room, m);
}

function memberOut(room: RoomRow, m: MemberRow) {
  return {
    roomId: room.id,
    type: room.type,
    ratePerMin: room.ratePerMin,
    joinedAt: m.joinedAt,
    maxSeconds: m.maxSeconds,
    endsAt: m.maxSeconds != null ? new Date(m.joinedAt.getTime() + m.maxSeconds * 1000) : null,
  };
}

export async function leaveRoom(userId: string, roomId: string) {
  const [m] = await db.select({ id: roomMembers.id }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), isNull(roomMembers.leftAt))).limit(1);
  if (!m) return { ok: true, chargedAmount: 0 };
  const out = await finalizeMember(m.id, 'USER_LEFT');
  await broadcastCount(roomId);
  return { ok: true, chargedAmount: out?.chargedAmount ?? 0, billedSeconds: out?.billedSeconds ?? 0 };
}

/** Ek sunne wale ka hisaab: user ke wallet se katta, commission ke baad host ko. Ek hi baar chalta hai. */
export async function finalizeMember(memberId: string, reason: string, now = new Date()) {
  return db.transaction(async (tx: Tx) => {
    const [cur] = await tx.select().from(roomMembers).where(eq(roomMembers.id, memberId)).for('update').limit(1);
    if (!cur || cur.leftAt) return cur ?? null;
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, cur.roomId)).limit(1);
    const elapsed = Math.max(0, Math.floor((now.getTime() - cur.joinedAt.getTime()) / 1000));
    const billedSeconds = cur.maxSeconds != null ? Math.min(elapsed, cur.maxSeconds) : elapsed;
    let charge = 0;
    let earning = 0;
    if (room && room.ratePerMin > 0 && billedSeconds > 0) {
      charge = Math.ceil(billedSeconds / 60) * room.ratePerMin;
      const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, cur.userId)).limit(1);
      charge = Math.min(charge, w?.balance ?? 0);
      if (charge > 0) {
        try {
          await postTxn(tx, { userId: cur.userId, type: 'SESSION_CHARGE', amount: -charge, referenceType: 'room', referenceId: cur.id, note: `Room (${Math.ceil(billedSeconds / 60)} min)` });
        } catch (e) {
          if (!(e instanceof InsufficientBalanceError)) throw e;
          charge = 0;
        }
      }
      earning = charge - Math.round((charge * room.commissionPct) / 100);
      if (earning > 0) {
        const [h] = await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, room.hostVendorId)).limit(1);
        if (h) await postTxn(tx, { userId: h.userId, type: 'SESSION_EARNING', amount: earning, referenceType: 'room', referenceId: cur.id, note: 'Room kamai' });
        await tx.update(rooms).set({ totalEarned: sql`${rooms.totalEarned} + ${earning}` }).where(eq(rooms.id, room.id));
      }
    }
    const [done] = await tx
      .update(roomMembers)
      .set({ leftAt: now, leaveReason: reason, billedSeconds, chargedAmount: charge, hostEarning: earning })
      .where(eq(roomMembers.id, cur.id))
      .returning();
    return done;
  });
}

/** Har kuch second: balance khatam wale sunne walon ko bahar, host offline wale room band */
export async function sweepRooms(now = new Date()) {
  const expired = await db
    .select({ id: roomMembers.id, userId: roomMembers.userId, roomId: roomMembers.roomId })
    .from(roomMembers)
    .where(and(isNull(roomMembers.leftAt), sql`${roomMembers.maxSeconds} is not null`, sql`${roomMembers.joinedAt} + make_interval(secs => ${roomMembers.maxSeconds}) <= ${now.toISOString()}::timestamptz`));
  for (const m of expired) {
    try {
      await finalizeMember(m.id, 'BALANCE_EXHAUSTED', now);
      emitToUser(m.userId, 'room:kicked', { roomId: m.roomId, reason: 'BALANCE_EXHAUSTED' });
      await broadcastCount(m.roomId);
    } catch (err) {
      logger.error({ err, memberId: m.id }, 'room auto-leave failed');
    }
  }
  const dead = await db
    .select({ id: rooms.id })
    .from(rooms)
    .innerJoin(vendors, eq(vendors.id, rooms.hostVendorId))
    .where(and(eq(rooms.status, 'LIVE'), eq(vendors.isOnline, false)));
  for (const r of dead) await closeRoom(r.id, 'HOST_OFFLINE').catch((err) => logger.error({ err }, 'room auto-close failed'));
  return { kicked: expired.length, closed: dead.length };
}

/** Room mein bhejne ke liye: kaun-kaun is room ka hissa hai (socket join ke liye) */
export async function isRoomParticipant(actorId: string, roomId: string) {
  const [r] = await db.select({ hostUserId: vendors.userId, status: rooms.status }).from(rooms).innerJoin(vendors, eq(vendors.id, rooms.hostVendorId)).where(eq(rooms.id, roomId)).limit(1);
  if (!r) return null;
  if (r.hostUserId === actorId) return { host: true, live: r.status === 'LIVE' };
  const [m] = await db.select({ id: roomMembers.id }).from(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, actorId), isNull(roomMembers.leftAt))).limit(1);
  return m ? { host: false, live: r.status === 'LIVE' } : null;
}

