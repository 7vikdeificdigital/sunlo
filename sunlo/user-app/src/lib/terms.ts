import { create } from 'zustand';
import { secureStorage } from './storage';

/** Terms ka version badlo to sabko dobara sahmati deni padegi */
export const TERMS_VERSION = '2026-10';
const KEY = 'aw.terms';

interface TermsState {
  ready: boolean;
  accepted: boolean;
  hydrate: () => Promise<void>;
  accept: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useTerms = create<TermsState>((set) => ({
  ready: false,
  accepted: false,
  hydrate: async () => {
    let v: string | null = null;
    try {
      v = await secureStorage.get(KEY);
    } catch {
      v = null;
    }
    set({ ready: true, accepted: !!v && v.startsWith(`${TERMS_VERSION}|`) });
  },
  accept: async () => {
    try {
      await secureStorage.set(KEY, `${TERMS_VERSION}|${new Date().toISOString()}`);
    } catch {
      /* storage na chale to bhi is session mein aage badhne dein */
    }
    set({ accepted: true });
  },
  /** Logout par: agli baar login se pehle Get Started + Terms (tick ke saath) dobara */
  reset: async () => {
    try {
      await secureStorage.remove(KEY);
    } catch {
      /* ignore */
    }
    set({ accepted: false });
  },
}));
