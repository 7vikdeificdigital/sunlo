import type { Server } from 'socket.io';

/** Socket.IO instance; server start par set hota hai. Tests/scripts mein na ho to emit chupchaap skip. */
let io: Server | null = null;

export const setIo = (s: Server | null) => {
  io = s;
};

export const userRoom = (userId: string) => `user:${userId}`;
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToSession(sessionId: string, event: string, payload: unknown) {
  io?.to(sessionRoom(sessionId)).emit(event, payload);
}

/** Naye device par login hua: purane sab sockets ko batao aur band karo (naya device abhi judha nahi hota) */
export async function kickUserSockets(userId: string) {
  if (!io) return;
  try {
    const socks = await io.in(userRoom(userId)).fetchSockets();
    for (const s of socks) {
      s.emit('auth:revoked', { reason: 'NEW_DEVICE_LOGIN' });
      setTimeout(() => s.disconnect(true), 500);
    }
  } catch {
    /* best effort: socket na bhi band ho to token version se agli request par logout ho jayega */
  }
}

export const roomChannel = (roomId: string) => `room:${roomId}`;
export function emitToRoom(roomId: string, event: string, payload: unknown) {
  io?.to(roomChannel(roomId)).emit(event, payload);
}
