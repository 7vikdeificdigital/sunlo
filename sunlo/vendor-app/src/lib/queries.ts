import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import type { Category, Paged, Session, Statement, VendorBooking, VendorMe, WalletTxn, Withdrawal } from './types';

export const qk = {
  me: ['vendor-me'] as const,
  config: ['config'] as const,
  pending: ['pending'] as const,
};

export function useVendorMe() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return useQuery({ queryKey: qk.me, enabled: signedIn, queryFn: () => api<VendorMe>('/vendor/me') });
}

export interface AppConfig {
  settings: { appName: string; minRatePerMinPaise: number; maxRatePerMinPaise: number; minWithdrawalPaise: number; supportEmail: string; liveRoomsEnabled?: boolean; videoCallsEnabled?: boolean; policyVersion?: string };
  categories: Category[];
  languages: string[];
}
export const useAppConfig = () => useQuery({ queryKey: qk.config, queryFn: () => api<AppConfig>('/app/config', { auth: false }), staleTime: 10 * 60_000 });

export const usePending = (enabled: boolean) =>
  useQuery({ queryKey: qk.pending, enabled, refetchInterval: 10_000, queryFn: () => api<{ items: Session[] }>('/vendor/sessions/pending') });

export const useVendorSessions = () => useQuery({ queryKey: ['vendor-sessions'], queryFn: () => api<Paged<Session>>('/vendor/sessions', { query: { limit: 50 } }) });

export interface Stat {
  earning: number;
  minutes: number;
  sessions: number;
}
export const useEarnings = () =>
  useQuery({ queryKey: ['earnings'], queryFn: () => api<{ balance: number; today: Stat; week: Stat; month: Stat; transactions: WalletTxn[] }>('/vendor/earnings') });

export const useWithdrawals = () => useQuery({ queryKey: ['withdrawals'], queryFn: () => api<{ items: Withdrawal[] }>('/vendor/withdrawals') });

export const useReviews = () =>
  useQuery({
    queryKey: ['reviews'],
    queryFn: () => api<{ items: { id: string; rating: number; comment: string | null; reply: string | null; userName: string; createdAt: string }[]; ratingAvg: number; ratingCount: number }>('/vendor/reviews'),
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Paged<{ id: string; title: string; body: string; readAt: string | null; createdAt: string }> & { unread: number }>('/notifications'),
  });

export const useStatement = (month: string) => useQuery({ queryKey: ['statement', month], queryFn: () => api<Statement>('/vendor/statement', { query: { month } }) });

export const useVendorBookings = (enabled = true) =>
  useQuery({ queryKey: ['vendor-bookings'], enabled, refetchInterval: 60_000, queryFn: () => api<{ items: VendorBooking[] }>('/vendor/scheduled-calls') });
