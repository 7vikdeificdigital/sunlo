import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { vendors, consultSessions, notifications, userBlocks, users, wallets } from '../../db/schema';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emitToSession, emitToUser } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { visibleVendor } from '../vendors/service';
import { InsufficientBalanceError, postTxn } from '../wallet/ledger';

export type SessionType = 'CHAT' | 'AUDIO' | 'VIDEO';
type SessionRow = typeof consultSessions.$inferSelect;

function isUniqueViolation(e: unknown, constraint: string) {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const c = err?.cause ?? err;
  return c?.code === '23505' && c?.constraint === constraint;
}

/** Billing ka hisaab: sirf poore minute jitna balance ho utna hi samay milta hai */
export function computeBilling(s: { ratePerMin: number; commissionPct: number; maxSeconds: number }, elapsedSec: number) {
  const billedSeconds = Math.max(0, Math.min(Math.floor(elapsedSec), s.maxSeconds));
  const minutes = Math.ceil(billedSeconds / 60);
  const charge = minutes * s.ratePerMin;
  const platformFee = Math.round((charge * s.commissionPct) / 100);
  return { billedSeconds, minutes, charge, vendorEarning: charge - platformFee };
}

function publicSession(s: SessionRow) {
  return {
    id: s.id,
    type: s.type,
    status: s.status,
    userId: s.userId,
    vendorId: s.vendorId,
    ratePerMin: s.ratePerMin,
    maxSeconds: s.maxSeconds,
    requestedAt: s.requestedAt,
    acceptedAt: s.acceptedAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
    billedSeconds: s.billedSeconds,
    chargedAmount: s.chargedAmount,
    refundedAmount: s.refundedAmount,
    // Session khatam hone ka server ka pakka samay (app iske hisaab se timer dikhaye)
    endsAt: s.acceptedAt && s.maxSeconds != null ? new Date(s.acceptedAt.getTime() + s.maxSeconds * 1000) : null,
  };
}

async function broadcast(s: SessionRow, vendorUserId?: string) {
  const payload = publicSession(s);
  emitToUser(s.userId, 'session:update', payload);
  const au = vendorUserId ?? (await vendorUserIdOf(s.vendorId));
  if (au) emitToUser(au, 'session:update', payload);
  emitToSession(s.id, 'session:update', payload);
}

async function vendorUserIdOf(vendorId: string) {
  const [a] = await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return a?.userId ?? null;
}

// ---------------- User side ----------------

export async function requestSession(
  userId: string,
  input: { vendorId: string; type: SessionType; intake?: Record<string, unknown> },
) {
  const s = await getSettings();
  const [a] = await db.select().from(vendors).where(and(eq(vendors.id, input.vendorId), visibleVendor)).limit(1);
  if (!a) throw notFound('Profile');
  if (a.userId === userId) throw badRequest('SELF_SESSION', 'Apne aap se session nahi ho sakta');
  const enabled = input.type === 'CHAT' ? a.chatEnabled : input.type === 'AUDIO' ? a.callEnabled : a.videoEnabled;
  if (!enabled) throw badRequest('SERVICE_DISABLED', 'Yeh abhi yeh seva nahi de rahe');
  if (!a.isOnline) throw conflict('VENDOR_OFFLINE', 'Yeh abhi online nahi hain');

  const [blocked] = await db
    .select({ u: userBlocks.userId })
    .from(userBlocks)
    .where(and(eq(userBlocks.userId, userId), eq(userBlocks.vendorId, a.id)))
    .limit(1);
  if (blocked) throw forbidden('Aapne inhe block kiya hai');

  const [busy] = await db
    .select({ id: consultSessions.id })
    .from(consultSessions)
    .where(and(eq(consultSessions.vendorId, a.id), eq(consultSessions.status, 'ACTIVE')))
    .limit(1);
  if (busy) throw conflict('VENDOR_BUSY', 'Yeh abhi doosre session mein hain');
  const live = await db.execute(sql`select 1 from rooms where host_vendor_id = ${a.id} and status = 'LIVE' limit 1`);
  if (live.rows.length) throw conflict('VENDOR_BUSY', 'Yeh abhi live room mein hain');

  const rate = input.type === 'CHAT' ? a.chatRatePerMin : input.type === 'AUDIO' ? a.callRatePerMin : a.videoRatePerMin;
  const required = rate * s.minSessionMinutes;
  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const balance = w?.balance ?? 0;
  if (balance < required) {
    throw new HttpError(402, 'INSUFFICIENT_BALANCE', `Kam se kam ${s.minSessionMinutes} minute ka balance chahiye`, {
      required,
      balance,
      shortBy: required - balance,
    });
  }

  let row: SessionRow;
  try {
    [row] = await db
      .insert(consultSessions)
      .values({
        type: input.type,
        userId,
        vendorId: a.id,
        ratePerMin: rate,
        commissionPct: s.commissionPct,
        intake: input.intake ?? null,
      })
      .returning();
  } catch (e) {
    if (isUniqueViolation(e, 'cs_one_open_per_user_uq')) {
      throw conflict('SESSION_ALREADY_OPEN', 'Aapka ek session pehle se chal raha hai ya pending hai');
    }
    throw e;
  }

  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  emitToUser(a.userId, 'session:incoming', { ...publicSession(row), userName: u?.name ?? 'User', intake: row.intake });
  await db.insert(notifications).values({
    userId: a.userId,
    title: input.type === 'CHAT' ? 'Naya chat request' : 'Naya call request',
    body: `${u?.name ?? 'Ek user'} aapse baat karna chahte hain`,
    data: { type: 'session', sessionId: row.id },
  });
  return publicSession(row);
}

