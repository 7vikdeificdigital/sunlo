import { create } from 'zustand';
import { secureStorage } from './storage';
import type { User } from './types';

const K_ACCESS = 'aw.access';
const K_REFRESH = 'aw.refresh';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  hydrate: () => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setUser: (u: User) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrate: async () => {
    const [a, r] = await Promise.all([secureStorage.get(K_ACCESS), secureStorage.get(K_REFRESH)]);
    set({ accessToken: a, refreshToken: r, status: r ? 'signedIn' : 'signedOut' });
  },
  setTokens: async (access, refresh) => {
    await Promise.all([secureStorage.set(K_ACCESS, access), secureStorage.set(K_REFRESH, refresh)]);
    set({ accessToken: access, refreshToken: refresh, status: 'signedIn' });
  },
  setUser: (user) => set({ user }),
  signOut: async () => {
    await Promise.all([secureStorage.remove(K_ACCESS), secureStorage.remove(K_REFRESH)]);
    set({ accessToken: null, refreshToken: null, user: null, status: 'signedOut' });
  },
}));
