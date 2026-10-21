import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { db } from '../../db/client';
import { chatMessages } from '../../db/schema';
import { filterMessage } from '../../lib/contentFilter';
import { HttpError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emitToSession, sessionRoom, setIo, userRoom } from '../../lib/realtime';
import { getSettings } from '../../lib/settings';
import { verifyAccessToken, type AuthUser } from '../../middleware/auth';
import { eq } from 'drizzle-orm';
import { vendors } from '../../db/schema';
import { getParticipantSession } from './service';

/** Vendor ka app band/internet gaya: 60 sec baad apne aap offline (taaki users offline vendor ko request na bhejein) */
const vendorSockets = new Map<string, number>();
const offlineTimers = new Map<string, NodeJS.Timeout>();

type Ack = (r: { ok: boolean; error?: string; [k: string]: unknown }) => void;

/**
 * Real-time chat (Socket.IO). Purane system mein chat Firebase par thi aur app mein admin key thi;
 * ab sab hamare server se: har connection login token se, har room mein sirf session ke participants.
 */
export function attachSocket(server: HttpServer, corsOrigins: string[] | true) {
  const io = new Server(server, {
    cors: { origin: corsOrigins, credentials: false },
    maxHttpBufferSize: 16 * 1024, // bade payload nahi
    pingInterval: 20_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string })?.token;
      if (!token) return next(new Error('UNAUTHORIZED'));
      socket.data.auth = await verifyAccessToken(token);
      socket.data.sessions = new Set<string>();
      socket.data.bucket = { tokens: 10, at: Date.now() };
      next();
      } catch (e) {
        logger.warn({ err: String(e) }, 'socket auth fail');
        next(new Error('UNAUTHORIZED'));
      }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth as AuthUser;
    void socket.join(userRoom(auth.id));
    logger.info({ userId: auth.id, role: auth.role }, 'socket connected');

    if (auth.role === 'VENDOR') {
      vendorSockets.set(auth.id, (vendorSockets.get(auth.id) ?? 0) + 1);
      clearTimeout(offlineTimers.get(auth.id));
      socket.on('disconnect', () => {
        const n = (vendorSockets.get(auth.id) ?? 1) - 1;
        vendorSockets.set(auth.id, n);
        if (n <= 0) {
          offlineTimers.set(
            auth.id,
            setTimeout(() => {
              if ((vendorSockets.get(auth.id) ?? 0) <= 0) {
                db.update(vendors).set({ isOnline: false }).where(eq(vendors.userId, auth.id)).catch((err) => logger.error({ err }, 'auto offline failed'));
              }
            }, 60_000).unref(),
          );
        }
      });
    }

    const fail = (ack: Ack | undefined, e: unknown) => {
      const msg = e instanceof HttpError ? e.message : 'Kuch gadbad ho gayi';
      if (!(e instanceof HttpError)) logger.error({ err: e }, 'socket handler error');
      ack?.({ ok: false, error: msg });
    };

    socket.on('session:join', async (raw: unknown, ack?: Ack) => {
      try {
        const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(raw);
        await getParticipantSession(auth.id, sessionId);
        (socket.data.sessions as Set<string>).add(sessionId);
        await socket.join(sessionRoom(sessionId));
        ack?.({ ok: true });
      } catch (e) {
        fail(ack, e instanceof z.ZodError ? new HttpError(400, 'BAD', 'Galat request') : e);
      }
    });

    socket.on('chat:send', async (raw: unknown, ack?: Ack) => {
      try {
        // Spam se bachav: ~1 message/second, 10 tak burst
        const b = socket.data.bucket as { tokens: number; at: number };
        b.tokens = Math.min(10, b.tokens + (Date.now() - b.at) / 1000);
        b.at = Date.now();
        if (b.tokens < 1) throw new HttpError(429, 'SLOW_DOWN', 'Thoda dheere');
        b.tokens -= 1;

        const input = z
          .object({ sessionId: z.string().uuid(), body: z.string().trim().min(1).max(2000), clientId: z.string().max(64).optional() })
          .parse(raw);
        const { session } = await getParticipantSession(auth.id, input.sessionId);
        if (session.type !== 'CHAT') throw new HttpError(400, 'NOT_CHAT', 'Yeh chat session nahi hai');
        if (session.status !== 'ACTIVE') throw new HttpError(409, 'INVALID_STATE', 'Chat abhi chalu nahi hai');

        const s = await getSettings();
        const filtered = s.maskContactInfoInChat ? await filterMessage(input.body) : { body: input.body, flagged: false };
        const [msg] = await db
          .insert(chatMessages)
          .values({ sessionId: session.id, senderId: auth.id, body: filtered.body, flagged: filtered.flagged })
          .returning();
        const out = { id: msg.id, sessionId: msg.sessionId, senderId: msg.senderId, body: msg.body, createdAt: msg.createdAt, clientId: input.clientId };
        emitToSession(session.id, 'chat:message', out);
        ack?.({ ok: true, message: out, masked: filtered.flagged });
      } catch (e) {
        fail(ack, e instanceof z.ZodError ? new HttpError(400, 'BAD', 'Galat message') : e);
      }
    });

    socket.on('chat:typing', (raw: unknown) => {
      const p = z.object({ sessionId: z.string().uuid() }).safeParse(raw);
      if (!p.success || !(socket.data.sessions as Set<string>).has(p.data.sessionId)) return;
      socket.to(sessionRoom(p.data.sessionId)).emit('chat:typing', { sessionId: p.data.sessionId, userId: auth.id });
    });
  });

  setIo(io);
  return io;
}
