import { useCallback, useEffect, useRef, useState } from 'react';
import { emitAck, getSocket } from './socket';

export type RoomChatMsg = { id: string; userId: string; name: string; host: boolean; body: string; gift?: { name: string; icon: string; coins: number } };

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
    const seenGifts = new Set<string>();
    // Gift: bade animation ki jagah chat mein "superchat" jaisa highlighted message
    const onGift = (g: { id?: string; roomId?: string; from: string; name: string; icon: string; price: number }) => {
      if (g.roomId !== roomId) return;
      if (g.id) {
        if (seenGifts.has(g.id)) return;
        seenGifts.add(g.id);
      }
      setMessages((x) => [...x.slice(-60), { id: `g-${g.id ?? Date.now()}-${seq++}`, userId: '', name: g.from, host: false, body: '', gift: { name: g.name, icon: g.icon, coins: Math.round(g.price / 100) } }]);
    };
    const onUpdate = (p: { roomId: string; listeners: number }) => p.roomId === roomId && setListeners(p.listeners);
    const onEnded = (p: { roomId: string; reason: string }) => p.roomId === roomId && cb.current.onEnded?.(p.reason);
    const onKicked = (p: { roomId: string; reason: string }) => p.roomId === roomId && cb.current.onKicked?.(p.reason);
    const onLimit = (p: { roomId: string; endsAt: string | null }) => p.roomId === roomId && cb.current.onLimit?.(p.endsAt);
    join();
    s.on('connect', join);
    s.on('room:chat', onChat);
    s.on('room:update', onUpdate);
    s.on('gift', onGift);
    s.on('room:ended', onEnded);
    s.on('room:kicked', onKicked);
    s.on('room:limit', onLimit);
    return () => {
      s.off('connect', join);
      s.off('room:chat', onChat);
      s.off('room:update', onUpdate);
      s.off('gift', onGift);
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