export async function cancelByUser(userId: string, sessionId: string) {
  const [row] = await db
    .update(consultSessions)
    .set({ status: 'CANCELLED', endedAt: new Date(), endReason: 'USER_CANCELLED' })
    .where(and(eq(consultSessions.id, sessionId), eq(consultSessions.userId, userId), eq(consultSessions.status, 'REQUESTED')))
    .returning();
  if (!row) throw conflict('INVALID_STATE', 'Yeh request ab cancel nahi ho sakti');
  await broadcast(row);
  return publicSession(row);
}

// ---------------- Vendor side ----------------

async function myVendorId(vendorUserId: string) {
  const [a] = await db.select({ id: vendors.id, status: vendors.status }).from(vendors).where(eq(vendors.userId, vendorUserId)).limit(1);
  if (!a) throw forbidden('Vendor profile nahi mila');
  if (a.status !== 'APPROVED') throw forbidden('Aapki profile abhi approved nahi hai');
  return a.id;
}

export async function acceptByVendor(vendorUserId: string, sessionId: string) {
  const vendorId = await myVendorId(vendorUserId);
  const s = await getSettings();
  let row: SessionRow;
  try {
    row = await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(consultSessions).where(eq(consultSessions.id, sessionId)).for('update').limit(1);
      if (!cur || cur.vendorId !== vendorId) throw notFound('Session');
      if (cur.status !== 'REQUESTED') throw conflict('INVALID_STATE', 'Yeh request ab accept nahi ho sakti');
      if (Date.now() - cur.requestedAt.getTime() > s.requestTimeoutSec * 1000) {
        const [m] = await tx
          .update(consultSessions)
          .set({ status: 'MISSED', endedAt: new Date(), endReason: 'TIMEOUT' })
          .where(eq(consultSessions.id, cur.id))
          .returning();
        return m;
      }
      const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, cur.userId)).limit(1);
      const affordableMinutes = Math.floor((w?.balance ?? 0) / cur.ratePerMin);
      if (affordableMinutes < 1) {
        const [c] = await tx
          .update(consultSessions)
          .set({ status: 'CANCELLED', endedAt: new Date(), endReason: 'INSUFFICIENT_BALANCE' })
          .where(eq(consultSessions.id, cur.id))
          .returning();
        return c;
      }
      const [act] = await tx
        .update(consultSessions)
        .set({ status: 'ACTIVE', acceptedAt: new Date(), maxSeconds: affordableMinutes * 60 })
        .where(eq(consultSessions.id, cur.id))
        .returning();
      return act;
    });
  } catch (e) {
    if (isUniqueViolation(e, 'cs_one_active_per_vendor_uq')) {
      throw conflict('ALREADY_IN_SESSION', 'Pehle chal raha session khatam karein');
    }
    throw e;
  }
  await broadcast(row, vendorUserId);
  if (row.status !== 'ACTIVE') throw conflict(row.endReason ?? 'INVALID_STATE', 'Session shuru nahi ho saka');
  return publicSession(row);
}

export async function rejectByVendor(vendorUserId: string, sessionId: string) {
  const vendorId = await myVendorId(vendorUserId);
  const [row] = await db
    .update(consultSessions)
    .set({ status: 'REJECTED', endedAt: new Date(), endReason: 'ASTROLOGER_REJECTED' })
    .where(
      and(eq(consultSessions.id, sessionId), eq(consultSessions.vendorId, vendorId), eq(consultSessions.status, 'REQUESTED')),
    )
    .returning();
  if (!row) throw conflict('INVALID_STATE', 'Yeh request ab reject nahi ho sakti');
  await broadcast(row, vendorUserId);
  return publicSession(row);
}

