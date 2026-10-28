import { useCallback, useEffect, useRef, useState } from 'react';
import { emitAck, getSocket } from './socket';

export type RoomChatMsg = { id: string; userId: string; name: string; host: boolean; body: string };

/** Room ka live socket: chat, listener ginti, room khatam / hataya gaya / balance seema */
export function useRoomLive(roomId: string | undefined, opts: { onEnded?: (reason: string) => void; onKicked?: (reason: string) => void; onLimit?: (endsAt: string | null) => void } = {}) {
  const [messages, setMessages] = useState<RoomChatMsg[]>([]);
  const [listeners, setListeners] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(opts);
  cb.current = opts;

  useEffect(() => {
    if (!roomId) return;
    const s = getSocket();
    let seq = 0;
    const join = () => void emitAck('room:join', { roomId }).then((r) => setError(r.ok ? null : (r.error ?? 'Room se jud nahi paye')));
    const onChat = (m: { roomId: string; userId: string; name: string; host: boolean; body: string }) => {
      if (m.roomId !== roomId) return;
      setMessages((x) => [...x.slice(-60), { id: `${Date.now()}-${seq++}`, userId: m.userId, name: m.name, host: m.host, body: m.body }]);
    };
    const onUpdate = (p: { roomId: string; listeners: number }) => p.roomId === roomId && setListeners(p.listeners);
    const onEnded = (p: { roomId: string; reason: string }) => p.roomId === roomId && cb.current.onEnded?.(p.reason);
    const onKicked = (p: { roomId: string; reason: string }) => p.roomId === roomId && cb.current.onKicked?.(p.reason);
    const onLimit = (p: { roomId: string; endsAt: string | null }) => p.roomId === roomId && cb.current.onLimit?.(p.endsAt);
    join();
    s.on('connect', join);
    s.on('room:chat', onChat);
    s.on('room:update', onUpdate);
    s.on('room:ended', onEnded);
    s.on('room:kicked', onKicked);
    s.on('room:limit', onLimit);
    return () => {
      s.off('connect', join);
      s.off('room:chat', onChat);
      s.off('room:update', onUpdate);
      s.off('room:ended', onEnded);
      s.off('room:kicked', onKicked);
      s.off('room:limit', onLimit);
    };
  }, [roomId]);

  const send = useCallback(
    async (body: string) => {
      if (!roomId || !body.trim()) return null;
      const r = await emitAck('room:chat', { roomId, body: body.trim() });
      return r.ok ? null : (r.error ?? 'Message nahi gaya');
    },
    [roomId],
  );

  return { messages, listeners, error, send };
}
