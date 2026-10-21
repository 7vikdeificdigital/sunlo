import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import type { Category, Helpline, Paged, RechargePack, Session, User, VendorCard, VendorDetail, WalletTxn } from './types';

export const qk = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  config: ['config'] as const,
};

export function useMe() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: qk.me,
    enabled: signedIn,
    queryFn: async () => {
      const r = await api<{ user: User; walletBalance: number }>('/me');
      useAuth.getState().setUser(r.user);
      return r;
    },
  });
}

export interface AppConfig {
  settings: { appName: string; currency: string; gstPct: number; minSessionMinutes: number; minRechargePaise: number; supportEmail: string };
  categories: Category[];
  languages: string[];
  helplines: Helpline[];
}
export const useAppConfig = () => useQuery({ queryKey: qk.config, queryFn: () => api<AppConfig>('/app/config', { auth: false }), staleTime: 10 * 60_000 });

export interface VendorFilters {
  service: 'chat' | 'call';
  search?: string;
  categoryId?: string;
  sort?: string;
  online?: boolean;
  limit?: number;
}

export function useVendors(f: VendorFilters) {
  return useInfiniteQuery({
    queryKey: ['vendors', f],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Paged<VendorCard>>('/vendors', {
        query: { service: f.service, search: f.search, categoryId: f.categoryId, sort: f.sort, online: f.online ? 'true' : undefined, page: pageParam, limit: f.limit ?? 15 },
      }),
    getNextPageParam: (last) => (last.page * last.limit < (last.total ?? 0) ? last.page + 1 : undefined),
  });
}

export const useVendor = (id: string) => useQuery({ queryKey: ['vendor', id], queryFn: () => api<VendorDetail>(`/vendors/${id}`) });

export const useVendorReviews = (id: string) =>
  useQuery({
    queryKey: ['vendor', id, 'reviews'],
    queryFn: () =>
      api<Paged<{ id: string; rating: number; comment: string | null; reply: string | null; userName: string; createdAt: string }>>(`/vendors/${id}/reviews`, { query: { limit: 10 } }),
  });

export const useWallet = () => useQuery({ queryKey: qk.wallet, queryFn: () => api<{ balance: number; packs: RechargePack[]; provider: 'mock' | 'razorpay' }>('/wallet') });

export const useWalletTxns = () =>
  useInfiniteQuery({
    queryKey: ['wallet', 'txns'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<WalletTxn>>('/wallet/transactions', { query: { page: pageParam, limit: 20 } }),
    getNextPageParam: (last) => (last.page * last.limit < (last.total ?? 0) ? last.page + 1 : undefined),
  });

export const useSessions = (type?: 'CHAT' | 'AUDIO' | 'VIDEO') =>
  useQuery({ queryKey: ['sessions', type ?? 'all'], queryFn: () => api<Paged<Session>>('/sessions', { query: { type, limit: 50 } }) });

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  link: string | null;
}
export const useBanners = () => useQuery({ queryKey: ['banners'], queryFn: () => api<{ items: Banner[] }>('/banners', { auth: false }), staleTime: 5 * 60_000 });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Paged<{ id: string; title: string; body: string; readAt: string | null; createdAt: string }> & { unread: number }>('/notifications'),
  });