export async function pendingForVendor(vendorUserId: string) {
  const vendorId = await myVendorId(vendorUserId);
  const rows = await db
    .select({ s: consultSessions, userName: users.name })
    .from(consultSessions)
    .innerJoin(users, eq(users.id, consultSessions.userId))
    .where(and(eq(consultSessions.vendorId, vendorId), inArray(consultSessions.status, ['REQUESTED', 'ACTIVE'])))
    .orderBy(desc(consultSessions.requestedAt));
  return rows.map((r) => ({ ...publicSession(r.s), userName: r.userName?.split(' ')[0] ?? 'User', intake: r.s.intake }));
}

/** Vendor ki session history (kamai ke saath) */
export async function vendorSessions(vendorUserId: string, page: number, limit: number) {
  const [v] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, vendorUserId)).limit(1);
  if (!v) throw forbidden('Vendor profile nahi mila');
  const rows = await db
    .select({ s: consultSessions, userName: users.name })
    .from(consultSessions)
    .innerJoin(users, eq(users.id, consultSessions.userId))
    .where(eq(consultSessions.vendorId, v.id))
    .orderBy(desc(consultSessions.requestedAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return rows.map((r) => ({ ...publicSession(r.s), vendorEarning: r.s.vendorEarning, userName: r.userName?.split(' ')[0] ?? 'User', intake: r.s.intake }));
}

// ---------------- Dono taraf ----------------

/** Session ka hissa hai ya nahi: user khud, ya us session ka vendor */
export async function getParticipantSession(actorId: string, sessionId: string) {
  const [row] = await db
    .select({ s: consultSessions, vendorUserId: vendors.userId })
    .from(consultSessions)
    .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
    .where(eq(consultSessions.id, sessionId))
    .limit(1);
  if (!row || (row.s.userId !== actorId && row.vendorUserId !== actorId)) throw notFound('Session');
  return { session: row.s, vendorUserId: row.vendorUserId, isUser: row.s.userId === actorId };
}

export async function getSessionDetail(actorId: string, sessionId: string) {
  const { session } = await getParticipantSession(actorId, sessionId);
  const [a] = await db
    .select({ id: vendors.id, displayName: vendors.displayName, avatarUrl: vendors.avatarUrl })
    .from(vendors)
    .where(eq(vendors.id, session.vendorId))
    .limit(1);
  const [u] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, session.userId)).limit(1);
  // Vendor ko user ka sirf pehla naam dikhta hai (privacy)
  return { ...publicSession(session), vendor: a, user: { id: u.id, name: u.name?.split(' ')[0] ?? 'User' }, intake: session.intake };
}

export async function endSession(actorId: string, sessionId: string) {
  const { session, vendorUserId, isUser } = await getParticipantSession(actorId, sessionId);
  if (session.status === 'REQUESTED' && isUser) return cancelByUser(actorId, sessionId);
  if (session.status !== 'ACTIVE') throw conflict('INVALID_STATE', 'Session chal nahi raha');
  return finalizeSession(sessionId, isUser ? 'USER_ENDED' : 'ASTROLOGER_ENDED', vendorUserId);
}

/**
 * Session band + billing. Ek hi baar chalta hai (row lock + ACTIVE check).
 * Paisa user ke wallet se katta hai, commission ke baad vendor ke wallet mein jaata hai.
 */
