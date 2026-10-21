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
