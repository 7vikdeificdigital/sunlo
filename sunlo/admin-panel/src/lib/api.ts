/** Admin API client. Access token memory mein; refresh token sessionStorage mein (tab band = logout). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const K = 'sunlo.admin.refresh';
let access: string | null = null;
let listeners: (() => void)[] = [];
const ss = {
  get: () => { try { return sessionStorage.getItem(K); } catch { return null; } },
  set: (v: string) => { try { sessionStorage.setItem(K, v); } catch { /* ignore */ } },
  del: () => { try { sessionStorage.removeItem(K); } catch { /* ignore */ } },
};

export const auth = {
  isLoggedIn: () => Boolean(access || ss.get()),
  set(a: string, r: string) { access = a; ss.set(r); listeners.forEach((l) => l()); },
  clear() { access = null; ss.del(); listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.push(l); return () => { listeners = listeners.filter((x) => x !== l); }; },
  refreshToken: () => ss.get(),
};

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = ss.get();
    if (!rt) return false;
    try {
      const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
      if (!r.ok) { auth.clear(); return false; }
      const d = await r.json();
      auth.set(d.accessToken, d.refreshToken);
      return true;
    } catch { return false; } finally { setTimeout(() => (refreshing = null), 0); }
  })();
  return refreshing;
}

type Q = Record<string, string | number | boolean | undefined | null>;
export async function api<T>(path: string, opts: { method?: string; body?: unknown; query?: Q; raw?: boolean } = {}): Promise<T> {
  const qs = opts.query
    ? '?' + Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  if (!access && ss.get()) await refresh();
  const go = () =>
    fetch(`${API_URL}${path}${qs}`, {
      method: opts.method ?? 'GET',
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(access ? { authorization: `Bearer ${access}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  let res: Response;
  try { res = await go(); } catch { throw new ApiError(0, 'NETWORK', 'Server se connect nahi ho paaye'); }
  if (res.status === 401 && ss.get() && (await refresh())) res = await go();
  if (opts.raw && res.ok) return (await res.blob()) as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) auth.clear();
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? 'Kuch gadbad ho gayi', e.details);
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Kuch gadbad ho gayi');
export const fileUrl = (p: string | null | undefined) => (p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null);
