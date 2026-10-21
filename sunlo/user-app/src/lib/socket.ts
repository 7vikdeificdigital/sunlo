import { io, type Socket } from 'socket.io-client';
import { API_URL, api } from './api';
import { useAuth } from './auth';

let socket: Socket | null = null;

const origin = () => API_URL.replace(/\/api\/v1\/?$/, '');

/** Ek hi socket connection poori app ke liye. Har reconnect par taaza token. */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(origin(), {
    transports: ['websocket'],
    auth: (cb) => cb({ token: useAuth.getState().accessToken ?? '' }),
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  socket.on('connect_error', async (err) => {
    if (err.message === 'UNAUTHORIZED') {
      // Token purana: ek chhoti API call refresh karwa degi, phir socket khud dobara judega
      try {
        await api('/me');
      } catch {
        /* signOut ho chuka hoga */
      }
    }
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function emitAck<T = { ok: boolean; error?: string }>(event: string, payload: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve) => {
    const s = getSocket();
    s.timeout(timeoutMs).emit(event, payload, (err: unknown, res: T) => {
      if (err) resolve({ ok: false, error: 'Connection slow hai, dobara koshish karein' } as T);
      else resolve(res);
    });
  });
}
