import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export interface HostRoom {
  id: string;
  title: string;
  type: 'AUDIO' | 'VIDEO';
  ratePerMin: number;
  totalEarned: number;
  peakListeners: number;
  startedAt: string;
}
export interface HostRoomState {
  room: HostRoom | null;
  listeners: { userId: string; name: string; joinedAt: string }[];
}

/** Mera abhi chal raha live room (agar hai) + usme kaun-kaun hai */
export function useHostRoom(refetchMs: number | false = 6000) {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return useQuery({ queryKey: ['vroom'], enabled: signedIn, queryFn: () => api<HostRoomState>('/vendor/rooms/current'), refetchInterval: refetchMs });
}
