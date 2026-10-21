/** Web preview ke liye (SecureStore web par nahi chalta). Asli app mobile par SecureStore use karti hai. */
export const secureStorage = {
  get: async (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: async (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* private mode etc. */
    }
  },
  remove: async (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};
