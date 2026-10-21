import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './api';
import { getSocket, emitAck } from './socket';
import type { Session } from './types';

export type SessionDetail = Session & {
  vendor: { id: string; displayName: string; avatarUrl: string | null };
  user: { id: string; name: string | null };
  intake: { topic?: string; note?: string } | null;
};

/** Session ki taaza halat: pehle API se, phir socket se live updates */
export function useLiveSession(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['session', id], queryFn: () => api<SessionDetail>(`/sessions/${id}`), refetchInterval: (query) => (query.state.data?.status === 'REQUESTED' ? 5000 : false) });

  useEffect(() => {
    const s = getSocket();
    const join = () => void emitAck('session:join', { sessionId: id });
    if (s.connected) join();
    s.on('connect', join); // reconnect par dobara room join
    const onUpdate = (u: Session) => {
      if (u.id === id) qc.setQueryData<SessionDetail>(['session', id], (old) => (old ? { ...old, ...u } : old));
    };
    s.on('session:update', onUpdate);
    return () => {
      s.off('connect', join);
      s.off('session:update', onUpdate);
    };
  }, [id, qc]);

  return q;
}

/** Server ke endsAt ke hisaab se bacha hua samay (second) */
export function useRemaining(endsAt: string | null | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!endsAt) return null;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
}

export function useElapsed(since: string | null | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!since) return 0;
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
}