export async function finalizeSession(sessionId: string, reason: string, vendorUserId?: string, now = new Date()) {
  const row = await db.transaction(async (tx: Tx) => {
    const [cur] = await tx.select().from(consultSessions).where(eq(consultSessions.id, sessionId)).for('update').limit(1);
    if (!cur || cur.status !== 'ACTIVE' || !cur.acceptedAt) return cur ?? null;
    const elapsed = (now.getTime() - cur.acceptedAt.getTime()) / 1000;
    let bill = computeBilling({ ratePerMin: cur.ratePerMin, commissionPct: cur.commissionPct, maxSeconds: cur.maxSeconds ?? 0 }, elapsed);

    if (bill.charge > 0) {
      try {
        await postTxn(tx, {
          userId: cur.userId,
          type: 'SESSION_CHARGE',
          amount: -bill.charge,
          referenceType: 'session',
          referenceId: cur.id,
          note: `${cur.type} session (${bill.minutes} min)`,
        });
      } catch (e) {
        if (!(e instanceof InsufficientBalanceError)) throw e;
        // Bahut hi kam hone wali sthiti: jitna balance hai utna hi katega
        const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, cur.userId)).limit(1);
        const charge = w?.balance ?? 0;
        const fee = Math.round((charge * cur.commissionPct) / 100);
        bill = { ...bill, charge, vendorEarning: charge - fee };
        logger.warn({ sessionId, charge }, 'Session charge capped at balance');
        if (charge > 0)
          await postTxn(tx, {
            userId: cur.userId,
            type: 'SESSION_CHARGE',
            amount: -charge,
            referenceType: 'session',
            referenceId: cur.id,
            note: `${cur.type} session (${bill.minutes} min)`,
          });
      }
    }
    const [a] = await tx
      .update(vendors)
      .set({ totalMinutes: sql`${vendors.totalMinutes} + ${bill.minutes}`, totalSessions: sql`${vendors.totalSessions} + 1` })
      .where(eq(vendors.id, cur.vendorId))
      .returning({ userId: vendors.userId });
    if (bill.vendorEarning > 0) {
      await postTxn(tx, {
        userId: a.userId,
        type: 'SESSION_EARNING',
        amount: bill.vendorEarning,
        referenceType: 'session',
        referenceId: cur.id,
        note: `${cur.type} session earning`,
      });
    }
    const [done] = await tx
      .update(consultSessions)
      .set({
        status: 'COMPLETED',
        endedAt: now,
        endReason: reason,
        billedSeconds: bill.billedSeconds,
        chargedAmount: bill.charge,
        vendorEarning: bill.vendorEarning,
      })
      .where(eq(consultSessions.id, cur.id))
      .returning();
    return done;
  });
  if (!row) throw notFound('Session');
  await broadcast(row, vendorUserId);
  return publicSession(row);
}

/** Har kuch second: balance khatam wale session band, purane request MISSED */
export async function sweepSessions(now = new Date()) {
  const expired = await db
    .select({ id: consultSessions.id })
    .from(consultSessions)
    .where(
      and(
        eq(consultSessions.status, 'ACTIVE'),
        sql`${consultSessions.acceptedAt} + make_interval(secs => ${consultSessions.maxSeconds}) <= ${now.toISOString()}::timestamptz`,
      ),
    );
  for (const s of expired) {
    try {
      await finalizeSession(s.id, 'BALANCE_EXHAUSTED', undefined, now);
    } catch (err) {
      logger.error({ err, sessionId: s.id }, 'Auto-end failed');
    }
  }
  const st = await getSettings();
  const missed = await db
    .update(consultSessions)
    .set({ status: 'MISSED', endedAt: now, endReason: 'TIMEOUT' })
    .where(
      and(
        eq(consultSessions.status, 'REQUESTED'),
        lte(consultSessions.requestedAt, new Date(now.getTime() - st.requestTimeoutSec * 1000)),
      ),
    )
    .returning();
  for (const m of missed) await broadcast(m);
  return { ended: expired.length, missed: missed.length };
}

/**
 * Session ke beech recharge: naye balance se session ka max samay badhao (kabhi ghatao nahi).
 * Paisa session ke ant mein hi katta hai, isliye balance = poora uplabdh paisa.
 */
export async function refreshSessionLimit(userId: string) {
  const row = await db.transaction(async (tx) => {
    const [cur] = await tx
      .select()
      .from(consultSessions)
      .where(and(eq(consultSessions.userId, userId), eq(consultSessions.status, 'ACTIVE')))
      .for('update')
      .limit(1);
    if (!cur) return null;
    const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const newMax = Math.floor((w?.balance ?? 0) / cur.ratePerMin) * 60;
    if (newMax <= (cur.maxSeconds ?? 0)) return null;
    const [up] = await tx.update(consultSessions).set({ maxSeconds: newMax }).where(eq(consultSessions.id, cur.id)).returning();
    return up;
  });
  if (row) await broadcast(row);
  return row ? publicSession(row) : null;
}

export async function userSessions(userId: string, type: SessionType | undefined, page: number, limit: number) {
  const conds = [eq(consultSessions.userId, userId)];
  if (type) conds.push(eq(consultSessions.type, type));
  const rows = await db
    .select({ s: consultSessions, vendorName: vendors.displayName, vendorAvatar: vendors.avatarUrl })
    .from(consultSessions)
    .innerJoin(vendors, eq(vendors.id, consultSessions.vendorId))
    .where(and(...conds))
    .orderBy(desc(consultSessions.requestedAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return rows.map((r) => ({
    ...publicSession(r.s),
    vendor: { id: r.s.vendorId, displayName: r.vendorName, avatarUrl: r.vendorAvatar },
  }));
}

export async function openSessionForUser(userId: string) {
  const [row] = await db
    .select()
    .from(consultSessions)
    .where(and(eq(consultSessions.userId, userId), inArray(consultSessions.status, ['REQUESTED', 'ACTIVE'])))
    .limit(1);
  return row ? publicSession(row) : null;
}
