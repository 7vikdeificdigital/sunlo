import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { SessionType } from './types';

export interface RandomPerson { id: string; name: string; avatarUrl: string | null; language: string | null; types: SessionType[] }
export type RandomOverview = Record<SessionType, { online: number; minRate: number | null }> & { people: RandomPerson[] };

/** Connect screen ke liye: har type par kitne listener abhi free hain + sabse kam rate */
export function useRandomOverview() {
  return useQuery({ queryKey: ['random-overview'], queryFn: () => api<RandomOverview>('/random/overview'), refetchInterval: 10_000, staleTime: 5_000 });
}

export const TYPE_META: Record<SessionType, { title: string; verb: string; icon: 'chatbubble-ellipses' | 'call' | 'videocam'; colors: [string, string] }> = {
  CHAT: { title: 'Random Chat', verb: 'Chat', icon: 'chatbubble-ellipses', colors: ['#8B6CFF', '#5A3BEF'] },
  AUDIO: { title: 'Random Voice Call', verb: 'Voice call', icon: 'call', colors: ['#FF7AB6', '#F2559F'] },
  VIDEO: { title: 'Random Video Call', verb: 'Video call', icon: 'videocam', colors: ['#FFB070', '#FF7A59'] },
};
